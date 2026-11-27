# Framer frame catalog

Every designed frame in the Framer project **AI-Driven-Voucher-Monitoring-System-Design**, with its node id,
phase and build status. You don't need to paste node ids any more:

- **Say the name or code:** "build the Companies tab", "build C6", "build SH2". Claude looks the id up here.
- **Or select it in Framer** (MCP plugin open) and say "build the selected frame".

_Last updated: 2026-11-21 (Admins tab built). Made from the frame table in `CLAUDE.md`, plus checks in Framer where an entry looked
doubtful. Claude updates it after every build. Phases are explained in `docs/workflow/PHASES.md`._

**Where the frames are:** almost everything is on the main canvas page `augiA20Il` (too big to open in one go, so
frames are always read one at a time). New design work goes on the design page `yEHg8D3pX`.

**Status:** ✅ Built · 🟡 Partly built · ⬜ Not built · ⏭ Replaced (don't build) · 🧩 Design unfinished

**Overlay frames:** a click-flow frame is a copy of a page with one dialog / panel / menu open on top
(a dark scrim + the panel). Building it means building that dialog / panel, not the page again.

## Summary

| Area | Frames | ✅ | 🟡 | ⬜ |
|---|---|---|---|---|
| Sign-in (Phase 1) | 2 | 1 | 0 | 1 |
| Admin (Phase 2) | 4 | 4 | 0 | 0 |
| Accounting Clerk (dashboard + Drafts + Returned + Payees + Help, Phases 3/6) | 13 | 13 | 0 | 0 |
| Super Admin: landing + its click-flows | 12 | 7 | 0 | 4 |
| Super Admin: Admins tab | 14 | 12 | 1 | 0 |
| Super Admin: Companies tab | 10 | 10 | 0 | 0 |
| Super Admin: Global settings tab | 12 | 4 | 0 | 8 |
| Super Admin: Audit logs tab | 10 | 10 | 0 | 0 |
| Super Admin: System health tab | 11 | 11 | 0 | 0 |
| Account menu pages (Admin + Super Admin, code-first) | 0 | 5 built without frames | — | — |
| Accounting Officer (dashboard + review queue + flagged + budgets + forecasts + reports + help, Phases 4/5/6) | 20 | 20 | 0 | 0 |
| Phases 3–6 (vouchers, approvals, AI, reports) | 18 (clerk + officer rows) | — | — | — |

Phases 3–6 have only the clerk Drafts (2026-11-25) and Returned to me (2026-11-26) frames so far. Since 2026-11-20 screens can also be built code-first from a
description, keeping the design tokens.

---

## 1. Sign-in (Phase 1)

| Code | Frame | Node id | Status | Notes |
|---|---|---|---|---|
| — | Login UI 2 (centered card on dark background, floating preview cards) | `p0wwkrh66` | ✅ | `features/auth/pages/LoginPage.jsx` |
| — | Login UI 3 (navy hero banner + white form panel) | `XJ4eU6eCT` | ⬜ | Alternative login look; needs `VM-hero-banner.png` in `frontend/src/assets/` |

The `/set-password` page (invitation / reset link) was built code-first; it has no frame.

## 2. Admin (Phase 2)

| Code | Frame | Node id | Status | Notes |
|---|---|---|---|---|
| — | Admin dashboard (sidebar, 4 stat cards, recent activity, quick actions) | `Nhw7N27tM` | ✅ | Still shows 4 companies; Admins now run ONE company |
| — | Account menu (⋮) open | `nj06iziQJ` | ✅ | Menu pages are "coming soon" |
| — | Notifications panel open | `D7aTKQEDz` | ✅ | |
| — | Create user modal | `lmhV2DJV1` | ✅ | Frame shows 4 role cards; code has 3 (Admins can't create Admins) |

Not designed yet: Users list, Departments, Company access, Categories, Voucher types, Payee types.

## 3. Super Admin: landing page and its click-flows (Phase 2)

| Code | Frame | Node id | Status | Notes |
|---|---|---|---|---|
| — | Landing page v1 (sidebar version) | `kVkbQkamQ` | ⏭ | Replaced by v2 |
| — | **Landing page v2** (top nav, welcome banner, services, needs your attention, admin list, global rules) | `uH0wO9f5O` | ✅ | `features/superadmin/dashboard/` |
| 00 | Base copy for the click-flow set | `QrNeV7MPj` | — | Same as the landing page |
| 01 | Notifications dropdown (v2 nav) | `dQvu8A865` | ⬜ | The bell works (admin-style panel); this is the v2 look |
| 02 | Add admin modal | `TkIHF89oH` | ✅ | Code differs: company + personal email, invitation link, no password |
| 03 | Security alerts side panel | `mQcXDCyDZ` | ✅ | `features/superadmin/security/` |
| 04 | Alert detail panel | `SCoT_cu7B` | ✅ | |
| 05 | Admin accounts page (filters + table) | `bxGFPLOVN` | ✅ | The Admins tab, `/superadmin/admins` |
| 06 | Run backup confirm | `TKziMjHUe` | ✅ | `features/superadmin/backups/` |
| 07 | Retry failed jobs modal | `fzdOvPqCX` | ✅ | `features/superadmin/jobs/` |
| 08 | Company panel (suspended, Reactivate) | `FC7jMBFYg` | ⬜ | Needs the Companies feature |
| 09 | Edit global settings modal (password to save) | `C3d2wopED` | ⬜ | Same as the Global settings save step |
| 10 | Account menu (v2 nav) | `PSEjFM9zW` | ⬜ | A working account menu exists; this is the v2 look |

## 4. Super Admin: Admins tab (Phase 2)

| Code | Frame | Node id | Status | Notes |
|---|---|---|---|---|
| — | **Admins tab page**, normal state (v2 nav shell) | `U7glXUOSF` | ✅ | `features/superadmin/admins/pages/AdminAccountsPage.jsx` (replaces the simpler `bxGFPLOVN` layout) |
| — | Admins tab page, row selected + ⋯ menu open | `XGSlfiNvJ` | ✅ | Same page (selection + menu) |
| A1 | Export dialog (CSV/PDF, which accounts, what to include) | `tzF153Wh1` | ✅ | "Companies they manage" → "Company" (one per Admin) |
| A2 | Add admin modal | `SYHP0VMlF` | 🟡 | Uses the current modal (company + personal email, invitation link); the frame still shows the old temporary-password version |
| A3 | Search "liz" → 1 match | `GXbiYfpz8` | ✅ | |
| A4 | Sort menu | `F_8EeA4fN` | ✅ | |
| A5 | Pending view (Resend / Cancel invite bar) | `drGm8Q3A3` | ✅ | Text changed: invitation link (72 h), not a 7-day temporary password. Cancel invite DELETES the never-used account (decision 2026-11-21) |
| A6 | Bulk select ("2 selected" bar) | `MJPZhmmz3` | ✅ | Skipped accounts are listed with the reason |
| A7 | Row ⋯ menu | `P0pLQLVaa` | ✅ | Also has Resend invitation, Cancel invite, Reactivate |
| A8 | View profile side panel | `lsRiMKhBC` | ✅ | Tabs Overview / Company / Activity; one company |
| A9 | Edit details modal | `JQSwKWYCo` | ✅ | One Company select + Personal email (decision 2026-11-21) |
| A10 | Password reset confirm | `moe5n7c5C` | ✅ | Link goes to the PERSONAL email; "Also sign them out everywhere now" tick box |
| A11 | Require two-step confirm | `x8wWbSPsg` (older copy `EMz6kHqfB`) | ✅ | Two-step sign-in built 2026-11-21 (authenticator app, backup codes, setup deadline) |
| A12 | Make Super Admin confirm (blocked) | `QgC8ADhk4` | ✅ | Password asked when every check passes |
| A13 | Deactivate admin confirm | — | ✅ | Built code-first (password asked). Decided 2026-11-21: "Lock" and "Deactivate" are ONE action, called Deactivate |

## 5. Super Admin: Companies tab (Phase 2)

| Code | Frame | Node id | Status | Notes |
|---|---|---|---|---|
| — | **Companies tab page** (summary cards, views, 2×2 company cards) | `vnNFYExpX` | ✅ | Built 2026-11-21. Code differs: subtitle no longer says Admins set companies up; "Set up by" → "Admin: <name>" (the Admin in charge, or amber "No Admin yet"); the address is shown instead of a city (no city field); suspended note says "N users blocked · data kept". Still needs "+ Add company" (not designed) |
| — | Base copy for the click-flow set | `CGGx439Db` | — | |
| — | Another copy of the base page (Greenline shows the "New" pill) | `ZzwBy6v6q` | ✅ | Same as `vnNFYExpX`; the "New" pill (companies added in the last 30 days) was already built |
| C1 | Export list dialog | `UpMMFLXSI` | ✅ | Built 2026-11-21. Excel / CSV / PDF; Companies select = All / Active only / Suspended only (+ "Matching …" when a search is typed); "Name, type, **address** and status" (no city field) also adds the Admin in charge and the date added; "Suspension history" = times suspended + the current suspension (from the audit log). Keeps the screen's sort. Audit row `companies_exported` |
| C2 | Search results ("north", 1 result) | `FXRghzjCE` | ✅ | Searches name and address; footer "1 result for … · Clear search" |
| C3 | Sort menu | `oqxhehYHx` | ✅ | 6 orders + "Suspended first" switch |
| C4 | List view (table instead of cards) | `jlXT7qlCt` | ✅ | "Set up by" column → "Admin" |
| C5 | Suspended filter | `Dr5av5JaU` | ✅ | |
| C6 | Suspend confirm (reason, notify admin, type the name) | `eGUijf8Wd` | ✅ | Code differs: the "vouchers frozen" line became "people in another active company keep working there" (no vouchers yet); the Admin is told by EMAIL (they can't sign in to see the bell) |
| C7 | Reactivate confirm | `B3zqVOXN4` | ✅ | Adds an "Email <Admin>" checkbox; no frozen-vouchers line |
| C8 | Open company side panel (Overview / Departments / Users / History) | `a17W5hpkA` | ✅ | Built 2026-11-21, opens with `?company={id}`. Code differs: Overview adds Contact email/phone (when set) and Last activity, and an amber note when suspended; the footer button becomes **Reactivate company** for a suspended company (so this also covers 08 `FC7jMBFYg`); Users tab shows role, department, status and an "Access only" pill; History = suspensions / reactivations + "Added to the platform". "View audit log" goes to the Audit logs tab (`?company=`), which is still a coming-soon page |

## 6. Super Admin: Global settings tab (Phase 2)

| Code | Frame | Node id | Status | Notes |
|---|---|---|---|---|
| — | **Global settings page** (all sections) | `tsrXCiWWw` | ✅ | Built 2026-11-21 (`/superadmin/settings`). Code differs: 9 real settings; the Security card is "Super Admins: sign out when idle after" (only Super Admins have an idle timeout; others keep the normal session) and "Security alert after failed sign-ins" (it raises an alert; nothing is locked); OpenAI shows "Nothing spent yet" until Phase 5; adds a read-only **Data & backups** card (from config/backup.php); sections are 1 column with OpenAI + Security side by side on wide screens; leaving with unsaved edits asks first |
| G1 | Change history side panel | `OtA4G9A9F` | ✅ | From the audit log (`setting_changed` + `defaults_applied`). Count shown on "All" only, as in the frame. "↺ Restore" only on a setting's newest change while it's still live; it puts the old value in the form (you still Save with your password) |
| G2 | Discard changes confirm | `dLJvMyCj2` | ✅ | Screen only (nothing was saved) |
| G3 | Save changes review modal (reason + password) | `xICKww9ng` | ✅ | Impact line per setting; amber note whenever a change means LESS checking (higher threshold, relaxed sensitivity, a safety switch turned off). Wrong password / missing reason show under the field; someone else saving first = 409 with "Load their values" |
| — | **AI & anomaly detection section** | `BfnusLHkd` | ⬜ | Values to confirm against the Phase 5 ML service |
| AI1 | Change history (AI tab) | `sgLGec5BS` | ⬜ | |
| AI2 | Discard (choose: this section / all sections) | `X5hiUZw_M` | ⬜ | |
| AI3 | Save changes (with "Tested on the last 30 days") | `SwqW6vgex` | ⬜ | |
| — | **OpenAI usage section** | `bKB5a9QuJ` | ⬜ | Spend tracking comes with Phase 5 |
| O1 | Change history (OpenAI tab) | `PessNGl5n` | ⬜ | |
| O2 | Discard (by section, "Go to section") | `pTscRvfUb` | ⬜ | |
| O3 | Save changes (OpenAI unchanged row) | `s2sCEHFqY` | ⬜ | |
| 09 | Edit global settings modal | `C3d2wopED` | ⬜ | Listed in section 3 too |

Security & sessions and Data & backups sections appear in the left list but have no frames of their own.

## 7. Super Admin: Audit logs tab (Phase 2)

| Code | Frame | Node id | Status | Notes |
|---|---|---|---|---|
| — | **Audit logs page** (clean, no dialog) | `iVFf6FzsH` | ✅ | Built 2026-11-21 (`/superadmin/audit-logs`). Code differs: "Kept for 7 years" → **"Kept: Forever · Append-only · since …"** (user decision: nothing deletes entries); the Sensitive card is a button that turns on Sensitive only; failed sign-ins are one row each (no "×5" grouping); 25 rows a page with Newer / Older; ● Live refreshes page 1 every 30 s (background request, doesn't count as activity); clicking a row expands it, › / "Open details" opens AL7 |
| AL1 | Export CSV dialog **on top of the Audit logs page** | `EJ0asP2ZH` | ✅ | Date range adds "As on the page"; the row count is known for the page's range, otherwise counted on export (max 50,000 rows, 422 above). Audit row `audit_exported`. Amounts never exported |
| AL2 | Search an IP (3 events, Block this IP) | `F1sqrL47f` | ✅ | The banner also covers "no failed sign-ins" (green) and "already blocked" (red, with Unblock + confirm). "Password reset asked" rows don't exist yet (no public forgot-password page) |
| AL3 | Company filter dropdown | `YVcTExXXk` | ✅ | Counts follow the other filters; suspended companies show the pill instead of a count |
| AL4 | Action filter (5 groups with counts) | `W47j24JwQ` | ✅ | Groups from `AuditCatalog`; ▸ opens a group to tick single actions. Vouchers group is empty until Phase 3 |
| AL5 | Date range panel (presets + calendar) | `WSbuSUy5K` | ✅ | Caption says "logs are kept forever"; no event estimate |
| AL6 | Sensitive only | `BcPDn1MbQ` | ✅ | "Filtered by" chips for every filter, not just Sensitive |
| AL7 | Event details side panel (before → after, tamper check) | `cY8zDqTvU` | ✅ | Opens with `?event={id}`. No city next to the IP (no GeoIP, user decision). Tamper check = HMAC fingerprint (`AuditTrail`): Untouched / Changed / Can't be checked (written before fingerprints). Button goes to the Admin profile or the company panel when the record is one of those |
| AL8 | Block IP confirm | `jx8DjvvgZ` | ✅ | `blocked_ips` table; blocked sign-ins get 403 `IP_BLOCKED` and an audit row `login_blocked`. Adds an amber warning when real users signed in from that address in the last 30 days; you can't block your own current address (422 `IP_IS_YOURS`); unblock from the AL2 banner until System health is built |
| AL9 | No results empty state | `F1CVD5vpw` | ✅ | The sentence is built from the filters; mentions a suspended company |

Every audit entry is written through `AppDomainAuditAuditTrail::record()` (request ID + fingerprint). New actions must be added to `AuditCatalog`.

## 8. Super Admin: System health tab (Phase 2)

| Code | Frame | Node id | Status | Notes |
|---|---|---|---|---|
| — | **System health page** (6 service cards, jobs table, uptime, blocked addresses, incidents) | `m80KDanOj` | ✅ | Built 2026-11-21 (`/superadmin/system-health`). Real data only: the scheduler records a check per service every minute (`health_checks`), so uptime / strip / chart start empty ("No history yet") and fill up. Code differs: Database card = server disk used + database size + connections (the DB's own limit isn't known); Backups card has no "saved off-site" (Phase 8); ML card says "Arrives in Phase 5"; job rows show what Laravel keeps (no voucher/company per job, no try-by-try history); the page refreshes every 60 s (background request) |
| — | Spare copy (unused) | `oNDavkrey` | — | Ignore |
| SH1 | Check now running | `J3we7ru59` | ✅ | All 6 checks run in one request, so the cards show "Checking…" together and update together (no "3 of 6 done"); 6 per minute |
| SH2 | Run backup confirm | `HPceTpaUq` | ✅ | "Run backup now" opens the existing window (`?run=backup`, `TKziMjHUe`) |
| SH3 | Backup running (45% bar) | `NZZ80sadt` | ✅ | Header shows "Backing up…" and the Backups card "Backing up…" + start time; no % (mysqldump doesn't report progress), no Cancel |
| SH4 | Background jobs details side panel | `y5H_QPGwO` | ✅ | `?panel=jobs` (click the Background jobs card). "Done today" is counted by the queue worker (cache, Queue::after); chart = highest waiting per hour from the saved checks |
| SH5 | Job details side panel (one failed job) | `pZGUgQsG5` | ✅ | `?job=<uuid>`. One "gave up" entry + error lines (server folders removed), Retry this job / Dismiss; no per-try timeline, cost or "what was sent" (no OpenAI jobs yet) |
| SH6 | Retry failed confirm | `vmsWCAimJ` | ✅ | "Retry failed (N)" opens the existing window (`?retry=jobs`, `fzdOvPqCX`) |
| SH7 | Uptime day details | `yW7sjQycG` | ✅ | Click a bar: the unhealthy stretches of every service that day (from–to, minutes, page time vs normal) + "Open incident". The cause is the incident's closing note (not guessed) |
| SH8 | Block an address | `TMl_TrDqz` | ✅ | The Audit logs Block IP dialog in "type the address" mode (starts at 24 h). One address only, no ranges like /24 |
| SH9 | Unblock confirm | `BUnDf0lzZ` | ✅ | "Watch it for 24 hours" = `blocked_ips.watch_until`; 3 failed sign-ins then → blocked again 7 days automatically + bell to every Super Admin |
| SH10 | Incident details side panel | `d3u7JybYW` | ✅ | `?incident=<id>`. Incidents open by themselves after 3 unhealthy checks in a row (jobs: only a pile-up or failures in the last hour count), become Watching when healthy, Resolved by a Super Admin with a required note (audit `incident_resolved`) |

## 8b. Account menu pages (no frames: built code-first 2026-11-22)

The account menu (`nj06iziQJ` for Admins, the avatar menu for Super Admins) links to 5 pages that were never
designed. They were built straight in code with the design tokens, the same pages for both roles
(`features/account/`). If frames are drawn later, use the code as the reference.

| Page | Address (Admin · Super Admin) | Status | What it has |
|---|---|---|---|
| My profile | `/admin/profile` · `/superadmin/profile` | ✅ code-first | Identity card, Personal details (edit name + personal email; the email needs your password), read-only Work details, Security at a glance |
| Account settings | `/admin/settings` · `/superadmin/account` | ✅ code-first | Two-step sign-in (turn on with QR, new backup codes, turn off unless required), Where you're signed in (sign out one / all others), password + personal email shortcuts, sign-in rules |
| Change password | `/admin/change-password` · `/superadmin/change-password` | ✅ code-first | Current + new twice, live rule checklist, strength bar, "Suggest a strong one", success state; other browsers are signed out |
| My activity | `/admin/activity` · `/superadmin/activity` | ✅ code-first | Your own audit entries (All / Sign-in & security / Changes I made), 30-day numbers, pages of 20 |
| Help & support | `/admin/help` · `/superadmin/help` | ✅ code-first | Role-specific quick answers, who can help you (the level above you), "Copy problem details", status page link |

Still "coming soon": **All notifications** (`/admin/notifications`, `/superadmin/notifications`), the bell's "View all".

## 8c. Accounting Clerk (operational, Phase 6 dashboard on Phase 3 voucher data)

| Frame | Node id | Status | Notes |
|---|---|---|---|
| Accounting Clerk landing page | `LolF6YFo5` | ✅ 2026-11-22 | `/clerk`, `features/dashboard/pages/ClerkDashboardPage.jsx`, shell `components/layout/OperationsLayout.jsx` + `CompanySwitcher.jsx`, menu `features/dashboard/components/ClerkNav.jsx`. API `GET /api/v1/clerk/dashboard`. **Code differs (real-data rule):** "approved", not "paid out"; no "AI checks every voucher" card (no AI yet); Create voucher / Continue draft / Fix & resubmit and the voucher menu items are disabled ("Soon") until the voucher pages exist; no top-bar search yet; the ⋮ menu has only Sign out (no clerk account pages yet). |
| Clerk Drafts: list (Phase 3) | `Xfr2PEq2q` | ✅ 2026-11-25 | `/clerk/drafts`, `features/vouchers/pages/DraftsPage.jsx` + `components/DraftCard.jsx`. API `GET /vouchers?filter[view]=draft` (cards get `summary`, `line_count`, `completeness`, `expires_at`; `meta.total_amount`). **Code differs:** completeness is "N of **4** sections" (Payee, Details, Payment, Lines, the same rule Submit uses; attachments become the 5th when uploads exist); no "AI suggests" line (no AI yet); no top-bar search; Select mode deletes several drafts at once (frame shows only the button); the info note also says a reminder comes 3 days before. |
| Clerk Drafts: delete confirmation | `nxFtnDIl1` | ✅ 2026-11-25 | Shared `ConfirmDialog` (new `cancelLabel` = "Keep draft"). API `DELETE /vouchers/{id}` (sends `updated_at`: 409 `VOUCHER_CHANGED`), `POST /vouchers/drafts/delete` (several, all or nothing, 409 `DRAFT_NOT_DELETABLE`). Errors show inside the dialog; success = toast. |
| Clerk Drafts: empty state | `EfNUcqRK0` | ✅ 2026-11-25 | Dashed card. Button says "Create your first voucher" only when the clerk has no vouchers at all, otherwise "Create voucher". |
| Clerk Returned to me: list (Phase 3) | `xRM5FKjDQ` | ✅ 2026-11-26 | `/clerk/returned`, `features/vouchers/pages/ReturnedPage.jsx` + `components/ReturnedCard.jsx`. API `GET /vouchers?filter[view]=returned&sort=returned_oldest` (each voucher gets `returned`: step, role, by, remarks, at, from `Voucher::latestReturn`). Sorts: oldest / newest return, amount. **Code differs (real-data rule):** no "Needs changes: Line items / Attachments / Amount" tags (reviewers can't tag parts yet; Phase 4) and no "auto-cancelled after 5 business days" banner or "N days left" (no such rule exists; needs a user decision); no top-bar search; cards also show line count + last change. |
| Clerk Returned to me: Fix & resubmit | `EWrCKOIlI` | ✅ 2026-11-26 | The voucher form (`/clerk/vouchers/:id/edit`) in its returned layout: `components/ReturnedBanner.jsx` + `ReturnSummary.jsx`. Header Save changes / Resubmit for review (also in the bottom bar), reviewer banner, summary with live total vs. **the total when it came back** (`returned.amount_at_return`, read from the first `voucher_updated` audit row after the return), voucher no., company, line count, Approval route (step 3 caption from `/approval-rules`). **Code differs:** no AI category box, AI pre-check, department budget or attachment upload (not built); no per-line "qty was 150" marks (no snapshot of the lines at return); the green chip says "Changes saved since it came back" instead of per-part ✓ chips. |
| Clerk Returned to me: all caught up | `hCVo9GrUL` | ✅ 2026-11-26 | Dashed card, green ✓ tile, "View my vouchers →". |
| Clerk Payees: directory (Phase 3) | `jbj8yIDz9` | ✅ 2026-11-26 | `/clerk/payees` (sidebar Reference → Payees), `features/payees/pages/PayeesPage.jsx`. API `GET /payees` (type chips from `meta.counts`), `GET /payees/export?format=csv|xlsx` (audited). Address keeps `?type=&status=&q=&sort=&page=&payee=&add=`. **Code differs:** "Approved YTD" not "Paid YTD" (approved isn't paid out); the numbers count only the clerk's own vouchers (user decision) and the footer says so; "Pay via" is Cash / Bank transfer / Check (the system's 3 methods, no eFPS / payroll account); a "Deactivated · N" chip; type colours follow the Admin's type names. |
| Clerk Payees: payee side panel | `GZb92vr4M` | ✅ 2026-11-26 | `components/PayeePanel.jsx` (`?payee={id}`). API `GET /payees/{id}`. **Code differs:** **Edit** instead of "Request edit" (clerks edit directly, user decision), Deactivate / Reactivate added (confirm dialog), no AI "usual range" box (no AI yet), "Added Mon YYYY by …" instead of "Active since", account no. shown only for bank transfers. "+ New voucher for …" opens `/clerk/vouchers/new?payee={id}` filled in. |
| Clerk Help & guides: help center | `V0J_GkScn` | ✅ 2026-11-26 | `/clerk/help` (sidebar Help & guides), `features/help/pages/HelpCenterPage.jsx`; guide texts in `features/help/guides.js` (5 guides + the live approval guide, 5 FAQ; every sentence describes what exists today). Search runs in the browser over guides + FAQ. "Still need help?" = the Admin(s) of the active company (`GET /support/contacts`). **Code differs:** no "3-min product tour" (no video exists); no invented support email / ext. / reply time; the AI card is marked "Not live yet"; 6 guide cards instead of 4. |
| Clerk Help & guides: guide article | `HZsDzsZaH` | ✅ 2026-11-26 | `/clerk/help/:slug`, `pages/GuidePage.jsx`. On this page (follows the scroll), Related, Print (sidebar / top bar hidden when printing), Ask support. Rule-dependent texts read `GET /approval-rules`. **Code differs:** the AI guide opens with "Not switched on yet" (user decision) and is written in the future tense; guides about reviewing show "Not fully live yet" while `reviewing_live` is false; no "Was this guide helpful?" votes (nothing would store or read them). |
| Clerk Help & guides: Contact support | `mudjUlcnp` | ✅ 2026-11-26 | `components/ContactSupportModal.jsx` (`?contact=1`). API `POST /support/messages` (multipart, 5/min) → `Domain/Identity/Account/SendSupportMessage`: bell notice `support_request` + email (`SupportRequestMail`, to the Admin's personal email, Reply-To the sender) to the active company's Admin(s); screenshot (PNG/JPG/WebP ≤ 5 MB) attached to the email only, never stored; voucher number only (Admins have no voucher access). 409 `NO_SUPPORT_CONTACT` when the company has no Admin. **Code differs:** the subtitle names the receiving Admin(s) instead of "we'll reply within 1 business day"; success view inside the window. |
| Clerk Payees: Add payee | `UKm7GrwEZ` | ✅ 2026-11-26 | `components/PayeeFormModal.jsx` (`?add=1`; also used for Edit). API `POST /payees`, `PATCH /payees/{id}` (`updated_at` → 409 `PAYEE_CHANGED`), `GET /payees/similar` while typing. **Code differs:** the duplicate warning is a plain name / TIN comparison, not "AI" (`PayeeMatcher`); the same TIN blocks saving; **TIN is optional** (9 or 12 digits when given) because payees made from older vouchers have none; bank fields appear only when the default payment is a bank transfer. |

## 8d. Accounting Officer (Phase 4: review, step 1)

| Frame | Node id | Status | Notes |
|---|---|---|---|
| Officer dashboard (landing page) | `tfDekIe0N` | ✅ 2026-11-27 | `/officer` (user decision: this is now the landing page; the Review queue moved to `/officer/queue`), `features/dashboard/pages/OfficerDashboardPage.jsx`. API `GET /officer/dashboard` (`Domain/Approvals/Queries/OfficerDashboardSummary`). **Code differs:** "Approved in November" = YOUR Level 1 approvals; avg. review time = submission (latest `voucher_submitted` audit row) → your decision, this month vs last; budget health is this FISCAL YEAR (budgets are yearly since 2026-11-27) with "Manage →" to the Budgets page; the "✦ AI forecast" card shows real approved spending so far this month vs the same days last month (no forecasting model yet); "Flagged" instead of "AI-flagged". |
| Officer Review queue: list | `vZeEe5_Hq` | ✅ 2026-11-26 | `/officer/queue` since 2026-11-27 (was the landing page `/officer` until the dashboard came), `features/approvals/pages/ReviewQueuePage.jsx`, sidebar `components/OfficerNav.jsx` (menu look shared with the clerk: `components/layout/SidebarNav.jsx`). API `GET /officer/queue` (+ `meta.counts`, `total_amount`, `sla_hours`), `/officer/summary`, `/officer/review-options`, `POST /officer/vouchers/bulk-approve`. Tabs All / AI-flagged / High value / Near SLA / Resubmitted; search, department, amount, sort in the address. Bulk approve = select mode (AI-flagged can't be picked; all or nothing). **Code differs:** "AI check" says "Not run" (AI not switched on) instead of "✓ Normal"; Dashboard / Budgets / AI forecasts / Financial reports / Help & guides are "Soon"; no "1 alert" on Budgets; no top-bar search. |
| Officer: voucher review | `jQfdHPifl` (the user typed `jQfdHPiflm`) | ✅ 2026-11-26 | `/officer/vouchers/:id`, `pages/VoucherReviewPage.jsx`. API `GET /officer/vouchers/{id}` (review block: step-2 reasons, Supervisors, SLA, similar vouchers, budget, position), `GET …/pdf`. **Code differs:** the duplicate panel is a plain check (same payee, total within 15%, last 120 days), not AI; the AI panel only appears for flagged vouchers; budget box is read-only (user decision) and says so; checklist is a personal aid (not saved, no "Receipts attached" item); no attachment link; a "resubmitted" note shows the previous return; actions become a "No decision needed" panel when already decided or your own voucher. |
| Officer: approve confirmation | `pzSaaMGhY` | ✅ 2026-11-26 | `components/DecisionDialogs.jsx` `ApproveDialog`. API `POST /officer/vouchers/{id}/approve` → approved, or under_review when `ApprovalRoute` says step 2 (threshold / AI-flagged rule); Supervisors + clerk get bell notices. Button says "Approve" when Accounting's approval is final. |
| Officer: return to clerk | `XT9f8T3lY` | ✅ 2026-11-26 | `ReturnDialog`. API `POST …/return` (`needs_changes` 1+ tags + remarks). Clerk: bell `voucher_returned` + email. **Code differs:** no "within 5 business days" (no resubmit deadline, user decision); tags are Payee / Description / Category / Line items / Amount / Payment details (no Attachments until uploads exist). The tags now also show on the clerk's Returned to me cards and Fix & resubmit banner. |
| Officer: reject | `sozCOjfDk` | ✅ 2026-11-26 | `RejectDialog`. API `POST …/reject` (reason from `ReviewOptions::REJECT_REASONS` + remarks, both required). Clerk: bell + email. |
| Officer: flagged vouchers (list) | `dtNDyUAUp` | ✅ 2026-11-27 | `/officer/flagged` (sidebar "Flagged"), `features/approvals/pages/FlaggedPage.jsx` + `HowFlagsWorkDialog` + `MarkNormalDialog`. API `GET /officer/flagged` (+ `meta.stats`), `POST /officer/vouchers/{id}/normal`. **Code differs:** titled "Flagged", not "AI-flagged" (the check is rule-based until the AI model, user decision); "Confirmed issues · ₱… held back" = flags returned as needs-changes or rejected; tags come from the stored signals. |
| Officer: investigate a flag | `YX1IiDXMp` | ✅ 2026-11-27 | `/officer/flagged/:id`, `pages/InvestigatePage.jsx`. API `GET /officer/vouchers/{id}/investigation`. Finding: Valid but high → Approve dialog (`ai_finding: valid_high`), Needs changes → Return dialog (`needs_changes`), False alarm → flag cleared. **Code differs:** "Summary" written from the numbers (user decision; no ✦, no OpenAI yet); the "This" bar is this voucher's total; budget % is this month's; the signals table has 5 rows (amount, duplicate, category, budget, payee) when they apply. |
| Officer: queue cleared | `Ssn7fclsz` | ✅ 2026-11-26 | Empty state on `/officer/queue` with today's approved / returned / rejected; header button "Back to dashboard" (since 2026-11-27, when the dashboard was built) + "See what you reviewed". **Code differs:** no "Check budgets" (no Budgets page). "Reviewed by me" is a code-first page: `/officer/reviewed`, `GET /officer/reviews`. |
| Officer: Budgets overview | `AwnFnuBYJ` | ✅ 2026-11-27 | `/officer/budgets` (`PATHS.OFFICER_BUDGETS`, sidebar "Budgets" with "N alert(s)"), `features/budgets/pages/BudgetsPage.jsx`. API `GET /officer/budgets?year=` (`Domain/Budgets/Queries/BudgetBoard::overview`). User decisions: budgets are **yearly** (one per department per fiscal year; migration `2026_11_27_000002`, testing DB only). FY select, + Allocate budget (`?allocate=1`), 4 cards, table with usage bars; ✎ opens Edit (`?edit={departmentId}`). **Code differs:** departments without a budget are listed with "Allocate"; a row shows "Change waiting for sign-off"; "Pending vouchers" = vouchers still in review; amounts in the cards are compact (₱12.00M) with the exact amount on hover. |
| Officer: department budget | `kpJmhDxKE` | ✅ 2026-11-27 | `/officer/budgets/:departmentId?year=`, `pages/DepartmentBudgetPage.jsx`. API `GET /officer/budgets/departments/{id}` (`BudgetBoard::department`). Allocated / Used / Pending in queue / Remaining, usage bar with pending on top, "Over the 90% alert since …" (`alert_sent_at`), monthly spend (approved per month of the FY), by category. **Code differs:** the "✦ AI forecast" box is a **Change history** list (no forecasting model yet); an amber box shows a change waiting for Supervisor sign-off (Cancel for the officer who asked); no budget yet → empty state with Allocate. |
| Officer: edit allocation | `MGf9CXv2s` | ✅ 2026-11-27 | `features/budgets/components/BudgetFormModal.jsx` (also "+ Allocate budget"). API `PATCH /officer/budgets/{id}` (200 applied / **202 sent for sign-off**), `POST /officer/budgets`, `DELETE /officer/budgets/requests/{id}`. User decision: a change of the amount bigger than the Global setting **`budget.change_signoff_above` (₱250,000.00)** becomes a pending `budget_change_requests` row + `budget_change` bell notice to the Supervisors (their approve screen comes with the Supervisor pages); smaller changes and alert-% changes apply at once. Optimistic concurrency: sends `was_total` / `was_alert_pct` → 409 `BUDGET_CHANGED`. **Code differs:** no "Covers AI-forecast gap" line. |
| Officer: forecasts overview | `GWmqqOmd7` | ✅ 2026-11-27 | `/officer/forecasts?months=1..3` (`PATHS.OFFICER_FORECASTS`, sidebar "Forecasts"), `features/forecasts/pages/ForecastsPage.jsx`. API `GET /officer/forecasts`, `POST /recalculate`, `GET /export` (`Domain/AI/Forecasting/ForecastBoard`). User decision: a **linear trend in Laravel** now (`LinearTrend`, `GenerateForecasts`; migration `2026_11_27_000003`, testing DB only), Phase 5's model later. **Code differs:** "Forecasts" not "AI forecasts"; accuracy only once a forecast month has ended; "Not enough history" (needs 3 months); + Recalculate; Export = CSV / Excel menu; the chart shows the last 5 months + this month (approved so far + rest of the forecast) + the chosen months. |
| Officer: department forecast | `sjtX1kKqt` | ✅ 2026-11-27 | `/officer/forecasts/:departmentId`, `pages/DepartmentForecastPage.jsx`. API `GET /officer/forecasts/departments/{id}`. Cards (next month + range, budget left + short by / room left, confidence + R²), chart, What's driving it, Recommendation. User decision: **Apply top-up / Adjust budget open the Budgets Edit allocation dialog** pre-filled (usual reason + sign-off rules). **Code differs:** no ✦; drivers are real (vouchers in review, the trend, the same month last year, payees paid then: no invented "Microsoft 365 renewal"); the recommendation's "defer" names the biggest voucher in review; no budget → "Set a budget". |
| Officer: financial reports list | `ARxG8Aa6F` | ✅ 2026-11-27 | `/officer/reports` (`PATHS.OFFICER_REPORTS`, sidebar "Financial reports"), `features/reports/pages/ReportsPage.jsx`. API `GET /officer/reports` (+ `meta.stats`, `meta.ai`). 3 cards, search / type / department, AI summary column, Schedules (read-only dialog), Generate report. **Code differs:** the AI footnote names the configured model or says AI isn't set up; "Department" type = a date range for one department; statuses also "Not set up" / "Paused · spend cap" / "Not asked for". |
| Officer: report with AI summary | `UmSNc_71u` | ✅ 2026-11-27 | `/officer/reports/:id`, `pages/ReportPage.jsx`. API `GET /officer/reports/{id}` (polled every 4 s while the summary is written), `POST /{id}/summary`, `GET /{id}/pdf` (DomPDF, `resources/views/pdf/report.blade.php`), `GET /{id}/xlsx`. User decision: **real OpenAI** (`WriteReportSummary` job, gpt-4o-mini, totals only; not set up until `OPENAI_API_KEY`). **Code differs:** "Flagged" not "AI-flagged"; flagged list / forecast only when included; summary states (writing / failed + Retry / paused / not set up). |
| Officer: generate report dialog | `ZoAX4DKjk` | ✅ 2026-11-27 | `components/GenerateReportModal.jsx` (`?generate=1`). API `GET /officer/reports/preview` (live "N approved vouchers · ₱X will be included"), `POST /officer/reports`. Type Monthly / Quarterly / Department (from–to + department), period, department, includes (AI summary, breakdown, flagged list, forecast). **Code differs:** the AI option is off and explained when OpenAI isn't set up or is paused at the cap; "Budget forecast" = the spending forecast. |
| Officer: Help & guides center | `ylRPv8gjJ` | ✅ 2026-11-27 | `/officer/help` (`PATHS.OFFICER_HELP`, sidebar "Help & guides"), `features/help/pages/OfficerHelpPage.jsx`; guides in `features/help/officerGuides.js` (**update a guide when its feature changes**). Search, 4 category cards (`?category=`), popular guides, "Review rules at a glance" (live `/approval-rules`), "Still stuck?" (`components/StillNeedHelp.jsx`, shared with the clerk). **Code differs:** no "▶ Reviewer walkthrough" (no video); "Still stuck?" names the company's Admin, no "1 business day" promise; "Flags" not "AI flags". |
| Officer: guide article | `fXCag8TBS` | ✅ 2026-11-27 | `/officer/help/:slug` = the shared `pages/GuidePage.jsx`, made role-aware (`features/help/library.js`). Print + the guide's primary action (e.g. "Open review queue"), On this page, Related. **Code differs:** no "Was this guide helpful?" votes (nothing would store them); no "Undoing a decision" guide (decisions can't be undone: the return guide says so). |
| Officer: contact support | `menNRI3in` | ✅ 2026-11-27 | The shared `ContactSupportModal` (`?contact=1`). Officers get reviewer topics (`SendSupportMessage::REVIEWER_TOPICS`: voucher review, budget allocation, forecasts / reports, access, account, other) and may name any submitted voucher of the company (queue + recent reviews, `recentVouchersForSupport`). Test in `SupportMessagesTest`. |

## 9. Design page `yEHg8D3pX` (work in progress)

| Frame | Node id | Status | Notes |
|---|---|---|---|
| Status pills sheet (incl. grey "Not set up") | `Nd7r28KNn` | 🧩 | Started: one "Operational" pill so far |
| Tablet / phone top nav, A13 Deactivate confirm, success & error message sheet | — | 🧩 | Planned, not started |

Framer updates were paused on 2026-11-20 (code first). Older frames that are out of date with the code:
`TkIHF89oH` (password block → company + personal email), `Nhw7N27tM` (one company), `lmhV2DJV1` (3 role cards),
`vnNFYExpX` (+ Add company), `moe5n7c5C` (one company), and a Set password page frame that doesn't exist yet.

---

## How to keep this file right

After each build, Claude changes the frame's status here, the build list in `docs/workflow/PHASES.md`,
and the frame table + Roadmap in `CLAUDE.md`. New frames get a row here when they're designed or first mentioned.
