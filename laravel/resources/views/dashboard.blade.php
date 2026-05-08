@extends('layouts.app')
@section('title', 'Dashboard')

@section('content')
<div class="min-h-screen bg-gray-50">

    {{-- Nav --}}
    <nav class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div class="flex items-center gap-3">
            <span class="text-xl font-bold text-carina-700">Carina AI</span>
            <span class="text-xs bg-carina-100 text-carina-700 px-2 py-0.5 rounded-full font-medium">Free</span>
        </div>
        <div class="flex items-center gap-4">
            <span class="text-sm text-gray-600">{{ auth()->user()->name }}</span>
            <form method="POST" action="{{ route('logout') }}">
                @csrf
                <button type="submit" class="text-sm text-gray-500 hover:text-gray-800">Sign out</button>
            </form>
        </div>
    </nav>

    {{-- Content --}}
    <main class="max-w-4xl mx-auto px-6 py-12">

        <div class="mb-8">
            <h1 class="text-2xl font-bold text-gray-900">Welcome back, {{ auth()->user()->name }}</h1>
            <p class="text-gray-500 mt-1">Carina is your property intelligence platform.</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
            <div class="bg-white rounded-xl border border-gray-200 p-5">
                <p class="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">Status</p>
                <p class="text-lg font-semibold text-green-600">Active</p>
            </div>
            <div class="bg-white rounded-xl border border-gray-200 p-5">
                <p class="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">Plan</p>
                <p class="text-lg font-semibold">Free</p>
            </div>
            <div class="bg-white rounded-xl border border-gray-200 p-5">
                <p class="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">Tokens remaining</p>
                <p class="text-lg font-semibold">5,000</p>
            </div>
        </div>

        {{-- Coming soon modules --}}
        <div class="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 class="text-base font-semibold mb-4">What's coming</h2>
            <div class="space-y-3">
                @foreach([
                    ['Chat with Carina', 'Ask property questions, analyse deals, get compliance guidance.'],
                    ['Upload your knowledge', 'Train Carina on your documents, contracts, and market research.'],
                    ['Deal analyser', 'BTL, HMO, SA, flip — instant yield, cashflow and ROI calculations.'],
                    ['Area intelligence', 'Investment scores, rental yields, planning activity for any postcode.'],
                ] as [$title, $desc])
                <div class="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
                    <div class="w-2 h-2 mt-2 rounded-full bg-carina-400 flex-shrink-0"></div>
                    <div>
                        <p class="text-sm font-medium text-gray-800">{{ $title }}</p>
                        <p class="text-xs text-gray-400 mt-0.5">{{ $desc }}</p>
                    </div>
                </div>
                @endforeach
            </div>
        </div>

        <p class="text-xs text-gray-400 text-center mt-8">
            Carina AI by VERLOX Ltd &mdash; Phase 0 build &mdash; {{ now()->format('d M Y') }}
        </p>
    </main>
</div>
@endsection
