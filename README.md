# Nomidat

> Phase-by-phase status, and what is not yet verified: [`PHASES.md`](PHASES.md).

Architecture and invariants: [`ARCHITECTURE.md`](ARCHITECTURE.md). Domain
vocabulary: [`CONTEXT.md`](CONTEXT.md). Binding rules for agents:
[`AGENTS.md`](AGENTS.md).

## Commands

```bash
pnpm install
pnpm db:up && pnpm db:migrate
pnpm dev

pnpm lint && pnpm test && pnpm typecheck && pnpm build
pnpm fallow:audit
```

A NestJS, PostgreSQL and React workspace for small-business inventory, sales, expenses, contacts and invoices. The browser dashboard and Telegram Mini App share the same screens and organization-scoped API.

## Implemented workflows

- Overview with recorded sales, expenses, outstanding balances and low-stock information.
- Inventory creation, editing, archiving/restoring and stock adjustments; sales reject insufficient stock.
- Contacts and leads, conversion to customers, notes and client folders containing orders, invoices and balances.
- Multi-item sales with discounts, tax and partial payments; subsequent payments and invoices from sales.
- Expenses with default and business-specific categories; invoice creation, private PDF storage, download and email/linked-channel delivery.
- Persisted AI chat with validated actions, primary/fallback providers and server-enforced confirmation before writes. Repeated confirmation cannot execute the same action twice.
- Browser microphone recording with transcript review, plus Telegram/WhatsApp voice-note transcription.
- Per-business encrypted Paystack credentials, signed webhooks, idempotent payment posting, owner notifications and nightly reconciliation.

The UI includes loading, error, empty and read-only states, mobile layouts and paginated record lists. Search and filters operate on the displayed page. Product/contact selectors currently load the first 50 records.

## Local setup

Use Node 24+ and the pnpm version declared in `package.json`.

```bash
pnpm install
cp .env.example .env
pnpm db:up
docker compose exec -T postgres sh -c 'createdb -U "$POSTGRES_USER" nomidat_test'
pnpm db:migrate
pnpm db:seed
pnpm dev
```

`pnpm db:migrate` applies the migrations to the development database and then to
the one named by `TEST_DATABASE_URL`, so both have to exist first. The `createdb`
line creates the second one; run it once.

The browser defaults to `http://localhost:3000`, with API requests at `http://localhost:3001/api/v1`. Set `VITE_API_URL`, `WEB_ORIGIN`, `BETTER_AUTH_URL` and `API_PORT` together if changing ports. Register through the browser, create a business and begin adding records. No sample records are inserted into business workspaces.

`pnpm db:seed` installs 50 default expense categories and can be rerun safely. Apply all committed migrations, including the channel-user association and default-category uniqueness migrations. Existing channel links without a linking user must be linked again.

## Access and provider setup

Owners, admins and managers can change business records. Staff and members can read them. Only owners/admins can save payment credentials or manage members; an admin cannot grant the owner role. Every request checks current organization membership, including messages received through linked channels.

Copy configuration names from `.env.example`:

- Set `BETTER_AUTH_SECRET` to a strong persistent secret.
- Generate `ENCRYPTION_KEY` with `openssl rand -hex 32`, then save each business's Paystack secret through Settings. Keep this encryption key backed up; changing it prevents decrypting existing credentials.
- Choose chat with `AI_PROVIDER=openai|gemini` and configure the corresponding key/model. Anthropic remains an optional fallback. Picture extraction still uses OpenAI.
- Choose speech with `TRANSCRIPTION_PROVIDER=deepgram|whisper|openai` (default: Deepgram). Set `DEEPGRAM_API_KEY`/`DEEPGRAM_MODEL` or `WHISPER_API_KEY`/`WHISPER_MODEL`. The `openai` option retains `OPENAI_TRANSCRIPTION_MODEL` and optional Deepgram fallback.
- Configure Telegram bot credentials and its webhook secret. Set the Mini App URL to the publicly reachable HTTPS `/mini-app` route.
- Configure WhatsApp Cloud API credentials, verification token and app secret. Webhooks fail closed when their verification secrets are absent. Telegram accepts private bot chats only.
- Configure ZeptoMail to deliver invoice attachments and invitations.
- For document delivery, set `BETTER_AUTH_URL` to the public API URL. Signed document links expire after one hour. `INVOICE_STORAGE_DIR` must point to private, persistent storage; it is never exposed as a static directory.

