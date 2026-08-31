# Issue #16 research: United States prepaid-Balance constraints

**Issue:** [#16 — Research United States prepaid-balance constraints](https://github.com/TroyOwens0493/modelPassBackend/issues/16)<br>
**Parent:** [#14 — planning map](https://github.com/TroyOwens0493/modelPassBackend/issues/14)<br>
**Researched:** 2026-08-16 20:26 AKDT (UTC-08:00)<br>
**Status:** Primary-source product/compliance briefing; production remains blocked on qualified counsel and provider confirmation; **not legal advice**

## Executive summary

ModelPass's proposed facts are materially safer than an open payment product: one authenticated **Customer** chooses a USD **Deposit**; the resulting **Balance** belongs only to that Customer; it can buy only ModelPass AI usage; it cannot be transferred, gifted, withdrawn, used at an ATM, or spent with another merchant; ModelPass separately pays its providers; and each **Usage Charge** is the **Provider Cost** plus 5%. Those facts support closed-loop and own-service arguments. They do **not** produce a nationwide exemption. Statutory definitions, not the labels “Balance” and “Deposit,” control.

### What the primary sources support now

1. **Federal BSA/FinCEN — constrain the design.** “Prepaid access” broadly means future electronic access to funds or value paid in advance. “Closed loop prepaid access” is limited to goods or services involving a defined merchant or location. An arrangement providing closed-loop access with **no more than $2,000 maximum value associated with the access on any day** is not a federal “prepaid program” ([31 CFR 1010.100(ww), (kkk), and (ff)(4)(iii)(A)](https://www.ecfr.gov/current/title-31/subtitle-B/chapter-X/part-1010/subpart-A/section-1010.100)). A conservative product constraint is therefore `Balance + any other value associated with the access <= $1,999.99` per Customer, enforced atomically. This is a recommendation, not a finding that everything below the cap is unregulated.
2. **Federal money transmission — favorable facts, counsel-dependent result.** FinCEN's money-transmission definition requires acceptance from one person **and** transmission to another person or location; it excludes a person that only accepts and transmits funds integral to its own non-transmission goods or services, and separately excludes a person that only provides prepaid access from the money-transmitter category ([31 CFR 1010.100(ff)(5)(i)–(ii)](https://www.ecfr.gov/current/title-31/subtitle-B/chapter-X/part-1010/subpart-A/section-1010.100)). ModelPass should be the principal selling its own AI service—not the Customer's agent sending the Customer's funds to OpenRouter—but payments counsel must validate the contracts and actual flow.
3. **Federal EFTA/Regulation E — likely exclusions depend on operation and marketing.** ModelPass-only value is not usable at multiple unaffiliated merchants, at ATMs, or for person-to-person transfers, which are central to the general Regulation E “prepaid account” category ([12 CFR 1005.2(b)(3)](https://www.consumerfinance.gov/rules-policy/regulations/1005/2/#b-3)). A ModelPass-only access mechanism can fit the “store gift card” definition before exclusions, but a genuinely reloadable device that is **not marketed or labeled as a gift card or gift certificate** is excluded from §1005.20 ([12 CFR 1005.20(a)(2), (b)(2)](https://www.consumerfinance.gov/rules-policy/regulations/1005/20/)). Any gift messaging can destroy that exclusion. If covered, federal five-year expiration, fee, and disclosure rules apply.
4. **State gift laws materially diverge.** If Balance is covered value, California now requires cash redemption below **$15**; New York below **$5**; Washington and Connecticut below **$5 after a purchase**; New Jersey below **$5 after redemption**; Colorado at **$5 or less**; Rhode Island below **$1**; and Texas below **$2.50 only after an in-person redemption**, each with different exclusions and conditions. Oregon has a below-$5 rule but expressly excludes a gift card redeemed to an online account from that cash rule. Maine defines a “gift obligation” as a bearer instrument and expressly excludes account balances. These differences make an unconditional “never refundable” or “no cash value” statement unsafe.
5. **A mandated redemption does not necessarily create general withdrawal.** California's money-services definition excludes issuer-only value “except to the extent required by applicable law to be redeemable for cash,” and Texas's closed-loop definition contains the same concept ([California Financial Code §2003(aa)(2)(A)](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=2003.&lawCode=FIN), [Texas Finance Code §152.003(5)](https://tcss.legis.texas.gov/resources/FI/htm/FI.152.htm#152.003)). Terms can therefore say “nonwithdrawable except refunds, reversals, and redemption required by law” without offering general withdrawal.
6. **Unclaimed property is a separate risk even if Balance never expires.** Under the federal priority rules, the state of the apparent owner's last known address in the holder's records generally has first claim; the holder's state of incorporation/domicile is the secondary rule where the address is absent or the first-priority state does not take the property ([Texas v. New Jersey, 379 U.S. 674, 680–682 (1965)](https://www.govinfo.gov/content/pkg/USREPORTS-379/pdf/USREPORTS-379-674.pdf); [Delaware v. New York, 507 U.S. 490, 499–500 (1993)](https://www.govinfo.gov/content/pkg/USREPORTS-507/pdf/USREPORTS-507-490.pdf)). Customer-specific value makes owner-address and activity records more—not less—important. If ModelPass is incorporated or domiciled in Delaware, unknown-address property can fall to Delaware, whose current law includes customer balances, refunds, gift cards, and stored-value cards and generally uses five-year periods for the relevant categories ([12 Del. C. §§1130, 1133, 1141](https://delcode.delaware.gov/title12/c011/sc02/index.html)).
7. **Sales tax cannot be solved by calling funding a Deposit.** Official state sources range from California's generally nontaxable remote software/data-processing treatment, to New York's taxation of remotely accessed prewritten software, Texas's taxation of data processing, Washington's taxation of digital automated services and expanded IT services effective October 1, 2025, and New Jersey's general non-taxation of pure SaaS unless it is a taxable information service. Counsel must characterize both the funding instrument and the later AI consumption. Polar's Merchant-of-Record role remains an unresolved contractual fact from issue #15, not a substitute for ModelPass's own state-and-local-tax analysis.
8. **Product baseline.** Select now: no expiration; no dormancy/inactivity/maintenance/service fee; no transfers or gifting; no interest; no automatic reloading; ModelPass-only use; a provisional `$1,999.99` all-associated-value cap; a separate `$9,999.99` aggregate per-person daily load ceiling (with a lower commercial limit expected); state-aware legally required redemption; durable owner/address/activity records; and accurate pre-checkout disclosures. Block production on four written work products: payments/stored-value counsel, consumer-protection counsel, unclaimed-property counsel, and SALT counsel, plus Polar's written use-case and tax characterization.

## 1. Scope, canonical terms, evidence standard, and limitations

### 1.1 Facts analyzed

This report analyzes only the initial scope recorded in #14 and `CONTEXT.md`:

- a **Customer** is an authenticated individual US WorkOS user;
- **Balance** is the USD-denominated prepaid amount owned and spent by that Customer;
- a **Deposit** is the pre-tax USD amount successfully paid to add to Balance;
- **Provider Cost** is the actual amount OpenRouter charges ModelPass for a completed request;
- a **Usage Charge** is Provider Cost plus exactly 5%;
- each Customer has only a personal Balance;
- Balance is reloadable but non-transferable, non-interest-bearing, and unavailable for general withdrawal;
- Balance can be used only for ModelPass AI usage, not with another merchant or Customer;
- ModelPass—not the Customer—contracts with and pays OpenRouter; and
- refunds, reversals, cash redemption required by law, and unclaimed-property remittance are exceptions to ordinary product use.

“Card,” “code,” “device,” “gift certificate,” “stored value,” and “prepaid access” below are source terms. No physical card is assumed. Regulation E expressly uses “card, code, or other device,” and its commentary applies disclosure rules to nonphysical electronic codes and confirmations ([12 CFR 1005.20(a), (c)(4), official interpretations](https://www.consumerfinance.gov/rules-policy/regulations/1005/20/)).

### 1.2 Evidence labels

- **Clearly applicable rule** — the cited primary source states the rule. This label does not silently decide a disputed product classification.
- **Classification-dependent risk — counsel required** — application turns on facts such as who is the issuer/seller, whether access is a covered device, where the Customer resides, what is sold, and how funds flow.
- **Product recommendation/inference** — a conservative design or operational conclusion derived from the rules; it is not a legal conclusion.

### 1.3 Source standard and no-50-state limitation

Legal propositions are drawn only from official US Code/eCFR/CFPB/FinCEN/IRS material, official court reports, and official state legislatures, regulations, revenue agencies, or unclaimed-property agencies. The state tables are **representative and material, not a completed 50-state opinion**. They demonstrate variation and identify launch constraints. A state not listed is not approved, and silence does not mean exemption.

The research reflects sources available on August 16, 2026. Some official compilations lag current session law—for example, Colorado's official site made the cited 2024 Revised Statutes compilation available to this research—so counsel must check 2025–2026 session laws and current effective dates before launch.

## 2. Classification starts with function, not labels

**Clearly applicable rule.** FinCEN, Regulation E, and state statutes define products by capabilities, promises, redemption, parties, and marketing ([31 CFR 1010.100(ff), (ww), (kkk)](https://www.ecfr.gov/current/title-31/subtitle-B/chapter-X/part-1010/subpart-A/section-1010.100), [12 CFR 1005.20(a)–(b)](https://www.consumerfinance.gov/rules-policy/regulations/1005/20/#a)). Calling the Customer's payment a Deposit or the ledger amount Balance does not override definitions. Conversely, the mere use of a USD denomination does not by itself make Balance a bank account or money transmission.

**Classification-dependent risk.** These product facts push in different directions:

| Fact | Risk-reducing implication | Remaining question |
|---|---|---|
| One authenticated Customer; no bearer transfer | Supports personal account and anti-fraud controls; may fall outside statutes requiring a bearer instrument, such as Maine's gift-obligation definition | Other states cover any electronic record or promise, not only bearer instruments |
| ModelPass-only use | Supports federal/state closed-loop and own-goods treatment | Are third-party model providers merely ModelPass vendors, or is ModelPass transmitting Customer value to them? |
| Reloadable | Supports the federal §1005.20(b)(2) exclusion if not gift-marketed | Reloadability is expressly included by New York and does not exclude many state gift laws |
| No ordinary cash withdrawal | Reduces transmission and open-loop utility | State low-balance redemption, provider refunds, and unclaimed-property duties can still compel payment |
| Customer-specific login/interface | Prevents resale and person-to-person use | It can still be a “code or other device,” electronic record, or access vehicle under broad statutes |
| Provider Cost drives Usage Charge | Supports a service-pricing formula | If terms portray ModelPass as passing through Customer funds to OpenRouter, it weakens the principal/own-service narrative |
| Polar checkout | Outsources payment collection and may outsource tax collection contractually | It does not by itself decide whether ModelPass, Polar, or both are issuer, seller, holder, marketplace facilitator, or tax collector under each law |

**Product recommendation.** Contracts, receipts, and UI should consistently say that the Customer buys future ModelPass AI service; ModelPass is the service principal; providers are ModelPass's vendors; Balance cannot be directed to a provider; and Usage Charge is ModelPass's charge calculated from Provider Cost plus 5%.

## 3. Federal BSA/FinCEN prepaid access and money transmission

### 3.1 Definitions and precise exclusions

**Clearly applicable rule.** “Prepaid access” is “[a]ccess to funds or the value of funds that have been paid in advance” and can be retrieved or transferred later through an electronic device or vehicle, including a card, code, electronic serial number, mobile identification number, or personal identification number ([31 CFR 1010.100(ww)](https://www.ecfr.gov/current/title-31/subtitle-B/chapter-X/part-1010/subpart-A/section-1010.100)). ModelPass's authenticated electronic access to prepaid USD value is close enough to require a written analysis; “there is no physical card” is not an answer.

**Clearly applicable rule.** “Closed loop prepaid access” is prepaid access usable only for goods or services in transactions involving a defined merchant or location/set of locations ([31 CFR 1010.100(kkk)](https://www.ecfr.gov/current/title-31/subtitle-B/chapter-X/part-1010/subpart-A/section-1010.100)).

**Clearly applicable rule.** An arrangement is not a federal “prepaid program” if it provides closed-loop prepaid access with **no more than $2,000 maximum value associated with a prepaid access device or vehicle on any day** ([31 CFR 1010.100(ff)(4)(iii)(A)](https://www.ecfr.gov/current/title-31/subtitle-B/chapter-X/part-1010/subpart-A/section-1010.100)). The legal text says “not to exceed $2,000”; it is an inclusive threshold, not a `$2,000 per Deposit` threshold.

**Clearly applicable rule.** A separate low-value exclusion covers access solely to funds with no more than **$1,000 maximum value**, with no more than $1,000 initially or subsequently loaded, used, or withdrawn on any day, only if the program does **not** permit international transmission, transfers among users, or loading additional value from non-depository sources ([31 CFR 1010.100(ff)(4)(iii)(D)](https://www.ecfr.gov/current/title-31/subtitle-B/chapter-X/part-1010/subpart-A/section-1010.100)). Because ModelPass expects card-funded reloads through Polar, it should not rely on this alternative without counsel deciding whether those loads are from a prohibited non-depository source.

**Clearly applicable rule.** A “seller of prepaid access” is not every seller of any amount. The category reaches a person that receives funds for a load if the person sells access **offered under a prepaid program** that can be used before required customer identification, or if the person sells prepaid access—including closed-loop access—exceeding **$10,000 to one person in one day** without reasonably adapted prevention policies ([31 CFR 1010.100(ff)(7)](https://www.ecfr.gov/current/title-31/subtitle-B/chapter-X/part-1010/subpart-A/section-1010.100)). The $10,000 seller threshold is **not** a safe product cap and does not replace the $2,000 closed-loop prepaid-program exclusion.

### 3.2 Provider obligations if the closed-loop exclusion is unavailable

**Classification-dependent risk — counsel required.** A provider of prepaid access is the program participant selected as the principal information conduit; absent registration, it is the participant with principal oversight and control, including organizing the program, setting terms, selecting participants, and directing initiation, freezing, or termination ([31 CFR 1010.100(ff)(4)(i)–(ii)](https://www.ecfr.gov/current/title-31/subtitle-B/chapter-X/part-1010/subpart-A/section-1010.100)). Those functions point toward ModelPass if the arrangement is a regulated prepaid program.

If ModelPass were a provider/MSB, federal requirements would include:

- an effective written anti-money-laundering program reasonably designed to prevent use for money laundering and terrorist financing ([31 CFR 1022.210](https://www.ecfr.gov/current/title-31/subtitle-B/chapter-X/part-1022/subpart-B/section-1022.210));
- FinCEN registration and renewal under the MSB registration rule ([31 CFR 1022.380](https://www.ecfr.gov/current/title-31/subtitle-B/chapter-X/part-1022/subpart-D/section-1022.380));
- suspicious-activity reporting for relevant suspicious transactions conducted or attempted by, at, or through the MSB that involve or aggregate at least **$2,000**, subject to the rule's knowledge/suspicion tests and deadlines ([31 CFR 1022.320](https://www.ecfr.gov/current/title-31/subtitle-B/chapter-X/part-1022/subpart-C/section-1022.320)); and
- provider/seller identity procedures and identifying-information retention for five years under the applicable trigger, plus five years of provider access to records sufficient to reconstruct prepaid activations, loads, reloads, purchases, withdrawals, transfers, and other transactions ([31 CFR 1022.210(d)(1)(iv)](https://www.ecfr.gov/current/title-31/subtitle-B/chapter-X/part-1022/subpart-B/section-1022.210), [31 CFR 1022.420](https://www.ecfr.gov/current/title-31/subtitle-B/chapter-X/part-1022/subpart-D/section-1022.420)).

These consequences are why the product must not casually cross the closed-loop cap before counsel approves the resulting program.

### 3.3 Federal money transmission

**Clearly applicable rule.** Money transmission services mean accepting currency, funds, or substitute value from one person **and** transmitting currency, funds, or substitute value to another person or location by any means; “money transmitter” status is a facts-and-circumstances question ([31 CFR 1010.100(ff)(5)(i)–(ii)](https://www.ecfr.gov/current/title-31/subtitle-B/chapter-X/part-1010/subpart-A/section-1010.100)).

The definition excludes a person that only:

- provides prepaid access; or
- accepts and transmits funds only as an integral part of that person's sale of goods or provision of non-money-transmission services

([31 CFR 1010.100(ff)(5)(ii)(E)–(F)](https://www.ecfr.gov/current/title-31/subtitle-B/chapter-X/part-1010/subpart-A/section-1010.100)).

**Classification-dependent risk — counsel required.** The intended flow is favorable: the Customer pays ModelPass/its reseller; ModelPass owes future AI performance to the Customer; ModelPass separately pays OpenRouter; the Customer cannot designate OpenRouter or another recipient. Counsel must verify that Polar's reseller agreement and OpenRouter settlement do not make ModelPass an intermediary receiving Customer money “for” onward transmission.

### 3.4 Federal product recommendation

- Enforce a provisional maximum associated value of `$1,999.99` per Customer, including Balance, any duplicate access mechanism, and any amount counsel concludes is associated with that access. Track pending paid-but-not-posted Deposits so concurrent checkouts cannot cross it.
- Independently prevent aggregate initial and subsequent loads from exceeding `$9,999.99` to one person in one day across Customers, duplicate accounts, payment instruments, and concurrent checkouts; adopt a much lower commercial/fraud limit when #18 sets economics. This control addresses the separate seller definition and does not increase the `$1,999.99` associated-value cap.
- Never permit Customer-to-Customer transfer, gifting, international transfer, third-party acceptance, ATM/check/card access, interest, or cash-equivalent purchases.
- Do not use the separate $1,000 exclusion as the product basis without a written opinion on funding sources.
- Require a new payments opinion before increasing the cap, adding another merchant/provider redemption relationship, or allowing any transfer or cash feature.

## 4. Federal EFTA/Regulation E gift-card and prepaid-account rules

### 4.1 Broader “prepaid account” category

**Clearly applicable rule.** The general prepaid-account category includes an account that is issued prepaid or loadable, whose **primary function** is transactions with multiple unaffiliated merchants, ATM transactions, or person-to-person transfers, and that is not a checking/share-draft/NOW account ([12 CFR 1005.2(b)(3)(i)(D)](https://www.consumerfinance.gov/rules-policy/regulations/1005/2/#b-3)). The official interpretation says an account used for closed-loop campus transactions does not meet that primary-function category and confirms that a store gift card limited to its merchant is not a person-to-person transfer ([official interpretation of 12 CFR 1005.2(b)(3), comments 8 and 10](https://www.consumerfinance.gov/rules-policy/regulations/1005/2/#b-3)).

**Classification-dependent risk — counsel required.** ModelPass's proposed capabilities do not provide general transaction capability. That supports “not a prepaid account,” but counsel must evaluate the actual access mechanism and all §1005.2 categories. Marketing the product as “prepaid” does not create the category unless the account otherwise meets the definition, but marketing remains relevant to gift-card treatment ([official interpretation of 12 CFR 1005.2(b)(3), comment 3](https://www.consumerfinance.gov/rules-policy/regulations/1005/2/#b-3)).

### 4.2 Gift certificate, store gift card, and general-use card

**Clearly applicable rule.** Section 1005.20 distinguishes:

- a “gift certificate”: prepaid personal/family/household value in a specified amount that **cannot be increased or reloaded**, redeemable at one merchant/affiliated group;
- a “store gift card”: prepaid personal/family/household value in a specified amount, **whether or not reloadable**, redeemable at one merchant/affiliated group; and
- a “general-use prepaid card”: comparable value redeemable at multiple unaffiliated merchants or ATMs

([12 CFR 1005.20(a)(1)–(3)](https://www.consumerfinance.gov/rules-policy/regulations/1005/20/#a)).

ModelPass-only Balance should not be a general-use prepaid card. Its electronic access could satisfy the broader pre-exclusion store-gift-card elements; reloadability prevents the narrower gift-certificate definition but not the store-gift-card definition.

**Clearly applicable rule.** Section 1005.20 then excludes a device that is **reloadable and not marketed or labeled as a gift card or gift certificate** ([12 CFR 1005.20(b)(2)](https://www.consumerfinance.gov/rules-policy/regulations/1005/20/#b-2)). “Reloadable” means the agreement permits funds to be added after initial issuance. “Marketed or labeled” includes directly or indirectly suggesting gift use, even occasionally or by an issuer, retailer, program manager, or network; the commentary gives “perfect gift” and online gift-site examples ([official interpretation of §1005.20(b)(2), comments 1–5](https://www.consumerfinance.gov/rules-policy/regulations/1005/20/#b-2)).

**Mixed-marketing risk.** A reloadable access mechanism advertised both as an account substitute and occasionally as a gift loses the exclusion. ModelPass must not use gifting copy, gifting imagery, “send to a friend,” recipient fields, holiday gift campaigns, or third-party gift placement. A policy in terms is insufficient if actual marketing suggests gift use.

### 4.3 Hybrid prepaid-credit cards and the no-debt constraint

**Clearly applicable rule.** Regulation Z uses “hybrid prepaid-credit card” for a prepaid card that can access either (a) a covered separate credit feature offered by the prepaid-account issuer, its affiliate, or its business partner in the course of a transaction, or (b) credit structured as a negative balance on the asset feature, subject to a narrow exception. The negative-balance exception requires, among other things, a policy and practice of declining transactions reasonably believed to exceed available funds (apart from the rule's limited `$10` and unsettled-load cases) and prohibits credit- or negative-balance-related fees. A covered hybrid device is treated as a credit card for the credit feature, and Regulation Z prohibits structuring that covered feature as a negative asset balance ([12 CFR 1026.61(a)(1)–(4), (b)](https://www.consumerfinance.gov/rules-policy/regulations/1026/61/)). The definition applies only to a “prepaid account” as Regulation E defines that term ([12 CFR 1026.61(a)(5)(v)–(vii)](https://www.consumerfinance.gov/rules-policy/regulations/1026/61/#a-5-v)).

**Product recommendation/inference.** #14 already requires that a request not create debt. ModelPass should offer no overdraft, separate credit feature, negative Balance, or credit-related fee and should constrain or stop usage before available Balance is exceeded. That design makes hybrid prepaid-credit treatment less plausible without assuming the unresolved threshold question whether Balance is a Regulation E prepaid account. Any tolerance for Provider Cost settling above available Balance, postpaid recovery, or linked credit requires a fresh Regulation Z/Regulation E opinion before implementation.

### 4.4 Covered-product expiration, fees, and disclosures

If §1005.20 applies:

- dormancy, inactivity, and service fees require no activity for the preceding **one year**, prescribed disclosures, and no more than one such fee in a calendar month ([12 CFR 1005.20(d)](https://www.consumerfinance.gov/rules-policy/regulations/1005/20/#d));
- underlying funds cannot expire before the later of **five years after initial issuance/last load** or the access device's expiration date; consumers must have a reasonable opportunity to buy an access device with at least five years remaining; replacement or remaining value must be provided without a fee before fund expiration, subject to the lost/stolen exception ([12 CFR 1005.20(e)](https://www.consumerfinance.gov/rules-policy/regulations/1005/20/#e));
- required fee and expiration disclosures must be clear and conspicuous, provided before purchase, and in specified cases placed on the physical or electronic certificate/code itself—not hidden behind a general terms link; fee and expiration terms required before purchase may not be changed after purchase ([12 CFR 1005.20(c)(3)–(4), (d)–(f)](https://www.consumerfinance.gov/rules-policy/regulations/1005/20/#c)); and
- the EFTA statute supplies the five-year and fee floor and preserves non-inconsistent, more protective state law ([15 USC §1693l-1](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section1693l-1&num=0&edition=prelim); [15 USC §1693q](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section1693q&num=0&edition=prelim)).

**Important account-conversion detail.** The CFPB commentary says that once a covered gift card is fully redeemed and its value is credited to a separate merchant account, the federal five-year rule no longer applies to that separate account; partial redemption leaves the rule on the value remaining on the card ([official interpretation of §1005.20(e), comment 13](https://www.consumerfinance.gov/rules-policy/regulations/1005/20/#e)). ModelPass does not currently propose a separate gift instrument redeemed into Balance, and it should not add one without a new analysis.

**Product recommendation.** Even if counsel confirms the reloadable/non-gift exclusion, use no expiration and no periodic fee. That uniform rule is simpler than relying on the federal floor while violating a stricter state rule.

## 5. Representative state money-transmission treatment

This is not a licensing opinion or 50-state survey. It shows why federal treatment cannot be copied into state law.

| State | Official rule | ModelPass implication |
|---|---|---|
| **California** | “Money transmission” includes issuing stored value and receiving money for transmission. But “stored value” excludes value redeemable only by the issuer for issuer/affiliate/franchisee goods or services, **except** legally required cash redemption ([Cal. Fin. Code §2003(r), (x), (aa)(2)(A)](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=2003.&lawCode=FIN)). | Strong own-service exclusion if ModelPass is the issuer/service seller. Required California cash redemption does not automatically destroy it. Counsel must validate affiliate/provider and Polar roles. |
| **Washington** | “Money transmission” includes open-loop access but expressly excludes “closed loop prepaid access.” Closed loop covers a limited universe of goods, intangibles, or services provided by the issuer/affiliates or functionally related participants; issuance/use/exchange of closed-loop access is also exempted ([RCW 19.230.010(6), (18); 19.230.020(12)](https://app.leg.wa.gov/RCW/default.aspx?cite=19.230.010)). | Favorable and broader than a physical-card concept. Keep ModelPass as issuer/principal and provider participation functionally related to ModelPass service. |
| **Texas** | “Closed-loop stored value” is issuer/affiliate/franchisee-only value, except legally required cash redemption. “Stored value” expressly excludes closed-loop value ([Tex. Fin. Code §152.003(5), (34)](https://tcss.legis.texas.gov/resources/FI/htm/FI.152.htm#152.003)). The commissioner can require evidence supporting a claimed exemption ([§152.005](https://tcss.legis.texas.gov/resources/FI/htm/FI.152.htm#152.005)). | Strong exclusion; preserve evidence, contracts, and product controls. A mandatory low-balance payment need not create general withdrawal. |
| **Florida** | A money transmitter is an intermediary receiving value to transmit from one person to another person/location and must have unilateral execution/blocking ability. “Payment instrument” excludes an instrument redeemable by the issuer in merchandise or service ([Fla. Stat. §§560.103(24), (29), 560.204](https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0500-0599/0560/Sections/0560.103.html)). | Favorable if Customer buys ModelPass service and cannot direct funds onward. Do not characterize ModelPass as an intermediary paying a Customer-selected provider. |
| **New York** | A license is required to conduct the business of receiving money for transmission or transmitting it. A “payment instrument” excludes an instrument redeemable by its issuer in merchandise or services, but the receiving-money clause has no comparably explicit on-face closed-loop exclusion ([N.Y. Banking Law §§640(5), 641](https://www.nysenate.gov/legislation/laws/BNK/640)). | Higher interpretive risk. Own-service facts are favorable, but the statute should not be treated as a categorical closed-loop safe harbor without New York counsel/regulator analysis. |

**Product recommendation.** Launch only in states for which payments counsel has recorded one of: (a) clearly outside scope; (b) a cited exclusion; (c) a regulator-confirmed no-action position; or (d) a license/authorized structure. “Low risk” is not a launch status.

## 6. Representative state gift, expiration, fee, cash-redemption, and disclosure laws

The table applies only **if** the state's definition reaches ModelPass Balance/access. Customer residence, place of sale, issuer, and online-only facts require counsel. The source's terms appear where necessary.

| State | Definition/scope and material rule | Product consequence if covered |
|---|---|---|
| **California** | “Gift certificate” includes gift and electronic gift cards and excludes multi-seller cards (but not affiliated-seller cards) ([Cal. Civ. Code §1749.45](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=1749.45.&lawCode=CIV)). Covered value generally cannot expire or carry a service fee. Effective **April 1, 2026**, value **under $15** is redeemable in cash; “cash” includes currency/check and, by agreement, electronic transfer ([§1749.5(a), (b)(2), (i), (j)](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=1749.5.&lawCode=CIV)). California also treats covered value as held in trust, without requiring a separate account ([§1749.6](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=1749.6.&lawCode=CIV)). | Build remote cash redemption below $15; no expiry/fees. Customer-specific electronic value may be covered even without a physical card. Counsel must decide whether and when the threshold is tested. |
| **New York** | A gift certificate includes a pre-funded record for future goods/services at one/affiliated or multiple merchants, in a specified amount that **may be reloaded**. Covered value generally has no fee, no time-based decline, and no expiration earlier than the later of **nine years after issue or last load**. Non-open-loop, non-promotional value below **$5** is redeemable for cash. Terms—including refund, change, expiration, fee, and replacement terms—have prescribed conspicuous disclosure treatment ([N.Y. GBL §396-i(1), (2-a), (3), (5), (5-a), (5-b)](https://www.nysenate.gov/legislation/laws/GBS/396-I)). | Reloadability does not avoid New York law. Prefer no expiry/fees; support below-$5 redemption; counsel must map online notices, required fraud warning, advertisements, and terms placement. |
| **Massachusetts** | The statutory definition includes an electronic card or other medium evidencing consideration for future goods/services, but begins with a writing purchased for use by a person other than the buyer and excludes multi-unaffiliated-seller cards ([Mass. Gen. Laws ch. 255D, §1](https://malegislature.gov/Laws/GeneralLaws/PartIII/TitleIV/Chapter255D/Section1)). Covered value is valid at least **seven years**; absent an available expiration date it is perpetual. A nonreloadable certificate redeemed at least 90% or a reloadable certificate partly redeemed with **$5 or less** remaining gives the holder an election for cash ([ch. 200A, §5D](https://malegislature.gov/Laws/GeneralLaws/PartII/TitleII/Chapter200A/Section5D)). | Self-funding by the same Customer creates a genuine scope question. If covered, no-expiry is simplest and a reloadable Balance at $5 or less after use needs a cash election. |
| **New Jersey** | The official enactment treats “stored value” broadly. For value sold on/after **December 1, 2012**, underlying funds do not expire; fees are limited to disclosed issuance/load and lost/stolen/damaged replacement fees (with a general-purpose-reloadable exception). After redemption, a balance below **$5** is cash-refundable on request, subject to listed exceptions; “not redeemable for cash except as required by law” is expressly permitted wording ([P.L. 2012, c.14, §1(h)–(k), §2](https://pub.njleg.gov/bills/2012/PL12/14_.PDF)). The enactment also creates five-year unclaimed-property treatment and exemptions, including an issuer with no more than **$250,000** in prior-year face-value sales ([§1(a)–(f)](https://pub.njleg.gov/bills/2012/PL12/14_.PDF)). | No expiry; only approved fees; below-$5 workflow after redemption. NJ's interlocking consumer/unclaimed rules and later regulatory/litigation history require current NJ counsel validation before launch. |
| **Washington** | A gift certificate is a promise to the **bearer** for consumer goods/services and includes reloads; “stored value” cross-references closed-loop access ([RCW 19.240.010](https://app.leg.wa.gov/RCW/default.aspx?cite=19.240.010)). Covered value cannot expire or carry a fee/inactivity charge. After a purchase, remaining value below **$5** must be cash-redeemable on demand ([RCW 19.240.020](https://app.leg.wa.gov/RCW/default.aspx?cite=19.240.020)). It is also value held in trust, though no separate account is required ([RCW 19.240.090](https://app.leg.wa.gov/RCW/default.aspx?cite=19.240.090)). | Customer-specific/nontransferable access may raise a “bearer” question; do not assume exclusion. No expiry/fees; cash workflow below $5 after use. |
| **Maine** | A “gift obligation” must be a **bearer instrument not associated with an account holder or individual**; “account credits or account balances” are expressly excluded ([33 M.R.S. §2052(11)](https://legislature.maine.gov/statutes/33/title33sec2052.html)). If covered, there is no redemption limitation, no fee except a disclosed initial transaction fee, and an in-person redemption leaving below **$5** (initial value above $5) requires cash on request ([§2067(4)–(6)](https://legislature.maine.gov/statutes/33/title33sec2067.html)). | The Customer-specific Balance is textually unlike a Maine gift obligation. That does not remove general unclaimed-property risk. Avoid fees anyway; confirm whether any access record is separately bearer-like. |
| **Colorado** | “Gift card” broadly includes a prefunded tangible or electronic record of specific monetary value promising goods, services, credit, money, or value; multi-unaffiliated-seller value is excluded. Issuers must cash-redeem **$5 or less** on request and may not impose service, dormancy, inactivity, maintenance, or other fees ([Colo. Rev. Stat. §6-1-722(1)–(3), official 2024 compilation](https://content.leg.colorado.gov/sites/default/files/images/olls/crs2024-title-06.pdf)). | Broad electronic definition; no fees; cash at $5 or less. The cited consumer section does not supply a general no-expiration command, so federal/other Colorado rules and the terms still need review. |
| **Illinois** | “Gift certificate” broadly includes electronic and stored-value records for consideration, excluding multi-seller value. For value issued on/after **January 1, 2008**, no expiration earlier than **five years**, no post-purchase fee, no value reduction, and no penalty for non-use ([815 ILCS 505/2SS](https://my.ilga.gov/legislation/ilcs/fulltext?DocName=081505050K2SS)). | At minimum no post-purchase fee and a five-year floor if covered; no Illinois cash-redemption rule was identified in this reviewed section. No-expiry remains the recommended uniform policy. |
| **Connecticut** | A gift card broadly includes electronic/stored-value records for consideration but excludes general-use prepaid cards and listed categories. Seller must provide an electronic or paper receipt. After a purchase, a remaining balance below **$5** must be cash-refunded on request ([Conn. Gen. Stat. §42-461](https://www.cga.ct.gov/current/pub/chap_743cc.htm#sec_42-461)). Gift certificates cannot expire, and covered property cannot carry inactivity/escheat-like fees ([§42-460](https://www.cga.ct.gov/current/pub/chap_743cc.htm#sec_42-460), [§3-65c](https://www.cga.ct.gov/current/pub/chap_032.htm#sec_3-65c)). | Provide receipt; no expiry/inactivity fee; cash below $5 after use. An online Balance can satisfy the “record” language. |
| **Rhode Island** | “Gift certificate” includes electronic and stored-value records for monetary consideration. Issuers may not impose a surcharge, monthly/annual service or maintenance fee, redemption time limit, expiration date, or language suggesting expiration. Records are required for each sale; a written numbered receipt is required for sales over **$50**. After redemption, unused value below **$1** must be cash; otherwise it may be reissued ([R.I. Gen. Laws §6-13-12(a), effective text including 2024 amendments](https://webserver.rilegislature.gov/Statutes/TITLE6/6-13/6-13-12.HTM)). | No expiry/fees; preserve sale records; issue receipt over $50; below-$1 cash after use. |
| **Oregon** | A gift card is a prefunded record promising issuer goods/services; multi-seller value is excluded. Covered cards cannot expire, decline, or carry fees. Cash is required when value is below **$5 after at least one purchase**, but the cash rule expressly does **not** apply to a gift card “redeemed to an online account for the purchase of goods or services” ([ORS 646A.274, 646A.276](https://www.oregonlegislature.gov/bills_laws/ors/ors646a.html#646A.274)). | The online-account exception is highly relevant, but counsel must decide whether a direct Deposit to Balance is the contemplated redeemed card/account sequence. No expiry/fees regardless if covered. |
| **Texas** | A stored-value card is a prefunded record promising goods/services and includes gift cards. Much of Chapter 604 does not apply to no-expiration value with no fee other than listed issuance/handling fees, but the low-value subchapter overrides that exemption. If a covered card is redeemed **in person** for a purchase and below **$2.50** remains, cash is due on request, subject to exclusions ([Tex. Bus. & Com. Code §§604.001–.002, 604.151–.152](https://tcss.legis.texas.gov/resources/BC/htm/BC.604.htm#604.152)). If expiration/fees/material restrictions exist, pre-sale disclosure rules apply ([§§604.101–.103](https://tcss.legis.texas.gov/resources/BC/htm/BC.604.htm#604.101)). | An online-only product has a meaningful “in person” limitation, but do not infer a complete exemption. No expiry/fees avoids most chapter provisions; terms still disclose restrictions accurately. |
| **Florida** | “Gift certificate” includes a gift card, stored-value card, or similar instrument bought for money and redeemable for merchandise, food, or services. Covered value cannot have an expiration date or any postsale fee, including service, dormancy, maintenance, or cash-out fees; listed charitable/promotional and multi-unaffiliated exceptions apply ([Fla. Stat. §501.95](https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0500-0599/0501/Sections/0501.95.html)). | No expiry/postsale fees. The reviewed section contains no general low-balance cash mandate; ordinary refund promises and other law still apply. |

### State-matrix conclusion

**Classification-dependent risk — counsel required.** A Customer-specific, nontransferable Balance falls within Maine's express exclusion of account credits and account balances from “gift obligation” and therefore outside that definition, and it may also fail Washington's bearer requirement; yet states such as California, Colorado, Connecticut, Florida, New York, and Rhode Island use broad record/device concepts. There is no defensible one-definition answer.

**Product recommendation.** Implement the strict common baseline—no expiry and no periodic/post-sale fee—plus a rules-driven redemption service. Terms should say: “Balance is not available for voluntary cash withdrawal and has no cash value except for refunds, reversals, and redemption required by applicable law.” Do not say “never refundable.”

## 7. Unclaimed property and escheat

### 7.1 Federal priority and supremacy

**Clearly applicable rule.** The Supreme Court's primary rule awards abandoned intangible property to the state of the creditor/apparent owner's last known address as shown in the debtor/holder's books. If there is no recorded address, or the first-priority state does not take the property, the secondary rule awards it to the holder's state of incorporation ([Texas v. New Jersey, 379 U.S. 674, 680–682 (1965)](https://www.govinfo.gov/content/pkg/USREPORTS-379/pdf/USREPORTS-379-674.pdf)). The Court later described those federal common-law priority rules as rules that resolve competing state claims and applied them by identifying the debtor-creditor relationship from the instruments and records ([Delaware v. New York, 507 U.S. 490, 499–510 (1993)](https://www.govinfo.gov/content/pkg/USREPORTS-507/pdf/USREPORTS-507-490.pdf)).

**Clearly applicable rule.** Congress displaced the secondary rule for specified money orders, traveler's checks, and similar written instruments through 12 USC §§2501–2503, generally assigning them by place of purchase where records exist ([12 USC §§2501–2503](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title12-section2503&num=0&edition=prelim)). ModelPass Balance is not obviously one of those instruments; counsel should document why that federal statute does or does not apply rather than importing its purchase-location rule.

**Clearly applicable rule; limited preemption.** EFTA does not generally displace more protective state gift-value law: inconsistent state law is preempted, but greater consumer protection is not inconsistent ([15 USC §1693q](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section1693q&num=0&edition=prelim); [12 CFR 1005.12(b)](https://www.consumerfinance.gov/rules-policy/regulations/1005/12/#b)). The CFPB's official interpretation gives a narrow unclaimed-property example: Tennessee law is preempted only to the extent it would permit a covered gift certificate/card to be declined sooner than §1005.20(e) permits ([official interpretation of §1005.12(b), comment 4.i](https://www.consumerfinance.gov/rules-policy/regulations/1005/interp-12/#12-b-Interp-4)). That example does not create a general exemption from state custody, reporting, or remittance law; counsel must reconcile continued Customer access during a federal minimum-validity period with any state abandonment rule.

**Operational consequence.** Owner postal address is legally important. Email, IP location, payment billing address, and self-declared residence are not automatically interchangeable with the “last known address” in holder records. ModelPass must know what address it treats as authoritative, retain the source and effective dates, and obtain the data contractually from Polar if Polar collects it.

### 7.2 Representative state treatment

| State | Official unclaimed-property rule | ModelPass implication |
|---|---|---|
| **Delaware** | Property includes a credit balance, customer overpayment, gift card, stored-value card, refund, and credit memorandum. Money/credit from a retail transaction and stored-value/gift cards generally use **five years**; all other property also generally uses five years. For cards, the reportable amount is the issuer's maximum cost of represented goods/services ([12 Del. C. §§1130(21), 1133(6), (14), (17)](https://delcode.delaware.gov/title12/c011/sc02/index.html#1133)). Unknown-address property can be taken where the holder is domiciled; Delaware requires reports and generally **10 years** of post-report records ([§§1141–1145](https://delcode.delaware.gov/title12/c011/sc02/index.html#1141)). | If ModelPass is incorporated/domiciled in Delaware, unknown-address Balance/refunds are a direct secondary-rule concern. Determine the debtor/holder and cost-of-service amount; do not assume face value or zero. |
| **California** | Covered Civil Code gift certificates are excluded from the general unclaimed-property section unless they have an expiration date ([Cal. Civ. Proc. Code §1520.5](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=1520.5.&lawCode=CCP)). Other intangible property held in ordinary business generally escheats after **three years** after payable/distributable, with owner notice and reporting rules ([§§1520, 1530](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=1520.&lawCode=CCP)). California's custody rules use last-known address/holder domicile criteria ([§1510](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=1510.&lawCode=CCP)). | Gift classification can create an exemption; account Balance, matured refunds, or other payable amounts may instead be general property. Preserve classification and refund dates. |
| **Washington** | “Property” excludes a gift certificate that complies with Chapter 19.240, but includes stored-value cards, customer overpayments, refunds, and credits. A stored-value card (excluding gift certificates) is abandoned on the latest of three years after issue/load, owner interest, or balance verification; ordinary retail money/credit is generally three years ([RCW 63.30.010(25), (31); 63.30.040(6); 63.30.090](https://app.leg.wa.gov/RCW/default.aspx?cite=63.30.010)). Account access and owner-directed activity can be indications of interest ([RCW 63.30.120](https://app.leg.wa.gov/RCW/default.aspx?cite=63.30.120)). | Non-bearer Balance may be a stored-value card rather than exempt gift certificate. Record real Customer activity, including Balance views, without manufacturing false activity. |
| **Maine** | Gift obligations use a two-year presumption, but the reportable amount for issuance/last activity in **2022 or later is 0%**, and issuers with prior-year face-value sales no more than **$250,000** are exempt; redemption cannot be time-limited ([33 M.R.S. §2067](https://legislature.maine.gov/statutes/33/title33sec2067.html)). Account balances are excluded from “gift obligation,” while ordinary customer money/credit is generally presumed abandoned after **three years** ([§2052(11)(B), §2061(6)](https://legislature.maine.gov/statutes/33/title33sec2052.html)). | The favorable gift rule may not cover Customer-specific Balance. General retail-credit treatment remains plausible. |
| **Colorado** | Stored-value cards other than gift cards generally use the latest of three years after year-end issue/load, owner activity, or balance review; gift cards use **five years** after purchase/last use. Gift cards are exempt if issuer annual gross gift-card sales are **$200,000 or less** ([Colo. Rev. Stat. §§38-13-206, -207, -219, official 2024 compilation](https://content.leg.colorado.gov/sites/default/files/images/olls/crs2024-title-38.pdf)). | Track annual issuance, type, load/use, and balance checks. A gift-law cash right does not answer escheat classification. |
| **Connecticut** | Gift certificates and general-use prepaid cards are excluded from the unclaimed-property part, while unprovided property generally becomes abandoned after **three years** after due/payable/distributable. Holder notice/report rules require owner contact data and transaction dates ([Conn. Gen. Stat. §§3-64a, 3-65a, 3-73a(e)](https://www.cga.ct.gov/current/pub/chap_032.htm#sec_3-64a)). | Classification changes the outcome. A matured refund or non-gift account amount may still become reportable. |
| **New York** | Unredeemed gift-certificate amounts that remain unclaimed for **five years** are abandoned; unclaimed amounts for unrendered services or undelivered goods use **three years** ([N.Y. Abandoned Property Law §1315(1), (1-b)](https://www.nysenate.gov/legislation/laws/ABP/1315)). | Terms cannot avoid the clock. Determine whether Balance is gift value or an amount for future services and preserve last-owner-claim evidence. |

### 7.3 Refunds and closures create separate property

**Clearly applicable rule.** State acts separately list refunds, customer overpayments, credit balances, or money owed from a retail transaction ([12 Del. C. §§1130(21), 1133(6)](https://delcode.delaware.gov/title12/c011/sc02/index.html#1133), [RCW 63.30.010(25), 63.30.040(6)](https://app.leg.wa.gov/RCW/default.aspx?cite=63.30.010)). Once ModelPass or Polar determines that a specific amount is refundable, the dormancy clock and holder may differ from the original Balance classification. A forced provider refund that cannot reach the Customer is not safely absorbed as revenue.

**Product recommendation.** Maintain immutable, separately typed entries for:

- Deposit and its source Order;
- Balance and any hold;
- Usage Charge;
- approved/refused/pending/succeeded refund;
- legally required redemption;
- provider reversal/dispute;
- due-diligence notice;
- amount remitted as unclaimed property; and
- any later Customer/state reimbursement.

Do not “expire” or silently delete Balance. After lawful remittance, Balance should become unavailable with a traceable state-custody record and Customer support path.

### 7.4 Record and activity baseline

Retain legal name, Customer ID, current and historical postal address with source/effective date, email, state eligibility, Deposit/Order IDs, all ledger entries, balance checks, authenticated activity, refund/redemption/escheat events, notices, terms version and assent, and entity/holder identity. Delaware's ten-year post-report requirement is a useful minimum design input, but counsel must set the actual retention schedule and reconcile it with privacy/deletion duties ([12 Del. C. §1145](https://delcode.delaware.gov/title12/c011/sc02/index.html#1145)).

## 8. Sales tax and federal income-tax timing

### 8.1 Two different taxable events must not be collapsed

A Deposit can be characterized as:

1. sale of a cash-equivalent/gift funding instrument, with sales tax considered when value is redeemed;
2. an advance payment for ModelPass AI service, potentially taxed when paid/invoiced under the state's timing rule; or
3. another stored-value arrangement.

Later AI consumption can separately be characterized as SaaS/remote software, digital automated service, data processing, information service, or a nontaxable service. The same state can treat funding as nontaxable while taxing redemption. Customer location can also change between Deposit and usage. No reviewed source establishes a universal US rule.

### 8.2 Representative official state revenue rules/guidance

| State | Official tax rule/guidance | ModelPass question |
|---|---|---|
| **California** | CDTFA treats a gift certificate as cash and taxes the taxable goods when redeemed ([CDTFA Annotation 295.1070](https://www.cdtfa.ca.gov/lawguides/vol2/suta/295-0000-all.html#295.1070)). Remote computer access, processing of Customer-furnished information, and electronically transmitted prewritten software without tangible media are generally nontaxable under Regulation 1502, while taxable tangible output remains possible ([18 CCR §1502(c), (d), (f)(1)(D), (i)](https://www.cdtfa.ca.gov/lawguides/vol1/sutr/1502.html)). | A genuine funding instrument points away from tax at Deposit; AI service with no tangible transfer may be nontaxable, but outputs and actual contract require SALT classification. |
| **New York** | Prewritten software is taxable regardless of delivery; remote access gives constructive possession/right to use, sourced where the purchaser uses or directs use ([NY DTF Tax Bulletin ST-128, updated Mar. 31, 2026](https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/computer_software.htm)). Tax Law also taxes specified information services, subject to exceptions ([N.Y. Tax Law §1105(c)(1)](https://www.nysenate.gov/legislation/laws/TAX/1105)). | Is ModelPass selling use/control of software, a taxable information service, or a personal/individual AI service? Deposit-versus-usage timing needs a ruling/opinion, not analogy alone. |
| **Texas** | Data processing means computer use on Customer data—entering, storing, manipulating, or retrieving—and is taxable; professional service using a computer merely as a tool is not. The official bulletin instructs collection of state/local tax on the taxable charge ([Texas Comptroller Publication 94-127, Mar. 2022](https://comptroller.texas.gov/taxes/publications/94-127.php)); the statutory exemption excludes 20% of a data-processing charge ([Tex. Tax Code §151.351](https://tcss.legis.texas.gov/resources/TX/htm/TX.151.htm#151.351)). | AI prompting can contain both Customer-data processing and generated analysis. Counsel must identify the true object, tax base, and whether 80% treatment applies. |
| **Washington** | Gift cards/certificates are not taxed at sale; tax applies on redemption if the supplied item/service is taxable ([WA DOR, Gift cards, gift certificates, and layaway purchases](https://dor.wa.gov/forms-publications/publications-subject/tax-topics/gift-cards-gift-certificates-and-layaway-purchases)). Digital automated services and remote-access software are taxable; Washington sources a digital automated service where the Customer first receives its benefit ([WA DOR, Digital products including digital goods](https://dor.wa.gov/forms-publications/publications-subject/tax-topics/digital-products-including-digital-goods)). Beginning **October 1, 2025**, listed IT, data-processing, implementation, custom-software, and related services became taxable ([WA DOR Special Notice, July 30, 2025](https://dor.wa.gov/forms-publications/publications-subject/special-notices/information-technology-website-and-software-development-services-now-subject-sales-tax)). | Strong candidate for no tax at genuine Deposit but tax on AI usage. Polar must support usage-time tax/location or counsel must approve another compliant taxable-event method. |
| **Pennsylvania** | Act 84 applies 6% sales/use tax to digital products transferred electronically, including downloads, streaming, apps, games, canned software, and subscriptions, subject to exemptions ([PA DOR, Digital Products](https://www.pa.gov/agencies/revenue/resources/tax-types-and-information/sales-use-and-hotel-occupancy-tax/digital-products)). | Does an AI response/access constitute a transferred digital product or service? Funding timing is unresolved by this guidance. |
| **Connecticut** | Taxable services include computer and data-processing services; the sales/use tax rate for that category is **1%**, while other covered digital goods/services can bear the general rate ([Conn. Gen. Stat. §§12-407(a)(37), 12-408(1)(D)](https://www.cga.ct.gov/current/pub/chap_219.htm#sec_12-407)). | Classify AI inference and output between data processing, prewritten software/digital goods, and other services; determine rate and sourcing. |
| **Ohio** | Automatic data processing, computer services, and electronic information services are taxable when provided **for use in business** and when they—not incidental personal/professional service—are the true object. “Specified digital product” is limited to audiovisual works, audio works, and digital books ([Ohio Rev. Code §5739.01(B)(3)(e), (Y), (OOO)](https://codes.ohio.gov/ohio-revised-code/section-5739.01)). | Initial Customers are individuals, but usage purpose may be business. Consumer AI output is not automatically a specified digital product; facts and representations matter. |
| **Massachusetts** | Prewritten software is taxable regardless of delivery, including remote-server access where software use is the transaction's object. Custom software, personal/professional services, Customer-data processing, and database access are generally exempt; remote software merely incidental to another service can be nontaxable ([830 CMR 64H.1.3(3), (9), (13), (14)](https://www.mass.gov/regulations/830-CMR-64h13-computer-industry-services-and-products)). | Contract/UI must establish whether the true object is software use or ModelPass's AI service/output. |
| **New Jersey** | SaaS without transfer/download/copy rights is generally a nontaxable service; SaaS that furnishes taxable compiled/analyzed information is taxable, while personal/individual information not incorporated into others' reports is excluded ([NJ Division of Taxation TB-72, July 3, 2013](https://www.nj.gov/treasury/taxation/pdf/pubs/tb/tb72.pdf)). The bulletin warns later law changes may affect it. | AI may be an individual service or taxable information service depending on data/content reuse and contract. Obtain current written advice, not just the 2013 bulletin. |
| **Florida** | Florida taxes tangible personal property and specifically enumerated services ([Fla. Stat. §§212.02, 212.05](https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0200-0299/0212/Sections/0212.02.html)). In a nonprecedential taxpayer-specific advisement, electronically downloaded software without tangible property was a nontaxable service transaction ([FL DOR TAA 10A-028, June 21, 2010](https://floridarevenue.com/TaxLaw/Documents/10A-028.pdf)). | Pure remote AI service may be favorable, but the TAA binds only its requester and predates the product. Current Florida SALT advice is still required. |

**No-50-state tax warning.** This table does not approve any state, calculate local rates, address economic nexus, or identify all marketplace-facilitator rules. It also does not decide whether Provider Cost, the 5% markup, a separate funding fee, or tax is included in the taxable base.

### 8.3 Polar Merchant-of-Record uncertainty

Issue #15 selected a Polar custom-price checkout and records Balance from verified pre-tax `net_amount`, but also identified written Polar use-case and tax confirmation as launch gates. For this issue, the unresolved questions are:

- Is Polar legally reselling future ModelPass AI service, a funding instrument, or each later Usage Charge?
- Is Polar the retailer/marketplace facilitator/issuer/holder for each state, and does ModelPass retain any registration, collection, or reporting duty?
- Does Polar calculate tax using the Customer's Deposit-time location while a state sources usage where the benefit is later received?
- Can Polar receive usage-level state, location, tax base, refund, and redemption data?
- How do partial refunds and legally required cash redemption adjust tax?

A provider contract calling Polar Merchant of Record is relevant evidence, not a state-law conclusion. SALT counsel must review the signed Polar agreement, product listing, checkout, receipt, funds flow, and tax reports.

### 8.4 Federal income-tax timing is separate from sales tax

**Clearly applicable rule.** For federal income tax, 26 CFR §1.451-8 defines “advance payment” to include payments for services, software, and an eligible gift-card sale. An eligible gift-card sale requires the taxpayer to remain primarily liable for value until redemption/expiration and redemption by the taxpayer or a legally obligated accepting entity. An accrual-method taxpayer generally includes advance payment no later than receipt unless it validly uses an available deferral method ([26 CFR §1.451-8(a)(1), (a)(10), (b)–(c)](https://www.ecfr.gov/current/title-26/section-1.451-8); [26 USC §451(c)](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section451&num=0&edition=prelim)).

**Classification-dependent risk — tax counsel/CPA required.** Book liability treatment, federal income recognition, state sales tax, and unclaimed-property liability are different ledgers/questions. “Prepaid” does not mean revenue can be deferred indefinitely.

## 9. Refunds, provider reversals, and disputes

### 9.1 Baseline

No reviewed federal prepaid/gift source creates a general on-demand withdrawal right for the proposed excluded closed-loop Balance. Refund rights instead arise from:

- ModelPass's contract and advertised refund policy;
- a covered state's low-balance redemption rule;
- a provider-initiated refund or payment reversal;
- a card/payment dispute; or
- a state consumer remedy for failed, undelivered, or deceptively described service.

**Clearly applicable rule.** Under 15 USC §45(a)(1), unfair or deceptive acts or practices in commerce are unlawful. ModelPass must not promise “nonrefundable” if its policy, provider behavior, or state law supplies refunds ([15 USC §45](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section45&num=0&edition=prelim)).

### 9.2 Product refund policy

**Product recommendation.** Define these distinct paths:

1. **Voluntary ModelPass refund:** whether and when attributable unspent Deposit value can be returned; method; time limit; fraud review; and how partial refunds map to the original Order.
2. **Legally required redemption:** Customer state, qualifying threshold/event, amount, identity check, payment method, deadline, and no fee. This narrow path does not enable ordinary withdrawal.
3. **Provider refund/reversal:** issue #15 established that Polar can process full/partial refunds and can initiate refunds. Post an immutable compensating entry only on authoritative provider success; tax returned by Polar is not Balance.
4. **Dispute/chargeback:** prevent further use of at-risk value, preserve completed Usage Charges, and record a separate shortfall if value was already consumed. Do not silently create spendable negative Balance or Customer debt; issue #21 must decide recovery/suspension policy.
5. **Closure/failed service:** define treatment of unspent Balance when ModelPass terminates service, the Customer becomes ineligible, or ModelPass shuts down. Contract forfeiture cannot be used to evade refund or unclaimed-property law.

**Practical constraint.** A Customer's legal cash redemption or provider refund should reduce only attributable available value. It should not rewrite Provider Cost or completed Usage Charge history.

## 10. Customer disclosures: mandated if covered vs prudent baseline

### 10.1 Mandated/conditional disclosures

- **Federal covered gift product:** pre-purchase clear and conspicuous fee/expiration disclosures, specified disclosures on the access device/electronic code, fee type/amount/conditions, and toll-free/web information where applicable ([12 CFR 1005.20(c)–(f)](https://www.consumerfinance.gov/rules-policy/regulations/1005/20/#c)).
- **New York covered value:** conspicuous pre-purchase notice that terms apply and clear terms addressing refunds, warranties, changes, expiration, fees, replacement, assignment, and waiver; electronic sales and advertising have specific treatment ([N.Y. GBL §396-i(2-a), (3)](https://www.nysenate.gov/legislation/laws/GBS/396-I)).
- **Texas covered value with restrictions/fees:** expiration, fee, and material restrictions must be conspicuously disclosed before purchase; missing disclosures can make value valid until redeemed/replaced ([Tex. Bus. & Com. Code §§604.101–.103](https://tcss.legis.texas.gov/resources/BC/htm/BC.604.htm#604.101)).
- **Massachusetts covered value:** issuance/expiration date must be on the face, receipt, website, or toll-free line as specified; absent an available expiration date, value is perpetual ([Mass. Gen. Laws ch. 200A, §5D](https://malegislature.gov/Laws/GeneralLaws/PartII/TitleII/Chapter200A/Section5D)).
- **Connecticut covered gift card:** purchaser receives an electronic or paper proof-of-purchase/gift receipt ([Conn. Gen. Stat. §42-461(b)](https://www.cga.ct.gov/current/pub/chap_743cc.htm#sec_42-461)).
- **Rhode Island covered value:** sale records and numbered written receipt over $50 ([R.I. Gen. Laws §6-13-12](https://webserver.rilegislature.gov/Statutes/TITLE6/6-13/6-13-12.HTM)).

These are examples, not the complete mandated-disclosure matrix.

### 10.2 Prudent uniform disclosures pending counsel

Show a concise summary immediately before checkout, obtain affirmative assent to retainable full terms, and repeat monetary facts on the receipt and Balance history:

- **Product identity:** “You are buying future ModelPass AI usage.” Identify ModelPass and Polar's exact contractual seller/collector role.
- **Canonical monetary terms:** chosen Deposit; sales tax, if any; any separately approved funding fee; total card charge; Balance added; and when it becomes available.
- **Not a bank product:** Deposit is a ModelPass product term, not a bank deposit; Balance is not a bank account, does not earn interest, and is not represented as FDIC/NCUA insured.
- **Closed-loop limits:** Balance belongs to one Customer, is non-transferable, cannot be gifted/resold, and works only for ModelPass AI usage.
- **Cash/refund qualification:** no voluntary cash withdrawal and no cash value **except** refunds, reversals, and redemption required by applicable law; give the support path.
- **Expiration/fees:** Balance does not expire; ModelPass charges no dormancy, inactivity, maintenance, or Balance service fee. Disclose any future separately approved payment fee before payment, not as an undisclosed Balance reduction.
- **Usage pricing:** Usage Charge equals final Provider Cost plus 5%; interrupted/partial responses may still produce Provider Cost and Usage Charge as #14 requires; estimates are not final.
- **Tax:** explain whether tax is charged at Deposit or later usage, how location is determined, and that tax is not added to Balance. Do not display both events as taxable unless SALT counsel/provider says so.
- **Refund/dispute:** eligibility, attribution to unspent value, provider processing, timing, payment method, effect on Balance, and treatment when value was already used.
- **Inactivity/closure/unclaimed property:** no contractual expiration; ModelPass may contact the Customer about inactivity and may transfer legally abandoned property to the appropriate state, after which the Customer claims from that state.
- **Account action:** circumstances for suspension/closure, handling of remaining value, and appeal/support process.
- **Changes:** effective date/version, advance notice and assent standard, and a promise not to retroactively reduce existing Balance or impose new fees without legally sufficient process.
- **Support/complaints:** durable contact channel, response target, required information, escalation, and regulator/state complaint information where mandated.
- **Records/privacy:** address and transaction data retained for payment, tax, fraud, refunds, and unclaimed-property compliance.

**Product recommendation.** Maintain marketing-review controls. Terms cannot cure “gift” advertising, and a checkout summary cannot cure a receipt that calls tax part of Balance.

## 11. Practical constraints for the non-transferable, nonwithdrawable design

### 11.1 Selectable now

1. One personal Balance per authenticated Customer; no shared or organization Balance.
2. Customer-specific access; no bearer code and no transferable link.
3. ModelPass-only AI consumption; providers remain ModelPass vendors.
4. No transfer, gifting, resale, external merchant, ATM, check, card, cash-equivalent, interest, yield, overdraft, negative Balance, or separate credit feature.
5. No automatic reloading; each Deposit requires a Customer-authorized checkout and current disclosures.
6. Provisional maximum associated value `$1,999.99` per Customer, enforced across Balance, pending posting, and any other associated value.
7. Separate provisional aggregate load ceiling of `$9,999.99` per person per day across duplicate Customers/accounts and concurrent payments, with a lower product limit to be selected.
8. No expiration and no dormancy, inactivity, maintenance, or Balance service fee.
9. No absolute “nonrefundable” statement; use exceptions for refund, reversal, law-required redemption, and unclaimed-property custody.
10. Immutable double-entry-style monetary history for Deposit, Usage Charge, refund, reversal, redemption, and escheat.
11. Collect/retain an authoritative US postal address with history and source, subject to privacy review.
12. Rules-driven state eligibility and redemption; default deny for unapproved states.
13. Annual legal/tax review and immediate review on any capability, provider, entity, or state change.

### 11.2 Blocked decisions

- Nationwide launch or any launch-state list.
- Increasing Balance above the provisional cap.
- Any transfer, gifting, cash access, shared Balance, international availability, or non-USD value.
- Final refund time limits and unspent-value attribution.
- Whether legally required redemption is automatic, self-service, or support-operated in each state.
- Tax at Deposit, usage, or another point; rate, sourcing, and tax base.
- Final terms, receipts, and state notices.
- Polar's legal role as seller/issuer/holder/tax collector.
- Federal income-recognition method and unclaimed-property reserve/accounting.

## 12. Exact questions for qualified counsel

### 12.1 Payments and stored value

1. Is the production Balance/access mechanism “prepaid access” under 31 CFR 1010.100(ww), and is ModelPass the provider of prepaid access?
2. Does ModelPass-only AI usage qualify as “closed loop prepaid access” when ModelPass uses OpenRouter and multiple model providers behind the service?
3. What exact value must be aggregated for the $2,000-on-any-day test: posted Balance, pending paid Orders, holds, refunds pending, duplicate accounts, or value in Polar?
4. Is `$1,999.99` an adequate operational cap, and what anti-evasion aggregation is required across Customers/payment instruments?
5. Does a `$9,999.99` aggregate per-person daily load ceiling, plus identity/duplicate-account/concurrency controls, satisfy the separate seller-of-prepaid-access prevention requirement, and what lower threshold should ModelPass use?
6. Are card-funded Polar reloads “non-depository sources” for the separate $1,000 exclusion, and should that exclusion be disregarded?
7. Is ModelPass selling its own service or receiving Customer funds for transmission to Polar/OpenRouter/model providers under federal and each launch state's law?
8. In California, Washington, Texas, Florida, New York, and every other launch state, which exact closed-loop/own-goods/payment-agent exclusion applies? Is regulator confirmation needed?
9. Do required low-balance redemption and provider refunds preserve closed-loop treatment under each state?
10. Which entity is issuer, seller, program manager, provider, and holder: ModelPass, Polar, or another participant?
11. What event/capability change requires relicensing analysis before deployment?

### 12.2 Consumer protection/gift law

1. Is Customer-specific, non-bearer, reloadable Balance or its login/access record a gift certificate, store gift card, stored-value card, or excluded account balance in each launch state?
2. Which state's law applies based on Customer residence, billing address, place of electronic sale, issuer location, or terms choice of law?
3. Does never marketing/gifting the Balance establish the federal §1005.20(b)(2) exclusion, and what marketing controls/evidence are required?
4. Is ModelPass outside Regulation E's broader prepaid-account definition, and which disclosures/error rights remain applicable, if any?
5. Does the no-debt/no-negative-Balance implementation keep the access mechanism outside 12 CFR 1026.61's hybrid prepaid-credit-card rules, and what settlement tolerance, if any, is permissible?
6. For every launch state, what exact cash threshold, triggering transaction, request method, payment method, response deadline, and identity check applies?
7. Does Oregon's online-account cash exception cover direct Deposits, or only a separately issued gift card redeemed into an account?
8. Do any laws prohibit the proposed refund limitations or require refunds for service failure, Customer closure, or ModelPass termination?
9. Approve exact pre-checkout, receipt, Balance, refund, inactivity, closure, change-in-terms, and complaint language—including “no cash value except as required by law.”
10. Which mandated notices must be on the electronic access record/receipt rather than incorporated terms?
11. Are arbitration, governing-law, class-action, limitation-of-liability, or unilateral-change clauses constrained for this product?

### 12.3 Unclaimed property

1. What property type is Balance in each state: gift value, stored value, retail customer credit, advance payment, refund, or other intangible?
2. Who is the debtor/holder for federal priority purposes after Polar collects and ModelPass records Balance?
3. Which postal address is the last known address in ModelPass's records, and may ModelPass rely on Polar billing data? What if addresses conflict or are absent?
4. If ModelPass is incorporated/domiciled in Delaware, which unknown-address amounts fall to Delaware and what reportable amount/cost-of-service method applies?
5. What event starts/resets dormancy: Deposit, Usage Charge, authenticated login, Balance view, support communication, refund approval, or provider event?
6. How are legally payable refunds and payment reversals classified and dated separately from Balance?
7. What due-diligence notice, reporting, remittance, negative-report, and Customer reimbursement processes apply in each launch state?
8. What records must be retained, for how long, and how should that schedule interact with privacy/deletion requests?
9. May Balance remain visible after state remittance, and what exact Customer claim/support language is required?
10. What annual compliance calendar, reserve, and audit evidence should accounting maintain?

### 12.4 State and local tax (SALT)/federal tax

1. What is sold at checkout: a funding instrument, an advance payment for ModelPass service, or another product?
2. What is sold at usage: remote software, digital automated service, data processing, information service, personal/professional service, or another category in each launch state?
3. Is sales tax due at Deposit, each Usage Charge, both, or neither? How is double taxation prevented?
4. What is the taxable base: Deposit, Provider Cost, Usage Charge, 5% markup, funding fee, or another amount?
5. Which Customer location controls Deposit and usage, and how are travel/address changes and unknown location handled?
6. Does Polar legally qualify as retailer/marketplace facilitator/Merchant of Record in each state, and which ModelPass registration, collection, filing, and record duties remain?
7. Can Polar's systems support usage-time tax, state-specific sourcing, exemptions, partial refunds, legal redemption, and corrected returns?
8. What should checkout, invoice, receipt, Balance history, and refund documents separately show for Deposit, tax, total, and Balance?
9. How are provider refunds, chargebacks, legally required cash redemption, and escheat treated for sales-tax adjustments?
10. Under 26 USC §451(c) and 26 CFR §1.451-8, when does ModelPass/Polar recognize income, and is any advance-payment deferral method available and elected?

## 13. Exact production launch gates

Production is **not approved** until every item is complete and linked from #14:

1. **Entity/funds-flow packet:** signed Polar and OpenRouter agreements, entity/incorporation/domicile, bank settlement diagram, Customer terms, checkout/receipt mocks, and exact ledger flow reviewed by all counsel.
2. **Payments opinion:** written federal BSA, Regulation E, and Regulation Z §1026.61 analysis plus launch-state money-services analysis, naming each relied-on definition/exclusion and confirming the cap aggregation formula and no-debt design.
3. **Consumer matrix:** every launch state has current citation, scope conclusion, expiration/fee rule, cash threshold/event/method/deadline, disclosures, enforcement risk, and an owner.
4. **Unclaimed-property matrix/calendar:** every launch state plus entity domicile has property type, owner-address priority, dormancy/activity, due diligence, reporting/remittance, reportable amount, records, and refund treatment.
5. **SALT matrix:** every launch state/locality has funding and AI classification, taxable event/base/rate/sourcing, nexus/registration party, Polar responsibility, refund adjustment, and receipt format.
6. **Written Polar confirmation:** exact use case approved; seller/product description, tax code/tax point, receipt, Customer/address data access, refunds/redemption, dispute, and reporting responsibilities confirmed.
7. **Terms approval:** payments, consumer, unclaimed-property, SALT, privacy, refund, closure, and changes language signed off with version/effective date.
8. **Hard controls tested:** `$1,999.99` associated-value cap and separate `$9,999.99` aggregate per-person daily load ceiling under concurrent paid Orders and duplicate identities/accounts; no transfers/gifting/cash equivalents; no gift marketing; state deny-by-default; no expiry/periodic fee; no automatic reload.
9. **Redemption/refund operations tested:** each approved state scenario, partial/full provider refunds, failed refund, forced reversal, already-consumed value, tax adjustment, and immutable audit trail.
10. **Owner-data and escheat operations tested:** authoritative address history, Customer activity evidence, due-diligence notices, reports, remittance, state-custody Balance transition, and later claim support.
11. **Tax tests:** taxing/nontaxing state addresses, Deposit-versus-usage event, changed location, receipt arithmetic, exemption handling if offered, and refund corrections match provider and SALT matrix.
12. **Operational ownership:** named compliance owner, annual review date, change-control trigger, counsel contacts, state exclusion procedure, and incident/escalation runbook.

## 14. Acceptance and decision checklist for #16 and #14

### Issue #16 research acceptance

- [x] Federal prepaid access, exact $2,000 closed-loop exclusion, separate $1,000 conditions, $10,000 seller threshold, and money-transmission/integral-service provisions examined.
- [x] Regulation E prepaid-account, gift/store/general-use definitions, reloadable/non-gift and mixed-marketing treatment, hybrid prepaid-credit-card risk, expiration, fees, disclosures, and account conversion examined.
- [x] Material official state gift-law examples examined for CA, NY, MA, NJ, WA, ME, CO, IL, CT, RI, OR, TX, and FL.
- [x] Representative state money-services differences examined; no federal-to-state assumption made.
- [x] Federal unclaimed-property priority/supremacy and material CA/WA/ME/CO/CT/NY/DE examples examined, including unknown address and Delaware domicile.
- [x] Representative official sales-tax rules/guidance examined for CA, NY, TX, WA, PA, CT, OH, MA, NJ, and FL; no 50-state tax conclusion made.
- [x] Contract refunds, mandated cash redemption, provider refunds/reversals, disputes, and Customer disclosures separated.
- [x] Clearly stated rules, classification-dependent risks, and product recommendations distinguished.
- [x] Exact counsel questions and production launch gates recorded.

### Decisions that #14 can record now

- [ ] Adopt the non-transferable, Customer-specific, ModelPass-only design as a fixed constraint.
- [ ] Adopt `$1,999.99` as provisional maximum associated value per Customer pending payments counsel.
- [ ] Adopt `$9,999.99` as a separate provisional aggregate per-person daily load ceiling, pending a lower fraud/economic limit and payments counsel.
- [ ] Adopt no expiration and no dormancy/inactivity/maintenance/Balance service fee.
- [ ] Prohibit gifting, third-party funding, automatic reload, transfers, interest, external merchant use, and cash-equivalent purchases.
- [ ] Define nonwithdrawable as no voluntary withdrawal **except** refunds, reversals, legal redemption, and unclaimed-property custody.
- [ ] Require authoritative US postal address/state history and immutable compliance ledger entries.
- [ ] Use state deny-by-default until all four counsel work products and Polar confirmation approve a state.

### Decisions blocked for #14

- [ ] Final launch states or nationwide availability.
- [ ] Final Deposit minimum/maximum above the provisional legal cap and all velocity rules.
- [ ] Final refund eligibility/time limits and dispute-shortfall policy.
- [ ] Final tax point, taxable base, Customer location rule, and Polar/ModelPass responsibility.
- [ ] Final legal-redemption UX and payment method per state.
- [ ] Final terms, receipt, closure, inactivity, and material-change language.
- [ ] Any transfer, gifting, shared Balance, non-US, non-USD, external merchant, cash access, subscription, or automatic reload feature.

## 15. Decision

Issue #16 answers the planning question but does not approve production. The United States sources support continuing with a tightly constrained, reloadable, Customer-specific, non-transferable, ModelPass-only Balance. They also require abandoning any absolute claim that Balance can never be returned: covered state laws can require low-balance cash redemption, providers can refund or reverse payments, and unclaimed-property law can require state custody.

The product choices available now are: no expiration or periodic fees; no gift marketing or gifting capability; no transfer, interest, external merchant, ATM, or cash-equivalent use; no automatic reload; a provisional `$1,999.99` all-associated-value cap; a distinct `$9,999.99` aggregate per-person daily load ceiling pending a lower commercial limit; state-aware legal redemption; owner/address/activity records; and truthful disclosures using the canonical Deposit, Balance, Provider Cost, and Usage Charge terms.

Everything jurisdictional remains blocked: no state launches, final refund rules, tax timing, or provider role until qualified payments/stored-value, consumer-protection, unclaimed-property, and SALT counsel deliver written launch-state analyses and Polar confirms in writing what it sells, taxes, refunds, and reports. This is a conservative product decision based on primary sources, not legal advice or a 50-state legal conclusion.
