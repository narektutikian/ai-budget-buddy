# Architecture Decision Records

This directory is the decision log for AI Budget Buddy. See [ADR-0001](0001-record-architecture-decisions.md) for how records are written and maintained. New records start from [0000-template.md](0000-template.md).

## Index

| Number | Title | Status | Date |
| --- | --- | --- | --- |
| [0001](0001-record-architecture-decisions.md) | Record architecture decisions | Accepted | 2026-10-16 |
| [0002](0002-email-ingestion-and-alias-scheme.md) | Ingest statements by inbound email to a per-user alias | Accepted | 2026-10-23 |
| [0003](0003-email-provider-and-mail-handling.md) | Receive and send statement mail with Amazon SES in one AWS region | Accepted | 2026-11-05 |
| [0005](0005-deterministic-code-owns-money.md) | Deterministic code owns money; the model categorizes and proposes | Accepted | 2026-11-02 |
| [0007](0007-privacy-and-data-lifecycle.md) | Delete raw statements explicitly, with an independent age-based sweep | Accepted | 2026-11-09 |
