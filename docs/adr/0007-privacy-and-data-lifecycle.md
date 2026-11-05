# ADR-0007: Delete raw statements explicitly, with an independent age-based sweep

- Status: Proposed
- Date: 2026-11-05

## Context

A bank statement is the most sensitive data the system touches. It holds transaction history, holder names and account numbers, and the demo's consent notice has to say how long it is kept. The architect vision (section 5.6) already warns that a retention promise is easy to get wrong: queued messages can wait longer than planned, processing can stop before it deletes anything, and a storage lifecycle rule removes objects asynchronously, in whole days, with a delay AWS does not bound.

Forces at play:

- The system must be able to say what it keeps, for how long, and who else holds a copy, and every statement it makes must be true.
- Processing is a queue followed by a pipeline. Either can stall, fail or be retried, so deletion cannot depend on processing finishing.
- Derived data (transactions, categories, debts, per-user rules) is what makes the result useful and is also personal financial data.
- A user can ask for deletion ([ADR-0002](0002-email-ingestion-and-alias-scheme.md) defines the DELETE command, and ADR-0004 (planned) defines the confirmation link). What that deletes must be defined.
- Other parties hold copies this system cannot delete: the user's own mailbox, and any result email already sent.
- Any provider that touches a statement is a processor, named in the consent notice.

Known unknowns: whether the inbound mail provider keeps any copy of a message after it has written it to storage (an acceptance check of [ADR-0003](0003-email-provider-and-mail-handling.md), whose result is not yet recorded in the repository), the retention terms of the model provider (ADR-0009, planned), and the datastore and its backup behaviour (ADR-0006, planned). This ADR is written at the logical level so that none of them changes the decision. Each one can still change what the consent notice may say.

## Options considered

### Option 1: Storage lifecycle rule only

Configure the bucket to expire raw messages after a day. Advantages: no code, and nothing to fail inside the pipeline. Disadvantages: expiry is configured in whole days and the actual removal is asynchronous with an unbounded delay, so no deletion ceiling can be claimed. It also says nothing about derived data.

### Option 2: Delete explicitly in the pipeline only

The pipeline deletes the raw message as soon as parsing succeeds or fails. Advantages: deletion happens at the earliest moment in the normal case. Disadvantages: a message that is never picked up, a crashed run or a failed delete leaves the object behind with nothing to notice it. As the vision says, this does not guarantee any ceiling either.

### Option 3: Explicit deletion plus an independent age-based sweep

The pipeline deletes the raw message after processing. A separate scheduled job deletes any raw object older than a fixed age, whatever state the pipeline is in. Failed deletions are retried and an alarm fires when an old object remains. The storage lifecycle rule stays as a last backstop. Advantages: the ceiling depends on one small job with a monitored result, not on every pipeline path. Disadvantages: more code, a monitored scheduled job and an alarm to run.

### Option 4: Keep raw statements for a fixed period

Retain the file for debugging and re-processing. Advantages: parser failures can be replayed. Disadvantages: it keeps the most sensitive artifact for no benefit to the user, and the project can replay failures from synthetic fixtures instead.

## Decision

Use Option 3.

Raw messages and attachments:

- The pipeline deletes the raw message and attachment after processing, on success and on failure.
- An independent sweep runs every hour and deletes any raw object older than 22 hours. The threshold sits below the 24-hour ceiling so that the interval between sweeps and one retry still fit inside it. The sweep looks at object age only, not at pipeline state. Deletions are retried. An alarm fires when an object older than 24 hours exists after a sweep, and a person is told.
- The storage lifecycle rule stays as a last backstop and is never the control.
- Raw messages are never copied: not into logs, queues beyond the pipeline's own message, fixtures or the repository.
- The 24-hour ceiling is claimed to users only when the sweep, the retries and the alarm exist and have a passing test. Until then no ceiling is claimed. The consent notice states what is true at the time.

Derived data:

- Derived data is isolated per user and kept until the user asks for deletion or the demo ends. The demo end date is set in the invitation and the notice.
- When the demo ends, derived data and aliases are deleted by the owner's admin script within 30 days, and the deletion is tested.
- On a confirmed user deletion (confirmation defined in ADR-0004, planned), the system deletes the user's derived data, per-user rules and review tokens, and revokes the alias. It keeps a minimal record: a one-way identifier, the time, and that deletion happened. It keeps no content. The record exists so that a second request is idempotent and so the owner can show the deletion path ran.
- Deletion is a recorded job with a state. A failed step is retried and alarmed, not skipped.

Logs and observability:

- Logs hold cost, latency, delivery status and counts. They hold no raw descriptions, no message bodies, no review tokens and no confirmation tokens.
- Log retention is set explicitly and kept short.

Copies this system cannot delete, stated in the invitation:

- The statement remains in the user's own mailbox and sent items.
- Result emails already sent remain in the user's mailbox. They hold aggregates and merchant categories only, with no account numbers and no personal counterparty names.
- Backups of the datastore keep deleted derived data until they expire. The backup retention is set as short as the datastore allows, and the consent notice states it.

Third parties:

- Before any model call, holder names and account numbers are removed and person-to-person transfers are routed by rule, so counterparty names never reach the model (vision, section 5.6).
- The inbound mail provider and the model provider are named in the consent notice with what each receives and how long it keeps it, as far as their terms say. Where a term cannot be confirmed, the notice says it is unconfirmed instead of omitting it.
- Submitting a statement is logged as consent.

## Consequences

### Positive

- The deletion ceiling rests on one small job and one alarm, and not on every path through a queue and a pipeline.
- A stalled or failed message cannot leave a statement behind unnoticed.
- The consent notice makes only claims the system can show.
- Deletion of derived data is defined, tested and idempotent.

### Negative

- A scheduled job, retries and an alarm are code and infrastructure to build and operate, for a demo with about 20 users.
- No retention ceiling can be advertised until that code exists and is tested, so early invitations get a weaker promise.
- Failures cannot be replayed from the original statement, so parser bugs are found through synthetic fixtures and the user's re-sent file.
- The sweep alone does not remove copies outside the system's control (mailboxes, sent results, backups, provider-held copies).
- Provider retention terms may force the notice to say something the owner would prefer not to.

### Cost of the choice

Ongoing: a monitored sweep, retries, an alarm that someone must act on, and a tested deletion path for derived data. The 24-hour figure is a commitment that must stay true, so any change to the pipeline, the storage or the provider is checked against it. Reversing the choice, for example to a longer retention for debugging, would need a new ADR and a new consent notice, and users who were invited under the shorter promise would have to be told.
