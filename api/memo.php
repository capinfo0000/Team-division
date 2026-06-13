<?php
declare(strict_types=1);

// チームメモ用のシンプルなREST API（PHP + MySQL/PDO）
// エンドポイント:
//   POST ?action=create  body: { teams:[{team_number, team_name, members:[...]}] }
//        → { session_code, teams:[{team_number, team_name, team_code}] }
//   GET  ?team=CODE       → { team_code, session_code, team_number, team_name, members, memo, updated_at }
//   POST ?action=save     body: { team_code, memo } → { ok:true }
//   GET  ?session=CODE     → { session_code, teams:[...] }（幹事の集約・CSV用）

$cfgFile = __DIR__ . '/config.php';
$cfg = is_file($cfgFile) ? require $cfgFile : null;

$cors = (is_array($cfg) && isset($cfg['cors_origin'])) ? (string)$cfg['cors_origin'] : '';
if ($cors !== '') {
    header('Access-Control-Allow-Origin: ' . $cors);
    header('Vary: Origin');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
}
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function jexit(int $code, array $data): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

if (!is_array($cfg)) {
    jexit(500, ['error' => 'config_missing', 'message' => 'config.php を作成してください（config.sample.php を参照）']);
}

try {
    $dsn = sprintf(
        'mysql:host=%s;dbname=%s;charset=%s',
        $cfg['db_host'], $cfg['db_name'], $cfg['db_charset'] ?? 'utf8mb4'
    );
    $pdo = new PDO($dsn, $cfg['db_user'], $cfg['db_pass'], [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
} catch (Throwable $e) {
    jexit(500, ['error' => 'db_connect_failed']);
}

function body_json(): array {
    $raw = file_get_contents('php://input');
    $d = json_decode($raw ?: '', true);
    return is_array($d) ? $d : [];
}

// 重複しない6桁コードを生成（team_code / session_code 共通）
function gen_unique(PDO $pdo, string $col): string {
    for ($i = 0; $i < 30; $i++) {
        $code = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $st = $pdo->prepare("SELECT 1 FROM team_memo WHERE {$col} = ? LIMIT 1");
        $st->execute([$code]);
        if (!$st->fetch()) {
            return $code;
        }
    }
    throw new RuntimeException('code_generation_failed');
}

$method = $_SERVER['REQUEST_METHOD'];
$action = isset($_GET['action']) ? (string)$_GET['action'] : '';

try {
    if ($method === 'POST' && $action === 'create') {
        $d = body_json();
        $teams = (isset($d['teams']) && is_array($d['teams'])) ? $d['teams'] : [];
        if (!$teams) {
            jexit(400, ['error' => 'no_teams']);
        }

        $session = gen_unique($pdo, 'session_code');
        $ins = $pdo->prepare(
            "INSERT INTO team_memo (team_code, session_code, team_number, team_name, members, memo)
             VALUES (?, ?, ?, ?, ?, '')"
        );
        $out = [];
        foreach ($teams as $t) {
            $code    = gen_unique($pdo, 'team_code');
            $num     = (int)($t['team_number'] ?? 0);
            $name    = mb_substr((string)($t['team_name'] ?? ''), 0, 64);
            $members = '';
            if (isset($t['members'])) {
                $members = is_array($t['members']) ? implode("\n", $t['members']) : (string)$t['members'];
            }
            $ins->execute([$code, $session, $num, $name, $members]);
            $out[] = ['team_number' => $num, 'team_name' => $name, 'team_code' => $code];
        }
        jexit(200, ['session_code' => $session, 'teams' => $out]);
    }

    if ($method === 'POST' && $action === 'save') {
        $d    = body_json();
        $code = (string)($d['team_code'] ?? '');
        $memo = (string)($d['memo'] ?? '');
        if ($code === '') {
            jexit(400, ['error' => 'no_team_code']);
        }
        $st = $pdo->prepare("UPDATE team_memo SET memo = ? WHERE team_code = ?");
        $st->execute([$memo, $code]);
        // rowCount が 0 でも「内容が同じ」だけのことがあるので存在確認する
        $chk = $pdo->prepare("SELECT 1 FROM team_memo WHERE team_code = ? LIMIT 1");
        $chk->execute([$code]);
        if (!$chk->fetch()) {
            jexit(404, ['error' => 'not_found']);
        }
        jexit(200, ['ok' => true]);
    }

    if ($method === 'GET' && isset($_GET['team'])) {
        $code = (string)$_GET['team'];
        $st = $pdo->prepare(
            "SELECT team_code, session_code, team_number, team_name, members, memo, updated_at
             FROM team_memo WHERE team_code = ?"
        );
        $st->execute([$code]);
        $row = $st->fetch();
        if (!$row) {
            jexit(404, ['error' => 'not_found']);
        }
        jexit(200, $row);
    }

    if ($method === 'GET' && isset($_GET['session'])) {
        $s = (string)$_GET['session'];
        $st = $pdo->prepare(
            "SELECT team_code, team_number, team_name, members, memo, updated_at
             FROM team_memo WHERE session_code = ? ORDER BY team_number"
        );
        $st->execute([$s]);
        jexit(200, ['session_code' => $s, 'teams' => $st->fetchAll()]);
    }

    jexit(400, ['error' => 'bad_request']);
} catch (Throwable $e) {
    jexit(500, ['error' => 'server_error']);
}
