# Plan: Adding "Buy Art" E-Commerce to Exibitions

> **Audience:** A cheaper/faster LLM will execute this plan. Each step is
> self-contained, with file paths, exact column names, exact method signatures,
> and exact acceptance criteria. If a step is unclear, STOP and ask — do not
> improvise the data model.

> **Mode:** This plan targets the **fastest, safest** path to a working
> "one-click buy / add-to-basket" feature on top of the existing stack
> (Laravel 11 + React 19 + Redux Toolkit + Sanctum + PostgreSQL + Docker
> on fly.io). It favours **SOLID**, **explicit**, **boring** code over
> clever abstractions. No external payment SDK in phase 1 — Stripe Checkout
> is the only external dependency, called from the server.

> **Phasing:** §1–§15 cover **v1** (buy flow + Stripe checkout). §16–§19
> cover **v1.5** (print-on-demand fulfilment via Printful). v1 must ship
> and be stable before v1.5 starts. The two phases are kept in the same
> document so the data model and naming line up.

---

## 0. Project facts you must respect (read first, do not change)

- **Backend:** Laravel 11.48, PHP 8.3, PostgreSQL, Sanctum token auth.
  Entry: `backend/`. Container builds with `backend/Dockerfile`; running
  in production = `php artisan serve --host=0.0.0.0 --port=8000`
  (see `backend/entrypoint.sh:61`). All HTTP routing in
  `backend/routes/api.php`. Models in `backend/app/Models/`.
  Controllers in `backend/app/Http/Controllers/`. Migrations in
  `backend/database/migrations/`. Storage path: `storage/app/public/`
  (symlinked to `public/storage`, served by nginx in production).

- **Frontend:** React 19 + TS + Vite 7 + Redux Toolkit + react-router 7.
  Entry: `frontend/src/`. State in `frontend/src/store/*.ts`. Routes in
  `frontend/src/App.tsx`. Admin auth token persisted in `localStorage`
  under key `admin_token` (see `frontend/src/store/authSlice.ts:18`).
  All API calls use `fetch('/api/...')` — relative path, proxied to
  backend through nginx in prod or vite proxy in dev.

- **Auth model today:** Only `is_admin` users get a Sanctum token.
  Public visitors (browsing the gallery) are **anonymous** — no
  account, no session, no token. This is critical: **the buy flow must
  work for anonymous users** (guest checkout). We are NOT building a
  user-registration system in this phase.

- **Deployment:** fly.io with persistent `storage` volume mounted at
  `/app/storage` (see `fly.toml:25-28`). Migrations run on container
  boot via `entrypoint.sh:52`. CORS not configured — frontend and
  backend share an origin through nginx in prod, so it's not needed.

- **No external npm install beyond what's already there.** Frontend deps
  in `frontend/package.json`. Add only what is listed below.

---

## 1. Design overview (the "why" — read this once)

### 1.1 Product scope

A visitor viewing the gallery can:
1. Click **"Add to basket"** on an artwork card.
2. See a basket counter in the header; click it to open a basket drawer.
3. In the basket: review items, adjust quantity (capped at 1 per artwork —
   these are unique pieces, see §2.1), remove, see total.
4. Click **"Checkout"** → fill name + email + shipping address (guest,
   no account) → click **"Pay"** → redirected to Stripe Checkout (hosted
   page) → on success return to a `/checkout/success?session_id=...`
   page → backend webhook marks order paid, frontend shows "Thank you".

A separate admin-only page lists all orders with status filters.

### 1.2 Why "basket" + Stripe Checkout (not Stripe Elements in-page)

- **Speed:** Stripe Checkout is a hosted page. We send line items +
  customer email + success/cancel URLs; Stripe handles the form, PCI
  scope, 3DS, Apple/Google Pay, and emails. **Zero PCI burden on us**
  (SAQ A).
- **One-click feel:** The in-app "Pay" button creates a Stripe session
  and `window.location`s to it. The user pays, comes back. Cart is
  cleared on the success page only after backend confirms via webhook.
- **SOLID split:** The `OrderService` knows nothing about Stripe; the
  `StripeGateway` knows nothing about orders; the controller glues them.
  Swapping Stripe for Adyen later is one new `PaymentGateway`
  implementation.

### 1.3 Storage of the basket for anonymous users

- **Frontend:** `localStorage` under key `exibitions_basket` — survives
  page refresh, never sent to backend until checkout.
- **Backend:** A basket/quote row in DB is **not** created until
  checkout starts. This avoids garbage rows from bots and abandoned
  sessions, and keeps the public API surface tiny.
- **Trade-off acknowledged:** The "save basket across devices" feature
  is NOT in scope. If added later, it requires user accounts, which is
  out of scope for this phase.

### 1.4 Money, currency, and rounding

- All amounts stored as **integer minor units** (cents). Column type
  `BIGINT`. PHP casts to int; TS uses `number` (we treat it as integer
  in code, never do `*` or `/` on it).
- Currency: a single column `currency CHAR(3) NOT NULL DEFAULT 'USD'`
  on the order. We support one currency at a time per order (a
  multi-currency storefront is a v2 feature, not in scope).
- Prices are configured in the admin (per artwork) in major units
  (e.g. `1200.00`) and converted to minor units at the API boundary
  (`(int) round($price * 100)`). Stripe receives minor units.

### 1.5 Idempotency and webhooks

Stripe webhooks can fire more than once. Every webhook handler **MUST**
be idempotent — keyed on Stripe's `event.id`. We persist
`stripe_events` rows (one per received event id) inside the same DB
transaction as the order update. If the event id already exists, we
return 200 OK and do nothing.

---

## 2. Data model

### 2.1 New tables

All new migrations go in `backend/database/migrations/` with
filenames prefixed `2026_07_06_*` (matching existing convention
`2026_03_*`). Use `php artisan make:migration` from inside the
running container, or write the file by hand — either is fine; the
file just needs to return a class with `up()` and `down()`.

#### 2.1.1 `orders`

| Column          | Type                  | Notes |
|-----------------|-----------------------|-------|
| `id`            | bigserial PK          | |
| `order_number`  | varchar(32) UNIQUE NOT NULL | Human-readable, e.g. `EX-20260706-000123`. Generated in app layer, not DB. |
| `status`        | varchar(32) NOT NULL DEFAULT 'pending' | One of: `pending`, `paid`, `fulfilled`, `cancelled`, `refunded`. Use a PHP enum, not a DB CHECK, so we can evolve. |
| `currency`      | char(3) NOT NULL      | ISO 4217. |
| `subtotal_cents`| bigint NOT NULL        | Sum of line totals. |
| `shipping_cents`| bigint NOT NULL DEFAULT 0 | Phase 1: always 0. Column exists for v2. |
| `tax_cents`     | bigint NOT NULL DEFAULT 0 | Phase 1: always 0. Stripe `automatic_tax` future toggle. |
| `total_cents`   | bigint NOT NULL        | `subtotal + shipping + tax`. |
| `customer_email`| varchar(255) NOT NULL  | |
| `customer_name` | varchar(255) NOT NULL  | |
| `shipping_address` | jsonb NOT NULL     | `{line1, line2?, city, postal_code, country, state?}`. Validate keys in a FormRequest. |
| `stripe_session_id` | varchar(255) UNIQUE NULL | Set when checkout session created. |
| `stripe_payment_intent_id` | varchar(255) NULL | Filled by webhook. |
| `paid_at`       | timestamptz NULL      | |
| `created_at`    | timestamptz NOT NULL  | |
| `updated_at`    | timestamptz NOT NULL  | |

Indexes: `status`, `customer_email`, `created_at` (for admin lists).

#### 2.1.2 `order_items`

| Column        | Type           | Notes |
|---------------|----------------|-------|
| `id`          | bigserial PK   | |
| `order_id`    | bigint NOT NULL FK → `orders.id` ON DELETE CASCADE | |
| `artwork_id`  | bigint NOT NULL FK → `artworks.id` ON DELETE RESTRICT | We must never silently lose the link to a sold piece. |
| `title_snapshot` | varchar(255) NOT NULL | Title at the moment of purchase. |
| `image_snapshot` | varchar(255) NULL    | Image path at purchase. |
| `unit_price_cents` | bigint NOT NULL | Price the buyer was charged. |
| `currency`    | char(3) NOT NULL | Denormalised from order for safety. |
| `created_at`  | timestamptz NOT NULL | |
| `updated_at`  | timestamptz NOT NULL | |

Index: `order_id`. Unique `(artwork_id)` so the same artwork can only
appear once per order. (One physical piece = one row.)

**Why snapshots:** Prices and titles change. The buyer and the seller
need a record of what was actually paid for.

#### 2.1.3 `stripe_events` (webhook idempotency)

| Column        | Type           | Notes |
|---------------|----------------|-------|
| `id`          | varchar(255) PK | Stripe `event.id`. |
| `type`        | varchar(64) NOT NULL | e.g. `checkout.session.completed`. |
| `payload`     | jsonb NOT NULL | Full event for audit/replay. |
| `received_at` | timestamptz NOT NULL | |

No update column — events are immutable.

#### 2.1.4 Alter `artworks` — add `price_cents` and `currency`

Migration that **adds** columns (does not break existing rows):

| Column        | Type           | Notes |
|---------------|----------------|-------|
| `price_cents` | bigint NULL    | NULL = "not for sale". Default NULL on existing rows via the migration. |
| `currency`    | char(3) NULL   | Required when `price_cents IS NOT NULL`. Enforce in a FormRequest, not a CHECK. |
| `is_available`| boolean NOT NULL DEFAULT true | Set to false when sold (and after a `paid` webhook). |

Existing rows get `price_cents = NULL, currency = NULL,
is_available = true` — they show in the gallery as before, the buy
button is hidden.

### 2.2 Eloquent model files

Create (or modify) the following in `backend/app/Models/`. All
extend `Illuminate\Database\Eloquent\Model`. Use `$fillable` and
`$casts` exactly as below.

- `Artwork.php` — **modify**: add `price_cents`, `currency`,
  `is_available` to `$fillable`. Add cast `is_available => boolean`.
  Add relation `public function orderItems(): HasMany { return
  $this->hasMany(OrderItem::class); }`. Add scope
  `public function scopeForSale(Builder $q): Builder { return
  $q->whereNotNull('price_cents')->where('is_available', true); }`.

- `Order.php` — **new**:
  - `$fillable`: see columns above except `id`, `created_at`, `updated_at`.
  - `$casts`: `shipping_address => 'array'`, `paid_at => 'datetime'`,
    `subtotal_cents` and other `_cents` columns to `'integer'`.
  - Relation `items(): HasMany { return $this->hasMany(OrderItem::class); }`.
  - Relation `payment(): HasOne { return $this->hasOne(Payment::class); }`
    (see §2.3).
  - Static method `public static function generateOrderNumber(): string`
    returning `EX-` . `now()->format('Ymd') . '-' . str_pad((string)
    random_int(0, 999999), 6, '0', STR_PAD_LEFT)`. Wrap in retry loop
    (max 5) catching `QueryException` with unique-constraint code —
    10⁶ keys per day is plenty; collision retry is cheap.
  - `public function isPaid(): bool { return $this->status ===
    OrderStatus::Paid->value; }`.

- `OrderItem.php` — **new**: `$fillable` = artwork_id, order_id,
  title_snapshot, image_snapshot, unit_price_cents, currency.
  Relation `artwork(): BelongsTo { return
  $this->belongsTo(Artwork::class); }` and `order(): BelongsTo`.

- `Payment.php` — **new** (optional but recommended for SOLID):
  one-to-one log of every Stripe call attempt.

  | Column        | Type           | Notes |
  |---------------|----------------|-------|
  | `id`          | bigserial PK   | |
  | `order_id`    | bigint NOT NULL FK → orders(id) ON DELETE CASCADE | |
  | `provider`    | varchar(32) NOT NULL DEFAULT 'stripe' | |
  | `provider_session_id` | varchar(255) NULL | |
  | `provider_payment_intent_id` | varchar(255) NULL | |
  | `amount_cents`| bigint NOT NULL | |
  | `currency`    | char(3) NOT NULL | |
  | `status`      | varchar(32) NOT NULL | `initiated`, `succeeded`, `failed`. |
  | `raw_response`| jsonb NULL      | Last provider response, for support. |
  | `created_at`  | timestamptz NOT NULL | |
  | `updated_at`  | timestamptz NOT NULL | |

