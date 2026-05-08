@extends('layouts.app')
@section('title', 'Sign in')

@section('content')
<div class="min-h-screen flex items-center justify-center py-12 px-4">
    <div class="w-full max-w-md">

        <div class="text-center mb-8">
            <h1 class="text-3xl font-bold text-carina-700">Carina AI</h1>
            <p class="text-gray-500 mt-1 text-sm">The Brain for Property</p>
        </div>

        <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <h2 class="text-xl font-semibold mb-6">Sign in to your account</h2>

            @if ($errors->any())
                <div class="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                    {{ $errors->first() }}
                </div>
            @endif

            <form method="POST" action="{{ route('login') }}" class="space-y-4">
                @csrf

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1" for="email">Email address</label>
                    <input
                        id="email" name="email" type="email"
                        value="{{ old('email') }}"
                        required autofocus autocomplete="email"
                        class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-carina-500 focus:border-transparent @error('email') border-red-400 @enderror"
                    >
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1" for="password">Password</label>
                    <input
                        id="password" name="password" type="password"
                        required autocomplete="current-password"
                        class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-carina-500 focus:border-transparent"
                    >
                </div>

                <div class="flex items-center justify-between">
                    <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                        <input type="checkbox" name="remember" class="rounded border-gray-300 text-carina-600">
                        Remember me
                    </label>
                </div>

                <button
                    type="submit"
                    class="w-full bg-carina-600 hover:bg-carina-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
                >
                    Sign in
                </button>
            </form>
        </div>

        <p class="text-center text-sm text-gray-500 mt-6">
            Don't have an account?
            <a href="{{ route('register') }}" class="text-carina-600 font-medium hover:underline">Create one</a>
        </p>
    </div>
</div>
@endsection
