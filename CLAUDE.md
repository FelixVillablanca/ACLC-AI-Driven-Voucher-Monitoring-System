# AI-Driven Voucher Monitoring System

## Tech Stack Quick Guide

- **Frontend:** React 19 (Vite), Tailwind CSS, ShadCN UI, Zustand, Axios, Recharts, date-fns, framer-motion, lucide-react, numeral, radix-ui, react-dom, react, react-hook-form, react-hot-toast, react-icons, react-pdf, react-router-dom, tw-animate-css, xlsx, zod,
- **Backend:** Laravel 13 (PHP 8.3, per composer.json), REST API, Sanctum Auth, DomPDF (Voucher PDF export)
- **Database:** MariaDB 10.4 (MySQL-compatible) via XAMPP: `AI_Driven_Voucher_Monitoring_System_Database` on localhost:3306. Tests use `ai_driven_voucher_monitoring_system_testing`.
- **AI Stack:** Python (scikit-learn via shell execution/API for ML), OpenAI API (for narrative report summaries)

## Core Architectural Rules

1. **Separation of Admin:** The `admin` role is STRICTLY system administration (Companies, Departments, Users, Company Access, Categories, voucher types, and payee types). Admin has ZERO access to voucher operations or financial workflows.
2. **4-Role Operational Pipeline:**
   - `admin`: Setup and system management (outside operational flow).
   - `accounting_clerk` (Issuant): Selects company, creates/submits vouchers for employees.
   - `accounting_officer`: Level 1 review, budget management, initial approval/rejection.
   - `supervisor_manager`: Level 2 final approval, mandatory approval for AI-flagged/high-value vouchers.
3. **Dynamic Company Switching:**
   - Multi-tenant model per user via `user_company_access` table.
   - React state (`useCompanyStore`) sends `X-Company-ID` in Axios headers.
   - Backend automatically scopes queries using `company_id`.

## Database Schema (Core Tables & Key Columns)

- `companies`: (id, name, type, address, logo, is_active)
- `departments`: (id, company_id, name, code, head_user_id)
- `users`: (id, employee_id, first_name, last_name, email, role ['admin', 'accounting_clerk', 'accounting_officer', 'supervisor_manager'], department_id, company_id)
- `user_company_access`: (id, user_id, company_id, granted_by)
- `voucher_categories`: (id, company_id [nullable], name, code, description)
- `voucher_types` : (id, name, company_id)
- `payee_types` : (id, name, company_id)
- `vouchers`: (id, voucher_number, voucher_type_id, company_id, department_id, created_by, payee_name, payee_type_id, payment_method, category_id, amount, status ['draft','pending','under_review','approved','rejected', 'cancelled'], ai_category_suggestion, ai_category_confidence, ai_anomaly_flag, ai_anomaly_score, ai_anomaly_reason)
- `notifications` : (id, recipient_id, title, message, voucher_id, is_read, type ['voucher_approved', 'voucher_rejected', 'voucher_pending', 'anomaly_flagged', 'budget_alert'])
- `voucher_line_items`: (id, voucher_id, description, quantity, unit, unit_price, total_price)
- `voucher_approvals`: (id, voucher_id, approver_id, role_at_time, step [1=accounting_officer, 2=supervisor_manager], action ['approved','rejected', 'returned', 'noted'], remarks)
- `voucher_attachments`: (id, voucher_id, uploaded_by, file_name, file_path, file_type, file_size_kb)
- `budget_allocations`: (id, company_id, department_id, fiscal_year, total_budget, used_amount, alert_threshold_pct)
- `ai_forecasts`: (id, company_id, department_id, forecast_for_month, predicted_spend, confidence_score)
- `financial_reports`: (id, company_id, department_id, report_type, period_start, period_end, total_vouchers, total_amount, ai_summary)
- `audit_logs`: (id, user_id, company_id, action, table_name, record_id, old_values, new_values, ip_address)

## AI Architecture Summary

1. **Auto Classification:** TF-IDF + Naive Bayes (Python) analyzes `vouchers.description` on input -> returns suggested category and confidence score.
2. **Anomaly Detection:** Isolation Forest (Python) runs on voucher submission -> checks amount variance vs. historical averages per department -> sets `ai_anomaly_flag` and `ai_anomaly_reason`.
3. **Budget Forecasting:** Linear Regression (Python) scheduled command runs on 1st of month -> writes predictions to `ai_forecasts`.
4. **Report Summaries:** OpenAI API (GPT-4o-mini) called by Laravel -> generates narrative summary for financial reports.