- `StripeEvent.php` — **new**: `$fillable` = id, type, payload,
  received_at; `$casts` = `payload => 'array'`, `received_at =>
  'datetime'`; PK = id (string), so `$incrementing = false` and
  `$keyType = 'string'`. Set `public $timestamps = false;` — we
  fill `received_at` ourselves.

### 2.3 PHP enum files

Place under `backend/app/Enums/` (create the folder). Laravel
auto-discovers them if you `use` them; no service-provider
registration needed.

- `OrderStatus.php` — backed string enum: `Pending = 'pending'`,
  `Paid = 'paid'`, `Fulfilled = 'fulfilled'`, `Cancelled = 'cancelled'`,
  `Refunded = 'refunded'`. Add `public function label(): string`
  returning human text. Add `public function isTerminal(): bool`
  returning true for Paid/Fulfilled/Cancelled/Refunded.

- `PaymentStatus.php` — `Initiated = 'initiated'`, `Succeeded =
  'succeeded'`, `Failed = 'failed'`.

- `PaymentProvider.php` — `Stripe = 'stripe'`. Empty now, exists for
  the strategy pattern.

### 2.4 Routes (add to `backend/routes/api.php`)

Add inside the existing `Route::middleware('auth:sanctum')->group`
block (admin-only, for order management):

```php
Route::get('/orders', [OrderController::class, 'index']);
Route::get('/orders/{order}', [OrderController::class, 'show']);
```

Add OUTSIDE that block (public — guest checkout):

```php
// Checkout flow (no auth)
Route::post('/checkout/session', [CheckoutController::class, 'createSession']);
Route::get('/checkout/session/{sessionId}', [CheckoutController::class, 'status']);

// Stripe webhook (must be public, no auth, no CSRF — verified by signature)
Route::post('/webhooks/stripe', [WebhookController::class, 'stripe'])
    ->withoutMiddleware([\Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);
```

Also expose one **public** endpoint so the success page can poll
order status without a token:

```php
Route::get('/checkout/success', [CheckoutController::class, 'success']);
```

The success handler accepts a `session_id` query string, looks up the
order, and returns a minimal `{order_number, status, paid_at}` payload.
The frontend uses this to decide whether to show "Thank you" or
"Still processing, refresh in a moment".

### 2.5 Artwork public endpoint (add to ArtworkController)

The existing `ArtworkController::index()` returns ALL artworks,
including ones that have been sold. For the gallery UI we need a
slimmer "browseable" payload. **Decision:** do NOT add a new
endpoint. Instead, modify the public `index()` to return only
artworks where `is_available = true` AND (optionally) `price_cents
IS NOT NULL` for the gallery. The admin can see everything via a
new endpoint:

```php
// In ArtworkController
public function adminIndex(): JsonResponse {
    $this->authorize('admin');  // see §4.1
    return response()->json(Artwork::orderBy('sort_order')->get());
}
```

Add `Route::get('/admin/artworks', [ArtworkController::class, 'adminIndex']);`
inside the `auth:sanctum` group. The public `index()` stays
unchanged-but-filtered. Use a **query scope** on the model
(`scopeBrowseable`) so the filter lives next to the data.

---

## 3. Services (the "S" and "D" in SOLID)

Create these under `backend/app/Services/`. Each is a final class
with constructor injection of its dependencies. Bind them in
`App\Providers\AppServiceProvider::register()` (or create a
`CheckoutServiceProvider` if you want to keep it isolated — the
project already has `AppServiceProvider`).

### 3.1 `App\Services\PricingService`

- **Single responsibility:** convert a major-unit decimal price
  string to integer minor units safely, format a minor-unit amount
  back to display `"$1,200.00"`. Knows nothing about orders.
- **Methods:**
  - `public function toMinorUnits(string|int|float $major): int`
    — `(int) round(((float) $major) * 100)`. Reject NaN/Inf by
    throwing `InvalidArgumentException` if `!is_finite($value)`.
  - `public function format(int $minor, string $currency): string`
    — uses `NumberFormatter` with locale `en_US` and currency style;
    fall back to a manual `sprintf('%.2f', $minor/100) . ' ' .
    $currency` if intl is unavailable (it ships with PHP 8.3 on
    the project image, so this fallback is paranoia, not
    production code).
- **Why it exists:** every controller that touches money imports
  this one class, never `intl` or arithmetic.

### 3.2 `App\Services\OrderService`

- **Single responsibility:** orchestrate order creation, snapshot
  artwork data, mark artworks unavailable atomically.
- **Methods:**
  - `public function createFromCheckout(array $items, array
    $customer, PricingService $pricing): Order` — `$items` is
    `[['artwork_id' => 1], ...]`. Inside a `DB::transaction`:
    1. Lock the artwork rows: `Artwork::whereIn('id', $ids)->lockForUpdate()->get()`.
    2. Verify each is `is_available` and has a `price_cents`; if
       not, throw `OutOfStockException` (custom, maps to HTTP 409).
    3. Build the `Order` row + `OrderItem` rows with snapshots.
    4. Set `Artwork::whereIn('id', $ids)->update(['is_available' =>
       false])`. Note: we DO NOT mark unavailable until the
       session is being created — see `CheckoutController` flow
       for the right order. Actually, see §3.4 — the
       `CheckoutController` calls `createOrder()` and
       `markReserved()` in a single transaction.
  - `public function markPaid(string $stripeSessionId, string
    $paymentIntentId): Order` — finds the order by session id,
    sets status to Paid, paid_at = now(). Idempotent: returns
    unchanged if already Paid.
  - `public function findBySessionId(string $sessionId): ?Order`.
- **Why a service, not a controller method:** the controller
  stays a thin HTTP adapter. Tests can call
  `OrderService::createFromCheckout(...)` directly without
  faking requests.

### 3.3 `App\Contracts\PaymentGateway` (interface) + `App\Services\StripeGateway`

This is the **Dependency Inversion** play. The interface lives in
`app/Contracts/` (create the folder) and the Stripe implementation
in `app/Services/`.

```php
namespace App\Contracts;

use App\Models\Order;

interface PaymentGateway {
    public function createCheckoutSession(Order $order, string $successUrl, string $cancelUrl): array;
    // Returns ['session_id' => '...', 'url' => 'https://checkout.stripe.com/...']
    public function retrieveSession(string $sessionId): array;
    // Returns normalised array (id, payment_intent, payment_status, amount_total, currency)
    public function verifyWebhookSignature(string $payload, string $signatureHeader): \Stripe\Event;
    // Throws on bad signature.
}
```

`StripeGateway` implements it. Uses `stripe-php` (added in
`composer.json` require). The API key comes from
`config('services.stripe.secret')`. Webhook secret from
`config('services.stripe.webhook_secret')`.

**Bind in `AppServiceProvider::register()`:**
```php
$this->app->bind(\App\Contracts\PaymentGateway::class, \App\Services\StripeGateway::class);
```

### 3.4 `App\Http\Controllers\CheckoutController` (the glue)

Two methods:

- `createSession(StoreCheckoutRequest $r, OrderService $orders,
  PaymentGateway $gateway)`:
  1. Validate the basket shape (see §4.1 FormRequest).
  2. Call `OrderService::createFromCheckout(...)` inside a
     transaction — this creates the `Order` (status=Pending) AND
     marks artworks unavailable in the SAME transaction. If any
     artwork was already taken, we throw and return 409.
  3. Call `PaymentGateway::createCheckoutSession($order,
     $frontendUrl . '/checkout/success?session_id={CHECKOUT_SESSION_ID}',
     $frontendUrl . '/checkout/cancel')`.
  4. Persist `$result['session_id']` on the order.
  5. Return JSON `{ session_id, url }` to the frontend.
  6. **Rollback behaviour:** if the Stripe call fails, the
     transaction is rolled back and the artworks are re-listed.
     Use a try/catch around the gateway call and a
     `DB::transaction` closure that includes both the order
     creation and the session id persistence — but NOT the
     Stripe HTTP call. Concrete: create order in tx → commit →
     call Stripe → on failure, delete the order (or mark
     Cancelled) AND restore `is_available = true`. Simpler
     version: create order, call Stripe, on failure set status to
     `Cancelled` and restore availability in a cleanup closure.
     The "simpler version" is fine for v1.

- `success(Request $r, OrderService $orders)`:
  - Looks up the order by `session_id`. Returns 200 with
    `{order_number, status, paid_at}` if found and the
    session's Stripe status is `complete`. If session is
    still `open`, returns 200 with `{status: 'pending'}` and
    the frontend polls. **Do not** trust the success URL alone
    to mark the order paid — only the webhook does that.

- `status(Request $r, PaymentGateway $gw)` — used by the
  success page to poll. Returns
  `{order_status, stripe_status, paid_at}`.

### 3.5 `App\Http\Controllers\WebhookController`

- One method: `stripe(Request $r, PaymentGateway $gw,
  OrderService $orders)`.
- Read raw body: `$payload = $r->getContent();` (NOT
  `$r->all()` — that parses and loses signature integrity).
- Read header: `$sig = $r->header('Stripe-Signature');`.
- `$event = $gw->verifyWebhookSignature($payload, $sig);`
  (throws if invalid; catch and return 400).
- **Idempotency check inside a transaction:**
  `if (StripeEvent::where('id', $event->id)->exists()) { return
  response('ok', 200); }` then insert the row, then dispatch the
  handler. Wrap the whole thing in `DB::transaction`.
- Switch on `$event->type`:
  - `checkout.session.completed` → `OrderService::markPaid($session->id, $session->payment_intent)`.
  - `checkout.session.expired` → mark order Cancelled, restore
    artworks.
  - `charge.refunded` → mark order Refunded. (v2: restore
    artworks? Decide now: NO, refunded piece is gone. Document.)
  - `payment_intent.payment_failed` → mark order Cancelled,
    restore artworks.
  - Unknown types → log and 200.

### 3.6 `App\Http\Controllers\OrderController` (admin)

- `index(Request $r)` — paginated list. Filter by `?status=`
  query param. Default order `created_at desc`. Use
  `Order::query()->when(...)`. Return
  `Order::paginate(25)`. **Resource transform:** never return
  the raw Eloquent model to JSON — wrap in
  `App\Http\Resources\OrderResource` (see §4.4).
- `show(Order $order)` — single order, with `items.artwork`
  eager-loaded. `OrderResource::make($order->load('items.artwork'))`.

---

## 4. Form requests, resources, policies

### 4.1 Form requests (validation lives here, not in controllers)

Create in `backend/app/Http/Requests/`:

- `StoreCheckoutRequest.php`:
  - `items` — required, array, min 1, max 50.
  - `items.*.artwork_id` — required, integer, exists in
    `artworks,id`.
  - `customer.email` — required, email:rfc.
  - `customer.name` — required, string, min 1, max 255.
  - `customer.shipping.line1` — required, string, max 255.
  - `customer.shipping.line2` — nullable, string, max 255.
  - `customer.shipping.city` — required, string, max 120.
  - `customer.shipping.postal_code` — required, string, max 20.
  - `customer.shipping.country` — required, string, size 2
    (ISO 3166-1 alpha-2, uppercase). Add a custom rule using
    `Symfony\Component\Intl\Countries::exists($value)`.
  - `customer.shipping.state` — nullable, string, max 120.
  - `success_url` — required, url, must start with the
    configured frontend origin (`config('app.frontend_url')`).
    This blocks open-redirect attacks where a malicious buyer
    crafts a success_url pointing at a phishing site.

- `UpdateArtworkRequest.php` (used by admin to set prices):
  - `title` — sometimes, string, max 255.
  - `description` — sometimes, nullable, string, max 5000.
  - `price_cents` — sometimes, nullable, integer, min 0, max
    99999999.
  - `currency` — required_with:price_cents, nullable, string,
    size 3.
  - `is_available` — sometimes, boolean.

- `StoreArtworkRequest.php` — same as Update plus `title`
  required. Add `image` — sometimes, image, max 30720 (matches
  existing `ArtworkController::uploadImage` rule).

### 4.2 Policies

- `App\Policies\OrderPolicy.php`:
  - `viewAny(User $u): bool { return $u->is_admin; }`
  - `view(User $u, Order $o): bool { return $u->is_admin; }`
- Register in `AppServiceProvider::boot()`:
  `Gate::policy(Order::class, OrderPolicy::class);` (Laravel 11
  auto-discovers policies in `app/Policies` if they follow the
  `ModelNamePolicy` convention, so this line is optional — verify
  by trying without it first).

