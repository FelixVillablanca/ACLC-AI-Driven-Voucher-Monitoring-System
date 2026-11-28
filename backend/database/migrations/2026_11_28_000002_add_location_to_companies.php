<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Company map pin (user decision 2026-11-28): "+ Add company" now has a map (OpenStreetMap + Leaflet,
 * chosen over Google Maps the same day: no card or key needed) where the Super Admin searches for the place, clicks
 * the map or drags the pin, and typing a full address moves the pin by itself.
 *  - latitude / longitude: DECIMAL(10,7) = about 1 cm precision; both set or both NULL (checked in StoreCompanyRequest)
 *  - place_id: the OpenStreetMap place picked from the search ("way/123456"), when there is one (a hand-placed pin has none)
 * All optional: a company may still have only a text address, or none.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('companies', function (Blueprint $t) {
            $t->decimal('latitude', 10, 7)->nullable()->after('address');
            $t->decimal('longitude', 10, 7)->nullable()->after('latitude');
            $t->string('place_id', 255)->nullable()->after('longitude')->comment('OpenStreetMap place of the pin, e.g. way/123456');
        });
    }

    public function down(): void
    {
        Schema::table('companies', function (Blueprint $t) {
            $t->dropColumn(['latitude', 'longitude', 'place_id']);
        });
    }
};
