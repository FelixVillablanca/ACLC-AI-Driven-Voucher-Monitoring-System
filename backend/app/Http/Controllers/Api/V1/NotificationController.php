<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Notifications\NotificationType;
use App\Http\Controllers\Controller;
use App\Http\Requests\Notifications\ListNotificationsRequest;
use App\Http\Resources\NotificationResource;
use App\Models\Notification;
use App\Support\LiveCounts;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

/**
 * The signed-in user's own notifications (the bell panel, Framer D7aTKQEDz).
 *
 *   GET  /api/v1/notifications                 newest first, cursor pagination
 *   GET  /api/v1/notifications/unread-count    for the badge on the bell
 *   POST /api/v1/notifications/{id}/read       mark one as read
 *   POST /api/v1/notifications/read-all        mark all as read
 *
 * Every query starts with ->for($user), so another person's notification is
 * simply "not found" (404). It can never be read or changed.
 */
class NotificationController extends Controller
{
    public function index(ListNotificationsRequest $request): AnonymousResourceCollection
    {
        $user = $request->user();
        $filter = $request->validated('filter', []);

        $notifications = Notification::for($user)
            ->with('voucher:id,status,approved_at,created_by,payee_email') // the final-approval notice's buttons
            ->when($request->boolean('filter.unread'), fn ($q) => $q->unread())
            ->when($filter['category'] ?? null, fn ($q, $category) => $q->whereIn('type', NotificationType::valuesInCategory($category)))
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            // CURSOR pagination: "give me the next 15 after this one". Stays fast and
            // never skips/duplicates items when new notifications arrive while scrolling.
            ->cursorPaginate($request->integer('per_page', 15));

        return NotificationResource::collection($notifications)->additional([
            'meta' => ['unread_count' => Notification::for($user)->unread()->count()],
        ]);
    }

    public function unreadCount(Request $request): JsonResponse
    {
        return response()->json([
            // Cached per person, cleared by the Notification model (LiveCounts): every tab asks once a minute
            'data' => ['unread_count' => LiveCounts::forUser('unread', $request->user()->id,
                fn () => Notification::for($request->user())->unread()->count())],
        ]);
    }

    public function markRead(Request $request, int $notification): Response
    {
        Notification::for($request->user())->findOrFail($notification)->update(['is_read' => true]);

        return response()->noContent();
    }

    public function markAllRead(Request $request): Response
    {
        Notification::for($request->user())->unread()->update(['is_read' => true]);
        LiveCounts::userChanged($request->user()->id); // a mass update fires no model events

        return response()->noContent();
    }
}
