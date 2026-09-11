<?php

declare(strict_types=1);

/*
 * SP TINTED MANAGER - User Management / Permissions / Company Settings.
 * Existing api/index.php remains untouched.
 */

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
    respond([
        'success' => false,
        'message' => 'Database configuration file is missing.',
    ], 500);
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
    respond([
        'success' => false,
        'message' => 'Database connection failed.',
    ], 500);
}

if (!isset($_SESSION['user'])) {
    respond([
        'success' => false,
        'message' => 'Not authenticated.',
    ], 401);
}

$role = (string)($_SESSION['user']['role'] ?? 'User');
$isAdmin = in_array($role, ['Admin', 'Super Admin'], true);

/*
 * Permission table.
 * New users default to Dashboard only.
 */
$pdo->exec(
    'CREATE TABLE IF NOT EXISTS user_permissions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NOT NULL,
        dashboard TINYINT(1) NOT NULL DEFAULT 0,
        customer TINYINT(1) NOT NULL DEFAULT 0,
        invoice TINYINT(1) NOT NULL DEFAULT 0,
        user_management TINYINT(1) NOT NULL DEFAULT 0,
        change_password TINYINT(1) NOT NULL DEFAULT 0,
        settings TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_user_permissions_user (user_id),
        KEY idx_user_permissions_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
);

/*
 * Add the new Change Password permission column when upgrading
 * an existing installation that already has user_permissions.
 */
$columnCheck = $pdo->prepare(
    "SELECT COUNT(*)
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'user_permissions'
       AND COLUMN_NAME = 'change_password'"
);
$columnCheck->execute();

if ((int)$columnCheck->fetchColumn() === 0) {
    $pdo->exec(
        'ALTER TABLE user_permissions
         ADD COLUMN change_password TINYINT(1) NOT NULL DEFAULT 0
         AFTER user_management'
    );
}

/*
 * Upgrade old Settings defaults from the previous implementation.
 * Existing values are retained. Only newly created rows use 0.
 */
$pdo->exec(
    "INSERT INTO user_permissions
        (user_id, dashboard, customer, invoice, user_management, change_password, settings)
     SELECT
        u.id,
        CASE WHEN u.role IN ('Admin', 'Super Admin') THEN 1 ELSE 1 END,
        0,
        0,
        0,
        0,
        0
     FROM users u
     LEFT JOIN user_permissions up ON up.user_id = u.id
     WHERE up.user_id IS NULL"
);

/* Administrators always have full access. */
$pdo->exec(
    "UPDATE user_permissions up
     INNER JOIN users u ON u.id = up.user_id
     SET up.dashboard = 1,
         up.customer = 1,
         up.invoice = 1,
         up.user_management = 1,
         up.change_password = 1,
         up.settings = 1
     WHERE u.role IN ('Admin', 'Super Admin')"
);

/* Company details are stored separately from user permissions. */
$pdo->exec(
    'CREATE TABLE IF NOT EXISTS company_settings (
        id TINYINT UNSIGNED NOT NULL,
        company_name VARCHAR(200) NOT NULL DEFAULT \'Shining Pearl Tinted\',
        registration_no VARCHAR(100) NOT NULL DEFAULT \'\',
        phone VARCHAR(100) NOT NULL DEFAULT \'\',
        email VARCHAR(150) NOT NULL DEFAULT \'\',
        address TEXT NULL,
        website VARCHAR(255) NOT NULL DEFAULT \'\',
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
);

$pdo->exec(
    "INSERT INTO company_settings (id, company_name)
     VALUES (1, 'Shining Pearl Tinted')
     ON DUPLICATE KEY UPDATE id = id"
);

$action = (string)($_GET['action'] ?? '');
$input = json_decode(file_get_contents('php://input'), true);

if (!is_array($input)) {
    $input = [];
}

function requireAdmin(): void
{
    global $isAdmin;

    if (!$isAdmin) {
        respond([
            'success' => false,
            'message' => 'Administrator access required.',
        ], 403);
    }
}

