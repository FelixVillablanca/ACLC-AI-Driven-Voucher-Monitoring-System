<?php

namespace App\Http\Controllers\Api\V1\Approvals;

use App\Domain\AI\Anomaly\RuleBasedAnomalyCheck;
use App\Domain\Approvals\Actions\FinalReview;
use App\Domain\Approvals\Queries\FlaggedVouchers;
use App\Domain\Approvals\Queries\Level2Flags;
use App\Domain\Approvals\Queries\OfficerReviews;
use App\Domain\Approvals\Queries\ReviewQueue;
use App\Domain\Approvals\Queries\SupervisorDashboardSummary;
use App\Domain\Approvals\Support\ApprovalRoute;
use App\Domain\Approvals\Support\ReviewOptions;
use App\Domain\Platform\SystemSettings;
use App\Domain\Vouchers\Support\VoucherPdf;
use App\Domain\Vouchers\VoucherStatus as S;
use App\Http\Controllers\Controller;
use App\Http\Requests\Approvals\ListReviewQueueRequest;
use App\Http\Requests\Approvals\ReviewDecisionRequest;
use App\Http\Resources\Approvals\QueueVoucherResource;
use App\Http\Resources\Vouchers\VoucherResource;
use App\Models\Voucher;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * The Supervisor / Manager's Level 2 (2026-11-27; Framer RRXP4iCfd queue, Nl0dfYkY_ final review, WQL6Ca1ML approve,
 * PlbU6CVEj return, tW_30cpOE reject, WAk4RKdFc cleared). Company = X-Company-ID (role:supervisor_manager + company).
 *   GET  /supervisor/summary                   sidebar + cleared-state numbers
 *   GET  /supervisor/queue                     under_review vouchers (views all | ai_flagged | high_value)
 *   GET  /supervisor/vouchers/{id}             one voucher + the Level 2 review block
 *   POST /supervisor/vouchers/{id}/approve     final approval (flagged → remarks required)
 *   POST /supervisor/vouchers/{id}/return      send_to clerk | accounting + needs_changes + remarks
 *   POST /supervisor/vouchers/{id}/reject      reason + remarks
 *   POST /supervisor/vouchers/bulk-approve     ids (no flagged), all or nothing
 *   GET  /supervisor/reviews                   Decision history (your Level 2 decisions)
 *   GET  /supervisor/flagged                   flagged vouchers at Level 2 + stats (Framer ESBUdF0jl)
 *   GET  /supervisor/vouchers/{id}/investigation  signals, chart data, past payments to the payee (Framer lFqUUsfzi)
 * Another company's voucher, or a draft, = 404.
 */
class SupervisorReviewController extends Controller
{
    public function __construct(private ApprovalRoute $route) {}

    public function summary(Request $request): JsonResponse
    {
        $queue = $this->queue($request);

        return response()->json(['data' => [
            'queue' => [
                'total' => $queue->base()->count(),
                'ai_flagged' => $queue->base()->where('ai_anomaly_flag', true)->count(),
                'total_amount' => (string) $queue->base()->toBase()->selectRaw('COALESCE(SUM(amount), 0) as t')->value('t'),
            ],
            'today' => $this->mine($request)->today(),
            'threshold' => $this->route->threshold(),
        ]]);
    }

    /** GET /supervisor/dashboard: the landing page (Framer YKfX_oJ3a), one request for the whole page. */
    public function dashboard(Request $request): JsonResponse
    {
        $s = new SupervisorDashboardSummary($request->user(), $request->attributes->get('company'), $this->route);

        return response()->json(['data' => [
            'company' => $request->attributes->get('company')->name,
            'queue' => $s->queue(),
            'released' => $s->released(),
            'budget' => $s->budget(),
            'top' => QueueVoucherResource::collection($s->top())->resolve($request),
            'pipeline' => $s->pipeline(),
            'alert' => $s->alert(),
        ]]);
    }

    public function options(Request $request): JsonResponse
    {
        return response()->json(['data' => [
            'needs_changes' => collect(ReviewOptions::NEEDS_CHANGES)->map(fn ($label, $key) => ['key' => $key, 'label' => $label])->values(),
            'reject_reasons' => collect(ReviewOptions::REJECT_REASONS)->map(fn ($label, $key) => ['key' => $key, 'label' => $label])->values(),
            'high_value_threshold' => $this->route->threshold(),
        ]]);
    }

