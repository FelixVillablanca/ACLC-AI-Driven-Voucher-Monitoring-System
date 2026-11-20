# AI-Driven Voucher Monitoring System

## Tech Stack Quick Guide

- **Frontend:** React 19 (Vite), Tailwind CSS, ShadCN UI, Zustand, Axios, Recharts, date-fns, framer-motion, lucide-react, numeral, radix-ui, react-dom, react, react-hook-form, react-hot-toast, react-icons, react-pdf, react-router-dom, tw-animate-css, xlsx, zod,
- **Backend:** Laravel 13 (PHP 8.3, per composer.json), REST API, Sanctum Auth, DomPDF (Voucher PDF export)
- **Database:** MariaDB 10.4 (MySQL-compatible) via XAMPP: `AI_Driven_Voucher_Monitoring_System_Database` on localhost:3306. Tests use `ai_driven_voucher_monitoring_system_testing`.
- **AI Stack:** Python (scikit-learn via shell execution/API for ML), OpenAI API (for narrative report summaries)

## Core Architectural Rules

1. **Separation of Admin:** The `admin` role is STRICTLY system administration (Departments, Users, Company Access, Categories, voucher types, and payee types). Admin has ZERO access to voucher operations or financial workflows.
   - **Since 2026-11-20 each Admin runs exactly ONE company** (`users.company_id`), chosen by the Super Admin when creating them. Everything an Admin sees and changes is limited to that company. **New companies are created by the Super Admin**, not Admins. A suspended company blocks its Admin too.
   - New Admins get a one-time "set your password" link (72 h) at their **personal email** (`users.personal_email`); no password is ever emailed. Public page `/set-password`, API `POST /api/v1/auth/invitation/check|accept`.
   - `docs/System_Flow_Roles_and_UML_Design.docx` updated to v1.1 on 2026-11-20 (text only: the diagram images, e.g. Figure 4 Create admin sequence and Figure 2 role hierarchy, still show the older version; captions say so).
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

## Domain emails to verify to which that domain will be directed to its own page.

Roles:

- Admin: {User}@Administrator.com example: Johndoe@Administrator.com
- Accounting clerk: {User}@clerk.com
- Accounting officer: {User}@officer.com
- Accounting supervisor manager: {User}@supervisor.com

**Implemented 2026-11-16:**
- **Domains:** `@Administrator.com`, `@Clerk.com`, `@Officer.com`, `@Supervisor.com`. The first letter of the domain is a capital; the name part is lower case.
- **Create user form:** the admin types only the name. The domain is a fixed part that follows the selected role and can't be edited.
- **Server:** it builds the address itself (`RoleEmailDomains`), so a domain sent from the browser is ignored. Sign-in ignores letter case.
- **Landing pages:** each role has its own: `/admin`, `/clerk`, `/officer`, `/supervisor` (`ROLE_HOME` in `lib/constants.js`). Only that role may open it; others get 403. The role decides access, and new users' domains always match their role.
- **Old demo logins** (`@advms.test`) don't follow the domain pattern. They still work, and their role decides their page.

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

### Framer → Code Workflow

