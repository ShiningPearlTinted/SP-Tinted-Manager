<?php

declare(strict_types=1);

/* ==========================================================
   SP TINTED MANAGER API
   Existing authentication + Customer Dashboard + Customer Register
   Database configuration is intentionally outside Git deployment.
   ========================================================== */

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
    echo json_encode([
        'success' => false,
        'message' => 'Database configuration file is missing.'
    ]);
    exit;
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
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database connection failed.'
    ]);
    exit;
}

$action = $_GET['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true);

if (!is_array($input)) {
    $input = [];
}

function respond(array $data, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function clean(string $value): string
{
    return trim($value);
}

function normPhone(string $value): string
{
    $phone = preg_replace('/\s+/', '', trim($value)) ?? '';

    if ($phone !== '' && preg_match('/^\d+$/', $phone) === 1 && $phone[0] !== '0') {
        $phone = '0' . $phone;
    }

    return $phone;
}

function normPlate(string $value): string
{
    return strtoupper(
        preg_replace('/\s+/', '', trim($value)) ?? ''
    );
}

function requireLogin(): void
{
    if (!isset($_SESSION['user'])) {
        respond([
            'success' => false,
            'message' => 'Not authenticated.'
        ], 401);
    }
}

try {
    switch ($action) {

        /* ======================================================
           LOGIN
           ====================================================== */

        case 'login':
            $username = trim((string)($input['username'] ?? ''));
            $password = (string)($input['password'] ?? '');

            if ($username === '' || $password === '') {
                respond([
                    'success' => false,
                    'message' => 'Username and password are required.'
                ], 400);
            }

            /*
             * Existing system stores the current password field as
             * plain text. This is preserved here to avoid changing
             * the existing authentication behaviour.
             */
            $stmt = $pdo->prepare(
                'SELECT id, user_id, full_name, username, password, role, status
                 FROM users
                 WHERE username = ?
                 LIMIT 1'
            );

            $stmt->execute([$username]);
            $user = $stmt->fetch();

            if (
                !$user
                || $user['status'] !== 'Active'
                || $password !== (string)$user['password']
            ) {
                respond([
                    'success' => false,
                    'message' => 'Invalid username or password.'
                ], 401);
            }

            $update = $pdo->prepare(
                'UPDATE users
                 SET last_login_at = NOW()
                 WHERE id = ?'
            );

            $update->execute([$user['id']]);

            session_regenerate_id(true);

            $_SESSION['user'] = [
                'userId' => $user['user_id'],
                'fullName' => $user['full_name'],
                'username' => $user['username'],
                'role' => $user['role'],
                'loginTime' => date('c'),
            ];

            respond([
                'success' => true,
                'message' => 'Login successful.',
                'user' => $_SESSION['user']
            ]);

        /* ======================================================
           CHANGE PASSWORD
           ====================================================== */

        case 'change_password':
            requireLogin();

            $currentPassword = (string)($input['currentPassword'] ?? '');
            $newPassword = (string)($input['newPassword'] ?? '');

            if ($currentPassword === '' || $newPassword === '') {
                respond([
                    'success' => false,
                    'message' => 'Current password and new password are required.'
                ], 400);
            }

            if (strlen($newPassword) < 8) {
                respond([
                    'success' => false,
                    'message' => 'New password must be at least 8 characters.'
                ], 400);
            }

            $stmt = $pdo->prepare(
                'SELECT id, password
                 FROM users
                 WHERE username = ?
                 LIMIT 1'
            );

            $stmt->execute([$_SESSION['user']['username']]);
            $user = $stmt->fetch();

            if (
                !$user
                || $currentPassword !== (string)$user['password']
            ) {
                respond([
                    'success' => false,
                    'message' => 'Current password is incorrect.'
                ], 401);
            }

            if ($newPassword === (string)$user['password']) {
                respond([
                    'success' => false,
                    'message' => 'New password must be different from the current password.'
                ], 400);
            }

            $update = $pdo->prepare(
                'UPDATE users
                 SET password = ?
                 WHERE id = ?'
            );

            $update->execute([
                $newPassword,
                $user['id']
            ]);

            respond([
                'success' => true,
                'message' => 'Password changed successfully.'
            ]);

        /* ======================================================
           LOGOUT
           ====================================================== */

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

            respond([
                'success' => true,
                'message' => 'Logout successful.'
            ]);

        /* ======================================================
           SESSION
           ====================================================== */

        case 'session':
            respond([
                'success' => true,
                'message' => isset($_SESSION['user'])
                    ? 'Active session.'
                    : 'No active session.',
                'user' => $_SESSION['user'] ?? null
            ]);

        /* ======================================================
           MAIN DASHBOARD
           Uses customer_database as the master Customer source.
           ====================================================== */

        case 'dashboard':
            requireLogin();

            $recentLimit = (int)($input['recentLimit'] ?? 5);
            $recentLimit = in_array($recentLimit, [5, 10], true)
                ? $recentLimit
                : 5;

            $totalCustomers = (int)$pdo->query(
                "SELECT COUNT(DISTINCT CONCAT(
                    COALESCE(NULLIF(REPLACE(TRIM(phone_number), ' ', ''), ''), ''),
                    '|',
                    COALESCE(NULLIF(UPPER(REPLACE(TRIM(car_plate), ' ', '')), ''), '')
                ))
                FROM customer_database"
            )->fetchColumn();

            $todayRegistration = (int)$pdo->query(
                'SELECT COUNT(*)
                 FROM customer_database
                 WHERE DATE(registration_date) = CURDATE()'
            )->fetchColumn();

            $totalVehicles = (int)$pdo->query(
                "SELECT COUNT(DISTINCT UPPER(REPLACE(TRIM(car_plate), ' ', '')))
                 FROM customer_database
                 WHERE car_plate IS NOT NULL
                 AND TRIM(car_plate) <> ''"
            )->fetchColumn();

            $monthlyRegistration = (int)$pdo->query(
                'SELECT COUNT(*)
                 FROM customer_database
                 WHERE YEAR(registration_date) = YEAR(CURDATE())
                 AND MONTH(registration_date) = MONTH(CURDATE())'
            )->fetchColumn();

            $recentStmt = $pdo->query(
                'SELECT
                    id,
                    customer_code,
                    customer_name,
                    phone_number,
                    brand,
                    car_model,
                    car_plate,
                    registration_date
                 FROM customer_database
                 ORDER BY registration_date DESC, id DESC
                 LIMIT ' . $recentLimit
            );

            $recent = [];

            foreach ($recentStmt as $row) {
                $recent[] = [
                    'id' => $row['customer_code'],
                    'name' => $row['customer_name'],
                    'vehicle' => trim(
                        (string)$row['brand'] . ' ' . (string)$row['car_model']
                    ),
                    'phone' => normPhone((string)$row['phone_number']),
                    'date' => $row['registration_date'],
                ];
            }

            respond([
                'success' => true,
                'data' => [
                    'totalCustomers' => $totalCustomers,
                    'todayRegistration' => $todayRegistration,
                    'totalVehicles' => $totalVehicles,
                    'monthlyRegistration' => $monthlyRegistration,
                    'recent' => $recent,
                ]
            ]);

        /* ======================================================
           CUSTOMER DASHBOARD
           ====================================================== */

        case 'customer_dashboard':
            requireLogin();

            $page = max(1, (int)($input['page'] ?? 1));
            $perPage = (int)($input['perPage'] ?? 20);
            $perPage = min(100, max(10, $perPage));
            $search = trim((string)($input['search'] ?? ''));

            /* Customer statistics are calculated from the same
               customer_database used by Customer Register. */
            $totalCustomers = (int)$pdo->query(
                "SELECT COUNT(DISTINCT CONCAT(
                    COALESCE(NULLIF(REPLACE(TRIM(phone_number), ' ', ''), ''), ''),
                    '|',
                    COALESCE(NULLIF(UPPER(REPLACE(TRIM(car_plate), ' ', '')), ''), '')
                ))
                FROM customer_database"
            )->fetchColumn();

            $newCustomers = (int)$pdo->query(
                "SELECT COUNT(*)
                 FROM customer_database
                 WHERE customer_type = 'New'"
            )->fetchColumn();

            $returningCustomers = (int)$pdo->query(
                "SELECT COUNT(*)
                 FROM customer_database
                 WHERE customer_type = 'Returning'"
            )->fetchColumn();

            $totalVisits = (int)$pdo->query(
                'SELECT COUNT(*) FROM customer_database'
            )->fetchColumn();

            /* Build the optional search condition. */
            $where = '';
            $params = [];

            if ($search !== '') {
                $where = "WHERE
                    customer_code LIKE :search_code
                    OR customer_name LIKE :search_name
                    OR phone_number LIKE :search_phone
                    OR car_plate LIKE :search_plate
                    OR brand LIKE :search_brand
                    OR car_model LIKE :search_model";

                $searchValue = '%' . $search . '%';

                $params[':search_code'] = $searchValue;
                $params[':search_name'] = $searchValue;
                $params[':search_phone'] = $searchValue;
                $params[':search_plate'] = $searchValue;
                $params[':search_brand'] = $searchValue;
                $params[':search_model'] = $searchValue;
            }

            $countSql = "SELECT COUNT(*)
                         FROM customer_database
                         $where";

            $countStmt = $pdo->prepare($countSql);
            $countStmt->execute($params);

            $totalRecords = (int)$countStmt->fetchColumn();
            $totalPages = max(1, (int)ceil($totalRecords / $perPage));

            if ($page > $totalPages) {
                $page = $totalPages;
            }

            $offset = ($page - 1) * $perPage;

            $listSql = "SELECT
                            id,
                            customer_code,
                            customer_name,
                            phone_number,
                            brand,
                            car_model,
                            car_plate,
                            visit,
                            customer_type,
                            registration_date
                        FROM customer_database
                        $where
                        ORDER BY registration_date DESC, id DESC
                        LIMIT :limit OFFSET :offset";

            $listStmt = $pdo->prepare($listSql);

            foreach ($params as $key => $value) {
                $listStmt->bindValue($key, $value, PDO::PARAM_STR);
            }

            $listStmt->bindValue(':limit', $perPage, PDO::PARAM_INT);
            $listStmt->bindValue(':offset', $offset, PDO::PARAM_INT);
            $listStmt->execute();

            $customers = [];

            foreach ($listStmt as $row) {
                $customers[] = [
                    'id' => $row['id'],
                    'customerCode' => $row['customer_code'],
                    'name' => $row['customer_name'],
                    'phone' => normPhone((string)$row['phone_number']),
                    'vehicle' => trim(
                        (string)$row['brand'] . ' ' . (string)$row['car_model']
                    ),
                    'plate' => $row['car_plate'],
                    'type' => $row['customer_type'],
                    'visit' => (int)$row['visit'],
                    'registrationDate' => $row['registration_date'],
                ];
            }

            respond([
                'success' => true,
                'data' => [
                    'stats' => [
                        'total' => $totalCustomers,
                        'new' => $newCustomers,
                        'returning' => $returningCustomers,
                        'visits' => $totalVisits,
                    ],
                    'pagination' => [
                        'page' => $page,
                        'perPage' => $perPage,
                        'total' => $totalRecords,
                        'totalPages' => $totalPages,
                    ],
                    'customers' => $customers,
                ]
            ]);

        /* ======================================================
           CUSTOMER VIEW
           ====================================================== */

        case 'customer_by_id':
            requireLogin();

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

            $customer['phone_number'] = normPhone((string)$customer['phone_number']);

            respond([
                'success' => true,
                'data' => $customer
            ]);

        /* ======================================================
           CUSTOMER REGISTER - MYSQL
           Existing Customer Register functions are preserved.
           ====================================================== */

        case 'car_models':
            $stmt = $pdo->query(
                'SELECT brand, car_model
                 FROM car_models
                 ORDER BY brand ASC, car_model ASC'
            );

            respond([
                'success' => true,
                'data' => $stmt->fetchAll()
            ]);

        case 'save_customer':
            $name = clean((string)($input['name'] ?? ''));
            $phone = normPhone((string)($input['phone'] ?? ''));
            $brand = clean((string)($input['brand'] ?? ''));
            $model = clean((string)($input['model'] ?? ''));
            $plate = normPlate((string)($input['plate'] ?? ''));

            if (
                $name === ''
                || $phone === ''
                || $brand === ''
                || $model === ''
                || $plate === ''
            ) {
                respond([
                    'success' => false,
                    'message' => 'Please complete all fields.'
                ], 400);
            }

            $stmt = $pdo->prepare(
                'SELECT
                    customer_code,
                    customer_name,
                    phone_number,
                    car_plate,
                    brand,
                    car_model,
                    visit
                 FROM customer_database
                 WHERE REPLACE(phone_number, " ", "") = ?
                    OR UPPER(REPLACE(car_plate, " ", "")) = ?
                 ORDER BY id DESC
                 LIMIT 1'
            );

            $stmt->execute([$phone, $plate]);
            $customer = $stmt->fetch();

            if ($customer) {
                respond([
                    'success' => true,
                    'status' => 'duplicate',
                    'customer' => [
                        'id' => $customer['customer_code'],
                        'name' => $customer['customer_name'],
                        'phone' => normPhone((string)$customer['phone_number']),
                        'plate' => $customer['car_plate'],
                        'brand' => $customer['brand'],
                        'model' => $customer['car_model'],
                        'visit' => (int)$customer['visit'],
                    ]
                ]);
            }

            $pdo->beginTransaction();

            $temporaryCode = 'TMP-' . bin2hex(random_bytes(8));

            $insert = $pdo->prepare(
                'INSERT INTO customer_database
                    (
                        customer_code,
                        registration_date,
                        customer_name,
                        phone_number,
                        car_plate,
                        brand,
                        car_model,
                        visit,
                        customer_type
                    )
                 VALUES
                    (?, NOW(), ?, ?, ?, ?, ?, 1, "New")'
            );

            $insert->execute([
                $temporaryCode,
                $name,
                $phone,
                $plate,
                $brand,
                $model,
            ]);

            $id = (int)$pdo->lastInsertId();
            $code = 'SP' . str_pad((string)$id, 6, '0', STR_PAD_LEFT);

            $update = $pdo->prepare(
                'UPDATE customer_database
                 SET customer_code = ?
                 WHERE id = ?'
            );

            $update->execute([$code, $id]);
            $pdo->commit();

            respond([
                'success' => true,
                'status' => 'success',
                'id' => $code
            ]);

        case 'save_returning_customer':
            $name = clean((string)($input['name'] ?? ''));
            $phone = normPhone((string)($input['phone'] ?? ''));
            $brand = clean((string)($input['brand'] ?? ''));
            $model = clean((string)($input['model'] ?? ''));
            $plate = normPlate((string)($input['plate'] ?? ''));

            if (
                $name === ''
                || $phone === ''
                || $brand === ''
                || $model === ''
                || $plate === ''
            ) {
                respond([
                    'success' => false,
                    'message' => 'Please complete all fields.'
                ], 400);
            }

            $stmt = $pdo->prepare(
                'SELECT visit
                 FROM customer_database
                 WHERE REPLACE(phone_number, " ", "") = ?
                    OR UPPER(REPLACE(car_plate, " ", "")) = ?
                 ORDER BY visit DESC, id DESC
                 LIMIT 1'
            );

            $stmt->execute([$phone, $plate]);
            $customer = $stmt->fetch();

            if (!$customer) {
                respond([
                    'success' => false,
                    'message' => 'Returning customer record was not found. Please register as a new customer.'
                ], 409);
            }

            $visit = (int)$customer['visit'] + 1;

            $pdo->beginTransaction();

            $temporaryCode = 'TMP-' . bin2hex(random_bytes(8));

            $insert = $pdo->prepare(
                'INSERT INTO customer_database
                    (
                        customer_code,
                        registration_date,
                        customer_name,
                        phone_number,
                        car_plate,
                        brand,
                        car_model,
                        visit,
                        customer_type
                    )
                 VALUES
                    (?, NOW(), ?, ?, ?, ?, ?, ?, "Returning")'
            );

            $insert->execute([
                $temporaryCode,
                $name,
                $phone,
                $plate,
                $brand,
                $model,
                $visit,
            ]);

            $id = (int)$pdo->lastInsertId();
            $code = 'SP' . str_pad((string)$id, 6, '0', STR_PAD_LEFT);

            $update = $pdo->prepare(
                'UPDATE customer_database
                 SET customer_code = ?
                 WHERE id = ?'
            );

            $update->execute([$code, $id]);
            $pdo->commit();

            respond([
                'success' => true,
                'status' => 'success',
                'id' => $code,
                'visit' => $visit
            ]);

        default:
            respond([
                'success' => false,
                'message' => 'Unknown API action.'
            ], 404);
    }
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    /* Do not expose database credentials or SQL details to the browser. */
    error_log('[SP Tinted Manager API] ' . $e->getMessage());

    respond([
        'success' => false,
        'message' => 'Server error.'
    ], 500);
}
