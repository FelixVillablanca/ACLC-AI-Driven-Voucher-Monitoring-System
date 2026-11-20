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
| Super Admin: landing + its click-flows | 12 | 7 | 0 | 4 |
| Super Admin: Admins tab | 14 | 12 | 1 | 0 |
| Super Admin: Companies tab | 9 | 0 | 0 | 9 |
| Super Admin: Global settings tab | 12 | 0 | 0 | 12 |
| Super Admin: Audit logs tab | 9 | 0 | 0 | 9 |
| Super Admin: System health tab | 11 | 0 | 2 | 9 |
| Phases 3–6 (vouchers, approvals, AI, reports) | 0 | — | — | — |

Phases 3–6 have **no frames designed yet**. Since 2026-11-20 screens can also be built code-first from a
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
| — | **Companies tab page** (summary cards, views, 2×2 company cards) | `vnNFYExpX` | ⬜ | Since 2026-11-20 the Super Admin creates companies: needs "+ Add company" (not in the frame) |
| — | Base copy for the click-flow set | `CGGx439Db` | — | |
| C1 | Export list dialog | `UpMMFLXSI` | ⬜ | |
| C2 | Search results ("north", 1 result) | `FXRghzjCE` | ⬜ | |
| C3 | Sort menu | `oqxhehYHx` | ⬜ | |
| C4 | List view (table instead of cards) | `jlXT7qlCt` | ⬜ | |
| C5 | Suspended filter | `Dr5av5JaU` | ⬜ | |
| C6 | Suspend confirm (reason, notify admin, type the name) | `eGUijf8Wd` | ⬜ | |
| C7 | Reactivate confirm | `B3zqVOXN4` | ⬜ | |
| C8 | Open company side panel (Overview / Departments / Users / History) | `a17W5hpkA` | ⬜ | Same idea as 08 `FC7jMBFYg` |

## 6. Super Admin: Global settings tab (Phase 2)

| Code | Frame | Node id | Status | Notes |
|---|---|---|---|---|
| — | **Global settings page** (Approval rules section) | `tsrXCiWWw` | ⬜ | Platform defaults already exist in the database |
| G1 | Change history side panel | `OtA4G9A9F` | ⬜ | |
| G2 | Discard changes confirm | `dLJvMyCj2` | ⬜ | |
| G3 | Save changes review modal (reason + password) | `xICKww9ng` | ⬜ | |
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
| AL1 | Export CSV dialog **on top of the Audit logs page** | `EJ0asP2ZH` | ⬜ | ⚠️ Checked 2026-11-21: this frame is now AL1, so there's **no clean page-only frame**. Build the page from this frame with the dialog hidden |
| AL2 | Search an IP (3 events, Block this IP) | `F1sqrL47f` | ⬜ | |
| AL3 | Company filter dropdown | `YVcTExXXk` | ⬜ | |
| AL4 | Action filter (5 groups with counts) | `W47j24JwQ` | ⬜ | |
| AL5 | Date range panel (presets + calendar) | `WSbuSUy5K` | ⬜ | |
| AL6 | Sensitive only | `BcPDn1MbQ` | ⬜ | |
| AL7 | Event details side panel (before → after, tamper check) | `cY8zDqTvU` | ⬜ | |
| AL8 | Block IP confirm | `jx8DjvvgZ` | ⬜ | Needs IP blocking (not built) |
| AL9 | No results empty state | `F1CVD5vpw` | ⬜ | |

The audit data already exists: sign-ins, failed sign-ins, admin/account actions, backups and job actions are all recorded.

## 8. Super Admin: System health tab (Phase 2)

| Code | Frame | Node id | Status | Notes |
|---|---|---|---|---|
| — | **System health page** (6 service cards, jobs table, uptime, blocked addresses, incidents) | `m80KDanOj` | ⬜ | The health checks behind it partly exist (Services panel) |
| — | Spare copy (unused) | `oNDavkrey` | — | Ignore |
| SH1 | Check now running | `J3we7ru59` | ⬜ | |
| SH2 | Run backup confirm | `HPceTpaUq` | 🟡 | Backups work; this is the System health version of the dialog |
| SH3 | Backup running (45% bar) | `NZZ80sadt` | ⬜ | The backup dialog shows a moving bar, no percentage |
| SH4 | Background jobs details side panel | `y5H_QPGwO` | ⬜ | |
| SH5 | Job details side panel (one failed job) | `pZGUgQsG5` | ⬜ | |
| SH6 | Retry failed confirm | `vmsWCAimJ` | 🟡 | Retrying works (`fzdOvPqCX`); this is the System health version |
| SH7 | Uptime day details | `yW7sjQycG` | ⬜ | Needs uptime tracking (not built) |
| SH8 | Block an address | `TMl_TrDqz` | ⬜ | Needs IP blocking (not built) |
| SH9 | Unblock confirm | `BUnDf0lzZ` | ⬜ | Needs IP blocking |
| SH10 | Incident details side panel | `d3u7JybYW` | ⬜ | Needs incident tracking (not built) |

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
