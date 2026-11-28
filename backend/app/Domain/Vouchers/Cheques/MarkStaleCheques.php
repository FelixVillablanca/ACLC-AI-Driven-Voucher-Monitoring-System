<?php

namespace App\Domain\Vouchers\Cheques;

use App\Models\Cheque;
use App\Models\Notification;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * The daily stale-cheque job (`php artisan cheques:mark-stale`, 01:45; user decision 2026-11-29).
 *   1. Reminder: an outstanding cheque (issued / released) that goes stale within 30 days → one bell notice to the
 *      clerk who recorded it (once per cheque, stale_warned_at).
 *   2. Stale: an outstanding cheque 180 days or more after its date → status stale (re-checked under a row lock),
 *      audit `cheque_stale` by the System, one bell notice. A replacement cheque can then be recorded.
 * Safe to run by hand any time: it never does the same step twice.
 */
class MarkStaleCheques
{
    public function __construct(private ManageCheques $cheques) {}

    /** @return array{reminded: int, marked: int} */
    public function handle(): array
    {
        $today = Carbon::today();
        $staleBefore = $today->copy()->subDays(ChequeRules::STALE_DAYS);           // cheque_date on or before = stale now
        $warnBefore = $staleBefore->copy()->addDays(ChequeRules::WARN_DAYS);       // cheque_date on or before = stale within 30 days

        $marked = 0;
        Cheque::query()->whereIn('status', ChequeRules::OUTSTANDING)->whereDate('cheque_date', '<=', $staleBefore)
            ->orderBy('id')->pluck('id')->each(function (int $id) use (&$marked, $staleBefore) {
                DB::transaction(function () use ($id, &$marked, $staleBefore) {
                    $c = Cheque::query()->lockForUpdate()->find($id);
                    if (! $c || ! in_array($c->status, ChequeRules::OUTSTANDING, true) || $c->cheque_date->gt($staleBefore)) {
                        return; // changed meanwhile (released, cleared or cancelled by a clerk)
                    }
                    $was = $c->status;
                    $c->forceFill(['status' => 'stale', 'stale_at' => now()])->save();
                    $this->cheques->auditStale($c, $was);
                    $this->notify($c, 'Cheque '.$c->cheque_number.' is now stale', sprintf(
                        'Cheque %s to %s (%s) wasn’t cleared within %d days of its date, so it was marked stale. The bank won’t pay it any more: record a replacement cheque on the voucher if the payee still needs to be paid.',
                        $c->cheque_number, $c->payee_name, $c->bank_name, ChequeRules::STALE_DAYS,
                    ));
                    $marked++;
                });
            });

        $reminded = 0;
        Cheque::query()->whereIn('status', ChequeRules::OUTSTANDING)->whereNull('stale_warned_at')
            ->whereDate('cheque_date', '>', $staleBefore)->whereDate('cheque_date', '<=', $warnBefore)
            ->orderBy('id')->get()->each(function (Cheque $c) use (&$reminded) {
                $on = ChequeRules::staleOn($c->cheque_date);
                $c->forceFill(['stale_warned_at' => now()])->save();
                $this->notify($c, 'Cheque '.$c->cheque_number.' goes stale on '.$on->format('M j'), sprintf(
                    'Cheque %s to %s (%s) hasn’t been cleared yet. It goes stale on %s. If the payee already deposited it, mark it cleared; if not, remind them.',
                    $c->cheque_number, $c->payee_name, $c->bank_name, $on->format('M j, Y'),
                ));
                $reminded++;
            });

        return ['reminded' => $reminded, 'marked' => $marked];
    }

    private function notify(Cheque $c, string $title, string $message): void
    {
        Notification::create([
            'recipient_id' => $c->created_by, 'type' => 'cheque_stale', 'title' => $title, 'message' => $message, 'voucher_id' => $c->voucher_id,
        ]);
    }
}
