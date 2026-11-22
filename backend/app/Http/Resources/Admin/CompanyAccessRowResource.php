<?php

namespace App\Http\Resources\Admin;

use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One person on the Company access page, with their access to the Admin's company.
 *   access = accepted | pending | denied | none
 *   home_company = null when it's the Admin's own company, otherwise { id, name } (a guest)
 *
 * @mixin User
 */
class CompanyAccessRowResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $ownCompanyId = (int) $request->user()?->company_id;

        return [
            'id' => $this->id,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'full_name' => $this->full_name,
            'email' => $this->email,
            'employee_id' => $this->employee_id,
            'role' => $this->role,
            'status' => $this->accountStatus(),
            'department' => (int) $this->company_id === $ownCompanyId ? $this->department?->name : null,
            'home_company' => (int) $this->company_id === $ownCompanyId || ! $this->company
                ? null
                : ['id' => $this->company->id, 'name' => $this->company->name],
            'access' => $this->access_status ?? 'none',
            'access_changed_at' => $this->access_changed_at ? Carbon::parse($this->access_changed_at)->toIso8601String() : null,
            'access_by' => $this->access_by_name ?: null,
        ];
    }
}
