# ADR-0001: Record architecture decisions

- Status: Accepted
- Date: 2026-10-16

## Context

AI Budget Buddy is built architecture-first, and the reasoning behind each significant choice is as important as the choice itself. Without a durable record, the rationale is lost, and later readers cannot tell whether a decision was deliberate or accidental. The project is also a public portfolio piece, so the decision history should be readable by people who were not present.

## Options considered

### Option 1: Architecture Decision Records in the repository (MADR format)

One Markdown file per decision in `docs/adr/`, following the MADR structure. Records are versioned together with the rest of the repository and reviewed through pull requests.

### Option 2: A wiki or external document

Easier to edit freely, but detached from the code history, not reviewed through pull requests, and not guaranteed to persist alongside the repository.

### Option 3: No formal record

No overhead, but rationale lives only in commit messages and memory.

## Decision

Use Architecture Decision Records stored in `docs/adr/`, following the MADR format (see [0000-template.md](0000-template.md)).

- One file per decision, named `NNNN-short-title.md` with a sequential number.
- An accepted ADR is immutable. It is not edited to reflect later thinking.
- To change a decision, write a new ADR that supersedes the old one, and update the old ADR's status line to point to the new one. That status line is the only permitted edit to an accepted ADR.
- Every ADR is listed in the index at [README.md](README.md).

## Consequences

### Positive

- The reasoning behind each decision is preserved and reviewable.
- Reversals are visible as new records rather than silent edits.

### Negative

- Decisions take longer to make because they must be written up.
- The log can drift from reality if records are not kept up to date.

### Cost of the choice

A small, ongoing writing and review overhead on every significant decision, and the discipline to keep the index current. Rewriting history is deliberately not possible, so a mistaken record stays visible until superseded.
