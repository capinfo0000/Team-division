-- 【既にDBを作成済みの方向け】付箋をチーム非紐付け（議題単位）に変更する移行SQL。
-- phpMyAdmin で対象DBを選び、このSQLを実行してください。
-- ※ notes（付箋）テーブルを作り直します。既存の付箋データは消えます（テスト段階なら問題なし）。
DROP TABLE IF EXISTS notes;
CREATE TABLE notes (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  meeting_id  VARCHAR(40)  NOT NULL,
  category    VARCHAR(20)  NOT NULL DEFAULT 'メモ',
  body        TEXT         NOT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (meeting_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