### 4.3 Middleware for admin endpoints

- Existing endpoints rely on `auth:sanctum` + the
  `is_admin` check in `AuthController::login` (token belongs to
  an admin by construction). **But:** Sanctum tokens persist
  until explicitly revoked; a former admin still has a working
  token. Add a check anyway in
  `App\Http\Middleware\EnsureUserIsAdmin`:
  ```php
  if (!$request->user() || !$request->user()->is_admin) {
      return response()->json(['message' => 'Forbidden'], 403);
  }
  ```
  Register as `admin` alias in `bootstrap/app.php` (Laravel 11
  way: `$middleware->alias(['admin' => EnsureUserIsAdmin::class])`).
  Apply to the new admin routes: `Route::middleware(['auth:sanctum',
  'admin'])->group(...)`.

### 4.4 API Resources

Create in `backend/app/Http/Resources/`:

- `OrderResource.php` — wraps an `Order` and exposes:
  - `id`, `order_number`, `status` (value + label),
  - `currency`, `subtotal_cents`, `shipping_cents`, `tax_cents`,
    `total_cents`,
  - `customer_email`, `customer_name`, `shipping_address`,
  - `paid_at` (ISO 8601),
  - `items` — collection of `OrderItemResource`,
  - `created_at`, `updated_at`.
- `OrderItemResource.php` — exposes `id`, `artwork_id`,
  `title_snapshot`, `image_snapshot`, `unit_price_cents`,
  `currency`. **Never** include a nested `artwork` relation
  from the resource — admin uses a separate `show` endpoint
  that eager-loads.
