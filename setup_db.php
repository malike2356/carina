<?php

try {
    // Try connecting via Unix socket as current user first
    $dsn = 'pgsql:host=/var/run/postgresql;dbname=postgres';
    $pdo = new PDO($dsn, 'postgres', null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
    echo "Connected as postgres via socket\n";
    
    // Create the database role if it doesn't exist
    $pdo->exec("CREATE ROLE propreneur WITH LOGIN PASSWORD 'local_dev_password' CREATEDB");
    echo "Created role propreneur\n";
    
    // Create the database
    $pdo->exec("CREATE DATABASE propreneur_central OWNER propreneur");
    echo "Created database propreneur_central\n";
    
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
    
    if (strpos($e->getMessage(), 'already exists') !== false) {
        echo "Already set up.\n";
    }
    
    if (strpos($e->getMessage(), 'Peer authentication') !== false) {
        // Try via TCP with trust auth
        try {
            $pdo = new PDO('pgsql:host=127.0.0.1;port=5432;dbname=postgres', 'postgres', null, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            ]);
            echo "Connected as postgres via TCP (trust)\n";
            $pdo->exec("CREATE ROLE propreneur WITH LOGIN PASSWORD 'local_dev_password' CREATEDB");
            $pdo->exec("CREATE DATABASE propreneur_central OWNER propreneur");
            echo "Done!\n";
        } catch (Exception $e2) {
            echo "TCP also failed: " . $e2->getMessage() . "\n";
        }
    }
}

echo "\nDone.\n";