# Project phases

Everything about the build plan in one place: what each phase is for, what's already done,
what's left, which Framer frames belong to it, and what you learn in it.

_Last updated: 2026-11-21. Source of truth for progress: the "Roadmap" in `CLAUDE.md`
(the copy in `docs/ENGINEERING_GUIDE.md` §12 is older). Concepts are explained in depth in the
Engineering Guide; section numbers below (§) point there._

## Contents

1. [The big picture](#1-the-big-picture)
2. [Status at a glance](#2-status-at-a-glance)
3. [How a phase is worked on](#3-how-a-phase-is-worked-on)
4. [Phase 0: Foundation](#phase-0-foundation)
5. [Phase 1: Auth, tenancy & audit](#phase-1-auth-tenancy--audit)
6. [Phase 2: Admin & Super Admin module](#phase-2-admin--super-admin-module)
7. [Phase 3: Voucher core](#phase-3-voucher-core)
8. [Phase 4: Approvals & budgets](#phase-4-approvals--budgets)
9. [Phase 5: AI service](#phase-5-ai-service)
10. [Phase 6: Reports & dashboards](#phase-6-reports--dashboards)
11. [Phase 7: Hardening](#phase-7-hardening)
12. [Phase 8: Deployment](#phase-8-deployment)
13. [Which phase does a frame belong to?](#13-which-phase-does-a-frame-belong-to)
14. [Decisions still waiting for approval](#14-decisions-still-waiting-for-approval)

---

## 1. The big picture

The system is built in **9 phases (0–8)**. Each phase stands on the one before it, like floors of a building:
you can't put vouchers (Phase 3) in front of people before they can sign in (Phase 1) and before an Admin
has set up companies and users (Phase 2).

```
Phase 0  Foundation ─ the ground: project skeleton, error format, tests, code style
Phase 1  Auth, tenancy & audit ─ who you are, which company you're in, what gets recorded
Phase 2  Admin & Super Admin ─ setting up companies, users, catalogs; running the platform
Phase 3  Voucher core ─ clerks create and submit vouchers
Phase 4  Approvals & budgets ─ officers and supervisors approve; budgets are spent safely
Phase 5  AI service ─ category suggestions, anomaly checks, forecasts, report summaries
Phase 6  Reports & dashboards ─ charts and reports for each role
Phase 7  Hardening ─ full tests, security review, speed
Phase 8  Deployment ─ put it on the internet (Docker, CI/CD, HTTPS, cloud backups)
```

**Who does what in the finished system (the 5 roles):**

| Role | Does | Phase where their screens are built |
|---|---|---|
| Super Admin | Runs the platform: Admin accounts, companies, global rules, audit logs, system health. No vouchers. | 2 |
| Admin | Sets up ONE company: departments, users, categories, voucher/payee types. No vouchers. | 2 |
| Accounting clerk | Creates and submits vouchers | 3 |
| Accounting officer | Level 1 review, budgets | 4 |
| Supervisor / manager | Level 2 final approval (AI-flagged / high-value vouchers) | 4 |

## 2. Status at a glance

| Phase | Name | Status |
|---|---|---|
| 0 | Foundation | ✅ Done (2026-11-15) |
| 1 | Auth, tenancy & audit | 🟡 In progress: sign-in done; company scoping, policies, audit observer, company switcher left |
| 2 | Admin & Super Admin module | 🟡 In progress: dashboards + several Super Admin tools done; most admin CRUD screens left |
| 3 | Voucher core | ⬜ Not started |
| 4 | Approvals & budgets | ⬜ Not started |
| 5 | AI service | ⬜ Not started (some groundwork ready: queue worker, failed-jobs catalog, ML health check) |
| 6 | Reports & dashboards | ⬜ Not started |
| 7 | Hardening | ⬜ Not started (tests are already written inside every phase) |
| 8 | Deployment | ⬜ Not started (local nightly backups already run; cloud copy comes here) |

## 3. How a phase is worked on

- **Frame by frame.** You paste a Framer frame (node id); Claude decides its phase, builds it, and says which
  phase it was. If it needs something from an earlier phase that doesn't exist yet, that minimal piece is built
  first and explained.
- **Code first since 2026-11-20.** Screens are changed in the React code (keeping the Framer design tokens).
  Framer is only updated when you ask.
- **Every action gets a success AND an error message**, for every role.
- **Every screen handles Loading, Error and Empty states.**
- **Database changes:** a NEW migration, approved by you → run on the **testing DB** first → you try it →
  only after your OK on the real DB → refresh `mysql-schema.sql` and `full-schema-with-superadmin.sql`.
- **New libraries / changes to the voucher flow** need your approval first.
- **Tests per endpoint (the "6-case rule"):** happy path, 422 (bad input), 401 (not signed in), 403 (wrong role),
  404 (another company's record), 409 (conflict, e.g. wrong status or already done).
- **Explaining as we go:** each build names the engineering concept it uses. Things you ask to keep are written
  in `docs/workflow/NOTES.md`.

---

## Phase 0: Foundation

**Goal:** a clean, safe skeleton that every later feature plugs into.
**Status:** ✅ Done 2026-11-15.

**What was built**
- Git repository, `.env.example`, schema baseline (`backend/database/schema/mysql-schema.sql`) and a separate
  **testing database** (`ai_driven_voucher_monitoring_system_testing`).
- API under `/api/v1`, a health check `GET /api/v1/health`.
- Middleware: every request gets a **request id** (`AssignRequestId`), and API answers are always JSON (`ForceJsonResponse`).
- One **error format** for the whole API: `{ message, code, errors?, request_id }` (`ApiErrorRenderer`, `ApiException`).
- Frontend: the single `apiClient` (Axios), `apiError`, the router with guards, an ErrorBoundary, toasts,
  and the shared Loading / Error / Empty components.
- Code style tools: Pint (PHP) and ESLint (JavaScript). Demo data seeder.

**Concepts learned:** Git workflow, layered architecture (§2.3), 12-factor config (§3.12), a consistent API envelope (§4.4).

---

## Phase 1: Auth, tenancy & audit

**Goal:** know WHO is using the system, WHICH company they're working in, and RECORD what they do.
**Status:** 🟡 In progress.

**Done**
- Sign in / sign out / "who am I" (Login UI 2, frame `p0wwkrh66`), 5 tries per minute, "Keep me signed in" (30 days).
- Role email domains (`@Administrator.com`, `@Clerk.com`, `@Officer.com`, `@Supervisor.com`, `@Superadmin.com`)
  and one landing page per role (`/admin`, `/clerk`, `/officer`, `/supervisor`, `/superadmin`); wrong role → 403.
- Inactive / pending accounts are refused (`ACCOUNT_INACTIVE`); a user whose companies are all suspended is refused
  (`COMPANY_SUSPENDED`), checked at sign-in AND on every request.
- The `/set-password` page for invitation links (72 h) and password-reset links (60 min).
- Super Admin session rules: signed out after the idle timeout, no "keep me signed in".
- Every sign-in (good or failed) is written to the audit log, with the device (since 2026-11-20).

**Still to do**
- `ResolveCompany` middleware + `BelongsToCompany` global scope: every query automatically limited to the active
  company; another company's record → 404.
- Role **policies** (the real permission checks on the server).
- Audit **observer**: automatic, append-only audit rows for every change.
- **Company switcher** in the operational screens (sends `X-Company-ID`).
- Login UI 3 (frame `XJ4eU6eCT`, hero banner) is designed but not built.

**Concepts:** authentication vs authorization, multi-tenancy (§3.8), defence in depth, observers, audit logs (§3.11).

---

## Phase 2: Admin & Super Admin module

**Goal:** everything needed to SET UP and RUN the system before any voucher exists.
Admins set up their one company; the Super Admin runs the whole platform.
**Status:** 🟡 In progress.

### Done: Admin (one company each)

| What | Frame | Done |
|---|---|---|
| Admin dashboard (sidebar, stats, recent activity, quick actions) | `Nhw7N27tM` | 2026-11-15 |
| Account menu | `nj06iziQJ` | 2026-11-15 |
| Notifications bell panel | `D7aTKQEDz` | 2026-11-16 |
| Create user modal (auto Employee ID, generated password, 3 operational roles) | `lmhV2DJV1` | 2026-11-16 |
| Top-bar search limited to the Admin's own company (users + departments, `GET /admin/search`); sidebar top redesigned (company card, no Companies item, + Voucher types / Payee types) | none (code-first) | 2026-11-22 |

### Done: Super Admin

| What | Frame | Done |
|---|---|---|
| Super Admin landing page (top nav, services, needs your attention, admin list, global rules) | `uH0wO9f5O` | 2026-11-20 |
| `php artisan superadmin:create` (max 3 Super Admins) | — | 2026-11-20 |
| Add admin modal (company + personal email, invitation email, resend link) | `TkIHF89oH` | 2026-11-20 |
| Security alerts panel + alert detail (failed sign-ins, new device, lock / unlock / reset password) | `mQcXDCyDZ`, `SCoT_cu7B` | 2026-11-20 |
| Admin accounts page (Admins tab: search, filters, table, ⋯ row menu) | `bxGFPLOVN` | 2026-11-20 |
| Run database backup (+ nightly 02:00 backups, keep newest 7) | `TKziMjHUe` | 2026-11-21 |
| Retry failed background jobs | `fzdOvPqCX` | 2026-11-21 |
| Admins tab, full version (cards, views, sort, bulk, export, profile, edit, reset, two-step, Make Super Admin, deactivate, cancel invite) | `U7glXUOSF` + A1–A12 (`x8wWbSPsg` for A11) | 2026-11-21 |
| Two-step sign-in (authenticator app, backup codes, setup deadline) | A11 | 2026-11-21 |
| Companies tab (cards / list, search, sort, views, suspend with reason + type-to-confirm, reactivate, email to the Admin in charge) | `vnNFYExpX` + C2–C7 | 2026-11-21 |
| Companies: C1 Export (Excel / CSV / PDF) + C8 company side panel (Overview / Departments / Users / History) | `UpMMFLXSI`, `a17W5hpkA` (+ base copy `ZzwBy6v6q`) | 2026-11-21 |
| Audit logs tab (filters, IP search + block, event details with tamper check, CSV export, live refresh) | `iVFf6FzsH`, `EJ0asP2ZH` + AL2–AL9 | 2026-11-21 |
| System health tab (live checks every minute, uptime, incidents, jobs, blocked addresses) | `m80KDanOj` + SH1–SH10 | 2026-11-21 |
| Global settings tab (9 rules, unsaved-edit tracking, G1 Change history + Restore, G2 Discard, G3 Save with reason + password) | `tsrXCiWWw`, `OtA4G9A9F`, `dLJvMyCj2`, `xICKww9ng` | 2026-11-21 |
| Create user: no company select or Company access chips; users always join the Admin's company (department only) | `lmhV2DJV1` (code differs) | 2026-11-22 |
| Working in more than one company: Admin invites people of other companies (limited card), people ask to join, approve / decline / withdraw, Company access split into In your company / From other companies / Requests, clerk "Join another company" window (migration `2026_11_22_000003`, testing DB only) | none (code-first) | 2026-11-22 |
| Real-data polish: no sample notifications / audit entries, no invented numbers, "not in use yet" on stored-only settings, dashboard numbers match their pages, All notifications page | none (code-first) | 2026-11-22 |
| Admin Audit logs (company only, no voucher activity, filters, entry panel with tamper check) | none (code-first) | 2026-11-22 |
| Categories page: voucher categories, voucher types and payee types on one page (3 tabs, add / edit / delete when unused, deactivate categories, built-in read-only) | none (code-first) | 2026-11-22 |
| Company access page (who can open the company, from other companies, grant, remove access with history kept) | none (code-first) | 2026-11-22 |
| Users page (cards, views, role / department filters, search, side panel, edit incl. role change, deactivate / reactivate, set a new password) | none (code-first) | 2026-11-22 |
| Departments page (cards, views, search, sort, side panel with people, edit with conflict check, deactivate / reactivate) | none (code-first) | 2026-11-22 |
| Quick actions dialogs: Add department (code suggestion, optional head) + Grant company access (people without access, search, select all, one-click grant) | none (code-first) | 2026-11-22 |
| Companies: + Add company (name, type, address, contacts, TIN, fiscal year; success view → "Add its admin" with the company pre-chosen; "Add admin" link on companies without one); unique company names (migration `2026_11_22_000001`, testing DB only so far) | none (code-first) | 2026-11-22 |
| Account menu pages for Admin + Super Admin: My profile, Account settings (two-step, signed-in devices), Change password, My activity, Help & support | none (code-first) | 2026-11-22 |

Also done in this phase: platform default settings (high-value threshold ₱50,000.00, AI sensitivity balanced,
OpenAI cap $25.00, Super Admin idle timeout 15 min), Asia/Manila timezone, company suspension blocking,
one company per Admin, Gmail sending for invitation/reset emails, the queue worker in `dev.ps1`.

### Still to do

**Admin screens (Phase 2 CRUD):** all built (2026-11-22). Plus the shared conventions: filtering / sorting / pagination and cached lookups.
(Since 2026-11-20 the Super Admin creates companies; Admins see only their own, so the Admin "Companies" page was removed 2026-11-22.)

**Super Admin screens (designed, not built):**

| Screen | Frame(s) |
|---|---|
| Notifications dropdown (v2 nav) | `dQvu8A865` |
| Company panel (suspend / reactivate) | `FC7jMBFYg` |
| Edit global settings (password to save) | `C3d2wopED` |
| Account menu (v2 nav) | `PSEjFM9zW` |
| Global settings: AI & anomaly section page, OpenAI usage section page + their click-flows (main page + G1–G3 done) | `BfnusLHkd`, `bKB5a9QuJ` + their sets |
| ~~Audit logs tab + click-flows AL1–AL9~~ (built 2026-11-21) | `iVFf6FzsH`, `EJ0asP2ZH` + 8 |
| ~~System health tab + click-flows SH1–SH10~~ (built 2026-11-21) | `m80KDanOj` + 10 |
| Not designed yet: success/error message sheet, tablet/phone nav | — |

**Concepts:** REST resource design (§4.1), pagination (§4.5), caching + invalidation, queues & background jobs (§3.6),
scheduler (§3.7), row locking for "only one at a time" rules (§3.4).

---

## Phase 3: Voucher core

**Goal:** clerks can create, edit, attach files to, submit and cancel vouchers.
**Status:** ⬜ Not started.

**Planned**
- Draft vouchers with **line items**, saved in one database transaction.
- **Attachments**: secure upload (type/size checks, private storage).
- **Voucher numbers** from a locked sequence (no two vouchers get the same number).
- The **voucher state machine** (`VoucherStatus` enum + `TransitionVoucher` action): every status change goes
  through one place and writes `voucher_approvals` + `audit_logs`.
- **Submit** with an `Idempotency-Key` (a double-click can't submit twice); **cancel**.
- **PDF** of a voucher (DomPDF).

**Needs your approval before it starts:** the voucher flow (decision 2 below) and schema additions such as
`vouchers.version`, a voucher-number sequence and an `idempotency_keys` table (decision 4).

**Concepts:** ACID transactions (§3.3), state machines (§3.5), idempotency (§4.6), file security, money as DECIMAL (§3.10).

---

## Phase 4: Approvals & budgets

**Goal:** officers and supervisors review vouchers, and budgets are spent safely.
**Status:** ⬜ Not started.

**Planned**
- **Approval inbox** for each role; approve / reject / return with remarks.
- **Segregation of duties:** nobody approves their own voucher.
- **Step 2 routing:** AI-flagged or high-value vouchers (over the Super Admin's threshold, ₱50,000.00 by default)
  must go to a supervisor.
- **Budgets:** consumption with `lockForUpdate` (two approvals at once can't overspend), threshold alerts.
- **Events → listeners → notifications** (queued): "voucher approved", "voucher pending", "budget alert".

**Concepts:** pessimistic locking and race conditions (§3.4), event-driven design and queues with retries (§3.6).

---

## Phase 5: AI service

**Goal:** AI that ADVISES (never blocks): category suggestions, anomaly checks, forecasts, report summaries.
**Status:** ⬜ Not started.

**Planned**
- A separate **Python FastAPI ML service** (`/health`, `/classify`, `/anomaly`, `/forecast`), called by Laravel through
  an `MlClient` with a 2–3 s timeout, retries and a circuit breaker; never public.
- **Classification:** TF-IDF + Naive Bayes on the voucher description → suggested category + confidence, shown while typing.
- **Anomaly detection:** Isolation Forest as a **queued job** on submit → `ai_anomaly_flag`, score, reason.
  If the ML service is down, the voucher still submits and shows "AI check pending" until the retry succeeds.
- **Forecasting:** Linear Regression, scheduled on the 1st of each month → `ai_forecasts`.
- **OpenAI report summaries** (GPT-4o-mini): queued, totals/counts only (never names or files), monthly spend cap.

**Groundwork already in place:** the queue worker (`dev.ps1`), `ML_SERVICE_URL` + the ML health check on the
Super Admin dashboard, the failed-jobs window. **Add every new AI job to the CATALOG in
`backend/app/Domain/Platform/FailedJobs.php`** so it gets a friendly name and the ML status box.

**Needs:** a Python 3.12 virtual environment (decision 8).

**Concepts:** service boundaries, training vs inference (§6.1), model versioning, graceful degradation (§6.3).

---

## Phase 6: Reports & dashboards

**Goal:** each role sees the numbers that matter to them; financial reports can be generated and exported.
**Status:** 🟡 Started (2026-11-22: the Accounting Clerk landing page `LolF6YFo5`).

| What | Frame | Done |
|---|---|---|
| Accounting Clerk landing page (drafts, in review with Accounting / Supervisor, returned with the reviewer's note, approved this month, recent vouchers, company switcher) | `LolF6YFo5` | 2026-11-22 |

Built for it (foundation from Phases 1 and 3): the `ResolveCompany` middleware (X-Company-ID must be a company the user has accepted access to), the `Voucher` / `VoucherApproval` models, `VoucherStatus`, and migration `2026_11_22_000002` (adds `returned`, testing DB only).

**Planned**
- Role-aware dashboard summaries (cached aggregates) with Recharts charts.
- Financial reports generated by **queued jobs**, with the OpenAI summary, exported to PDF / XLSX.

**Concepts:** aggregation queries, database indexes, caching, asynchronous report generation.

---

## Phase 7: Hardening

**Goal:** make it trustworthy before real users: tested, secure and fast.
**Status:** ⬜ Not started (tests are already written inside every phase as we go).

**Planned**
- Full test coverage of every endpoint (the 6-case rule) + end-to-end tests of the main paths.
- Security review against the OWASP list; `composer audit` and `npm audit`.
- Performance: index review, N+1 query check, optional load test.
- Published API documentation (OpenAPI).

**Concepts:** the testing pyramid (§8.1), OWASP (§7), profiling.

---

## Phase 8: Deployment

**Goal:** put the system on the internet safely, for free (except OpenAI).
**Status:** ⬜ Not started.

**Planned**
- **Docker** images (app, ML) + `docker-compose.yml`.
- **GitHub Actions** CI/CD: lint, test, build → images to GHCR → deploy.
- **Oracle Cloud Always Free VM** running the API, queue worker, scheduler, ML, MariaDB and Redis behind **Caddy** (automatic HTTPS).
- **Cloudflare Pages** for the React app; Cloudflare DNS with a cheap custom domain (`app.` + `api.`).
- **Cloudflare R2** for files and **off-site, encrypted backups** (today backups stay on the same computer;
  the backup dialog says "This server · not encrypted yet" until this is done) + one test restore.
- **Sentry** (errors) and **UptimeRobot** (is it up?).
- Fallback if Oracle doesn't work out: Render + TiDB/Aiven + Upstash (§11.2).

**Needs:** Docker Desktop and a domain (decisions 8 and 9).

**Concepts:** containers, CI/CD, reverse proxies, TLS/HTTPS, backups, monitoring.

---

## 13. Which phase does a frame belong to?

| Phase | What the frame shows |
|---|---|
| 1 | Login, forgot password, company selection |
| 2 | Admin / Super Admin screens: users, companies, departments, company access, categories, voucher/payee types, dashboards, platform tools |
| 3 | Voucher list, create/edit, details, line items, attachments, PDF |
| 4 | Approval inbox, approve/reject/return, budgets, notifications |
| 5 | AI suggestions, anomaly panels, forecasts |
| 6 | Operational dashboards, reports, charts |

The full list of designed frames and their node ids is the "Designed frames" table in `CLAUDE.md`.

## 14. Decisions still waiting for approval

| # | Decision | Recommendation |
|---|---|---|
| 2 | **Voucher flow**: officer can final-approve normal vouchers; AI-flagged / high-value go to a supervisor. "High-value" starts at ₱50,000.00 (a Global setting). **Decided 2026-11-22:** "returned" is its own status (`vouchers.status = returned`, not back to draft); `pending` = with the Accounting Officer (step 1), `under_review` = with the Supervisor (step 2). | Partly decided; confirm the rest before Phase 3 |
| 3 | **One source for roles**: the `users.role` column vs the `spatie/laravel-permission` package (both exist) | Keep `users.role`; remove Spatie later if unused |
| 4 | **Schema additions** per phase: `vouchers.version`, voucher-number sequence, `idempotency_keys`, indexes | Approve per phase |
| 5 | **Backend libraries**: scramble (API docs), larastan, Redis client, sentry-laravel, S3/R2 storage driver | Approve per phase |
| 6 | **Frontend libraries**: TanStack Query, Vitest + Testing Library + MSW, Playwright, Sentry | Approve per phase |
| 8 | **Tools**: Docker Desktop (by Phase 8), Python 3.12 venv (Phase 5) | When the phase starts |
| 9 | **Domain**: buy a cheap domain before deploying (needed for secure cookie sign-in) | Yes, before Phase 8 |

Already decided: 1 (schema baseline, 2026-11-15) and 7 (feature folders, 2026-11-15).
