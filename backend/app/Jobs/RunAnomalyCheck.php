<?php

namespace App\Jobs;

use App\Domain\AI\Anomaly\RuleBasedAnomalyCheck;
use App\Domain\Vouchers\VoucherStatus as S;
use App\Models\Notification;
use App\Models\User;
use App\Models\Voucher;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;

/**
 * The automatic check after a voucher is submitted (or resubmitted), in the background so Submit stays fast.
 * Writes the score, the reason, the signals and the source ('rules' until Phase 5) without touching
 * updated_at. Only while the voucher still waits for Accounting (`pending`). A newly flagged voucher
 * notifies the company's Accounting Officers (bell, type anomaly_flagged).
 */
class RunAnomalyCheck implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public array $backoff = [30, 120];

    public function __construct(public int $voucherId) {}

    public function handle(RuleBasedAnomalyCheck $check): void
    {
        $voucher = Voucher::find($this->voucherId);
        if (! $voucher || $voucher->status !== S::Pending->value) {
            return;
        }

        $result = $check->check($voucher);
        $signals = array_map(fn ($s) => array_diff_key($s, ['weight' => true, 'reason' => true]), $result['signals']);

        DB::table('vouchers')->where('id', $voucher->id)->where('status', S::Pending->value)->update([
            'ai_anomaly_flag' => $result['flagged'] ? 1 : 0,
            'ai_anomaly_score' => $result['score'],
            'ai_anomaly_reason' => $result['flagged'] ? $result['reason'] : null,
            'ai_check_signals' => json_encode($signals),
            'ai_check_source' => 'rules',
            'ai_checked_at' => now(),
        ]);

        if ($result['flagged']) {
            User::query()->where('role', 'accounting_officer')->where('is_active', true)
                ->whereHas('accessibleCompanies', fn ($q) => $q->where('companies.id', $voucher->company_id)->where('user_company_access.granted_status', 'accepted'))
                ->pluck('id')
                ->each(fn (int $id) => Notification::create([
                    'recipient_id' => $id,
                    'type' => 'anomaly_flagged',
                    'title' => "Flagged: {$voucher->voucher_number} needs a close look",
                    'message' => "Automatic check (score {$result['score']}): {$result['reason']}",
                    'voucher_id' => $voucher->id,
                ]));
        }
    }
}
