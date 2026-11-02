# ADR-0005: Deterministic code owns money; the model categorizes and proposes

- Status: Proposed
- Date: 2026-11-02

## Context

AI Budget Buddy turns a bank statement into a budget and a debt-payoff estimate. Two kinds of work are mixed in that job. Some of it must be exact: amounts, balances, dates, totals, and the number of months to become debt free. Some of it cannot be done well by rules: transaction descriptions arrive in Armenian, transliterated Armenian, Russian and English, with bank noise, and mapping them to categories is a text-classification problem.

A language model can do the second kind of work and will do the first kind badly in a way that is hard to see. Its arithmetic is not reproducible, and a wrong figure in a result email looks exactly like a right one. The decision is where the line between the two sits, and what enforces it.

Forces at play:

- The result tells a person how long it will take to clear their debts. A wrong number there is a product failure and an honesty problem, not a cosmetic one.
- Transaction descriptions are text written by third parties. Anyone who can send the user a transfer can put words in front of the model.
- A model reports its own confidence, and that confidence is also text it can be steered to produce.
- Model calls cost money and the demo has a hard monthly ceiling.
- Every AI component needs a measured baseline and a deterministic fallback, so the system can still answer when the model is wrong, unavailable or over budget.

Known unknowns: how accurate categorization will be on Armenian text (measured in ADR-0008, planned), which model and provider will be used (ADR-0009, planned), and the real terms of ապառիկ installment plans, which the payoff engine depends on.

## Options considered

### Option 1: The model does everything

Give the model the parsed statement and ask it to categorize, detect debts, compute the payoff plan and write the summary. Advantages: the least code, and flexible with odd input. Disadvantages: arithmetic and dates are not reproducible and cannot be tested to a standard, injected text in a description can reach the numbers, every statement pays for a long model call, and there is no baseline to measure against.

### Option 2: The model proposes numbers, code verifies them

The model extracts amounts and computes totals, and code recomputes and compares. Advantages: tolerant of messy input. Disadvantages: the statement is an XLSX from two known banks, so extracting amounts is a deterministic job already. Verification adds a second computation path to maintain and still lets model-produced numbers into the system whenever the check is incomplete.

### Option 3: Rules and a merchant dictionary only

No model. Advantages: fully deterministic, free to run, simplest to audit. Disadvantages: it will not cover the long tail of merchant text across four languages and scripts, so many transactions stay uncategorized and the user does the work. It is kept as the first stage of the cascade and as the measured baseline, but it is not enough alone.

### Option 4: Deterministic code owns money, the model is limited to classification and proposals

Code handles everything that produces a number or a date. The model is used only to assign a category from a fixed list to text that rules could not resolve, and to propose a label for a counterparty. Advantages: the outputs that matter are reproducible and testable, and an injected description can change a label but not a figure. Disadvantages: more code to write and maintain, and the model's labels still affect what the user sees.

## Decision

Use Option 4.

What deterministic code owns:

- Parsing amounts, dates and balances from the statement.
- Recurring-payment detection (same counterparty, stable amount, regular cadence).
- All totals, the payoff plan and every date, using exact decimal arithmetic in AMD, with property-based tests and published worked examples.
- Composing the result email and the review page. Every number and date in them is inserted by code. In the demo the model writes no free text that reaches the user; results use templates. Plain-language explanation by the model is deferred.

What the model may do:

- Assign each transaction that rules and the user's own corrections did not resolve to one category from a fixed list, and report a confidence value.
- Propose a counterparty label, such as lender or retailer. This is a proposal only. Nothing enters the payoff engine until the user confirms the debt's type, balance, rate and end date on the review page, and the debt-free estimate stays marked provisional until then.

What enforces the line:

- The model's output schema contains a category from the fixed list and a confidence value, and nothing else. Output that does not validate is discarded and the transaction stays uncategorized. The schema has no field for an amount or a date, so none can be returned.
- The categorization call has no tools and no retrieval. Transaction descriptions are treated as data.
- Reassigning a category moves money between categories. It cannot change the statement total. A test asserts that the category totals sum to the statement total for every fixture.
- Model-reported confidence is untrusted input, because an injected description can claim a high value. It may order the review list but must not be the only reason a model-assigned row is hidden from review. The mechanism is set in ADR-0008 (planned).
- If the model is unavailable, returns invalid output or the spend cap is reached, the affected rows remain uncategorized, go to the review list, and the result email is still sent.

Counterparty names in person-to-person transfers never reach the model. They are routed by rule, as described in the architect vision (section 5.6) and recorded in ADR-0007 (planned).

This boundary is revisited by a new ADR if a use case needs the model to produce a number or a date. No such use case exists in v1.

## Consequences

### Positive

- Every figure in a result can be reproduced from the statement and tested without a model.
- A hostile description can mislabel a transaction but cannot alter an amount, a date or a total.
- The model can be swapped or removed (ADR-0009, planned) without touching the money logic.
- Model spend is limited to the transactions that rules could not resolve.

### Negative

- A wrong model label still changes category totals, and so what the user sees, until it is corrected.
- Result emails are templated and read less naturally than model-written text.
- Rules, a merchant dictionary and the parsers have to be built and maintained alongside the model prompt.
- Debt detection only finds regular payments. Irregular ones that a model might notice are missed unless the user adds them.
- The user must confirm each detected debt before the estimate stops being provisional.
- Model confidence cannot be trusted as a review signal, so the review list needs a rule that does not depend on it.

### Cost of the choice

All parsing, detection, payoff and composition code is owned and maintained here, including every change a bank makes to its statement format, which is the main recurring cost of the project. The rules and dictionary need ongoing upkeep as merchants and wording change. Reversing the choice later means letting a model touch figures again, which would need its own ADR and an evaluation that shows it is at least as accurate and reproducible as the code it replaces.
