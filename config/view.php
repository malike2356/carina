<?php

return [

    'paths' => [
        resource_path('views'),
    ],

    /*
    | Use storage_path() - not realpath(). If config:cache runs before the views
    | directory exists, realpath() returns false and every request 500s with
    | "Please provide a valid cache path".
    */
    'compiled' => env('VIEW_COMPILED_PATH', storage_path('framework/views')),

];
