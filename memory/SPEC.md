# Kotson Mattress — living spec

**Entity:** KOTSON NATURALS PRIVATE LIMITED, trading as KOTSON MATTRESS. INR only (integer **paise** everywhere).
**Stack:** FastAPI + MongoDB (motor) backend on `/api`; Vite + React 19 + TS strict + Tailwind v4 + shadcn/ui frontend.
Public URL: http://localhost:3000 / https://kotsonmattress.com

> Note on the brief: the prompt requested a TypeScript full-stack framework with PostgreSQL. This pod template is
> FastAPI + MongoDB, so the build uses it with document-level atomic guards in place of SQL transactions (see
> "Stock safety" below). This is a **declared deviation**, not an oversight.

## What the app does
Storefront (browse → variant select → cart → server-priced checkout → Razorpay test mode → order tracking) plus four
back-office consoles (`/admin`, `/manager`, `/crm`, `/dealer`), a referral/affiliate system, CMS with draft/publish/rollback,
an evidence-gated trust-claim system and a named asset-slot registry.

## Data model (Mongo collections)
`users` (roles[], referral_code unique sparse), `sessions` (TTL), `categories`, `products` (soft `is_active`, `is_seed`),
`variants` (sku unique, `stock`, `reserved`), `inventory_ledger`, `carts` (guest token or user_id), `orders`
(immutable item + address + amount snapshots, separate `payment_status` / `fulfilment_status`), `reservations`,
`refunds`, `blocks` (+revisions), `claims`, `assets`, `settings`, `inquiries`, `crm_notes`, `dealers`, `dealer_orders`,
`referral_rules`, `referral_clicks`, `referral_attributions`, `reward_ledger` (append-only, unique on order+code+type),
`processed_events` (webhook dedupe), `audit_log`, `counters` (order numbers `KS00001`).

## Key flows
1. **Cart** — guest cookie `ks_cart` or user cart; repriced from active variants on every read; merged deterministically at
   sign-in with quantities summed and capped to free stock.
2. **Checkout** — browser sends only ids/qty/address/referral. Server recomputes subtotal/discount/tax/shipping, reserves
   stock atomically, creates the Razorpay order for the server-calculated amount.
3. **Payment** — signature verified (HMAC SHA256) + independent provider fetch of amount/currency/status. Webhook verified
   against the **raw body**, event ids deduped. `finalize_order` is a guarded `pending → paid` transition, so retries,
   duplicate webhooks and a lost browser callback can never double-allocate stock or double-accrue rewards.
4. **Stock safety** — reservation is a single atomic `$expr`-guarded `$inc` on the variant, so two concurrent last-unit
   checkouts cannot both reserve. A background sweeper (60 s) releases expired reservations. Captured payment with
   unallocatable stock sets `stock_exception` + `fulfilment_blocked` and requires a documented refund path — never a silent
   cancel or oversell.
5. **Referrals** — `/r/<code>` records consent-aware click attribution, persists the code through guest browse/cart, prefills
   signup (manual override allowed before confirmation only). Safe default is **0 discount / 0 commission** until the owner
   publishes a rule. Self-referral and invalid codes are rejected server-side.

## Roles (enforced server-side in `lib/security.py`)
`owner` everything · `admin` catalog/inventory/orders/CMS/settings (no staff roles) · `manager` fulfilment transitions +
inventory recount only (no pricing/CMS/cancel/refund) · `crm_master`/`crm_manager` all CRM · `crm_employee` assigned
records only · `dealer` own org only · `affiliate`/`customer` own data only. Every privileged mutation writes `audit_log`.
No role sees payment secrets in the UI — only masked state.

## Explicit pending states (never faked)
Razorpay keys, mail provider, GST rate, shipping charges, all six trust claims (GOLS / 1-of-5 / Shark Tank / 100-night /
10-year / free shipping), every asset slot incl. logos, dealer terms, referral economics, policy page terms.

## Seed data
`cd /app/backend && python seed.py` — idempotent. 10 products across Mattresses/Pillows/Toppers/Baby+Kids with variants,
SKUs, INR prices and stock (incl. deliberate out-of-stock and low-stock rows), 36 CMS blocks, 6 draft claims, 29 asset
placeholders, 5 accounts (see `memory/test_credentials.md`). All products carry `is_seed: true`.

## Navbar (visual category navigation)
- `components/layout/LogoMark.tsx` — official wordmark, a transparent crop of the supplied brand file at
  `public/brand/kotson-wordmark.png` (1601×184). Original letter shapes, integrated leaf and colours are unmodified;
  TM, "NATURALS", the green dot and the tagline are excluded. **Never recreate this mark with a font.**
  Sizes: `h-5` (<640px) → `h-7` (sm) → `h-8` (lg). `light` prop puts it on a sand plaque for the dark footer.
- `components/layout/CategoryNav.tsx` — `CategoryNavDesktop` (image above label) and `CategoryNavMobile`
  (image beside label, full-width rows). `CATEGORY_NAV` maps route slug → asset registry slot:
  mattresses→category-mattress, pillows→category-pillow, toppers→category-topper, baby-kids→category-babykids.
  Thumbnails are read from `GET /api/content/assets`; a slot renders its image only when `status === "published"`,
  otherwise a correctly-sized labelled placeholder holds the same aspect ratio. Owner replaces images from
  `/admin/assets` with **no navbar code change**.
- `GET /api/content/assets` returns every slot (placeholder + published) so the storefront can render labelled
  placeholders; only `published` slots ever supply renderable media.
