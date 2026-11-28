<?php

namespace App\Domain\Vouchers\Cheques;

use App\Domain\Audit\AuditTrail;
use App\Domain\Vouchers\Support\PaymentSlipPdf;
use App\Exceptions\ApiException;
use App\Models\Cheque;
use App\Models\User;
use App\Models\Voucher;
use Illuminate\Database\QueryException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Recording a cheque and moving it along (cheque register, user decisions 2026-11-29). Done by the Accounting Clerk
 * who made the voucher (the controller only finds the clerk's own vouchers / cheques).
 *
 *   record   approved cheque voucher, no live cheque yet       409 VOUCHER_NOT_APPROVED / NOT_A_CHEQUE_VOUCHER / CHEQUE_ALREADY_RECORDED
 *   release  issued → released (who picked it up)              409 INVALID_CHEQUE_STATUS
 *   clear    released → cleared (the day the bank paid it)     409 INVALID_CHEQUE_STATUS, 422 cleared_on before the cheque date
 *   cancel   issued / released → cancelled (reason)            409 INVALID_CHEQUE_STATUS
 *
 * Every step: one transaction, the row LOCKED (two clicks or two clerks can't both win), one audit row (table cheques).
 * The same cheque number twice for one bank in one company = 422 on cheque_number.
 */
class ManageCheques
{
    /** @param  array{cheque_number: string, cheque_date: string, bank_name: string}  $data */
    public function record(Voucher $voucher, User $clerk, array $data, ?string $ip): Cheque
    {
        try {
            return DB::transaction(function () use ($voucher, $clerk, $data, $ip) {
                $v = Voucher::query()->lockForUpdate()->findOrFail($voucher->id);
                PaymentSlipPdf::ensureApproved($v);
                if ($v->payment_method !== 'cheque') {
                    throw new ApiException('This voucher isn’t paid by cheque, so there’s no cheque to record.', 'NOT_A_CHEQUE_VOUCHER', 409);
                }
                if (Cheque::query()->where('voucher_id', $v->id)->whereIn('status', ChequeRules::LIVE)->exists()) {
                    throw new ApiException(
                        'A cheque is already recorded for this voucher. Cancel it first if it has to be replaced.',
                        'CHEQUE_ALREADY_RECORDED',
                        409,
                    );
                }
                $this->ensureNumberIsFree($v->company_id, $data['bank_name'], $data['cheque_number']);

                $cheque = Cheque::query()->forceCreate([
                    'company_id' => $v->company_id,
                    'voucher_id' => $v->id,
                    'cheque_number' => $data['cheque_number'],
                    'cheque_date' => $data['cheque_date'],
                    'bank_name' => $data['bank_name'],
                    'amount' => $v->amount,
                    'payee_name' => (string) $v->payee_name,
                    'status' => 'issued',
                    'created_by' => $clerk->id,
                ]);

                $this->audit($cheque, $clerk, 'cheque_recorded', null, [
                    'cheque_number' => $cheque->cheque_number, 'cheque_date' => $data['cheque_date'], 'bank_name' => $cheque->bank_name,
                    'status' => 'issued',
                ], $ip);

                return $cheque;
            });
        } catch (QueryException $e) {
            // Two clerks saved the same number at the same moment: the UNIQUE index stopped the second one
            if (($e->errorInfo[1] ?? null) === 1062) {
                throw $this->numberTaken();
            }
            throw $e;
        }
    }

    public function release(Cheque $cheque, User $clerk, string $receivedBy, ?string $ip): Cheque
    {
        return $this->move($cheque, 'released', $clerk, $ip, fn () => [
            'received_by' => $receivedBy, 'released_at' => now(), 'released_by' => $clerk->id,
        ]);
    }

    public function clear(Cheque $cheque, User $clerk, string $clearedOn, ?string $ip): Cheque
    {
        return $this->move($cheque, 'cleared', $clerk, $ip, function (Cheque $c) use ($clearedOn, $clerk) {
            if (Carbon::parse($clearedOn)->lt($c->cheque_date)) {
                throw ValidationException::withMessages([
                    'cleared_on' => 'The bank can’t pay a cheque before its date ('.$c->cheque_date->format('M j, Y').').',
                ]);
            }

            return ['cleared_on' => $clearedOn, 'cleared_by' => $clerk->id];
        });
    }

    public function cancel(Cheque $cheque, User $clerk, string $reason, ?string $ip): Cheque
    {
        return $this->move($cheque, 'cancelled', $clerk, $ip, fn () => [
            'cancel_reason' => $reason, 'cancelled_at' => now(), 'cancelled_by' => $clerk->id,
        ]);
    }

    /** One status step under a row lock; $fields(Cheque) returns the extra columns (or throws a 422). */
    private function move(Cheque $cheque, string $to, User $clerk, ?string $ip, \Closure $fields): Cheque
    {
        return DB::transaction(function () use ($cheque, $to, $clerk, $ip, $fields) {
            $c = Cheque::query()->lockForUpdate()->findOrFail($cheque->id);
            if (! ChequeRules::can($c, $to)) {
                $now = ChequeRules::LABELS[$c->status] ?? $c->status;
                throw new ApiException(
                    "This cheque is {$now} now, so it can’t be marked ".strtolower(ChequeRules::LABELS[$to]).'. Reload to see its latest status.',
                    'INVALID_CHEQUE_STATUS',
                    409,
                );
            }

            $extra = $fields($c);
            $old = ['status' => $c->status];
            $c->forceFill(['status' => $to] + $extra)->save();

            $this->audit($c, $clerk, 'cheque_'.$to, $old, ['status' => $to] + array_filter([
                'received_by' => $extra['received_by'] ?? null,
                'cleared_on' => $extra['cleared_on'] ?? null,
                'reason' => $extra['cancel_reason'] ?? null,
            ]), $ip);

            return $c;
        });
    }

    private function ensureNumberIsFree(int $companyId, string $bank, string $number): void
    {
        $taken = Cheque::query()->where('company_id', $companyId)->where('bank_name', $bank)->where('cheque_number', $number)->exists();
        if ($taken) {
            throw $this->numberTaken();
        }
    }

    private function numberTaken(): ValidationException
    {
        return ValidationException::withMessages([
            'cheque_number' => 'This cheque number is already recorded for this bank. Check the number on the cheque.',
        ]);
    }

    private function audit(Cheque $c, ?User $by, string $action, ?array $old, array $new, ?string $ip): void
    {
        AuditTrail::record([
            'user_id' => $by?->id,
            'company_id' => $c->company_id,
            'action' => $action,
            'table_name' => 'cheques',
            'record_id' => $c->id,
            'old_values' => $old,
            'new_values' => ['voucher_number' => (string) Voucher::query()->whereKey($c->voucher_id)->value('voucher_number')] + $new,
            'ip_address' => $ip,
        ]);
    }

    /** For the daily job: an audit row "by the system". */
    public function auditStale(Cheque $c, string $was): void
    {
        $this->audit($c, null, 'cheque_stale', ['status' => $was], ['status' => 'stale'], null);
    }
}
