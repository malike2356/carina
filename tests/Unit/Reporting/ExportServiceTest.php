<?php

declare(strict_types=1);

use App\Services\Reporting\ExportService;
use Illuminate\Support\Facades\Storage;

beforeEach(function (): void {
    Storage::fake('local');
});

it('exports csv with headers and rows', function (): void {
    $svc = new ExportService;
    $path = $svc->exportCsv([
        ['a', 1],
        ['b', 2],
    ], ['col1', 'col2']);

    expect(Storage::disk('local')->exists($path))->toBeTrue();
    $raw = Storage::disk('local')->get($path);
    expect($raw)->toContain('col1')
        ->and($raw)->toContain('a');
});

it('exports xlsx file', function (): void {
    $svc = new ExportService;
    $path = $svc->exportExcel([['x']], ['h']);
    expect(Storage::disk('local')->exists($path))->toBeTrue();
});

it('exports pdf file', function (): void {
    $svc = new ExportService;
    $path = $svc->exportPdf([['row1']], ['h'], 'Title');
    expect(Storage::disk('local')->exists($path))->toBeTrue();
    expect(strlen(Storage::disk('local')->get($path)))->toBeGreaterThan(100);
});
