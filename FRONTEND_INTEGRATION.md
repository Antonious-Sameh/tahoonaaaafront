# Frontend ↔ Backend Integration (Phase 11) — ✅ COMPLETE

Phase 11 ("wire the frontend to the API") turned out to be large enough to
need its own sub-phases, the same way the backend did. All of them
(11a–11i) are done — this file is now a record of how it happened and what
trade-offs were made along the way, kept for whoever works on this project
next.

## Sub-phase 11a — API client + real authentication ✅ done

- **`src/lib/apiClient.js`** — a small `fetch`-based client. Handles the
  access/refresh token pair from the backend's Phase 3 auth design: the
  short-lived access token lives in memory only (gone on reload, by design);
  the refresh token persists in `localStorage`. A 401 mid-request triggers
  one automatic refresh-and-retry; concurrent requests during a refresh are
  de-duplicated into a single `/auth/refresh` call.
- **`src/lib/deviceId.js`** — generates and persists a `crypto.randomUUID()`
  once per browser, exactly matching the backend's device-limit design
  (never derived from IP/User-Agent).
- **`src/context/AuthContext.jsx`** — real login/logout/changePassword/
  device-list/revoke-device, backed by the actual API. On mount, if a saved
  refresh token exists, it silently exchanges it for a fresh session instead
  of forcing the password to be re-entered on every reload.
- **`src/pages/LoginPage.jsx`** — rewritten to call real `login()` instead of
  comparing against `state.settings.accessCode`. Visual design is untouched;
  only the submit handler and error handling changed. The demo-password hint
  ("123456") was removed — it referenced mock-only data that no longer
  applies once a real backend password exists.
- **`src/context/ShopContext.jsx`** — its old `isAuthed`/`login`/`logout`
  (a plain string comparison against mock `state.settings.accessCode`) were
  removed entirely, superseded by `AuthContext`. `ShopContext` now only
  holds the mock CRUD data functions, unchanged (see below).
- **`src/App.jsx`** / **`src/components/layout/AppLayout.jsx`** — route
  protection and the logout button now use `AuthContext` instead of the old
  mock auth.
- **`.env.example`** (backend) — fixed `CORS_ORIGINS` to default to this
  frontend's actual dev port (`3000`, from its `package.json`), not Vite's
  generic default (`5173`), which would have silently blocked every request.

**To actually run this against a real backend:** set `VITE_API_BASE_URL` in
this frontend's `.env` (defaults to `http://localhost:4000/api` for local
dev against the backend's own default port), and make sure the backend's
`CORS_ORIGINS` includes this frontend's origin.

## Sub-phase 11b — Products/Inventory page ✅ done

- **`src/services/api/products.js`** — thin wrapper matching
  `/api/products`'s routes exactly.
- **`src/hooks/useApiList.js`** — generic hook: fetches a paginated list from
  any `fetchFn(params)` matching the backend's `{ success, data, pagination }`
  shape, refetches when `params` changes, exposes `{ items, pagination,
  loading, error, reload }`. Built once here since every remaining data page
  needs the same pattern.
- **`src/components/shop/Pagination.jsx`** — shared prev/next pager, renders
  nothing for a single page. Added because the frontend previously had *no*
  pagination UI at all — it assumed the whole collection was already loaded
  in memory. This is a necessary UI addition, not a redesign: the backend's
  list endpoints are genuinely paginated for performance, so the frontend
  needs a control for moving between pages that didn't exist before.
