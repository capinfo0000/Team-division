<?php
require __DIR__ . '/db.php';

// 同一オリジン想定だが、別配置でも使えるよう許可しておく
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { exit; }

// 要約しやすいよう、カテゴリは固定セットに限定する
const CATEGORIES = ['議題', '良い点', '課題', 'アイデア', '質問', 'メモ'];

function readJson(): array {
  $d = json_decode(file_get_contents('php://input'), true);
  return is_array($d) ? $d : [];
}
function jsonOut($data, int $status = 200): void {
  http_response_code($status);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($data, JSON_UNESCAPED_UNICODE);
  exit;
}
function genCode(PDO $pdo): string {
  for ($i = 0; $i < 50; $i++) {
    $code = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    $st = $pdo->prepare('SELECT 1 FROM boards WHERE code = ?');
    $st->execute([$code]);
    if (!$st->fetch()) return $code;
  }
  throw new RuntimeException('コード生成に失敗しました');
}
function boardByCode(PDO $pdo, string $code): ?array {
  $st = $pdo->prepare('SELECT * FROM boards WHERE code = ?');
  $st->execute([$code]);
  $b = $st->fetch();
  return $b ?: null;
}

$action = $_GET['action'] ?? '';

try {
  $pdo = db();

  if ($action === 'create_boards') {
    // body: { teams: ["Aチーム", ...] }
    $in = readJson();
    $teams = $in['teams'] ?? [];
    if (!is_array($teams) || count($teams) === 0) jsonOut(['error' => 'teams が必要です'], 400);
    $meeting = bin2hex(random_bytes(8));
    $ins = $pdo->prepare('INSERT INTO boards (code, meeting_id, team_label) VALUES (?, ?, ?)');
    $boards = [];
    foreach ($teams as $label) {
      $label = mb_substr(trim((string)$label), 0, 50);
      if ($label === '') $label = 'チーム';
      $code = genCode($pdo);
      $ins->execute([$code, $meeting, $label]);
      $boards[] = ['code' => $code, 'team_label' => $label];
    }
    jsonOut(['meeting_id' => $meeting, 'boards' => $boards]);
  }

  if ($action === 'get_board') {
    $code = trim((string)($_GET['code'] ?? ''));
    $board = boardByCode($pdo, $code);
    if (!$board) jsonOut(['error' => 'not_found'], 404);
    $st = $pdo->prepare('SELECT id, category, body, author, created_at FROM notes WHERE board_id = ? ORDER BY id ASC');
    $st->execute([$board['id']]);
    jsonOut(['board' => ['code' => $board['code'], 'team_label' => $board['team_label']], 'notes' => $st->fetchAll()]);
  }

  if ($action === 'add_note') {
    // body: { code, category, body, author }
    $in = readJson();
    $code = trim((string)($in['code'] ?? ''));
    $board = boardByCode($pdo, $code);
    if (!$board) jsonOut(['error' => 'not_found'], 404);
    $category = (string)($in['category'] ?? 'メモ');
    if (!in_array($category, CATEGORIES, true)) $category = 'メモ';
    $body = trim((string)($in['body'] ?? ''));
    if ($body === '') jsonOut(['error' => '本文が空です'], 400);
    $body = mb_substr($body, 0, 1000);
    $author = mb_substr(trim((string)($in['author'] ?? '')), 0, 50);
    if ($author === '') $author = null;
    $ins = $pdo->prepare('INSERT INTO notes (board_id, category, body, author) VALUES (?, ?, ?, ?)');
    $ins->execute([$board['id'], $category, $body, $author]);
    $id = (int)$pdo->lastInsertId();
    $st = $pdo->prepare('SELECT id, category, body, author, created_at FROM notes WHERE id = ?');
    $st->execute([$id]);
    jsonOut(['note' => $st->fetch()]);
  }

  if ($action === 'delete_note') {
    // body: { code, id }
    $in = readJson();
    $code = trim((string)($in['code'] ?? ''));
    $id = (int)($in['id'] ?? 0);
    $board = boardByCode($pdo, $code);
    if (!$board) jsonOut(['error' => 'not_found'], 404);
    $del = $pdo->prepare('DELETE FROM notes WHERE id = ? AND board_id = ?');
    $del->execute([$id, $board['id']]);
    jsonOut(['ok' => true]);
  }

  if ($action === 'export_csv') {
    // ?code=XXXXXX で1チーム / ?meeting=xxxx で同じチーム分け全体
    $code = trim((string)($_GET['code'] ?? ''));
    $meeting = trim((string)($_GET['meeting'] ?? ''));
    if ($code !== '') {
      $b = boardByCode($pdo, $code);
      if (!$b) { http_response_code(404); echo 'not found'; exit; }
      $meeting = $b['meeting_id'];
    }
    if ($meeting === '') { http_response_code(400); echo 'code or meeting required'; exit; }

    $st = $pdo->prepare(
      'SELECT b.meeting_id, b.team_label, n.category, n.body, n.author, n.created_at
       FROM notes n JOIN boards b ON n.board_id = b.id
       WHERE b.meeting_id = ?
       ORDER BY b.team_label ASC, n.id ASC'
    );
    $st->execute([$meeting]);

    header('Content-Type: text/csv; charset=UTF-8');
    header('Content-Disposition: attachment; filename="meeting_notes.csv"');
    echo "\xEF\xBB\xBF"; // Excel用BOM
    $out = fopen('php://output', 'w');
    fputcsv($out, ['ミーティングID', 'チーム', 'カテゴリ', 'メモ', '投稿者', '日時']);
    foreach ($st as $r) {
      fputcsv($out, [$r['meeting_id'], $r['team_label'], $r['category'], $r['body'], $r['author'] ?? '', $r['created_at']]);
    }
    fclose($out);
    exit;
  }

  jsonOut(['error' => 'unknown action'], 400);

} catch (Throwable $e) {
  jsonOut(['error' => $e->getMessage()], 500);
}
