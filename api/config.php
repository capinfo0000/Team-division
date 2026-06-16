<?php
// ===== Xserver MySQL 接続情報 =====
// ↓ user と pass の2か所を、Xserver「MySQL設定」で作成したMySQLユーザーの
//   ユーザー名・パスワードに書き換えてください。（dbname/host は設定済み）
return [
  'host'    => 'localhost',                 // 接続できない場合は 'mysql3b.xserver.jp' に変更
  'dbname'  => 'xsvx1019657_roundtable',    // 作成済みのデータベース名
  'user'    => 'xsvx1019657_ここを変更',     // ← MySQLユーザー名（例: xsvx1019657_user）
  'pass'    => 'ここにパスワード',            // ← MySQLユーザーのパスワード
  'charset' => 'utf8mb4',
];
