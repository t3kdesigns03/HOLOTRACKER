-- ============================================================
-- HOLOTracker - HoloCase QR System
-- Migration 002: cases table + tags + RLS + public RPC
-- ============================================================

-- ── Tags on inventory items ──────────────────────────────────
ALTER TABLE user_cards
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

-- ── Short code generator ─────────────────────────────────────
-- HC- + 6 chars from an unambiguous alphabet (no 0/O/1/I/L).
-- 31^6 ≈ 887M combinations; loops until unique.
CREATE OR REPLACE FUNCTION generate_case_short_code()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  alphabet CONSTANT TEXT := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  code TEXT;
BEGIN
  LOOP
    code := 'HC-';
    FOR i IN 1..6 LOOP
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::INT, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM cases WHERE short_code = code);
  END LOOP;
  RETURN code;
END;
$$;

-- ── Cases ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cases (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  short_code    TEXT NOT NULL UNIQUE DEFAULT generate_case_short_code(),
  -- Nullable: a case can exist (and be printed) before a card is inside it.
  -- Multiple cases may point at the same inventory row (quantity > 1).
  user_card_id  UUID REFERENCES user_cards(id) ON DELETE SET NULL,

  location      TEXT,            -- physical location, owner-only ("Binder A, page 3")
  notes         TEXT,            -- shown publicly only when show_notes = true

  -- Public visibility controls
  is_public     BOOLEAN NOT NULL DEFAULT true,
  show_value    BOOLEAN NOT NULL DEFAULT true,
  show_grade    BOOLEAN NOT NULL DEFAULT true,
  show_notes    BOOLEAN NOT NULL DEFAULT false,
  show_tags     BOOLEAN NOT NULL DEFAULT true,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE cases ENABLE ROW LEVEL SECURITY;

-- Owner full access. NO anon SELECT policy on purpose:
-- public reads go exclusively through get_public_case(), which
-- filters fields by the visibility flags (location never leaks).
CREATE POLICY "cases: owner full access"
  ON cases FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS cases_user_id_idx      ON cases (user_id);
CREATE INDEX IF NOT EXISTS cases_user_card_id_idx ON cases (user_card_id);

CREATE TRIGGER cases_updated_at
  BEFORE UPDATE ON cases
  FOR EACH ROW EXECUTE PROCEDURE touch_updated_at();

-- ── Public case lookup (SECURITY DEFINER) ────────────────────
-- Returns the case + card details for /c/[short_code].
-- Anonymous visitors get only what the owner chose to expose.
-- The owner (authenticated) always sees everything.
CREATE OR REPLACE FUNCTION get_public_case(p_short_code TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c        cases%ROWTYPE;
  uc       user_cards%ROWTYPE;
  pc       pokemon_cards%ROWTYPE;
  is_owner BOOLEAN;
  result   jsonb;
BEGIN
  SELECT * INTO c FROM cases WHERE short_code = upper(trim(p_short_code));
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  is_owner := (auth.uid() = c.user_id);

  IF NOT c.is_public AND NOT is_owner THEN
    RETURN NULL;  -- private case looks identical to a nonexistent one
  END IF;

  result := jsonb_build_object(
    'short_code', c.short_code,
    'is_owner',   is_owner,
    'case_notes', CASE WHEN c.show_notes OR is_owner THEN c.notes END,
    'created_at', c.created_at
  );

  IF c.user_card_id IS NOT NULL THEN
    SELECT * INTO uc FROM user_cards WHERE id = c.user_card_id;
    IF FOUND THEN
      SELECT * INTO pc FROM pokemon_cards WHERE id = uc.card_id;
      result := result || jsonb_build_object(
        'card', jsonb_build_object(
          'id',             pc.id,
          'name',           pc.name,
          'set_name',       pc.set_name,
          'set_series',     pc.set_series,
          'set_symbol_url', pc.set_symbol_url,
          'number',         pc.number,
          'rarity',         pc.rarity,
          'image_url',      pc.image_url,
          'image_url_small', pc.image_url_small
        ),
        'print_type', uc.print_type,
        'condition',  uc.condition,
        'tags',       CASE WHEN c.show_tags OR is_owner THEN to_jsonb(uc.tags) END,
        'grading',    CASE WHEN (c.show_grade OR is_owner) AND uc.is_graded THEN
                        jsonb_build_object(
                          'company',     uc.grading_company,
                          'grade',       uc.grade,
                          'cert_number', uc.cert_number
                        )
                      END,
        'prices',           CASE WHEN c.show_value OR is_owner THEN pc.tcgplayer_prices END,
        'price_updated_at', CASE WHEN c.show_value OR is_owner THEN to_jsonb(pc.price_updated_at) END
      );
    END IF;
  END IF;

  IF is_owner THEN
    result := result || jsonb_build_object(
      'id',           c.id,
      'user_card_id', c.user_card_id,
      'location',     c.location,
      'is_public',    c.is_public,
      'show_value',   c.show_value,
      'show_grade',   c.show_grade,
      'show_notes',   c.show_notes,
      'show_tags',    c.show_tags
    );
  END IF;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION get_public_case(TEXT) FROM public;
GRANT EXECUTE ON FUNCTION get_public_case(TEXT) TO anon, authenticated;
