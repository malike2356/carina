<?php

declare(strict_types=1);

use App\Services\Carina\MasterbrainRagSyncService;
use Illuminate\Support\Facades\File;

it('discovers markdown files recursively under masterbrain root', function (): void {
    $tmp = sys_get_temp_dir().'/mb_discover_'.uniqid('', true);
    File::makeDirectory($tmp.'/Carina_RAG', 0775, true);
    File::put($tmp.'/root.md', '# Root');
    File::put($tmp.'/Carina_RAG/nested.md', '# Nested');
    File::put($tmp.'/skip.txt', 'not md');
    config(['carina.masterbrain_path' => $tmp]);

    try {
        $files = app(MasterbrainRagSyncService::class)->discoverMarkdownFiles();
        expect($files)->toHaveCount(2);
        expect(collect($files)->contains(fn (string $p): bool => str_ends_with($p, 'root.md')))->toBeTrue();
        expect(collect($files)->contains(fn (string $p): bool => str_ends_with($p, 'nested.md')))->toBeTrue();
    } finally {
        File::deleteDirectory($tmp);
    }
});
