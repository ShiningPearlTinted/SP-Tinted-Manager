<?php

declare(strict_types=1);

session_set_cookie_params([
    'lifetime' => 60 * 60 * 8,
    'path' => '/',
    'secure' => true,
    'httponly' => true,
    'samesite' => 'Lax',
]);

session_start();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

function respond(array $payload, int $status = 200): never
{
    http_response_code($status);
    echo json_encode(
        $payload,
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
    );
    exit;
}

function clean(string $value): string
{
    return trim($value);
}

function normPhone(string $value): string
{
    return preg_replace('/\s+/', '', trim($value)) ?? trim($value);
}

function normPlate(string $value): string
{
    $value = strtoupper(trim($value));
    return preg_replace('/\s+/', '', $value) ?? $value;
}

function requireLogin(): void
{
    if (!isset($_SESSION['user'])) {
        respond([
            'success' => false,
            'message' => 'Session expired. Please login again.'
        ], 401);
    }
}

function currentUserHasCustomerPermission(PDO $pdo): bool
{
    $user = $_SESSION['user'] ?? null;

    if (!$user) {
        return false;
    }

    $role = (string)($user['role'] ?? '');

    if ($role === 'Admin' || $role === 'Super Admin') {
        return true;
    }

    $userId = (string)($user['userId'] ?? '');

    if ($userId === '') {
        return false;
    }

    $stmt = $pdo->prepare(
        'SELECT p.customer
         FROM user_permissions p
         INNER JOIN users u ON u.id = p.user_id
         WHERE u.user_id = ?
         LIMIT 1'
    );

    $stmt->execute([$userId]);

    return (bool)$stmt->fetchColumn();
}

requireLogin();

$configFile = dirname(__DIR__, 2) . '/spmanager_config/config.local.php';

if (!is_file($configFile)) {
    respond([
        'success' => false,
        'message' => 'Database configuration is missing.'
    ], 500);
}

$config = require $configFile;

try {
    $pdo = new PDO(
        'mysql:host=' . $config['db_host']
        . ';dbname=' . $config['db_name']
        . ';charset=utf8mb4',
        $config['db_user'],
        $config['db_pass'],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );
} catch (Throwable $error) {
    respond([
        'success' => false,
        'message' => 'Unable to connect to database.'
    ], 500);
}

if (!currentUserHasCustomerPermission($pdo)) {
    respond([
        'success' => false,
        'message' => 'You do not have permission to manage customers.'
    ], 403);
}

$action = $_GET['action'] ?? '';
$input = json_decode(
    file_get_contents('php://input'),
    true
);

if (!is_array($input)) {
    $input = [];
}

switch ($action) {
    case 'get':
        $id = (int)($input['id'] ?? 0);

        if ($id <= 0) {
            respond([
                'success' => false,
                'message' => 'Invalid customer ID.'
            ], 400);
        }

        $stmt = $pdo->prepare(
            'SELECT
                id,
                customer_code,
                registration_date,
                customer_name,
                phone_number,
                car_plate,
                brand,
                car_model,
                visit,
                customer_type
             FROM customer_database
             WHERE id = ?
             LIMIT 1'
        );

        $stmt->execute([$id]);
        $customer = $stmt->fetch();

        if (!$customer) {
            respond([
                'success' => false,
                'message' => 'Customer record not found.'
            ], 404);
        }

        $customer['phone_number'] = normPhone(
            (string)$customer['phone_number']
        );

        respond([
            'success' => true,
            'data' => [
                'customer' => $customer
            ]
        ]);

    case 'update':
        $id = (int)($input['id'] ?? 0);
        $name = clean((string)($input['name'] ?? ''));
        $phone = normPhone((string)($input['phone'] ?? ''));
        $plate = normPlate((string)($input['plate'] ?? ''));
        $brand = clean((string)($input['brand'] ?? ''));
        $model = clean((string)($input['model'] ?? ''));

        if ($id <= 0) {
            respond([
                'success' => false,
                'message' => 'Invalid customer ID.'
            ], 400);
        }

        if (
            $name === ''
            || $phone === ''
            || $plate === ''
            || $brand === ''
            || $model === ''
        ) {
            respond([
                'success' => false,
                'message' => 'Please complete all editable fields.'
            ], 400);
        }

        $exists = $pdo->prepare(
            'SELECT id
             FROM customer_database
             WHERE id <> ?
             AND (
                 REPLACE(phone_number, " ", "") = ?
                 OR UPPER(REPLACE(car_plate, " ", "")) = ?
             )
             LIMIT 1'
        );

        $exists->execute([
            $id,
            $phone,
            $plate
        ]);

        if ($exists->fetchColumn()) {
            respond([
                'success' => false,
                'message' => 'Another customer already uses this phone number or car plate.'
            ], 409);
        }

        $stmt = $pdo->prepare(
            'UPDATE customer_database
             SET
                customer_name = ?,
                phone_number = ?,
                car_plate = ?,
                brand = ?,
                car_model = ?
             WHERE id = ?'
        );

        $stmt->execute([
            $name,
            $phone,
            $plate,
            $brand,
            $model,
            $id
        ]);

        respond([
            'success' => true,
            'message' => 'Customer updated successfully.'
        ]);

    case 'delete':
        $id = (int)($input['id'] ?? 0);

        if ($id <= 0) {
            respond([
                'success' => false,
                'message' => 'Invalid customer ID.'
            ], 400);
        }

        $stmt = $pdo->prepare(
            'DELETE FROM customer_database
             WHERE id = ?'
        );

        $stmt->execute([$id]);

        if ($stmt->rowCount() === 0) {
            respond([
                'success' => false,
                'message' => 'Customer record not found.'
            ], 404);
        }

        respond([
            'success' => true,
            'message' => 'Customer deleted successfully.'
        ]);

    default:
        respond([
            'success' => false,
            'message' => 'Unknown customer management action.'
        ], 400);
}
