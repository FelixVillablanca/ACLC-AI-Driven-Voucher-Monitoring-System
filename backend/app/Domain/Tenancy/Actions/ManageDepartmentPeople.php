<?php

namespace App\Domain\Tenancy\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Identity\Queries\CompanyUserDirectory;
use App\Domain\Tenancy\Support\AdminCompany;
use App\Exceptions\ApiException;
use App\Models\Company;
use App\Models\Department;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * People in a department (Departments page side panel, user request 2026-11-28). The rules, in ONE place:
 *  - a person is in at most ONE department (users.department_id): adding someone from another department MOVES them
 *  - a department has at most ONE head (departments.head_user_id), and the head is always one of its own members:
 *    making someone head also makes them a member; moving or removing a head clears that head slot
 *  - only ACTIVE clerks / officers / supervisors whose home company is the Admin's can be added or made head
 *    (so a company with no such users can't have a head)
 *  - replacing an existing head must be confirmed (replace_head), else 409 DEPARTMENT_HAS_HEAD
 *  - an inactive department takes no new people (409 DEPARTMENT_INACTIVE)
 * Every change is locked (department + people rows), audited, and the company's other Admins get a bell notice.
 */
class ManageDepartmentPeople
{
    /**
     * Add people (as members), optionally making one of them the head.
     *
     * @param  list<int>  $userIds
     * @return array{added: int, moved: int, head: ?User}
     */
    public function add(Department $department, array $userIds, ?int $headId, bool $replaceHead, User $admin, ?string $ip): array
    {
        $company = AdminCompany::activeFor($admin, 'department changes');

        return DB::transaction(function () use ($department, $userIds, $headId, $replaceHead, $admin, $ip, $company) {
            $department = $this->lockOpen($department);
            $ids = array_values(array_unique(array_map('intval', $headId ? [...$userIds, $headId] : $userIds)));
            $people = $this->eligible($company, $ids);

            $moved = 0;
            $added = 0;
            foreach ($people as $person) {
                if ($person->department_id === $department->id) {
                    continue; // already in it
                }
                $moved += $person->department_id ? 1 : 0;
                $this->place($person, $department, $admin, $ip);
                $added++;
            }

            $head = $headId ? $this->makeHead($department, $people->firstWhere('id', $headId), $replaceHead, $admin, $ip) : null;

            if ($added > 0) {
                $this->audit($admin, $department, 'department_members_added', null, [
                    'name' => $department->name,
                    'people' => $people->filter(fn ($p) => $p->wasChanged('department_id'))->map(fn ($p) => $p->full_name)->values()->all(),
                ], $ip);
                $this->tellOtherAdmins($admin, $company, 'People added to a department',
                    "{$admin->full_name} added ".($added === 1 ? $people->first(fn ($p) => $p->wasChanged('department_id'))?->full_name : "{$added} people")." to {$department->name}.");
            }

            return ['added' => $added, 'moved' => $moved, 'head' => $head];
        });
    }

    /** Make an existing member (or anyone eligible: they join first) the head. */
    public function setHead(Department $department, int $userId, bool $replaceHead, User $admin, ?string $ip): User
    {
        $company = AdminCompany::activeFor($admin, 'department changes');

        return DB::transaction(function () use ($department, $userId, $replaceHead, $admin, $ip, $company) {
            $department = $this->lockOpen($department);
            $person = $this->eligible($company, [$userId])->first();
            if ($person->department_id !== $department->id) {
                $this->place($person, $department, $admin, $ip);
            }

            return $this->makeHead($department, $person, $replaceHead, $admin, $ip);
        });
    }

    /** "Remove as head": the department has no head; the person stays a member. */
    public function clearHead(Department $department, User $admin, ?string $ip): void
    {
        AdminCompany::activeFor($admin, 'department changes');

        DB::transaction(function () use ($department, $admin, $ip) {
            $department = Department::whereKey($department->id)->lockForUpdate()->firstOrFail();
            if ($department->head_user_id === null) {
                throw new ApiException("{$department->name} has no head right now.", 'DEPARTMENT_HAS_NO_HEAD', 409);
            }
            $old = $department->head_user_id;
            $department->forceFill(['head_user_id' => null])->save();
            $this->audit($admin, $department, 'department_head_changed', ['head_user_id' => $old], ['name' => $department->name, 'head_user_id' => null], $ip);
        });
    }

    /** "Remove from department": they have no department now (and stop being its head). Inactive people can be removed too. */
    public function remove(Department $department, int $userId, User $admin, ?string $ip): void
    {
        $company = AdminCompany::activeFor($admin, 'department changes');

        DB::transaction(function () use ($department, $userId, $admin, $ip, $company) {
            $department = Department::whereKey($department->id)->lockForUpdate()->firstOrFail();
            $person = User::query()->where('company_id', $company->id)->whereIn('role', CompanyUserDirectory::ROLES)
                ->whereKey($userId)->lockForUpdate()->first();
            if (! $person || $person->department_id !== $department->id) {
                throw new ApiException('This person isn’t in this department any more.', 'NOT_A_MEMBER', 409);
            }

            $person->forceFill(['department_id' => null])->save();
            if ($department->head_user_id === $person->id) {
                $department->forceFill(['head_user_id' => null])->save();
            }

            $this->audit($admin, $department, 'department_member_removed', ['department_id' => $department->id],
                ['name' => $department->name, 'person' => $person->full_name, 'was_head' => $department->wasChanged('head_user_id')], $ip);
            $this->tellOtherAdmins($admin, $company, 'Person removed from a department',
                "{$admin->full_name} removed {$person->full_name} from {$department->name}.");
        });
    }

    /**
     * The shared head rule for "Add department" / "Edit department" too: the head joins the department
     * (moved from their old one, whose head slot is cleared if it was theirs). Call it inside a transaction.
     */
    public function placeHeadInto(Department $department, ?int $headId, User $admin, ?string $ip): void
    {
        if (! $headId) {
            return;
        }
        $person = User::whereKey($headId)->lockForUpdate()->first();
        if ($person && $person->department_id !== $department->id) {
            $this->place($person, $department, $admin, $ip);
        }
    }

    // ------------------------------------------------------------------ the rules

    private function lockOpen(Department $department): Department
    {
        $department = Department::whereKey($department->id)->lockForUpdate()->firstOrFail();
        if (! $department->is_active) {
            throw new ApiException("{$department->name} is deactivated. Reactivate it before adding people.", 'DEPARTMENT_INACTIVE', 409);
        }

        return $department;
    }

    /** Active operational people of the Admin's company, locked; 422 naming anyone who isn't. */
    private function eligible(Company $company, array $ids): Collection
    {
        $people = User::query()
            ->where('company_id', $company->id)->whereIn('role', CompanyUserDirectory::ROLES)
            ->where('is_active', true)->where('access_status', '!=', 'rejected')
            ->whereKey($ids)->lockForUpdate()->get();

        if ($people->count() !== count($ids)) {
            throw new ApiException('Someone you picked isn’t an active user of your company any more. Refresh the list and try again.',
                'VALIDATION_FAILED', 422, ['user_ids' => ['Someone you picked isn’t an active user of your company any more.']]);
        }

        return $people;
    }

    /** Puts a person into a department; if they headed another one, that one has no head now. */
    private function place(User $person, Department $department, User $admin, ?string $ip): void
    {
        Department::where('head_user_id', $person->id)->whereKeyNot($department->id)->lockForUpdate()->get()
            ->each(function (Department $old) use ($admin, $ip, $person) {
                $old->forceFill(['head_user_id' => null])->save();
                $this->audit($admin, $old, 'department_head_changed', ['head_user_id' => $person->id],
                    ['name' => $old->name, 'head_user_id' => null, 'reason' => "{$person->full_name} moved to another department"], $ip);
            });

        $person->forceFill(['department_id' => $department->id])->save();
    }

    private function makeHead(Department $department, User $person, bool $replaceHead, User $admin, ?string $ip): User
    {
        if ($department->head_user_id === $person->id) {
            return $person;
        }
        if ($department->head_user_id !== null && ! $replaceHead) {
            $current = User::find($department->head_user_id);
            throw new ApiException(
                ($current ? "{$current->full_name} is" : 'Someone else is')." already the head of {$department->name}. Confirm to replace them.",
                'DEPARTMENT_HAS_HEAD', 409);
        }

        $old = $department->head_user_id;
        $department->forceFill(['head_user_id' => $person->id])->save();
        $this->audit($admin, $department, 'department_head_changed', ['head_user_id' => $old],
            ['name' => $department->name, 'head_user_id' => $person->id, 'head' => $person->full_name], $ip);

        return $person;
    }

    private function audit(User $admin, Department $department, string $action, ?array $old, array $new, ?string $ip): void
    {
        AuditTrail::record([
            'user_id' => $admin->id,
            'company_id' => $department->company_id,
            'action' => $action,
            'table_name' => 'departments',
            'record_id' => $department->id,
            'old_values' => $old,
            'new_values' => $new,
            'ip_address' => $ip,
        ]);
    }

    private function tellOtherAdmins(User $admin, Company $company, string $title, string $message): void
    {
        User::where('role', 'admin')->where('company_id', $company->id)->whereKeyNot($admin->id)->pluck('id')
            ->each(fn (int $id) => Notification::create([
                'recipient_id' => $id, 'type' => 'department_alert', 'title' => $title, 'message' => $message,
            ]));
    }
}
