<?php

namespace Tests\Feature\Api;

use App\Domain\Platform\SystemSettings;
use App\Models\Company;
use App\Models\User;
use Database\Seeders\SystemSettingsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * Super Admin Global settings tab (Framer tsrXCiWWw) + G1 Change history + G3 Save changes.
 *
 * Run:  php artisan test --filter=GlobalSettingsTest
 */
class GlobalSettingsTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/api/v1/superadmin/settings';

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        $this->seed(SystemSettingsSeeder::class);
        $this->owner = User::factory()->superAdmin()->create(['first_name' => 'Felix', 'last_name' => 'V']);
    }

    private function save(array $changes, array $extra = [], ?User $user = null)
    {
        return $this->actingAs($user ?? $this->owner)->putJson(self::URL, [
            'changes' => $changes,
            'reason' => 'Q4 approval policy update',
            'notify_admins' => false,
            'password' => 'password',
            ...$extra,
        ]);
    }

    public function test_shows_every_setting_with_defaults_and_context(): void
    {
        Company::factory()->count(2)->create();

        $res = $this->actingAs($this->owner)->getJson(self::URL)
            ->assertOk()
            ->assertJsonPath('data.context.companies', 2)
            ->assertJsonPath('data.context.openai_spent_this_month_usd', '0.0000'); // tracked since report summaries (2026-11-27)

        // the keys contain dots, so read them from the decoded array
        $values = $res->json('data')['values'];
        $this->assertSame('50000.00', $values[SystemSettings::HIGH_VALUE_THRESHOLD]);
        $this->assertTrue($values[SystemSettings::AI_FLAGGED_NEEDS_STEP_2]);
        $this->assertSame(70, $values[SystemSettings::CATEGORY_MIN_CONFIDENCE]);
        $this->assertCount(count(SystemSettings::DEFAULTS), $values);
    }

    public function test_save_writes_values_audit_rows_and_history(): void
    {
        $this->save([
            ['key' => SystemSettings::HIGH_VALUE_THRESHOLD, 'value' => '75000', 'was' => '50000.00'],
            ['key' => SystemSettings::ANOMALY_SENSITIVITY, 'value' => 'strict', 'was' => 'balanced'],
        ])->assertOk()->assertJsonPath('meta.changed', [SystemSettings::HIGH_VALUE_THRESHOLD, SystemSettings::ANOMALY_SENSITIVITY]);

        $this->assertSame('"75000.00"', DB::table('system_settings')->where('key', SystemSettings::HIGH_VALUE_THRESHOLD)->value('value'));
        $this->assertSame(2, DB::table('audit_logs')->where('action', 'setting_changed')->count());

        $res = $this->actingAs($this->owner)->getJson(self::URL.'/history')->assertOk()
            ->assertJsonPath('meta.counts.all', 3) // 2 changes + "Platform defaults applied"
            ->assertJsonPath('meta.counts.approval', 1)
            ->assertJsonPath('data.2.action', 'defaults_applied')
            ->assertJsonPath('data.2.by', null);
        $threshold = collect($res->json('data'))->firstWhere('key', SystemSettings::HIGH_VALUE_THRESHOLD);
        $this->assertSame('50000.00', $threshold['old']);
        $this->assertSame('75000.00', $threshold['new']);
        $this->assertSame('Q4 approval policy update', $threshold['reason']);
        $this->assertTrue($threshold['can_restore']);

        $this->actingAs($this->owner)->getJson(self::URL.'/history?group=ai')->assertOk()
            ->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.new', 'strict');
    }

    public function test_notify_admins_sends_a_bell_notice_to_each_active_admin(): void
    {
        $admin = User::factory()->admin()->create(['company_id' => Company::factory()->create()->id]);

        $this->save([['key' => SystemSettings::OPENAI_PAUSE_AT_CAP, 'value' => false, 'was' => true]], ['notify_admins' => true])
            ->assertOk()->assertJsonPath('meta.admins_notified', 1);

        $this->assertDatabaseHas('notifications', ['recipient_id' => $admin->id, 'type' => 'system_alert']);
    }

    public function test_turning_on_two_step_for_admins_requires_it_for_each_admin(): void
    {
        $admin = User::factory()->admin()->create(['company_id' => Company::factory()->create()->id, 'personal_email' => 'a@gmail.com']);

        $this->save([['key' => SystemSettings::REQUIRE_TWO_FACTOR_FOR_ADMINS, 'value' => true, 'was' => false]])
            ->assertOk()->assertJsonPath('meta.two_factor_required', 1);

        $this->assertNotNull($admin->fresh()->two_factor_required_at);
    }

    public function test_failed_sign_in_limit_follows_the_setting(): void
    {
        $this->save([['key' => SystemSettings::FAILED_SIGN_IN_ALERT_AFTER, 'value' => 3, 'was' => 5]])->assertOk();

        $target = User::factory()->admin()->create(['company_id' => Company::factory()->create()->id]);
        foreach (range(1, 3) as $i) {
            $this->postJson('/api/v1/auth/login', ['email' => $target->email, 'password' => 'wrong-'.$i]);
        }

        $this->assertDatabaseHas('security_alerts', ['type' => 'failed_sign_ins', 'severity' => 'high']);
    }

    public function test_bad_values_wrong_password_and_missing_reason_are_422(): void
    {
        $this->save([['key' => SystemSettings::HIGH_VALUE_THRESHOLD, 'value' => '-5', 'was' => '50000.00']])
            ->assertStatus(422)->assertJsonValidationErrors('changes.0.value');
        $this->save([['key' => SystemSettings::ANOMALY_SENSITIVITY, 'value' => 'paranoid', 'was' => 'balanced']])
            ->assertStatus(422)->assertJsonValidationErrors('changes.0.value');
        $this->save([['key' => 'app.debug', 'value' => true, 'was' => false]])
            ->assertStatus(422)->assertJsonValidationErrors('changes.0.key');
        $this->save([['key' => SystemSettings::ANOMALY_SENSITIVITY, 'value' => 'strict', 'was' => 'balanced']], ['password' => 'nope'])
            ->assertStatus(422)->assertJsonValidationErrors('password');
        $this->save([['key' => SystemSettings::ANOMALY_SENSITIVITY, 'value' => 'strict', 'was' => 'balanced']], ['reason' => ''])
            ->assertStatus(422)->assertJsonValidationErrors('reason');

        $this->assertSame(0, DB::table('audit_logs')->where('action', 'setting_changed')->count());
    }

    public function test_someone_else_saving_first_is_409_and_nothing_is_saved(): void
    {
        DB::table('system_settings')->where('key', SystemSettings::HIGH_VALUE_THRESHOLD)->update(['value' => json_encode('60000.00')]);

        $this->save([
            ['key' => SystemSettings::ANOMALY_SENSITIVITY, 'value' => 'strict', 'was' => 'balanced'],
            ['key' => SystemSettings::HIGH_VALUE_THRESHOLD, 'value' => '75000.00', 'was' => '50000.00'], // stale
        ])->assertStatus(409)->assertJsonPath('code', 'SETTINGS_CHANGED');

        $this->assertSame('"balanced"', DB::table('system_settings')->where('key', SystemSettings::ANOMALY_SENSITIVITY)->value('value'));
    }

    public function test_saving_the_same_value_is_409(): void
    {
        $this->save([['key' => SystemSettings::ANOMALY_SENSITIVITY, 'value' => 'balanced', 'was' => 'balanced']])
            ->assertStatus(409)->assertJsonPath('code', 'NOTHING_CHANGED');
    }

    public function test_only_super_admins(): void
    {
        $this->getJson(self::URL)->assertStatus(401);
        $admin = User::factory()->admin()->create(['company_id' => Company::factory()->create()->id]);
        $this->actingAs($admin)->getJson(self::URL)->assertStatus(403);
        $this->save([['key' => SystemSettings::ANOMALY_SENSITIVITY, 'value' => 'strict', 'was' => 'balanced']], [], $admin)->assertStatus(403);
        $this->actingAs($this->owner)->getJson(self::URL.'/history?group=money')->assertStatus(422);
    }
}
