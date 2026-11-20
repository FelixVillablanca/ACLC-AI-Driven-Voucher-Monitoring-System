# Workflow notes

Things the project owner asked to keep a note of: how parts of the system work, and how to use them.
Newest topics are added at the bottom. Each topic has the date it was written.

## Contents

1. [Database backups](#1-database-backups) (2026-11-21)

---

## 1. Database backups

_Written 2026-11-21. Screen: "Run a database backup now?" (Framer `TKziMjHUe`), opened from the Super Admin
Overview → "Needs your attention" → **Run backup**._

### What a backup is

A **backup** is a complete copy of the database saved as a file. If the database gets damaged, deleted or
broken by a bad change, that copy can be loaded back to get the data as it was at that moment.
It's like photocopying a whole filing cabinet every night and keeping the copies in a drawer.

### The journey of one backup

```
You click "Run backup now"
        │
        ▼
1. The API writes a "ticket" (a row in the backups table, status = queued)
   and answers right away. Your browser doesn't wait.
        │
        ▼
2. The ticket goes into the job queue (a to-do list in the jobs table)
        │
        ▼
3. The queue worker (php artisan queue:work) picks it up → status = running
        │
        ▼
4. mysqldump writes every table and row into a temporary .sql file
        │
        ▼
5. That file is compressed (gzip) into  advms-2026-11-21-020000-17.sql.gz
   and the temporary file is deleted
        │
        ▼
6. The ticket is updated → status = succeeded (with size and time taken)
   Old backups beyond the newest 7 are deleted
        │
        ▼
7. If "Notify me when it finishes" was ticked, the bell shows "Backup finished"
```

Meanwhile, the dialog asks the server "is it done yet?" every 3 seconds. Repeatedly checking like this is
called **polling**, and it's how the window can show "Backing up…" and then "Backup finished".

### The pieces, in plain words

| Piece | Everyday comparison | What it does |
|---|---|---|
| `backups` table | A logbook | One line per backup: when it ran, who started it, whether it worked, how big it was |
| **Queue** (the `jobs` table) | An order slip in a kitchen | Slow work waits here, so the website stays fast |
| **Queue worker** | The cook who takes the slips | A program that keeps running and does the queued jobs. `dev.ps1` starts it (the `[queue]` lines) |
| **mysqldump** | The photocopier | A MariaDB tool that writes the whole database as SQL text, the same kind of file you import in phpMyAdmin |
| **gzip** | Vacuum-packing | Shrinks the file a lot (the testing database went from 1.7 MB to 10 KB) |
| **Scheduler** | An alarm clock | Every night at 02:00 it runs `php artisan backup:run`, which queues a backup like the button does |

### Safety rules built in

- **People can keep working while it runs.** mysqldump takes a snapshot of the data as it was at the start
  (`--single-transaction`). It doesn't lock the tables.
- **Only one backup at a time.** A second click while one is running gets "already running". A backup stuck
  for more than 2 hours (for example, the worker was closed) is marked failed, so it can't block future backups.
- **The database password stays hidden.** It's handed to mysqldump in a private environment variable
  (`MYSQL_PWD`), never on the command line, where other programs could read it.
- **Files are kept away from the web and from git.** They live in `backend/storage/app/private/backups`.
  A backup holds every password hash and personal email, so it must never be downloadable or committed.
- **The newest 7 good backups are kept.** Older files are deleted to save disk space. Their logbook rows stay,
  so the history isn't lost.
- **Failures are never silent.** A failed nightly backup alerts every Super Admin, and the failed row records the reason.

### Two limits to know about

1. **The backups are on the same computer as the database.** If that disk dies, the backups go with it.
   Phase 8 fixes this by sending each file to Cloudflare R2 (cloud storage) and encrypting it. That's why the
   dialog says "This server · not encrypted yet".
2. **There's no "Restore" button yet.** Restoring replaces the live data, so it needs its own screen and
   confirmation. Until then, restore by hand:
   1. Unzip the `.sql.gz` file (7-Zip can do it) to get a `.sql` file.
   2. Import it in phpMyAdmin (**Import** tab), or with:
      ```powershell
      mysql -u root AI_Driven_Voucher_Monitoring_System_Database < advms-2026-11-21-020000-17.sql
      ```
   Practise this on the **testing** database first, never straight on the real one.

### How to run it

| Do this | How |
|---|---|
| Start everything (incl. the queue worker and scheduler) | `.\dev.ps1` (or `.\dev.ps1 -Testing`) in the project root |
| Back up from the screen | Super Admin → Overview → Needs your attention → **Run backup** |
| Back up from the terminal | `php artisan backup:run` (in `backend`); the queue worker then makes it |
| See the nightly schedule | `php artisan schedule:list` (in `backend`) |

- The VS Code tasks "Dev: start both…" do **not** start the scheduler or the queue worker, so backups only
  run when everything is started with `dev.ps1`.
- After editing a queued job (like the backup job in `app/Jobs`), restart `dev.ps1`: the queue worker keeps
  the code it started with.

### Where to look

| What | Where |
|---|---|
| Settings (nightly time, how many to keep, where mysqldump is) | `backend/config/backup.php`; change them in `.env` with `BACKUP_NIGHTLY_AT`, `BACKUP_KEEP`, `BACKUP_MYSQLDUMP_BINARY` |
| The backup files | `backend/storage/app/private/backups` |
| The history | the `backups` table |
| Live progress while `dev.ps1` runs | the `[queue]` lines: `RunDatabaseBackup … RUNNING`, then `DONE` |
| The code | `app/Domain/Platform/Backups/` (StartBackup, DumpDatabase), `app/Jobs/RunDatabaseBackup.php`, frontend `features/superadmin/backups/` |

**Habit to keep:** practise restoring a backup into the testing database from time to time.
Engineers say "a backup you've never restored isn't a backup yet."
