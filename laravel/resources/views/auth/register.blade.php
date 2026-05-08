@extends('layouts.app')
@section('title', 'Create account')

@section('content')
<div class="min-h-screen flex items-center justify-center py-12 px-4">
    <div class="w-full max-w-md">

        <div class="text-center mb-8">
            <h1 class="text-3xl font-bold text-carina-700">Carina AI</h1>
            <p class="text-gray-500 mt-1 text-sm">The Brain for Property</p>
        </div>

        <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <h2 class="text-xl font-semibold mb-6">Create your account</h2>

            @if ($errors->any())
                <div class="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                    <ul class="list-disc list-inside space-y-1">
                        @foreach ($errors->all() as $error)
                            <li>{{ $error }}</li>
                        @endforeach
                    </ul>
                </div>
            @endif

            <form method="POST" action="{{ route('register') }}" class="space-y-4">
                @csrf

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1" for="name">Full name</label>
                    <input
                        id="name" name="name" type="text"
                        value="{{ old('name') }}"
                        required autofocus autocomplete="name"
                        class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-carina-500 focus:border-transparent @error('name') border-red-400 @enderror"
                    >
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1" for="email">Email address</label>
                    <input
                        id="email" name="email" type="email"
                        value="{{ old('email') }}"
                        required autocomplete="email"
                        class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-carina-500 focus:border-transparent @error('email') border-red-400 @enderror"
                    >
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1" for="password">Password</label>
                    <input
                        id="password" name="password" type="password"
                        required autocomplete="new-password"
                        class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-carina-500 focus:border-transparent"
                    >
                    <p class="text-xs text-gray-400 mt-1">Minimum 8 characters</p>
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1" for="password_confirmation">Confirm password</label>
                    <input
                        id="password_confirmation" name="password_confirmation" type="password"
                        required autocomplete="new-password"
                        class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-carina-500 focus:border-transparent"
                    >
                </div>

                <button
                    type="submit"
                    class="w-full bg-carina-600 hover:bg-carina-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
                >
                    Create account
                </button>
            </form>
        </div>

        <p class="text-center text-sm text-gray-500 mt-6">
            Already have an account?
            <a href="{{ route('login') }}" class="text-carina-600 font-medium hover:underline">Sign in</a>
        </p>
    </div>
</div>
@endsection