    public function index(ListReviewQueueRequest $request): AnonymousResourceCollection
    {
        $queue = $this->queue($request);
        $filters = $request->filters();
        $page = $queue->list($filters)->paginate(20)->withQueryString();

        return QueueVoucherResource::collection($page)->additional(['meta' => [
            'counts' => $queue->counts($filters),
            'total_amount' => $queue->totalAmount($filters),
            'threshold' => $this->route->threshold(),
        ]]);
    }

    public function show(Request $request, int $voucher): JsonResponse
    {
        $v = $this->find($request, $voucher);
        $queue = $this->queue($request);
        $waiting = $v->status === S::UnderReview->value;
        $mine = (int) $v->created_by === (int) $request->user()->id;
        $level1 = DB::table('voucher_approvals as a')->leftJoin('users as u', 'u.id', '=', 'a.approver_id')
            ->where('a.voucher_id', $v->id)->where('a.step', 1)->where('a.action', 'approved')->orderByDesc('a.id')
            ->first(['a.created_at', 'a.remarks', 'u.first_name', 'u.last_name']);
        $clerk = DB::table('users')->where('id', $v->created_by)->first(['first_name', 'last_name']);

        $data = VoucherResource::make($v)->detailed()->toArray($request);
        unset($data['can'], $data['completeness'], $data['expires_at'], $data['can_delete']);

        return response()->json(['data' => $data + [
            'clerk' => $clerk ? ['name' => trim("{$clerk->first_name} {$clerk->last_name}")] : null,
            'ai' => [
                'flagged' => (bool) $v->ai_anomaly_flag,
                'score' => $v->ai_anomaly_score !== null ? (string) $v->ai_anomaly_score : null,
                'reason' => $v->ai_anomaly_reason,
                'source' => $v->ai_check_source,
                'finding' => $v->ai_review_finding,
            ],
            'review' => [
                'can_act' => $waiting && ! $mine,
                'own_voucher' => $mine,
                'step2_reasons' => $this->route->step2Reasons($v),
                'level1' => $level1 ? [
                    'by' => trim("{$level1->first_name} {$level1->last_name}"),
                    'at' => Carbon::parse($level1->created_at)->toIso8601String(),
                    'remarks' => $level1->remarks,
                ] : null,
                'similar' => $queue->similar($v),
                'budget' => $queue->budget($v),
                'position' => $waiting ? $queue->position($v->id) : null,
            ],
        ]]);
    }

