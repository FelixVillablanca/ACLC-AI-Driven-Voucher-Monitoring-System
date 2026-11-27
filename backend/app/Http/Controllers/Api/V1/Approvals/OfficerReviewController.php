<?php

namespace App\Http\Controllers\Api\V1\Approvals;

use App\Domain\AI\Anomaly\RuleBasedAnomalyCheck;
use App\Domain\Approvals\Actions\ReviewVoucher;
use App\Domain\Approvals\Queries\FlaggedVouchers;
use App\Domain\Approvals\Queries\OfficerReviews;
use App\Domain\Approvals\Queries\ReviewQueue;
use App\Domain\Approvals\Support\ApprovalRoute;
use App\Domain\Approvals\Support\ReviewOptions;
use App\Domain\Budgets\Queries\BudgetBoard;
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

/**
 * The Accounting Officer's review (Phase 4, Framer vZeEe5_Hq … Ssn7fclsz), 2026-11-26.
 * Always the company in X-Company-ID (role:accounting_officer + company).
 *   GET  /officer/summary                 sidebar counts, today's reviews, last review, SLA hours
 *   GET  /officer/review-options          departments (filter), needs-changes tags, reject reasons, rules
 *   GET  /officer/queue                   the queue (+ meta.counts per tab, meta.total_amount)
 *   GET  /officer/queue/next              { id } of the first voucher to review ("Review next")
 *   GET  /officer/vouchers/{id}           one voucher (not drafts) + review block (route, SLA, similar, budget, position)
 *   GET  /officer/vouchers/{id}/pdf       the printable voucher
 *   POST /officer/vouchers/{id}/approve | return | reject
 *   POST /officer/vouchers/bulk-approve   { ids: [...] } all or nothing, no AI-flagged
 *   GET  /officer/reviews?filter[action]= "Reviewed by me"
 */
class OfficerReviewController extends Controller
{
    public function __construct(private ApprovalRoute $route) {}

    public function summary(Request $request): JsonResponse
    {
        $queue = $this->queue($request);

        return response()->json(['data' => [
            'queue' => [
                'total' => $queue->base()->count(),
                'ai_flagged' => $queue->base()->where('ai_anomaly_flag', true)->count(),
                'near_sla' => $queue->base()->where('submitted_at', '<=', $this->route->nearSlaSince())->count(),
                'total_amount' => (string) $queue->base()->toBase()->selectRaw('COALESCE(SUM(amount), 0) as t')->value('t'),
            ],
            'today' => $this->mine($request)->today(),
            'sla_hours' => $this->route->slaHours(),
            'budget_alerts' => (new BudgetBoard($request->attributes->get('company'), $request->user()))->alertCount(),
        ]]);
    }

    public function options(Request $request): JsonResponse
    {
        $company = $request->attributes->get('company');

        return response()->json(['data' => [
            'departments' => DB::table('departments')->where('company_id', $company->id)->orderBy('name')->get(['id', 'name']),
            'needs_changes' => collect(ReviewOptions::NEEDS_CHANGES)->map(fn ($label, $key) => ['key' => $key, 'label' => $label])->values(),
            'reject_reasons' => collect(ReviewOptions::REJECT_REASONS)->map(fn ($label, $key) => ['key' => $key, 'label' => $label])->values(),
            'high_value_threshold' => $this->route->threshold(),
            'ai_flagged_needs_step2' => $this->route->aiFlaggedNeedsStep2(),
            'sla_hours' => $this->route->slaHours(),
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
            'sla_hours' => $this->route->slaHours(),
        ]]);
    }

    public function next(Request $request): JsonResponse
    {
        return response()->json(['data' => ['id' => $this->queue($request)->nextId()]]);
    }

