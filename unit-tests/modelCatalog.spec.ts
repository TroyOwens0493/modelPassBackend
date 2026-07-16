import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("model catalog", () => {
  it("normalizes text models, filters invalid entries, and caches the response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "openai/gpt-4o-mini",
            name: "GPT-4o mini",
            context_length: 128000,
            architecture: { output_modalities: ["text"] },
            pricing: { prompt: "0.00000015", completion: "0.0000006" },
          },
          {
            id: "image/model",
            name: "Image model",
            context_length: 1000,
            architecture: { output_modalities: ["image"] },
            pricing: { prompt: "0", completion: "0" },
          },
          {
            id: "openrouter/auto",
            name: "Auto",
            context_length: 1000,
            architecture: { output_modalities: ["text"] },
            pricing: { prompt: "-1", completion: "-1" },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { getSelectableModels } = await import("../src/models/catalog.js");

    const first = await getSelectableModels();
    const second = await getSelectableModels();

    expect(first).toEqual([
      {
        id: "openai/gpt-4o-mini",
        name: "GPT-4o mini",
        contextLength: 128000,
        priceTier: 2,
      },
    ]);
    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uses stable combined-price tier boundaries", async () => {
    const { getPriceTier } = await import("../src/models/catalog.js");

    expect(getPriceTier(0, 0)).toBe(1);
    expect(getPriceTier(0.0000005, 0.0000015)).toBe(2);
    expect(getPriceTier(0.000002, 0.000006)).toBe(3);
    expect(getPriceTier(0.000005, 0.000025)).toBe(4);
    expect(getPriceTier(0.00003, 0.00018)).toBe(5);
  });
});
