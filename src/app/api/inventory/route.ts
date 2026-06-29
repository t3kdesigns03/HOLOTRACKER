import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@/lib/supabase/service'
import type { AddCardForm } from '@/types'

// Guarantee the card row exists in pokemon_cards before we touch user_cards.
// cacheCards() in the search flow may fail silently if SUPABASE_SERVICE_ROLE_KEY
// is missing on the deployed host, leaving the card uncached.
async function ensureCardCached(cardId: string): Promise<boolean> {
  const service = createServiceClient()

  // Fast path — already cached
  const { data: existing } = await service
    .from('pokemon_cards').select('id').eq('id', cardId).maybeSingle()
  if (existing) return true

  // Fetch from pokemontcg.io and upsert
  try {
    const apiKey = process.env.POKEMON_TCG_API_KEY
    const headers: HeadersInit = apiKey ? { 'X-Api-Key': apiKey } : {}
    const res = await fetch(`https://api.pokemontcg.io/v2/cards/${cardId}`, { headers })
    if (!res.ok) return false
    const { data: card } = await res.json()
    if (!card) return false

    const row = {
      id:                card.id,
      name:              card.name,
      set_id:            card.set.id,
      set_name:          card.set.name,
      set_series:        card.set.series        ?? null,
      set_logo_url:      card.set.images?.logo  ?? null,
      set_symbol_url:    card.set.images?.symbol ?? null,
      number:            card.number,
      rarity:            card.rarity            ?? null,
      supertype:         card.supertype          ?? null,
      subtypes:          card.subtypes           ?? null,
      hp:                card.hp                 ?? null,
      types:             card.types              ?? null,
      evolves_from:      card.evolvesFrom        ?? null,
      image_url:         card.images?.large      ?? null,
      image_url_small:   card.images?.small      ?? null,
      tcgplayer_prices:  card.tcgplayer          ?? null,
      cardmarket_prices: card.cardmarket         ?? null,
      price_updated_at:  new Date().toISOString(),
      raw_data:          card,
    }
    const { error } = await service.from('pokemon_cards').upsert(row, { onConflict: 'id' })
    if (error) console.error('[ensureCardCached] upsert error:', error.message)
    return !error
  } catch (err) {
    console.error('[ensureCardCached] fetch error:', err)
    return false
  }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const status = searchParams.get('status')

  let query = supabase
    .from('user_cards')
    .select('*, card:pokemon_cards(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: AddCardForm = await req.json()

  // Ensure the card exists in pokemon_cards before the FK-constrained insert
  const cached = await ensureCardCached(body.card_id)
  if (!cached) {
    return NextResponse.json(
      { error: 'Card not found — could not fetch card data from pokemontcg.io' },
      { status: 422 }
    )
  }

  const insert = {
    user_id:           user.id,
    card_id:           body.card_id,
    quantity:          body.quantity,
    condition:         body.condition,
    print_type:        body.print_type,
    cost_basis:        body.cost_basis ? parseFloat(body.cost_basis) : null,
    acquired_at:       body.acquired_at || null,
    acquisition_notes: body.acquisition_notes || null,
    storage_location:  body.storage_location || null,
    status:            body.status,
    is_public:         body.is_public,
    asking_price:      body.asking_price ? parseFloat(body.asking_price) : null,
    is_graded:         body.is_graded,
    grading_company:   body.grading_company || null,
    grade:             body.grade || null,
    cert_number:       body.cert_number || null,
  }

  const { data, error } = await supabase
    .from('user_cards')
    .insert(insert)
    .select('*, card:pokemon_cards(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
