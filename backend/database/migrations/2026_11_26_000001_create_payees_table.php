<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Payees (Framer jbj8yIDz9 / GZb92vr4M / UKm7GrwEZ), approved by the user 2026-11-26.
 * A company's saved list of people and businesses it pays. Clerks add and edit them (audited).
 *  - names are unique per company (the collation ignores letter case); a TIN too, when given (NULLs may repeat)
 *  - vouchers.payee_id (optional) links a voucher to a saved payee; payee_name stays as the name printed on it
 *  - existing vouchers: one payee is made per distinct payee name per company (type, payment and bank details
 *    from that name's most recent voucher, "added by" = whoever first used the name) and the vouchers are linked
 * Deleting a payee type clears it on payees (nullOnDelete); deleting a payee keeps its vouchers (nullOnDelete).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payees', function (Blueprint $t) {
            $t->id();
            $t->foreignId('company_id')->constrained('companies');
            $t->string('name', 255);
            $t->foreignId('payee_type_id')->nullable()->constrained('payee_types')->nullOnDelete();
            $t->string('tin', 20)->nullable()->comment('Philippine TIN, stored as 000-000-000-000');
            $t->enum('default_payment_method', ['cash', 'bank', 'cheque'])->nullable();
            $t->string('bank_name', 150)->nullable();
            $t->string('bank_account_number', 50)->nullable();
            $t->string('bank_account_name', 150)->nullable();
            $t->string('address', 500)->nullable();
            $t->string('email', 255)->nullable();
            $t->boolean('is_active')->default(true);
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamp('deactivated_at')->nullable();
            $t->timestamps();

            $t->unique(['company_id', 'name']);
            $t->unique(['company_id', 'tin']);
            $t->index(['company_id', 'is_active']);
        });

        Schema::table('vouchers', function (Blueprint $t) {
            $t->foreignId('payee_id')->nullable()->after('payee_name')->constrained('payees')->nullOnDelete();
        });

        $this->linkExistingVouchers();
    }

    public function down(): void
    {
        Schema::table('vouchers', function (Blueprint $t) {
            $t->dropConstrainedForeignId('payee_id');
        });
        Schema::dropIfExists('payees');
    }

    private function linkExistingVouchers(): void
    {
        $rows = DB::table('vouchers')->whereNotNull('company_id')->whereNotNull('payee_name')->where('payee_name', '!=', '')
            ->orderBy('id')->get(['id', 'company_id', 'created_by', 'payee_name', 'payee_type_id', 'payment_method', 'bank_name', 'bank_account_number', 'bank_account_name', 'created_at']);

        // group by company + name ignoring case and outer spaces (the unique index ignores case too)
        $groups = $rows->groupBy(fn ($v) => $v->company_id.'|'.mb_strtolower(trim($v->payee_name)));

        foreach ($groups as $vouchers) {
            $first = $vouchers->first();
            $latest = $vouchers->last();
            $id = DB::table('payees')->insertGetId([
                'company_id' => $first->company_id,
                'name' => mb_substr(trim($latest->payee_name), 0, 255),
                'payee_type_id' => $vouchers->reverse()->firstWhere('payee_type_id', '!=', null)?->payee_type_id,
                'default_payment_method' => $latest->payment_method,
                'bank_name' => $latest->payment_method === 'bank' ? mb_substr((string) $latest->bank_name, 0, 150) ?: null : null,
                'bank_account_number' => $latest->payment_method === 'bank' ? mb_substr((string) $latest->bank_account_number, 0, 50) ?: null : null,
                'bank_account_name' => $latest->payment_method === 'bank' ? mb_substr((string) $latest->bank_account_name, 0, 150) ?: null : null,
                'is_active' => true,
                'created_by' => $first->created_by,
                'created_at' => $first->created_at ?? now(),
                'updated_at' => now(),
            ]);
            DB::table('vouchers')->whereIn('id', $vouchers->pluck('id'))->update(['payee_id' => $id]);
        }
    }
};