## Code Conventions

- Frontend components must handle Loading, Error, and Empty states using Tailwind CSS and ShadCN components.
- Laravel controllers must use Form Requests for validation and API Resources for JSON serialization.
- Wrap multi-table modifications inside `DB::transaction()`.

## Framer

- the design of this system will be on Framer the current active MCP Plugin, Project name: AI-Driven-Voucher-Monitoring-System-Design
- you will be designing the UI in here first before getting it into the Development on this Project

### Framer → Code Workflow (MANDATORY when building any UI screen)

The Framer MCP server is configured in `.mcp.json` at the project root, so every Claude Code session opened in this folder (CLI or VS Code extension) can read the designs. Before coding a screen:

1. Find the frame: use the node id in the table below, or ask the user for the frame link (`...?node=<nodeId>`). `getNodeXml` on the whole canvas page (`augiA20Il`) times out because it's too large, so always fetch individual frames by node id.
2. Read it with `mcp__framer__getNodeXml` (large frames get saved to a file; grep that file instead of reading it all at once).
3. Translate it into React + Tailwind + ShadCN components using the token mapping below. Never hard-code hex values that already exist as a token.
4. The Framer frames show one static state. In code, also add the Loading, Error and Empty states (see Code Conventions).
5. Swap the placeholder data in the designs (names, amounts, scores) for real API data.

#### Designed frames (canvas page `augiA20Il`)

| Frame                                                   | Node id     | Notes                                                                                                                                                                                                              |
| ------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Admin dashboard: Create user modal (from Quick actions) | `lmhV2DJV1` | Admin layout (240px dark sidebar, 64px top bar, stat cards, recent activity, quick actions) + 760px modal: personal info, 4-role radio cards, company/department selects, company-access checkboxes, invite toggle |
| Login UI 2 (centered card) **BUILT**                    | `p0wwkrh66` | 420px card on Primary Dark background with glow rings + 4 floating preview cards (approved, AI anomaly, budget, forecast). Code: `features/auth/pages/LoginPage.jsx`                                               |
| Login UI 3 (hero banner split)                          | `XJ4eU6eCT` | 720px navy hero panel showing `VM-hero-banner.png` (place it in `frontend/src/assets/`; its background is Hero/Navy, so it blends in) + 3 feature columns; 480px white form panel. Uses the Hero palette below     |

Add a row here whenever a new frame is designed.

#### Frame → phase map (Claude decides; the user doesn't track phases)

When the user pastes a frame, decide its phase from what it shows:

| Phase | What the frame shows |
| ----- | -------------------- |
| 1 | Login, forgot password, company selection |
| 2 | Admin screens: users, companies, departments, company access, categories, voucher/payee types, admin dashboard |
| 3 | Voucher list, create/edit, details, line items, attachments, PDF |
| 4 | Approval inbox, approve/reject/return, budgets, notifications |
| 5 | AI suggestions, anomaly panels, forecasts |
| 6 | Operational dashboards, reports, charts |

If the frame needs foundation from an earlier phase that isn't built yet (for example, an admin frame before auth exists), build that minimal foundation first and explain it simply. Tell the user which phase the frame belongs to.

#### Everyday commands

| Do this | Run (folder) |
| ------- | ------------ |
| Start the API | `php artisan serve` (backend), served on :8000 |
| Start the React app | `npm run dev` (frontend), served on :5173; `/api` is proxied to :8000 |
| Run all backend tests | `php artisan test` (backend). Uses the `_testing` DB only |
| Fill the test DB with demo data | `php artisan db:seed --env=testing` (backend) |
| Tidy PHP code | `vendor/bin/pint` (backend) |
| Check frontend code | `npm run lint` (frontend) |

Demo logins (DemoDataSeeder; all use the password `password`): `admin@advms.test`, `clerk@advms.test`, `officer@advms.test`, `supervisor@advms.test`.

#### Design tokens → code

