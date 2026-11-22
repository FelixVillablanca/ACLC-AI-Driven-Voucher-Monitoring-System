# Sample Data Guide: seeders, the testing database, and going back to the real one

> Written 2026-11-15. Every command here was tried on this project and works.
> Run all `php artisan ...` commands **inside the `backend` folder**.

---

## 1. The big picture: two databases

Think of it as two notebooks:

| Notebook | Database name | What it's for |
| --- | --- | --- |
| **Practice notebook** | `ai_driven_voucher_monitoring_system_testing` | Fake sample data. Safe to scribble in, erase and refill. |
| **Real ledger** | `AI_Driven_Voucher_Monitoring_System_Database` | Real data only. Empty right now (no users yet). |

Which notebook the backend opens is decided by a settings file:

- `backend/.env` points to the **real** database (the normal default).
- `backend/.env.testing` points to the **testing** database.

Laravel reads `.env.testing` instead of `.env` when the setting `APP_ENV` is `testing`.
That one setting is the whole "switch". Nothing else changes, and no file needs editing.

> **Key words**
> - **Seeder**: a PHP file that fills the database with starting data, like a recipe that adds rows for you.
> - **Factory**: a recipe for making *random* fake rows, used mostly by automated tests.
> - **Environment (`APP_ENV`)**: a label telling Laravel which settings file to use (`local`, `testing`, `production`).

---

## 2. Fill the testing database with sample data

```bash
php artisan db:seed --env=testing
```

This runs `database/seeders/DatabaseSeeder.php`, which calls two seeders in order:

1. **`DemoDataSeeder`** creates:
   - 2 companies: *Apex Holdings Inc.* and *Northfield Academy*
   - **No departments.** The admin creates those (the invented sample departments were removed on 2026-11-16)
   - Employee IDs are generated automatically: `EMP-2026-0001`, `EMP-2026-0002`, …
   - 4 demo logins, plus company access for the 3 operational users
2. **`SampleUsersSeeder`**: **your own extra users** (see section 3).

The demo logins all use the password `password`:

| Email | Role |
| --- | --- |
| `admin@advms.test` | admin |
| `clerk@advms.test` | accounting_clerk |
| `officer@advms.test` | accounting_officer |
| `supervisor@advms.test` | supervisor_manager |

And `SampleUsersSeeder` adds one user per role, following the email-domain convention in CLAUDE.md (password `password`):

| Email | Role | Goes to |
| --- | --- | --- |
| `johndoe@Administrator.com` | admin | `/admin` |
| `marialopez@Clerk.com` | accounting_clerk | `/clerk` |
| `joseramos@Officer.com` | accounting_officer | `/officer` |
| `anamendoza@Supervisor.com` | supervisor_manager | `/supervisor` |

> The domain is a **naming convention only**. Where a user goes and what they may do is decided by their `role` column, never by the email text (see CLAUDE.md, "Domain emails").

There are no sample notifications or audit entries (removed 2026-11-22). They appear when you really do something: create a user, add a department, sign in, and so on.

**Safe to run again and again.** The seeders use `firstOrCreate` ("find it, or create it if it's missing"), so a second run never makes duplicates. They only add rows and never delete anything.

To run just one seeder:

```bash
php artisan db:seed --class=SampleUsersSeeder --env=testing
```

---

## 3. Add your own users (the easy way)

Open **`backend/database/seeders/SampleUsersSeeder.php`**. At the top is a list called `$users`. Copy a block, change the values, save, then run the seeder:

```php
[
    'email' => 'juandelacruz@officer.com',
    'password' => 'password',              // scrambled (hashed) automatically
    'first_name' => 'Juan',
    'last_name' => 'Dela Cruz',
    'role' => 'accounting_officer',        // admin | accounting_clerk | accounting_officer | supervisor_manager
                                           // (no employee_id: it's assigned automatically, EMP-2026-…)
    'company' => 'Northfield Academy',     // the home company (must already exist)
    'department' => null,                  // a department CODE in that company, or null (none exist yet)
    'access' => ['Northfield Academy', 'Apex Holdings Inc.'], // companies they can switch between
],
```

```bash
php artisan db:seed --class=SampleUsersSeeder --env=testing
```

Each user it adds is listed in the terminal as `ready`. If a company name or department code is mistyped, it stops with a clear message, and the transaction means nothing is saved. A **transaction** is "all or nothing".

### Other ways (and why the seeder is better)

| Way | Good | Watch out |
| --- | --- | --- |
| **SampleUsersSeeder** (recommended) | Saved in a file, so you can refill the data any time with one command. | Nothing. |
| Edit `DemoDataSeeder.php` | Same as above. | Keep the 4 demo logins; other docs rely on them. |
| phpMyAdmin (typing rows by hand) | Visual. | The `password` column needs a **hash**, not plain text. Make one with `php artisan tinker --execute="echo bcrypt('password');"` and paste it in. Rows you type there are lost when the testing DB is wiped (section 5). |

