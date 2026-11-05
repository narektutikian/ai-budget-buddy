# ADR-0003: Receive and send statement mail with Amazon SES in one AWS region

- Status: Accepted
- Date: 2026-11-05

## Context

[ADR-0002](0002-email-ingestion-and-alias-scheme.md) decided that statements arrive by inbound email to a per-user alias, and left the provider open. The architect vision (section 5.1) sets six criteria for the choice:

1. Accepts mail for arbitrary local parts on the demo domain, so aliases need no per-user mailbox.
2. Delivers the full raw message with attachments to storage or a webhook, with a size limit above a typical statement.
3. Exposes SPF, DKIM and DMARC verdicts.
4. Sends outbound mail with DKIM signing and reports bounces and complaints.
5. Data handling: who stores the raw message, where, and for how long.
6. Fits the $100 per month ceiling and the AWS hosting constraint.

Forces at play:

- A statement is financial data. Every third party that touches one is a processor that the consent notice must name.
- The demo has about 20 invited users. The volume used for pricing is an assumption: about 80 inbound messages and about 120 outbound messages per month.
- Forwarded statements arrive in several shapes (plain attachment, attachment of a forwarded message, embedded original message). Whatever receives the mail must not flatten or rewrite them.
- ADR-0002 logs SPF, DKIM and DMARC verdicts and does not reject on them, but the verdicts must be available to log.
- Results and confirmation links go only to the address registered at invitation (ADR-0002, vision section 5.2), so outbound mail is part of this decision.

Known unknowns: how Gmail, Outlook and Apple Mail structure forwards, whether SES keeps any copy of a message after it has been written to storage (ADR-0007 depends on this), and whether outbound production access is granted and how fast.

The provider facts below were collected from official documentation on 2026-11-03. They are research results, not hands-on results, and the acceptance conditions below say what is still to be tested.

## Options considered

### Option 1: Amazon SES receiving to S3, and SES for outbound

Receipt rules match every address on a domain or subdomain and write the raw, unmodified message to a private S3 bucket in the same region. Verdicts arrive in the notification. Advantages: statements stay in an account and region the owner controls, AWS is already the hosting processor so no new name appears in the consent notice, the raw message preserves every forwarding form, and email fees at the demo volume are well under one dollar per month at AWS's published rates. Disadvantages: only raw MIME is delivered, so MIME parsing is ours to write. The documented limit is 40 MB raw, including headers, and larger mail bounces. New accounts start in the SES sandbox, which blocks sending to unverified recipients. Using the S3 action's KMS option means client-side encryption.

### Option 2: Cloudflare Email Routing with a Worker

