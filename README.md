# Nomidat

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
pnpm db:migrate
pnpm db:seed
pnpm dev
```

The browser defaults to `http://localhost:3000`, with API requests at `http://localhost:3001/api/v1`. Set `VITE_API_URL`, `WEB_ORIGIN`, `BETTER_AUTH_URL` and `API_PORT` together if changing ports. Register through the browser, create a business and begin adding records. No sample records are inserted into business workspaces.

`pnpm db:seed` installs 50 default expense categories and can be rerun safely. Apply all committed migrations, including the channel-user association and default-category uniqueness migrations. Existing channel links without a linking user must be linked again.

## Access and provider setup

Owners, admins and managers can change business records. Staff and members can read them. Only owners/admins can save payment credentials or manage members; an admin cannot grant the owner role. Every request checks current organization membership, including messages received through linked channels.

Copy configuration names from `.env.example`:

- Set `BETTER_AUTH_SECRET` to a strong persistent secret.
- Generate `ENCRYPTION_KEY` with `openssl rand -hex 32`, then save each business's Paystack secret through Settings. Keep this encryption key backed up; changing it prevents decrypting existing credentials.
- Configure OpenAI for chat/transcription; Anthropic and Deepgram are optional fallbacks.
- Configure Telegram bot credentials and its webhook secret. Set the Mini App URL to the publicly reachable HTTPS `/mini-app` route.
- Configure WhatsApp Cloud API credentials, verification token and app secret. Webhooks fail closed when their verification secrets are absent. Telegram accepts private bot chats only.
- Configure ZeptoMail to deliver invoice attachments and invitations.
- For document delivery, set `BETTER_AUTH_URL` to the public API URL. Signed document links expire after one hour. `INVOICE_STORAGE_DIR` must point to private, persistent storage; it is never exposed as a static directory.

WhatsApp invoice documents require an active 24-hour conversation window; otherwise the API asks the recipient to message first. Owner payment notifications can use `WHATSAPP_TEMPLATE_NAME`, which must name an approved template matching the payment message parameters. WhatsApp Flows are not implemented.

Reconciliation runs at midnight Africa/Lagos in the API process. Run a continuously available API instance for this schedule. Database locks protect payment posting across instances. Notification delivery is retryable and at least once; a crash after provider acceptance can cause a repeated notification.

## Verification

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm fallow:audit
```

Integration checks require a built, running API connected to a **disposable** PostgreSQL database. They create test accounts and records, so never point them at production:

```bash
TEST_API_URL=http://localhost:3018/api/v1 \
TEST_WEB_ORIGIN=http://localhost:3017 \
TEST_DATABASE_URL=postgresql://postgres:password@localhost:55439/nomidat_test \
pnpm test:integration
```

The database name must end in `_test` for the confirmation checks. The API must use the same database and allow the supplied web origin.

Verified locally: migrations and idempotent category seeding, unit tests, browser inventory creation, responsive layout, tenant and role isolation, financial totals, partial payments, stock protection, PDF generation, and confirmation/cancellation/expiry/concurrency behavior. Provider-fallback tests use mocked HTTP responses.

Remaining validation: live Paystack callbacks/reconciliation, actual Telegram Mini App authentication and delivery, WhatsApp templates/delivery, ZeptoMail delivery, Nigerian-accent transcription accuracy and an SME pilot. Fallow still reports complexity/duplication findings; its CI gate remains enabled. This implementation is not a clean Fallow audit or a production pilot sign-off.

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
There is no production test code or verification bypass. The integration test injects
a delivery fake into an isolated Better Auth instance; it sends no real SMS.
Phone OTPs expire after five minutes and allow three failed attempts. Phone endpoints
use Better Auth's rate limiter. Configure trusted proxy/IP forwarding and shared rate
limit storage before deploying multiple API instances.

Staff keeps view access to all business records and reports. Owners/admins may
add editing permissions for inventory, sales/payments, expenses, invoices, contacts,
and channel management. These are enforced by the API and chat confirmation flow,
including WhatsApp/Telegram. They do not grant staff administration, business-profile
editing, payment-key management, or ownership rights. Manager/admin roles retain their
existing broader permissions; choose Staff for a restricted combination.

Run the additive database migration before starting the updated API:
`pnpm db:migrate`. For the isolated lifecycle/permission integration check, set
`TEST_API_URL`, `TEST_DATABASE_URL` (database name must end in `_test`) and
`TEST_AUTH_SECRET` to match the test API, then run
`node apps/api/test/phone-permissions.mjs`.

Inventory now supports product cost, description and editable SKU. Reports support
custom inclusive dates and selectable top-product/customer result counts. Business
creation and handle edits show an availability hint; saving remains authoritative.