    public function show(Request $request, int $voucher): JsonResponse
    {
        $v = $this->find($request, $voucher);
        $queue = $this->queue($request);
        $company = $request->attributes->get('company');
        $clerk = DB::table('users')->where('id', $v->created_by)->first(['first_name', 'last_name', 'email']);
        $pending = $v->status === S::Pending->value;
        $reasons = $this->route->step2Reasons($v);

        $data = VoucherResource::make($v)->detailed()->toArray($request);
        unset($data['can'], $data['completeness'], $data['expires_at'], $data['can_delete']);

        return response()->json(['data' => $data + [
            'clerk' => $clerk ? ['name' => trim("{$clerk->first_name} {$clerk->last_name}"), 'email' => $clerk->email] : null,
            'ai' => [
                'flagged' => (bool) $v->ai_anomaly_flag,
                'score' => $v->ai_anomaly_score !== null ? (string) $v->ai_anomaly_score : null,
                'reason' => $v->ai_anomaly_reason,
                'source' => $v->ai_check_source,
                'finding' => $v->ai_review_finding,
            ],
            'review' => [
                'can_act' => $pending && (int) $v->created_by !== (int) $request->user()->id,
                'own_voucher' => (int) $v->created_by === (int) $request->user()->id,
                'step2_reasons' => $reasons,
                'supervisors' => $reasons ? ApprovalRoute::supervisorsOf($company)->map(fn ($s) => $s->full_name)->values() : [],
                'sla' => ['hours' => $this->route->slaHours(), 'state' => $pending ? $this->route->slaState($v->submitted_at) : 'ok'],
                'similar' => $queue->similar($v),
                'budget' => $queue->budget($v),
                'position' => $pending ? $queue->position($v->id) : null,
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

    public function approve(ReviewDecisionRequest $request, int $voucher, ReviewVoucher $review): JsonResponse
    {
        $r = $review->approve($voucher, $request->user(), $request->attributes->get('company'), $request->validated('remarks'), $request->ip(), $request->validated('ai_finding'));

        return response()->json(['data' => $this->decided($r['voucher'], $request) + ['forwarded' => $r['forwarded'], 'supervisors' => $r['supervisors']]]);
    }

    public function returnToClerk(ReviewDecisionRequest $request, int $voucher, ReviewVoucher $review): JsonResponse
    {
        $v = $review->returnToClerk($voucher, $request->user(), $request->attributes->get('company'),
            $request->validated('needs_changes'), $request->validated('remarks'), $request->ip(), $request->validated('ai_finding'));

        return response()->json(['data' => $this->decided($v, $request)]);
    }

    public function reject(ReviewDecisionRequest $request, int $voucher, ReviewVoucher $review): JsonResponse
    {
        $v = $review->reject($voucher, $request->user(), $request->attributes->get('company'),
            $request->validated('reason'), $request->validated('remarks'), $request->ip());

        return response()->json(['data' => $this->decided($v, $request)]);
    }

    public function bulkApprove(Request $request, ReviewVoucher $review): JsonResponse
    {
        $data = $request->validate([
            'ids' => ['required', 'array', 'min:1', 'max:50'],
            'ids.*' => ['integer', 'distinct'],
        ], ['ids.max' => 'Approve at most 50 vouchers at once.']);

        $results = $review->approveMany(array_map('intval', $data['ids']), $request->user(), $request->attributes->get('company'), $request->ip());

        return response()->json(['data' => [
            'approved' => count(array_filter($results, fn ($r) => ! $r['forwarded'])),
            'forwarded' => count(array_filter($results, fn ($r) => $r['forwarded'])),
            'vouchers' => array_map(fn ($r) => ['id' => $r['voucher']->id, 'voucher_number' => $r['voucher']->voucher_number, 'forwarded' => $r['forwarded']], $results),
        ]]);
    }

    public function reviews(Request $request): JsonResponse
    {
        $data = $request->validate([
            'filter' => ['sometimes', 'array'],
            'filter.action' => ['sometimes', 'nullable', 'in:'.implode(',', OfficerReviews::ACTIONS)],
            'page' => ['sometimes', 'integer', 'min:1'],
        ]);
        $mine = $this->mine($request);
        $page = $mine->query($data['filter']['action'] ?? null)->paginate(20)->withQueryString();

        return response()->json([
            'data' => collect($page->items())->map(fn ($r) => [
                'id' => $r->id,
                'action' => $r->action,
                'remarks' => $r->remarks,
                'needs_changes' => ReviewOptions::labels($r->needs_changes ? json_decode($r->needs_changes, true) : null),
                'reason' => $r->reason ? (ReviewOptions::REJECT_REASONS[$r->reason] ?? $r->reason) : null,
                'at' => Carbon::parse($r->created_at)->toIso8601String(),
                'voucher' => [
                    'id' => $r->voucher_id, 'voucher_number' => $r->voucher_number, 'payee_name' => $r->payee_name,
                    'amount' => (string) $r->amount, 'status' => $r->status,
                    'clerk' => trim("{$r->clerk_first} {$r->clerk_last}") ?: null,
                ],
            ])->all(),
            'meta' => [
                'current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total(),
                'from' => $page->firstItem(), 'to' => $page->lastItem(), 'today' => $mine->today(),
            ],
        ]);
    }

    /** GET /officer/flagged: flagged vouchers nobody has looked into yet, highest score first, + this month's stats. */
    public function flagged(Request $request): JsonResponse
    {
        $flags = $this->flags($request);
        $page = $flags->list()->paginate(20)->withQueryString();

        return response()->json([
            'data' => collect($page->items())->map(fn (Voucher $v) => [
                'id' => $v->id,
                'voucher_number' => $v->voucher_number,
                'payee_name' => $v->payee_name,
                'amount' => (string) $v->amount,
                'category' => $v->category?->name,
                'department' => $v->department_name,
                'clerk' => $v->clerk_first ? $v->clerk_first.($v->clerk_last ? ' '.mb_substr($v->clerk_last, 0, 1).'.' : '') : null,
                'submitted_at' => $v->submitted_at?->toIso8601String(),
                'score' => (string) $v->ai_anomaly_score,
                'reason' => $v->ai_anomaly_reason,
                'source' => $v->ai_check_source,
                'tags' => $flags->tags($v->ai_check_signals ?? []),
            ])->all(),
            'meta' => [
                'current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total(),
                'from' => $page->firstItem(), 'to' => $page->lastItem(), 'stats' => $flags->stats(),
            ],
        ]);
    }

    /** GET /officer/vouchers/{id}/investigation: chart, signals, plain summary (frame YX1IiDXMp). */
    public function investigation(Request $request, int $voucher): JsonResponse
    {
        $v = $this->find($request, $voucher);

        return response()->json(['data' => $this->flags($request)->investigation($v) + [
            'score' => $v->ai_anomaly_score !== null ? (string) $v->ai_anomaly_score : null,
            'flagged' => (bool) $v->ai_anomaly_flag,
            'checked' => $v->ai_checked_at !== null,
            'source' => $v->ai_check_source,
            'threshold' => app(RuleBasedAnomalyCheck::class)->threshold(),
            'finding' => $v->ai_review_finding,
        ]]);
    }

    /** POST /officer/vouchers/{id}/normal: "False alarm" / "Mark as normal". */
    public function markNormal(ReviewDecisionRequest $request, int $voucher, ReviewVoucher $review): JsonResponse
    {
        $v = $review->markNormal($voucher, $request->user(), $request->attributes->get('company'), $request->validated('note'), $request->ip());

        return response()->json(['data' => ['id' => $v->id, 'voucher_number' => $v->voucher_number, 'status' => $v->status,
            'next_flagged_id' => $this->flags($request)->list()->value('id')]]);
    }

    private function flags(Request $request): FlaggedVouchers
    {
        return new FlaggedVouchers($request->attributes->get('company'), app(RuleBasedAnomalyCheck::class), app(SystemSettings::class));
    }

    /** The voucher after a decision, for the screen (status, number, next one to review). */
    private function decided(Voucher $v, Request $request): array
    {
        return ['id' => $v->id, 'voucher_number' => $v->voucher_number, 'status' => $v->status, 'next_id' => $this->queue($request)->nextId()];
    }

    /** A voucher of this company that has been submitted at least once (drafts stay private to the clerk). */
    private function find(Request $request, int $id): Voucher
    {
        return Voucher::query()->where('company_id', $request->attributes->get('company')->id)
            ->where('status', '!=', S::Draft->value)
            ->with(['category:id,name', 'latestReturn.approver:id,first_name,last_name'])->findOrFail($id);
    }

    private function queue(Request $request): ReviewQueue
    {
        return new ReviewQueue($request->user(), $request->attributes->get('company'), $this->route);
    }

    private function mine(Request $request): OfficerReviews
    {
        return new OfficerReviews($request->user(), $request->attributes->get('company'));
    }
}
