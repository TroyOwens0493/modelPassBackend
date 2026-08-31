# Balance-aware request authorization prototype

This is a throwaway logic prototype for [Prototype balance-aware request authorization](https://github.com/TroyOwens0493/modelPassBackend/issues/20). Run it with `pnpm prototype:balance-authorization` and delete it after its decisions have been absorbed into the implementation specification.

## Question

Can ModelPass safely authorize useful requests against a small exact Balance by reducing the output-token limit, posting a worst-case Hold, and waiting for authoritative Provider Cost before finalizing?

## Answer

Yes, for a versioned, text-only endpoint whose complete cost dimensions and limits have been validated:

- Compute an exact worst-case Usage Charge from a validated upper bound for the request's prompt, the endpoint's fixed fee and rates, and an output-token count.
- Find the greatest output-token count no higher than the Customer's request, endpoint limit, or amount their Balance can fully cover.
- Automatically send the request with that reduced `max_completion_tokens`; do not interrupt it using local token-by-token cost estimates.
- Reject before dispatch, without changing Balance, when the Balance cannot cover prompt cost, request fees, and the endpoint's minimum output.
- Atomically post a Hold for the complete bound before dispatch. Provider-enforced `max_completion_tokens`, required-parameter support, and the validated endpoint—not local stream metering—enforce the bound.
- On Customer cancellation or disconnect, attempt upstream cancellation but retain the Hold as pending until authoritative Provider Cost is recovered. Capture the exact Usage Charge once and release the remainder.
- If authoritative Provider Cost plus markup exceeds the Hold, retain the Hold, freeze the Customer's billing, globally disable the endpoint, and send the incident to reconciliation. Never silently cap the Usage Charge or create debt. The permanent accounting treatment is deferred to [Define violated usage-bound accounting treatment](https://github.com/TroyOwens0493/modelPassBackend/issues/25).

The prototype assumes the endpoint allowlist and prompt upper-bound mechanism have independently passed the production gates established by “Verify OpenRouter settlement and generation-budget facts.” It does not establish those provider facts.