    public function pdf(Request $request, int $voucher): Response
    {
        $v = $this->find($request, $voucher);

        return response(VoucherPdf::render($v), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.VoucherPdf::fileName($v).'"',
            'Cache-Control' => 'no-store',
        ]);
    }

    public function approve(ReviewDecisionRequest $request, int $voucher, FinalReview $review): JsonResponse
    {
        $v = $review->approve($voucher, $request->user(), $request->attributes->get('company'), $request->validated('remarks'), $request->ip());

        return response()->json(['data' => $this->decided($v, $request)]);
    }

    public function returnVoucher(ReviewDecisionRequest $request, int $voucher, FinalReview $review): JsonResponse
    {
        $v = $review->returnVoucher($voucher, $request->user(), $request->attributes->get('company'), $request->validated('send_to'),
            $request->validated('needs_changes'), $request->validated('remarks'), $request->ip());

        return response()->json(['data' => $this->decided($v, $request) + ['sent_to' => $request->validated('send_to')]]);
    }

    public function reject(ReviewDecisionRequest $request, int $voucher, FinalReview $review): JsonResponse
    {
        $v = $review->reject($voucher, $request->user(), $request->attributes->get('company'), $request->validated('reason'), $request->validated('remarks'), $request->ip());

        return response()->json(['data' => $this->decided($v, $request)]);
    }

    public function bulkApprove(Request $request, FinalReview $review): JsonResponse
    {
        $data = $request->validate([
            'ids' => ['required', 'array', 'min:1', 'max:50'],
            'ids.*' => ['integer', 'distinct'],
        ], ['ids.max' => 'Approve at most 50 vouchers at once.']);
        $vouchers = $review->approveMany(array_map('intval', $data['ids']), $request->user(), $request->attributes->get('company'), $request->ip());

        return response()->json(['data' => [
            'approved' => count($vouchers),
            'vouchers' => array_map(fn ($v) => ['id' => $v->id, 'voucher_number' => $v->voucher_number], $vouchers),
        ]]);
    }

    public function reviews(Request $request): JsonResponse
    {
        $request->validate([
            'filter' => ['sometimes', 'array'],
            'filter.action' => ['sometimes', 'nullable', 'in:'.implode(',', OfficerReviews::ACTIONS)],
            'page' => ['sometimes', 'integer', 'min:1'],
        ]);
        $mine = $this->mine($request);
        $page = $mine->query($request->input('filter.action'))->addSelect(['a.step'])->paginate(20)->withQueryString();

        return response()->json([
            'data' => collect($page->items())->map(fn ($r) => [
                'id' => $r->id,
                'action' => $r->action,
                'step' => (int) $r->step,
                'sent_to' => $r->action === 'returned' ? ($r->reason === 'to_accounting' ? 'accounting' : 'clerk') : null,
                'remarks' => $r->remarks,
                'needs_changes' => ReviewOptions::labels($r->needs_changes ? json_decode($r->needs_changes, true) : null),
                'reason' => $r->action === 'rejected' && $r->reason ? (ReviewOptions::REJECT_REASONS[$r->reason] ?? $r->reason) : null,
                'at' => Carbon::parse($r->created_at)->toIso8601String(),
                'voucher' => [
                    'id' => $r->voucher_id, 'voucher_number' => $r->voucher_number, 'payee_name' => $r->payee_name,
                    'amount' => (string) $r->amount, 'status' => $r->status,
                ],
                'clerk' => trim(($r->clerk_first ?? '').' '.($r->clerk_last ?? '')) ?: null,
            ])->all(),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total(),
                'from' => $page->firstItem(), 'to' => $page->lastItem(), 'today' => $mine->today()],
        ]);
    }

    /** GET /supervisor/flagged?sort=score|oldest|amount_desc&page= : flagged vouchers waiting for Level 2 + stats. */
    public function flagged(Request $request): JsonResponse
    {
        $request->validate([
            'sort' => ['sometimes', 'nullable', 'in:'.implode(',', Level2Flags::SORTS)],
            'page' => ['sometimes', 'integer', 'min:1'],
        ]);
        $flags = new Level2Flags($request->user(), $request->attributes->get('company'), $this->route);
        $inv = $this->investigator($request);
        $page = $flags->list($request->input('sort'))->paginate(20)->withQueryString();

        return response()->json([
            'data' => collect($page->items())->map(fn (Voucher $v) => QueueVoucherResource::make($v)->resolve($request) + [
                'summary' => Str::limit((string) ($v->description ?: $v->purpose), 80) ?: null,
                'tags' => $inv->tags($v->ai_check_signals ?? []),
            ])->all(),
            'meta' => [
                'current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total(),
                'from' => $page->firstItem(), 'to' => $page->lastItem(),
                'stats' => $flags->stats(), 'threshold' => app(RuleBasedAnomalyCheck::class)->threshold(),
            ],
        ]);
    }

    /** GET /supervisor/vouchers/{id}/investigation: the stored signals, the 6-month series and past payments to the payee. */
    public function investigation(Request $request, int $voucher): JsonResponse
    {
        $v = $this->find($request, $voucher);
        $flags = new Level2Flags($request->user(), $request->attributes->get('company'), $this->route);

        return response()->json(['data' => $this->investigator($request)->investigation($v) + [
            'score' => $v->ai_anomaly_score !== null ? (string) $v->ai_anomaly_score : null,
            'flagged' => (bool) $v->ai_anomaly_flag,
            'checked' => $v->ai_checked_at !== null,
            'source' => $v->ai_check_source,
            'threshold' => app(RuleBasedAnomalyCheck::class)->threshold(),
            'finding' => $v->ai_review_finding,
            'past_payments' => $flags->pastPayments($v),
        ]]);
    }

    private function investigator(Request $request): FlaggedVouchers
    {
        return new FlaggedVouchers($request->attributes->get('company'), app(RuleBasedAnomalyCheck::class), app(SystemSettings::class));
    }

    private function decided(Voucher $v, Request $request): array
    {
        return ['id' => $v->id, 'voucher_number' => $v->voucher_number, 'status' => $v->status, 'next_id' => $this->queue($request)->nextId()];
    }

    /** A voucher of this company that has been submitted at least once (drafts stay private to the clerk). */
    private function find(Request $request, int $id): Voucher
    {
        return Voucher::query()->where('company_id', $request->attributes->get('company')->id)
            ->whereNot('status', S::Draft->value)->findOrFail($id);
    }

    private function queue(Request $request): ReviewQueue
    {
        return new ReviewQueue($request->user(), $request->attributes->get('company'), $this->route, step: 2);
    }

    private function mine(Request $request): OfficerReviews
    {
        return new OfficerReviews($request->user(), $request->attributes->get('company'));
    }
}