| Framer style                  | Value                      | Use                                                                    |
| ----------------------------- | -------------------------- | ---------------------------------------------------------------------- |
| /Brand/Primary                | rgb(79,70,229) `#4F46E5`   | primary buttons, focus borders, selected states                        |
| /Brand/Primary Dark           | rgb(30,27,75) `#1E1B4B`    | sidebar, login background                                              |
| /Brand/Primary Soft           | rgb(238,242,255) `#EEF2FF` | icon tiles, badges, progress track                                     |
| /Brand/Primary Faint          | rgb(247,248,255) `#F7F8FF` | selected card / row background                                         |
| /Brand/On Dark Muted          | rgb(199,210,254) `#C7D2FE` | text on dark surfaces                                                  |
| /Brand/On Dark Surface        | rgba(255,255,255,0.08)     | pills on dark                                                          |
| /Brand/On Dark Border         | rgba(255,255,255,0.14)     | borders on dark                                                        |
| /Neutral/Foreground           | rgb(15,23,42) `#0F172A`    | body text                                                              |
| /Neutral/Muted Foreground     | rgb(100,116,139) `#64748B` | captions, placeholders                                                 |
| /Neutral/Border               | rgb(226,232,240) `#E2E8F0` | borders, dividers                                                      |
| /Neutral/Background           | `#FFFFFF`                  | cards, inputs                                                          |
| /Neutral/Muted                | rgb(248,250,252) `#F8FAFC` | app background, modal footer                                           |
| /Status/Success, Success Soft | `#047857`, `#ECFDF5`       | approved                                                               |
| /Status/Warning, Warning Soft | `#B45309`, `#FFFBEB`       | AI-flagged / pending                                                   |
| /Status/Danger, Danger Soft   | `#DC2626`, `#FEF2F2`       | rejected, required `*`, destructive actions                            |
| /Hero/Navy                    | rgb(15,37,64) `#0F2540`    | Login UI 3 hero panel, primary button (matches hero banner)            |
| /Hero/Amber                   | rgb(247,181,56) `#F7B538`  | Login UI 3 accents: focus border, checkbox, icon tiles, link underline |
| /Hero/Amber Soft              | rgb(254,246,228) `#FEF6E4` | Login UI 3 info note background                                        |
| /Hero/Navy Line               | rgba(255,255,255,0.12)     | dividers/borders on Hero/Navy                                          |

Typography: Inter (Google Fonts). Text styles:

- Auth/Heading 28px/700, tracking -0.02em
- App/Page Title 22px/700
- App/Stat Value 28px/700
- App/Card Title 15px/600
- App/Body 14px/400
- App/Body Strong 14px/500
- Auth/Label 14px/500
- App/Caption 12px/400, muted
- App/Table Head 12px/600, uppercase, tracking 0.04em
- App/Nav Section 11px/600, uppercase, tracking 0.08em
- App/Badge 12px/600
- Brand Panel/Display 40px/700

Shape & spacing conventions used across the designs:

- Inputs and buttons are 38–46px tall with 8–10px radius.
- Cards have a 12–14px radius and a 1px Border.
- Modals have a 14px radius, 24px padding, and a footer with a Muted background.
- Badges and pills use a 999px radius.

---

## Engineering Plan (master plan)

The full explanation of every concept below, with a copy of this plan, is in `docs/ENGINEERING_GUIDE.md` (section numbers below refer to that file). Keep the two files in sync. The user is learning software engineering through this project: when building something, briefly name the concept being applied and why.

### Architecture decisions

- **Style:** a modular monolith (one Laravel API) plus **one Python ML microservice** (FastAPI + scikit-learn, called over HTTP with a timeout, retries and a fallback; never `shell_exec`).
- **Layers:** Route → Middleware → thin Controller → Form Request → Action/Service (business rules + `DB::transaction`) → Eloquent Model; responses always go through an API Resource. Authorization goes in Policies.
- **Modules** (`app/Domain/*`): Tenancy, Identity, Catalog, Vouchers, Approvals, Budgets, AI, Reporting, Notifications, Audit. Modules talk through Actions and Events, not through each other's tables.
- **Async:** slow work (AI scoring, OpenAI summaries, PDF/XLSX exports, notifications) runs in queued Jobs with retries and backoff. The queue driver is `database` locally and Redis in production. The Scheduler handles monthly forecasting and daily budget checks.
- **Tenancy:** the `ResolveCompany` middleware validates `X-Company-ID` against `user_company_access`. A `BelongsToCompany` global scope adds the company filter automatically, and Policies check again. Another company's record returns 404.
- **Voucher lifecycle:** a single state machine (`VoucherStatus` enum + `TransitionVoucher` action). Every status change writes `voucher_approvals` + `audit_logs`. The flow still needs user confirmation (guide §3.5).
- **Integrity:** money is DECIMAL and never float. Budget consumption and voucher numbering use `lockForUpdate`. Create/submit accept an `Idempotency-Key`. Segregation of duties: a creator can never approve their own voucher. Audit logs are append-only.
- **AI is advisory:** if the ML service is down, vouchers still submit and the anomaly check retries in the background ("AI check pending"). OpenAI receives aggregates only.

