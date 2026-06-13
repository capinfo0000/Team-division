<?php
// このファイルを「config.php」という名前でコピーし、本番のDB情報に書き換えてください。
// （config.php は .htaccess で外部アクセス禁止＆Git管理外にしています）
//
// Xserver の場合:
//   サーバーパネル → MySQL設定 でデータベース／ユーザーを作成し、
//   表示される「MySQLホスト名（例: mysqlXXXX.xserver.jp）」「DB名」「ユーザー名」「パスワード」を設定。

return [
  'db_host'    => 'mysqlXXXX.xserver.jp', // XserverのMySQLホスト名
  'db_name'    => 'xxxxx_teamdiv',
  'db_user'    => 'xxxxx_user',
  'db_pass'    => 'YOUR_DB_PASSWORD',
  'db_charset' => 'utf8mb4',

  // 画面を別ドメイン（例: GitHub Pages）から呼ぶ場合に許可するオリジン（CORS）。
  //   同じXserver上に画面も置くなら '' のままでOK（同一オリジンなのでCORS不要）。
  //   例: 'https://capinfo0000.github.io'    すべて許可: '*'
  'cors_origin' => '',
];