- **`InventoryPage.jsx`** — search/filter/sort now query the server (backend
  computes them, matching the frontend's original logic exactly — see the
  backend's Phase 4 notes) instead of filtering an in-memory array; add/
  edit/delete call the real API and reload the current page on success; a
  loading state while fetching, and CSV export now fetches every matching
  page (up to a generous safety cap of 1,000 products) instead of only
  exporting whatever happened to be in memory.
- Real MongoDB documents use `_id`, not the mock's `.id` — `InventoryPage`
  now keys/references rows by `_id` throughout.

### Known temporary inconsistency (until later sub-phases)

`AppLayout`'s low-stock notification badge and the Dashboard page still read
`state.products` from the old mock `ShopContext` — they have **not** been
switched to the real API yet, so they can show different data than the now
API-backed Inventory page until their own sub-phase. This is an expected,
visible consequence of migrating one page at a time rather than all at once;
it resolves once the Dashboard/notification sub-phase lands.

## Sub-phase 11c — Customers & Suppliers pages ✅ done

- **`src/services/api/{customers,suppliers}.js`** — thin wrappers, same
  shape as `products.js`.
- **`src/services/api/{sales,purchases}.js`** — list-only for now (`listSales`/
  `listPurchases`), just enough for the detail pages' per-person history;
  each gets create/get-one when its own page is wired (11d/11e).
- **`src/services/api/reports.js`** — `getSuppliersReport` only, used by
  `SuppliersPage`'s stat cards (all-time count/outstanding/with-balance
  across *every* supplier, not just the current page — computed by the
  backend's Reports phase in one aggregation, not by summing a paginated
  list client-side).
- **`CustomersPage.jsx` / `SuppliersPage.jsx`** — search now queries the
  server; each row's total/paid/remaining/last-purchase comes from the
  backend's already-computed `totals` (no separate per-row calculation
  needed, unlike the old `customerTotals()`/`supplierTotals()` selectors).
  Clicking a row still navigates to the detail page, keyed by `_id`.
- **`CustomerDetailsPage.jsx` / `SupplierDetailsPage.jsx`** — fetch the
  person (with `totals` embedded) and their transaction history via
  `?customerId=`/`?supplierId=` in one call each. **Design choice:** fetched
  at the backend's max page size (100) in a single request rather than
  adding pagination UI to this page — keeps the page's design close to the
  original (which had no pager at all) while comfortably covering the scale
  this system targets; a person with over 100 transactions ever would only
  show the most recent 100 here. The printed statement uses this same
  100-item set (not a separate full-history fetch), for the same reason.
  A 404 from the API renders the existing "not found" empty state instead
  of crashing.

## Sub-phase 11d — Sales/POS + Sales History pages ✅ done

- **`src/services/api/sales.js`** — expanded with `getSale`/`createSale`.
- **`QuickAddProductModal.jsx`** — this needed to change *now*, not in a
  later sub-phase as originally guessed: it's used inline from POS to
  register a new product mid-sale, and POS is now real. If it kept calling
  the old mock `addProduct`, the "product" it handed back would have a mock
  `.id` the backend has never heard of, and adding it to a real cart would
  break `createSale`'s `productId` reference. It now calls the real
  products API directly.
- **`PosPage.jsx`** — the product picker searches the server (a generous,
  unpaginated batch of up to 40 results — POS is a "search then pick" flow,
  not a page-by-page catalog browse, so no pager UI here); the customer
  picker and the inline "add new customer" form both use the real customers
  API (fetched once, up to 100, same reasoning as the detail pages' history
  limit — a shop with more than 100 customers would only see the first 100
  in this quick-picker); completing a sale calls the real transactional
  `createSale` and refreshes the product grid afterward, since stock just
  changed. Cart items are keyed by the real `_id`, not the mock's `.id`.
- **`SalesHistoryPage.jsx`** — every filter (search, customer, payment
  method, date range) now queries the server, matching the backend's
  `/api/sales` filters exactly (built in the backend's Sales phase); added
  the `Pagination` control, since sales history can genuinely outgrow one
  screen.
- **Still mock on both pages:** `state.settings` (shop name/footer shown on
  the invoice) — the Settings API doesn't exist yet (see the gap noted
  below), so the printed/previewed invoice still shows mock shop info until
  that sub-phase lands.

## Sub-phase 11e — Purchases + Purchase History pages ✅ done

- **`src/services/api/purchases.js`** — expanded with `getPurchase`/`createPurchase`.
- **`PurchasesPage.jsx`** — supplier and product pickers now come from the
  real API (fetched once, up to 100 each, same reasoning as the customer
  picker in POS); `QuickAddProductModal` was already API-backed since 11d,
  so wiring "add product mid-purchase" here was just using it, no further
  changes needed there; saving calls the real transactional `createPurchase`
  (weighted-average cost recalculation and all, from the backend's
  Purchases phase) and navigates to the history page on success, matching
  the original behavior.
