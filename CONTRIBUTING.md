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

A CI check, `no-real-data`, enforces the common cases. Run it locally with `node scripts/no-real-data/check.mjs`. It fails the build on:

- spreadsheets, PDFs, archives and other statement-like files anywhere in the repository. Build spreadsheets from text at test time.
- `.csv`, `.tsv` and `.eml` files outside `fixtures/synthetic/`, which is the only place synthetic text fixtures may live.
- numbers that pass the card checksum, valid IBANs, long digit runs that could be account numbers, Armenian phone numbers, and email addresses on real domains.
- secret-shaped values such as cloud keys and private key blocks.
- binary files that cannot be reviewed. Images are allowed only under `docs/` or `assets/`.

Use obviously fake values in fixtures: all zeros for account numbers and the part of a phone number after `+374`, well-known test card numbers, and the reserved domains `example.com` and `.example`. The check prints where a finding is and which rule fired, never the matched text.

The check is a safety net, not proof. It cannot recognise names, free text, or what is inside an image. Review your own diff for real data before you open a pull request.

## Security

Do not report vulnerabilities in public issues. See [SECURITY.md](SECURITY.md).
