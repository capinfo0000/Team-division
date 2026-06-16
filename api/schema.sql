-- phpMyAdmin で対象データベースを選び、このSQLを「SQL」タブで実行してください。

CREATE TABLE IF NOT EXISTS boards (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  code        VARCHAR(12)  NOT NULL UNIQUE,      -- 他端末で入力するチーム番号
  meeting_id  VARCHAR(40)  NOT NULL,             -- 同じチーム分けをまとめるID
  team_label  VARCHAR(50)  NOT NULL,             -- 例: Aチーム
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notes (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  board_id    INT          NOT NULL,
  category    VARCHAR(20)  NOT NULL DEFAULT 'メモ',  -- 議題/良い点/課題/アイデア/質問/メモ
  body        TEXT         NOT NULL,                 -- 付箋の内容（落書き程度）
  author      VARCHAR(50)  DEFAULT NULL,             -- 任意の名前
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (board_id),
  FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
