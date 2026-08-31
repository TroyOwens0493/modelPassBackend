# Issue #26 research: billing Audit Record retention

**Issue:** [Determine billing audit-record retention policy](https://github.com/TroyOwens0493/modelPassBackend/issues/26)
**Parent:** [Replace credits with a 5%-markup USD wallet](https://github.com/TroyOwens0493/modelPassBackend/issues/14)
**Decision date:** 2026-08-30
**Status:** Product policy and launch gate; not legal advice

## Decision

ModelPass will:

1. retain the minimum necessary **Audit Records** for as long as a Balance, Hold, refund, dispute, reversal, Payment Shortfall, Usage Bound Shortfall, or unclaimed-property obligation remains open;
2. start a ten-year closed-record retention period only when the relevant obligation is finally resolved;
3. securely delete or irreversibly de-identify the record after that period;
4. retain it longer only under a documented legal hold or a jurisdiction-specific requirement; and
5. never place secrets or unnecessary prompt or response content in an Audit Record.

The ten-year period is a conservative operational default, not a finding that every record is legally required for ten years. Production remains gated on qualified counsel approving a record-by-record schedule for every launch state and ModelPass's entity domicile.

## Why there is no single universal legal minimum

The applicable clock depends on the record and ModelPass's eventual legal classification:

- Federal tax law generally assesses tax within three years, extends that period to six years for specified substantial omissions, and has no ordinary limitation for a false/fraudulent return or failure to file ([26 USC §6501](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section6501&num=0&edition=prelim)). Taxpayers must keep records prescribed by the Secretary ([26 USC §6001](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section6001&num=0&edition=prelim)). These rules support a tailored tax schedule; they do not independently require all billing records for ten years.
- If ModelPass is classified as a federal provider of prepaid access, records sufficient to reconstruct activations, loads, reloads, purchases, withdrawals, transfers, and other transactions must remain accessible for five years ([31 CFR §1022.420](https://www.ecfr.gov/current/title-31/subtitle-B/chapter-X/part-1022/subpart-D/section-1022.420)). The closed-loop design may avoid that classification, but qualified payments counsel must decide it.
- Unclaimed-property duties can outlast a Customer's ordinary use of Balance. Delaware requires holders to retain supporting report records for ten years after filing unless the State Escheator specifies otherwise ([12 Del. C. §1145](https://delcode.delaware.gov/title12/c011/sc02/index.html#1145)). Federal priority rules ordinarily give first priority to the apparent owner's last-known-address state and secondary priority to the holder's domicile, making owner-address and disposition evidence material ([Texas v. New Jersey, 379 U.S. 674, 680–682](https://www.govinfo.gov/content/pkg/USREPORTS-379/pdf/USREPORTS-379-674.pdf); [Delaware v. New York, 507 U.S. 490, 499–500](https://www.govinfo.gov/content/pkg/USREPORTS-507/pdf/USREPORTS-507-490.pdf)). This is the principal reason for the conservative ten-year closed-record default.
- Privacy law cuts against indefinite retention. California requires collection, use, retention, and sharing to be reasonably necessary and proportionate and requires disclosure of intended retention periods or criteria ([Cal. Civ. Code §1798.100](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=1798.100.&lawCode=CIV)). Its deletion right has exceptions for completing transactions, security, legal obligations, and compatible internal uses ([§1798.105](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=1798.105.&lawCode=CIV)). ModelPass therefore needs purpose-tagged retention and exception handling, not permanent storage.

## Provider evidence

Provider systems are evidence sources, not ModelPass's retention system of record. Polar's published data-processing terms allow processing for the agreement term and three years afterward, with longer processing where law requires it ([Polar Data Processing Agreement](https://polar.sh/legal/dpa)). OpenRouter's published privacy policy describes collection of transaction and usage metadata but does not provide a durable retention guarantee on which ModelPass can base its ledger or reconciliation duties ([OpenRouter Privacy Policy](https://openrouter.ai/privacy)). ModelPass must preserve the provider identifiers and verified evidence necessary to explain its own monetary effects.

## Record scope and deletion

Retain only what is required to reconstruct and prove billing state:

- Customer and provider identifiers, owner-address provenance where legally required, and applicable terms/assent version;
- Deposit Intent, Polar Order/payment/refund/dispute identifiers and verified evidence;
- Ledger Entry and Hold identifiers, exact monetary effects, resulting Balance, and idempotency keys;
- OpenRouter generation identifiers, authoritative Provider Cost evidence, and Usage Bound Shortfall evidence;
- processing attempts, Reconciliation outcomes, Billing Freeze and Flow Pause transitions, notices, unclaimed-property reporting/remittance, and legal-hold metadata.

Do not store API keys, webhook secrets, authentication tokens, card data, or prompt/response content merely for billing audit. When retention expires, delete the record and its ordinary replicas through a documented lifecycle, or irreversibly de-identify it where aggregate operational analysis remains useful. Legal holds must identify their authority, scope, owner, start date, and release condition.

## Launch gates for qualified counsel

Before production, counsel must approve:

1. the record taxonomy and trigger that closes each obligation;
2. the state-by-state unclaimed-property dormancy, due-diligence, filing, and post-report record periods, including ModelPass's domicile;
3. tax and accounting substantiation periods and any litigation/legal-hold overrides;
4. privacy notices, deletion-request exceptions, processor deletion flow, and secure destruction standard; and
5. whether federal or state prepaid-access/payment recordkeeping rules apply despite the intended closed-loop design.

Until that approval, ten years after final resolution is the product default and the retention policy must be configurable by record class and jurisdiction.
