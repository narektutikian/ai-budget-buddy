# ADR-0002: Ingest statements by inbound email to a per-user alias

- Status: Accepted
- Date: 2026-10-23

## Context

The demo is invite-only. The owner invites a user, and the user must get a bank statement into the system with as little friction as possible. The Product Brief assumed a Gmail connection, but Gmail access is post-demo scope: it needs OAuth, a verification process for sensitive scopes, and a much larger privacy surface than a demo that has to prove one thing, that people will send a real statement and find the result useful.

Forces at play:

- Users forward statements from any mailbox, including ones the owner has never seen, so the sender address cannot identify them.
- A statement is financial data. Every extra party that touches it (a provider, a web upload form) adds a processor the consent notice must name.
- The demo has no accounts and no sign-in, so whatever identifies the user at submission time must work without one.
- Forwarding commonly breaks SPF, so email authentication cannot be a gate.
- Cost is capped at $100 per month, and the owner has limited time for anything that needs user-interaction testing.

Known unknowns: which email provider will receive the mail (decided separately in ADR-0003), and the exact size limit of that provider.

## Options considered

### Option 1: Inbound email to a per-user alias

The owner registers the user's email address and issues an alias on the demo domain, such as `k7f3q9x2m4ab@example.com`. The local part is a random token of at least 12 characters. The user sends or forwards a statement to the alias. The recipient address identifies the user, and the sender identifies nothing. Advantages: no UI to build, no sign-in, works from any mail client, and the mailbox is already a place users trust. Disadvantages: the alias is a bearer secret for submission, forwarded messages arrive in several shapes the parser must handle, and deliverability and the provider's limits become part of the system.

### Option 2: Web upload through a magic link

The owner emails each user a personal link to an upload page. Advantages: one clear file input, no forwarding formats to parse. Disadvantages: it needs a page, file-upload handling and a link-based credential (the same design problem as the review page, doubled), and it asks the user to download a statement and upload it again, which is more steps than forwarding an email.

### Option 3: Gmail connection with OAuth

Read the statement mail directly. Advantages: no manual step for the user. Disadvantages: sensitive-scope verification, a standing credential for each user's mailbox, access to far more mail than the system needs, and a larger breach impact. Out of scope for the demo.

### Option 4: Identify the user by the sender address

One shared inbox, with the From address mapped to the user. Advantages: users have nothing new to remember. Disadvantages: users forward from other mailboxes, From is trivially forged, and the brief's open question about invited users who send from arbitrary addresses stays unanswered.

## Decision

Use Option 1.

- The recipient address identifies the user. The sender address is informational only and is never used to identify, authorize or answer.
- The alias local part is a random token of at least 12 characters. It is not sequential and not derived from the user's address.
- The alias is a bearer secret for submission only. Holding it lets someone submit statements as that user. It does not let them read results, change categorization rules or delete data. Results go only to the address registered at invitation (see ADR-0004). Worst-case abuse is data pollution, spend, and unwanted confirmation emails to the registered address (see the DELETE command below). Per-user caps and rate limits contain all three.
- Aliases are revocable and rate-limited. Mail to a revoked alias is dropped.
- SPF, DKIM and DMARC verdicts are logged and may feed rate decisions. They are not used to reject, because forwarding breaks SPF.
- Statements are accepted only as XLSX, from Ameriabank and Ardshinbank, in AMD. Anything else gets a short reply explaining what to send.
- One command is accepted besides statements: a message whose body is the word DELETE. It never deletes anything by itself. It sends a confirmation link to the registered address (never to the sender), and only that confirmation, defined in ADR-0004 and ADR-0007, deletes the user's data. Because the alias is a bearer secret, confirmation requests are rate-limited per user, so a holder of the alias cannot flood the registered address.
- The parser finds the XLSX in each forwarding form: a plain attachment, an attachment of a forwarded message, and an embedded original message. Test fixtures cover Gmail, Outlook and Apple Mail forwards.
- Automated mail (out-of-office replies, bounces, delivery notices) is detected and ignored. Outbound mail is marked as auto-generated so two mailboxes cannot reply to each other in a loop.

The email provider is chosen separately in ADR-0003, against the criteria in the architect vision document (section 5.1). This ADR holds for any provider that meets them.

## Consequences

### Positive

- No user interface and no sign-in for submission, so the demo can start with the owner and a mailbox.
- Gmail access and its verification process are avoided entirely.
- A leaked alias exposes less than a leaked mailbox credential would: submission, and a request for a deletion confirmation, but no reading, no rule changes and no deletion.

### Negative

- Anyone who learns an alias can submit statements as that user, or trigger deletion confirmation emails to the registered address, until the alias is revoked. The mitigation is caps, rate limits and revocation, not prevention.
- The system cannot tell a legitimate forward from a forged one. A stranger who guesses or obtains an alias is indistinguishable from the user.
- Forwarded-mail parsing is fragile. Mail clients change forwarding formats without notice.
- The alias must be sent to the user and kept by them. If the user loses it, the owner reissues it by hand.

### Cost of the choice

Deliverability and mail handling become permanent operational concerns: the demo domain needs correct DNS records, outbound reputation and bounce handling. The inbound provider also processes every statement, so it must be named in the consent notice. Reversing the choice later is cheap for the user-facing change, because ingestion sits behind the parser boundary, but any later move to Gmail needs its own ADR and a new consent notice.