### API conventions

- Base path `/api/v1`, JSON only, plural nouns, workflow actions as sub-resources (`POST /vouchers/{id}/submit`, `POST /vouchers/{id}/approvals`).
- Status codes: 200/201/204, 400, 401, 403, 404 (also for cross-tenant), 409 (invalid transition or stale version), 422, 429, 500, 503.
- Error envelope: `{ message, code, errors?, request_id }`. Collections use the Laravel paginator `{ data, links, meta }` with `per_page` capped at 100.
- Querying: `filter[field]=`, `search=`, `sort=-created_at`, `include=`, against an allow-list. Offset pagination for tables, cursor pagination for feeds and notifications.
- Rate limits: login 5/min, api 120/min/user, ai classify 30/min/user. Auth is Sanctum SPA cookies (Bearer tokens only as a fallback).
- Full endpoint map: guide §4.10.

### Frontend conventions

- Feature folders (`src/features/<module>`); see "Frontend folder structure" below. Zustand for client state; TanStack Query for server state (pending approval).
- A single `lib/apiClient` Axios instance with interceptors: adds `X-Company-ID` and `Idempotency-Key`, normalises errors, handles 401 → login.
- Route guards: `RequireAuth` / `RequireRole` / `RequireCompany`. Admin and operational route trees are separate. A top-level ErrorBoundary. Routes are lazy-loaded.
- Forms use react-hook-form + zod, and server 422 `errors` are mapped onto fields. Every view has Loading/Error/Empty/Success states.

### Frontend folder structure (`frontend/src`)

This is the target layout. Put every new file in its place here. Folders are created when the first file needs them, not ahead of time.

```
frontend/src/
├── main.jsx                    # Entry: mounts <App/>, imports css/main.css (only CSS entry)
├── app/                        # App wiring, no business logic
│   ├── App.jsx                 # <Providers> + <RouterProvider>
│   ├── providers.jsx           # Toaster, ErrorBoundary (+ QueryClientProvider if approved)
│   ├── router.jsx              # Full route tree; pages lazy-loaded with React.lazy
│   ├── ErrorBoundary.jsx       # Catches render crashes → fallback screen
│   └── guards/
│       ├── RequireAuth.jsx     # Not logged in → /login
│       ├── RequireRole.jsx     # Wrong role → /403 (UX only; backend Policies are the real check)
│       └── RequireCompany.jsx  # Operational roles must have an active company
│
├── assets/                     # Images & logos (VM-hero-banner.png goes here)
├── css/
│   └── main.css                # Tailwind entry + Framer design tokens (components.json points here)
│
├── components/                 # SHARED UI, used by 2+ features, no API calls
│   ├── ui/                     # shadcn-generated primitives (add via shadcn CLI, after approval)
│   ├── layout/                 # AuthLayout, AdminLayout, OperationsLayout, Sidebar, TopBar,
│   │                           #   CompanySwitcher, NotificationBell
│   └── common/                 # PageHeader, StatCard, DataTable, StatusBadge, MoneyText,
│                               #   LoadingState/Skeletons, ErrorState (with Retry), EmptyState,
│                               #   ConfirmDialog, FormField
│
├── hooks/                      # SHARED hooks: useDebounce, useDisclosure, useMediaQuery, usePagination
├── lib/                        # Framework-free helpers
│   ├── utils.js                # cn() (shadcn)
│   ├── apiClient.js            # The single Axios instance + interceptors (X-Company-ID, Idempotency-Key, 401)
│   ├── apiError.js             # normalizeApiError() → { message, code, errors, status, requestId }
│   ├── formatters.js           # formatMoney (₱), formatDate, formatNumber
│   └── constants.js            # ROLES, VOUCHER_STATUS, PAYMENT_METHODS, route paths
├── stores/                     # GLOBAL client state (Zustand) only
│   ├── useAuthStore.js         # current user, role, login state
│   ├── useCompanyStore.js      # active company (feeds X-Company-ID)
│   └── useUiStore.js           # sidebar collapsed, theme
│
├── features/                   # One folder per backend module; same inner layout everywhere
│   ├── auth/
│   │   ├── api.js              # login(), logout(), me(), myCompanies()
│   │   ├── schemas.js          # zod schemas (loginSchema)
│   │   ├── hooks/              # useLogin, useLogout
│   │   ├── components/         # LoginForm, PasswordInput, FeatureColumn
│   │   ├── pages/              # LoginPage.jsx (Framer XJ4eU6eCT / p0wwkrh66)
│   │   └── index.js            # Public exports; other code imports ONLY from here
│   ├── admin/                  # role: admin only. Sub-features use the same inner layout
│   │   ├── dashboard/          # AdminDashboardPage, QuickActions, RecentActivity (lmhV2DJV1)
│   │   ├── users/              # UsersPage, CreateUserModal, RoleRadioCards, CompanyAccessList
│   │   ├── companies/
│   │   ├── departments/
│   │   └── catalog/            # voucher categories, voucher types, payee types
│   ├── dashboard/              # Operational, role-aware dashboard (clerk / officer / supervisor)
│   ├── vouchers/               # List, detail, create/edit form, line items, attachments, PDF preview
│   ├── approvals/              # Approval inbox, approve/reject/return dialog, approval timeline
│   ├── budgets/                # Budget allocations, consumption, threshold alerts
│   ├── ai/                     # Category suggestion, anomaly badge/panel, forecasts
│   ├── reports/                # Report generator, AI summary, PDF/XLSX export
│   ├── notifications/          # Notification list/dropdown, mark-as-read
│   └── audit/                  # Audit log viewer (read-only)
│
├── pages/                      # App-level pages not owned by a feature: NotFoundPage (404),
│                               #   ForbiddenPage (403), ServerErrorPage
└── test/                       # Vitest setup + MSW handlers (only once those deps are approved)
```

