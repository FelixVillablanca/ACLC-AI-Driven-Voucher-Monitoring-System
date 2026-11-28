<?php

namespace Tests\Feature\Api;

use App\Mail\UnassignedAdminRemovedMail;
use App\Models\Company;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * php artisan admins:expire-unassigned (user decisions 2026-11-28): an Admin created with "No company yet" has 24 hours.
 * 3 h before: a bell notice to every Super Admin. At 24 h: deleted if never used, otherwise deactivated; audit row by
 * System, bell notice, email to their personal email. Time is simulated with travelTo().
 *
 * Run:  php artisan test --filter=ExpireUnassignedAdminsTest
 */
class ExpireUnassignedAdminsTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        $this->travelTo(now()->startOfHour());
        $this->owner = User::factory()->superAdmin()->create();
    }

    private function unassigned(array $attributes = []): User
    {
        return User::factory()->admin()->create([
            'company_id' => null, 'personal_email' => 'rhea@gmail.com', 'first_name' => 'Rhea', 'last_name' => 'Valdez', ...$attributes,
        ]);
    }

    private function run_(): void
    {
        $this->artisan('admins:expire-unassigned')->assertSuccessful();
    }

    public function test_nothing_happens_before_21_hours_and_the_warning_comes_once_after(): void
    {
        $rhea = $this->unassigned();

        $this->travel(20)->hours();
        $this->run_();
        $this->assertDatabaseMissing('notifications', ['recipient_id' => $this->owner->id, 'title' => 'Admin account removed soon']);

        $this->travel(2)->hours(); // 22 h old
        $this->run_();
        $this->run_();
        $this->assertSame(1, DB::table('notifications')->where('recipient_id', $this->owner->id)->where('title', 'Admin account removed soon')->count());
        $this->assertNotNull($rhea->fresh());
    }

    public function test_a_never_used_account_is_deleted_after_24_hours_and_everyone_is_told(): void
    {
        $rhea = $this->unassigned(['access_status' => 'pending', 'last_login_at' => null]);

        $this->travel(24)->hours();
        $this->run_();

        $this->assertNull(User::find($rhea->id));
        $this->assertDatabaseHas('audit_logs', ['user_id' => null, 'action' => 'unassigned_admin_deleted', 'record_id' => $rhea->id]);
        $this->assertDatabaseHas('notifications', ['recipient_id' => $this->owner->id, 'title' => 'Admin account deleted']);
        Mail::assertSent(UnassignedAdminRemovedMail::class, fn ($mail) => $mail->hasTo('rhea@gmail.com') && $mail->deleted);
    }

    public function test_a_used_account_is_deactivated_so_its_history_stays(): void
    {
        $rhea = $this->unassigned(['access_status' => 'accepted', 'last_login_at' => now()]);
        // they signed in: the append-only audit log points at them
        DB::table('audit_logs')->insert(['user_id' => $rhea->id, 'action' => 'login', 'table_name' => 'users', 'record_id' => $rhea->id, 'created_at' => now(), 'updated_at' => now()]);

        $this->travel(25)->hours();
        $this->run_();

        $rhea->refresh();
        $this->assertFalse((bool) $rhea->is_active);
        $this->assertNotNull($rhea->deactivated_at);
        $this->assertDatabaseHas('audit_logs', ['action' => 'unassigned_admin_deactivated', 'record_id' => $rhea->id]);
        Mail::assertSent(UnassignedAdminRemovedMail::class, fn ($mail) => ! $mail->deleted);

        // reactivating it without a company would only remove it again: refused
        $this->actingAs($this->owner)->postJson("/api/v1/superadmin/admins/{$rhea->id}/reactivate", ['password' => 'password'])
            ->assertStatus(409)->assertJsonPath('code', 'ACTION_NOT_ALLOWED');
    }

    public function test_admins_given_a_company_in_time_are_left_alone(): void
    {
        $rhea = $this->unassigned();
        $apex = Company::factory()->create();

        $this->travel(10)->hours();
        $this->actingAs($this->owner)
            ->postJson('/api/v1/superadmin/companies', ['name' => 'Apex Two', 'type' => 'corporate', 'admin_id' => $rhea->id])
            ->assertCreated();
        $withCompany = User::factory()->admin()->create(['company_id' => $apex->id]);

        $this->travel(30)->hours();
        $this->run_();

        $this->assertTrue((bool) $rhea->fresh()->is_active);
        $this->assertTrue((bool) $withCompany->fresh()->is_active);
        Mail::assertNotSent(UnassignedAdminRemovedMail::class);
    }

    public function test_the_deadline_is_shown_to_the_super_admin_and_the_admin(): void
    {
        $rhea = $this->unassigned();
        $deadline = $rhea->created_at->copy()->addHours(24)->toIso8601String();

        $this->actingAs($this->owner)->getJson('/api/v1/superadmin/companies/unassigned-admins')
            ->assertJsonPath('data.0.removed_at', $deadline);
        $this->actingAs($this->owner)->getJson('/api/v1/superadmin/admins')
            ->assertJsonFragment(['company_deadline' => $deadline]);
        $this->actingAs($rhea)->getJson('/api/v1/auth/me')->assertJsonPath('data.company_deadline', $deadline);
    }
}