- About Us and FAQ stay plain text links, deliberately lighter than the category tiles. Cart/account/track remain
  in the header; Track collapses into the mobile menu below 640px to prevent horizontal overflow.
- Desktop tiles are a uniform 84×100 with 64×56 thumbs; mobile rows are 72px tall (≥44px tap targets). Hover, focus
  (2px brand-leaf ring) and selected (tinted tile + leaf underline) states are distinct. Verified: no horizontal page
  scroll at 375/768/1280, and all six links resolve — 4 categories, /about, /faq.

## CRM intake, calls & order operations (Sections F/G/H)
**Authoritative rule change:** signup AND add-to-cart DO create CRM leads (supersedes the earlier
"registration must not create a lead"). Stack conflict resolved in favour of the existing build:
MongoDB stays; the PostgreSQL suggestion is not a migration instruction.

### Intake (`backend/lib/crm_intake.py`) — the only place events become leads
- `source_events.event_key` is UNIQUE = the idempotency/dedup anchor.
- Verified signup -> exactly ONE `registration` lead, qualification `registered` (NOT sales-qualified).
- Add-to-cart by an identified customer -> at most ONE open `cart_opportunity`; further adds, quantity
  changes and checkout-started UPDATE it. Guests are recorded but never become callable leads.
- Contact/dealer enquiry -> sourced `sales`/`dealer` lead. Only a verified PAID order converts (once).
- Dedup: customer_id first, then conservative normalized email/phone. Guest events merge at sign-in.

### Leads/calls (`routers/crm_leads.py`, `routers/crm_calls.py`)
- Stage moves ONLY via `POST /api/crm/leads/{id}/stage` (reason mandatory) or paid-order conversion.
  Saving a call or completing a follow-up NEVER changes a stage. Converted leads are stage-locked.
- Scope: owner/crm_master = all; crm_manager = own + team (`users.crm_manager_id`); crm_employee = assigned only.
  Applied to lists, detail, aggregates and reports alike.
- Call save order enforced server-side: connectivity -> disposition (must belong to it) -> outcome (only
  when `requires_outcome`) -> active engagement form -> optional summary -> optional follow-up.
  `false` and `0` are VALID answers; only null/whitespace/empty-list is missing.
  `idempotency_key` unique per lead; retry returns the original call and creates no second reminder.
  `verified_telephony` is always false — manual logging, no provider.
- Call config seeded by `python seed_crm.py` as INACTIVE DRAFTS. `configured` reflects ACTIVE rows only;
  with nothing active, saving a call is correctly rejected (honest empty state).
- Reports state their conversion denominator; ad spend/impressions/ROAS = `not_connected`. IST day bounds.

### Order operations (`routers/fulfilment.py`)
- Unpaid orders cannot dispatch (409). Partial shipments supported; never ship more than ordered.
- Shipment status roll-up drives order fulfilment; payment history untouched. Tracking URLs validated.
- `tracking_is_manual` always true — no courier API; customer tracking says so explicitly.
- Returns/trial/warranty: CRM may RAISE a request; only owner/admin approve, and restock happens once,
  only from `inspected`, writing an inventory-ledger entry.
- Routes: `/ops` (dispatch queue), `/ops/returns`. Customer view: `GET /api/ops/track/{order_number}?email=`.

**Staging fixture:** order `KS09001` is a seeded PAID order (`is_seed: true`) so dispatch flows are
testable while Razorpay keys are absent. It is NOT a real payment.

## Video hero + announcement bar (owner-editable)
Page order is now: **announcement bar → navbar → full-width video hero → unchanged sections**.

### Video hero (`components/home/VideoHero.tsx`, `routers/site_media.py`)
- The old hero (headline, paragraph, CTAs, 3D mattress, layer tabs, stat cards) is **deleted**;
  `MattressAssembly3D`/`HeroFallback` are no longer imported by Home.
- Owner supplies a YouTube URL in Website Studio. The server extracts the 11-char id
  (`extract_youtube_id`) and builds the embed itself — **raw iframe HTML is rejected (422)**, as are
  non-YouTube hosts and `javascript:` payloads. watch?v=, youtu.be, /embed/, /shorts/, /live/ and a
  bare id all parse.
- Embed params: `autoplay=1&mute=1&loop=1&playlist=<id>&playsinline=1`. Autoplay is only ATTEMPTED —
  a visible play button always renders, so it is never presented as guaranteed.
- 16:9 aspect box + `object-contain`: full frame preserved edge-to-edge at 1440 and 375 (verified
  aspect 1.778/1.777, full-bleed, no sideways scroll).
- Poster precedence: owner poster → the video's own YouTube thumbnail (`maxresdefault.jpg`) → labelled
  placeholder. Reduced-motion visitors get the poster first and the iframe mounts only on click.
- Endpoints: `GET /api/content/hero-video`, `GET|PUT /api/admin/hero-video`.

### Announcement bar (`components/layout/AnnouncementBar.tsx`)
- Seamless loop: list rendered twice, translated exactly `-50%` (`.marquee-track` in index.css), so no jump.
- Fixed `h-9` reserved even before data loads, so the navbar and video never shift.
- Pauses on hover AND `:focus-within`; `prefers-reduced-motion` disables the animation entirely.
- Links may be internal paths or http(s) only — other schemes rejected (422). Keyboard + touch operable.
- New messages default to **disabled**; enabling is the owner's approval to publish. Website Studio warns
  when a message's linked claim (e.g. `free_shipping`, `gols_organic`) is still draft/missing.
- Endpoints: `GET /api/content/announcements` (enabled only), `GET|POST|PATCH|DELETE /api/admin/announcements`.
