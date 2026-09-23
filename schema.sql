CREATE TABLE IF NOT EXISTS questions (
  id BIGSERIAL PRIMARY KEY,
  question TEXT NOT NULL CHECK (length(trim(question)) > 0),
  option_one TEXT NOT NULL CHECK (length(trim(option_one)) > 0),
  option_two TEXT NOT NULL CHECK (length(trim(option_two)) > 0),
  correct_option SMALLINT NOT NULL CHECK (correct_option IN (0, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS player_scores (
  player_id UUID PRIMARY KEY,
  best_score INTEGER NOT NULL DEFAULT 0 CHECK (best_score >= 0),
  best_total INTEGER NOT NULL DEFAULT 0 CHECK (best_total >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
