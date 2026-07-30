-- phpMyAdmin で対象データベースを選び、このSQL全体を「SQL」タブに貼り付けて1回実行するだけで
-- 必要な3テーブル（meetings / boards / notes）がまとめて作成されます。

-- 社員一覧（名前・年齢）。チーム分けのメンバー候補にも使う。
CREATE TABLE IF NOT EXISTS employees (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(50)  NOT NULL,
  age         INT          NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 保存グループ（選択中メンバーの組み合わせ）
CREATE TABLE IF NOT EXISTS member_groups (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(50)  NOT NULL,
  members     TEXT         NOT NULL,   -- 改行区切りの名前
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS meetings (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  meeting_id  VARCHAR(40)  NOT NULL UNIQUE,      -- 1回のチーム分け＝1ミーティング
  title       VARCHAR(100) NOT NULL DEFAULT '',  -- 議題名
  detail      TEXT         NULL,                 -- 議題の詳細（メモ帳上部に表示）
  team_count  INT          NOT NULL DEFAULT 0,
  categories  TEXT         NULL,                 -- メモのラベル（改行区切り・議題ごと）
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS boards (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  code        VARCHAR(12)  NOT NULL UNIQUE,      -- 他端末で入力するチーム番号
  meeting_id  VARCHAR(40)  NOT NULL,             -- 同じチーム分けをまとめるID
  team_label  VARCHAR(50)  NOT NULL,             -- 例: Aチーム
  roster      TEXT         NULL,                 -- メンバー/役割の記入欄（司会：… など）
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 付箋メモ。表示はチーム（board）単位で分離し、各チームは自分の付箋だけ見られる。
-- 集計・CSVは meeting 単位で全チームを合算し、チーム名・メンバーは出さない（匿名）。
CREATE TABLE IF NOT EXISTS notes (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  meeting_id  VARCHAR(40)  NOT NULL,                 -- 議題（ミーティング）単位。集計はこの単位で合算
  board_id    INT          NULL,                     -- どのチーム（board）の付箋か。表示はこの単位で分離
  category    VARCHAR(20)  NOT NULL DEFAULT 'メモ',  -- 議題/良い点/課題/アイデア/質問/メモ
  body        TEXT         NOT NULL,                 -- 付箋の内容（落書き程度）
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (meeting_id),
  INDEX (board_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