> **Changed 2026-11-20 (user decision): code first.** Framer updates slowed development (the MCP freezes after writes on the big canvas page). Screen changes are now made directly in the React code, keeping the design tokens below. Existing frames are still the visual reference when the user pastes a node id; code may differ from a frame (note it, don't fix the frame). No Framer writes unless the user asks. Later design changes are suggested and done when we reach that screen.

The Framer MCP server is configured in `.mcp.json` at the project root, so every Claude Code session opened in this folder (CLI or VS Code extension) can read the designs. Before coding a screen:

1. Find the frame: use the node id in the table below, or ask the user for the frame link (`...?node=<nodeId>`). `getNodeXml` on the whole canvas page (`augiA20Il`) times out because it's too large, so always fetch individual frames by node id.
2. Read it with `mcp__framer__getNodeXml` (large frames get saved to a file; grep that file instead of reading it all at once).
3. Translate it into React + Tailwind + ShadCN components using the token mapping below. Never hard-code hex values that already exist as a token.
4. The Framer frames show one static state. In code, also add the Loading, Error and Empty states (see Code Conventions).
5. Swap the placeholder data in the designs (names, amounts, scores) for real API data.

#### Designed frames (canvas page `augiA20Il`)

| Frame                                                   | Node id     | Notes                                                                                                                                                                                                              |
| ------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Admin dashboard: Create user modal (from Quick actions) **BUILT** | `lmhV2DJV1` | 760px modal: personal info, 4-role radio cards, company/department selects, company-access chips, invite toggle. Opens on any admin page via `?create=user` (top bar "+ Add user", Quick actions). Revised 2026-11-16 at the user's request: **Employee ID is auto-generated** (`EMP-{year}-{4-digit counter}`, shown read-only, assigned on save), the **password is generated in the form** (read-only, with Copy and Generate new), **Department is optional**, and there's **no invitation email**. The success view shows Employee ID, email and password. Code: `features/admin/users/`. API: `POST /api/v1/admin/users`, `GET /api/v1/admin/lookups/companies` |
| Login UI 2 (centered card) **BUILT**                    | `p0wwkrh66` | 420px card on Primary Dark background with glow rings + 4 floating preview cards (approved, AI anomaly, budget, forecast). Code: `features/auth/pages/LoginPage.jsx`                                               |
| Login UI 3 (hero banner split)                          | `XJ4eU6eCT` | 720px navy hero panel showing `VM-hero-banner.png` (place it in `frontend/src/assets/`; its background is Hero/Navy, so it blends in) + 3 feature columns; 480px white form panel. Uses the Hero palette below     |
| Admin dashboard landing page **BUILT**                 | `Nhw7N27tM` | 240px dark sidebar (Dashboard / Organization / People & Access / Configuration / System + user menu with Sign out), 64px top bar, 4 stat cards, Recent activity, Quick actions, Needs attention. Code: `features/admin/dashboard/pages/AdminDashboardPage.jsx`, shell in `components/layout/AdminLayout.jsx`. API: `GET /api/v1/admin/dashboard` |
| Admin dashboard: account menu (⋮) open **BUILT**      | `nj06iziQJ` | Same page as `Nhw7N27tM` with the 264px account menu open beside the sidebar user card: header (avatar, name, email, role pill), My profile, Account settings, Change password, My activity, Help & support, Sign out, last sign-in. Code: `components/layout/UserMenuPanel.jsx` + `SidebarUserMenu.jsx`. Menu destinations are "coming soon" pages for now |
| Admin dashboard: notifications panel open **BUILT**   | `D7aTKQEDz` | 392px bell dropdown: header ("N new", Mark all as read), tabs All / Unread / Security, Today / Earlier groups, unread rows tinted with a dot, footer links. Code: `features/notifications/` (NotificationBell is passed into AdminLayout by the router). API: `GET /api/v1/notifications`, `GET /notifications/unread-count`, `POST /notifications/{id}/read`, `POST /notifications/read-all` |
| Super Admin landing page (designed 2026-11-16, **not built**) | `kVkbQkamQ` | 1200×960. **Proposed role**: `super_admin` isn't in the DB or code yet (spec: `docs/System_Flow_Roles_and_UML_Design.docx` §4). 240px dark sidebar with an amber "Platform owner" pill (Dashboard / Access: Admin accounts, Super admins / Platform: Companies, Global settings / Oversight: Audit logs, Security alerts, System health + user card "Super Administrator"); top bar with "+ Add admin"; 4 stat cards (Admin accounts, Companies, Security alerts, Failed jobs); System health card (ML service, queue, scheduler, backup); Global settings card (high-value threshold, AI sensitivity, OpenAI spend bar); Recent sensitive activity; Quick actions + "2 of 3 Super Admin seats" note. Before coding it: get approval for the migration (testing DB first) |
| Super Admin landing page, **redesign v2** **BUILT** 2026-11-20 (chosen over `kVkbQkamQ`) | `uH0wO9f5O` | Code: `features/superadmin/dashboard/`, shell `components/layout/SuperAdminLayout.jsx` + `SuperAdminTopNav.jsx` + `TopNavUserMenu.jsx`. API: `GET /api/v1/superadmin/dashboard` (`SuperAdminDashboardSummary`, `Domain/Platform/SystemHealth` + `SystemSettings`). Real data only: unset rules show "Not set", services not built yet show "Not set up". Other tabs are "coming soon" pages. 1200×900. **No sidebar**: white 64px top nav (VM tile, "Super Admin console", amber "Platform owner" pill, tabs Overview / Admins / Companies / Global settings / Audit logs / System health with a Primary underline on the active one, bell, avatar). Primary-Faint welcome banner (date, greeting, "4 things need your attention", + Add admin / Review security alerts) with a Services panel (ML, queue, scheduler, backup). 4 compact KPI tiles (Admins, Super admins 2/3, Companies, Users). "Needs your attention" list with an action button per row + Admin accounts list (Active / Pending / Inactive). Global rules strip (threshold, AI sensitivity, OpenAI spend bar, session timeout) |
| Super Admin click-flow set, v2 (designed 2026-11-17, **not built**) | `QrNeV7MPj` (00 base) + 10 copies | Each copy of the v2 landing page shows the result of one click, in a row to the right of the base (named "Super Admin – 0N …"). 01 Notifications dropdown `dQvu8A865` · 02 Add admin modal `TkIHF89oH` **BUILT 2026-11-20, code differs from the frame** (frame: generated temporary password; code: **Company select + Personal email**, no password, invitation email, success view with sent/not-sent + Resend link; code `features/superadmin/admins/`, opens on any Super Admin page with `?create=admin`; API `GET /api/v1/superadmin/admins/form-defaults`, `POST /api/v1/superadmin/admins`, `POST /api/v1/superadmin/admins/{id}/invitation` → `CreateAdmin` + `SendAccountInvitation` actions) · 03 Security alerts side panel `mQcXDCyDZ` **BUILT 2026-11-20** · 04 Alert detail panel `SCoT_cu7B` (timeline, Lock account / Reset password / Mark reviewed) **BUILT 2026-11-20** (code: `features/superadmin/security/`, opens on any Super Admin page with `?panel=security-alerts[&alert={id}]`; code differs from the frames: full IP shown, no location (user decision: no GeoIP), Lock asks for the Super Admin's password, Reset/Lock/Unlock have confirm dialogs, Lock/Reset only for Admin accounts; API `GET /superadmin/security-alerts`, `GET|POST /security-alerts/{id}[/review|/dismiss]`, `POST /security-alerts/review-all`, `POST /superadmin/admins/{id}/lock|unlock|password-reset`) · 05 Admin accounts page `bxGFPLOVN` (filters + table) · 06 Run backup confirm `TKziMjHUe` · 07 Retry failed jobs modal `fzdOvPqCX` · 08 Company panel (suspended, Reactivate) `FC7jMBFYg` · 09 Edit global settings modal `C3d2wopED` (needs password to save) · 10 Account menu `PSEjFM9zW`. Overlay pattern: an absolute scrim rgba(15,23,42,0.45) z5 + an absolute panel z10. Not designed yet: the other top-nav tab pages (Companies, Global settings, Audit logs, System health), success/error states |
| Super Admin **Admins tab page** (designed 2026-11-17, **not built**) | `XGSlfiNvJ` | v2 top nav with "Admins" underlined. Header (Export, + Add admin), 4 summary cards (Total, Super Admin seats 2/3, Two-step on 3 of 5, Needs attention), segmented views (All / Super Admins / Admins / Pending / Inactive) + search + sort, a table with checkbox · admin (name + email) · role · two-step · status · last sign-in · created · ⋯ (6 rows; John Doe selected), a footer bulk bar (Send password reset / Require two-step / Deactivate), and the **⋯ row menu open** (View profile, Edit details, Send password reset, Require two-step, Make Super Admin "1 seat left", Deactivate account). Fuller version of `bxGFPLOVN` (05), which is reached from "Manage →" |
| Super Admin **Companies tab page** (designed 2026-11-17, **not built**) | `vnNFYExpX` | Copied from the Admins page (its table and row menu are hidden layers inside). "Companies" underlined; header + Export list (no Add: Admins create companies); 4 cards (Companies 4, Active 3, Suspended 1 amber, Users 128); views All / Active / Suspended + search + sort + grid/list switch; 2×2 **company cards** (logo initials, name, type · city, status pill, Departments / Users / Last activity, "Set up by …", Suspend + Open); Northfield Academy shown suspended (amber border, reason note, Open + Reactivate); an info note explaining who creates companies. Counts only, no money (Super Admin has no voucher access) |
| Super Admin Companies click-flow set (designed 2026-11-17, **not built**) | `CGGx439Db` (base) + 8 copies | Copies of the Companies tab page, each showing the result of one click, named "Companies – C1…C8". C1 Export list dialog `UpMMFLXSI` (format, which companies, what to include) · C2 Search results `FXRghzjCE` ("north" typed, ✕ clear, "1 result") · C3 Sort menu open `oqxhehYHx` · C4 List view `jlXT7qlCt` (table instead of cards) · C5 Suspended filter `Dr5av5JaU` (amber tab, only Northfield, "Show all") · C6 Suspend confirm `eGUijf8Wd` (Apex: effects list, required reason, notify admin, type APEX to confirm, red button) · C7 Reactivate confirm `B3zqVOXN4` (Northfield: what comes back, optional note) · C8 Open company side panel `a17W5hpkA` (480px right panel: Overview / Departments / Users / History tabs, details, largest departments, View audit log + Suspend). Same overlay pattern as the Super Admin set |
| Super Admin **Global settings tab page** (designed 2026-11-17, **not built**) | `tsrXCiWWw` | 1200×1140, copied from the Companies page. v2 top nav with "Global settings" underlined. Header: title + subtitle, amber "2 unsaved changes" pill, Change history, Discard, Save changes (Primary). 232px left section list (Approval rules active, AI & anomaly detection, OpenAI usage, Security & sessions, Data & backups; amber dots = unsaved edits) + "Last saved" note. Right column: Primary Faint scope note ("applies to all 4 companies, password needed to save"); **Approval rules** card (high-value threshold ₱ input, edited row tinted Primary Faint with "Edited · was …" pill; AI-flagged → step 2 toggle; self-approval locked "Never allowed"); **AI & anomaly detection** card ("ML service online" pill, sensitivity segmented Relaxed / Balanced / Strict, category-suggestion confidence slider 70%, locked "Submit anyway, check later" fallback); a 2-column row with **OpenAI usage** (spend bar $15.40 / 62%, monthly cap input, pause-at-cap toggle) and **Security & sessions** (idle timeout select, lock after failed sign-ins select, require two-step for admins toggle, off). Saving opens the password modal `C3d2wopED` (09). Values are placeholders and need user confirmation (open decision 2: "high-value") |
| Super Admin Global settings click-flow set (designed 2026-11-17, **not built**) | 3 copies (made from `BfnusLHkd` before it became the AI section page) | Copies of the Global settings page (`tsrXCiWWw`) in a row to the right, each showing one header-button click; the clicked button is highlighted. G1 **Change history** side panel `OtA4G9A9F` (460px right panel: title + ✕, filter tabs All 18 / Approval / AI / OpenAI / Security, timeline entries with avatar, who/when, category tag, setting name, old → new chips, quoted reason, "↺ Restore …" link on the newest one, a System "Platform defaults applied" entry, Load older changes, footer "Showing 5 of 18" + Open full audit log →) · G2 **Discard** confirm `dLJvMyCj2` (460px centered dialog: red ↺ icon, "Discard 2 unsaved changes?", list of each edited setting with current → last-saved value, "can't be brought back" note, Keep editing / red Discard changes) · G3 **Save changes** review modal `xICKww9ng` (560px: "Save 2 changes to global settings", What's changing list with old → new + plain-language impact for each, amber warning about the higher threshold, required Reason for the change, Notify all admins checkbox, required Confirm with your password (focused), footer "Recorded in the audit log" + Cancel / Save 2 changes). Same overlay pattern as the other Super Admin sets. Not designed yet: wrong-password error and the saved/discarded success toasts |
| Super Admin Global settings: **AI & anomaly detection section** (designed 2026-11-17, **not built**) | `BfnusLHkd` | Same page shell as `tsrXCiWWw` with "AI & anomaly detection" selected in the left section list. Frame height is fit-content. Right column: scope note; section heading + "▶ Test on last 30 days" button; 4 health tiles (ML service Online ~180 ms, Models last trained, Flagged last 30 days 4.1%, amber AI check pending 3 vouchers / retrying); **Anomaly detection** card (sensitivity as 3 radio option cards Relaxed / Balanced "Recommended" / Strict, each with a plain description and expected flag rate, Strict selected + "Edited · was Balanced" pill; "What counts as unusual" 2×2 checkbox grid: amount far above normal, possible duplicate, new payee large first payment, outside working hours (off); "Skip vouchers below ₱1,000.00"); 2-column row with **Category suggestions** (suggest-while-typing toggle, 70% confidence slider with coverage note, locked "Clerk confirms the category: Always") and **ML service & retraining** (locked "If the AI is down: Check later", retry interval select, retrain schedule select, next run + "Retrain now"). Values are placeholders; the checks and retraining options need to be confirmed against the Phase 5 ML service |
| Super Admin AI section click-flow set (designed 2026-11-19, **not built**) | `sgLGec5BS`, `X5hiUZw_M`, `SwqW6vgex` | 3 copies of the AI & anomaly detection page (`BfnusLHkd`) in a row, each showing one header-button click with that button highlighted. A1 **Change history** `sgLGec5BS`: 460px right panel already filtered to the **AI 6** tab, an amber note saying the unsaved Strict edit appears only after saving, and 6 AI entries (retrain schedule with "↺ Restore", possible-duplicate check Off → On, Ramon Cruz Relaxed → Balanced, confidence 60% → 70%, skip-below ₱500 → ₱1,000, System "AI defaults applied"), footer "Showing 6 of 6 AI changes" + Open full audit log →. A2 **Discard** `X5hiUZw_M`: 500px dialog with a **scope choice**: "Only this section" (1 change, selected, Sensitivity Strict → Balanced) or "All sections" (2 changes, also resets the threshold ₱50,000 → ₱25,000), Keep editing / red "Discard 1 change". A3 **Save changes** `SwqW6vgex`: 560px review modal with changes grouped by section (AI first: Balanced → Strict + a Primary Faint **"Tested on the last 30 days"** box: 137 of 1,512 flagged, 9.1% vs 62 / 4.1%, "See which vouchers →"; then Approval rules ₱25,000 → ₱50,000), an amber note (about 75 more flagged vouchers a month for Supervisors), a filled Reason, Notify admins, a focused password field, Cancel / Save 2 changes. Numbers are placeholders |
| Super Admin Global settings: **OpenAI usage section** (designed 2026-11-19, **not built**) | `bKB5a9QuJ` | Same page shell as `BfnusLHkd` with "OpenAI usage" selected in the left section list (the amber unsaved dots stay on Approval rules and AI). Scope note: OpenAI only writes report summaries and gets totals/counts, never names, descriptions or files. Heading + "↻ Check connection". 4 tiles: Connection (Connected, gpt-4o-mini ~2.4 s), Spent this month $15.40 (62% of the $25.00 cap), Summaries this month 214 (~$0.07 each), amber Summaries failed 2 reports (retrying). **Monthly spend** card: "On track" pill, $15.40 of $25.00 bar with a lighter "expected by month end" part (forecast ~$21.80) and an amber marker at the 80% alert; Monthly spend cap ($ input), Warn me at (select 80% / $20.00), When the cap is reached (radio cards: **Pause summaries** "Recommended", selected, reports still come out marked "Summary paused" / Keep going and alert me). 2-column row: **Usage by company** (Apex $6.90 · 96, Bayview $5.10 · 71, Greenline $2.70 · 39, Northfield $0.70 · 8 amber/suspended, total 214 · $15.40) and **Connection & privacy** (API key sk-••••4f2a + Replace, Model select, If a summary fails: Retry in 10 min, then "Summary unavailable" after 3 tries, locked "🔒 Totals only", Example of what's sent box). Values are placeholders |
| Super Admin OpenAI section click-flow set (designed 2026-11-19, **not built**) | `PessNGl5n`, `pTscRvfUb`, `s2sCEHFqY` | 3 copies of the OpenAI usage page (`bKB5a9QuJ`) in a row, each showing one header-button click with that button highlighted. This section has **no unsaved edits** (both edits are in Approval rules and AI), and the overlays say so. O1 **Change history** `PessNGl5n`: 460px right panel filtered to **OpenAI 5**, grey note "No unsaved edits in this section", entries: cap $20 → $25 (with "↺ Restore $20.00"), At cap Keep going → Pause summaries, Ramon Cruz model gpt-3.5-turbo → gpt-4o-mini, Warn at 90% → 80%, System "OpenAI defaults applied"; footer "Showing 5 of 5 OpenAI changes" + Open full audit log →. O2 **Discard** `pTscRvfUb`: 500px dialog "Discard 2 unsaved changes?" listing each edit **by section with a "Go to section →" link** (threshold ₱50,000 → ₱25,000; sensitivity Strict → Balanced) plus a grey "OpenAI usage (this section) · No changes" row, Keep editing / red Discard 2 changes. O3 **Save changes** `s2sCEHFqY`: 560px review modal grouped by section with impact lines, a grey "OpenAI usage · No changes" row ("Neither change affects OpenAI spend"), amber note that the two edits pull in opposite directions, filled Reason, Notify admins, focused password, Cancel / Save 2 changes |
| Super Admin **Audit logs tab page** (designed 2026-11-19, **not built**) | `EJ0asP2ZH` | Made from a copy of the v2 landing page; v2 top nav with "Audit logs" underlined; frame height fit-content. Header (title, "Entries can't be edited or deleted", green "● Live · updated just now" pill, ↓ Export CSV). 4 cards: Events today 1,284 · amber Sensitive actions (7 days) 23 · red Failed sign-ins (24 h) 9 "5 from one IP" · Kept for 7 years "🔒 Append-only". Log card: filter bar (search person/record/IP, All companies ▾, All actions ▾, Today ▾, Sensitive only checkbox) + table Time ↓ / Who (avatar, name, role) / Action (coloured pill + amber ⚑ for sensitive) / Record (name + table #id) / Company / IP / ›. Row 1 **expanded** (Primary Faint): John Doe changed Maria Lopez's role, with a "What changed" box showing old → new values (role accounting_clerk → accounting_officer, email @Clerk.com → @Officer.com), request ID and browser. Other rows: company access granted, Unknown "Sign-in failed ×5" (red IP, blocked 15 min), voucher approved / returned (number only, "Amounts hidden from Super Admin"), System backup completed, Felix signed in (two-step passed). Footer "Showing 1–7 of 1,284" + pager |
| Super Admin **Admins tab page in the v2 nav shell** (made 2026-11-19, **not built**) | `U7glXUOSF` | Copy of `EJ0asP2ZH`'s landing shell with "Admins" underlined in the top nav, and the body copied from `XGSlfiNvJ` (same header, 4 summary cards, views/search/sort, 6-row admin table). Shown in the **normal state**: no row selected, the "1 selected" bulk actions hidden, and no ⋯ menu open (`XGSlfiNvJ` keeps the selected + menu-open state). Frame height fit-content |
| Super Admin **Admins click-flow set** (designed 2026-11-19/20, **not built**) | A1 `tzF153Wh1` · A2 `SYHP0VMlF` · A3 `GXbiYfpz8` · A4 `F_8EeA4fN` · A5 `drGm8Q3A3` · A6 `MJPZhmmz3` · A7 `P0pLQLVaa` · A8 `lsRiMKhBC` · A9 `JQSwKWYCo` · A10 `moe5n7c5C` · A11 `EMz6kHqfB` · A12 `QgC8ADhk4` | Copies of the Admins tab page in the v2 nav shell (`U7glXUOSF`), one per click, the clicked control highlighted. A1 Export dialog (CSV/PDF, which accounts, 6 include checkboxes, "Passwords are never exported"). A2 Add admin modal (copied from `TkIHF89oH`, sample Rhea Valdez EMP-2026-0008). A3 Search "liz" → 1 match (800px tall). A4 Sort menu (Last sign-in ✓, Name, Role, Needs attention, Date created + Newest/Oldest). A5 Pending view (amber tab, only Carlo, "Waiting for first sign-in" bar with Resend sign-in details / Cancel invite; 800px). A6 Bulk select (John + Liza ticked, "2 selected" bar: password reset, require two-step, deactivate, clear). A7 Row ⋯ menu for John Doe (View profile, Edit details, Send password reset, Require two-step, Make Super Admin "1 seat left", Deactivate; frame 920px so it isn't cut). A8 View profile 460px side panel (details, amber two-step-off box with "Require it", 2 managed companies, recent activity, Send password reset / Edit details). A9 Edit details modal (name, email with fixed @Administrator.com and an "Edited · was johndoe" warning, locked Employee ID, company chips + Add company, "1 change"). A10 Password reset confirm (link expires in 60 min, sign-out-everywhere option, "You never see their new password"). A11 Require two-step confirm (what happens next, 3-day setup window, email setup steps). A12 Make Super Admin confirm shown **blocked**: seats 2/3 → last seat, what they gain, checklist with "Two-step sign-in is off" failing, disabled confirm + "Require two-step first". **A13 Deactivate still needs a frame** |
| Super Admin **Audit logs click-flow set** (designed 2026-11-20, **not built**) | AL1 `EJ0asP2ZH` · AL2 `F1sqrL47f` · AL3 `YVcTExXXk` · AL4 `W47j24JwQ` · AL5 `WSbuSUy5K` · AL6 `BcPDn1MbQ` · AL7 `cY8zDqTvU` · AL8 `jx8DjvvgZ` · AL9 `F1CVD5vpw` | Copies of the Audit logs page, one per interaction. AL1 Export CSV dialog (date range chips, which events: all / sensitive / match filters, also include before/after + request ID, amber personal-data warning, "1,284 rows · about 240 KB"). AL2 Search "180.190.77.4": 3 events from that IP (2 accounts tried, a password reset asked), amber banner + red Block this IP. AL3 Company filter dropdown (find, 2 of 5 selected, Northfield "Suspended", Platform-wide option, Apply · 1,043). AL4 Action filter (5 groups with counts summing to 1,284, Sign-in & security expanded/ticked). AL5 Date range panel (presets + Nov 2026 calendar, Nov 12–19 selected, future days greyed). AL6 Sensitive only (checkbox on, removable chip, only ⚑ rows, Sensitive card outlined). AL7 Event details side panel (done by, what changed old → new for user_company_access #212, IP/browser/request ID, green "Untouched since it was written" tamper check, same-request events, Copy link / View access). AL8 Block IP red confirm (evidence: 8 failed, 2 accounts, 0 successful; block for 24 h / 7 days / until unblocked; required reason; warn targeted users). AL9 No results empty state ("pedro lim" + Northfield + last 7 days, explanation, Search all companies / Clear filters). Filtered frames fixed at 1200×800 |
| Super Admin **System health tab page** (designed 2026-11-20, **not built**) | `m80KDanOj` | Made from a copy of the Audit logs page; v2 top nav with "System health" underlined; height fit-content. Header ("Checked every 60 seconds", amber "● 1 service needs attention", ↻ Check now, Run backup now). 6 service cards in 2 rows: Web app & API (Working, 99.98% uptime, ~180 ms), Database (Working, 41% storage bar, 8.2 of 20 GB), **Background jobs** (amber card, Slow, 5 failed / 14 waiting), Scheduler (last run 2 min ago, next budget check / Dec 1 forecast), ML service (180 ms, models trained Nov 1, OpenAI connected), Backups (last good 2:15 PM, 1.2 GB off-site). Bottom row: "Jobs that need a look · 5" table (3 AI anomaly checks Retrying x of 6, 2 OpenAI report summaries Failed 3 of 3) + "↻ Retry failed (2)"; 360px side column: Uptime 30-day bar strip (Nov 7 amber), Blocked addresses (180.190.77.4 until Nov 26, Unblock, links to Audit AL8), Recent incidents. Numbers match the AI, OpenAI and Audit frames |
| Super Admin **System health click-flow set** (designed 2026-11-20, **not built**) | SH1 `J3we7ru59` · SH2 `HPceTpaUq` · SH3 `NZZ80sadt` · SH4 `y5H_QPGwO` · SH5 `pZGUgQsG5` · SH6 `vmsWCAimJ` · SH7 `yW7sjQycG` · SH8 `TMl_TrDqz` · SH9 `BUnDf0lzZ` · SH10 `d3u7JybYW` | Copies of the System health page (`m80KDanOj`; `oNDavkrey` is an unused spare copy), one per interaction, clicked control highlighted. SH1 Check now running (button + pill "Checking…", Primary Faint progress banner "3 of 6 done", lower cards grey "◌ Checking…", upper cards "· just now"). SH2 Run backup confirm (what gets copied, last backup / takes 3–5 min / scheduled 2:15 AM still runs, green "app keeps working" note, optional "Why now?", Cancel / Start backup). SH3 Backup running (button disabled "Backing up… 45%", Backups card Primary with 45% bar + Cancel backup, banner with 3 steps copy → upload → test). SH4 Background jobs details side panel (why slow, Waiting 14 / Running 2 / Done 1,206 tiles, 24-hour queue bar chart, already handled list, Retry failed (2) / See the job list). SH5 Job details side panel for the failed Bayview summary (3 tries timeline, what users saw, 🔒 totals-only payload, $0.00 cost, request ID, Retry this job / Dismiss). SH6 Retry failed confirm (2 ticked jobs, OpenAI answering again, ~$0.14, $15.54 of $25 cap, AI checks not included). SH7 Uptime day details (Nov 7 bar outlined, inline callout: slow 25 min 11:40 PM–12:05 AM, cause, Open incident →). SH8 Block an address (IP field, amber "a real account used this address" warning for Liza Santos, 24 h / 7 days / until unblocked, required reason, red Block address). SH9 Unblock confirm (why blocked, amber "12 more attempts refused while blocked", "Watch it for 24 hours" auto re-block, Keep blocked / Unblock). SH10 Incident details side panel (Watching, impact, timeline 1:58–2:40 PM, closing note, Mark resolved / Retry failed (2)) |

| Super Admin additions (designed 2026-11-20, in progress) | design page `yEHg8D3pX` | Separate design page (the main canvas page times out on new top-level frames). Planned: status pill sheet incl. grey "Not set up" (`Nd7r28KNn`, started), tablet/phone top nav, A13 Deactivate admin confirm, success/error message sheet for all roles. See the 2026-11-20 session notes. **Framer updates DROPPED 2026-11-20 (code first; the frames below are out of date in these places):** `TkIHF89oH` password block `BiwFcz2mt` DELETED; a Company field row (`CompanyRow`) may or may not have landed in `MwU1PO58R` (check before re-adding); still add Personal email field, "we email a one-time link" note, warning text "…access to Apex Holdings Inc." (`miCUnTeix`), subtitle `li8h2beaM`. Then `Nhw7N27tM` (one company), `lmhV2DJV1` (3 role cards, fixed company), `vnNFYExpX` (+ Add company, note text), `moe5n7c5C` (one company), and a new Set password page frame |

Add a row here whenever a new frame is designed. **Every click-flow set needs its success and error states** (user rule 2026-11-20, all roles).

#### Frame → phase map (Claude decides; the user doesn't track phases)

When the user pastes a frame, decide its phase from what it shows:

| Phase | What the frame shows                                                                                           |
| ----- | -------------------------------------------------------------------------------------------------------------- |
| 1     | Login, forgot password, company selection                                                                      |
| 2     | Admin screens: users, companies, departments, company access, categories, voucher/payee types, admin dashboard |
| 3     | Voucher list, create/edit, details, line items, attachments, PDF                                               |
| 4     | Approval inbox, approve/reject/return, budgets, notifications                                                  |
| 5     | AI suggestions, anomaly panels, forecasts                                                                      |
| 6     | Operational dashboards, reports, charts                                                                        |

If the frame needs foundation from an earlier phase that isn't built yet (for example, an admin frame before auth exists), build that minimal foundation first and explain it simply. Tell the user which phase the frame belongs to.

#### Everyday commands

| Do this                         | Run (folder)                                                                                                                            |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Start BOTH servers (one command) | `.\dev.ps1` (project root, PowerShell), or `.\dev.ps1 -Testing` for sample data. Ctrl+C stops both. Or VS Code: Tasks: Run Task, then "Dev: start both…". Code changes reload by themselves; restart only after editing `.env`. Guide: `docs/DEV_SERVERS_GUIDE.md` |
| Start the API                   | `php artisan serve` (backend), served on :8000                                                                                          |
| Start the React app             | `npm run dev` (frontend), served on :5173; `/api` is proxied to :8000                                                                   |
| Run all backend tests           | `php artisan test` (backend). Uses the `_testing` DB only                                                                               |
| Fill the test DB with demo data | `php artisan db:seed --env=testing` (backend). Re-run after `php artisan test`, because tests wipe it                                   |
| Add your own sample users       | edit `database/seeders/SampleUsersSeeder.php`, then seed as above                                                                       |
| Run the app on the test DB      | PowerShell: `$env:APP_ENV = "testing"; php artisan serve`. `serve --env=testing` does NOT work. Full guide: `docs/SAMPLE_DATA_GUIDE.md` |
| Tidy PHP code                   | `vendor/bin/pint` (backend)                                                                                                             |
| Check frontend code             | `npm run lint` (frontend)                                                                                                               |

Demo logins (DemoDataSeeder, no departments, Employee IDs `EMP-2026-000x`; all use the password `password`): `admin@advms.test`, `clerk@advms.test`, `officer@advms.test`, `supervisor@advms.test`.

Sample logins following the domain convention (SampleUsersSeeder; password `password`): `johndoe@Administrator.com` (admin), `marialopez@Clerk.com` (clerk), `joseramos@Officer.com` (officer), `anamendoza@Supervisor.com` (supervisor), `felixbianito@Superadmin.com` (super_admin, no company; lands on `/superadmin`). Real Super Admins are made only with `php artisan superadmin:create` (max 3 active). The email domain is only a naming convention. Access and redirects are decided by `users.role`, never by the domain.

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
- **Every future schema change is a NEW migration** in `backend/database/migrations/`, and still needs user approval first.
- **Testing DB first, real DB last** (the user's rule, adopted 2026-11-16). Run every command in `backend`.
  1. Write the migration and run it on the **testing DB only**: `php artisan migrate --env=testing`.
  2. Run `php artisan test` and `php artisan db:seed --env=testing`, then let the user try the feature against the testing DB (`.\dev.ps1 -Testing`).
  3. If something is wrong: `php artisan migrate:rollback --env=testing`, fix the migration, then go back to step 1.
  4. **Only after the user says it's OK**, run it on the real DB with `php artisan migrate`, then refresh the baseline with `php artisan schema:dump`.
  5. Never run `php artisan migrate` (the real DB) in the same step as writing a migration.
- `ai_driven_voucher_monitoring_system_database.sql` is the user's phpMyAdmin snapshot, kept for reference (older than `mysql-schema.sql`).
- **2026-11-19 (after the XAMPP crash), written but NOT run by Claude:** 6 user-approved migrations `2026_11_19_000001…000006` (super_admin role, `system_settings`, nullable `audit_logs.user_id/company_id` with ON DELETE RESTRICT on audit/approval history, company suspension columns + non-null `is_active`, per-company unique catalog names/codes, `voucher_categories.is_active` → 0/1). `backend/database/schema/full-schema-with-superadmin.sql` = baseline + these 6, with their `migrations` rows, for rebuilding the DB by import. The user rebuilt the real DB by importing that file, and on 2026-11-19 Claude refreshed `mysql-schema.sql` with `php artisan schema:dump` (45 `migrations` rows, so the 6 new migrations are now part of the baseline; MariaDB writes RESTRICT foreign keys without an `ON DELETE` clause, which means the same thing). The user runs tests and seeders themselves.
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
  - Done 2026-11-15: the admin landing page (`Nhw7N27tM`).
    - `role:admin` middleware (`EnsureUserHasRole`).
    - `AdminDashboardSummary` query class.
    - AdminLayout with sign-out.
    - `lib/formatters.js`.
    - Other admin menu links show "coming soon" until their frames are built.
  - Done 2026-11-16: notifications bell panel (`D7aTKQEDz`).
    - Migration `2026_11_16_000001` (user-approved) adds the admin types `security_alert`, `access_changed`, `user_changed`, `department_alert` and `company_changed` to `notifications.type`.
    - The `NotificationType` enum maps each type to a category.
    - `SampleNotificationsSeeder` adds samples for admins.
    - Nothing creates admin notifications automatically yet; hook them in as features are built.
  - Done 2026-11-16: Create user (`lmhV2DJV1`).
    - `CreateUser` action (one transaction): user, company access, audit log row, `user_changed` notification to the other admins.
    - Employee IDs come from `EmployeeIdGenerator` (`lockForUpdate` + retry).
    - Migration `2026_11_16_000002` (user-approved) adds a UNIQUE index on `users.employee_id`.
    - The demo seeders no longer create departments and use the generator for IDs.
  - Done 2026-11-20: Super Admin landing page (`uH0wO9f5O`).
    - `role:super_admin` route group `/api/v1/superadmin`, `ROLE_HOME[super_admin] = /superadmin`, `@Superadmin.com` in `RoleEmailDomains`.
    - `php artisan superadmin:create` (`CreateSuperAdmin` action: seat limit 3 with `lockForUpdate`, audit row with NULL user/company, security_alert to the other Super Admins).
    - Scheduler heartbeat in `routes/console.php` (cache key read by the Services panel). `ML_SERVICE_URL` in `config/services.php`.
    - `Pill`, `greeting()`, `plural()` promoted to `components/common` / `lib/formatters.js`.
  - Done 2026-11-20 (user-approved follow-ups):
    - **Timezone:** `APP_TIMEZONE=Asia/Manila` + DB connection `timezone` `+08:00` (`DB_TIMEZONE`). Rows Laravel wrote before this were in UTC, so they read 8 h early.
    - **Platform defaults:** `SystemSettingsSeeder` (in DatabaseSeeder, safe on the real DB, never overwrites) writes `SystemSettings::DEFAULTS`: high-value threshold ₱50,000.00, AI sensitivity balanced, OpenAI cap $25.00, Super Admin idle timeout 15 min, plus one `defaults_applied` audit row.
    - **Suspended companies:** `AccountStanding` rule, used at sign-in (`AuthenticateUser`) and on every request (`account.standing` middleware). A clerk/officer/supervisor whose companies are ALL suspended/inactive gets 403 `COMPANY_SUSPENDED`; a deactivated account gets 403 `ACCOUNT_INACTIVE` and is signed out on its next request. Admins and Super Admins aren't blocked by a suspension.
    - **Super Admin session:** `idle.timeout` middleware (401 `SESSION_EXPIRED` after the idle setting), no "keep me signed in" cookie, `throttle:superadmin` 60/min. Timer requests send `X-Background-Refresh: 1` (`BACKGROUND` in `lib/apiClient.js`) so polling isn't activity. apiClient shows a toast and clears the session for SESSION_EXPIRED / COMPANY_SUSPENDED / ACCOUNT_INACTIVE.
    - **Admins can't create Admins:** `StoreUserRequest::ROLES` = the 3 operational roles; the Create user form shows 3 role cards (the `lmhV2DJV1` design still shows 4).
    - **dev.ps1** also runs `php artisan schedule:work` (3rd process, [scheduler] lines).
    - `last_login_at` default removed (migration `2026_11_20_000001`): on the real DB (user ran it 2026-11-20); baseline re-dumped.
    - **One company per Admin + invitation email** (user decisions 2026-11-20): migration `2026_11_20_000002` adds `users.personal_email` (on the real DB since 2026-11-20; baseline re-dumped). `invites` password broker (72 h) in `config/auth.php`, `AccountInvitationMail` + `resources/views/emails/account-invitation.blade.php`, `config('app.frontend_url')` (FRONTEND_URL). New Admins are `access_status = pending` until they set a password. Admin dashboard, company lookup and Create user are limited to the Admin's company; `StoreUserRequest` only allows that company. Mail is `MAIL_MAILER=log` locally: invitations land in `storage/logs/laravel.log`. Throttle `invitation` = 10/min per IP.
    - Shared form pieces promoted: `components/common/FieldShell.jsx` (+ `inputClass`), `components/common/EmailNameField.jsx`, `lib/password.js` (`generatePassword`).
    - `users.deactivated_at` (user's migration `2026_11_19_174142`, baseline re-dumped) shows as "Deactivated Nov 10".
  - Done 2026-11-20: Security alerts panel (`mQcXDCyDZ`) + Alert detail (`SCoT_cu7B`).
    - Migration `2026_11_20_000003` (user-approved) adds `security_alerts` (shared by all Super Admins: severity, status open/reviewed/dismissed, reviewed_by). On the real DB since 2026-11-20 (user ran it); `mysql-schema.sql` re-dumped and `full-schema-with-superadmin.sql` rebuilt from it (now = baseline + header, all 49 migration rows).
    - Rules (`Domain/Security/Actions/WatchSignIns`): 5+ failed sign-ins for one email in 5 min = High (more failures join the open alert); Admin/Super Admin on a never-seen browser+system = Medium (first recorded sign-in is the baseline); password changed via reset link = Low; `superadmin:create` = Low. Every sign-in now writes an audit row (`login` / `login_failed`, with device).
    - Lock = `is_active=false` + sessions deleted (needs the Super Admin's password, `current_password`). Reset = 60-min link (`users` broker) to `personal_email`; the old password is scrambled only after the email is sent. `/set-password` accepts both kinds of link (`kind` in the check response).
    - Dashboard "Needs your attention" counts open `security_alerts` (red if any High). Shared `components/common/ConfirmDialog.jsx`.
    - Pint gotcha: run `vendor/bin/pint --dirty`, not plain `pint`; plain `pint` also reformats the old `2026_06_30` migration, which must stay untouched.
  - Gotcha: `cn()` (the `cn` package) must list every custom `text-*` style in `lib/utils.js`. Otherwise it drops it when it's combined with a colour class.
- [ ] **Phase 3 — Voucher core:** drafts + line items, secure attachments, numbering, state machine, idempotent submit, cancel, PDF.
- [ ] **Phase 4 — Approvals & budgets:** inbox, approve/reject/return, step 2 routing, budget locking + alerts, event-driven notifications.
- [ ] **Phase 5 — AI service:** FastAPI ML service, MlClient + fake, classification, anomaly job, monthly forecast, OpenAI summaries.
- [ ] **Phase 6 — Reports & dashboards:** cached role-aware summaries, queued report generation, PDF/XLSX export.
- [ ] **Phase 7 — Hardening:** full test coverage + E2E, OWASP review, audits, index/N+1 review, OpenAPI docs.
- [ ] **Phase 8 — Deployment:** Docker + Compose, GitHub Actions CI/CD, Oracle VM + Caddy, Cloudflare Pages, R2 backups, Sentry, UptimeRobot.

### Open decisions (each needs user approval; see guide §13)

1. ~~Schema baseline~~ Done 2026-11-15; see "Database schema & migrations rules".
2. Confirm the voucher flow. "High-value" now has a starting value of ₱50,000.00 (a Global setting the Super Admin can change).
3. Choose a single roles source: the `users.role` column vs `spatie/laravel-permission` (both exist now).
4. Schema additions per phase: `vouchers.version`, a voucher-number sequence, `idempotency_keys`, indexes.
5. Backend deps: scramble, larastan, predis/phpredis, sentry-laravel, flysystem-aws-s3-v3.
6. Frontend deps: @tanstack/react-query, vitest + RTL + msw, playwright, @sentry/react.
7. ~~Restructure the frontend into `features/` folders.~~ Adopted 2026-11-15; see "Frontend folder structure".
8. Install Docker Desktop and a Python 3.12 venv when their phase starts.
9. Buy a domain before Phase 8.
