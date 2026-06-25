-- ============================================================
-- Jokemon TCG Inventory - Core Schema
-- Migration 001: Initial tables + RLS
-- ============================================================

-- ── Profiles ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id                UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  username          TEXT UNIQUE,
  display_name      TEXT,
  bio               TEXT,
  avatar_url        TEXT,
  collection_public BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles: public read"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "profiles: owner write"
  ON profiles FOR ALL USING (auth.uid() = id);

-- Auto-create a profile row on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- ── Pokemon Cards Cache ──────────────────────────────────────
-- Source of truth: pokemontcg.io. Shared across all users.
CREATE TABLE IF NOT EXISTS pokemon_cards (
  id                    TEXT PRIMARY KEY,   -- e.g. "sv3pt5-99"
  name                  TEXT NOT NULL,
  set_id                TEXT NOT NULL,
  set_name              TEXT NOT NULL,
  set_series            TEXT,
  set_logo_url          TEXT,
  set_symbol_url        TEXT,
  number                TEXT NOT NULL,
  rarity                TEXT,
  supertype             TEXT,               -- Pokémon | Trainer | Energy
  subtypes              TEXT[],
  hp                    TEXT,
  types                 TEXT[],
  evolves_from          TEXT,
  image_url             TEXT,               -- large
  image_url_small       TEXT,               -- small
  -- TCGPlayer prices keyed by print type
  -- { normal, holofoil, reverseHolofoil, firstEdition, ... }
  -- each value: { low, mid, high, market, directLow }
  tcgplayer_prices      JSONB,
  cardmarket_prices     JSONB,
  price_updated_at      TIMESTAMPTZ,
  -- Full raw API payload for future-proofing
  raw_data              JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE pokemon_cards ENABLE ROW LEVEL SECURITY;

-- Everyone can read the card cache
CREATE POLICY "pokemon_cards: public read"
  ON pokemon_cards FOR SELECT USING (true);

-- Service role writes (API caching layer only)
CREATE POLICY "pokemon_cards: service write"
  ON pokemon_cards FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS pokemon_cards_name_idx   ON pokemon_cards (name);
CREATE INDEX IF NOT EXISTS pokemon_cards_set_id_idx ON pokemon_cards (set_id);

-- ── User Cards (Inventory) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS user_cards (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  card_id          TEXT NOT NULL REFERENCES pokemon_cards(id),

  -- Acquisition
  quantity         INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  condition        TEXT NOT NULL DEFAULT 'NM'
    CHECK (condition IN ('NM','LP','MP','HP','DMG')),
  print_type       TEXT NOT NULL DEFAULT 'normal'
    CHECK (print_type IN (
      'normal','holofoil','reverseHolofoil','firstEdition',
      'shadowless','fullArt','altArt','promo','other'
    )),
  cost_basis       NUMERIC(10,2),   -- per-card avg cost
  acquired_at      DATE,
  acquisition_notes TEXT,
  storage_location  TEXT,           -- "Binder A", "Box 3", etc.

  -- Status
  status           TEXT NOT NULL DEFAULT 'collection'
    CHECK (status IN ('collection','for_sale','pending','traded')),
  is_public        BOOLEAN NOT NULL DEFAULT false,
  asking_price     NUMERIC(10,2),

  -- Grading (Phase 3 prep)
  is_graded        BOOLEAN NOT NULL DEFAULT false,
  grading_company  TEXT,            -- PSA | BGS | CGC
  grade            TEXT,
  cert_number      TEXT,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_cards: owner full access"
  ON user_cards FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "user_cards: public read when public"
  ON user_cards FOR SELECT
  USING (
    is_public = true
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = user_cards.user_id
        AND profiles.collection_public = true
    )
  );

CREATE INDEX IF NOT EXISTS user_cards_user_id_idx ON user_cards (user_id);
CREATE INDEX IF NOT EXISTS user_cards_card_id_idx ON user_cards (card_id);
CREATE INDEX IF NOT EXISTS user_cards_status_idx  ON user_cards (status);

-- ── Sales Log ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  user_card_id     UUID REFERENCES user_cards(id) ON DELETE SET NULL,
  card_id          TEXT REFERENCES pokemon_cards(id),

  -- Snapshot at time of sale (card may be deleted later)
  card_snapshot    JSONB NOT NULL,  -- { name, setName, number, imageUrl, printType, condition }

  quantity_sold    INTEGER NOT NULL DEFAULT 1 CHECK (quantity_sold > 0),
  cost_basis       NUMERIC(10,2),   -- per-card basis at time of sale
  sale_price       NUMERIC(10,2) NOT NULL CHECK (sale_price >= 0), -- total sale amount
  platform         TEXT,            -- eBay | TCGPlayer | Local | Other
  fees             NUMERIC(10,2) NOT NULL DEFAULT 0,
  -- Computed: sale_price - fees - (cost_basis * quantity_sold)
  net_profit       NUMERIC(10,2) GENERATED ALWAYS AS (
    sale_price - fees - (COALESCE(cost_basis, 0) * quantity_sold)
  ) STORED,
  margin_pct       NUMERIC(6,2),    -- set at insert via trigger

  sold_at          DATE NOT NULL DEFAULT CURRENT_DATE,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE sales_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sales_log: owner full access"
  ON sales_log FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS sales_log_user_id_idx ON sales_log (user_id);
CREATE INDEX IF NOT EXISTS sales_log_sold_at_idx ON sales_log (sold_at DESC);

-- ── Wishlist ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wishlist (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  card_id    TEXT NOT NULL REFERENCES pokemon_cards(id),
  print_type TEXT NOT NULL DEFAULT 'any',
  max_price  NUMERIC(10,2),
  priority   INTEGER NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 3),
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, card_id, print_type)
);

ALTER TABLE wishlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wishlist: owner full access"
  ON wishlist FOR ALL USING (auth.uid() = user_id);

-- ── Triggers: updated_at ─────────────────────────────────────
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE PROCEDURE touch_updated_at();

CREATE TRIGGER user_cards_updated_at
  BEFORE UPDATE ON user_cards
  FOR EACH ROW EXECUTE PROCEDURE touch_updated_at();

-- ── Trigger: margin_pct on sales_log ────────────────────────
CREATE OR REPLACE FUNCTION calc_margin_pct()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  total_cost NUMERIC;
BEGIN
  total_cost := COALESCE(NEW.cost_basis, 0) * NEW.quantity_sold;
  IF total_cost > 0 THEN
    NEW.margin_pct := ROUND(((NEW.sale_price - NEW.fees - total_cost) / total_cost) * 100, 2);
  ELSE
    NEW.margin_pct := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sales_log_margin
  BEFORE INSERT OR UPDATE ON sales_log
  FOR EACH ROW EXECUTE PROCEDURE calc_margin_pct();
