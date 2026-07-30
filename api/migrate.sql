-- 【既にDBを作成済みの方向け】移行SQL。phpMyAdmin で対象DBを選び実行してください。

-- 社員一覧テーブルを追加
CREATE TABLE IF NOT EXISTS employees (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(50)  NOT NULL,
  age         INT          NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 保存グループテーブルを追加
CREATE TABLE IF NOT EXISTS member_groups (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(50)  NOT NULL,
  members     TEXT         NOT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 議題ごとのラベル列を追加（既存meetingsに無ければ追加）
-- ※ MariaDB は IF NOT EXISTS 対応。既に列があってもエラーで止まらない。
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS categories TEXT NULL;

-- 議題の詳細列を追加（既存meetingsに無ければ追加）
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS detail TEXT NULL;

-- 付箋を「チーム（board）単位で表示分離」できるように作り直す。
-- 表示は board_id 単位（各チームは自分の付箋だけ）／集計・CSVは meeting_id 単位で合算（匿名）。
-- （既存の付箋データは消えます／テスト段階なら問題なし）
DROP TABLE IF EXISTS notes;
CREATE TABLE notes (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  meeting_id  VARCHAR(40)  NOT NULL,
  board_id    INT          NULL,
  category    VARCHAR(20)  NOT NULL DEFAULT 'メモ',
  body        TEXT         NOT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (meeting_id),
  INDEX (board_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 【既に board_id なしの notes を使っている方向け】列だけ追加する場合はこちら（上のDROPの代わり）:
-- ALTER TABLE notes ADD COLUMN board_id INT NULL AFTER meeting_id;
-- ALTER TABLE notes ADD INDEX (board_id);
