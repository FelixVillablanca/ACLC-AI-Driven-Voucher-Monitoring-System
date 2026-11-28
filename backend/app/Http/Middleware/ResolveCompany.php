<?php

namespace App\Http\Middleware;

use App\Exceptions\ApiException;
use App\Models\Company;
use App\Support\LiveCounts;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * TENANCY GUARD for clerk / officer / supervisor routes (Engineering Plan "Tenancy").
 * The browser says which company it's working in with the X-Company-ID header
 * (useCompanyStore → apiClient). We never just trust it:
 *   - missing / not a number                 → 400 COMPANY_REQUIRED
 *   - no ACCEPTED access to that company     → 403 COMPANY_ACCESS_DENIED
 *   - the company is suspended or inactive   → 403 COMPANY_SUSPENDED
 * When it passes, the company is stored on the request (`$request->attributes->get('company')`)
 * and everything after it uses that company only.
 */
class ResolveCompany
{
    public function handle(Request $request, Closure $next): Response
    {
        $header = $request->header('X-Company-ID');

        if (! is_string($header) || ! ctype_digit($header)) {
            throw new ApiException('Choose the company you want to work in first.', 'COMPANY_REQUIRED', 400);
        }

        $company = $request->user()?->accessibleCompanies()
            ->wherePivot('granted_status', 'accepted')
            ->where('companies.id', (int) $header)
            ->first();

        if (! $company instanceof Company) {
            throw new ApiException("You don't have access to this company. Switch to a company you work in.", 'COMPANY_ACCESS_DENIED', 403);
        }
        if (! $company->is_active || $company->isSuspended()) {
            throw new ApiException("{$company->name} is suspended, so you can't work in it right now.", 'COMPANY_SUSPENDED', 403);
        }

        $request->attributes->set('company', $company);

        $response = $next($request);

        // A successful change in this company (submit, approve, budget, report…) = the cached sidebar / dashboard
        // numbers of everyone in it are out of date (LiveCounts, Phase 7 Step 2).
        if (! $request->isMethodSafe() && $response->isSuccessful()) {
            LiveCounts::companyChanged($company->id);
        }

        return $response;
    }
}
