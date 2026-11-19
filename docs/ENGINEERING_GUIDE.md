# Engineering Guide — AI-Driven Voucher Monitoring System

> A learning guide and the master plan for this project. Each concept is explained in three parts:
> **What it is**, **Why it matters**, and **How we apply it here**. Section 12 holds a copy of the plan
> that also lives in `/CLAUDE.md`. If the two ever disagree, update both.
>
> Written 2026-11-15. Free-tier limits for hosting change often, so check them again before deploying (Phase 8).

---

## Table of contents

1. [What makes software "legit"](#1-what-makes-software-legit-quality-attributes)
2. [System architecture](#2-system-architecture)
3. [Backend concepts](#3-backend-concepts-laravel)
4. [API design](#4-api-design)
5. [Frontend concepts](#5-frontend-concepts-react)
6. [AI / ML service](#6-ai--ml-service)
7. [Security](#7-security)
8. [Testing strategy](#8-testing-strategy)
9. [DevOps: Git, environments, Docker, CI/CD](#9-devops-git-environments-docker-cicd)
10. [Observability](#10-observability)
11. [Deployment plan (free tools)](#11-deployment-plan-free-tools)
12. [The plan (roadmap copy)](#12-the-plan-roadmap--copy-of-claudemd)
13. [Decisions waiting for approval](#13-decisions-waiting-for-your-approval)
14. [Glossary](#14-glossary)

---

## 1. What makes software "legit" (quality attributes)

Working features are only half of good software. Engineers also judge a system by its
**non-functional requirements**, also called quality attributes:

| Attribute           | Plain meaning                                       | Example in this system                                                       |
| ------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Scalability**     | It handles more users and data without a rewrite    | 10 companies × 50 users today, 100 companies tomorrow, with only config changes |
| **Robustness / Reliability** | It keeps working, or fails safely, when things go wrong | The Python AI service is down and vouchers can still be submitted          |
| **Security**        | Only the right people can see or do the right things | A clerk at Company A can never read Company B's vouchers                  |
| **Maintainability** | Easy to change without breaking things              | Approval rules live in one class, not in 6 controllers                       |
| **Testability**     | You can prove it works automatically                | `php artisan test` checks the full approval workflow in seconds              |
| **Observability**   | When it breaks, you can find out why                | Every error carries a request ID that you can search in the logs           |
| **Consistency / Integrity** | The data never becomes wrong                | Two approvals at the same moment cannot push the budget past its limit       |
| **Usability**       | People can actually use it                          | Loading, Error and Empty states on every screen                               |

Every concept below serves at least one of these. When you learn a new technique,
ask: *which quality attribute does this improve, and what does it cost?* Every choice is a
**trade-off**. Senior engineers are mostly people who are good at judging trade-offs.

---

## 2. System architecture

### 2.1 The options

| Style                 | What it is                                                     | Good for                         | Cost                                                         |
| --------------------- | -------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------ |
| **Monolith**          | One app, one codebase, one deploy                               | Small teams, early products      | Can become a "big ball of mud" without internal boundaries   |
| **Modular monolith**  | One deploy, but the code is split into modules with clear boundaries | Most business apps up to a large scale | Needs discipline to respect the boundaries                 |
| **Microservices**     | Many small services, each deployed on its own and talking over the network | Big orgs, many teams, very different scaling needs | Network failures, distributed data, much more DevOps work |
| **Serverless**        | Functions run on demand by a cloud provider                     | Spiky, event-driven workloads    | Vendor lock-in, cold starts, harder local development          |

### 2.2 Chosen: **Modular Monolith + one ML microservice**

```
                         ┌──────────────────────────────┐
  Browser ──HTTPS──▶     │  React SPA (static files/CDN)│
                         └──────────────┬───────────────┘
                                        │ REST /api/v1  (Sanctum auth, X-Company-ID)
                         ┌──────────────▼───────────────────────────────────────┐
                         │            Laravel API  (modular monolith)            │
                         │  ┌────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐   │
                         │  │ Auth & │ │ Vouchers │ │Approvals │ │  Budgets  │   │
                         │  │Tenancy │ │          │ │(workflow)│ │           │   │
                         │  └────────┘ └──────────┘ └──────────┘ └───────────┘   │
                         │  ┌────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐   │
                         │  │ Admin/ │ │Reporting │ │Notifica- │ │  Audit    │   │
                         │  │ Setup  │ │          │ │  tions   │ │           │   │
                         │  └────────┘ └──────────┘ └──────────┘ └───────────┘   │
                         └───┬──────────────┬─────────────────┬─────────────────┘
                             │              │ jobs            │ HTTP (timeout + fallback)
                      ┌──────▼─────┐  ┌─────▼──────┐   ┌──────▼──────────────────┐
                      │   MySQL    │  │   Queue    │   │ Python ML service       │
                      │ (source of │  │  workers   │   │ (FastAPI + scikit-learn)│
                      │   truth)   │  │ + scheduler│   │ classify / anomaly /    │
                      └────────────┘  └─────┬──────┘   │ forecast                │
                                            │          └─────────────────────────┘
                                            └──▶ OpenAI API (report summaries)
                      Redis (cache + queue), used in production
                      Object storage (attachments, PDFs), used in production
```

**Why this choice:**

- One team (you) builds it, so microservices would add network and DevOps pain with no benefit.
- Python ML really is a different runtime with different scaling needs. Separating
  that one piece is the textbook case for a service boundary.
- A modular monolith can later be split into microservices along the module lines if it ever
  needs to be. Good boundaries now keep that option open.

**Why an HTTP service rather than `shell_exec("python ...")`:** shell execution starts a new Python
process and reloads the model on every call (slow), can't scale separately, has no proper
timeout or health check, and invites command-injection bugs. A small FastAPI service loads the
model once, answers in milliseconds and can be health-checked, restarted and scaled on its own.

### 2.3 Layered architecture inside Laravel

Each request passes through layers, and every layer has one job:

```
Route ─▶ Middleware ─▶ Controller ─▶ Form Request ─▶ Action/Service ─▶ Model (Eloquent) ─▶ DB
          (auth,          (thin:        (validation)     (business        (data +
          tenancy,        HTTP in/out)                    rules,           relationships)
          rate limit)                                     transactions)
                          ◀──────────── API Resource (JSON shape) ◀────────────
```

- **Controllers stay thin.** They take the request, call one Action, and return a Resource.
- **Business rules live in Actions/Services.** Example: `SubmitVoucherAction`, `ApproveVoucherAction`.
  You can call them from a controller, a queued job, a console command or a test.
- **Authorization lives in Policies.** `VoucherPolicy::approve($user, $voucher)`.

### 2.4 Module (folder) layout — proposed

```
backend/app/
├── Domain/                      # one folder per module (bounded context)
│   ├── Tenancy/                 # Company, Department, UserCompanyAccess, CompanyScope
│   ├── Identity/                # User, auth actions
│   ├── Catalog/                 # VoucherCategory, VoucherType, PayeeType
│   ├── Vouchers/
│   │   ├── Actions/             # CreateDraftVoucher, SubmitVoucher, CancelVoucher
│   │   ├── Enums/               # VoucherStatus, PaymentMethod
│   │   ├── Events/              # VoucherSubmitted, VoucherApproved
│   │   ├── Models/              # Voucher, VoucherLineItem, VoucherAttachment
│   │   ├── Policies/
│   │   └── StateMachine/        # allowed transitions
│   ├── Approvals/
│   ├── Budgets/
│   ├── AI/                      # MlClient (HTTP), jobs that call it
│   ├── Reporting/
│   ├── Notifications/
│   └── Audit/
├── Http/
│   ├── Controllers/Api/V1/      # thin controllers grouped by module
│   ├── Middleware/              # ResolveCompany, ForceJson, RequestId
│   ├── Requests/V1/             # Form Requests
│   └── Resources/V1/            # API Resources
└── Support/                     # shared helpers (Money, ApiResponse, Idempotency)
```

The **Dependency Rule**: modules may use `Support/` and other modules' *public* Actions/Events,
but should not reach into another module's internal tables or classes. Example: Approvals fires
`VoucherApproved`, and Budgets **listens** and consumes budget. Approvals never edits
`budget_allocations` directly.

---

## 3. Backend concepts (Laravel)

### 3.1 SOLID principles (the short version)

- **S**ingle Responsibility: a class has one reason to change. `ApproveVoucherAction` approves and does nothing else.
- **O**pen/Closed: extend behaviour without editing working code. A new notification channel means a new Listener, not edits to the approval code.
- **L**iskov Substitution: a subclass must work wherever its parent is expected.
- **I**nterface Segregation: small, focused interfaces. `MlClassifier` and `MlAnomalyDetector` are separate interfaces.
- **D**ependency Inversion: depend on interfaces, not concrete classes. The app depends on the `MlClient` interface, so tests swap in `FakeMlClient`.

### 3.2 Form Requests & API Resources (already a project rule)

- **Form Request** = the validation + authorization gate *before* your code runs. Invalid input never reaches business logic.
- **API Resource** = the one place that decides the JSON shape. You can rename a DB column without breaking the frontend, and you never leak fields like `password`.

### 3.3 Database transactions & ACID

**ACID** = Atomic (all-or-nothing), Consistent, Isolated, Durable.
Creating a voucher writes `vouchers` + `voucher_line_items` + `audit_logs`. If the line items fail,
the voucher must not exist half-made:

```php
DB::transaction(function () use ($data) {
    $voucher = Voucher::create($data['header']);
    $voucher->lineItems()->createMany($data['items']);
    // audit log written inside the same transaction
});
```

### 3.4 Concurrency control (locking): the budget problem

Two officers approve two ₱60,000 vouchers at the **same millisecond** against a ₱100,000 budget.
Both read `used_amount = 0`, both decide "fits", both write. The budget is now overspent. This is a
**race condition**.

- **Pessimistic locking**: lock the row while you work: `BudgetAllocation::whereKey($id)->lockForUpdate()->first()` inside a transaction. The second request waits. Use it for money.
- **Optimistic locking**: no lock. Store a `version` column, and update with `WHERE version = ?`. If 0 rows change, someone else edited first, so return `409 Conflict`. Use it for edit forms ("someone else edited this voucher").

We use **pessimistic locks for budget consumption** and for **voucher number generation**, and
(after approval) **optimistic locking for voucher edits**.

### 3.5 State machine: the voucher lifecycle

The worst bugs in workflow systems come from illegal status jumps (e.g., `rejected → approved`).
A **finite state machine** lists every legal transition in one place:

```
            submit                 officer approves (normal)
  draft ───────────▶ pending ──────────────────────────────▶ approved
    ▲                  │  │ officer approves (AI-flagged or high-value)
    │ returned         │  └──────────────▶ under_review ──supervisor approves──▶ approved
    └──────────────────┤                        │
                       │ officer rejects        │ supervisor rejects / returns
                       ▼                        ▼
                    rejected               rejected / draft
  draft|pending ──cancel (creator)──▶ cancelled
```

> ⚠️ This flow is my **reading** of CLAUDE.md (supervisor approval is mandatory only for AI-flagged/
> high-value vouchers). Confirm it before Phase 3. See §13.

In code: a `VoucherStatus` enum with a `canTransitionTo()` method, and **every** status change goes
through one `TransitionVoucher` action. That action checks the move, writes a `voucher_approvals`
row and an audit log, and fires an event.

### 3.6 Events, Listeners, Jobs & Queues (asynchronous processing)

Some work is **slow** (AI scoring, PDF generation, emails, OpenAI calls). If it runs inside the
HTTP request, the user waits and a failure breaks the request.

- **Event**: "something happened" (`VoucherSubmitted`).
- **Listener**: reacts to it (`QueueAnomalyCheck`, `NotifyOfficers`).
- **Job**: a unit of work put on a **queue** and processed by a **worker** process in the background.
- **Retries with backoff**: a job that fails (the AI service is temporarily down) retries after 10s, 60s, 5min.
- **Failed jobs table**: after the last retry, the job is stored so you can inspect it and retry by hand.

Locally the queue uses the `database` driver (already set in `.env`). Production uses **Redis**
(faster). The code stays the same because the driver is just config.

### 3.7 Scheduler (cron)

`routes/console.php` defines scheduled tasks. Example: `forecast:generate` runs monthly on the 1st and
`budgets:check-thresholds` runs daily. In production a single cron entry (`php artisan schedule:run`
every minute) or a `schedule:work` container drives it all.

### 3.8 Multi-tenancy (company isolation)

Our model is a **shared database with a `company_id` column** (cheapest and simplest to operate). The danger is
that one forgotten `where('company_id', …)` leaks data between companies. Defence in depth:

1. **`ResolveCompany` middleware** reads `X-Company-ID`, checks that the user has a row in `user_company_access`
   (otherwise `403`), and stores the current company in a request-scoped `CurrentCompany` service.
2. **`BelongsToCompany` trait** with an Eloquent **global scope** that adds `where company_id = current`
   to every query on tenant models automatically, and sets `company_id` on create.
3. **Policies** check again: `$voucher->company_id === CurrentCompany::id()`.
4. **Tests** that try to read another company's voucher must get `404`.

> We return **404 rather than 403** for other tenants' records, so attackers can't confirm that a record ID exists.

### 3.9 Performance basics

- **N+1 query problem**: listing 50 vouchers and touching `$voucher->creator->name` in a loop runs 51 queries.
  Fix: eager loading `Voucher::with('creator', 'category')`. Turn on `Model::preventLazyLoading()` in local
  so it throws an error during development.
- **Indexes**: every column you filter or sort by often needs one (`vouchers(company_id, status, created_at)`).
  An index turns a full-table scan into a quick lookup. (Index changes count as schema changes, so they need approval.)
- **Pagination**: never return unbounded lists. `per_page` is capped at 100.
- **Caching**: cache data that is read often and changes rarely (categories, voucher types, dashboard aggregates)
  with **explicit invalidation** when it changes. "There are only two hard things in CS: cache invalidation and naming things."

### 3.10 Money handling

Never use floats for money (`0.1 + 0.2 ≠ 0.3`). Store `DECIMAL(15,2)` in MySQL. In PHP use string/`bcmath`
or integer centavos for arithmetic. In JS format with `numeral`, but send amounts as strings or integer centavos.

### 3.11 Audit logging

Financial systems need to answer: *who changed what, when, from where?* A model **Observer**
(or a trait) writes `audit_logs` with `old_values`/`new_values` JSON on create/update/delete for audited
models. The audit log is **append-only**: no update or delete endpoints, ever.

### 3.12 Configuration & the Twelve-Factor App

[12factor.net](https://12factor.net) is a checklist for cloud-ready apps. The key points for us:

- Config lives in **environment variables** (`.env`), never in code. Commit `.env.example`, never `.env`.
- **Stateless processes**: no user files on the local disk in production (use object storage), and sessions/cache in DB/Redis.
  This is what makes **horizontal scaling** (more copies of the app) possible.
- **Logs to stdout** in containers.
- **Dev/prod parity**: Docker makes your laptop look like production.

---

## 4. API design

### 4.1 REST conventions

- **Resources are nouns, plural**: `/vouchers`, `/vouchers/{id}/line-items`.
- **HTTP verbs carry the meaning**: `GET` reads, `POST` creates, `PATCH` partially updates, `PUT` replaces, `DELETE` removes.
- **Workflow actions** that aren't plain CRUD become **sub-resource actions**:
  `POST /vouchers/{id}/submit`, `POST /vouchers/{id}/approvals` (body: `{action: "approved"|"rejected"|"returned", remarks}`).
- **Safe & idempotent**: `GET` never changes data. `PUT/DELETE` give the same result if repeated.
  `POST` is not idempotent, which is why we add **Idempotency-Key** (§4.6).

### 4.2 Versioning

All routes live under **`/api/v1`**. A breaking change (renaming a field, changing a type) becomes `/api/v2`,
while v1 keeps working until the frontend migrates. Adding a new optional field is **not** breaking.

### 4.3 Status codes we use

| Code | When                                                             |
| ---- | ---------------------------------------------------------------- |
| 200  | OK (read/update)                                                 |
| 201  | Created (+ `Location` header)                                    |
| 204  | No Content (delete)                                              |
| 400  | Malformed request (bad JSON, missing `X-Company-ID`)             |
| 401  | Not logged in                                                    |
| 403  | Logged in but not allowed (a clerk tries to approve)             |
| 404  | Not found, **or belongs to another company**                     |
| 409  | Conflict (invalid state transition, stale version, duplicate key) |
| 422  | Validation failed                                                |
| 429  | Rate limit hit (+ `Retry-After`)                                 |
| 500  | Our bug. Logged with a request ID; details never shown to the user |
| 503  | A dependency is down (e.g. ML service) when it is truly required |

### 4.4 Response envelope (consistent shapes)

```jsonc
// Single resource
{ "data": { "id": 12, "voucher_number": "CV-2026-000012", "status": "pending", ... } }

// Collection (Laravel paginator + Resource)
{ "data": [ ... ], "links": { "next": "..." }, "meta": { "current_page": 1, "per_page": 25, "total": 240 } }

// Error (every error, same shape)
{
  "message": "This voucher can no longer be approved.",
  "code": "VOUCHER_INVALID_TRANSITION",      // machine-readable, frontend switches on it
  "errors": { "amount": ["The amount must be at least 1."] },  // only on 422
  "request_id": "01JD3X9K..."                // matches the server logs
}
```

The frontend shows `message` in toasts, maps `errors` onto form fields (react-hook-form `setError`),
and branches on `code`. This is how "every error has UI" becomes systematic instead of ad-hoc.

### 4.5 Querying: filter, sort, paginate, search

```
GET /api/v1/vouchers?filter[status]=pending&filter[department_id]=3
                    &filter[date_from]=2026-01-01&search=fuel
                    &sort=-created_at&page=2&per_page=25&include=creator,category
```

- `sort=-created_at`: a minus sign means descending.
- Only **allow-listed** fields can be filtered or sorted (prevents slow queries and injection).
- **Offset pagination** (`page=2`) suits admin tables. **Cursor pagination** (`cursor=…`) suits the
  infinite-scroll activity feed and notifications, because it stays fast at large offsets and is stable while new rows arrive.

### 4.6 Idempotency keys

The user double-clicks "Submit", or the network drops and Axios retries, and we get two vouchers.
The client sends `Idempotency-Key: <uuid>` on create/submit. The server stores the key with the response
for 24h. A repeat with the same key returns the **stored** response and creates nothing.

### 4.7 Rate limiting

Laravel `RateLimiter`: e.g. `login` at 5/min per IP+email (stops brute force), `api` at 120/min per user,
and AI classification suggestions at 30/min per user (protects the ML service).

### 4.8 Authentication: Sanctum

- **SPA cookie mode** (recommended): the browser holds an HttpOnly session cookie that JavaScript can't read,
  so XSS can't steal it. It requires the frontend and API on the **same site** (e.g. `app.example.com` +
  `api.example.com`) and CSRF protection via `/sanctum/csrf-cookie`.
- **Token mode** (fallback): a `Bearer` token in the `Authorization` header. It works across any domains, but
  the token must be stored by JS (XSS risk), so keep it short-lived.
- The deployment plan (§11) is built so cookie mode works.

### 4.9 API documentation (OpenAPI)

An **OpenAPI** spec is a machine-readable contract for every endpoint. Tools render it as interactive docs
and can generate clients. Proposed: **Scramble** (`dedoc/scramble`), which builds the spec *automatically*
from Form Requests and Resources, so docs never drift from the code. *(New dependency, so it needs approval.)*

### 4.10 Endpoint map (v1 draft)

```
Auth        POST /auth/login · POST /auth/logout · GET /auth/me · GET /auth/companies
Admin       /admin/companies · /admin/departments · /admin/users · /admin/users/{id}/company-access
            /admin/voucher-categories · /admin/voucher-types · /admin/payee-types      (role: admin only)
Vouchers    GET/POST /vouchers · GET/PATCH/DELETE /vouchers/{id}
            POST /vouchers/{id}/submit · POST /vouchers/{id}/cancel
            /vouchers/{id}/line-items · /vouchers/{id}/attachments
            GET /vouchers/{id}/pdf
Approvals   GET /approvals/inbox · POST /vouchers/{id}/approvals · GET /vouchers/{id}/approvals
Budgets     GET/POST/PATCH /budgets · GET /budgets/{id}/consumption
AI          POST /ai/classify (suggest category while typing) · GET /ai/forecasts
Reports     POST /reports (queued) · GET /reports/{id} · GET /reports/{id}/export?format=pdf|xlsx
Dashboard   GET /dashboard/summary (role-aware, cached)
Notify      GET /notifications (cursor) · PATCH /notifications/{id}/read · POST /notifications/read-all
Audit       GET /audit-logs (read-only)
System      GET /up (health)
```

---

## 5. Frontend concepts (React)

### 5.1 Feature-based folder structure

The current `src/components/{api,store,hooks,pages,...}` groups files by **type**. As apps grow,
grouping by **feature** scales better, because everything about vouchers lives together:

```
frontend/src/
├── app/                 # App.jsx, router, providers, ErrorBoundary
├── lib/                 # axios instance (apiClient), utils, formatters (money, dates)
├── components/ui/       # shadcn primitives (unchanged)
├── components/layout/   # AppShell, Sidebar, TopBar, CompanySwitcher
├── features/
│   ├── auth/            # LoginPage, useAuthStore, authApi, schemas.js
│   ├── admin/           # users, companies, departments, catalog
│   ├── vouchers/        # VoucherList, VoucherForm, voucherApi, voucherSchema
│   ├── approvals/
│   ├── budgets/
│   ├── reports/
│   └── notifications/
└── assets/
```

*Adopted on 2026-11-15. The full, authoritative tree and its rules live in `/CLAUDE.md` under
"Frontend folder structure". The key ideas behind it:*

- **High cohesion, low coupling**: files that change together live together (a feature's API calls, form schema and
  pages). Features depend on shared code, never the other way around.
- **Public API per feature (`index.js`)**: other code imports only what a feature chooses to expose. You can
  refactor a feature's internals without breaking the rest of the app (encapsulation).
- **"Rule of two"**: code starts inside its feature and moves to `components/common` only when a second feature needs it.
  Sharing too early creates abstractions nobody actually needs.
- **The folders mirror the backend modules** (vouchers, approvals, budgets…), so one mental model covers both halves of the system.

### 5.2 Server state vs client state

- **Client state**: UI-only state (sidebar open, selected company, auth user). Zustand handles this well.
- **Server state**: data owned by the backend (voucher lists). It needs caching, deduping, refetching,
  loading/error flags, retries and invalidation after mutations. Hand-writing this in Zustand for
  every screen is the #1 source of bugs in React apps.
- Proposed: **TanStack Query** (`@tanstack/react-query`) for server state. *(New dependency, so it needs approval.)*
  It provides `isPending / isError / data` out of the box, which maps directly onto our
  Loading/Error/Empty rule.

### 5.3 The API layer

One Axios instance (`lib/apiClient.js`) with **interceptors**:

- **Request**: add `X-Company-ID` from `useCompanyStore`, `Accept: application/json`, and an `Idempotency-Key` on POST.
- **Response**: normalise every error into `{ message, code, errors, status, requestId }`. On `401`, clear auth
  and redirect to login. On `403`, show a toast. On network error, show a "You're offline / server unreachable" toast.
- Components never call Axios directly. They call `voucherApi.list(params)` and friends.

### 5.4 Routing & guards

`react-router-dom` with **route guards**: `<RequireAuth>`, `<RequireRole roles={['accounting_officer']}>`, and
`<RequireCompany>` (forces company selection for operational roles). The admin area and the operational area
are separate route trees, which enforces the admin-separation rule in the UI too. **Remember: frontend guards are
UX only. The backend Policies are the real security.**

### 5.5 Forms & validation

`react-hook-form` + `zod` (both installed). One `zod` schema per form gives instant client-side
feedback. The server's 422 `errors` are mapped onto the same fields. Validate on both sides:
the client for UX, the server for truth.

### 5.6 The four UI states + Error Boundaries

Every data view renders **Loading** (skeletons), **Error** (message + Retry), **Empty** (friendly prompt +
primary action) and **Success**. A top-level React **Error Boundary** catches render crashes and shows a
fallback screen instead of a white page.

### 5.7 Performance

- **Code splitting**: `React.lazy()` per route, so the admin bundle isn't downloaded by clerks.
- **Debouncing**: the AI category suggestion fires 500ms after the user stops typing, not on every keystroke.
- **Virtualised/paginated tables** (`@tanstack/react-table` is installed) for large lists.
- **Memoisation** only where profiling shows it helps. Avoid premature optimisation.

### 5.8 Design system & accessibility

Framer tokens map onto Tailwind theme variables (CLAUDE.md table). Use ShadCN/Radix primitives because
they ship keyboard navigation and ARIA. Check colour contrast, focus rings and labels on every input.

---

## 6. AI / ML service

### 6.1 Training vs inference

- **Training** (offline, slow): read historical vouchers, fit the model, save it as a file (`model_v3.joblib`).
- **Inference** (online, fast): load the saved model once at startup and answer predictions over HTTP.

### 6.2 Service shape (FastAPI, proposed)

```
ml-service/
├── app/main.py            # FastAPI app: /health, /classify, /anomaly, /forecast
├── app/models/            # loaded .joblib artifacts (versioned)
├── training/              # train_classifier.py, train_anomaly.py, evaluate.py
├── tests/                 # pytest
└── Dockerfile
```

- Laravel calls it through an `MlClient` interface with a **2–3s timeout**, retries with backoff, and a **shared secret header** (the ML service is never public).
- Every prediction returns a `model_version`, so you can trace which model made which decision.

### 6.3 Robustness: graceful degradation & the circuit breaker

The AI is an **advisor, not a gatekeeper**:

- **Classification down?** The form simply shows no suggestion. The clerk picks a category by hand.
- **Anomaly check down?** The voucher submits normally. The `RunAnomalyCheck` job retries in the background.
  Until it succeeds, the voucher shows "AI check pending". Optional safety rule: treat unscored vouchers as
  requiring supervisor review.
- **Circuit breaker**: after N consecutive failures, stop calling the service for a cool-down period (fail fast),
  instead of making every request wait for timeouts.

### 6.4 ML engineering practices

- **Cold start**: there is no history at first. Seed with realistic sample data and fall back to rules (e.g. z-score on amount) until there's enough data.
- **Evaluation**: hold-out test set; track accuracy/F1 for classification and precision for anomalies. Save the metrics next to each model version.
- **Retraining**: a scheduled job (monthly) retrains on new data. A new model version is promoted only if its metrics are at least as good.
- **Feedback loop**: when a clerk overrides the AI's suggested category, store it, because it becomes training data.
- **Per-company models or features**: keep each tenant's data separate in training too.

### 6.5 OpenAI report summaries

Generated in a **queued job** (never in the request). Send **aggregates only** (totals per category/department),
never raw personal data. Set a token limit and a timeout, store the result in `financial_reports.ai_summary`, and fall back
to "Summary unavailable — retry" in the UI.

---

## 7. Security

Mapped to the **OWASP Top 10**, the industry list of the most common web vulnerabilities:

| Risk                         | Our defence                                                                                   |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| Broken access control (#1)   | Policies on every action; tenancy global scope; admin blocked from voucher routes; tests for each |
| Cryptographic failures       | HTTPS everywhere; bcrypt/argon passwords (Laravel default); secrets only in env               |
| Injection                    | Eloquent/query builder bindings; allow-listed sort/filter fields; no `shell_exec` with input  |
| Insecure design              | State machine; budget locking; idempotency; segregation of duties (creator can't approve their own voucher) |
| Security misconfiguration    | `APP_DEBUG=false` in prod; strict CORS allow-list; Telescope disabled/protected in prod        |
| Vulnerable components        | `composer audit`, `npm audit`, Dependabot in CI                                                |
| Auth failures                | Login rate limit; HttpOnly cookies; session regeneration on login; logout invalidates session |
| Integrity failures           | Signed/temporary URLs for attachment downloads; CI builds artifacts, never hand-edited on server |
| Logging & monitoring failures| Audit logs + Sentry + request IDs                                                             |
| SSRF                         | ML service URL comes from config only, never from user input                                  |

Extra rules for **file uploads**: validate MIME type *and* extension, enforce a size limit, store files outside the public web root
with a random name, and serve them through an authorized controller or a temporary signed URL.

**Segregation of duties** (a finance-specific control): the person who creates a voucher can never approve it, even if
they also hold an approver role in another company.

> Note: `spatie/laravel-permission` is installed, but roles are also a column on `users`. Pick **one** source of
> truth to avoid drift. See §13.

---

## 8. Testing strategy

### 8.1 The testing pyramid

```
        ▲  few, slow, realistic
       ╱E2E╲          Playwright: login → create → submit → approve (happy path per role)
      ╱─────╲
     ╱Feature╲        Laravel HTTP tests: each endpoint, each role, each status code, tenancy leaks
    ╱─────────╲       React Testing Library: components with mocked API
   ╱   Unit    ╲      State machine, money math, ML preprocessing, zod schemas
  ╱─────────────╲  many, fast, isolated
```

### 8.2 What "done" means for a backend endpoint

A feature test covering: the happy path · validation (422) · unauthenticated (401) · wrong role (403) ·
other company's record (404) · invalid state (409). That's six tests per endpoint, and these are what
make refactoring safe.

### 8.3 Tools

| Layer    | Tool                                    | Status                         |
| -------- | --------------------------------------- | ------------------------------ |
| Backend  | PHPUnit (installed), factories, `RefreshDatabase` on a **separate test DB** | ready |
| Backend  | Larastan (static analysis)              | needs approval                 |
| Frontend | Vitest + React Testing Library + MSW     | needs approval                 |
| E2E      | Playwright                              | needs approval (Phase 7)       |
| ML       | pytest                                  | part of ML service setup       |
| Load     | k6 (free, CLI)                          | Phase 7, optional              |

**TDD** (test-driven development): write a failing test, make it pass, then refactor. Try it on the state machine first,
because it's pure logic and the best place to learn the habit.

---

## 9. DevOps: Git, environments, Docker, CI/CD

### 9.1 Git workflow

The repo currently has **no commits**, so step one is an initial commit.

- **Trunk-based with short-lived branches**: `main` is always deployable. Work happens on `feat/login-page`,
  `fix/budget-race` and so on, and merges through a **Pull Request** (even solo: you review your own diff and CI runs).
- **Conventional Commits**: `feat(vouchers): add submit endpoint`, `fix(auth): ...`, `docs: ...`. This gives a readable history and automatic changelogs.
- **Never commit**: `.env`, `vendor/`, `node_modules/`, `dist/`, uploaded files, model binaries over a few MB.

### 9.2 Environments

| Env        | Where                         | Purpose                                     |
| ---------- | ----------------------------- | ------------------------------------------- |
| local      | XAMPP now → Docker later      | development                                 |
| testing    | separate MySQL DB / CI        | automated tests (never your dev DB!)        |
| staging    | Pages preview deploys + local Docker | try a release before prod             |
| production | Oracle VM + Cloudflare Pages  | real users                                  |

### 9.3 Docker

A **container** packages the app together with its exact runtime (PHP version, extensions, Python libs). *"Works on my machine"*
becomes *"works on every machine"*. **Docker Compose** describes the whole stack in one file:

```
services: nginx · app (php-fpm) · queue (php artisan queue:work) · scheduler (schedule:work)
          mysql · redis · ml (FastAPI)
```

The same image runs as `app`, `queue` and `scheduler` with different commands. That shows **process types** scaling separately (12-factor).

### 9.4 CI/CD with GitHub Actions (free for public repos; free minutes for private)

- **CI (Continuous Integration)**, on every push/PR: Pint (format) → Larastan → PHPUnit · ESLint → Vitest → `vite build` · pytest.
  A red build blocks merge.
- **CD (Continuous Deployment)**, on merge to `main`: build Docker images → push to GitHub Container Registry (free) →
  SSH to the server → `docker compose pull && up -d` → run migrations → health-check `/up`. Cloudflare Pages
  auto-deploys the frontend from Git.

### 9.5 ⚠️ The schema problem (must be solved before deployment)

The live DB is the source of truth and the migrations are incomplete. That works on one laptop, but a new server
(or the test DB, or CI) can't rebuild the schema. Proposed fix (your approval required, §13):
make the existing SQL snapshot an official **schema baseline**. Laravel natively supports
`database/schema/mysql-schema.sql`, loaded by `php artisan migrate` on an empty DB, followed by **new** migrations for every
change from then on. Old migration files would be archived rather than edited, so nothing in the live DB changes.

---

## 10. Observability

The "three pillars":

- **Logs**: structured (JSON) logs with a `request_id`, `user_id` and `company_id` on every line. A `RequestId` middleware
  sets the ID and returns it in the `X-Request-ID` header and error responses.
- **Metrics**: request rate, error rate, latency (p95), queue depth, failed jobs. Start simple with Laravel Pulse *(needs approval)* or the provider dashboards.
- **Traces / errors**: **Sentry** (free tier) on both backend and frontend shows the stack trace, user, release and breadcrumbs.

Plus **health checks** (`/up` for Laravel, `/health` for ML) watched by **UptimeRobot** (free), which emails you when the site goes down.
**Telescope** (installed) is for local debugging only. Disable it or put it behind admin auth in production.

---

## 11. Deployment plan (free tools)

### 11.1 Recommended setup

| Piece                      | Tool (free)                                  | Why                                                                                 |
| -------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------- |
| **Frontend (SPA)**         | **Cloudflare Pages**                         | Free global CDN, unlimited bandwidth, auto-deploy from GitHub, preview URL per PR  |
| **Backend + workers + ML + MySQL + Redis** | **Oracle Cloud "Always Free" VM** (ARM Ampere) running Docker Compose | The only free tier generous enough (multi-core ARM, ~24 GB RAM) to run *everything*, including queue workers and cron. Real server experience (Linux, SSH, firewall) |
| Reverse proxy + HTTPS      | **Caddy** (in Docker)                        | Automatic free Let's Encrypt certificates, simple config                            |
| DNS / domain               | **Cloudflare DNS** + a domain                | A cheap domain (~$1–10/yr) is strongly recommended so `app.` and `api.` share a site (Sanctum cookie auth). Free fallback: DuckDNS subdomain + Bearer-token auth |
| File storage (attachments, PDFs) | **Cloudflare R2** (10 GB free, no egress fees) or Oracle Object Storage | Keeps the app stateless; S3-compatible |
| Backups                    | Nightly `mysqldump` → R2 (cron container)    | A backup you've never restored is not a backup, so test a restore once            |
| Container registry         | **GitHub Container Registry**                | Free with GitHub                                                                    |
| CI/CD                      | **GitHub Actions**                           | Free minutes                                                                        |
| Error tracking             | **Sentry** (free developer plan)             | Backend + frontend                                                                  |
| Uptime                     | **UptimeRobot** (free)                       | Pings `/up` every 5 min                                                             |
| Email (optional)           | **Brevo** or **Resend** free tier            | Password reset / notification emails                                                |
| AI summaries               | OpenAI API                                   | ⚠️ Not free: pay-per-use (GPT-4o-mini costs cents). Set a monthly spend cap.          |

### 11.2 Fallback if Oracle signup fails

Oracle requires card verification and sometimes has no ARM capacity in a region. Fallback stack:
**Render** (free web service for Laravel via Docker, but it *sleeps after inactivity* and the free tier has no background
workers) + **TiDB Cloud Serverless** or **Aiven** (free MySQL-compatible DB) + **Upstash** (free Redis) + ML on a second
Render service. Downside: no free always-on queue worker, so jobs would need a workaround. That's why Oracle is plan A.

### 11.3 Production topology

```
 Users ─▶ Cloudflare (DNS/CDN) ─┬─▶ app.yourdomain  → Cloudflare Pages (React build)
                                └─▶ api.yourdomain  → Oracle VM
                                                       └ Caddy :443
                                                          ├─ nginx/php-fpm  (Laravel API)
                                                          ├─ queue worker(s)
                                                          ├─ scheduler
                                                          ├─ ml (internal only, no public port)
                                                          ├─ mysql (internal only)
                                                          └─ redis (internal only)
```

Only ports 80/443 (and SSH with key-only login) are open. The database and ML service are never exposed to the internet.

### 11.4 How this scales later

Free tier today → paid later without a redesign: move MySQL to a managed DB, run 2+ `app` containers behind a load balancer
(possible because the app is stateless), add more queue workers, and add read replicas for reports. The architecture already allows it.

---

## 12. The plan (roadmap) — copy of CLAUDE.md

> The frame-by-frame Framer workflow continues inside these phases. Each pasted frame gets built
> on top of the foundation laid here. Tests and docs are written **within** each phase, not at the end.

### Phase 0 — Foundation *(do first)*
- [ ] Initial Git commit; `.gitignore` review; `.env.example` for backend and frontend
- [ ] Decide the open questions in §13 (schema baseline, role source of truth, voucher flow, dependencies)
- [ ] Backend skeleton: `routes/api.php` registered under `/api/v1`, `ForceJson` + `RequestId` middleware, standard error envelope in `bootstrap/app.php`, `ApiResponse` helper
- [ ] Separate **testing database** + first feature test (`GET /up`)
- [ ] Frontend skeleton: `apiClient` with interceptors, router with guards, ErrorBoundary, toast setup, Tailwind tokens from Framer
- [ ] Code quality: Pint (backend), ESLint (frontend), Conventional Commits
- **Concepts learned:** Git workflow, layered architecture, 12-factor config, API envelope

### Phase 1 — Auth, Tenancy & Audit
- [x] Sanctum SPA login/logout/me (Login UI 2 `p0wwkrh66`) + login rate limit (done 2026-11-15)
- [ ] `ResolveCompany` middleware, `CurrentCompany` service, `BelongsToCompany` global scope
- [ ] Role middleware/policies; admin vs operational route trees
- [ ] Audit log observer (append-only)
- [ ] Frontend: auth store, company switcher, `RequireAuth/RequireRole/RequireCompany`
- **Concepts:** authentication vs authorization, multi-tenancy, defence in depth, observers

### Phase 2 — Admin module
- [x] Admin landing page / dashboard (`Nhw7N27tM`): `GET /api/v1/admin/dashboard`, `role:admin` middleware (done 2026-11-15)
- [ ] CRUD: companies, departments, users (Create user modal `lmhV2DJV1`), company access, categories, voucher types, payee types
- [ ] Filtering/sorting/pagination conventions; caching of catalog lookups
- **Concepts:** REST resource design, pagination, caching + invalidation

### Phase 3 — Voucher core
- [ ] Draft CRUD with line items (transaction), attachments (secure upload), voucher numbering (locked sequence)
- [ ] `VoucherStatus` enum + state machine + `TransitionVoucher` action
- [ ] Submit with Idempotency-Key; cancel
- [ ] PDF export (DomPDF)
- **Concepts:** ACID transactions, state machines, idempotency, file security, money handling

### Phase 4 — Approval workflow & Budgets
- [ ] Approval inbox per role; approve/reject/return with remarks; segregation of duties
- [ ] Routing: AI-flagged/high-value → supervisor (step 2)
- [ ] Budget consumption with `lockForUpdate`; threshold alerts
- [ ] Events → Listeners → in-app notifications (queued)
- **Concepts:** pessimistic locking, race conditions, event-driven design, queues & retries

### Phase 5 — AI service
- [ ] FastAPI ML service + `/health`; `MlClient` interface + fake for tests; timeout/retry/circuit breaker
- [ ] Classification (TF-IDF + Naive Bayes), debounced suggestion in the form
- [ ] Anomaly detection (Isolation Forest) as a queued job on submit; graceful degradation
- [ ] Forecasting (Linear Regression) scheduled monthly → `ai_forecasts`
- [ ] OpenAI narrative summaries (queued, aggregates only, spend cap)
- **Concepts:** service boundaries, training vs inference, model versioning, graceful degradation

### Phase 6 — Reports & Dashboards
- [ ] Role-aware dashboard summary endpoint (cached aggregates); Recharts
- [ ] Financial reports generated by queued jobs; PDF/XLSX export
- **Concepts:** aggregation queries, indexes, caching, async report generation

### Phase 7 — Hardening
- [ ] Test coverage on all endpoints (6-case rule); E2E happy paths
- [ ] Security review against the OWASP table; `composer audit` / `npm audit`
- [ ] Performance: index review, N+1 check (`preventLazyLoading`), optional k6 load test
- [ ] OpenAPI docs published
- **Concepts:** testing pyramid, OWASP, profiling

### Phase 8 — Deployment
- [ ] Dockerfiles (app, ml) + `docker-compose.yml` (+ prod override)
- [ ] GitHub Actions CI (lint, test, build) → CD (images to GHCR → deploy to VM)
- [ ] Oracle VM: firewall, SSH keys, Docker, Caddy HTTPS; Cloudflare Pages for frontend; DNS
- [ ] R2 for files, nightly DB backups + one test restore, Sentry, UptimeRobot
- **Concepts:** containers, CI/CD, reverse proxies, TLS, backups, monitoring

---

## 13. Decisions waiting for your approval

Per our working rules, none of these happen until you say yes:

| # | Decision                                                                                       | My recommendation |
|---|------------------------------------------------------------------------------------------------|-------------------|
| 1 | **Schema baseline**: adopt the SQL snapshot as `database/schema/mysql-schema.sql`, archive old migrations, all future changes as new migrations | Yes, it's required to deploy and test |
| 2 | **Voucher flow** in §3.5 (officer can final-approve normal vouchers; flagged/high-value go to supervisor; "returned" goes back to draft). What counts as "high-value", a fixed amount per company? | Confirm/adjust |
| 3 | **Roles source of truth**: `users.role` column vs `spatie/laravel-permission`                 | Keep `users.role` (4 fixed roles); remove Spatie later if unused |
| 4 | **Schema additions** (later phases): `vouchers.version` (optimistic lock), voucher number sequence table, `idempotency_keys` table, indexes on `vouchers(company_id,status,created_at)` | Approve per phase |
| 5 | **Backend deps**: `dedoc/scramble` (API docs), `larastan/larastan` (dev), `predis/predis` or phpredis ext (prod), `sentry/sentry-laravel`, `league/flysystem-aws-s3-v3` (R2) | Approve per phase |
| 6 | **Frontend deps**: `@tanstack/react-query`, `vitest` + `@testing-library/react` + `msw` (dev), `@playwright/test` (dev, Phase 7), `@sentry/react` | React Query in Phase 0; the rest later |
| 7 | ~~**Frontend restructure** to `features/` folders (§5.1)~~                                     | ✅ Adopted 2026-11-15 (tree in CLAUDE.md) |
| 8 | **Tooling installs**: Docker Desktop (Phase 8 at the latest), Python 3.12 venv for the ML service (Phase 5) | When the phase starts |
| 9 | **Domain**: buy a cheap domain for production (enables secure cookie auth)                     | Yes, before Phase 8 |

---

## 14. Glossary

- **ACID**: Atomicity, Consistency, Isolation, Durability, the guarantees of a DB transaction.
- **Bounded context / module**: a part of the system with its own models and rules (Vouchers, Budgets).
- **Circuit breaker**: stops calling a failing dependency for a while so failures don't cascade.
- **CI/CD**: automatically test every change (CI) and automatically ship passing changes (CD).
- **Container**: a lightweight, portable package of an app plus its runtime.
- **Cursor pagination**: paginating by "items after this ID" instead of page numbers.
- **Defence in depth**: several independent security layers, so one mistake isn't fatal.
- **Eager loading**: loading related records in one extra query instead of one per row (fixes N+1).
- **Graceful degradation**: when a part fails, the system keeps working with reduced features.
- **Horizontal scaling**: adding more copies of a service, as opposed to vertical (a bigger machine).
- **Idempotent**: doing it twice has the same effect as doing it once.
- **Multi-tenancy**: one system serving many isolated customers (companies).
- **N+1 problem**: 1 query for a list + N queries for each item's relation.
- **Observability**: being able to understand the system's internal state from its outputs (logs, metrics, traces).
- **Optimistic / pessimistic locking**: detect conflicts at write time vs prevent them by locking up front.
- **Race condition**: a bug whose outcome depends on the timing of concurrent operations.
- **Reverse proxy**: a server in front of your app handling TLS, routing and compression (Caddy, Nginx).
- **Stateless**: the server keeps no per-user memory between requests, so any copy can serve any request.
- **State machine**: a model of allowed states and the transitions between them.
- **Twelve-Factor App**: a methodology for building portable, scalable web services.
