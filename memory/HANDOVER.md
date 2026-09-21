# Kotson Mattress — handover

**Staging URL:** https://sleep-build-1.preview.emergentagent.com
**Credentials:** `memory/test_credentials.md` · **Spec:** `memory/SPEC.md` · **Env template:** `backend/.env.example`
**Seed:** `cd /app/backend && python seed.py` (idempotent; every product carries `is_seed: true`)

## Declared deviations from the brief
1. **Stack** — the brief asked for a TypeScript full-stack framework + PostgreSQL + SSR. This pod template is
   **FastAPI + MongoDB + Vite SPA**, so the build uses it. Consequences handled explicitly:
   - No SQL transactions → stock safety uses single-document **atomic conditional updates** (`$expr`-guarded `$inc`)
     for reservation and a guarded `pending → paid` transition for finalization. Two concurrent last-unit checkouts
     cannot both reserve; retries/duplicate webhooks cannot double-allocate.
   - No SSR → SEO is handled with per-page `<title>`/meta, canonical URL, `/api/seo/sitemap.xml` built from live
     records, and JSON-LD product data injected from the actual product record.
   - No migrations directory → schema is enforced by Pydantic models + `INDEXES` in `backend/lib/db.py` (unique on
     sku, slug, order_number, referral_code, webhook event id, reward ledger key).
2. **Media storage** — no object store is wired; the asset registry stores URLs per slot. Bulk upload needs a storage
   provider decision.
3. **Shopify migration** — the mapping/import tooling is **not built**: it requires an authorized Shopify export
   (see owner inputs). No checkout path depends on Shopify. Status: `BLOCKED`.

## Acceptance gates — status
| Gate | Status |
|---|---|
| Guest cart persists (cookie `ks_cart`), repriced server-side each read | PASS |
| Sign-in merges guest cart, quantities summed, capped to free stock | PASS (toast "1 cart item(s) merged" observed) |
| Unique referral code minted per customer + link in dashboard | PASS |
| Deep-link attribution `/r/<code>` + prefilled signup, manual override before confirm | PASS (implemented; browser-verified for landing/persist) |
| Safe zero-value referral until a rule is published | PASS (no rules seeded → `no_published_rule`) |
| Self-referral / invalid code rejected server-side | PASS |
| Server recalculates all amounts; browser sends only ids/qty/address/referral | PASS |
| Stock reservation + 15-min expiry + background sweeper | PASS |
| Concurrent last-unit allocation impossible | PASS by construction (atomic guard) — needs a load test for evidence |
| Webhook raw-body verification + event dedupe + idempotent finalize | PASS (code path); `BLOCKED` for live evidence — needs test keys |
| Razorpay end-to-end test payment + failed payment | **BLOCKED** — no test keys yet; checkout shows explicit pending state, no payment faked |
| Captured payment with unallocatable stock escalates, blocks fulfilment | PASS (`stock_exception` + refund path) |
| Manager cannot cancel/refund; unpaid order cannot be fulfilled | PASS (409 observed) |
| Customer sees only own orders; cross-role denials | PASS (401/403 observed) |
| CMS draft → publish → rollback | PASS |
| Claims cannot publish without approved evidence | PASS |
| Responsive 375 / 768 / 1280 + keyboard + reduced motion + WebGL fallback | PASS (375 & 1280 browser-verified) |
| 3D drag/auto-rotate/staggered assembly | PASS |

## Outstanding owner inputs (blocking public launch)
1. **Razorpay test credentials** — `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` into
   `backend/.env`, then `sudo supervisorctl restart backend`. Webhook URL to register:
   `https://<host>/api/checkout/webhook` (events: `payment.captured`, `payment.failed`, `order.paid`).
2. **Official logo — SUPPLIED AND IN USE.** The wordmark is a transparent crop taken directly from the supplied
   brand file (`frontend/public/brand/kotson-wordmark.png`, 1601×184, original colours and letter shapes intact,
   TM/"NATURALS"/dot/tagline excluded). It renders in the desktop header, mobile header and footer. Still optional:
   a dedicated reversed/mono variant for dark surfaces — the footer currently uses a light plaque behind the mark.
3. **Font files** — **Kellion Black** and **Red Hat Display Light** were not supplied. Current fallbacks: **Outfit**
   (display) and **DM Sans** (body). Supply licensed web files or approve the fallback.
4. **All imagery/video** — 29 named asset slots exist as labelled placeholders (hero, 4 categories, 4 materials,
   zone-overview + zone-01..07, process-01..04, cert-logo-gols, shark-tank-video, 3 testimonial thumbs, product
   galleries). Provide filename → slot → alt text. **The navbar's four category thumbnails read live from slots
   `category-mattress`, `category-pillow`, `category-topper`, `category-babykids`** — publishing those four in
   `/admin/assets` swaps the navbar images with no code change.
5. **Claim evidence** — GOLS certificate, "one of five in India" substantiation, Shark Tank episode proof, plus exact
   **100-night trial**, **10-year warranty** and **free shipping** terms and coverage. All six claims currently render
   as "owner verification pending".
