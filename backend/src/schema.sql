CREATE TABLE IF NOT EXISTS users (
  id           BIGSERIAL PRIMARY KEY,
  tg_id        BIGINT UNIQUE,
  username     TEXT,
  first_name   TEXT NOT NULL DEFAULT 'Player',
  last_name    TEXT,
  photo_url    TEXT,
  tg_premium   BOOLEAN NOT NULL DEFAULT FALSE,
  language     TEXT NOT NULL DEFAULT 'ru',
  rating       INT NOT NULL DEFAULT 1000,
  peak_rating  INT NOT NULL DEFAULT 1000,
  gold         INT NOT NULL DEFAULT 0 CHECK (gold >= 0),
  gems         INT NOT NULL DEFAULT 0 CHECK (gems >= 0),
  xp           INT NOT NULL DEFAULT 0,
  level        INT NOT NULL DEFAULT 1,
  games        INT NOT NULL DEFAULT 0,
  wins         INT NOT NULL DEFAULT 0,
  ref_code     TEXT UNIQUE NOT NULL,
  referred_by  BIGINT REFERENCES users(id),
  data         JSONB NOT NULL DEFAULT '{}'::jsonb,
  banned       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS users_rating_idx ON users (rating DESC) WHERE games > 0;
CREATE INDEX IF NOT EXISTS users_referred_by_idx ON users (referred_by);

CREATE TABLE IF NOT EXISTS games (
  id           UUID PRIMARY KEY,
  mode         TEXT NOT NULL,
  difficulty   TEXT,
  p1           BIGINT REFERENCES users(id),
  p2           BIGINT REFERENCES users(id),
  winner       BIGINT REFERENCES users(id),
  winner_slot  SMALLINT,
  reason       TEXT,
  p1_delta     INT NOT NULL DEFAULT 0,
  p2_delta     INT NOT NULL DEFAULT 0,
  shots        INT NOT NULL DEFAULT 0,
  duration_ms  INT NOT NULL DEFAULT 0,
  moves        JSONB NOT NULL DEFAULT '[]'::jsonb,
  ended_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS games_p1_idx ON games (p1, ended_at DESC);
CREATE INDEX IF NOT EXISTS games_p2_idx ON games (p2, ended_at DESC);
CREATE INDEX IF NOT EXISTS games_winner_idx ON games (winner, ended_at DESC);

CREATE TABLE IF NOT EXISTS payments (
  id                 BIGSERIAL PRIMARY KEY,
  user_id            BIGINT NOT NULL REFERENCES users(id),
  product_id         TEXT NOT NULL,
  stars              INT NOT NULL,
  charge_id          TEXT UNIQUE NOT NULL,
  status             TEXT NOT NULL DEFAULT 'paid',
  payload            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payments_user_idx ON payments (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS admin_log (
  id          BIGSERIAL PRIMARY KEY,
  admin_id    BIGINT NOT NULL REFERENCES users(id),
  action      TEXT NOT NULL,
  target_id   BIGINT REFERENCES users(id),
  details     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_log_created_idx ON admin_log (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_log_target_idx ON admin_log (target_id, created_at DESC);

ALTER TABLE payments ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS revoked JSONB;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason TEXT;

CREATE TABLE IF NOT EXISTS friendships (
  a            BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  b            BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending',
  requested_by BIGINT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (a, b),
  CHECK (a < b)
);
CREATE INDEX IF NOT EXISTS friendships_b_idx ON friendships (b);

-- Players who joined via an invite link are friends with the inviter
INSERT INTO friendships (a, b, status, requested_by)
  SELECT LEAST(id, referred_by), GREATEST(id, referred_by), 'accepted', referred_by
    FROM users WHERE referred_by IS NOT NULL AND referred_by <> id
  ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS season_results (
  season     TEXT NOT NULL,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating     INT NOT NULL,
  rank       TEXT NOT NULL,
  place      INT,
  games      INT NOT NULL,
  wins       INT NOT NULL,
  reward     JSONB NOT NULL DEFAULT '{}'::jsonb,
  claimed    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (season, user_id)
);
CREATE INDEX IF NOT EXISTS season_results_user_idx ON season_results (user_id, season DESC);
CREATE INDEX IF NOT EXISTS games_ranked_idx ON games (ended_at) WHERE mode = 'ranked';

CREATE TABLE IF NOT EXISTS ad_views (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  placement  TEXT NOT NULL,
  verified   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ad_views_created_idx ON ad_views (created_at DESC);

-- One row per player per active day (UTC) — the basis for DAU and retention
CREATE TABLE IF NOT EXISTS user_activity (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day     DATE NOT NULL,
  PRIMARY KEY (user_id, day)
);
CREATE INDEX IF NOT EXISTS user_activity_day_idx ON user_activity (day);
INSERT INTO user_activity (user_id, day)
  SELECT id, created_at::date FROM users
  UNION SELECT id, last_seen::date FROM users
  ON CONFLICT DO NOTHING;

-- Victory cards for Telegram Stories (kept for a week)
CREATE TABLE IF NOT EXISTS share_cards (
  id         UUID PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  png        BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS share_cards_created_idx ON share_cards (created_at);
CREATE INDEX IF NOT EXISTS share_cards_user_idx ON share_cards (user_id, created_at DESC);