WhatsApp invoice documents require an active 24-hour conversation window; otherwise the API asks the recipient to message first. Owner payment notifications can use `WHATSAPP_TEMPLATE_NAME`, which must name an approved template matching the payment message parameters. WhatsApp Flows are not implemented.

Reconciliation runs at midnight Africa/Lagos in the API process. Run a continuously available API instance for this schedule. Database locks protect payment posting across instances. Notification delivery is retryable and at least once; a crash after provider acceptance can cause a repeated notification.

## Verification

```bash
pnpm lint && pnpm test && pnpm build && pnpm typecheck
pnpm fallow:audit
```

`pnpm test` runs every suite. The unit files need no database: money formatting
and rounding in both tiers, stock balance and unit-conversion arithmetic, POS
cart arithmetic, timing-safe secret comparison, the conversational action review,
and storefront theme sanitisation. The end-to-end files that need a database
skip themselves unless `TEST_DATABASE_URL` is set, so the command still runs on
a machine with no database.

### End-to-end tests

The money and stock invariants live in SQL and in transaction boundaries, so
they are tested against a real PostgreSQL rather than a stub — a stubbed
database would have passed while a withdrawal raised the balance.

`pnpm db:migrate` has already applied the migrations to the test database (see
Local setup). Run the suite with:

```bash
pnpm test
```

Every suite that writes to the database refuses a database name that does not end
in `_test`, because it creates and deletes rows. No API server is needed, and
there are no `TEST_API_URL`, `TEST_WEB_ORIGIN` or `TEST_AUTH_SECRET` variables:
each suite drives the owning service against the database directly.

CI runs the same files in the `e2e` job of `.github/workflows/ci.yml`, against a
`postgres:18` service, so a change that breaks a money path fails before merge.
Run them locally as well, before touching money or stock code.

### What is actually verified

End to end against PostgreSQL, in `apps/api/test`:

- `sales-journey`, `pos-sale`, `pos-quantity` — the stock ledger, refusal of
  insufficient stock, credit and partial payments, refusal of overpayment,
  offline till replay, and fractional quantities.
- `schema-invariants` — the constraints the database itself enforces, including
  the decimal quantity bounds.
- `org-context-guard`, `staff-boundary` — who may reach a route and which
  business's records they reach.
- `contact-edit`, `expense-category`, `invoice-edit`, `invoice-offer`,
  `transfer-cancel`, `member-profile` — what each area can change, archive,
  refuse and undo, and that another business cannot touch it.
- `wallet` — withdrawal atomicity, platform fee arithmetic, a refused withdrawal
  that restores the funds once, and two requests racing for the same balance.
- `inbound-replay`, `webhook-events`, `payment-announcement` — a provider
  redelivering an update, an endpoint receiving only the events it asked for, and
  a payment reaching the inbox and a subscription exactly once.
- `auth-rate-limit` — the auth and inbound budgets, counted per address and per
  tenant.

Verified by hand rather than by the suite: browser inventory creation, responsive
layout, invoice PDF generation, and the chat confirmation flow's cancellation,
expiry and concurrency behaviour.

Remaining validation: live Paystack callbacks and reconciliation, actual Telegram
Mini App authentication and delivery, WhatsApp templates and delivery, ZeptoMail
delivery, Nigerian-accent transcription accuracy and an SME pilot.

### Recording from pictures

Sales, Inventory, Expenses and Invoices have an **Upload picture** action. JPEG, PNG and WebP files up to 10 MB are sent to the configured OpenAI model for extraction. Set `OPENAI_API_KEY` and use an image-capable `OPENAI_MODEL` in the API environment. Pictures are processed in memory and are not stored by Nomidat.