6. **GST rate + invoicing details** and **shipping charges/coverage** — both `pending_configuration`; nothing inferred.
7. **Policy page terms** — shipping, returns/trial, privacy, terms are unpublished drafts.
8. **Referral & affiliate economics** — value, eligible products, min spend, expiry, caps, commission basis and T&Cs.
   Until published: 0 discount, 0 commission.
9. **Dealer terms** — margins/price lists, credit limits, minimum quantities, tax treatment, online-pay vs invoiced.
   All dealer lines are quote-only until set.
10. **Mail provider** — domain + credentials for transactional email (currently `pending_provider`; on-site status works).
11. **Shopify export** (products, variants, customers, order history, redirects) for the migration mapping report.
12. **Analytics ID + consent copy**, and explicit **DNS/live-key approval** (not enabled by this deployment).

## Route & permission matrix
| Route | Access |
|---|---|
| `/`, `/collections`, `/collections/:category`, `/products/:slug`, `/cart`, `/checkout`, `/order/confirmation/:id`, `/track-order`, `/about`, `/faq`, `/contact`, `/policies/:slug`, `/r/:code` | public (guest checkout supported) |
| `/login`, `/register` | public |
| `/account` | authenticated customer — own data only |
| `/admin/**` | owner, admin (staff invites: **owner only**) |
| `/manager/**` | owner, admin, manager (fulfilment + recount only) |
| `/crm/**` | owner, crm_master, crm_manager, crm_employee (employee = assigned records only) |
| `/dealer` | authenticated; own dealer org only |
| `/api/admin/**`, `/api/crm/**`, `/api/dealer/**` | server-side role + row-scope checks on every request; all privileged mutations audited |

No role — including owner — can view payment secrets in the UI; only masked integration state is exposed.

## Increment F/G/H feature status (this session)

| Scope item | Status | Evidence |
|---|---|---|
| Source-event intake (signup / cart / checkout / contact) | IMPLEMENTED | 1 signup -> 1 lead; 3 logins -> still 1; 3 add-to-cart -> 1 cart opportunity |
| Guest cart never becomes a callable lead | IMPLEMENTED | lead count unchanged after anonymous add-to-cart |
| Paid-order conversion, exactly once | IMPLEMENTED | idempotent on `event_key=paid_order:<id>` |
| Pipelines, campaigns, Owner intake queue, assignment lineage | IMPLEMENTED | intake pipeline w/ 7 stages; bulk assign records prev/new owner + reason |
| Stage-change invariant | IMPLEMENTED | stage `quote_shared` unchanged after saving a call (API + browser) |
| Disposition centre (Connectivity/Dispositions/Outcomes/Form) | IMPLEMENTED | `/crm/dispositions`, legacy `/crm/call-configuration` redirects to same view |
| Draft-only call options until owner approval | IMPLEMENTED | all seeded inactive; save rejected 422 until activated |
| Call validation rules | IMPLEMENTED | Connected+Not Answering 422; Call Done w/o outcome 422; missing required field 422; `false`/`0` accepted |
| Call idempotency (no duplicate call or reminder) | IMPLEMENTED | same `idempotency_key` -> 1 call, 1 follow-up |
| Follow-up buckets in IST; completion never moves stage | IMPLEMENTED | "22 Sep 2026, 10:00 AM IST" in upcoming bucket |
| CRM reports w/ stated denominator; ad metrics honest | IMPLEMENTED | ad_spend/impressions/roas = `not_connected` |
| Row-level scope + IDOR denial | IMPLEMENTED | employee: 0 rows, 403 on unassigned lead, 403 team report, blocked from /ops |
| Dispatch: unpaid cannot ship | IMPLEMENTED | 409 "Only a verified paid order can be dispatched" |
| Partial shipment + over-ship prevention | IMPLEMENTED | qty 5 of 2 -> 409; 1-of-2 keeps order `processing` |
| Shipment milestones + order roll-up | IMPLEMENTED | dispatched -> in_transit -> out_for_delivery -> delivered |
| Manual courier labelling (no false live tracking) | IMPLEMENTED | `tracking_is_manual: true`; customer note states it |
| Returns/trial/warranty; CRM raises, owner approves, restock once | IMPLEMENTED | CRM raise 201, CRM approve 403, stock 9->10, double restock refused |
| Customer tracking privacy | IMPLEMENTED | wrong email -> 404, no data leak |
| Telephony (recording/duration) | BLOCKED (by choice) | manual logging only; `verified_telephony` always false |
| Razorpay live/test payment | BLOCKED | no keys; KS09001 is a seeded `is_seed` fixture, NOT a real payment |
| Workforce (attendance/leave/payroll), Website Studio (pages/banners/redirects) | NOT PRESENT | agreed for the next session |

New routes: `/crm/{leads,leads/:id,intake,follow-ups,cases,dispositions,reports}`, `/ops`, `/ops/returns`.
New collections: source_events, leads, pipelines, campaigns, follow_ups, calls, connectivities,
dispositions, call_outcomes, engagement_forms, service_cases, shipments, return_requests.
Seed commands: `python seed.py` (catalog/accounts), `python seed_crm.py` (CRM config drafts).