function boolValue(mixed $value): int
{
    return filter_var($value, FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
}

function permissionPayload(array $row): array
{
    return [
        'dashboard' => (bool)($row['dashboard'] ?? false),
        'customer' => (bool)($row['customer'] ?? false),
        'invoice' => (bool)($row['invoice'] ?? false),
        'user_management' => (bool)($row['user_management'] ?? false),
        'change_password' => (bool)($row['change_password'] ?? false),
        'settings' => (bool)($row['settings'] ?? false),
    ];
}

function fullPermissionPayload(): array
{
    return [
        'dashboard' => true,
        'customer' => true,
        'invoice' => true,
        'user_management' => true,
        'change_password' => true,
        'settings' => true,
    ];
}

function getUserPermissions(PDO $pdo, int $id, string $userRole): array
{
    if (in_array($userRole, ['Admin', 'Super Admin'], true)) {
        return fullPermissionPayload();
    }

    $stmt = $pdo->prepare(
        'SELECT dashboard, customer, invoice, user_management, change_password, settings
         FROM user_permissions
         WHERE user_id = ?
         LIMIT 1'
    );
    $stmt->execute([$id]);

    return permissionPayload($stmt->fetch() ?: []);
}

try {
    switch ($action) {
        case 'permissions':
            if ($isAdmin) {
                respond([
                    'success' => true,
                    'data' => [
                        'isAdmin' => true,
                        'permissions' => fullPermissionPayload(),
                    ],
                ]);
            }

            $stmt = $pdo->prepare(
                'SELECT up.dashboard,
                        up.customer,
                        up.invoice,
                        up.user_management,
                        up.change_password,
                        up.settings
                 FROM user_permissions up
                 INNER JOIN users u ON u.id = up.user_id
                 WHERE u.user_id = ?
                 LIMIT 1'
            );
            $stmt->execute([(string)($_SESSION['user']['userId'] ?? '')]);
            $permissions = permissionPayload($stmt->fetch() ?: []);

            respond([
                'success' => true,
                'data' => [
                    'isAdmin' => false,
                    'permissions' => $permissions,
                ],
            ]);

        case 'get_user':
            requireAdmin();

            $id = (int)($input['id'] ?? 0);

            if ($id <= 0) {
                respond([
                    'success' => false,
                    'message' => 'Invalid user ID.',
                ], 400);
            }

            $stmt = $pdo->prepare(
                'SELECT id, user_id, full_name, username, role, status, last_login_at
                 FROM users
                 WHERE id = ?
                 LIMIT 1'
            );
            $stmt->execute([$id]);
            $user = $stmt->fetch();

            if (!$user) {
                respond([
                    'success' => false,
                    'message' => 'User not found.',
                ], 404);
            }

            respond([
                'success' => true,
                'data' => [
                    'user' => [
                        'id' => (int)$user['id'],
                        'user_id' => $user['user_id'],
                        'full_name' => $user['full_name'],
                        'username' => $user['username'],
                        'role' => $user['role'],
                        'status' => $user['status'],
                        'last_login_at' => $user['last_login_at'],
                        'permissions' => getUserPermissions(
                            $pdo,
                            (int)$user['id'],
                            (string)$user['role']
                        ),
                    ],
                ],
            ]);

        case 'list_users':
            requireAdmin();

            $stmt = $pdo->query(
                'SELECT id, user_id, full_name, username, role, status, last_login_at
                 FROM users
                 ORDER BY id ASC'
            );

            $users = [];

            foreach ($stmt as $user) {
                $users[] = [
                    'id' => (int)$user['id'],
                    'user_id' => $user['user_id'],
                    'full_name' => $user['full_name'],
                    'username' => $user['username'],
                    'role' => $user['role'],
                    'status' => $user['status'],
                    'last_login_at' => $user['last_login_at'],
                    'permissions' => getUserPermissions(
                        $pdo,
                        (int)$user['id'],
                        (string)$user['role']
                    ),
                ];
            }

            respond([
                'success' => true,
                'data' => [
                    'users' => $users,
                ],
            ]);

        case 'add_user':
            requireAdmin();

            $userId = trim((string)($input['userId'] ?? ''));
            $fullName = trim((string)($input['fullName'] ?? ''));
            $username = trim((string)($input['username'] ?? ''));
            $password = (string)($input['password'] ?? '');
            $newRole = trim((string)($input['role'] ?? 'User'));
            $status = trim((string)($input['status'] ?? 'Active'));

            if ($userId === '' || $fullName === '' || $username === '' || $password === '') {
                respond([
                    'success' => false,
                    'message' => 'Please complete all required fields.',
                ], 400);
            }

            if (strlen($password) < 8) {
                respond([
                    'success' => false,
                    'message' => 'Password must be at least 8 characters.',
                ], 400);
            }

            if (!in_array($newRole, ['User', 'Admin', 'Super Admin'], true)) {
                respond([
                    'success' => false,
                    'message' => 'Invalid role.',
                ], 400);
            }

            if (!in_array($status, ['Active', 'Inactive'], true)) {
                respond([
                    'success' => false,
                    'message' => 'Invalid status.',
                ], 400);
            }

            $check = $pdo->prepare(
                'SELECT id
                 FROM users
                 WHERE user_id = ? OR username = ?
                 LIMIT 1'
            );
            $check->execute([$userId, $username]);

            if ($check->fetch()) {
                respond([
                    'success' => false,
                    'message' => 'User ID or username already exists.',
                ], 409);
            }

            $permissions = $input['permissions'] ?? [];
            $fullAccess = in_array($newRole, ['Admin', 'Super Admin'], true);

            $pdo->beginTransaction();

            $insert = $pdo->prepare(
                'INSERT INTO users
                    (user_id, full_name, username, password, role, status)
                 VALUES (?, ?, ?, ?, ?, ?)'
            );
            $insert->execute([
                $userId,
                $fullName,
                $username,
                $password,
                $newRole,
                $status,
            ]);

            $dbId = (int)$pdo->lastInsertId();

            /*
             * New User defaults to Dashboard only.
             * Admin/Super Admin automatically receive all permissions.
             */
            $permissionInsert = $pdo->prepare(
                'INSERT INTO user_permissions
                    (user_id, dashboard, customer, invoice, user_management, change_password, settings)
                 VALUES (?, ?, ?, ?, ?, ?, ?)'
            );
            $permissionInsert->execute([
                $dbId,
                $fullAccess ? 1 : 1,
                $fullAccess ? 1 : 0,
                $fullAccess ? 1 : 0,
                $fullAccess ? 1 : 0,
                $fullAccess ? 1 : boolValue($permissions['change_password'] ?? false),
                $fullAccess ? 1 : boolValue($permissions['settings'] ?? false),
            ]);

            $pdo->commit();

            respond([
                'success' => true,
                'message' => 'User added successfully.',
            ]);

        case 'edit_user':
            requireAdmin();

            $id = (int)($input['id'] ?? 0);

            if ($id <= 0) {
                respond([
                    'success' => false,
                    'message' => 'Invalid user ID.',
                ], 400);
            }

            $find = $pdo->prepare(
                'SELECT id, role
                 FROM users
                 WHERE id = ?
                 LIMIT 1'
            );
            $find->execute([$id]);
            $existing = $find->fetch();

            if (!$existing) {
                respond([
                    'success' => false,
                    'message' => 'User not found.',
                ], 404);
            }

            $userId = trim((string)($input['userId'] ?? ''));
            $fullName = trim((string)($input['fullName'] ?? ''));
            $username = trim((string)($input['username'] ?? ''));
            $password = (string)($input['password'] ?? '');
            $newRole = trim((string)($input['role'] ?? 'User'));
            $status = trim((string)($input['status'] ?? 'Active'));

            if ($userId === '' || $fullName === '' || $username === '') {
                respond([
                    'success' => false,
                    'message' => 'Please complete all required fields.',
                ], 400);
            }

            if ($password !== '' && strlen($password) < 8) {
                respond([
                    'success' => false,
                    'message' => 'Password must be at least 8 characters.',
                ], 400);
            }

            if (!in_array($newRole, ['User', 'Admin', 'Super Admin'], true)) {
                respond([
                    'success' => false,
                    'message' => 'Invalid role.',
                ], 400);
            }

            if (!in_array($status, ['Active', 'Inactive'], true)) {
                respond([
                    'success' => false,
                    'message' => 'Invalid status.',
                ], 400);
            }

            $check = $pdo->prepare(
                'SELECT id
                 FROM users
                 WHERE (user_id = ? OR username = ?)
                   AND id <> ?
                 LIMIT 1'
            );
            $check->execute([$userId, $username, $id]);

            if ($check->fetch()) {
                respond([
                    'success' => false,
                    'message' => 'User ID or username already exists.',
                ], 409);
            }

            $permissions = $input['permissions'] ?? [];
            $fullAccess = in_array($newRole, ['Admin', 'Super Admin'], true);

            $pdo->beginTransaction();

            if ($password !== '') {
                $update = $pdo->prepare(
                    'UPDATE users
                     SET user_id = ?,
                         full_name = ?,
                         username = ?,
                         password = ?,
                         role = ?,
                         status = ?
                     WHERE id = ?'
                );
                $update->execute([
                    $userId,
                    $fullName,
                    $username,
                    $password,
                    $newRole,
                    $status,
                    $id,
                ]);
            } else {
                $update = $pdo->prepare(
                    'UPDATE users
                     SET user_id = ?,
                         full_name = ?,
                         username = ?,
                         role = ?,
                         status = ?
                     WHERE id = ?'
                );
                $update->execute([
                    $userId,
                    $fullName,
                    $username,
                    $newRole,
                    $status,
                    $id,
                ]);
            }

            $up = $pdo->prepare(
                'INSERT INTO user_permissions
                    (user_id, dashboard, customer, invoice, user_management, change_password, settings)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    dashboard = VALUES(dashboard),
                    customer = VALUES(customer),
                    invoice = VALUES(invoice),
                    user_management = VALUES(user_management),
                    change_password = VALUES(change_password),
                    settings = VALUES(settings)'
            );
            $up->execute([
                $id,
                $fullAccess ? 1 : boolValue($permissions['dashboard'] ?? false),
                $fullAccess ? 1 : boolValue($permissions['customer'] ?? false),
                $fullAccess ? 1 : boolValue($permissions['invoice'] ?? false),
                $fullAccess ? 1 : boolValue($permissions['user_management'] ?? false),
                $fullAccess ? 1 : boolValue($permissions['change_password'] ?? false),
                $fullAccess ? 1 : boolValue($permissions['settings'] ?? false),
            ]);

            $pdo->commit();

            respond([
                'success' => true,
                'message' => 'User updated successfully.',
            ]);

        case 'company_get':
            $stmt = $pdo->query(
                'SELECT id, company_name, registration_no, phone, email, address, website, updated_at
                 FROM company_settings
                 WHERE id = 1
                 LIMIT 1'
            );
            $company = $stmt->fetch();

            respond([
                'success' => true,
                'data' => [
                    'company' => [
                        'company_name' => $company['company_name'] ?? '',
                        'registration_no' => $company['registration_no'] ?? '',
                        'phone' => $company['phone'] ?? '',
                        'email' => $company['email'] ?? '',
                        'address' => $company['address'] ?? '',
                        'website' => $company['website'] ?? '',
                        'updated_at' => $company['updated_at'] ?? null,
                    ],
                ],
            ]);

        case 'company_save':
            requireAdmin();

            $companyName = trim((string)($input['company_name'] ?? ''));
            $registrationNo = trim((string)($input['registration_no'] ?? ''));
            $phone = trim((string)($input['phone'] ?? ''));
            $email = trim((string)($input['email'] ?? ''));
            $address = trim((string)($input['address'] ?? ''));
            $website = trim((string)($input['website'] ?? ''));

            if ($companyName === '') {
                respond([
                    'success' => false,
                    'message' => 'Company name is required.',
                ], 400);
            }

            $stmt = $pdo->prepare(
                'UPDATE company_settings
                 SET company_name = ?,
                     registration_no = ?,
                     phone = ?,
                     email = ?,
                     address = ?,
                     website = ?
                 WHERE id = 1'
            );
            $stmt->execute([
                $companyName,
                $registrationNo,
                $phone,
                $email,
                $address,
                $website,
            ]);

            respond([
                'success' => true,
                'message' => 'Company details saved successfully.',
            ]);

        default:
            respond([
                'success' => false,
                'message' => 'Unknown user management action.',
            ], 404);
    }
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log('[SP User Management] ' . $e->getMessage());

    respond([
        'success' => false,
        'message' => 'Server error.',
    ], 500);
}