As more modules are built (vouchers, budgets, and so on), we'll add more sample-data seeders the same way.

---

## 4. Run the system on the testing database

You need **two terminals** (in VS Code, the `+` button in the terminal panel).

**Terminal 1: backend, using the testing database**

PowerShell (the VS Code default on Windows):
```powershell
cd backend
$env:APP_ENV = "testing"; php artisan serve
```

Git Bash:
```bash
cd backend
APP_ENV=testing php artisan serve
```

**Terminal 2: frontend (same as always)**
```bash
cd frontend
npm run dev
```

Open http://localhost:5173 and log in with a demo account, for example `clerk@advms.test` / `password`.

> **Why not `php artisan serve --env=testing`?** We tried it, and it does **not** work.
> `serve` starts a second, hidden PHP process for the website. That process receives the `APP_ENV` *environment variable*, but not the `--env` *option*. So it would quietly open the **real** database. Always set `APP_ENV` as shown above.
> (`--env=testing` is fine for one-off commands like `db:seed`. Only `serve` needs the variable.)

### How to check which database the backend is using

```bash
php artisan tinker --execute="echo DB::connection()->getDatabaseName();"
```

Run it in the same terminal, with the same `APP_ENV`, as your server.

---

## 5. Warning: running the tests empties the testing database

`php artisan test` starts by **wiping and rebuilding** the testing database, so each test starts from a clean, known state. This was verified: 5 users before, **0 after** the tests.

So after every `php artisan test`, refill it:

```bash
php artisan db:seed --env=testing
```

Your users come back because they're saved in `SampleUsersSeeder.php`. Rows typed by hand in phpMyAdmin do **not** come back.

> **Possible later upgrade:** a third database just for demos (for example `..._dev`) that the tests never touch, so the sample data survives test runs. Creating a database is a setup change, so it needs your OK first. Just ask.

---

## 6. Going back to the real database

The switch is the `APP_ENV` setting, so going back means starting the server **without** it.

**Option A, simplest:** close that terminal (the trash-can icon), open a new one, and run:
```bash
cd backend
php artisan serve
```

**Option B, keep the same terminal:** stop the server (`Ctrl + C`), clear the setting, start again:
```powershell
Remove-Item Env:APP_ENV        # PowerShell
php artisan serve
```
```bash
unset APP_ENV                  # Git Bash
php artisan serve
```

Then confirm it with the check in section 4. It should print `AI_Driven_Voucher_Monitoring_System_Database`.

Nothing in your files changes when you switch. `.env` always points at the real database, and the testing database keeps its sample data until the next test run.

---

## 7. When development is done: starting the real database properly

The real database is **empty**: no companies and no users. In the finished system, data gets in like this:

1. **One first admin account** is created. Everything else is created by that admin through the Admin screens (Phase 2): companies, departments, users and company access.
2. Real users then log in and create real vouchers.

How to create that first admin will be decided when we reach it. Most likely it'll be a small command such as `php artisan app:create-admin` that asks for an email and password, so no password is ever written in a file.

**Do NOT run the demo seeders on the real database.**

- Every demo account uses the password `password`. In a real system that's an open door.
- `DemoDataSeeder` and `SampleUsersSeeder` refuse to run when `APP_ENV=production` as a safety net. On your local real database they *would* run, so just don't.

**On the live server (Phase 8)** there's a separate `.env` file with its own database and passwords. Nothing from your laptop's testing database goes there.

---

## 8. Cheat sheet

| I want to… | Command (in `backend`) |
| --- | --- |
| Fill or refill sample data | `php artisan db:seed --env=testing` |
| Add only my own users | edit `SampleUsersSeeder.php`, then `php artisan db:seed --class=SampleUsersSeeder --env=testing` |
| Run the app on sample data (PowerShell) | `$env:APP_ENV = "testing"; php artisan serve` |
| Run the app on sample data (Git Bash) | `APP_ENV=testing php artisan serve` |
| Go back to the real database | new terminal, then `php artisan serve` (or `Remove-Item Env:APP_ENV` first) |
| Check which database is in use | `php artisan tinker --execute="echo DB::connection()->getDatabaseName();"` |
| Run the automated tests | `php artisan test`, **then reseed** |

## 9. Troubleshooting

| Problem | Likely cause | Fix |
| --- | --- | --- |
| "These credentials do not match our records" with a demo account | Server is on the **real** DB, or the tests just wiped the testing DB | Check the DB (section 4), restart with `APP_ENV=testing`, reseed |
| `Company [...] not found` when seeding | Typo in `SampleUsersSeeder`, or `DemoDataSeeder` hasn't run | Fix the name, or run `php artisan db:seed --env=testing` (runs both, in order) |
| `Department [...] not found` | That department code doesn't exist in that company | Use `null`, or create the department first |
| The switch seems ignored | Settings were frozen by `config:cache` | `php artisan config:clear`. Never run `config:cache` locally |
| `Can't reach the server` on the login page | The backend isn't running | Start Terminal 1 (section 4) |
