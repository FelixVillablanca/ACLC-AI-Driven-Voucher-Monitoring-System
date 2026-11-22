<?php

namespace App\Support\Exports;

use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

/**
 * Turns a table (headers + rows) into a downloadable CSV or Excel file.
 * Shared by every "Export" button (Admins A1, Companies C1, …): one place for the safety rules.
 *
 * "CSV / formula injection": a cell that starts with = + - @ can run as a formula when the file is
 * opened in Excel. Text cells are therefore written as plain TEXT (xlsx) or prefixed with ' (csv).
 */
class TabularExport
{
    /** @param  array<int, string>  $headers  @param  array<int, array<int, mixed>>  $rows */
    public function csv(array $headers, array $rows): string
    {
        $out = fopen('php://temp', 'r+');
        fwrite($out, "\xEF\xBB\xBF"); // so Excel reads ñ, é … correctly (UTF-8 marker)
        fputcsv($out, $headers);
        foreach ($rows as $row) {
            fputcsv($out, array_map(fn ($v) => is_string($v) && preg_match('/^[=+\-@]/', $v) ? "'".$v : $v, $row));
        }
        rewind($out);

        return stream_get_contents($out);
    }

    /**
     * An .xlsx file with one sheet: bold header row, frozen at the top, columns sized to fit.
     * Numbers stay numbers (so they can be summed); everything else is stored as text.
     *
     * @param  array<int, string>  $headers  @param  array<int, array<int, mixed>>  $rows
     */
    public function xlsx(string $sheetTitle, array $headers, array $rows): string
    {
        $book = new Spreadsheet;
        $sheet = $book->getActiveSheet();
        // Sheet names: max 31 characters, and none of : \ / ? * [ ]
        $sheet->setTitle(mb_substr(preg_replace('/[:\\\\\/?*\[\]]/', ' ', $sheetTitle), 0, 31));

        foreach ([$headers, ...$rows] as $r => $row) {
            foreach (array_values($row) as $c => $value) {
                $cell = Coordinate::stringFromColumnIndex($c + 1).($r + 1);
                if (is_int($value) || is_float($value)) {
                    $sheet->setCellValueExplicit($cell, $value, DataType::TYPE_NUMERIC);
                } else {
                    $sheet->setCellValueExplicit($cell, (string) $value, DataType::TYPE_STRING);
                }
            }
        }

        $last = Coordinate::stringFromColumnIndex(max(count($headers), 1));
        $sheet->getStyle("A1:{$last}1")->getFont()->setBold(true);
        $sheet->freezePane('A2');
        foreach (range(1, max(count($headers), 1)) as $c) {
            $sheet->getColumnDimension(Coordinate::stringFromColumnIndex($c))->setAutoSize(true);
        }

        $path = tempnam(sys_get_temp_dir(), 'xlsx');
        try {
            (new Xlsx($book))->save($path);

            return file_get_contents($path);
        } finally {
            @unlink($path);
            $book->disconnectWorksheets();
        }
    }
}
