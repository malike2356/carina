<?php

namespace Tests\Feature;

use Tests\TestCase;

class ExampleTest extends TestCase
{
    /**
     * A basic test example.
     */
    public function test_the_application_returns_a_successful_response(): void
    {
        $response = $this->withServerVariables(['HTTP_HOST' => 'propreneur.test'])->get('/health');

        $response->assertStatus(200);
    }
}
