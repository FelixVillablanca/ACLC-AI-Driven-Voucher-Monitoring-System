<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Domain\Catalog\Actions\ManageCatalogItem;
use App\Domain\Catalog\Support\CatalogKind;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SaveCatalogItemRequest;
use App\Http\Resources\Admin\CatalogItemResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * Configuration → Categories (code-first 2026-11-22): ONE page with 3 lists, all for the Admin's company.
 *   GET    /admin/catalog                                  all 3 lists (small lists, no pages)
 *   POST   /admin/catalog/{kind}                           add       kind = categories|voucher_types|payee_types
 *   PATCH  /admin/catalog/{kind}/{id}                      edit
 *   DELETE /admin/catalog/{kind}/{id}                      delete (only when no voucher uses it)
 *   POST   /admin/catalog/categories/{id}/deactivate|reactivate
 * Another company's item, or a built-in category, = 404.
 */
class CatalogController extends Controller
{
    public function __construct(private ManageCatalogItem $manage) {}

    public function index(Request $request): JsonResponse
    {
        $companyId = (int) ($request->user()->company_id ?? 0);

        $lists = collect(CatalogKind::KINDS)->mapWithKeys(fn (string $kind) => [
            $kind => CatalogItemResource::collection((new CatalogKind($kind))->listFor($companyId)->limit(500)->get()),
        ]);

        return response()->json(['data' => $lists]);
    }

    public function store(SaveCatalogItemRequest $request, string $kind): JsonResponse
    {
        $item = $this->manage->create(new CatalogKind($kind), $request->validated(), $request->user(), $request->ip());

        return CatalogItemResource::make($item)->response()->setStatusCode(201);
    }

    public function update(SaveCatalogItemRequest $request, string $kind, int $id): CatalogItemResource
    {
        $result = $this->manage->update(new CatalogKind($kind), $id, $request->validated(), $request->validated('updated_at'), $request->user(), $request->ip());

        return CatalogItemResource::make($result['item'])->additional(['meta' => ['changed' => $result['changed']]]);
    }

    public function destroy(Request $request, string $kind, int $id): Response
    {
        $this->manage->delete(new CatalogKind($kind), $id, $request->user(), $request->ip());

        return response()->noContent();
    }

    public function deactivate(Request $request, int $id): CatalogItemResource
    {
        return CatalogItemResource::make($this->manage->setActive(new CatalogKind('categories'), $id, false, $request->user(), $request->ip()));
    }

    public function reactivate(Request $request, int $id): CatalogItemResource
    {
        return CatalogItemResource::make($this->manage->setActive(new CatalogKind('categories'), $id, true, $request->user(), $request->ip()));
    }
}
