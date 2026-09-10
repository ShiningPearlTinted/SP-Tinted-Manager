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

$configFile = dirname(__DIR__, 2) . '/spmanager_config/config.local.php';

if (!file_exists($configFile)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database configuration file is missing.']);
    exit;
}

$config = require $configFile;

try {
    $pdo = new PDO(
        'mysql:host=' . $config['db_host'] . ';dbname=' . $config['db_name'] . ';charset=utf8mb4',
        $config['db_user'],
        $config['db_pass'],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed.']);
    exit;
}

$action = $_GET['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) $input = [];

try {
    switch ($action) {
        case 'login':
            $username = trim((string)($input['username'] ?? ''));
            $password = (string)($input['password'] ?? '');

            if ($username === '' || $password === '') {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Username and password are required.']);
                exit;
            }

            // Password is intentionally stored/read as plain text per requested setup.
            $stmt = $pdo->prepare(
                'SELECT id, user_id, full_name, username, password, role, status
                 FROM users WHERE username = ? LIMIT 1'
            );
            $stmt->execute([$username]);
            $user = $stmt->fetch();

            if (!$user || $user['status'] !== 'Active' || $password !== (string)$user['password']) {
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'Invalid username or password.']);
                exit;
            }

            $update = $pdo->prepare('UPDATE users SET last_login_at = NOW() WHERE id = ?');
            $update->execute([$user['id']]);

            session_regenerate_id(true);
            $_SESSION['user'] = [
                'userId' => $user['user_id'],
                'fullName' => $user['full_name'],
                'username' => $user['username'],
                'role' => $user['role'],
                'loginTime' => date('c'),
            ];

            echo json_encode(['success' => true, 'message' => 'Login successful.', 'user' => $_SESSION['user']]);
            exit;

        case 'change_password':
            if (!isset($_SESSION['user']['username'])) {
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'Not authenticated.']);
                exit;
            }

            $currentPassword = (string)($input['currentPassword'] ?? '');
            $newPassword = (string)($input['newPassword'] ?? '');

            if ($currentPassword === '' || $newPassword === '') {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Current password and new password are required.']);
                exit;
            }

            if (strlen($newPassword) < 8) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'New password must be at least 8 characters.']);
                exit;
            }

            $stmt = $pdo->prepare(
                'SELECT id, password FROM users WHERE username = ? LIMIT 1'
            );
            $stmt->execute([$_SESSION['user']['username']]);
            $user = $stmt->fetch();

            if (!$user || $currentPassword !== (string)$user['password']) {
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'Current password is incorrect.']);
                exit;
            }

            if ($newPassword === (string)$user['password']) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'New password must be different from the current password.']);
                exit;
            }

            $update = $pdo->prepare('UPDATE users SET password = ? WHERE id = ?');
            $update->execute([$newPassword, $user['id']]);

            echo json_encode(['success' => true, 'message' => 'Password changed successfully.']);
            exit;

        case 'logout':
            $_SESSION = [];

            if (ini_get('session.use_cookies')) {
                $params = session_get_cookie_params();
                setcookie(
                    session_name(),
                    '',
                    time() - 42000,
                    $params['path'],
                    $params['domain'] ?? '',
                    (bool)$params['secure'],
                    (bool)$params['httponly']
                );
            }

            session_destroy();
            echo json_encode(['success' => true, 'message' => 'Logout successful.']);
            exit;

        case 'session':
            echo json_encode([
                'success' => true,
                'message' => isset($_SESSION['user']) ? 'Active session.' : 'No active session.',
                'user' => $_SESSION['user'] ?? null
            ]);
            exit;

        case 'dashboard':
            if (!isset($_SESSION['user'])) {
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'Not authenticated.']);
                exit;
            }

            $totalCustomers = (int)$pdo->query('SELECT COUNT(*) FROM customers')->fetchColumn();
            $todayRegistration = (int)$pdo->query(
                'SELECT COUNT(*) FROM customers WHERE DATE(registration_date) = CURDATE()'
            )->fetchColumn();
            $totalVehicles = (int)$pdo->query(
                "SELECT COUNT(DISTINCT vehicle) FROM customers
                 WHERE vehicle IS NOT NULL AND TRIM(vehicle) <> ''"
            )->fetchColumn();
            $monthlyRegistration = (int)$pdo->query(
                "SELECT COUNT(*) FROM customers
                 WHERE YEAR(registration_date) = YEAR(CURDATE())
                 AND MONTH(registration_date) = MONTH(CURDATE())"
            )->fetchColumn();

            $recentStmt = $pdo->query(
                'SELECT id, name, vehicle, phone, registration_date
                 FROM customers ORDER BY registration_date DESC, id DESC LIMIT 10'
            );

            $recent = [];
            foreach ($recentStmt as $row) {
                $recent[] = [
                    'id' => $row['id'],
                    'name' => $row['name'],
                    'vehicle' => $row['vehicle'],
                    'phone' => $row['phone'],
                    'date' => $row['registration_date'],
                ];
            }

            echo json_encode([
                'success' => true,
                'data' => [
                    'totalCustomers' => $totalCustomers,
                    'todayRegistration' => $todayRegistration,
                    'totalVehicles' => $totalVehicles,
                    'monthlyRegistration' => $monthlyRegistration,
                    'recent' => $recent,
                ]
            ]);
            exit;

        default:
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Unknown API action.']);
            exit;
    }
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error.']);
    exit;
}
