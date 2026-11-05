# ADR-0004: Deliver results by email, with a one-page review reached by a scoped link

- Status: Proposed
- Date: 2026-11-05

## Context

[ADR-0002](0002-email-ingestion-and-alias-scheme.md) decided that statements arrive by email and that results go only to the address registered at invitation. The demo has no accounts, no dashboard and no Gmail connection. Two things still need a path back to the user: seeing the result, and correcting it. Categories the model got wrong must be fixable, and each detected debt needs the user's confirmed type, balance, rate and end date before any debt-free estimate is shown ([ADR-0005](0005-deterministic-code-owns-money.md)).

Forces at play:

- The mailbox is the only place the user is already identified, so results and every confirmation go there.
- Correcting rows in an email or a spreadsheet is poor to use. The owner approved a small page on 2026-10-23.
- The demo has no accounts, so whatever lets a user open the page must work without a sign-in.
- Email security scanners fetch links in delivered mail before the user does, so a link must not do anything on a plain GET.
- A forwarded email forwards access to anything a link opens.
- A result that lands in spam looks like a user who never returned, and ruins the success measure.
- ADR-0005 says a debt-free estimate is unavailable until the user has confirmed each debt. The vision (section 5.2) still describes a provisional estimate in the email. This ADR follows ADR-0005, and the vision needs a matching update.

Known unknowns: how long a link should live (the vision's 30 days is an assumption), the final wording of the consent notice, and the review page's real usage, which is measured as a share of users who open it, not of all users.

## Options considered

### Option 1: Results by email, plus a one-page server-rendered review reached by a scoped link

The result email holds the summary and a link. The link opens a single page rendered by the backend, where categories and debt terms are corrected. Advantages: one small surface, no sign-in, no front-end build, no cross-origin setup, and the user is already in the mailbox. Disadvantages: a link is a credential that can be forwarded, and the system gains a small web attack surface.

### Option 2: Corrections by spreadsheet round trip

The result email attaches a spreadsheet the user edits and sends back. Advantages: no web surface. Disadvantages: poor to use, a second inbound format to parse, and an edited file is untrusted input that can overwrite anything.

### Option 3: Corrections by reply grammar or free-text replies

The user replies with fixed commands or plain sentences. Advantages: no page. Disadvantages: a command grammar is hard to learn and to test, and free text read by the model lets an email body influence categorization and debts, which contradicts ADR-0005.

### Option 4: A static single-page app with an API

Advantages: familiar tooling. Disadvantages: a build, cross-origin setup and token handling in browser scripts, for one page.

### Option 5: Accounts and sign-in, or a low-code tool

Advantages: a standard identity model, or no code. Disadvantages: accounts and a dashboard are out of demo scope, and a low-code tool adds another processor that holds statement data.

## Decision

Use Option 1.

Result email:

- It goes only to the registered address, never to the From or Reply-To of any incoming message (ADR-0002).
- It contains the budget summary by category for the statement period, the monthly debt burden, the detected recurring payments with the values the system assumed, and the link. It contains no debt-free estimate, because none exists before confirmation (ADR-0005).
- It contains aggregates and merchant categories only: no account numbers and no personal counterparty names.
- It is marked auto-generated. The link is on the same authenticated domain as the sender.

Review link:

- The token is random with 128 bits, stored hashed, scoped to one result, and revocable. It expires after 7 days.
- Opening the link shows a button, not data. Pressing it sends a POST that creates a short session (30 minutes idle) in a cookie that is HttpOnly, Secure and SameSite Strict. A scanner that fetches the link cannot use the token up or trigger a change.
- Every change needs a CSRF token. The token is removed from the address bar after the exchange.
- Pages are served as no-store, with a strict content security policy, no third-party scripts, no analytics and a no-referrer policy. Transaction text is output-encoded.
- An expired or revoked link shows "we will email you a new one" and sends it to the registered address. It reveals nothing about the user. Re-issue requests are rate-limited per user, so a holder of an old link cannot flood the registered address.
- The first edit in any 24 hours sends one notice to the registered address, so misuse of a leaked link is visible.

What a review session can do:

- Change the category of a transaction in this result. Each change saves immediately.
- Enter or correct balance, rate and end date for each detected debt in this result, which is what makes the debt-free estimate available (ADR-0005).
- Nothing else. It cannot create or change a per-user rule, cannot delete user data and cannot reach any other result.

Actions with effect beyond one result use a separate confirmation link:

- Creating or changing a per-user rule, and deleting the user's data, each send a confirmation link to the registered address only. The link is single-use, bound to that one action, and expires after one hour. It shows a button and acts on POST, like the review link.
- Emailing the word DELETE to the alias starts the same deletion confirmation without the review link (ADR-0002). What deletion removes is defined in ADR-0007 (Proposed).

Why a link credential is acceptable here when ADR-0002 rejected an upload link:

- The review page is needed to correct results. An upload link would have been a second credential beside the alias and the review link.
- The review link is used rarely, opens one result, expires in days, and is not a way to submit statements. The alias stays submission-only.

The consent notice states: what is processed and by whom, how long the raw statement is kept (ADR-0007), that the review page shows full transaction rows, that the statement and results also stay in the user's own mailbox, that result emails travel over transport encryption that is opportunistic, and that submitting a statement is logged as consent. Final wording is written with the invitation and reviewed before any invitation goes out.

Deliverability is checked, not assumed. The sending domain has SPF, DKIM and DMARC. Each invitation asks the user to confirm that a test message arrived in the inbox, and delivery status is recorded per result.

## Consequences

### Positive

- One small page replaces accounts, a dashboard and a front-end build.
- A scanner or a forwarded preview cannot spend or trigger anything, because links act only on POST.
- A leaked review link exposes one result for at most seven days, with an edit notice sent to the owner of the mailbox.
- The review page cannot change rules or delete data by itself, so a stolen link cannot do either.
- The alias and the review link carry different powers, so leaking one does not leak the other.

### Negative

- Anyone who holds a review link can view and edit that result until it expires or is revoked, and a forwarded email is forwarded access.
- The page shows full transaction rows, which is more than the email's summary.
- A small web attack surface returns: one page, one session mechanism, CSRF and a content security policy to get right.
- With no estimate in the email before confirmation, the email alone no longer answers "how long until I am debt free", so users who never open the link get a weaker result than the vision describes.
- Seven days is short, so some users will need a re-issue, and each re-issue is an email.
- A link in the email can lower inbox placement.

### Cost of the choice

Ongoing: session, CSRF, header and cookie handling to maintain and test, link and token lifecycle, re-issue and notice emails, and a rate limit on each. Deliverability becomes an operational concern the owner watches. Reversing the choice later, for example to accounts, would need a new ADR, a new consent notice and a migration of the link-based access model. The vision (section 5.2) must be updated so that it no longer promises a provisional estimate in the email.