- **`PurchaseHistoryPage.jsx`** — same shape as `SalesHistoryPage.jsx`:
  every filter queries the server, matching `/api/purchases`'s filters
  exactly; added the `Pagination` control.
- **Still mock:** `state.settings` for the invoice preview, same gap noted
  in 11d, closes in the Settings sub-phase.

## Sub-phase 11f — Cashbox + Expenses pages ✅ done

- **`src/services/api/{cashbox,expenses}.js`** — thin wrappers matching
  `/api/cashbox` and `/api/expenses` (including their `/summary`
  sub-routes, built in the backend's Cashbox & Expenses phase).
- **`useApiList` hook extended** — now also exposes `extra`, any top-level
  response fields beyond `data`/`pagination` (e.g. the expenses list's
  `totalAmount`, summed server-side over *every* matching row, not just the
  current page). Backward-compatible — existing callers that don't
  destructure `extra` are unaffected; verified all four previously-wired
  pages still work after this change.
- **`CashboxPage.jsx`** — balance and today's in/out come from
  `/api/cashbox/summary` (computed by the backend in one aggregation, not
  derived from a paginated list client-side); the transaction table now
  queries the server for type/search filters and gained the `Pagination`
  control (the original had none — cashbox history can genuinely outgrow
  one screen, same reasoning as the Sales/Purchases history pages).
- **`ExpensesPage.jsx`** — today/month totals come from
  `/api/expenses/summary`; the "current filtered total" comes from the list
  response's `totalAmount` (summed over every matching row server-side, not
  just what's on screen); gained `Pagination` too.
- **Known trade-off:** the reason filter/datalist previously merged a
  static suggestion list with every distinct reason ever actually used
  (read from the full in-memory expense list) — with pagination, that
  full-history merge isn't available client-side anymore, so it now shows
  the static suggestions only. Deemed not worth a new backend endpoint just
  for this; still fully usable (free-text entry works exactly as before,
  it's just the autocomplete/filter options that lost the "previously
  used" enrichment).

## Sub-phase 11g — Reports page ✅ done

- **`src/services/api/reports.js`** — expanded with all six report
  endpoints (sales, purchases, profit, inventory, customers, suppliers),
  matching the backend's Reports phase almost 1:1 with the frontend's
  original tab structure.
- **`ReportsPage.jsx`** — only the **active tab's** report is fetched, not
  all six — switching tabs fetches on demand. This is a genuine improvement
  over the original, which computed every tab's numbers on every render
  from the full in-memory `sales`/`purchases`/`expenses`/`products` arrays
  regardless of which tab was showing. The "today/week/month" period
  buttons resolve to concrete `YYYY-MM-DD` strings client-side before
  calling the API (the backend only ever sees a plain date range — see the
  backend's Reports phase notes); "custom" with an empty date omits that
  bound entirely rather than fabricating an epoch/now stand-in, letting the
  backend's own "no bound" default apply. Inventory/customers/suppliers
  tabs never send a date range at all, matching the backend (and the
  original frontend) exactly — those are always snapshots of *now* /
  all-time balances, independent of whatever period is selected for the
  other tabs. The printed report reads from whichever report object is
  currently loaded for the active tab.

## Sub-phase 11h — Dashboard page + AppLayout's low-stock badge ✅ done

- **Backend gap found and filled:** the Dashboard needs a "recent activity"
  feed, but no backend endpoint read `ActivityLog` back out — only the
  write path (`recordActivity`, called by every mutating service since
  Phase 4) existed. Added `GET /api/activity` (paginated, filterable by
  `type`, no write endpoints — mirrors `GET /api/audit-log`'s shape from
  Phase 10) directly in the backend project, with full test coverage,
  rather than leaving the Dashboard's activity widget on mock data. See the
  backend's own README for details.
- **`src/services/api/activity.js`** — thin wrapper for the new endpoint.
- **`AppLayout.jsx`'s low-stock bell** — now fetches `{ filter: 'low', limit: 6 }`
  from the real products API, refetched on every route change. This closes
  the mock/real inconsistency flagged back in 11b. **Trade-off, stated
  plainly:** without polling (which the project's performance guidance
  discourages unless necessary) or a shared invalidation mechanism across
  pages, this can't be perfectly live — it won't reflect a stock change made
  without navigating away (e.g. completing a sale while staying on the POS
  page) until the next navigation. Refetching on route change is judged the
  reasonable middle ground for a notification badge, not a financial figure.
- **`DashboardPage.jsx`** — every stat now comes from a purpose-built,
  already-existing endpoint rather than reducing full in-memory arrays:
  cashbox balance/today figures from `/api/cashbox/summary`, today's sales/
  purchases from the Reports endpoints with `from=to=today`, today's
  expenses from `/api/expenses/summary`, customer/supplier outstanding
  totals from the Reports endpoints (`limit: 1`, since only the total is
  needed here, not a top-list), and the low-stock table from two small
  parallel calls (`filter: 'out'` + `filter: 'low'`) merged together — the
  original widget shows both together in one list distinguished only by a
  badge per row, and no single backend filter value means that combined
  condition, so merging two small calls here was preferred over adding a
  new backend filter just for this widget's exact shape. Recent activity
  comes from the new `/api/activity` endpoint above.

## Sub-phase 11i — Settings page + device management + Activity page ✅ done (final sub-phase — Phase 11 complete)

- **Backend gap filled:** `GET /api/settings` + `PATCH /api/settings` didn't
  exist (the `Settings` model was built in the backend's Phase 2, but no
  route ever read/wrote it). Added both, matching the established pattern
  exactly: the singleton auto-creates with sensible defaults on first read
  (no security concern here, unlike `ShopAuth`'s password, which requires
  an explicit CLI seed instead), and the update is a precise partial diff
  (only fields actually sent are changed, logged to both the activity feed
  and the audit trail). Deliberately **has no `accessCode`/password field**
  — that was already excluded from the `Settings` model back in the
  backend's Phase 2 for a real reason: a login credential must never live
  next to plain shop-info fields returned wholesale by a "get settings"
  call. Full test coverage; backend is now at **444 tests**.
- **Backend gap filled:** `GET /api/activity` only supported a `type`
  filter when first built in 11h — added `from`/`to` date-range filtering
  too, matching every other list endpoint's shape (Sales/Purchases/
  Cashbox/Expenses), since `ActivityPage.jsx` needs it.
- **`SettingsPage.jsx`** — fully rewritten. Shop info / invoice footer /
  low-stock threshold forms all call the real `PATCH /api/settings`. The
  old "تغيير كود الدخول" section (a bare string compared against the mock
  `state.settings.accessCode`) is gone entirely, replaced by two things
  that didn't exist in the mock version at all:
  - A real **password change** form using `AuthContext.changePassword()` —
    requires the current password, and (per the backend's Phase 3 design)
    signs out every other registered device automatically on success.
  - A **device management** section — lists the (up to 2) registered
    devices via `AuthContext.listDevices()`, marks the current one, and
    lets you revoke any of them via `AuthContext.revokeDevice()` to free a
    slot for a new device. `AuthContext` already exposed both functions
    since Phase 3/sub-phase 11a; they just had no UI consumer until now.
- **`ActivityPage.jsx`** — rewired to the real, newly-completed
  `/api/activity` endpoint with type + date-range filters and pagination,
  same shape as every other history page.
- **`SettingsContext.jsx`** (new) — shop settings are genuinely needed in
  many places at once (the sidebar/header title in `AppLayout`, the invoice
  preview on POS/Sales History/Purchase History, the print header on
  Reports, and the Settings page itself), so rather than have each of those
  fetch independently, a small shared context fetches settings once for the
  whole authenticated session and exposes `reload()` — called after any
  successful save on the Settings page so every other consumer (most
  visibly, the shop name in the header) picks up the change immediately.
  Mounted *inside* the `RequireAuth`-protected route tree, since the
  endpoint requires auth and there's nothing meaningful to show pre-login.
  `AppLayout.jsx`, `PosPage.jsx`, `SalesHistoryPage.jsx`,
  `PurchaseHistoryPage.jsx`, and `ReportsPage.jsx` all switched from the
  mock `state.settings` to this real context, closing every "settings gap"
  flagged in earlier sub-phases.
- **`GlobalSearch.jsx`** — a gap missed in earlier sub-phase planning: this
  header component (rendered on *every* authenticated page via
  `AppLayout`) searched products/customers/suppliers/sales from the mock
  in-memory state and was never accounted for in any prior sub-phase's
  scope. Rewired to four small parallel, debounced API calls
  (`limit: 4` each) instead.
- **`LoginPage.jsx`** — its last dependency on the mock context (a
  `state.settings.shopName` read for the pre-login title) is gone; the
  Settings endpoint requires auth and there's no reasonable way to show the
  real shop name before logging in without exposing shop info through an
  unauthenticated endpoint just for this cosmetic label, so a static title
  is used instead.

### The mock data layer is now fully removed

With every page wired, a final sweep confirmed `ShopContext.jsx`,
`shopService.js`, and `mockData.js` had **zero remaining consumers**
anywhere in the app — so they were deleted outright, along with the now-
pointless `ShopProvider` wrapper in `App.jsx` and the stale `USE_MOCK_DATA`
flag in `config.js`. Leaving ~370+ lines of dead mock code sitting in the
codebase after every real consumer was migrated would only mislead whoever
reads it next. The production bundle shrank as a direct result (dead code
elimination had nothing left to eliminate manually).

## Phase 11 is complete

Every page now runs on the real API — Products/Inventory, Customers,
Suppliers (+ detail pages), Sales/POS, Sales History, Purchases, Purchase
History, Cashbox, Expenses, Reports, Dashboard, Activity, and Settings
(+ device management) — backed by real authentication (JWT + the 2-device
limit) from `AuthContext`, with no remaining dependency on any mock data
anywhere in the frontend.

**Two small, genuine backend gaps surfaced during this phase** that weren't
part of any original backend phase's scope — both filled with full test
coverage rather than left as frontend-side workarounds:
`GET /api/activity` (Phase: sub-phase 11h) and `GET`/`PATCH /api/settings`
(sub-phase 11i). The backend's own `README.md` documents both.

**What's still a deliberate, documented trade-off** (not a bug) from
earlier sub-phases, for whoever picks this project up next:
- `AppLayout`'s low-stock badge refetches on route change, not live —
  won't catch a stock change made without navigating away (11h).
- Customer/Supplier detail pages and the POS/Purchases pickers fetch one
  batch (up to 100) rather than paginating — fine at this system's target
  scale, revisit if a shop's customer/supplier/product count grows well
  past that (11c/11d/11e).
- The expense reason filter lost its "previously used reasons" enrichment
  now that the full expense list isn't loaded client-side; the static
  suggestion list is used instead (11f).
- CSV export (Inventory) and printed statements (Customer/Supplier detail
  pages) fetch up to their own generous safety caps rather than truly
  unbounded exports (11b/11c).

## Post-completion addition — real product image uploads (Cloudinary)

Found after Phase 11 was otherwise done: `ProductImagePicker.jsx` (used by
both `InventoryPage.jsx` and `QuickAddProductModal.jsx`) was never actually
wired to Cloudinary despite that being the confirmed original design —
selecting an image just base64-encoded it into the `image` string sent to
the backend, which the backend then stored as-is (no size limit on that
field), risking bloated documents and slow list responses.

Fixed by actually building the intended flow: the backend gained
`GET /api/uploads/signature` (Phase: added post-11, see the backend's own
README "Product images" section) — an authenticated endpoint that mints a
short-lived signed token for a **direct browser-to-Cloudinary upload**,
never touching the image bytes itself. `ProductImagePicker.jsx` now calls
that endpoint, then uploads directly to Cloudinary's API and stores the
returned `secure_url`. Both consumers of the shared component picked this
up automatically — no changes needed to either page itself, since the
component's own `value`/`onChange` interface never changed.
