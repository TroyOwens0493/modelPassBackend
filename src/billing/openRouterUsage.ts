import { randomUUID } from "node:crypto";
import { OpenRouter } from "@openrouter/sdk";
import type { ChatMessages, ChatUsage } from "@openrouter/sdk/models";
import {
  creditsForCost,
  finalizeCreditReservation,
  getPendingCreditReservations,
  markCreditReservationPending,
  releaseCreditReservation,
  releaseExpiredUnlinkedReservations,
  reserveCredits,
} from "./creditLedger.js";

const openRouterKey = process.env.OPEN_ROUTER_API_KEY;

if (!openRouterKey) {
  throw new Error("OPENROUTER_API_KEY environment variable is required");
}

const client = new OpenRouter({
  apiKey: openRouterKey,
  httpReferer: "modelpass.netlify.app",
  appTitle: "Model Pass",
});
const maxOutputTokens = Math.max(
  16,
  Math.trunc(Number(process.env.MAX_OUTPUT_TOKENS ?? "1024")),
);
const pricingSafetyFactor = Math.max(
  1,
  Number(process.env.MODEL_PRICING_SAFETY_FACTOR ?? "2"),
);
const modelPricingCache = new Map<
  string,
  { prompt: number; completion: number; request: number; expiresAt: number }
>();

interface StreamBillableCompletionInput {
  workosUserId: string;
  model: string;
  messages: ChatMessages[];
  onStart: () => void;
  onText: (content: string) => void;
}

interface ResolvedUsage {
  costUsd: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
}

/** Estimates the largest credit charge a model request should produce. */
async function maximumCreditsForRequest(
  model: string,
  messages: ChatMessages[],
) {
  let pricing = modelPricingCache.get(model);

  if (!pricing || pricing.expiresAt < Date.now()) {
    const separator = model.indexOf("/");
    if (separator < 1 || separator === model.length - 1) {
      throw new Error("Invalid OpenRouter model slug");
    }

    const response = await client.models.get({
      author: model.slice(0, separator),
      slug: model.slice(separator + 1),
    });
    pricing = {
      prompt: Number(response.data.pricing.prompt),
      completion: Number(response.data.pricing.completion),
      request: Number(response.data.pricing.request ?? "0"),
      expiresAt: Date.now() + 5 * 60 * 1000,
    };

    if (
      !Number.isFinite(pricing.prompt) ||
      !Number.isFinite(pricing.completion) ||
      !Number.isFinite(pricing.request)
    ) {
      throw new Error("OpenRouter returned invalid model pricing");
    }

    modelPricingCache.set(model, pricing);
  }

  const maximumInputTokens = messages.reduce(
    (total, message) =>
      total +
      (typeof message.content === "string"
        ? Buffer.byteLength(message.content, "utf8")
        : 0) +
      32,
    100,
  );
  const maximumCost =
    (maximumInputTokens * pricing.prompt +
      maxOutputTokens * pricing.completion +
      pricing.request) *
    pricingSafetyFactor;

  return creditsForCost(maximumCost);
}

/** Resolves final OpenRouter usage from a stream or its generation record. */
async function resolveUsage(
  usage: ChatUsage | undefined,
  completionId: string | undefined,
) {
  const streamedCost = usage?.cost;

  if (streamedCost !== undefined && streamedCost !== null && usage) {
    return {
      costUsd: streamedCost,
      totalTokens: usage.totalTokens,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
    } satisfies ResolvedUsage;
  }

  if (!completionId) {
    throw new Error("OpenRouter did not return a completion ID");
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));

    try {
      const generation = await client.generations.getGeneration({
        id: completionId,
      });
      const promptTokens =
        generation.data.tokensPrompt ?? usage?.promptTokens ?? 0;
      const completionTokens =
        generation.data.tokensCompletion ?? usage?.completionTokens ?? 0;

      return {
        costUsd: generation.data.totalCost,
        totalTokens: promptTokens + completionTokens,
        promptTokens,
        completionTokens,
      } satisfies ResolvedUsage;
    } catch (error) {
      if (attempt === 2) throw error;
    }
  }

  throw new Error("OpenRouter usage was unavailable");
}

/** Streams a completion while owning its complete credit reservation lifecycle. */
export async function streamBillableCompletion(
  input: StreamBillableCompletionInput,
) {
  const reservationId = randomUUID();
  const maximumCredits = await maximumCreditsForRequest(
    input.model,
    input.messages,
  );
  await reserveCredits(input.workosUserId, reservationId, maximumCredits);

  let reservationActive = true;
  let reservationLinked = false;

  try {
    const completion = await client.chat.send({
      chatRequest: {
        model: input.model,
        messages: input.messages,
        stream: true,
        maxTokens: maxOutputTokens,
      },
    });

    input.onStart();

    let usage: ChatUsage | undefined;
    let completionId: string | undefined;

    for await (const chunk of completion) {
      if (!completionId) {
        completionId = chunk.id;
        await markCreditReservationPending(
          input.workosUserId,
          reservationId,
          completionId,
          input.model,
        );
        reservationLinked = true;
      }
      usage = chunk.usage ?? usage;

      const content = chunk.choices[0]?.delta?.content;
      if (content) input.onText(content);
    }

    if (!completionId) {
      throw new Error("OpenRouter did not return a completion ID");
    }

    const resolvedUsage = await resolveUsage(usage, completionId);
    await finalizeCreditReservation({
      workosUserId: input.workosUserId,
      reservationId,
      externalId: completionId,
      requestedCredits: creditsForCost(resolvedUsage.costUsd),
      description: `${input.model} response`,
      tokens: resolvedUsage.totalTokens,
      costUsd: resolvedUsage.costUsd,
      metadata: {
        model: input.model,
        promptTokens: resolvedUsage.promptTokens,
        completionTokens: resolvedUsage.completionTokens,
      },
    });
    reservationActive = false;
  } catch (error) {
    if (reservationActive && !reservationLinked) {
      await releaseCreditReservation(input.workosUserId, reservationId);
    }

    throw error;
  }
}

/** Settles persisted OpenRouter reservations left pending by interrupted requests. */
export async function reconcilePendingOpenRouterUsage() {
  await releaseExpiredUnlinkedReservations();
  const reservations = await getPendingCreditReservations();
  const results = await Promise.allSettled(
    reservations.map(async (reservation) => {
      const usage = await resolveUsage(undefined, reservation.completionId);
      await finalizeCreditReservation({
        workosUserId: reservation.workosUserId,
        reservationId: reservation.reservationId,
        externalId: reservation.completionId,
        requestedCredits: creditsForCost(usage.costUsd),
        description: `${reservation.model} response`,
        tokens: usage.totalTokens,
        costUsd: usage.costUsd,
        metadata: {
          model: reservation.model,
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          reconciled: true,
        },
      });
    }),
  );

  for (const result of results) {
    if (result.status === "rejected") {
      console.warn("Unable to reconcile pending OpenRouter usage:", result.reason);
    }
  }
}
