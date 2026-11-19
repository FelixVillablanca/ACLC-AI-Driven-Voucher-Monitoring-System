<?php

namespace Tests\Feature\Console;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Testing\PendingCommand;
use Tests\TestCase;

/**
 * php artisan superadmin:create (spec §4.2: the only way to make a Super Admin).
 *
 * Run:  php artisan test --filter=CreateSuperAdminCommandTest
 */
class CreateSuperAdminCommandTest extends TestCase
{
    use RefreshDatabase;

    private function createCommand(array $options = []): PendingCommand
    {
        return $this->artisan('superadmin:create', array_merge([
            '--first-name' => 'Felix',
            '--last-name' => 'Bianito',
            '--username' => 'FelixBianito',
            '--password' => 'correcthorse42battery',
        ], $options));
    }

    public function test_it_creates_a_super_admin_with_the_server_built_email(): void
    {
        $existing = User::factory()->superAdmin()->create();

        $this->createCommand()->assertSuccessful();

        $user = User::where('email', 'felixbianito@Superadmin.com')->firstOrFail();
        $this->assertSame('super_admin', $user->role);
        $this->assertNull($user->company_id);
        $this->assertTrue($user->is_active);
        $this->assertNull($user->last_login_at);
        $this->assertTrue(Hash::check('correcthorse42battery', $user->password));

        // Audit row: done by the system console, platform-level
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => null, 'company_id' => null, 'action' => 'created', 'table_name' => 'users', 'record_id' => $user->id,
        ]);
        // The other Super Admin is told
        $this->assertSame(1, Notification::where('recipient_id', $existing->id)->where('type', 'security_alert')->count());
    }

    public function test_it_can_generate_the_password(): void
    {
        $this->createCommand(['--password' => null, '--generate-password' => true])
            ->expectsOutputToContain('Password (shown only once')
            ->assertSuccessful();

        $this->assertDatabaseHas('users', ['email' => 'felixbianito@Superadmin.com']);
    }

    public function test_it_refuses_a_fourth_active_super_admin(): void
    {
        User::factory()->superAdmin()->count(3)->create();

        $this->createCommand()->expectsOutputToContain('All 3 Super Admin seats are taken')->assertFailed();

        $this->assertSame(3, User::where('role', 'super_admin')->count());
        $this->assertSame(0, DB::table('audit_logs')->count());
    }

    public function test_it_rejects_a_weak_password_or_bad_email_name(): void
    {
        $this->createCommand(['--password' => 'short1'])->expectsOutputToContain('at least 12 characters')->assertFailed();
        $this->createCommand(['--username' => 'felix@evil.com'])->assertFailed();

        $this->assertSame(0, User::count());
    }

    public function test_it_refuses_a_duplicate_email(): void
    {
        User::factory()->superAdmin()->create(['email' => 'felixbianito@Superadmin.com']);

        $this->createCommand()->expectsOutputToContain('already exists')->assertFailed();
    }
}
