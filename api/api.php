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

    // 議題ごとのラベル（カテゴリ）。未指定なら中立なデフォルト。
    $cats = $in['categories'] ?? [];
    $catList = [];
    if (is_array($cats)) {
      foreach ($cats as $c) { $c = mb_substr(trim((string)$c), 0, 20); if ($c !== '') $catList[] = $c; }
    }
    if (count($catList) === 0) $catList = ['意見', '質問', 'アイデア', '感想', 'その他'];
    $catText = implode("\n", $catList);

    $meeting = bin2hex(random_bytes(8));
    $pdo->prepare('INSERT INTO meetings (meeting_id, title, team_count, categories) VALUES (?, ?, ?, ?)')
        ->execute([$meeting, $title, count($teams), $catText]);
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

  if ($action === 'list_employees') {
    $rows = $pdo->query('SELECT id, name, age FROM employees ORDER BY name ASC')->fetchAll();
    jsonOut(['employees' => $rows]);
  }

  if ($action === 'save_employee') {
    // body: { id?, name, age }
    $in = readJson();
    $name = mb_substr(trim((string)($in['name'] ?? '')), 0, 50);
    if ($name === '') jsonOut(['error' => '名前が必要です'], 400);
    $ageRaw = $in['age'] ?? '';
    $age = ($ageRaw === '' || $ageRaw === null) ? null : (int)$ageRaw;
    $id = (int)($in['id'] ?? 0);
    if ($id > 0) {
      $pdo->prepare('UPDATE employees SET name = ?, age = ? WHERE id = ?')->execute([$name, $age, $id]);
    } else {
      $pdo->prepare('INSERT INTO employees (name, age) VALUES (?, ?)')->execute([$name, $age]);
      $id = (int)$pdo->lastInsertId();
    }
    jsonOut(['employee' => ['id' => $id, 'name' => $name, 'age' => $age]]);
  }

  if ($action === 'delete_employee') {
    $in = readJson();
    $id = (int)($in['id'] ?? 0);
    $pdo->prepare('DELETE FROM employees WHERE id = ?')->execute([$id]);
    jsonOut(['ok' => true]);
  }

  if ($action === 'list_groups') {
    $rows = $pdo->query('SELECT id, name, members FROM member_groups ORDER BY name ASC')->fetchAll();
    $groups = array_map(function ($g) {
      $members = array_values(array_filter(array_map('trim', explode("\n", (string)$g['members'])), function ($s) { return $s !== ''; }));
      return ['id' => (int)$g['id'], 'name' => $g['name'], 'members' => $members];
    }, $rows);
    jsonOut(['groups' => $groups]);
  }

  if ($action === 'save_group') {
    // body: { name, members: [...] }
    $in = readJson();
    $name = mb_substr(trim((string)($in['name'] ?? '')), 0, 50);
    if ($name === '') jsonOut(['error' => 'グループ名が必要です'], 400);
    $members = $in['members'] ?? [];
    if (!is_array($members) || count($members) === 0) jsonOut(['error' => 'メンバーがいません'], 400);
    $clean = [];
    foreach ($members as $m) {
      $m = mb_substr(trim((string)$m), 0, 30);
      if ($m !== '') $clean[] = $m;
    }
    $text = implode("\n", $clean);
    // 同名は上書き
    $ex = $pdo->prepare('SELECT id FROM member_groups WHERE name = ?');
    $ex->execute([$name]);
    $row = $ex->fetch();
    if ($row) {
      $pdo->prepare('UPDATE member_groups SET members = ? WHERE id = ?')->execute([$text, $row['id']]);
      $id = (int)$row['id'];
    } else {
      $pdo->prepare('INSERT INTO member_groups (name, members) VALUES (?, ?)')->execute([$name, $text]);
      $id = (int)$pdo->lastInsertId();
    }
    jsonOut(['group' => ['id' => $id, 'name' => $name, 'members' => $clean]]);
  }

  if ($action === 'delete_group') {
    $in = readJson();
    $id = (int)($in['id'] ?? 0);
    $pdo->prepare('DELETE FROM member_groups WHERE id = ?')->execute([$id]);
    jsonOut(['ok' => true]);
  }

  if ($action === 'list_meetings') {
    // ミーティング（議題）単位の一覧。古いデータ（meetings行なし）も拾う。
    $sql =
      "SELECT b.meeting_id,
              COALESCE(m.title, '') AS title,
              COUNT(DISTINCT b.id) AS team_count,
              MIN(b.created_at) AS created_at,
              (SELECT COUNT(*) FROM notes n WHERE n.meeting_id = b.meeting_id) AS note_count
       FROM boards b
       LEFT JOIN meetings m ON m.meeting_id = b.meeting_id
       GROUP BY b.meeting_id, m.title
       ORDER BY created_at DESC";
    $meetings = $pdo->query($sql)->fetchAll();
    // 各ミーティングのチーム番号（再確認・ボードを開く用）
    $bs = $pdo->query('SELECT meeting_id, code, team_label FROM boards ORDER BY team_label ASC')->fetchAll();
    $byMeeting = [];
    foreach ($bs as $b) {
      $byMeeting[$b['meeting_id']][] = ['code' => $b['code'], 'team_label' => $b['team_label']];
    }
    foreach ($meetings as &$mm) {
      $mm['boards'] = $byMeeting[$mm['meeting_id']] ?? [];
    }
    unset($mm);
    jsonOut(['meetings' => $meetings]);
  }

  if ($action === 'aggregate') {
    // ?meeting=xxx → そのミーティングの集計
    $meeting = trim((string)($_GET['meeting'] ?? ''));
    if ($meeting === '') jsonOut(['error' => 'meeting required'], 400);

    $mt = $pdo->prepare('SELECT title, team_count, created_at FROM meetings WHERE meeting_id = ?');
    $mt->execute([$meeting]);
    $meta = $mt->fetch() ?: ['title' => '', 'team_count' => 0, 'created_at' => null];

    // チーム別は出さない（匿名化）。カテゴリ別と合計のみ。
    $byCat = $pdo->prepare(
      'SELECT category, COUNT(*) AS cnt FROM notes
       WHERE meeting_id = ? GROUP BY category ORDER BY cnt DESC'
    );
    $byCat->execute([$meeting]);

    $total = $pdo->prepare('SELECT COUNT(*) FROM notes WHERE meeting_id = ?');
    $total->execute([$meeting]);

    // 意見（付箋本文）もカテゴリ順に返す（同じ議題の全チーム分を合算）
    $ns = $pdo->prepare('SELECT category, body, created_at FROM notes WHERE meeting_id = ? ORDER BY category ASC, id ASC');
    $ns->execute([$meeting]);

    jsonOut([
      'meeting_id'   => $meeting,
      'title'        => $meta['title'],
      'team_count'   => (int)$meta['team_count'],
      'created_at'   => $meta['created_at'],
      'total_notes'  => (int)$total->fetchColumn(),
      'by_category'  => $byCat->fetchAll(),
      'notes'        => $ns->fetchAll(),
    ]);
  }

  if ($action === 'get_board') {
    $code = trim((string)($_GET['code'] ?? ''));
    $board = boardByCode($pdo, $code);
    if (!$board) jsonOut(['error' => 'not_found'], 404);
    // 付箋は議題(meeting)単位で共有。チームには紐付けない。
    $st = $pdo->prepare('SELECT id, category, body, created_at FROM notes WHERE meeting_id = ? ORDER BY id ASC');
    $st->execute([$board['meeting_id']]);
    // 議題ごとのラベル
    $mc = $pdo->prepare('SELECT categories FROM meetings WHERE meeting_id = ?');
    $mc->execute([$board['meeting_id']]);
    $catText = (string)($mc->fetchColumn() ?: '');
    $cats = array_values(array_filter(array_map('trim', explode("\n", $catText)), function ($s) { return $s !== ''; }));
    if (count($cats) === 0) $cats = ['意見', '質問', 'アイデア', '感想', 'その他'];
    jsonOut([
      'board' => ['code' => $board['code'], 'team_label' => $board['team_label'], 'roster' => $board['roster']],
      'categories' => $cats,
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
    // body: { code, category, body }  ※チームは保存しない
    $in = readJson();
    $code = trim((string)($in['code'] ?? ''));
    $board = boardByCode($pdo, $code);
    if (!$board) jsonOut(['error' => 'not_found'], 404);
    // カテゴリは議題ごとに自由なので、空でなければそのまま採用
    $category = mb_substr(trim((string)($in['category'] ?? '')), 0, 20);
    if ($category === '') $category = 'メモ';
    $body = trim((string)($in['body'] ?? ''));
    if ($body === '') jsonOut(['error' => '本文が空です'], 400);
    $body = mb_substr($body, 0, 5000);
    $ins = $pdo->prepare('INSERT INTO notes (meeting_id, category, body) VALUES (?, ?, ?)');
    $ins->execute([$board['meeting_id'], $category, $body]);
    $id = (int)$pdo->lastInsertId();
    $st = $pdo->prepare('SELECT id, category, body, created_at FROM notes WHERE id = ?');
    $st->execute([$id]);
    jsonOut(['note' => $st->fetch()]);
  }

  if ($action === 'update_note') {
    // body: { code, id, body, category? }  付箋の編集
    $in = readJson();
    $code = trim((string)($in['code'] ?? ''));
    $board = boardByCode($pdo, $code);
    if (!$board) jsonOut(['error' => 'not_found'], 404);
    $id = (int)($in['id'] ?? 0);
    $body = trim((string)($in['body'] ?? ''));
    if ($body === '') jsonOut(['error' => '本文が空です'], 400);
    $body = mb_substr($body, 0, 5000);
    if (isset($in['category'])) {
      $category = mb_substr(trim((string)$in['category']), 0, 20);
      if ($category === '') $category = 'メモ';
      $pdo->prepare('UPDATE notes SET body = ?, category = ? WHERE id = ? AND meeting_id = ?')
          ->execute([$body, $category, $id, $board['meeting_id']]);
    } else {
      $pdo->prepare('UPDATE notes SET body = ? WHERE id = ? AND meeting_id = ?')
          ->execute([$body, $id, $board['meeting_id']]);
    }
    jsonOut(['ok' => true]);
  }

  if ($action === 'delete_note') {
    // body: { code, id }
    $in = readJson();
    $code = trim((string)($in['code'] ?? ''));
    $id = (int)($in['id'] ?? 0);
    $board = boardByCode($pdo, $code);
    if (!$board) jsonOut(['error' => 'not_found'], 404);
    $del = $pdo->prepare('DELETE FROM notes WHERE id = ? AND meeting_id = ?');
    $del->execute([$id, $board['meeting_id']]);
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

    // チーム・メンバー・投稿者は出さない（匿名化）。議題＋カテゴリ＋メモのみ。
    $st = $pdo->prepare(
      'SELECT COALESCE(m.title, \'\') AS title, n.category, n.body, n.created_at
       FROM notes n
       LEFT JOIN meetings m ON m.meeting_id = n.meeting_id
       WHERE n.meeting_id = ?
       ORDER BY n.id ASC'
    );
    $st->execute([$meeting]);

    header('Content-Type: text/csv; charset=UTF-8');
    header('Content-Disposition: attachment; filename="meeting_notes.csv"');
    echo "\xEF\xBB\xBF"; // Excel用BOM
    $out = fopen('php://output', 'w');
    fputcsv($out, ['議題', 'カテゴリ', 'メモ', '日時']);
    foreach ($st as $r) {
      fputcsv($out, [$r['title'], $r['category'], $r['body'], $r['created_at']]);
    }
    fclose($out);
    exit;
  }

  jsonOut(['error' => 'unknown action'], 400);

} catch (Throwable $e) {
  jsonOut(['error' => $e->getMessage()], 500);
}
