# AI Budget Buddy: Threat Model

Status: Draft v0.1, November 2, 2026. Extracted from the [architect vision](architect-vision.md) (section 5.7), with the assets and trust boundaries taken from sections 3, 5.1, 5.2 and 5.6. This is analysis only. Nothing described here is implemented or tested yet, and every control below is a design intention until a test or a result in this repository says otherwise. Where a threat depends on a decision that is not yet recorded, the table says which one.

## 1. Scope

The invite-only demo: statements arrive by email to a per-user alias, a fixed pipeline parses and categorizes them, results go by email to the registered address, and one server-rendered review page, reached by a link, takes corrections and debt confirmation. There are no accounts and no Gmail connection. Out of scope: web upload, Gmail OAuth, a dashboard, native apps, and anything beyond invited users, which needs legal review first.

## 2. Assets

| Asset | Why it matters |
| --- | --- |
| Raw statements and attachments | Full transaction history, holder names and account numbers. The most sensitive data in the system |
| Derived data | Transactions, categories, debts and rules, isolated per user |
| Aliases | Bearer secrets for submission. They identify the user at ingestion |
| Review links and sessions | Bearer credentials for one result, stored hashed |
| Registered email addresses | The only place results and confirmation links are sent |
| Provider and API credentials | Held in a managed secret store |
| Spend budget | The demo has a hard monthly ceiling. Abuse of the model or mail quota is a way to exhaust it |
| Sending domain reputation | A result that lands in spam breaks the demo's success measure |

## 3. Actors and trust boundaries

| Actor or boundary | Trust |
| --- | --- |
| Invited user | Trusted for their own data only |
| Anyone who learns an alias | Can submit as that user. Cannot read results, change rules or delete data |
| Anyone who holds a review link | Can view and edit one result until the link expires or is revoked |
| Anyone sending mail to the demo domain | Untrusted. The From, Reply-To and authentication results identify nobody |
| Counterparties | Write the transaction descriptions. Their text is untrusted input to the parser, the model and the review page |
| Inbound and outbound mail provider | A processor of every statement. Chosen in ADR-0003 (planned) |
| Model provider | Receives redacted, batched descriptions. Chosen in ADR-0009 (planned) |
| Email security scanners | Fetch links in delivered mail before the user does |
| Owner | Issues and revokes aliases and sets caps through an admin script |

Boundaries crossed by data: internet to inbound mail, inbound mail to raw storage, pipeline to the model provider, backend to the review page in the user's browser, and outbound mail to the user's mailbox.

## 4. Threats and controls

Status is Designed unless stated otherwise. Designed means decided in the vision or an ADR and not yet built or tested.

| ID | Threat | Control | Source |
| --- | --- | --- | --- |
| T1 | Malicious or malformed XLSX (macros, formula injection, decompression bombs) | Accept XLSX only, size limit, read-only parsing, ignore formulas, parse in an isolated function | Vision 5.7 |
| T2 | Prompt injection through transaction descriptions | Descriptions treated as data, enum-constrained structured output, no tools or retrieval in the categorization call | Vision 5.7 |
| T3 | Cross-user data exposure | Per-user prefixes and row-level scoping, tested with a negative suite | Vision 5.7 |
| T4 | Alias leaked or guessed | Random token, revocation, per-user caps, results sent only to the registered address | Vision 5.7, ADR-0002 |
| T5 | Forged sender used to read results | Results never go to From or Reply-To. Deletion by email needs a confirmation link sent to the registered address | Vision 5.7, ADR-0002 |
| T6 | Review link forwarded or leaked | One-result scope, expiry, revocation, no accounts or history reachable from it, notification email on edit | Vision 5.7 |
| T7 | Email security scanners fetch the link | A GET shows only a button. The session is created by a POST | Vision 5.7 |
| T8 | Cross-site request forgery or script injection on the review page | CSRF tokens, strict content security policy, output encoding of transaction text, no third-party scripts | Vision 5.7 |
| T9 | Token exposed through logs or referrers | Token removed from the address bar after exchange, no-referrer policy, token hashed at rest and excluded from logs | Vision 5.7 |
| T10 | Mail loops and auto-replies | Ignore automated mail, mark outbound as auto-generated, per-user outbound cap | Vision 5.7 |
| T11 | Results filtered as spam | SPF, DKIM and DMARC on the sending domain, link on the same authenticated domain, inbox test at invitation, delivery status tracked | Vision 5.7 |
| T12 | Cost abuse or runaway loop | Per-user token, upload and message caps, billing alerts, global kill switch | Vision 5.7 |
| T13 | Bank format drift | Parser fails visibly, replies naming the unrecognized file or column, never guesses | Vision 5.7 |
| T14 | An injected description makes the model report high confidence, so a mislabeled row is not shown for review | Model-reported confidence is untrusted. It may order the review list but must not be the only reason a model-assigned row is hidden. The mechanism is set in ADR-0008 (planned) | ADR-0005 (Accepted) |
| T15 | Raw statements outlive the deletion promise because processing fails or a queue backs up | Age-based cleanup, deletion retries and failure monitoring are required before any deletion ceiling is claimed. A storage lifecycle rule is a backstop only. No ceiling is claimed today | Vision 5.6 |
| T16 | The inbound mail provider or the model provider keeps data after the pipeline has deleted it | Provider retention confirmed and set as short as it allows. Providers named in the consent notice. Not yet answerable | Vision 5.1 and 5.6 |

## 5. What this model does not yet answer

- T16 cannot be assessed until the mail provider (ADR-0003, planned) and the model provider (ADR-0009, planned) are chosen and their retention terms are read.
- The review link expiry (30 days in the vision is an assumption) and the consent notice wording are settled in ADR-0004 (planned). T6 depends on both.
- The second-order effect of T2 on what the user sees is covered by T14, but the control in T14 does not exist until ADR-0008 is written.
- No row has a test behind it. The negative suite for T3, the injection fixtures for T2 and T14, and the scanner behavior in T7 are all to be written.

## 6. How this gets tested

Each threat becomes a fixture or a test when the component it applies to exists. A control is moved from Designed to Tested only by linking the test or result in this file. Rows that cannot be tested in the demo are listed in section 5 and stay open.
