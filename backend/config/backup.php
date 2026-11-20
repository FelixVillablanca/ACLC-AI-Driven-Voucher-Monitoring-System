<?php

/*
| Database backups (Framer TKziMjHUe "Run a database backup now?").
| A backup = mysqldump of the whole database, gzip-compressed, saved under
| storage/app/private/backups (never reachable from the web).
| Phase 8 moves the files to Cloudflare R2 and encrypts them.
*/

return [

    // The mysqldump program. "mysqldump" works when C:\xampp\mysql\bin is on PATH;
    // otherwise give the full path, e.g. C:\xampp\mysql\bin\mysqldump.exe
    'mysqldump' => env('BACKUP_MYSQLDUMP_BINARY', 'mysqldump'),

    // Folder inside storage/app/private
    'directory' => 'backups',

    // Where the dialog says the file goes ("This server · not encrypted yet")
    'destination' => env('BACKUP_DESTINATION', 'local'),

    // Nightly backup time (24 h clock, APP_TIMEZONE)
    'nightly_at' => env('BACKUP_NIGHTLY_AT', '02:00'),

    // How many GOOD backups to keep; older files are deleted after each new good one
    'keep' => (int) env('BACKUP_KEEP', 7),

    // A backup still "queued" or "running" after this long is treated as dead (worker stopped / crashed)
    'stale_after_minutes' => 120,

    // Longest a single mysqldump may run
    'timeout_seconds' => 1800,
];
