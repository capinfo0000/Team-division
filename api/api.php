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
    // body: { title?: "議題名", teams: ["Aチーム", ...] }
    $in = readJson();
    $teams = $in['teams'] ?? [];
    if (!is_array($teams) || count($teams) === 0) jsonOut(['error' => 'teams が必要です'], 400);
    $title = mb_substr(trim((string)($in['title'] ?? '')), 0, 100);

    // メンバー記入欄のひな形（役割名 + メンバー）を作る
    $roleNames = $in['roles'] ?? [];
    $lines = [];
    if (is_array($roleNames)) {
      foreach ($roleNames as $rn) {
        $rn = trim((string)$rn);
        if ($rn !== '') $lines[] = $rn . '：';
      }
    }
    $lines[] = 'メンバー：';
    $roster = implode("\n", $lines);

    $meeting = bin2hex(random_bytes(8));
    $pdo->prepare('INSERT INTO meetings (meeting_id, title, team_count) VALUES (?, ?, ?)')
        ->execute([$meeting, $title, count($teams)]);
    $ins = $pdo->prepare('INSERT INTO boards (code, meeting_id, team_label, roster) VALUES (?, ?, ?, ?)');
    $boards = [];
    foreach ($teams as $label) {
      $label = mb_substr(trim((string)$label), 0, 50);
      if ($label === '') $label = 'チーム';
      $code = genCode($pdo);
      $ins->execute([$code, $meeting, $label, $roster]);
      $boards[] = ['code' => $code, 'team_label' => $label];
    }
    jsonOut(['meeting_id' => $meeting, 'title' => $title, 'boards' => $boards]);
  }

  if ($action === 'list_meetings') {
    // ミーティング（議題）単位の一覧。古いデータ（meetings行なし）も拾う。
    $sql =
      "SELECT b.meeting_id,
              COALESCE(m.title, '') AS title,
              COUNT(DISTINCT b.id) AS team_count,
              MIN(b.created_at) AS created_at,
              (SELECT COUNT(*) FROM notes n JOIN boards bb ON n.board_id = bb.id
               WHERE bb.meeting_id = b.meeting_id) AS note_count
       FROM boards b
       LEFT JOIN meetings m ON m.meeting_id = b.meeting_id
       GROUP BY b.meeting_id, m.title
       ORDER BY created_at DESC";
    jsonOut(['meetings' => $pdo->query($sql)->fetchAll()]);
  }

  if ($action === 'aggregate') {
    // ?meeting=xxx → そのミーティングの集計
    $meeting = trim((string)($_GET['meeting'] ?? ''));
    if ($meeting === '') jsonOut(['error' => 'meeting required'], 400);

    $mt = $pdo->prepare('SELECT title, team_count, created_at FROM meetings WHERE meeting_id = ?');
    $mt->execute([$meeting]);
    $meta = $mt->fetch() ?: ['title' => '', 'team_count' => 0, 'created_at' => null];

    $byCat = $pdo->prepare(
      'SELECT n.category, COUNT(*) AS cnt
       FROM notes n JOIN boards b ON n.board_id = b.id
       WHERE b.meeting_id = ? GROUP BY n.category ORDER BY cnt DESC'
    );
    $byCat->execute([$meeting]);

    $byTeam = $pdo->prepare(
      'SELECT b.team_label, COUNT(n.id) AS cnt
       FROM boards b LEFT JOIN notes n ON n.board_id = b.id
       WHERE b.meeting_id = ? GROUP BY b.id ORDER BY b.team_label ASC'
    );
    $byTeam->execute([$meeting]);

    $total = $pdo->prepare(
      'SELECT COUNT(*) FROM notes n JOIN boards b ON n.board_id = b.id WHERE b.meeting_id = ?'
    );
    $total->execute([$meeting]);

    jsonOut([
      'meeting_id'   => $meeting,
      'title'        => $meta['title'],
      'team_count'   => (int)$meta['team_count'],
      'created_at'   => $meta['created_at'],
      'total_notes'  => (int)$total->fetchColumn(),
      'by_category'  => $byCat->fetchAll(),
      'by_team'      => $byTeam->fetchAll(),
    ]);
  }

  if ($action === 'get_board') {
    $code = trim((string)($_GET['code'] ?? ''));
    $board = boardByCode($pdo, $code);
    if (!$board) jsonOut(['error' => 'not_found'], 404);
    $st = $pdo->prepare('SELECT id, category, body, author, created_at FROM notes WHERE board_id = ? ORDER BY id ASC');
    $st->execute([$board['id']]);
    jsonOut([
      'board' => ['code' => $board['code'], 'team_label' => $board['team_label'], 'roster' => $board['roster']],
      'notes' => $st->fetchAll()
    ]);
  }

  if ($action === 'save_roster') {
    // body: { code, roster }
    $in = readJson();
    $code = trim((string)($in['code'] ?? ''));
    $board = boardByCode($pdo, $code);
    if (!$board) jsonOut(['error' => 'not_found'], 404);
    $roster = mb_substr((string)($in['roster'] ?? ''), 0, 2000);
    $pdo->prepare('UPDATE boards SET roster = ? WHERE id = ?')->execute([$roster, $board['id']]);
    jsonOut(['ok' => true]);
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
      'SELECT b.meeting_id, COALESCE(m.title, \'\') AS title, b.team_label, n.category, n.body, n.author, n.created_at
       FROM notes n
       JOIN boards b ON n.board_id = b.id
       LEFT JOIN meetings m ON m.meeting_id = b.meeting_id
       WHERE b.meeting_id = ?
       ORDER BY b.team_label ASC, n.id ASC'
    );
    $st->execute([$meeting]);

    header('Content-Type: text/csv; charset=UTF-8');
    header('Content-Disposition: attachment; filename="meeting_notes.csv"');
    echo "\xEF\xBB\xBF"; // Excel用BOM
    $out = fopen('php://output', 'w');
    fputcsv($out, ['ミーティングID', '議題', 'チーム', 'カテゴリ', 'メモ', '投稿者', '日時']);
    foreach ($st as $r) {
      fputcsv($out, [$r['meeting_id'], $r['title'], $r['team_label'], $r['category'], $r['body'], $r['author'] ?? '', $r['created_at']]);
    }
    fclose($out);
    exit;
  }

  jsonOut(['error' => 'unknown action'], 400);

} catch (Throwable $e) {
  jsonOut(['error' => $e->getMessage()], 500);
}
