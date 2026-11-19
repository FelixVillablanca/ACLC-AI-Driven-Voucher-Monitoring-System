<?php

use App\Http\Controllers\Api\V1\Admin\DashboardController as AdminDashboardController;
use App\Http\Controllers\Api\V1\Admin\LookupController;
use App\Http\Controllers\Api\V1\Admin\UserController as AdminUserController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\InvitationController;
use App\Http\Controllers\Api\V1\NotificationController;
use App\Http\Controllers\Api\V1\SuperAdmin\AdminController as SuperAdminAdminController;
use App\Http\Controllers\Api\V1\SuperAdmin\DashboardController as SuperAdminDashboardController;
use Illuminate\Support\Facades\Route;

/*
| API routes: the "front door" the React app talks to.
| Every URL here automatically starts with /api, and we group everything under /v1:
|   GET /api/v1/health
| A future breaking change would go under /v2, so v1 keeps working.
*/

Route::prefix('v1')->name('api.v1.')->group(function () {
    // Public: "is the backend alive and can it reach the database?"
    Route::get('/health', HealthController::class)->name('health');

    // Public: log in (max 5 tries per minute, see AppServiceProvider)
    Route::post('/auth/login', [AuthController::class, 'login'])
        ->middleware('throttle:login')
        ->name('auth.login');

    // Public: the "set your password" link from an invitation email (the token is the proof).
    // Rate limited (10 per minute per IP, see AppServiceProvider) so nobody can guess tokens.
    Route::prefix('auth/invitation')->name('auth.invitation.')->middleware('throttle:invitation')->group(function () {
        Route::post('/check', [InvitationController::class, 'check'])->name('check');
        Route::post('/accept', [InvitationController::class, 'accept'])->name('accept');
    });

    // Logged-in users only. auth:sanctum = "must have a valid session cookie (or token)"
    // account.standing: a deactivated user, or one whose companies were all suspended, is signed out on the next request.
    // idle.timeout: Super Admins are signed out after 15 idle minutes (a Global setting).
    Route::middleware(['auth:sanctum', 'throttle:api', 'account.standing', 'idle.timeout'])->group(function () {
        Route::get('/auth/me', [AuthController::class, 'me'])->name('auth.me');
        Route::post('/auth/logout', [AuthController::class, 'logout'])->name('auth.logout');

        // Notifications (bell panel): each user only ever sees their own
        Route::prefix('notifications')->name('notifications.')->group(function () {
            Route::get('/', [NotificationController::class, 'index'])->name('index');
            Route::get('/unread-count', [NotificationController::class, 'unreadCount'])->name('unread-count');
            Route::post('/read-all', [NotificationController::class, 'markAllRead'])->name('read-all');
            Route::post('/{notification}/read', [NotificationController::class, 'markRead'])->whereNumber('notification')->name('read');
        });

        // ADMIN area: system setup only (no vouchers / money). role:admin -> others get 403.
        Route::prefix('admin')->name('admin.')->middleware('role:admin')->group(function () {
            Route::get('/dashboard', AdminDashboardController::class)->name('dashboard');
            Route::get('/lookups/companies', [LookupController::class, 'companies'])->name('lookups.companies');
            Route::get('/users/next-employee-id', [AdminUserController::class, 'nextEmployeeId'])->name('users.next-employee-id');
            Route::post('/users', [AdminUserController::class, 'store'])->name('users.store');
        });

        // SUPER ADMIN area: the platform owner (docs/System_Flow_Roles_and_UML_Design.docx §4).
        // Admin accounts, global rules, all audit logs, system health. Never vouchers or money.
        Route::prefix('superadmin')->name('superadmin.')->middleware(['role:super_admin', 'throttle:superadmin'])->group(function () {
            Route::get('/dashboard', SuperAdminDashboardController::class)->name('dashboard');
            Route::get('/admins/form-defaults', [SuperAdminAdminController::class, 'formDefaults'])->name('admins.form-defaults');
            Route::post('/admins', [SuperAdminAdminController::class, 'store'])->name('admins.store');
            Route::post('/admins/{user}/invitation', [SuperAdminAdminController::class, 'resendInvitation'])
                ->whereNumber('user')->name('admins.invitation');
        });

        // Next: company-scoped routes (ResolveCompany middleware) go here.
    });
});
