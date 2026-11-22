<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;

/**
 * The company side panel's header + Overview tab (Framer C8 a17W5hpkA):
 * everything on the card, plus contact details, two-step count and the largest departments
 * (CompanyProfile::overview(), passed in with withProfile() so they sit inside `data`).
 */
class CompanyDetailResource extends CompanyCardResource
{
    private array $profile = [];

    public function withProfile(array $profile): static
    {
        $this->profile = $profile;

        return $this;
    }

    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [...parent::toArray($request), ...$this->profile];
    }
}
