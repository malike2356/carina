<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>@yield('title', 'Carina AI') — The Brain for Property</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        carina: { 50:'#f0f4ff', 100:'#dbe4ff', 500:'#4f6ef7', 600:'#3b5bdb', 700:'#2f4ac8', 900:'#1a2d6e' }
                    }
                }
            }
        }
    </script>
</head>
<body class="bg-gray-50 text-gray-900 antialiased">
    @yield('content')
</body>
</html>