**Inner layout of every feature:** `api.js` (endpoint calls), `schemas.js` (zod), `hooks/`, `components/`, `pages/`, an optional `utils.js`, and `index.js` (the public API).

**Rules:**

1. **Dependency direction:** `features → components/hooks/lib/stores`. Shared folders never import from `features/`. A feature imports another feature only through that feature's `index.js`, never from its internal files.
2. **Only `api.js` files call `apiClient`.** Components and pages never import Axios directly.
3. **Promote, don't duplicate:** code starts inside its feature and moves to `components/common` or `hooks/` once a second feature needs it.
4. Always import with the `@/` alias (`@/lib/apiClient`), never with deep relative paths like `../../../`.
5. **Naming:**
   - Components: `PascalCase.jsx`, one component per file. Pages end in `Page`, modals in `Modal`, dialogs in `Dialog`.
   - Hooks: `useX.js`.
   - Everything else: `camelCase.js`.
6. **Framer frame → code:** the screen goes in `features/<module>/pages/`, and its sections go in that feature's `components/`. Shared shells such as the sidebar and top bar go in `components/layout/`.
7. **CSS:** `css/main.css` is the only stylesheet, and it holds all the Framer tokens.
   - Colour classes: `bg-primary`, `bg-primary-soft`, `text-muted-foreground`, `bg-success-soft text-success`, `bg-hero-navy`, `text-hero-amber`, `bg-sidebar`, and so on.
   - Text-style classes: `text-page-title`, `text-card-title`, `text-stat-value`, `text-caption`, `text-table-head`, `text-nav-section`, `text-badge`, `text-label`, `text-auth-heading`, `text-display`.
   - Inter is loaded from Google Fonts in `index.html`.
   - There is no dark theme, because no dark design exists yet.
8. **API calls in dev:** call relative `/api/v1/...` paths. Vite proxies `/api` and `/sanctum` to `http://localhost:8000`, which you start with `php artisan serve`, so cookies work without CORS. The base URL comes from `VITE_API_URL`.

### Database schema & migrations rules (adopted 2026-11-15)

- **Baseline:** `backend/database/schema/mysql-schema.sql` is the official starting schema. It was generated by `php artisan schema:dump` from the live DB and includes the 37 `migrations` rows. On an empty DB, `php artisan migrate` loads it first, then runs any newer migrations.
- **Old migrations** live in `backend/database/migrations_archive/` as history only. Never edit, run or move them back.
- **Every future schema change is a NEW migration** in `backend/database/migrations/`, and still needs user approval first. After running it on the live DB, run `php artisan schema:dump` again to refresh the baseline.
- `ai_driven_voucher_monitoring_system_database.sql` is the user's phpMyAdmin snapshot, kept for reference.
- **Tests:** `phpunit.xml` forces the `ai_driven_voucher_monitoring_system_testing` DB. `tests/TestCase.php` refuses to run on any DB not ending in `_testing`. Never run `migrate:fresh`, `db:wipe` or `RefreshDatabase` against the live DB, and never run `config:cache` locally.
- The `mysql`/`mysqldump` CLI tools (in `C:\xampp\mysql\bin`) must be on PATH for `schema:dump` and for tests to load the baseline.

