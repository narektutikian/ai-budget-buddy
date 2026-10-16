# AI Budget Buddy

An open-source AI tool that builds a personal budget from real bank transactions and turns it into a concrete debt-payoff plan.

Status: early design phase. No runnable code yet.

## Problem

People carrying consumer debt often lack a tool that connects their real transactions to a concrete payoff plan. Budgeting apps categorize spending but rarely tie it to a specific debt-free date. Debt calculators produce plans from numbers the user types in by hand, disconnected from what they actually spend. Keeping a budget current from bank statements is tedious enough that many people stop.

## Goals and non-goals

### Goals

- Build and maintain a personal budget from real transaction history.
- Track spending categories, debts, and goals in one place.
- Parse transactions from bank data, either from Gmail or from direct import.
- Produce a payoff plan that follows from the user's actual spending.
- Document every significant architectural decision and its trade-offs in public.

### Non-goals

- Not financial advice. The tool offers calculations and information, not recommendations from a licensed advisor.
- Not a bank. It does not hold, move, or lend money.
- Not a general chatbot. The assistant is scoped to the budgeting and debt-payoff domain.

## Planned scope

All items below are plans, not implemented features.

- Transaction ingestion: Gmail versus file import (decision pending)
- Transaction parsing with LLMs
- An MCP server exposing budget tools
- Budget and debt-payoff agents
- RAG, only if it is justified (decision pending)
- AWS deployment
- Observability and cost tracking

## Architecture

See [docs/architecture/README.md](docs/architecture/README.md) for the index of architecture documents. Diagrams will be added as the corresponding decisions are made.

## Decision log

Architecture decisions are recorded as ADRs. See [docs/adr/README.md](docs/adr/README.md).

## Roadmap

Dates are targets, not commitments.

| Phase | Target dates |
| --- | --- |
| Foundation | Oct 19-23, 2026 |
| Architecture | Oct 26 - Nov 13, 2026 |
| Parsing and MCP | Nov 16 - Dec 4, 2026 |
| Agents and RAG | Dec 7 - Dec 25, 2026 |
| Ship | Dec 28, 2026 - Jan 9, 2027 |

## Privacy and security stance

This project will process financial data. A threat model is planned before any ingestion code is written. No real user data will ever be committed to this repository. To report a vulnerability, see [SECURITY.md](SECURITY.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The project is early-stage and architecture-first, so feedback on the design documents is the most useful contribution right now.

## License

Apache License 2.0. See [LICENSE](LICENSE).

## Author

Narek - [LinkedIn](https://www.linkedin.com/in/TODO-linkedin-profile) (placeholder link, to be replaced)
