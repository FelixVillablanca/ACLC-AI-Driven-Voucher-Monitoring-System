<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Proves the schema baseline (database/schema/mysql-schema.sql) can rebuild
 * the real database structure from nothing.
 */
class DatabaseBaselineTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_runs_on_the_testing_database(): void
    {
        $this->assertStringEndsWith('_testing', DB::connection()->getDatabaseName());
    }

    public function test_all_core_tables_exist(): void
    {
        foreach ([
            'companies', 'departments', 'users', 'user_company_access',
            'voucher_categories', 'voucher_types', 'payee_types', 'vouchers',
            'voucher_line_items', 'voucher_approvals', 'voucher_attachments',
            'budget_allocations', 'notifications', 'ai_forecasts',
            'financial_reports', 'audit_logs',
        ] as $table) {
            $this->assertTrue(Schema::hasTable($table), "Missing table: {$table}");
        }
    }

    public function test_users_table_matches_the_live_database(): void
    {
        $this->assertTrue(Schema::hasColumns('users', ['employee_id', 'first_name', 'last_name', 'role', 'company_id']));
        $this->assertFalse(Schema::hasColumn('users', 'name'), 'users.name was dropped and must not come back');
    }
}
