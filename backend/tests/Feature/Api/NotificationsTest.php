<?php

namespace Tests\Feature\Api;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The bell panel API (Framer D7aTKQEDz).
 *
 * Run:  php artisan test --filter=NotificationsTest
 */
class NotificationsTest extends TestCase
{
    use RefreshDatabase;

    private function notify(User $user, string $type, bool $read = false, int $minutesAgo = 0): Notification
    {
        $n = new Notification([
            'recipient_id' => $user->id, 'type' => $type, 'title' => "Title {$type}",
            'message' => 'Message', 'is_read' => $read,
        ]);
        $n->created_at = now()->subMinutes($minutesAgo);
        $n->save();

        return $n;
    }

    public function test_the_admin_types_are_accepted_by_the_database(): void
    {
        $admin = User::factory()->admin()->create();

        foreach (['security_alert', 'access_changed', 'user_changed', 'department_alert', 'company_changed', 'voucher_approved'] as $type) {
            $this->notify($admin, $type);
        }

        $this->assertSame(6, Notification::count());
    }

    public function test_lists_only_my_notifications_newest_first_with_unread_count(): void
    {
        $me = User::factory()->admin()->create();
        $other = User::factory()->admin()->create();

        $old = $this->notify($me, 'user_changed', read: true, minutesAgo: 60);
        $new = $this->notify($me, 'security_alert', minutesAgo: 2);
        $this->notify($other, 'security_alert'); // not mine

        $this->actingAs($me)
            ->getJson('/api/v1/notifications')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.id', $new->id)
            ->assertJsonPath('data.0.category', 'security')
            ->assertJsonPath('data.0.is_read', false)
            ->assertJsonPath('data.1.id', $old->id)
            ->assertJsonPath('meta.unread_count', 1);
    }

    public function test_unread_and_category_filters(): void
    {
        $me = User::factory()->admin()->create();
        $this->notify($me, 'security_alert');
        $this->notify($me, 'security_alert', read: true);
        $this->notify($me, 'access_changed');

        $this->actingAs($me)->getJson('/api/v1/notifications?filter[unread]=1')
            ->assertOk()->assertJsonCount(2, 'data');

        $this->actingAs($me)->getJson('/api/v1/notifications?filter[category]=security')
            ->assertOk()->assertJsonCount(2, 'data');
    }

    public function test_an_unknown_category_returns_422(): void
    {
        $this->actingAs(User::factory()->admin()->create())
            ->getJson('/api/v1/notifications?filter[category]=pizza')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['filter.category']);
    }

    public function test_unread_count(): void
    {
        $me = User::factory()->create();
        $this->notify($me, 'voucher_pending');
        $this->notify($me, 'voucher_pending', read: true);

        $this->actingAs($me)->getJson('/api/v1/notifications/unread-count')
            ->assertOk()->assertJsonPath('data.unread_count', 1);
    }

    public function test_mark_one_as_read(): void
    {
        $me = User::factory()->admin()->create();
        $n = $this->notify($me, 'security_alert');

        $this->actingAs($me)->postJson("/api/v1/notifications/{$n->id}/read")->assertNoContent();

        $this->assertTrue($n->fresh()->is_read);
    }

    public function test_someone_elses_notification_is_not_found(): void
    {
        $owner = User::factory()->admin()->create();
        $n = $this->notify($owner, 'security_alert');

        $this->actingAs(User::factory()->admin()->create())
            ->postJson("/api/v1/notifications/{$n->id}/read")
            ->assertNotFound()
            ->assertJsonPath('code', 'NOT_FOUND');

        $this->assertFalse($n->fresh()->is_read);
    }

    public function test_mark_all_as_read_only_touches_my_notifications(): void
    {
        $me = User::factory()->admin()->create();
        $other = User::factory()->admin()->create();
        $this->notify($me, 'security_alert');
        $this->notify($me, 'access_changed');
        $theirs = $this->notify($other, 'security_alert');

        $this->actingAs($me)->postJson('/api/v1/notifications/read-all')->assertNoContent();

        $this->assertSame(0, Notification::for($me)->unread()->count());
        $this->assertFalse($theirs->fresh()->is_read);
    }

    public function test_guests_get_401(): void
    {
        $this->getJson('/api/v1/notifications')->assertUnauthorized();
        $this->getJson('/api/v1/notifications/unread-count')->assertUnauthorized();
        $this->postJson('/api/v1/notifications/read-all')->assertUnauthorized();
    }
}