- `ArtworkResource.php` — slim public representation:
  `id, title, image, image_compressed, price_cents, currency,
  is_available`. Do NOT include `description` in the list
  response (it's huge; the gallery already has it). Override
  `toArray` with `$this->resource->description` only when the
  resource is created via `ArtworkResource::make($artwork)->withDetail()`.
  Pragmatic alternative: keep two methods,
  `ArtworkResource::list($artwork)` and
  `ArtworkResource::detail($artwork)`. Pick one and stick to it.

### 4.5 Update `ArtworkController`

Add to `backend/app/Http/Controllers/ArtworkController.php`:

- Modify `store()` to use `StoreArtworkRequest` and persist
  `price_cents` + `currency` + `is_available`.
- Modify `update()` to use `UpdateArtworkRequest`.
- `adminIndex()` as in §2.5.
- `updatePrice(Artwork $artwork, UpdateArtworkPriceRequest $r)` —
  a dedicated endpoint so the admin UI can do a partial update
  without touching other fields. Accepts only `price_cents`,
  `currency`, `is_available`. Use a thin
  `UpdateArtworkPriceRequest`.

Add routes:
```php
Route::put('/artworks/{artwork}/price', [ArtworkController::class, 'updatePrice']);
```

---

## 5. Frontend changes

### 5.1 New dependencies

`frontend/package.json` — add (run `npm install` from the frontend
folder on the host, then rebuild the image; or add to the
`command:` in `docker-compose.yml` so the container picks it up):

- `@stripe/stripe-js` — for the success page only (we use
  hosted Checkout, so we don't need `@stripe/react-stripe-js`).
  Latest stable v4.x. Version pinning: exact, not `^`.

We deliberately do NOT add:
- Any state library — Redux Toolkit is already there.
- A router library — react-router-dom 7 is already there.
- A form library — small enough to write by hand.
- A toast/notification library — AdminPanel already has an
  inline message pattern. Reuse it (`setMessage` with 3s
  timeout) for the basket drawer.

### 5.2 New types — `frontend/src/types/checkout.ts`

```ts
export interface BasketItem {
  artworkId: number
  title: string
  image: string | null
  priceCents: number
  currency: string
  addedAt: string  // ISO
}

export interface Basket {
  items: BasketItem[]
  updatedAt: string
}

export interface CheckoutRequest {
  items: { artwork_id: number }[]
  customer: {
    email: string
    name: string
    shipping: {
      line1: string
      line2?: string
      city: string
      postal_code: string
      country: string  // ISO 3166-1 alpha-2
      state?: string
    }
  }
  success_url: string
}

export interface CheckoutSession {
  session_id: string
  url: string
}

export interface OrderSummary {
  order_number: string
  status: 'pending' | 'paid' | 'fulfilled' | 'cancelled' | 'refunded'
  paid_at: string | null
}
```

### 5.3 New Redux slice — `frontend/src/store/basketSlice.ts`

Pure client-side. Persists to `localStorage` on every change.
The slice exposes actions `addItem`, `removeItem`, `clear`,
`hydrate` (called on app boot to read localStorage).

**Selector helpers** (exported alongside the slice, not in
`useSelector` call sites — SOLID "small interfaces"):

- `selectBasketCount(state): number` — number of distinct
  artworks.
- `selectBasketSubtotalCents(state): number` — sum of
  `priceCents`. Math is integer-only.
- `selectIsInBasket(state, artworkId: number): boolean`.

**Persistence middleware:** the cleanest way is a small custom
middleware in `store/index.ts` that listens for
`basket/addItem`, `basket/removeItem`, `basket/clear` and writes
`JSON.stringify(state.basket)` to `localStorage.exibitions_basket`.
On boot, `App.tsx`'s top-level `useEffect` dispatches
`basket/hydrate()` if the key exists and is valid JSON.

**Validation on hydrate:** if the parsed basket contains an
artwork id that no longer exists in the artworks slice, drop it.
Same for items missing `priceCents` (artwork went off-sale
between visits).

### 5.4 Update `Artwork` type in `artworksSlice.ts`

Add `price_cents: number | null`, `currency: string | null`,
`is_available: boolean`. These come from the API for free once
the backend migration runs and `ArtworkResource` exposes them.

### 5.5 New component — `frontend/src/components/BuyButton/BuyButton.tsx`

A small button. Behaviour:
- If `!artwork.is_available || artwork.price_cents == null`:
  render nothing (or a disabled "Sold" badge — pick one and
  be consistent).
- Otherwise: button with the price formatted:
  `Intl.NumberFormat(undefined, {style: 'currency', currency:
  artwork.currency}).format(artwork.price_cents / 100)`.
- On click: dispatch `basket/addItem(artwork)`. Show a 2-second
  inline "Added ✓" state, no global toast (keep it local to the
  button to avoid noise).
- `aria-label="Add {title} to basket for {price}"`.
- Keyboard: native `<button>` handles Enter/Space.
- The button must be `<button type="button">`, never a
  `<div onClick>`.

The **placement** depends on where it gets the `artwork` prop.
Two options:
- Inside `ArtworkSection.tsx` next to the title/description —
  visible in the gallery scroll.
- In a slide-out detail panel triggered by clicking the image
  (no detail panel today; would be a new feature).

**Decision:** add it to `ArtworkSection.tsx` first. A detail
panel is out of scope. Keep the button placement subtle —
bottom-right of the content block, small caps text, no big
cart icon (the site is cinematic, not e-commerce-y).

### 5.6 New component — `frontend/src/components/BasketDrawer/BasketDrawer.tsx`

A right-side slide-in drawer. Triggered by a header basket
icon that shows the current item count as a small badge.

- **Open state** lives in a new tiny `uiSlice.ts` (or in
  `basketSlice` — your call, but separate it from basket
  data; the SOLID reason: basket is data, drawer-open is UI
  state, different lifecycles).
- Animation: CSS transform `translateX(0)` ↔ `translateX(100%)`,
  `transition: transform 280ms cubic-bezier(.4, 0, .2, 1)`.
- Trap focus inside the drawer when open (use the
  `react-focus-lock` library? No — write 15 lines of
  `useEffect` to listen for Tab and wrap. Avoid a new dep).
- Close on Escape, close on backdrop click, close on
  successful checkout.
- Inside: list of items (thumb + title + price + remove
  button), subtotal, "Checkout" button, "Continue shopping"
  link.

### 5.7 New component — `frontend/src/components/Header/Header.tsx`

A persistent header. Currently the app has no persistent
header — `Exhibitions.tsx` is full-bleed. The header is
**frosted glass** over the gallery (the site is dark/cinematic;
a black header would break the immersive feel).

- `position: fixed; top: 0; left: 0; right: 0; z-index: 100`.
- `backdrop-filter: blur(20px) saturate(180%); background:
  rgba(0, 0, 0, 0.4);`.
- Left: site title `EXIBITIONS` (matches existing brand).
- Right: basket icon button (SVG, hand-rolled — no icon
  library), badge with count, opens drawer.
- Mobile: title smaller, basket icon only, no text labels.
- **Auto-hide on scroll down, show on scroll up** (subtle,
  optional — implement if you have time, but a static header
  is acceptable for v1). The hook: track `window.scrollY`
  delta in a ref, set `isVisible` state when delta > 10px.

### 5.8 New component — `frontend/src/components/CheckoutForm/CheckoutForm.tsx`

The form the user fills before being sent to Stripe.

- Fields: email, name, address line 1, address line 2 (optional),
  city, postal code, country (dropdown), state (optional).
- Country dropdown populated from
  `Intl.supportedValuesOf('region')` (Node 18+, all browsers
  we target — check caniuse; fallback to a hardcoded array of
  the 50 most common countries if needed).
- Validation: inline on blur. Required fields show red border
  + small error text. Don't block submit until blur; the
  form's "Pay" button is disabled until all required fields
  pass.
- Submit handler:
  1. `POST /api/checkout/session` with the basket items +
     customer details + `success_url = window.location.origin +
     '/checkout/success?session_id={CHECKOUT_SESSION_ID}'` (the
     `{CHECKOUT_SESSION_ID}` placeholder is what Stripe
     substitutes).
  2. On success, `window.location.href = response.url`.
  3. On error, show inline error banner. **Do not clear the
     basket on error** — only on `success` page mount.
- Disable the submit button during the network call. Disable
  the basket drawer's "Checkout" button while a checkout is
  in flight (single in-flight guard via a small piece of
  `uiSlice` state: `checkoutInFlight: boolean`).

### 5.9 New page — `frontend/src/components/CheckoutSuccess/CheckoutSuccess.tsx`

- Route: `/checkout/success` (in `App.tsx`).
- On mount: read `session_id` from query string. Poll
  `GET /api/checkout/success?session_id=...` every 1.5s up
  to 10 times (or until `status === 'paid'`).
- States:
  - Loading: spinner + "Confirming your purchase..."
  - Pending after 10 polls: "Your payment is being processed.
    You will receive an email shortly." with an order number
    if we have one. Do NOT show an error — Stripe sometimes
    takes a minute.
  - Paid: full-screen "Thank you. Your order {order_number}
    is confirmed." with a "Return to gallery" link.
  - Cancelled/expired (Stripe redirects here with
    `cancel` or session is expired): "Your checkout was
    cancelled. Your basket is preserved." + return link.
- On the **Paid** branch: dispatch `basket/clear()`.

### 5.10 New page — `frontend/src/components/AdminOrders/AdminOrders.tsx`

- Route: `/admin/orders`, behind `<ProtectedRoute>`.
- Table with columns: order #, date, customer email, items
  count, total, status (colour-coded badge), actions (view).
- Filter dropdown: All / Pending / Paid / Fulfilled / Cancelled
  / Refunded.
- Pagination: page size 25 (server-side).
- Detail view (modal or sub-route `/admin/orders/:id`): full
  order with line items, shipping address, Stripe session id,
  payment intent id (truncated), paid_at, raw provider response
  collapsed by default.
- Reuse the existing `AdminPanel.module.scss` palette and
  spacing tokens — do NOT introduce a second design system.
- Reuse the existing `message` toast pattern (3s timeout).

### 5.11 Update `AdminPanel` to manage prices

Add a new "Artwork Pricing" sub-section (or, simpler, a new
"Price" field on the existing artwork edit form). When the
admin edits an artwork:
- Add fields: `price_cents` (numeric input, in major units —
  divide by 100 on save), `currency` (3-letter input,
  uppercase), `is_available` (checkbox).
- Validation: if `price_cents` is empty, currency must also be
  empty and the artwork is hidden from the basket.
- The existing `handleSave` (around line 87 of
  `AdminPanel.tsx`) needs to be extended to send the new
  fields. Use the new `PUT /api/artworks/{id}/price` endpoint
  so the price update is one clean call.

### 5.12 Update `Exhibitions.tsx` and `ExhibitionView.tsx` minimally

The header is the only layout change needed. Wrap the existing
page content in a `<div className={styles.page}>` and add the
header above it. The GSAP scroll-driven animations are
independent of the header (the header is `position: fixed`,
z-index above everything).

**Do NOT** wrap the entire exhibition in a container with
`overflow: hidden` — that will break the scroll.

---

## 6. Configuration & secrets

### 6.1 Backend `config/services.php`

Add:
```php
'stripe' => [
    'secret'         => env('STRIPE_SECRET'),
    'publishable'    => env('STRIPE_PUBLISHABLE_KEY'),
    'webhook_secret' => env('STRIPE_WEBHOOK_SECRET'),
],
```

### 6.2 Backend `config/app.php`

Add a `frontend_url` config:
```php
'frontend_url' => env('FRONTEND_URL', 'http://localhost:5173'),
```

The `StoreCheckoutRequest` uses this to constrain the
`success_url` to prevent open redirects.

### 6.3 Root `.env` (shared, mounted into all containers via
`env_file: .env` in `docker-compose.yml`)

Add:
```
STRIPE_SECRET=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
FRONTEND_URL=http://localhost:8080
```

### 6.4 fly.io secrets (NOT committed)

Use `flyctl secrets set`:
```
flyctl secrets set STRIPE_SECRET=sk_live_... STRIPE_PUBLISHABLE_KEY=pk_live_... STRIPE_WEBHOOK_SECRET=whsec_... FRONTEND_URL=https://exibitions.fly.dev
```

### 6.5 Frontend env

Add `frontend/.env` (gitignored, present in dev):
```
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

In `frontend/src/config.ts` (new file):
```ts
export const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string
```

The frontend never sees the secret key. **Only the publishable
key is safe in client code.**

---

## 7. Stripe setup (manual, one-time)

1. Create a Stripe account (test mode for dev).
2. Dashboard → Developers → API keys → copy `pk_test_...` and
   `sk_test_...`.
3. Dashboard → Developers → Webhooks → Add endpoint.
   - URL: `https://<your-fly-app>.fly.dev/api/webhooks/stripe`
     (for prod) or `http://localhost:8080/api/webhooks/stripe`
     (for dev — use the Stripe CLI to forward).
   - Events: `checkout.session.completed`,
     `checkout.session.expired`,
     `payment_intent.payment_failed`, `charge.refunded`.
4. Copy the signing secret (`whsec_...`).
5. **Dev webhook forwarding** (use Stripe CLI):
   `stripe listen --forward-to localhost:8080/api/webhooks/stripe`.
   The CLI prints a `whsec_...` for forwarding; use that in
   the local `.env`. **Do not use your real webhook secret
   locally** — it won't match the CLI's signature.

### Test cards

- Success: `4242 4242 4242 4242`, any future expiry, any CVC, any
  ZIP.
- Decline: `4000 0000 0000 0002`.
- 3DS required: `4000 0027 6000 3184`.

---

## 8. Security checklist (read before merging)

This is the single most important section. Skim it; do not
skip it.

### 8.1 Money and prices

- [ ] **Server is the source of truth for prices.** The basket
      carries `priceCents` from the public `GET /api/artworks`
      response. The `OrderService::createFromCheckout` MUST
      re-fetch the artwork inside the transaction and use the
      DB's `price_cents`, not the value the client sent. The
      client can lie. Re-validate the price AND
      `is_available` and `currency` for every item.
- [ ] All money is integer minor units end-to-end. No floats in
      DB, no floats in code paths that touch money.
- [ ] Currency on the order is locked at order creation. Never
      changed by webhook.
- [ ] No money math in JavaScript that produces a value sent
      back to the server. The frontend only displays and
      aggregates for display; the server is authoritative.

### 8.2 Authentication and authorization

- [ ] `POST /api/checkout/session` is public (guest checkout)
      but constrained by the FormRequest.
- [ ] `POST /api/webhooks/stripe` is public, has NO
      `auth:sanctum`, has NO CSRF (excluded via
      `withoutMiddleware`), and verifies the
      `Stripe-Signature` header against
      `STRIPE_WEBHOOK_SECRET` BEFORE parsing anything. Throws
      on invalid signature; returns 400. Never logs the
      payload before verification.
- [ ] Admin routes have BOTH `auth:sanctum` AND the new
      `admin` middleware. The `is_admin` check on the user
      is the final word — token validity is necessary but
      not sufficient.
- [ ] Sanctum tokens are scoped — when a non-admin attempts to
      log in, no token is issued (existing
      `AuthController::login` already handles this).
- [ ] Consider scoping admin tokens to `admin` ability
      (`$user->createToken('admin', ['admin'])`) and adding
      `->middleware('ability:admin')` on admin routes. v2
      cleanup; not strictly required for v1 since the
      `is_admin` boolean is enforced.

### 8.3 Input validation

- [ ] Every user-supplied string has a max length in the
      FormRequest. The DB schema also enforces `varchar(255)`
      etc. — both layers, never one without the other.
- [ ] `customer.shipping.country` is checked against the ISO
      3166-1 alpha-2 list using `Symfony Intl`. Without this,
      Stripe rejects the session with an opaque error.
- [ ] `success_url` MUST be validated to start with
      `config('app.frontend_url')`. Open-redirect mitigation.
- [ ] `artwork_id` values in the checkout request must exist
      (use `exists:artworks,id`). Combined with the
      re-fetch-and-revalidate in the OrderService, this is
      belt-and-braces.

### 8.4 Webhook idempotency and replay safety

- [ ] `StripeEvent::insertOrIgnore` (or equivalent) BEFORE
      processing. Same event id arriving twice → 200 OK,
      no double-charge of inventory.
- [ ] The transaction wraps the event insert AND the order
      mutation. If the order mutation fails, the event row is
      rolled back and Stripe will retry — correct behaviour.
- [ ] Webhook handler is **safe to retry**. Marking paid is
      idempotent (`if ($order->status === Paid) return`).
      Marking cancelled and restoring availability is
      idempotent only if re-restoring is a no-op — guard with
      `if ($order->status === Pending) { ... }`.
- [ ] Log every webhook receipt with its `event.id` and
      `event.type` at `info` level. Log signature failures
      at `warning` level with the request IP.

### 8.5 Concurrency: the "two buyers, one artwork" race

Two users click "Buy" on the same in-stock artwork within
milliseconds. The naive flow:
1. Buyer A reads artwork `is_available = true`.
2. Buyer B reads artwork `is_available = true`.
3. Both call `POST /api/checkout/session`.

Without locking, both succeed and Stripe creates two sessions
for the same piece. The second one will fail at
`capture` time, but it's a bad UX.

**Fix:** `OrderService::createFromCheckout` uses
`Artwork::whereIn('id', $ids)->lockForUpdate()->get()` inside
the transaction. With `lockForUpdate`, the second transaction
blocks until the first commits; when it unblocks, it sees
`is_available = false` and throws `OutOfStockException`,
which the controller maps to HTTP 409 with a clear error.

Test this with a `phpunit` test that fires two concurrent
`POST /api/checkout/session` calls in parallel processes.
Expected: one succeeds (201), one fails (409). See §11.

### 8.6 Data exposure

- [ ] `ArtworkResource` (public) does NOT include
      `description` in the list endpoint. (Gallery already
      has it from a separate state, but we want the public
      list to be slim.)
- [ ] `OrderResource` does NOT include `stripe_payment_intent_id`
      in plain text in the success page response — it does
      in the admin resource. The success page sees only
      `order_number`, `status`, `paid_at`.
- [ ] Logs: never log the raw Stripe payload in
      `production.log` at any level above `debug`. The
      payload contains customer PII.
- [ ] The `customer_email` and `customer_name` ARE stored in
      the DB (you need them to fulfil the order) but make
      sure the orders list endpoint in admin requires the
      `admin` middleware.

### 8.7 CORS and origin

- [ ] No CORS config needed for the production setup
      (frontend and backend share an origin via nginx on
      fly.io).
- [ ] For local dev with `docker compose up`, the same: nginx
      fronts both.
- [ ] If you ever split them across origins, add
      `config/cors.php` allowing only the configured
      `frontend_url` and only the methods actually used
      (GET, POST, PUT, DELETE). Add `supports_credentials =>
      false` — we use Bearer tokens, not cookies.

### 8.8 Rate limiting

- [ ] `POST /api/checkout/session` MUST be rate-limited.
      Add `->middleware('throttle:30,1')` (30 requests per
      minute per IP) to the route definition. Stripe API
      calls cost money; without this, an attacker can drain
      your Stripe quota.
- [ ] `POST /api/webhooks/stripe` MUST NOT be rate-limited
      (Stripe needs to deliver reliably). The signature
      check is the protection.

### 8.9 CSRF

- [ ] Webhook route is excluded from CSRF.
- [ ] All other routes are stateless API routes; CSRF
      doesn't apply. Sanctum stateful auth is not enabled.

### 8.10 Dependency security

- [ ] `composer require stripe/stripe-php` (latest stable,
      v14.x or newer as of writing). Add
      `composer require --dev stripe/stripe-mock` (dev only)
      for unit-testing the gateway.
- [ ] `npm install @stripe/stripe-js@^4` (frontend, exact).
- [ ] No copy-pasted example code that uses deprecated
      `Stripe\Charge::create` — that whole API is gone.

---

## 9. Docker & deploy changes

### 9.1 `backend/Dockerfile`

- Add `RUN apk add --no-cache icu-dev` BEFORE the existing
  `docker-php-ext-install` block (it's already apk-based since
  it's `php:8.3-cli`; check existing Dockerfile — if it's
  debian-based, use `apt-get install -y libicu-dev`). The
  Symfony Intl extension is bundled with PHP 8.3 on the
  official image, but if the validator rule uses
  `Symfony\Component\Intl\Countries`, it needs the intl
  extension. Verify with `php -m | grep intl` inside the
  container; add the install line if missing.
- No other Dockerfile changes — composer install pulls
  `stripe/stripe-php` automatically once
  `composer.json` lists it.

### 9.2 `composer.json`

Add to `require`:
```json
"stripe/stripe-php": "^14.0"
```

`composer install` runs in the container's entrypoint
(`backend/entrypoint.sh:14`).

### 9.3 `docker-compose.yml`

No structural change. The new env vars are picked up via
`env_file: .env`. The webhook endpoint is reachable at
`http://localhost:8080/api/webhooks/stripe` (nginx → backend).

### 9.4 `nginx/default.conf`

- Increase `client_max_body_size` if needed — it's already
  `30m`, which is enough for the existing image upload. No
  change.
- Add a `proxy_read_timeout` for the webhook? Stripe timeouts
  are 30s. The default nginx `proxy_read_timeout` is 60s,
  fine. No change.

### 9.5 fly.io

- The `app/Console/Commands/ExportArtworksToSeeder.php` style
  commands don't need changes.
- `fly.toml` doesn't need changes — the new endpoint is
  served by the same `[http_service]` with `internal_port = 80`
  (nginx).
- The `storage` volume already covers any new files we
  generate (we don't write new files for orders — only DB
  rows and Stripe events).

---

## 10. Implementation order (the exact sequence to follow)

Each step has a clear deliverable. After each step, run the
verification in the rightmost column. **Do not move to the next
step until the verification passes.**

| # | What                                                            | Files touched (paths)                                                                                  | Verification |
|---|-----------------------------------------------------------------|--------------------------------------------------------------------------------------------------------|--------------|
| 1 | Add `stripe/stripe-php` dep, run `composer install`              | `backend/composer.json`, `backend/composer.lock`                                                        | `composer install` exits 0; `vendor/stripe/stripe-php` exists |
| 2 | Write the 4 migrations                                          | `backend/database/migrations/2026_07_06_*_create_orders_table.php` etc.                                 | `php artisan migrate` (in container) succeeds; `\d orders` in psql shows all columns |
| 3 | Add enums                                                       | `backend/app/Enums/OrderStatus.php`, `PaymentStatus.php`, `PaymentProvider.php`                        | `php artisan tinker` → `new OrderStatus('paid')` returns backed enum |
| 4 | Add models                                                      | `backend/app/Models/Order.php`, `OrderItem.php`, `Payment.php`, `StripeEvent.php`; modify `Artwork.php` | `php artisan tinker` → `Order::count()` returns 0 |
| 5 | Add services + interface                                        | `backend/app/Services/PricingService.php`, `OrderService.php`, `StripeGateway.php`; `backend/app/Contracts/PaymentGateway.php` | `App\Contracts\PaymentGateway::class` resolves to `StripeGateway` in container |
| 6 | Add FormRequests + Resources + Policy + Middleware              | `backend/app/Http/Requests/StoreCheckoutRequest.php`, `UpdateArtworkRequest.php`, `UpdateArtworkPriceRequest.php`; `backend/app/Http/Resources/OrderResource.php`, `OrderItemResource.php`, `ArtworkResource.php`; `backend/app/Policies/OrderPolicy.php`; `backend/app/Http/Middleware/EnsureUserIsAdmin.php`; `bootstrap/app.php` | `php artisan route:list` shows the new routes |
| 7 | Add controllers                                                 | `backend/app/Http/Controllers/CheckoutController.php`, `WebhookController.php`, `OrderController.php`; modify `ArtworkController.php` | `php artisan route:list` shows the new controller methods |
| 8 | Wire bindings in `AppServiceProvider`                           | `backend/app/Providers/AppServiceProvider.php`                                                          | `php artisan tinker` → `app(PaymentGateway::class)` returns `StripeGateway` |
| 9 | Add frontend types and basket slice                             | `frontend/src/types/checkout.ts`; `frontend/src/store/basketSlice.ts`; modify `frontend/src/store/index.ts` and `artworksSlice.ts`; add `frontend/src/store/uiSlice.ts` | Open browser console on dev server, dispatch `basket/addItem`, check `localStorage.exibitions_basket` is updated |
| 10| Add BuyButton + BasketDrawer + Header                           | `frontend/src/components/BuyButton/BuyButton.tsx`; `BasketDrawer/...`; `Header/Header.tsx`; modify `Exhibitions.tsx` and `ExhibitionView.tsx` to include the header | Visual: header shows on every page, basket icon shows badge, drawer opens, items can be added/removed |
| 11| Add CheckoutForm + CheckoutSuccess + AdminOrders                | `frontend/src/components/CheckoutForm/...`; `CheckoutSuccess/...`; `AdminOrders/...`; modify `App.tsx` (routes) and `AdminPanel.tsx` (price edit) | E2E test: add to basket, checkout with `4242...`, land on success page, see "Thank you"; admin sees the order |
| 12| Add `.env` keys (local) + fly secrets (prod)                    | root `.env`; `frontend/.env`; `flyctl secrets set ...`                                                  | Stripe test card goes through end-to-end |
| 13| Run the security checklist (§8)                                 | every file                                                                                              | Every box ticked |
| 14| Add tests (see §11)                                             | `backend/tests/Feature/CheckoutTest.php`, `OrderConcurrencyTest.php`, `WebhookIdempotencyTest.php`      | `php artisan test` exits 0 |
| 15| Deploy: `fly deploy`                                            | n/a                                                                                                     | Live test on fly.io with live Stripe keys |

---

## 11. Tests (real, not mocked — see repo convention)

The project uses PHPUnit (`phpunit.xml` exists). Add to
`backend/tests/Feature/`:

### 11.1 `CheckoutTest.php`

- `test_guest_can_create_checkout_session` — POST
  `/api/checkout/session` without a token, valid body, assert
  201, assert response has `session_id` and `url` (use
  `Stripe\Stripe::setApiKey` against `stripe-mock` for
  unit-level tests).
- `test_checkout_with_no_items_returns_422` — assert
  `items` is required.
- `test_checkout_with_invalid_country_returns_422` — assert
  the ISO 3166-1 rule fires.
- `test_checkout_with_open_redirect_url_returns_422` —
  `success_url = 'https://evil.com/x'` → 422.
- `test_checkout_with_unavailable_artwork_returns_409` —
  mark artwork `is_available = false`, attempt checkout,
  assert 409 with `OutOfStockException` mapped correctly.
- `test_checkout_uses_server_price_not_client_price` —
  send a checkout request with a tampered `price_cents` in
  the body (the API doesn't accept `price_cents` from the
  client anyway, but assert the server price wins).
- `test_sold_artwork_does_not_appear_in_browseable_list` —
  after a successful order, `GET /api/artworks` no longer
  includes that artwork.

### 11.2 `OrderConcurrencyTest.php`

- `test_two_buyers_one_artwork` — uses `pcntl_fork` or
  `parallel\Runtime` (if the PHP image has it; otherwise
  spawn two `php artisan tinker --execute='...'` processes
  from the test). Expected: exactly one 201, exactly one 409.

### 11.3 `WebhookIdempotencyTest.php`

- `test_webhook_duplicate_event_id_is_noop` — send the same
  `checkout.session.completed` event twice. Assert the order
  status changes only once, and `stripe_events` has exactly
  one row.
- `test_webhook_invalid_signature_returns_400` — send a
  payload with a bogus signature. Assert 400, assert no
  `stripe_events` row created, assert order untouched.
- `test_webhook_session_completed_marks_order_paid` — happy
  path.
- `test_webhook_session_expired_marks_order_cancelled_and_restores_artwork`.

### 11.4 Frontend tests (optional for v1)

The frontend has no test runner configured. The
`artworksSlice` and `basketSlice` are pure functions and easy
to test. If you add `vitest`:

- `frontend/src/store/basketSlice.test.ts`:
  - `addItem` adds the artwork.
  - `addItem` with an already-present artwork is a no-op
    (one physical piece = one basket row).
  - `removeItem` removes.
  - `clear` empties.
  - `hydrate` with malformed JSON does not throw.

Skip frontend tests for v1; the backend test coverage is the
high-value play.

---

## 12. Out of scope for v1 (do not build these in this phase)

A cheaper model will be tempted to add "just one more thing".
Here is the list of things that are explicitly **out of scope**
to keep the scope tight. If a stakeholder asks for one of
these, write it down for v2.

- Saved baskets across devices (now covered by customer accounts §19).
- Multi-currency (a single order is single-currency).
- Discount codes / promo codes.
- Shipping cost calculation (always 0 in v1).
- Tax calculation (always 0 in v1; Stripe's `automatic_tax`
  is a v2 toggle).
- Refunds flow (Stripe Dashboard only in v1).
- Inventory for editions / prints (one piece = one row).
- Multi-image artworks (one image per artwork, as today).
- Wishlists.
- Reviews / ratings.
- Email notifications (Stripe sends its own receipt; a
  "we received your order" email is v2).
- Subscriptions / recurring payments.
- Cart abandonment emails.
- Multi-language checkout form (English only).
- Apple Pay / Google Pay buttons (Stripe Checkout includes
  them automatically, but no separate code needed).
- A dedicated `/basket` page (the drawer is enough; the URL
  is shareable via the success page only).
- Webhook for `charge.dispute.created` (monitor in Stripe
  Dashboard; v2).
- **Print-on-demand / fulfilment automation (see §16).**

---

## 13. Risk register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Stripe API outage during checkout | Low | High (lost sales) | Show a clear error: "Payment provider unavailable, try again in a few minutes." Do not mark the order cancelled automatically — let the user retry. |
| Webhook signature rotation in prod | Low | High (orders never mark paid) | Document the `STRIPE_WEBHOOK_SECRET` rotation procedure in a runbook (not in this plan). The Stripe CLI's `stripe listen` uses a separate secret. |
| Race condition on last piece | Medium | Medium (one bad UX) | `lockForUpdate` + 409. Covered by `OrderConcurrencyTest`. |
| Bot spam on `POST /api/checkout/session` | Medium | Medium (Stripe quota burn) | Rate limit `throttle:30,1` on the route. Add Cloudflare Turnstile in v2 if abuse appears. |
| Forgotten `STRIPE_SECRET` in prod | Low | High (live deploy with no Stripe = all checkouts 500) | Add a `php artisan` health check command that asserts `config('services.stripe.secret')` is non-empty. Run as part of CI. |
| Refunded piece still marked unavailable forever | Certain (v1 behaviour) | Low | Document in the runbook. v2: add a `refunded_at` flag and re-list the piece on refund if the seller wants. |
| PHP intl not installed in the container | Low | Medium (country validation breaks) | Verify with `php -m | grep intl` first; if missing, add `RUN docker-php-ext-install intl` to the Dockerfile. |
| Frontend `localStorage` quota (5–10MB) | Negligible | Negligible | The basket is < 10KB even with 50 items. No mitigation needed. |

---

## 14. Glossary (for the cheaper model)

- **Hosted Checkout:** a Stripe-hosted payment page. We redirect
  the user to it. We never see card data. PCI scope: SAQ A.
- **Webhook:** an HTTP POST from Stripe to our server when
  something happens (payment succeeded, expired, etc.). Verified
  by HMAC signature.
- **Idempotency:** performing the same operation twice has the
  same effect as performing it once. Required for webhook
  handlers because Stripe may deliver the same event more than
  once.
- **Minor units:** the smallest unit of a currency. USD/EUR have
  100 minor units per major (1 dollar = 100 cents). JPY has 1
  minor unit per major (1 yen = 1 minor unit). Always store
  minor units as integers.
- **Sanctum token:** Laravel Sanctum's personal access token,
  stored in `personal_access_tokens` table. Sent as
  `Authorization: Bearer <token>`.
- **SOLID:** SRP (one class, one job), OCP (open for extension,
  closed for modification), LSP (subtypes substitutable),
  ISP (small interfaces), DIP (depend on abstractions, not
  concretions). Applied in §3: `PaymentGateway` is the
  interface, `StripeGateway` is the implementation, controllers
  depend on the interface.
- **SAQ A:** the lightest PCI compliance level. Available to
  merchants who fully outsource card handling to a PCI-DSS
  validated provider (Stripe Checkout qualifies). No card data
  ever touches our servers.

---

## 15. Acceptance criteria (the final gate)

The feature is **done** when all of these are true:

1. A guest can add an artwork to the basket from
   `ExhibitionView` and from `Gallery` (admin-not-required).
2. The basket drawer opens, shows the items, the subtotal, and
   a "Checkout" button. Removing an item updates the count and
   subtotal instantly.
3. The basket persists across page refresh.
4. Clicking "Checkout" opens the CheckoutForm. Submitting with
   `4242 4242 4242 4242` redirects to Stripe Checkout, then
   back to `/checkout/success?session_id=...`, which shows
   "Thank you, your order EX-YYYYMMDD-XXXXXX is confirmed."
5. The basket is cleared on the success page ONLY after the
   backend confirms `paid`.
6. A declined card (`4000 0000 0000 0002`) returns the user to
   the cancel URL; the basket is preserved.
7. A second guest attempting to buy the same artwork that is
   already in another guest's checkout session receives a
   409 with a clear error and the basket is unchanged.
8. An admin can log in, edit an artwork, set a price and
   currency, save, and the gallery now shows the buy button.
9. An admin can navigate to `/admin/orders` and see all
   orders with their status, filter by status, and view
   order details.
10. `php artisan test` exits 0.
11. The production deploy to fly.io uses live Stripe keys, the
    webhook endpoint is configured in the Stripe Dashboard, and
    a real test card transaction marks the order `paid` via the
    webhook (not just via the success-page poll).
12. The entire §8 security checklist is ticked.
13. (v1.2) A visitor can register, log in, and their shipping
    details + order history persist across sessions and devices.

---

## 16. Print-on-demand & fulfilment (v1.5 — add after buy flow ships)

This section extends the plan with a fulfilment layer. It
assumes the buy flow from §1–§15 is already live. Read this
whole section before touching the order pipeline again — the
changes cut across the `OrderService`, the webhook handler,
and the admin UI.

### 16.1 Why this section exists

The business case (one paragraph, for context): a buyer
pays for a piece via the buy flow above. The piece is a
digital image. To deliver a **physical print**, the seller
either (a) prints and ships it manually, or (b) automates
the print + ship via a print-on-demand (POD) provider.
Option (b) is what this section adds.

**Important product question to answer with the stakeholder
before writing any code:** *what is being sold?*

- **Option A — original digital art, sold as a digital
  download.** No print, no ship. Out of scope for this
  section entirely.
- **Option B — original art, sold as a print.** Each artwork
  has a fixed print spec (size, paper, frame) the buyer
  picks at checkout. POD provider does the print + ship.
  This section is built for this.
- **Option C — open editions, multiple sizes.** The same
  artwork is sold as e.g. A3 / A2 / A1 prints in multiple
  sizes. Same shape as B but with a `variants` table.

This plan covers **Option B** (single fixed print spec per
artwork). Option C is a small extension noted in §16.11.

### 16.2 Provider choice and the SOLID boundary

Default provider: **Printful** (https://www.printful.com).

- REST API, OAuth-style personal token, well-documented.
- Ships globally; supports framed/unframed posters, canvas,
  acrylic, wood, etc.
- Webhooks for shipment status updates.
- Catalog is provider-side; we do NOT mirror their full
  catalog. We let the admin pick ONE Printful variant per
  artwork and remember the variant id.

The integration is hidden behind the same `PaymentGateway`
pattern used for Stripe — a `FulfilmentProvider` interface
and a `PrintfulProvider` implementation. The principle
(§3.3) is identical: the rest of the code never imports
`PrintfulProvider` directly. Swapping to Printify, Gelato,
or a custom print shop is a single new class.

### 16.3 What changes in the data model

Three migrations, prefixed `2026_07_20_*` (use today's date
when you actually write them — the prefix is just sort order
in the migrations directory).

#### 16.3.1 Alter `artworks` — add print spec

| Column                | Type           | Notes |
|-----------------------|----------------|-------|
| `print_variant_id`    | bigint NULL    | Printful variant id (e.g. `4011` for "12×18 poster, no frame"). |
| `print_external_id`   | varchar(64) NULL | Printful's external id — our artwork id echoed back, so we can match webhooks to our order. |
| `print_markup_cents`  | bigint NOT NULL DEFAULT 0 | What we charge the buyer ABOVE Printful's cost. e.g. if Printful costs $25 and we sell for $40, this is 1500 cents. Phase 1: per-artwork flat markup. |
| `print_enabled`       | boolean NOT NULL DEFAULT false | Off by default. Admin must explicitly opt in. |

#### 16.3.2 New table `fulfilment_orders`

One row per Printful order. Created when the buyer's payment
is confirmed by Stripe.

| Column                | Type           | Notes |
|-----------------------|----------------|-------|
| `id`                  | bigserial PK   | |
| `order_id`            | bigint NOT NULL FK → `orders.id` ON DELETE RESTRICT | |
| `provider`            | varchar(32) NOT NULL DEFAULT 'printful' | |
| `provider_order_id`   | varchar(64) NULL | Set after `POST /orders` succeeds. UNIQUE per provider. |
| `provider_external_id`| varchar(64) NULL | The `external_id` we sent (= order number, helps debugging). |
| `status`              | varchar(32) NOT NULL DEFAULT 'pending' | Mirrors Printful's lifecycle: `pending`, `submitted`, `in_production`, `shipped`, `delivered`, `failed`, `cancelled`. |
| `tracking_url`        | varchar(512) NULL | |
| `tracking_number`     | varchar(128) NULL | |
| `cost_cents`          | bigint NULL | What Printful charged US. Stored for accounting. NOT shown to buyer. |
| `currency`            | char(3) NULL | |
| `raw_last_response`   | jsonb NULL | Last Printful API response, for support. |
| `submitted_at`        | timestamptz NULL | |
| `shipped_at`          | timestamptz NULL | |
| `delivered_at`        | timestamptz NULL | |
| `created_at`          | timestamptz NOT NULL | |
| `updated_at`          | timestamptz NOT NULL | |

Indexes: `(order_id)`, `(status)`, unique
`(provider, provider_order_id)`.

#### 16.3.3 New table `fulfilment_events` (webhook idempotency)

Mirror of `stripe_events`, scoped to Printful. Same shape:
`(id varchar PK, type varchar, payload jsonb, received_at
timestamp)`. Printful webhooks are signed with a shared
secret; we verify the signature before persisting.

### 16.4 New PHP enum

`backend/app/Enums/FulfilmentStatus.php` — backed string
enum with the same values as the column above. Add
`isTerminal(): bool` for `delivered`, `failed`, `cancelled`.

### 16.5 New service contracts and implementations

#### 16.5.1 `App\Contracts\FulfilmentProvider`

```php
namespace App\Contracts;

use App\Models\Order;
use App\Models\Artwork;

interface FulfilmentProvider {
    public function submitOrder(Order $order, Artwork $artwork): array;
    // Returns ['provider_order_id' => '...', 'cost_cents' => 2500, 'currency' => 'USD']
    // Throws FulfilmentException on failure (mapped to HTTP 502 upstream).

    public function fetchStatus(string $providerOrderId): array;
    // Returns normalised ['status' => 'shipped', 'tracking_url' => '...', 'tracking_number' => '...']

    public function verifyWebhookSignature(string $payload, string $signatureHeader): bool;
    // True if valid. False to reject. NEVER throw — return bool so the controller can log + 400.
}
```

#### 16.5.2 `App\Services\PrintfulProvider`

- HTTP client: Laravel's `Http::timeout(15)->retry(2, 200)`
  facade. Base URL: `https://api.printful.com/`. Auth header:
  `Authorization: Bearer {PRINTFUL_TOKEN}` from
  `config('services.printful.token')`.
- Webhook secret: `config('services.printful.webhook_secret')`.
  Printful sends the signature in the `X-Printful-Signature`
  header; algorithm is `hmac-sha256` over the raw body.
- `submitOrder()` builds the `order/{id}` body from
  `Order` + `Artwork` and posts to `/orders` (Printful's
  "draft order + confirm" two-step, OR the "create + confirm"
  shortcut — read the Printful docs at execution time and
  pick the one that returns the `id` in one round-trip; the
  structure is the same).
- **Address mapping:** Printful expects
  `address1, city, state_code, country_code, zip`. Our
  `shipping_address` JSONB already has these keys. Map
  one-to-one. `country_code` must be ISO 3166-1 alpha-2
  (same as we validated in §4.1).
- **Items array:** one item per artwork (since v1 is one piece
  per order — §16.11 covers multi-item). Map our
  `print_variant_id` to Printful's `variant_id`. Set
  `external_id = $order->order_number` so Printful's
  `external_id` field echoes our order number.
- **Cost calculation:** Printful returns
  `result.costs.total` in the response. Store it in
  `fulfilment_orders.cost_cents` and `currency`.
- `fetchStatus()` calls `GET /orders/{id}` and normalises
  the `status` string into our `FulfilmentStatus` enum.
- `verifyWebhookSignature()` recomputes the HMAC over the
  raw body with the configured secret and compares with
  `hash_equals`. **Always use `hash_equals`** — never `===`
  (timing-attack safe).

Bind in `AppServiceProvider::register()`:
```php
$this->app->bind(\App\Contracts\FulfilmentProvider::class, \App\Services\PrintfulProvider::class);
```

#### 16.5.3 Extend `OrderService`

Add a new method — do NOT modify the existing
`createFromCheckout`:

```php
public function submitToFulfilment(Order $order): FulfilmentOrder
```

Behaviour:

1. Inside a `DB::transaction`:
   1. Lock the `Order` row (`Order::where('id', $order->id)->lockForUpdate()->first()`).
   2. If `fulfilment_order` already exists for this order, return
      it (idempotent — webhook might have called us first).
   3. Load the `Artwork`. If `artwork.print_enabled` is false
      or `print_variant_id` is null, throw a domain exception
      "Print not enabled for this artwork" — the controller
      surfaces this as 422.
   4. Call `FulfilmentProvider::submitOrder($order, $artwork)`.
   5. Insert a `FulfilmentOrder` row with `status = submitted`.
   6. Commit.
2. Catch `FulfilmentException` and update the row to
   `status = failed` with the error in `raw_last_response`.
   Re-throw.

This method is called from `WebhookController::stripe` in
the `checkout.session.completed` branch — **only after**
`markPaid` succeeds. Order matters: never submit a print job
for an order that might later be reversed.

### 16.6 New controllers

#### 16.6.1 `App\Http\Controllers\FulfilmentWebhookController`

- One method: `printful(Request $r, FulfilmentProvider
  $provider, OrderService $orders)`.
- Read raw body with `$r->getContent()`.
- Verify signature via `verifyWebhookSignature($raw,
  $r->header('X-Printful-Signature'))`. On false, log
  warning with IP, return 400.
- Parse the event JSON. Printful sends
  `{type, data, created}` where `type` is e.g. `package_shipped`.
- Idempotency: insert into `fulfilment_events` with the
  event id (use `data.id` or a hash of `(type, data.id, created)`
  if Printful doesn't give a stable id — verify at
  implementation time). If the insert conflicts on PK, return
  200 and exit.
- Switch on `type`:
  - `package_shipped` → set `status = shipped`,
    `tracking_url`, `tracking_number`, `shipped_at = now()`.
  - `package_delivered` → set `status = delivered`,
    `delivered_at = now()`.
  - `order_failed` → set `status = failed`, surface in admin.
  - `order_canceled` → set `status = cancelled`, mark
    `Order` as `Cancelled` and restore `Artwork.is_available`
    to true. (Buyer was charged — refund is a manual
    Stripe Dashboard action by the admin; surface a clear
    notice in the admin order detail page: "Print
    cancelled — refund required in Stripe Dashboard".)
  - Unknown types → log info, 200.

Add route, NO middleware (webhook), with
`throttle:120,1` (Printful's delivery is bursty; 120/min is
safe):

```php
Route::post('/webhooks/printful',
    [FulfilmentWebhookController::class, 'printful'])
    ->middleware('throttle:120,1');
```

#### 16.6.2 `App\Http\Controllers\Admin\FulfilmentController`

Admin-only. Routes inside the existing
`auth:sanctum + admin` group:

```php
Route::get   ('/admin/fulfilment',           [FulfilmentController::class, 'index']);
Route::get   ('/admin/fulfilment/{order}',   [FulfilmentController::class, 'show']);
Route::post  ('/admin/fulfilment/{order}/resubmit', [FulfilmentController::class, 'resubmit']);
```

- `index` — paginated list of `FulfilmentOrder` with
  filter by status and date range. Joins `orders` for
  the order number, customer email, and total.
- `show` — single fulfilment order with full provider
  payload, timeline (created → submitted → shipped →
  delivered), tracking link as a clickable anchor with
  `target="_blank" rel="noopener noreferrer"`.
- `resubmit` — manual retry. Re-runs
  `OrderService::submitToFulfilment`. Useful when a
  Printful call failed transiently (network, 5xx) and
  the buyer is waiting.

### 16.7 Frontend changes

#### 16.7.1 New Redux slice `frontend/src/store/fulfilmentSlice.ts`

- State: `statuses: Record<orderNumber,
  FulfilmentStatus>` and `tracking: Record<orderNumber,
  { url, number }>`.
- No polling from the public side — fulfilment status
  is an admin concern.

#### 16.7.2 Extend `Artwork` type

Add `print_enabled: boolean`, `print_variant_id: number |
null`, `print_markup_cents: number` (already on the model
after the migration).

#### 16.7.3 New admin page `frontend/src/components/AdminFulfilment/AdminFulfilment.tsx`

Route: `/admin/fulfilment`, behind `<ProtectedRoute>`. Two
views:

- **List view** — table of fulfilment orders. Same visual
  language as `AdminOrders`. Status badges colour-coded
  (green = delivered, blue = shipped, amber = in
  production, red = failed, grey = pending).
- **Detail view** — opens as a modal or sub-route. Shows
  the timeline, the order summary (read-only), the
  shipping address (read-only), tracking link if
  shipped, and a "Resubmit" button (calls
  `POST /api/admin/fulfilment/{order}/resubmit`).
- Add a tab/link in the existing `AdminPanel` "Exhibitions"
  tab nav — or a top-level entry. Keep nav consistent
  with the rest of the admin.

#### 16.7.4 Admin artwork edit — add print fields

In `AdminPanel.tsx` (or wherever the artwork edit form
lives), add a "Print fulfilment" section with:
- A toggle `print_enabled`.
- A text input `print_variant_id` (numeric, with a
  helper tooltip: "Find this in the Printful dashboard
  under your product's variant list").
- A number input `print_markup_cents` (the price
  markup on top of Printful's cost).

These save via the new
`PUT /api/artworks/{id}/print-settings` endpoint (add to
`ArtworkController`, behind admin middleware). Use a new
`UpdateArtworkPrintSettingsRequest` FormRequest with
validation: `print_enabled` boolean, `print_variant_id`
nullable integer, `print_markup_cents` integer min 0 max
99999999.

#### 16.7.5 Buyer-facing change — order status includes fulfilment

The success page (`CheckoutSuccess.tsx`) already shows the
order number and paid status. Add a small "Your print is
being prepared" line (with a subdued style — not a CTA, not
urgent) when the order is `paid` and the artwork has
`print_enabled = true`. The text is generic; the actual
status is admin-only.

### 16.8 Configuration & secrets

#### 16.8.1 `config/services.php`

Add:
```php
'printful' => [
    'token'          => env('PRINTFUL_TOKEN'),
    'webhook_secret' => env('PRINTFUL_WEBHOOK_SECRET'),
],
```

#### 16.8.2 Root `.env` (local)

Add:
```
PRINTFUL_TOKEN=...
PRINTFUL_WEBHOOK_SECRET=...
```

The Printful token is a **personal access token** from
`Settings → API`. Treat it like a Stripe secret: server
only, never in the frontend bundle, never committed.

#### 16.8.3 fly.io secrets

```
flyctl secrets set PRINTFUL_TOKEN=... PRINTFUL_WEBHOOK_SECRET=...
```

#### 16.8.4 Printful webhook setup (manual, one-time)

1. Printful Dashboard → Settings → Webhooks → Add.
2. URL: `https://<your-fly-app>.fly.dev/api/webhooks/printful`.
3. Events: `package_shipped`, `package_delivered`,
   `order_failed`, `order_canceled`.
4. Copy the signing secret into `PRINTFUL_WEBHOOK_SECRET`.

For local dev: Printful does not have a `stripe listen`
equivalent. Options:
- Use a tunnel (ngrok, Cloudflare Tunnel) to expose
  `localhost:8080/api/webhooks/printful` to the internet,
  and point the Printful webhook at the tunnel URL.
- Use `printful-cli` (community) if you find one.
- Or: skip real Printful webhooks locally and trigger the
  handler manually via `php artisan tinker`:
  `app(\App\Contracts\FulfilmentProvider::class)->fetchStatus($providerOrderId)`
  is enough to update the row for local testing.

### 16.9 Testing (extend the existing suite)

Add to `backend/tests/Feature/`:

#### 16.9.1 `FulfilmentTest.php`

Use `Http::fake()` to mock Printful's HTTP layer. No real
Printful calls in CI.

- `test_paid_order_submits_to_fulfilment` — simulate
  `checkout.session.completed` webhook, assert a
  `fulfilment_order` row exists with `status = submitted`.
- `test_unpaid_order_does_not_submit_to_fulfilment` —
  call the Stripe webhook with an event that's NOT
  `checkout.session.completed`; assert no fulfilment
  row.
- `test_resubmit_is_idempotent` — call `/resubmit`
  twice; assert no duplicate `provider_order_id` (or
  assert that the second call is a no-op).
- `test_admin_can_view_fulfilment` — log in as admin,
  `GET /api/admin/fulfilment`, assert 200.
- `test_guest_cannot_view_fulfilment` — assert 403.

#### 16.9.2 `FulfilmentWebhookTest.php`

- `test_package_shipped_updates_status` — POST
  `/api/webhooks/printful` with a valid signed body of
  `type = package_shipped`; assert the row is updated,
  `tracking_url` and `tracking_number` are set.
- `test_invalid_signature_returns_400` — POST with a
  bad signature; assert 400, no `fulfilment_events`
  row, no row update.
- `test_duplicate_event_is_noop` — POST the same
  payload twice; assert only one update, only one
  `fulfilment_events` row.
- `test_order_canceled_restores_artwork_availability`
  — assert `Artwork::find($id)->is_available` becomes
  true again.

### 16.10 Security checklist (extends §8)

- [ ] **Printful token is server-only.** Never
      `import.meta.env.PRINTFUL_TOKEN`. Never
      `config('services.printful.token')` from a
      frontend-included module. The `services.php` config
      file is fine to expose keys-via-env to the server
      process; the secret is the danger if it ever reaches
      a `Vite`-bundled file. Verify by grepping
      `frontend/` for `PRINTFUL` and `printful.token` —
      must be zero hits.
- [ ] **Webhook signature verification is mandatory.**
      Same as Stripe: verify, THEN parse, THEN process.
      Wrong order = attacker can craft fake events.
- [ ] **Address fields from buyer input flow into a
      third-party API** (Printful). They are already
      validated by `StoreCheckoutRequest` (max lengths,
      country ISO check), but add a final `strlen` check
      on each address field at the Printful call site
      with provider's limits (Printful: `address1` max
      256, `city` max 64). If over, truncate or fail
      loudly.
- [ ] **Printful cost vs sale price is logged.** The
      admin order detail page shows both numbers
      (`total_cents` for the buyer, `cost_cents` for
      Printful) so the seller knows their margin.
      The buyer never sees `cost_cents`.
- [ ] **Resubmit is admin-only and rate-limited.** The
      `/resubmit` route gets `throttle:10,1` — 10
      resubmits per minute is generous for a human,
      blocks a runaway script.
- [ ] **Printful call failures do NOT mark the order
      failed.** A Printful 5xx is a transient ops issue.
      The fulfilment order is `failed`; the buyer's
      `Order` remains `paid`. The admin sees the
      discrepancy and acts. This avoids the "buyer's
      money is gone" panic.
- [ ] **No PII in logs.** The shipping address is PII.
      The webhook handler logs `provider_order_id` and
      `type`, NOT the address. The
      `fulfilment_orders.raw_last_response` column is
      admin-only and never logged.
- [ ] **Address normalisation before sending to Printful.**
      The buyer's country is already ISO alpha-2 (validated
      in §4.1). State is optional; if not provided AND
      the country is US/CA/AU, Printful will reject — fail
      the call with a clear error pointing at the admin:
      "US/CA/AU orders require a state". Encode this rule
      in the `OrderService::submitToFulfilment` method.

### 16.11 Out of scope for v1.5 (explicit)

- Multiple print sizes / variants per artwork
  (Option C in §16.1). Would need a `print_variants`
  table and a size selector at checkout.
- Multi-item fulfilment optimisation (printing 3
  posters in one Printful order to save shipping).
  v1 sends one Printful order per `Order`; if
  Option C lands, revisit.
- Mockup generation (Printful can generate a
  preview PNG; we don't surface it in v1).
- Tax handling for the print side (we charge the
  buyer, we don't handle VAT on the print). The
  seller's accountant deals with it.
- Refund automation on `order_canceled` (admin
  clicks "Refund" in Stripe Dashboard by hand).
- Real-time tracking page for the buyer (they get
  an email from Printful; that's enough for v1.5).
- Carrier-specific rate shopping (Printful picks
  the carrier; v1 doesn't override).
- Inventory sync — Printful's stock is real-time
  enough; we don't mirror it. If a variant is out
  of stock at submit time, Printful returns an
  error and we mark the fulfilment `failed`;
  admin resubs or refunds.

### 16.12 Implementation order for §16 (sequenced)

| # | What | Files | Verification |
|---|------|-------|--------------|
| 1 | Migrations | `2026_07_20_*` (3 files) | `php artisan migrate` succeeds; `\d artworks` shows new columns; `\d fulfilment_orders` and `\d fulfilment_events` exist |
| 2 | Enum | `app/Enums/FulfilmentStatus.php` | Tinker: `FulfilmentStatus::from('shipped')` |
| 3 | Eloquent model | `app/Models/FulfilmentOrder.php`, `FulfilmentEvent.php`; modify `Artwork.php` | Tinker: `FulfilmentOrder::count() === 0` |
| 4 | Interface + Printful impl | `app/Contracts/FulfilmentProvider.php`; `app/Services/PrintfulProvider.php`; bind in `AppServiceProvider` | `app(FulfilmentProvider::class)` returns `PrintfulProvider` |
| 5 | Extend OrderService | add `submitToFulfilment` | Existing tests still pass; tinker call succeeds against `Http::fake` |
| 6 | Controllers | `app/Http/Controllers/FulfilmentWebhookController.php`; `app/Http/Controllers/Admin/FulfilmentController.php`; routes in `routes/api.php` | `php artisan route:list` shows `/api/webhooks/printful` and admin routes |
| 7 | FormRequests + Resources | `UpdateArtworkPrintSettingsRequest.php`; `FulfilmentOrderResource.php`; add `print_enabled`, `print_variant_id`, `print_markup_cents` to `ArtworkResource` | Manual request in tinker |
| 8 | Frontend types + admin page | `types/fulfilment.ts`; `components/AdminFulfilment/...`; modify `AdminPanel.tsx` (print fields) | Admin can edit artwork print settings and see them saved |
| 9 | Config + secrets | `config/services.php`; root `.env`; `flyctl secrets set` | Local: printful env var reaches container; prod: secrets applied |
| 10 | Tests | `tests/Feature/FulfilmentTest.php`; `FulfilmentWebhookTest.php` | `php artisan test` exits 0 |
| 11 | Security checklist (§16.10) | every file | All boxes ticked |
| 12 | Deploy + live test | `fly deploy` | Buy a real print in prod with the cheapest Printful variant; verify webhook fires and tracking populates |

---

## 17. Glossary additions (extends §14)

- **Print-on-demand (POD):** a service that prints and ships
  a physical product only after a customer order exists. No
  inventory held by the seller. Printful, Printify, Gelato
  are the big three.
- **Variant id:** the provider's per-product variant
  identifier. e.g. Printful "12×18 Poster, No Frame" has a
  specific numeric id we store on the artwork.
- **External id:** a string the seller sends to the
  provider so the provider can echo it back in webhooks
  and we can match. We use our `order_number`.
- **HMAC:** keyed hash used to sign webhooks. Always
  compare with `hash_equals`, never `===`.
- **Margin:** the difference between what we charge the
  buyer (`order.total_cents`) and what Printful charges us
  (`fulfilment_order.cost_cents`). Logged for accounting,
  not exposed to the buyer.

---

## 18. Risk register — v1.5 additions (extends §13)

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Printful API outage when submitting | Medium | Medium (orders paid, no print in flight) | `OrderService::submitToFulfilment` catches and marks fulfilment `failed`; admin sees and resubmits. Buyer is `paid`, money is safe, print is delayed. |
| Printful variant out of stock at submit time | Low | Medium (one piece, no print) | Printful returns an error; we mark fulfilment `failed`; admin resubs or refunds. The artwork stays `is_available = false` until the admin explicitly restores it. |
| Webhook signature rotation in prod | Low | High (shipments never update) | Document the `PRINTFUL_WEBHOOK_SECRET` rotation procedure; verify the rotation doesn't drop in-flight webhooks. |
| Address rejected by Printful (bad state/country) | Medium | Medium (paid, can't fulfil) | Validate address more strictly in `submitToFulfilment` before sending; on rejection, mark `failed` with a clear message; admin sees "Address invalid for this destination, contact buyer" and refunds. |
| Refunded piece marked unavailable forever | Certain (v1.5 behaviour) | Low | Document; v2: on `charge.refunded`, restore `is_available = true`. |

---

## 19. Customer accounts (v1.2 — add after v1 buy flow ships)

This section layers a returning-customer experience on top
of the v1 guest checkout. The v1 guest flow stays as the
zero-friction default; the account is an opt-in upgrade for
 buyers who want their details and order history saved.

### 19.1 Why this section exists

Two pain points the guest-only flow has:

1. **Repeat buyers re-enter their address every time.** For
   a $4,000 art buyer who comes back twice a year, that is
   friction we can remove.
2. **"Where is my order?"** — there is no self-service order
   history for a guest. They email the admin, who looks it
   up in the Stripe Dashboard. An account lets them see
   their own orders.

### 19.2 Auth decision: re-use Sanctum, do NOT build OAuth

The project already uses Laravel Sanctum for admin tokens.
We extend the same Sanctum setup with a second token ability
(`buyer`) so one auth system serves both admin and customer
roles. No OAuth server, no Passport, no Socialite in v1.2.
Buyers authenticate with email + password; a "forgot
password" reset email is included (uses the existing mail
config).

### 19.3 Data model

Two migrations, prefixed `2026_07_25_*`.

#### 19.3.1 Alter `users` table — add buyer columns

The existing `users` table (admin accounts) gains buyer
columns. Admins and buyers share the same table; the
`is_admin` boolean separates them (already in place for v1).
A NULL password is NOT allowed for buyers — guests have no
row at all.

| Column                | Type           | Notes |
|-----------------------|----------------|-------|
| `password`            | varchar(255) NULL | Already exists for admin; nullable rows are existing admins with random passwords. Make it NOT NULL in the migration only for newly-inserted buyer rows by enforcing in `RegisterRequest`. Do not alter the column itself — risky for existing admins. |
| `default_shipping_address` | jsonb NULL | Last-used shipping address; pre-fills checkout. |
| `email_verified_at`   | timestamptz NULL | Sanctum convention; set on email verification. |
| `stripe_customer_id`  | varchar(255) NULL | Stripe Customer object id, so repeat Stripe Checkout sessions attach to the same Stripe Customer (better receipts, dispute handling). |

NB: `password`, `email_verified_at` columns already exist on
the default `users` table from `0001_01_01_000000_create_users_table.php`.
Only `default_shipping_address` and `stripe_customer_id`
need to be added. Verify by inspecting the existing
migration before writing a new one.

#### 19.3.2 New table `customer_addresses` (saved address book)

A buyer can save multiple shipping addresses (home, studio,
gift recipient). One is marked `is_default` at a time.

| Column        | Type           | Notes |
|---------------|----------------|-------|
| `id`          | bigserial PK   | |
| `user_id`     | bigint NOT NULL FK → `users.id` ON DELETE CASCADE | |
| `label`       | varchar(64) NULL | "Home", "Studio", etc. |
| `line1`       | varchar(255) NOT NULL | |
| `line2`       | varchar(255) NULL | |
| `city`        | varchar(120) NOT NULL | |
| `postal_code` | varchar(20) NOT NULL  | |
| `country`     | char(2) NOT NULL | ISO 3166-1 alpha-2. |
| `state`       | varchar(120) NULL | |
| `is_default`  | boolean NOT NULL DEFAULT false | |
| `created_at`  | timestamptz NOT NULL | |
| `updated_at`  | timestamptz NOT NULL | |

Index: `(user_id)`. Unique partial index on
`(user_id) WHERE is_default = true` so a buyer has at most
one default (use a DB partial unique index for this).

### 19.4 Auth changes — buyer abilities on Sanctum tokens

Modify `AuthController::login` to issue tokens with abilities
that reflect the user's role:

```php
$abilities = $user->is_admin ? ['admin'] : ['buyer'];
$token = $user->createToken('auth', $abilities)->plainTextToken;
```

New controller `CustomerAuthController` (separate from
`AuthController` which is admin-only — keeps SRP clean).
It exposes:

- `POST /api/customer/register` — public, creates a buyer
  user. Uses `RegisterCustomerRequest`. Returns a token.
- `POST /api/customer/login` — public, issues a buyer-token.
- `POST /api/customer/logout` — requires `auth:sanctum` +
  `ability:buyer`. Revokes the current token.
- `GET  /api/customer/profile` — `ability:buyer`. Returns
  the user's name, email, default address, and Stripe
  Customer id.
- `PUT  /api/customer/profile` — `ability:buyer`. Updates
  name, email (triggers re-verification), default address.
- `POST /api/customer/forgot-password` — public, sends the
  reset link (use Laravel's built-in `Password::sendResetLink`).
- `POST /api/customer/reset-password` — public, resets using
  the reset token.
- `POST /api/customer/email/verification` — `ability:buyer`.
  Re-sends the verification email.

### 19.5 Routes additions

Add to `routes/api.php` — public block:

```php
Route::post('/customer/register',           [CustomerAuthController::class, 'register']);
Route::post('/customer/login',              [CustomerAuthController::class, 'login']);
Route::post('/customer/forgot-password',    [CustomerAuthController::class, 'sendResetLink']);
Route::post('/customer/reset-password',     [CustomerAuthController::class, 'resetPassword']);
```

Buyer-only routes (require `auth:sanctum` + `ability:buyer`):

```php
Route::middleware(['auth:sanctum', 'ability:buyer'])->group(function () {
    Route::post  ('/customer/logout',     [CustomerAuthController::class, 'logout']);
    Route::get   ('/customer/profile',    [CustomerAuthController::class, 'profile']);
    Route::put   ('/customer/profile',    [CustomerAuthController::class, 'updateProfile']);
    Route::post  ('/customer/email/verification', [CustomerAuthController::class, 'sendVerification']);

    // Saved addresses
    Route::get   ('/customer/addresses',          [CustomerAddressController::class, 'index']);
    Route::post  ('/customer/addresses',          [CustomerAddressController::class, 'store']);
    Route::put   ('/customer/addresses/{address}',[CustomerAddressController::class, 'update']);
    Route::delete('/customer/addresses/{address}',[CustomerAddressController::class, 'destroy']);

    // Order history
    Route::get   ('/customer/orders', [CustomerOrderController::class, 'index']);
    Route::get   ('/customer/orders/{order}', [CustomerOrderController::class, 'show']);

    // Re-attach a Stripe session to the user's Stripe Customer
    // (the CheckoutController passes the Stripe Customer id when present)
});
```

### 19.6 Order association

The existing `orders` table gets a nullable `user_id`:

| Column   | Type           | Notes |
|----------|----------------|-------|
| `user_id`| bigint NULL FK → `users.id` ON DELETE SET NULL | NULL for guest orders; set when the buyer is logged in at checkout. |

In `OrderService::createFromCheckout`, add an optional
`?User $buyer` parameter. If set, persist `user_id` and
populate `stripe_customer_id` so the Stripe Checkout Session
is attached to the existing Stripe Customer (better receipts,
disputes, and reconciliation).

The frontend sends the buyer token (if logged in) on the
`POST /api/checkout/session` request; the controller passes
`Auth::user()` (nullable) to the OrderService.

### 19.7 Security additions (extends §8)

- [ ] **Buyer tokens have `ability:buyer` only.** They
      cannot hit admin routes — the `ability:admin` middleware
      on admin routes blocks them. Twice-protected.
- [ ] **Passwords are hashed with bcrypt (Laravel default).**
      Never store plaintext; never log; never return in any
      API response.
- [ ] **Email verification:** new registrations get a
      verification email. Unverified buyers CAN check out
      (low friction) but a banner shows in their dashboard.
      Admin cannot be created via the customer register
      endpoint — it sets `is_admin = false` in the
      `RegisterCustomerRequest` rules.
- [ ] **Rate limit the auth endpoints:** `throttle:5,1` on
      `register`, `login`, `forgot-password`, and
      `reset-password`. Stops credential stuffing.
- [ ] **No mass-assignment of `is_admin`:** the
      `RegisterCustomerRequest` explicitly omits `is_admin`
      from accepted fields; the controller hard-codes
      `'is_admin' => false` on insert.
- [ ] **Password reset tokens:** use Laravel's built-in
      `password_resets` table. Tokens expire in 60 minutes
      (config). Do not log the token.
- [ ] **Buyer's order history is scoped by `user_id`:** the
      `CustomerOrderController::show` loads
      `Order::where('user_id', $request->user()->id)->findOrFail($id)`.
      No way to see another buyer's order by id-guessing —
      the 404 blocks it.
- [ ] **Guest checkout stays the default.** No forced
      registration. The login/register buttons are an
      optional shortcut shown in the CheckoutForm when the
      user is not already authenticated as a buyer.
- [ ] **Stripe Customer object:** created on first
      successful checkout for a logged-in buyer, stored in
      `users.stripe_customer_id`, sent in
      `customer` param on subsequent `Session::create`
      calls. Never shared between buyers.

### 19.8 Frontend changes

#### 19.8.1 New Redux slice `customerSlice.ts`

State:
```ts
interface CustomerState {
  token: string | null
  user: { id: number; name: string; email: string; email_verified_at: string | null } | null
  defaultAddress: ShippingAddress | null
  orders: OrderSummary[]
}
```

Persists the token under `localStorage.customer_token`
(separate key from `admin_token`).

#### 19.8.2 New pages

- `/customer/login` — login form. On success, redirect back
  to the page the buyer came from (route state).
- `/customer/register` — register form with name, email,
  password, password confirmation. On success, log in
  immediately (lower friction).
- `/customer/forgot-password` — email entry form.
- `/customer/reset-password` — password reset form (reads
  `token` and `email` from the query string).
- `/customer/profile` — name, email, default address,
  password change. Read-only view of saved addresses with
  edit/delete buttons.
- `/customer/orders` — list of the buyer's past orders with
  status badges and a link to a read-only detail page.

#### 19.8.3 CheckoutForm enhancement

When the buyer is logged in (customer token present):
- Pre-fill `email`, `name`, and shipping fields from
  `defaultAddress`.
- Send the customer token as `Authorization: Bearer <token>`

When NOT logged in:
- Show unobtrusive "Have an account? Log in to save your
  details" link above the form. Does not block guest
  checkout.

#### 19.8.4 Header enhancement

Add to the right side of the persistent Header (`Header.tsx`):
- If logged in: small avatar circle (initial) with dropdown
  showing "My orders", "Profile", "Log out".
- If logged out: small "Log in" link.
- Keep the basket button as-is — auth is always to the right
  of the basket, never in its place.

#### 19.8.5 CheckoutSuccess enhancement

On the success page, if the buyer was a guest and is not
logged in, show a soft prompt below the "Thank you" line:
"Create an account to track this order and check out faster
next time." — this is the conversion hook from guest to
customer. Do NOT show it if the buyer was already logged in
when the order was placed (they're in the order's `user_id`).

### 19.9 Testing additions

Add to `backend/tests/Feature/`:

#### 19.9.1 `CustomerAuthTest.php`

- `test_guest_can_register_as_buyer` — POST
  `/api/customer/register`, assert 201, assert token
  returned, assert `is_admin = false` in DB.
- `test_register_cannot_set_is_admin` — send
  `is_admin: true` in the payload, assert 422 or that the
  value is ignored (decide: reject or silently drop. Pick
  reject, it's safer).
- `test_login_issues_buyer_ability_token` — log in, hit
  `/api/customer/profile`, assert 200. Hit `/api/admin/...`
  route, assert 403.
- `test_logout_revokes_token` — log in, log out, hit
  profile again, assert 401.
- `test_forgot_password_rate_limited` — 6 rapid calls, assert
  429 on the 6th.
- `test_password_reset_requires_valid_token` — POST
  reset-password with a bogus token, assert 422.
- `test_email_verification_link_uses_signed_url` — manual
  flow; ensure the link uses `URL::signedRoute`.

#### 19.9.2 `CustomerOrderTest.php`

- `test_logged_in_buyer_can_see_their_orders` — create an
  order with `user_id = $buyer->id`, GET
  `/api/customer/orders`, assert 200, assert the order is in
  the list.
- `test_buyer_cannot_see_another_buyers_order` — create a
  second buyer, try to GET the first buyer's order by id,
  assert 404.
- `test_guest_buyer_has_no_order_history` — hit
  `/api/customer/orders` without a token, assert 401.

### 19.10 Out of scope for v1.2 (explicit)

- Social login (Google/Apple/Facebook) — v2.
- Two-factor authentication for buyers — v2.
- Saved payment methods in our DB (Stripe Customer carries
  these on their side; we never store card data).
- Wishlists (see §12).
- Order return / RMA flow (admin handles manually).
- Email change requires re-verification (implemented) but no
  cooldown before re-sending the verification email — admin
  can disable a stuck account manually.

---

## 20. Risk register — v1.2 additions (extends §13)

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Credential stuffing on `/customer/login` | Medium | Medium (account takeover, order history PII) | `throttle:5,1` per IP. Strip out verbose error messages — say "Invalid credentials" not "Email not found". Use Laravel's built-in login rate limiter. |
| Buyer forgets password, no recovery | Low | Low (support burden) | Forgot-password flow sends a signed reset link. Token 60min expiry, single-use. |
| Buyer registers with someone else's email | Medium | Low (email owner can't verify, no shipping impact) | Email verification required for any account features that email the buyer (order receipts via Stripe are still sent to the Stripe Customer's email, not ours). |
| Mass-registration bot creates junk accounts | Medium | Low (DB clutter, Stripe Customer id wasted) | `throttle:5,1` on `/customer/register`. v2: add hCaptcha/Turnstile on the register form. |
| Guest buyer later registers and cannot link past guest orders | Certain (v1.2 behaviour) | Low | Document in the help text: "Orders placed as a guest are not linked to your account." v2: allow admin to merge by email match. |
| Buyer's Stripe Customer id wrong/missing | Low | Medium (order not linked in Stripe Dashboard) | `OrderService::submitToFulfilment` checks `is_null($buyer->stripe_customer_id)` — if null, creates the Customer first, then persists it back to `users.stripe_customer_id` inside the same transaction. |

---

*End of plan. v1 (buy flow) is in §1–§15. v1.2 (customer
accounts) is in §19–§20. v1.5 (print fulfilment) is in
§16–§18. v2 candidates in §12 + §16.11 + §19.10.*