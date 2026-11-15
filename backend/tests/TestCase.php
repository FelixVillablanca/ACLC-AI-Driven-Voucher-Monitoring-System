<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use RuntimeException;

abstract class TestCase extends BaseTestCase
{
    /**
     * Safety guard: tests wipe and refill the database (RefreshDatabase), so they
     * must NEVER run against the real one. This runs before any test trait, so
     * the check happens before anything is wiped. If the database name doesn't
     * end in "_testing" (e.g. because `php artisan config:cache` froze the real
     * DB settings), it stops immediately.
     */
    protected function setUpTraits()
    {
        $database = config('database.connections.'.config('database.default').'.database');

        if (! str_ends_with((string) $database, '_testing')) {
            throw new RuntimeException(
                "Refusing to run tests on database [{$database}]. Tests must use a *_testing database. ".
                'Run `php artisan config:clear` and check phpunit.xml.'
            );
        }

        return parent::setUpTraits();
    }
}
