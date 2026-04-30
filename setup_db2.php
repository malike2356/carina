<?php

$pdo = new PDO('pgsql:host=/var/run/postgresql;dbname=postgres', 'postgres', null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
]);

echo "Connected OK\n";

// Ensure propreneur role exists with correct password
$pdo->exec("ALTER ROLE propreneur WITH PASSWORD 'local_dev_password'");
echo "Password set for propreneur\n";

// Create database if not exists
try {
    $pdo->exec("CREATE DATABASE propreneur_central OWNER propreneur");
    echo "Created database propreneur_central\n";
} catch (PDOException $e) {
    if (strpos($e->getMessage(), 'already exists') !== false) {
        echo "Database already exists\n";
    } else {
        throw $e;
    }
}

// Grant privileges
$pdo->exec("GRANT ALL PRIVILEGES ON DATABASE propreneur_central TO propreneur");
echo "Privileges granted\n";

echo "\nNow testing TCP connection as propreneur...\n";
try {
    $test = new PDO('pgsql:host=127.0.0.1;port=5432;dbname=propreneur_central', 'propreneur', 'local_dev_password', [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
    echo "TCP connection OK!\n";
} catch (PDOException $e) {
    echo "TCP connection FAILED: " . $e->getMessage() . "\n";
}

echo "\nDone.\n";