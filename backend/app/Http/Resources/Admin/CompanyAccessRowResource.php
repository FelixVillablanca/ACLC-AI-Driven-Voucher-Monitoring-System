<?php

namespace App\Http\Resources\Admin;

use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One person on the Company access page, with their access to the Admin's company.
 *   access = accepted | pending | denied | none     access_kind = grant | invite | request
 *
 * PRIVACY (user decision 2026-11-22): someone whose HOME company is another one (`home_company` set)
 * is shown with their work email and role only. No employee ID, department or account status:
 * their own company's Admin manages their account.
 *
 * @mixin User
 */
class CompanyAccessRowResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $own = (int) $this->company_id === (int) $request->user()?->company_id;

        return [
            'id' => $this->id,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'full_name' => $this->full_name,
            'email' => $this->email,
            'role' => $this->role,
            'employee_id' => $own ? $this->employee_id : null,
            'status' => $own ? $this->accountStatus() : null,
            'department' => $own ? $this->department?->name : null,
            'home_company' => $own || ! $this->company ? null : ['id' => $this->company->id, 'name' => $this->company->name],
            'access' => $this->access_status ?? 'none',
            'access_kind' => $this->access_kind,
            'access_changed_at' => $this->access_changed_at ? Carbon::parse($this->access_changed_at)->toIso8601String() : null,
            'access_by' => $this->access_by_name ?: null,
        ];
    }
}