A catch-all rule hands the raw message (up to 25 MiB) to a Worker, which would write it to storage in the AWS region. Advantages: routing is free, and Cloudflare states that it does not store message content. Disadvantages: Cloudflare becomes a processor in transit, the edge is global and not the AWS region, outbound sending is in beta, and a public issue (cloudflare/workerd#6740) reports the Authentication-Results header missing on Worker delivery, which would remove the verdicts. The documentation and the issue disagree, and the question was open when checked.

### Option 3: A hosted inbound parser (Postmark, Mailgun, SendGrid)

Each can accept arbitrary local parts and forward the message to a webhook. Advantages: parsed JSON saves MIME work. Disadvantages: each adds a processor outside the AWS account. Postmark documents a 45-day default retention of message content, set account-wide, and shortening it costs extra. For Mailgun and SendGrid, the inbound size limit, the verdict fields and retention after delivery could not be confirmed from official documentation. Parsed modes flatten MIME, and whether a spreadsheet inside an attached message survives that was not verified.

### Option 4: Poll an ordinary mailbox over IMAP

Fastest to try. Disadvantages: it needs plus-addressing or a catch-all, which exposes the base address or collects all spam, the mailbox keeps every statement indefinitely at a third party, there are no structured verdicts, and polling adds latency. Suitable as a smoke test only.

## Decision

Use Option 1.

- Inbound: the receiving name's MX record points to SES in the chosen region. One receipt rule matches the whole domain, writes the raw message to a private S3 bucket in the same region, and sends a notification carrying the verdicts. The pipeline reads the message from S3, not from the notification.
- Use receipt rules, not SES Mail Manager. At the time of checking, Mail Manager charged a per-endpoint monthly fee even when the endpoint was closed.
- Encrypt the bucket with its default server-side encryption. Do not use the S3 action's KMS option, which is client-side encryption that needs the S3 encryption client to read.
- Outbound: SES in the same region, DKIM on the sending domain, bounces and complaints through notifications. Results and confirmation links go only to the registered address, and outbound mail is marked auto-generated (ADR-0002).
- Keep the receiving name and the MAIL FROM name separate. A custom MAIL FROM subdomain needs its own MX record.
- The region is fixed in ADR-0013 (planned). It must be a region where SES receiving is available and it must hold storage as well, so statements do not leave it.
- Sandbox: request production access now. AWS documents an initial response within 96 hours, and longer if it needs more information. Until it is granted, register each invited user's address as a verified SES recipient, which is feasible at about 20 users and adds one step to onboarding. If production access is denied, send outbound mail through another provider. That provider becomes a named processor for result emails, which carry aggregates only (vision section 5.2), while statements stay in AWS.
- The consent notice names AWS (SES, S3 and the functions that process mail) and the region.

This ADR is merged as Accepted only after the owner has run the checks below. Until then it stays Proposed.

### Acceptance conditions

1. Forward one real statement to a test alias from Gmail (Forward, and Forward as attachment), Outlook.com and Apple Mail. For each, record whether the XLSX is a top-level part or nested in an attached message, whether its SHA-256 matches the original, and the three verdicts.
2. Send a statement-sized file and confirm it arrives intact. The oversize bounce is documented and is optional to test.
3. Read an object back from S3 with the intended encryption setup.
4. Delete an object and confirm from the documentation whether SES keeps any copy of the message. Record the answer here and carry it into ADR-0007.
5. Send a result-style message from SES with DKIM to Gmail, Outlook and Apple Mail recipients (verified recipients while in the sandbox) and record whether each lands in the inbox.
6. Re-check the AWS pricing page and confirm that receipt rules are current and not deprecated.
7. Submit the production access request and record the date.

## Consequences

### Positive

- Statements stay in one account and one region, and the processor list for statements stays at one name.
- SPF, DKIM and DMARC verdicts are structured fields, so ADR-0002's logging needs no workaround.
- The raw message preserves every forwarding form, so the parser sees what the user's mail client produced.
- Email fees at the demo volume are well under one dollar per month at AWS's published rates, so cost does not decide between the options.

### Negative

- Only raw MIME is delivered, so finding the XLSX in each forwarding form is parser code that this project writes and maintains.
- The 40 MB raw limit is about 29 MB once the attachment is decoded. Larger mail bounces. Ordinary statements are far below it.
- The sandbox can delay or block result emails until production access is granted, and until then every recipient must be verified by hand.
- A new sending domain and a new SES account start with no sending reputation, which feeds the deliverability risk in the vision (section 5.2). It is checked at invitation, not assumed.
- The decision depends on classic SES receipt rules staying available. The check is in the acceptance conditions.
- Whether SES keeps any copy of a message after delivery to S3 is not yet confirmed, and ADR-0007 cannot make a deletion claim until it is.

### Cost of the choice

Operational: DNS records for receiving, DKIM, SPF, the MAIL FROM name and DMARC, bounce and complaint handling, and watching sending reputation, all of which the project owns. It also commits the project to AWS for mail before the deployment ADR is written, though the vision already assumes AWS. Reversing the choice later means a new receiving path and a new consent notice naming a new processor. Ingestion sits behind the parser boundary (ADR-0002), so the user-facing change is small, but the message handling and the DNS move with the provider.
