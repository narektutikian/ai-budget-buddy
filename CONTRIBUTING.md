# Contributing

AI Budget Buddy is at an early stage and is being built architecture-first. There is no runnable code yet. The most useful contributions right now are feedback on the design documents and the decision log.

## Opening issues

- Use the bug report template for problems with the repository content (for example, an error or inconsistency in the docs).
- Use the feature request template for ideas. Please describe the problem you want solved before proposing a solution.
- Questions or critiques of an architectural decision are welcome as issues. Reference the relevant ADR in `docs/adr/` where possible.

## Pull requests

- Keep pull requests small and focused on one change.
- Significant design changes should come with an ADR. See [docs/adr/README.md](docs/adr/README.md).
- Accepted ADRs are not edited. To change a decision, propose a new ADR that supersedes the old one.
- Use conventional commit messages (`docs:`, `ci:`, `chore:`, and so on).
- Markdown is linted in CI with markdownlint-cli2.

## Data

Never include real financial data or personal information in issues, pull requests, or commits. Use obviously synthetic examples only.

## Security

Do not report vulnerabilities in public issues. See [SECURITY.md](SECURITY.md).
