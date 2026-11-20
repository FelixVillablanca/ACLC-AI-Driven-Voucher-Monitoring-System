<?php

use App\Http\Controllers\Api\V1\Admin\DashboardController as AdminDashboardController;
use App\Http\Controllers\Api\V1\Admin\LookupController;
use App\Http\Controllers\Api\V1\Admin\UserController as AdminUserController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\InvitationController;
use App\Http\Controllers\Api\V1\NotificationController;
use App\Http\Controllers\Api\V1\SuperAdmin\AdminController as SuperAdminAdminController;
use App\Http\Controllers\Api\V1\SuperAdmin\BackupController;
use App\Http\Controllers\Api\V1\SuperAdmin\DashboardController as SuperAdminDashboardController;
use App\Http\Controllers\Api\V1\SuperAdmin\FailedJobController;
use App\Http\Controllers\Api\V1\SuperAdmin\SecurityAlertController;
use App\Http\Controllers\Api\V1\TwoFactorLoginController;
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

    // Public: the 2nd step of signing in (two-step sign-in), right after a correct password.
    // The "half signed in" session is the proof. 6 tries per minute, so codes can't be guessed.
    Route::prefix('auth/two-factor')->name('auth.two-factor.')->middleware('throttle:two-factor')->group(function () {
        Route::post('/challenge', [TwoFactorLoginController::class, 'challenge'])->name('challenge');
        Route::get('/setup', [TwoFactorLoginController::class, 'setupInfo'])->name('setup.show');
        Route::post('/setup', [TwoFactorLoginController::class, 'confirmSetup'])->name('setup.confirm');
        Route::post('/skip', [TwoFactorLoginController::class, 'skip'])->name('skip');
        Route::post('/cancel', [TwoFactorLoginController::class, 'cancel'])->name('cancel');
    });

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
            // Admins tab (Framer U7glXUOSF) + click-flows A1–A12
            Route::prefix('admins')->name('admins.')->controller(SuperAdminAdminController::class)->group(function () {
                Route::get('/', 'index')->name('index');
                Route::get('/form-defaults', 'formDefaults')->name('form-defaults');
                Route::get('/export', 'export')->name('export');
                Route::post('/', 'store')->name('store');
                Route::post('/bulk', 'bulk')->name('bulk');
                Route::whereNumber('user')->group(function () {
                    Route::get('/{user}', 'show')->name('show');
                    Route::patch('/{user}', 'update')->name('update');
                    Route::get('/{user}/activity', 'activity')->name('activity');
                    Route::post('/{user}/invitation', 'resendInvitation')->name('invitation');
                    Route::delete('/{user}/invitation', 'cancelInvitation')->name('invitation.cancel');
                    Route::post('/{user}/password-reset', 'passwordReset')->name('password-reset');
                    Route::post('/{user}/two-factor', 'requireTwoFactor')->name('two-factor');
                    Route::post('/{user}/deactivate', 'deactivate')->name('deactivate');
                    Route::post('/{user}/reactivate', 'reactivate')->name('reactivate');
                    Route::post('/{user}/promote', 'promote')->name('promote');
                });
            });

            // Database backups: "Run a database backup now?" (Framer TKziMjHUe)
            Route::get('/backups/overview', [BackupController::class, 'overview'])->name('backups.overview');
            Route::post('/backups', [BackupController::class, 'store'])->name('backups.store');
            Route::get('/backups/{backup}', [BackupController::class, 'show'])->whereNumber('backup')->name('backups.show');

            // Failed background jobs: "Retry failed jobs" (Framer fzdOvPqCX)
            Route::get('/failed-jobs', [FailedJobController::class, 'index'])->name('failed-jobs.index');
            Route::post('/failed-jobs/retry', [FailedJobController::class, 'retry'])->name('failed-jobs.retry');
            Route::delete('/failed-jobs', [FailedJobController::class, 'destroy'])->name('failed-jobs.destroy');

            // Security alerts panel (Framer mQcXDCyDZ) + Alert detail (SCoT_cu7B)
            Route::prefix('security-alerts')->name('security-alerts.')->group(function () {
                Route::get('/', [SecurityAlertController::class, 'index'])->name('index');
                Route::post('/review-all', [SecurityAlertController::class, 'reviewAll'])->name('review-all');
                Route::get('/{alert}', [SecurityAlertController::class, 'show'])->whereNumber('alert')->name('show');
                Route::post('/{alert}/review', [SecurityAlertController::class, 'review'])->whereNumber('alert')->name('review');
                Route::post('/{alert}/dismiss', [SecurityAlertController::class, 'dismiss'])->whereNumber('alert')->name('dismiss');
            });
        });

        // Next: company-scoped routes (ResolveCompany middleware) go here.
    });
});
