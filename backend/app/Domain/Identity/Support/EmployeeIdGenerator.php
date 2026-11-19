<?php

namespace App\Domain\Identity\Support;

use App\Models\User;

/**
 * Makes the next Employee ID: "EMP-{year}-{counter}", e.g. EMP-2026-0001, EMP-2026-0002 …
 * (4 digits, growing to 5+ if a year ever passes 9,999 users). The counter starts again each year.
 *
 *   peek()  "what would the next one be?" (shown read-only in the form, nothing is reserved)
 *   next()  the real one, used while saving. It must run INSIDE a DB::transaction:
 *           lockForUpdate() makes a second admin who clicks at the same moment WAIT
 *           until we're done, so both can never get the same number. The UNIQUE index
 *           on users.employee_id is the final safety net.
 */
class EmployeeIdGenerator
{
    public function peek(): string
    {
        return $this->format($this->lastNumber(lock: false) + 1);
    }

    public function next(): string
    {
        return $this->format($this->lastNumber(lock: true) + 1);
    }

    private function lastNumber(bool $lock): int
    {
        $prefix = $this->prefix();

        $query = User::query()->where('employee_id', 'like', $prefix.'%');
        if ($lock) {
            $query->lockForUpdate();
        }

        // Read the numbers in PHP (not with string sorting, where "EMP-2026-10000" < "EMP-2026-9999")
        return (int) $query->pluck('employee_id')
            ->map(fn (string $id) => (int) substr($id, strlen($prefix)))
            ->max();
    }

    private function format(int $number): string
    {
        return $this->prefix().str_pad((string) $number, 4, '0', STR_PAD_LEFT);
    }

    private function prefix(): string
    {
        return 'EMP-'.now()->year.'-';
    }
}
