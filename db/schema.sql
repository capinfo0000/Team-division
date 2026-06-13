-- チーム分けアプリ：チームメモ用テーブル
-- Xserver の「MySQL設定」でデータベースとユーザーを作成し、phpMyAdmin で本SQLを実行してください。

CREATE TABLE IF NOT EXISTS team_memo (
  team_code    VARCHAR(16)  NOT NULL,                 -- 別端末で入力する「チーム番号」（一意なコード）
  session_code VARCHAR(16)  NOT NULL,                 -- 同じ回のチームをまとめる集約コード
  team_number  INT          NOT NULL DEFAULT 0,       -- 回の中での連番（1..N）
  team_name    VARCHAR(64)  NOT NULL DEFAULT '',
  members      TEXT         NULL,                     -- メンバー（改行区切り）
  memo         MEDIUMTEXT   NULL,                     -- メモ本文（5W1Hの自由記述）
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (team_code),
  KEY idx_session (session_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
