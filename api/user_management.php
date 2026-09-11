<?php

declare(strict_types=1);

/* SP TINTED MANAGER - User Management module only.
   Existing index.php functions are intentionally untouched. */

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

$configFile = dirname(__DIR__, 2) . '/spmanager_config/config.local.php';

function respond(array $data, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

if (!file_exists($configFile)) {
    respond(['success' => false, 'message' => 'Database configuration file is missing.'], 500);
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
    respond(['success' => false, 'message' => 'Database connection failed.'], 500);
}

if (!isset($_SESSION['user'])) {
    respond(['success' => false, 'message' => 'Not authenticated.'], 401);
}

$role = (string)($_SESSION['user']['role'] ?? 'User');
$isAdmin = in_array($role, ['Admin', 'Super Admin'], true);

$pdo->exec(
    'CREATE TABLE IF NOT EXISTS user_permissions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NOT NULL,
        dashboard TINYINT(1) NOT NULL DEFAULT 0,
        customer TINYINT(1) NOT NULL DEFAULT 0,
        invoice TINYINT(1) NOT NULL DEFAULT 0,
        user_management TINYINT(1) NOT NULL DEFAULT 0,
        settings TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_user_permissions_user (user_id),
        KEY idx_user_permissions_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
);

/* Ensure every existing user has a permissions row. */
$pdo->exec(
    "INSERT INTO user_permissions (user_id, dashboard, customer, invoice, user_management, settings)
     SELECT u.id,
            CASE WHEN u.role IN ('Admin', 'Super Admin') THEN 1 ELSE 0 END,
            CASE WHEN u.role IN ('Admin', 'Super Admin') THEN 1 ELSE 0 END,
            CASE WHEN u.role IN ('Admin', 'Super Admin') THEN 1 ELSE 0 END,
            CASE WHEN u.role IN ('Admin', 'Super Admin') THEN 1 ELSE 0 END,
            1
     FROM users u
     LEFT JOIN user_permissions up ON up.user_id = u.id
     WHERE up.user_id IS NULL"
);

/* Keep administrator access complete in the permissions table. */
$pdo->exec(
    "UPDATE user_permissions up
     INNER JOIN users u ON u.id = up.user_id
     SET up.dashboard = 1,
         up.customer = 1,
         up.invoice = 1,
         up.user_management = 1,
         up.settings = 1
     WHERE u.role IN ('Admin', 'Super Admin')"
);

$action = $_GET['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) $input = [];

function requireAdmin(): void
{
    global $isAdmin;
    if (!$isAdmin) {
        respond(['success' => false, 'message' => 'Administrator access required.'], 403);
    }
}

function boolValue(mixed $value): int
{
    return filter_var($value, FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
}

try {
    switch ($action) {
        case 'permissions':
            if ($isAdmin) {
                respond([
                    'success' => true,
                    'data' => [
                        'isAdmin' => true,
                        'permissions' => [
                            'dashboard' => true,
                            'customer' => true,
                            'invoice' => true,
                            'user_management' => true,
                            'settings' => true,
                        ],
                    ],
                ]);
            }

            $stmt = $pdo->prepare(
                'SELECT dashboard, customer, invoice, user_management, settings
                 FROM user_permissions up
                 INNER JOIN users u ON u.id = up.user_id
                 WHERE u.user_id = ?
                 LIMIT 1'
            );
            $stmt->execute([(string)($_SESSION['user']['userId'] ?? '')]);
            $p = $stmt->fetch();

            respond([
                'success' => true,
                'data' => [
                    'isAdmin' => false,
                    'permissions' => [
                        'dashboard' => (bool)($p['dashboard'] ?? false),
                        'customer' => (bool)($p['customer'] ?? false),
                        'invoice' => (bool)($p['invoice'] ?? false),
                        'user_management' => false,
                        'settings' => true,
                    ],
                ],
            ]);

        case 'get_user':
            requireAdmin();

            $id = (int)($input['id'] ?? 0);
            if ($id <= 0) {
                respond(['success' => false, 'message' => 'Invalid user ID.'], 400);
            }

            $stmt = $pdo->prepare(
                'SELECT id, user_id, full_name, username, role, status, last_login_at
                 FROM users
                 WHERE id = ?
                 LIMIT 1'
            );
            $stmt->execute([$id]);
            $u = $stmt->fetch();

            if (!$u) {
                respond(['success' => false, 'message' => 'User not found.'], 404);
            }

            $permissionStmt = $pdo->prepare(
                'SELECT dashboard, customer, invoice, user_management, settings
                 FROM user_permissions
                 WHERE user_id = ?
                 LIMIT 1'
            );
            $permissionStmt->execute([$id]);
            $p = $permissionStmt->fetch();

            $userIsAdmin = in_array($u['role'], ['Admin', 'Super Admin'], true);

            respond([
                'success' => true,
                'data' => [
                    'user' => [
                        'id' => (int)$u['id'],
                        'user_id' => $u['user_id'],
                        'full_name' => $u['full_name'],
                        'username' => $u['username'],
                        'role' => $u['role'],
                        'status' => $u['status'],
                        'last_login_at' => $u['last_login_at'],
                        'permissions' => [
                            'dashboard' => $userIsAdmin ? true : (bool)($p['dashboard'] ?? false),
                            'customer' => $userIsAdmin ? true : (bool)($p['customer'] ?? false),
                            'invoice' => $userIsAdmin ? true : (bool)($p['invoice'] ?? false),
                            'user_management' => $userIsAdmin ? true : (bool)($p['user_management'] ?? false),
                            'settings' => true,
                        ],
                    ],
                ],
            ]);

        case 'list_users':
            requireAdmin();

            $stmt = $pdo->query(
                'SELECT id, user_id, full_name, username, role, status, last_login_at
                 FROM users ORDER BY id ASC'
            );
            $result = [];

            $permissionStmt = $pdo->prepare(
                'SELECT dashboard, customer, invoice, user_management, settings
                 FROM user_permissions WHERE user_id = ? LIMIT 1'
            );

            foreach ($stmt as $u) {
                $permissionStmt->execute([(int)$u['id']]);
                $p = $permissionStmt->fetch();
                $result[] = [
                    'id' => (int)$u['id'],
                    'user_id' => $u['user_id'],
                    'full_name' => $u['full_name'],
                    'username' => $u['username'],
                    'role' => $u['role'],
                    'status' => $u['status'],
                    'last_login_at' => $u['last_login_at'],
                    'permissions' => [
                        'dashboard' => in_array($u['role'], ['Admin', 'Super Admin'], true) ? true : (bool)($p['dashboard'] ?? false),
                        'customer' => in_array($u['role'], ['Admin', 'Super Admin'], true) ? true : (bool)($p['customer'] ?? false),
                        'invoice' => in_array($u['role'], ['Admin', 'Super Admin'], true) ? true : (bool)($p['invoice'] ?? false),
                        'user_management' => in_array($u['role'], ['Admin', 'Super Admin'], true) ? true : (bool)($p['user_management'] ?? false),
                        'settings' => true,
                    ],
                ];
            }

            respond(['success' => true, 'data' => ['users' => $result]]);

        case 'add_user':
            requireAdmin();

            $userId = trim((string)($input['userId'] ?? ''));
            $fullName = trim((string)($input['fullName'] ?? ''));
            $username = trim((string)($input['username'] ?? ''));
            $password = (string)($input['password'] ?? '');
            $newRole = trim((string)($input['role'] ?? 'User'));
            $status = trim((string)($input['status'] ?? 'Active'));

            if ($userId === '' || $fullName === '' || $username === '' || $password === '') {
                respond(['success' => false, 'message' => 'Please complete all required fields.'], 400);
            }
            if (strlen($password) < 8) {
                respond(['success' => false, 'message' => 'Password must be at least 8 characters.'], 400);
            }
            if (!in_array($newRole, ['User', 'Admin', 'Super Admin'], true)) {
                respond(['success' => false, 'message' => 'Invalid role.'], 400);
            }
            if (!in_array($status, ['Active', 'Inactive'], true)) {
                respond(['success' => false, 'message' => 'Invalid status.'], 400);
            }

            $check = $pdo->prepare('SELECT id FROM users WHERE user_id = ? OR username = ? LIMIT 1');
            $check->execute([$userId, $username]);
            if ($check->fetch()) {
                respond(['success' => false, 'message' => 'User ID or username already exists.'], 409);
            }

            $pdo->beginTransaction();
            $insert = $pdo->prepare(
                'INSERT INTO users (user_id, full_name, username, password, role, status)
                 VALUES (?, ?, ?, ?, ?, ?)'
            );
            $insert->execute([$userId, $fullName, $username, $password, $newRole, $status]);
            $dbId = (int)$pdo->lastInsertId();

            $p = $input['permissions'] ?? [];
            $fullAccess = in_array($newRole, ['Admin', 'Super Admin'], true);

            $permissionInsert = $pdo->prepare(
                'INSERT INTO user_permissions (user_id, dashboard, customer, invoice, user_management, settings)
                 VALUES (?, ?, ?, ?, ?, 1)'
            );
            $permissionInsert->execute([
                $dbId,
                $fullAccess ? 1 : boolValue($p['dashboard'] ?? false),
                $fullAccess ? 1 : boolValue($p['customer'] ?? false),
                $fullAccess ? 1 : boolValue($p['invoice'] ?? false),
                $fullAccess ? 1 : boolValue($p['user_management'] ?? false),
            ]);
            $pdo->commit();

            respond(['success' => true, 'message' => 'User added successfully.']);

        case 'edit_user':
            requireAdmin();

            $id = (int)($input['id'] ?? 0);
            if ($id <= 0) respond(['success' => false, 'message' => 'Invalid user ID.'], 400);

            $find = $pdo->prepare('SELECT id, role FROM users WHERE id = ? LIMIT 1');
            $find->execute([$id]);
            $existing = $find->fetch();
            if (!$existing) respond(['success' => false, 'message' => 'User not found.'], 404);

            $userId = trim((string)($input['userId'] ?? ''));
            $fullName = trim((string)($input['fullName'] ?? ''));
            $username = trim((string)($input['username'] ?? ''));
            $password = (string)($input['password'] ?? '');
            $newRole = trim((string)($input['role'] ?? 'User'));
            $status = trim((string)($input['status'] ?? 'Active'));

            if ($userId === '' || $fullName === '' || $username === '') {
                respond(['success' => false, 'message' => 'Please complete all required fields.'], 400);
            }
            if ($password !== '' && strlen($password) < 8) {
                respond(['success' => false, 'message' => 'Password must be at least 8 characters.'], 400);
            }
            if (!in_array($newRole, ['User', 'Admin', 'Super Admin'], true)) {
                respond(['success' => false, 'message' => 'Invalid role.'], 400);
            }
            if (!in_array($status, ['Active', 'Inactive'], true)) {
                respond(['success' => false, 'message' => 'Invalid status.'], 400);
            }

            $check = $pdo->prepare('SELECT id FROM users WHERE (user_id = ? OR username = ?) AND id <> ? LIMIT 1');
            $check->execute([$userId, $username, $id]);
            if ($check->fetch()) {
                respond(['success' => false, 'message' => 'User ID or username already exists.'], 409);
            }

            $pdo->beginTransaction();
            if ($password !== '') {
                $update = $pdo->prepare(
                    'UPDATE users SET user_id = ?, full_name = ?, username = ?, password = ?, role = ?, status = ? WHERE id = ?'
                );
                $update->execute([$userId, $fullName, $username, $password, $newRole, $status, $id]);
            } else {
                $update = $pdo->prepare(
                    'UPDATE users SET user_id = ?, full_name = ?, username = ?, role = ?, status = ? WHERE id = ?'
                );
                $update->execute([$userId, $fullName, $username, $newRole, $status, $id]);
            }

            $p = $input['permissions'] ?? [];
            $fullAccess = in_array($newRole, ['Admin', 'Super Admin'], true);

            $up = $pdo->prepare(
                'INSERT INTO user_permissions (user_id, dashboard, customer, invoice, user_management, settings)
                 VALUES (?, ?, ?, ?, ?, 1)
                 ON DUPLICATE KEY UPDATE
                    dashboard = VALUES(dashboard),
                    customer = VALUES(customer),
                    invoice = VALUES(invoice),
                    user_management = VALUES(user_management),
                    settings = 1'
            );
            $up->execute([
                $id,
                $fullAccess ? 1 : boolValue($p['dashboard'] ?? false),
                $fullAccess ? 1 : boolValue($p['customer'] ?? false),
                $fullAccess ? 1 : boolValue($p['invoice'] ?? false),
                $fullAccess ? 1 : boolValue($p['user_management'] ?? false),
            ]);
            $pdo->commit();

            respond(['success' => true, 'message' => 'User updated successfully.']);

        default:
            respond(['success' => false, 'message' => 'Unknown user management action.'], 404);
    }
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('[SP User Management] ' . $e->getMessage());
    respond(['success' => false, 'message' => 'Server error.'], 500);
}