Extraction creates a draft only. Review quantities, unit prices and names before saving. Sales use the existing sale form: explicitly choose inventory products to deduct stock, and review customer, payment, tax and discount. Inventory reviews each image item separately; create a new product or add a quantity to existing stock. Saved items stay saved if the remaining review is cancelled. Missing values stay blank, and inventory purchase costs are not used as selling prices.

`POST /api/v1/organizations/:organizationId/picture-import` accepts multipart `picture` and `purpose` (`sales`, `inventory`, `expenses` or `invoices`). It requires write access, validates file signatures and size, and returns validated draft items and warnings. AI output cannot select tenant or product IDs or save records. Provider failures leave records untouched.

Expense picture uploads accept one receipt or bill per image and return one editable expense total, description, transaction date, suggested category and payment method. Missing facts remain blank. Suggestions only select an exact category-name match from the current business; the user can change it. No expense is recorded until Save record is pressed.

Invoice uploads extract line items plus the billed customer name, due date, tax, discount, printed total and notes. Users explicitly choose a contact, fill missing values and confirm their review. A total mismatch is shown for correction. Saving creates a new invoice with a new number and current issue date; it does not record payment, replace an existing invoice or send it to anyone.

Ask Nomidat also supports picture attachments via the paperclip beside the microphone. Writers choose Expense, Sale, Invoice or Inventory, then read and review the picture using the same authenticated import flow. The composer preserves typed text while the separate picture review is open. Pictures are not saved in chat history; no provider call occurs until Read picture, and no record changes until Save.

### Photos inside WhatsApp and Telegram

Use the native camera or attachment button in a linked private bot chat. Caption the photo `expense`, `sale`, `invoice` or `inventory` (natural phrases containing one of these also work). The bot extracts facts and replies in that same chat with a review and expiring `CONFIRM <id>` / `CANCEL <id>` instructions. It does not send a browser review link or save records before confirmation. Uncaptioned pictures prompt for a caption and resend. Supported media: JPEG/PNG/WebP, 10 MB maximum with streamed download limits.

Inventory photos create one new product at a time, with visible quantity and selling price or a follow-up correction. Multi-line sales are reviewed as custom items without stock deduction; the review states this explicitly. Sales default to unpaid until corrected and confirmed. Up to 10 invoice/sale lines fit a channel review. Live operation requires the channel credentials/webhooks and `OPENAI_API_KEY`; provider tests are mocked locally.

## Phone staff invitations and custom permissions

Settings → Staff & permissions → Invite staff by phone number creates a seven-day
invitation using an international number such as `+2348012345678`. Copy the sign-in
link and share it with the recipient. Invitations do not send an SMS automatically.
The recipient chooses phone sign-in, receives an SMS code, then accepts the invitation
under Settings → Your account & invitations. No email account is required.
Existing members keep their current role when accepting another invitation.

Set `TERMII_API_KEY`, `TERMII_SENDER_ID` and the dashboard's `TERMII_BASE_URL` in
`.env`, then restart the API. The sender must be enabled for transactional/DND
messages. See [Termii's API documentation](https://developers.termii.com/).
There is no production test code or verification bypass.
Phone OTPs expire after five minutes and allow three failed attempts. Phone endpoints
use Better Auth's rate limiter. Configure trusted proxy/IP forwarding and shared rate
limit storage before deploying multiple API instances.

Staff keeps view access to all business records and reports. Owners/admins may
add editing permissions for inventory, sales/payments, expenses, invoices, contacts,
and channel management. These are enforced by the API and chat confirmation flow,
including WhatsApp/Telegram. They do not grant staff administration, member-profile
editing, payment-key management, or ownership rights. Manager/admin roles retain their
existing broader permissions; choose Staff for a restricted combination.

Run the additive database migration before starting the updated API:
`pnpm db:migrate`.

There is no automated coverage for the OTP lifecycle: it was verified by hand
against an isolated Better Auth instance with a delivery fake, which sends no real
SMS. Staff permission boundaries are covered end to end by
`apps/api/test/staff-boundary.e2e.ts`.

Inventory now supports product cost, description and editable SKU. Reports support
custom inclusive dates and selectable top-product/customer result counts. Business
creation and handle edits show an availability hint; saving remains authoritative.