**Database note:** XAMPP actually runs **MariaDB**, a MySQL-compatible fork. Use MariaDB in Docker/production too, so local and production behave the same. `php artisan db:show` fails on MariaDB (it looks for `performance_schema`), so use `migrate:status` to check the connection instead.

### Deployment target (free tier)

- Frontend: **Cloudflare Pages**.
- Backend, queue, scheduler, ML, MySQL and Redis: **Oracle Cloud Always Free VM** running Docker Compose behind **Caddy** (auto HTTPS).
- Files and backups: **Cloudflare R2**. DNS: Cloudflare, with a cheap custom domain (`app.` + `api.`) so cookie auth works.
- CI/CD: **GitHub Actions** → GHCR. Monitoring: **Sentry** + **UptimeRobot**. OpenAI is pay-per-use (set a spend cap).
- Fallback: Render + TiDB/Aiven + Upstash (guide §11.2).

### Roadmap

Framer frames keep being built frame by frame inside these phases. Tests are written in each phase, covering 6 cases per endpoint: happy path, 422, 401, 403, cross-tenant 404, 409.

- [x] **Phase 0 — Foundation** (done 2026-11-15):
  - initial git commit, `.env.example`, schema baseline + testing DB
  - `/api/v1` + `GET /api/v1/health`, the AssignRequestId (global) and ForceJsonResponse (api) middleware
  - error envelope via `app/Exceptions/ApiErrorRenderer.php`, plus `ApiException` for business rules
  - frontend `lib/apiClient` + `lib/apiError`, router with guards, ErrorBoundary, toasts, and the common Loading/Error/Empty states
  - Pint (`pint.json` excludes the archive) and ESLint
  - Demo seeder
  - Success responses use API Resources directly, so there is no ApiResponse helper.
- [ ] **Phase 1 — Auth, tenancy & audit:** Sanctum login (Login frames), ResolveCompany + global scope, role policies, audit observer, company switcher.
  - Done 2026-11-15: login/logout/me built from Login UI 2 (`p0wwkrh66`).
    - Endpoints: `POST /api/v1/auth/login` (throttle 5/min), `GET /auth/me`, `POST /auth/logout`.
    - "Keep me signed in" = a 30-day remember cookie (`config/auth.php`).
    - Inactive or pending accounts get 403 `ACCOUNT_INACTIVE`.
    - After login, the active company is picked automatically (`features/auth/utils.js`).
    - The old health page moved to `/status`.
- [ ] **Phase 2 — Admin module:** companies, departments, users (`lmhV2DJV1`), company access, categories, voucher/payee types; pagination + cached lookups.
- [ ] **Phase 3 — Voucher core:** drafts + line items, secure attachments, numbering, state machine, idempotent submit, cancel, PDF.
- [ ] **Phase 4 — Approvals & budgets:** inbox, approve/reject/return, step 2 routing, budget locking + alerts, event-driven notifications.
- [ ] **Phase 5 — AI service:** FastAPI ML service, MlClient + fake, classification, anomaly job, monthly forecast, OpenAI summaries.
- [ ] **Phase 6 — Reports & dashboards:** cached role-aware summaries, queued report generation, PDF/XLSX export.
- [ ] **Phase 7 — Hardening:** full test coverage + E2E, OWASP review, audits, index/N+1 review, OpenAPI docs.
- [ ] **Phase 8 — Deployment:** Docker + Compose, GitHub Actions CI/CD, Oracle VM + Caddy, Cloudflare Pages, R2 backups, Sentry, UptimeRobot.

### Open decisions (each needs user approval; see guide §13)

1. ~~Schema baseline~~ Done 2026-11-15; see "Database schema & migrations rules".
2. Confirm the voucher flow and define "high-value".
3. Choose a single roles source: the `users.role` column vs `spatie/laravel-permission` (both exist now).
4. Schema additions per phase: `vouchers.version`, a voucher-number sequence, `idempotency_keys`, indexes.
5. Backend deps: scramble, larastan, predis/phpredis, sentry-laravel, flysystem-aws-s3-v3.
6. Frontend deps: @tanstack/react-query, vitest + RTL + msw, playwright, @sentry/react.
7. ~~Restructure the frontend into `features/` folders.~~ Adopted 2026-11-15; see "Frontend folder structure".
8. Install Docker Desktop and a Python 3.12 venv when their phase starts.
9. Buy a domain before Phase 8.
