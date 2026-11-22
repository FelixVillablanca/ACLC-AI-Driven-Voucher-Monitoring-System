<?php

use App\Http\Controllers\Api\V1\AccountController;
use App\Http\Controllers\Api\V1\Admin\CompanyAccessController as AdminCompanyAccessController;
use App\Http\Controllers\Api\V1\Admin\DashboardController as AdminDashboardController;
use App\Http\Controllers\Api\V1\Admin\DepartmentController as AdminDepartmentController;
use App\Http\Controllers\Api\V1\Admin\LookupController;
use App\Http\Controllers\Api\V1\Admin\SearchController as AdminSearchController;
use App\Http\Controllers\Api\V1\Admin\UserController as AdminUserController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\InvitationController;
use App\Http\Controllers\Api\V1\NotificationController;
use App\Http\Controllers\Api\V1\SuperAdmin\AdminController as SuperAdminAdminController;
use App\Http\Controllers\Api\V1\SuperAdmin\AuditLogController;
use App\Http\Controllers\Api\V1\SuperAdmin\BackupController;
use App\Http\Controllers\Api\V1\SuperAdmin\BlockedIpController;
use App\Http\Controllers\Api\V1\SuperAdmin\CompanyController as SuperAdminCompanyController;
use App\Http\Controllers\Api\V1\SuperAdmin\DashboardController as SuperAdminDashboardController;
use App\Http\Controllers\Api\V1\SuperAdmin\FailedJobController;
use App\Http\Controllers\Api\V1\SuperAdmin\GlobalSettingsController;
use App\Http\Controllers\Api\V1\SuperAdmin\SecurityAlertController;
use App\Http\Controllers\Api\V1\SuperAdmin\SystemHealthController;
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

        // The account menu pages: My profile, Account settings, Change password, My activity, Help & support.
        // Always YOUR OWN account (no id in the address). Password and two-step changes are rate limited.
        Route::prefix('account')->name('account.')->controller(AccountController::class)->group(function () {
            Route::get('/', 'show')->name('show');
            Route::patch('/', 'update')->middleware('throttle:10,1')->name('update');
            Route::put('/password', 'changePassword')->middleware('throttle:6,1')->name('password');
            Route::get('/two-factor/setup', 'twoFactorSetup')->middleware('throttle:two-factor')->name('two-factor.setup');
            Route::post('/two-factor', 'enableTwoFactor')->middleware('throttle:two-factor')->name('two-factor.enable');
            Route::post('/two-factor/recovery-codes', 'newRecoveryCodes')->middleware('throttle:6,1')->name('two-factor.recovery-codes');
            Route::delete('/two-factor', 'disableTwoFactor')->middleware('throttle:6,1')->name('two-factor.disable');
            Route::get('/sessions', 'sessions')->name('sessions');
            Route::delete('/sessions/{key}', 'signOutSession')->where('key', '[a-f0-9]{32}')->name('sessions.destroy');
            Route::post('/sessions/sign-out-others', 'signOutOthers')->name('sessions.sign-out-others');
            Route::get('/activity', 'activity')->name('activity');
            Route::get('/support', 'support')->name('support');
        });

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
            // Top-bar search: the Admin's own users + departments only
            Route::get('/search', AdminSearchController::class)->middleware('throttle:admin-search')->name('search');
            Route::get('/users/next-employee-id', [AdminUserController::class, 'nextEmployeeId'])->name('users.next-employee-id');
            Route::post('/users', [AdminUserController::class, 'store'])->name('users.store');
            // People & Access -> Users page (2026-11-22): the Admin's own company's clerks / officers / supervisors
            Route::get('/users', [AdminUserController::class, 'index'])->name('users.index');
            Route::get('/users/{user}', [AdminUserController::class, 'show'])->whereNumber('user')->name('users.show');
            Route::patch('/users/{user}', [AdminUserController::class, 'update'])->whereNumber('user')->middleware('throttle:30,1')->name('users.update');
            Route::post('/users/{user}/deactivate', [AdminUserController::class, 'deactivate'])->whereNumber('user')->middleware('throttle:30,1')->name('users.deactivate');
            Route::post('/users/{user}/reactivate', [AdminUserController::class, 'reactivate'])->whereNumber('user')->middleware('throttle:30,1')->name('users.reactivate');
            Route::post('/users/{user}/password', [AdminUserController::class, 'password'])->whereNumber('user')->middleware('throttle:10,1')->name('users.password');
            // Quick actions (2026-11-22): always the Admin's own company
            Route::get('/lookups/people', [LookupController::class, 'people'])->name('lookups.people');
            Route::get('/departments', [AdminDepartmentController::class, 'index'])->name('departments.index');
            Route::post('/departments', [AdminDepartmentController::class, 'store'])->middleware('throttle:30,1')->name('departments.store');
            Route::get('/departments/{department}', [AdminDepartmentController::class, 'show'])->whereNumber('department')->name('departments.show');
            Route::get('/departments/{department}/members', [AdminDepartmentController::class, 'members'])->whereNumber('department')->name('departments.members');
            Route::patch('/departments/{department}', [AdminDepartmentController::class, 'update'])->whereNumber('department')->middleware('throttle:30,1')->name('departments.update');
            Route::post('/departments/{department}/deactivate', [AdminDepartmentController::class, 'deactivate'])->whereNumber('department')->middleware('throttle:30,1')->name('departments.deactivate');
            Route::post('/departments/{department}/reactivate', [AdminDepartmentController::class, 'reactivate'])->whereNumber('department')->middleware('throttle:30,1')->name('departments.reactivate');
            Route::get('/company-access', [AdminCompanyAccessController::class, 'index'])->name('company-access.index');
            Route::get('/company-access/candidates', [AdminCompanyAccessController::class, 'candidates'])->name('company-access.candidates');
            Route::post('/company-access/{user}/revoke', [AdminCompanyAccessController::class, 'revoke'])->whereNumber('user')->middleware('throttle:30,1')->name('company-access.revoke');
            Route::post('/company-access', [AdminCompanyAccessController::class, 'store'])->middleware('throttle:30,1')->name('company-access.store');
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
                Route::post('/', 'store')->middleware('throttle:20,1')->name('store'); // + Add company
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

            // System health tab (Framer m80KDanOj) + SH1-SH10 (backup / retry reuse their own routes)
            Route::prefix('system-health')->name('system-health.')->controller(SystemHealthController::class)->group(function () {
                Route::get('/', 'show')->name('show');
                Route::post('/check', 'check')->middleware('throttle:6,1')->name('check');
                Route::get('/days/{date}', 'day')->where('date', '\d{4}-\d{2}-\d{2}')->name('day');
                Route::get('/jobs', 'jobs')->name('jobs');
                Route::get('/failed-jobs/{uuid}', 'failedJob')->where('uuid', '[0-9a-fA-F-]{36}')->name('failed-job');
                Route::get('/incidents/{incident}', 'incident')->whereNumber('incident')->name('incident');
                Route::post('/incidents/{incident}/resolve', 'resolve')->whereNumber('incident')->name('incident.resolve');
            });

            // Audit logs tab (Framer EJ0asP2ZH) + AL1-AL9. Read-only: nothing here edits or deletes an entry.
            Route::prefix('audit-logs')->name('audit-logs.')->controller(AuditLogController::class)->group(function () {
                Route::get('/', 'index')->name('index');
                Route::get('/options', 'options')->name('options');
                Route::get('/export', 'export')->middleware('throttle:10,1')->name('export');
                Route::get('/ip/{ip}', 'ip')->where('ip', '[0-9a-fA-F:.]+')->name('ip');
                Route::get('/{id}', 'show')->whereNumber('id')->name('show');
            });
            // Blocked IP addresses (AL2 / AL8)
            Route::get('/blocked-ips', [BlockedIpController::class, 'index'])->name('blocked-ips.index');
            Route::get('/blocked-ips/{block}', [BlockedIpController::class, 'show'])->whereNumber('block')->name('blocked-ips.show');
            Route::post('/blocked-ips', [BlockedIpController::class, 'store'])->name('blocked-ips.store');
            Route::post('/blocked-ips/{block}/unblock', [BlockedIpController::class, 'unblock'])->whereNumber('block')->name('blocked-ips.unblock');

            // Global settings tab (Framer tsrXCiWWw) + G1 Change history, G3 Save (password needed)
            Route::get('/settings', [GlobalSettingsController::class, 'show'])->name('settings.show');
            // 6 tries a minute: each save checks the password, so guessing it here is slow
            Route::put('/settings', [GlobalSettingsController::class, 'update'])->middleware('throttle:6,1')->name('settings.update');
            Route::get('/settings/history', [GlobalSettingsController::class, 'history'])->name('settings.history');

            // Companies tab (Framer vnNFYExpX) + C1-C8: list, export, side panel, suspend, reactivate
            Route::prefix('companies')->name('companies.')->controller(SuperAdminCompanyController::class)->group(function () {
                Route::get('/', 'index')->name('index');
                Route::get('/export', 'export')->name('export');
                Route::post('/', 'store')->middleware('throttle:20,1')->name('store'); // + Add company
                Route::get('/{company}', 'show')->whereNumber('company')->name('show');
                Route::get('/{company}/departments', 'departments')->whereNumber('company')->name('departments');
                Route::get('/{company}/users', 'users')->whereNumber('company')->name('users');
                Route::get('/{company}/history', 'history')->whereNumber('company')->name('history');
                Route::post('/{company}/suspend', 'suspend')->whereNumber('company')->name('suspend');
                Route::post('/{company}/reactivate', 'reactivate')->whereNumber('company')->name('reactivate');
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
