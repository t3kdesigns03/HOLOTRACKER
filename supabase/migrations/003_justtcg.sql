-- ============================================================
-- HOLOTracker - JustTCG price integration
-- Migration 003: condition-aware pricing columns + RPC update
-- ============================================================

-- ── JustTCG data on the shared card cache ────────────────────
ALTER TABLE pokemon_cards
  ADD COLUMN IF NOT EXISTS justtcg_card_id    TEXT,
  ADD COLUMN IF NOT EXISTS justtcg_variants   JSONB,
  ADD COLUMN IF NOT EXISTS justtcg_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS pokemon_cards_justtcg_id_idx
  ON pokemon_cards (justtcg_card_id);

-- ── Update public case RPC to expose JustTCG variants ────────
-- Same visibility rules: prices only when show_value (or owner).
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
    RETURN NULL;
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
        'prices',            CASE WHEN c.show_value OR is_owner THEN pc.tcgplayer_prices END,
        'price_updated_at',  CASE WHEN c.show_value OR is_owner THEN to_jsonb(pc.price_updated_at) END,
        'justtcg_variants',  CASE WHEN c.show_value OR is_owner THEN pc.justtcg_variants END,
        'justtcg_updated_at', CASE WHEN c.show_value OR is_owner THEN to_jsonb(pc.justtcg_updated_at) END
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
