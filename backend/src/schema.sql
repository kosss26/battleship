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
