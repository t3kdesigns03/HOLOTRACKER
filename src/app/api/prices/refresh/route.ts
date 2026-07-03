import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@/lib/supabase/service'
import {
  resolveJustTCGCard, batchGetJustTCGCards, JustTCGRateLimitError,
} from '@/lib/justtcg'

// ============================================================
// POST /api/prices/refresh
// Refreshes JustTCG condition-aware prices for cards the user OWNS.
// Free-tier aware: spends at most MAX_REQUESTS JustTCG calls per
// invocation (10/min limit). Returns `remaining` so the client can
// show progress and the user can click again to continue.
// ============================================================

const MAX_REQUESTS = 8          // per invocation budget
const BATCH_SIZE   = 20         // free tier max per POST /cards
const STALE_HOURS  = 12         // skip cards refreshed more recently

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.JUSTTCG_API_KEY) {
    return NextResponse.json(
      { error: 'JUSTTCG_API_KEY not configured' }, { status: 501 }
    )
  }

  const service = createServiceClient()

  // Distinct cards in this user's inventory, with cache state
  const { data: owned, error } = await supabase
    .from('user_cards')
    .select('card:pokemon_cards(id, name, set_name, number, justtcg_card_id, justtcg_updated_at)')
    .eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  type CardRef = {
    id: string; name: string; set_name: string; number: string
    justtcg_card_id: string | null; justtcg_updated_at: string | null
  }
  const cards = new Map<string, CardRef>()
  for (const row of owned ?? []) {
    const c = (row as unknown as { card: CardRef | null }).card
    if (c) cards.set(c.id, c)
  }

  const staleCutoff = Date.now() - STALE_HOURS * 3600 * 1000
  const isFresh = (c: CardRef) =>
    c.justtcg_updated_at != null && new Date(c.justtcg_updated_at).getTime() > staleCutoff

  const unresolved = [...cards.values()].filter(c => !c.justtcg_card_id && !isFresh(c))
  const resolved   = [...cards.values()].filter(c => c.justtcg_card_id && !isFresh(c))

  let requestsUsed = 0
  let resolvedCount = 0   // newly matched via search
  let batchRefreshed = 0  // already-matched cards re-priced
  let unmatchedCount = 0

  try {
    // 1) Resolve unmatched cards (1 search request each)
    for (const card of unresolved) {
      if (requestsUsed >= MAX_REQUESTS) break
      requestsUsed++
      const match = await resolveJustTCGCard(card.name, card.set_name, card.number)
      if (match) {
        await service.from('pokemon_cards').update({
          justtcg_card_id:    match.id,
          justtcg_variants:   match.variants,
          justtcg_updated_at: new Date().toISOString(),
        }).eq('id', card.id)
        resolvedCount++
      } else {
        // Mark attempt time so we don't burn budget on it every click
        await service.from('pokemon_cards').update({
          justtcg_updated_at: new Date().toISOString(),
        }).eq('id', card.id)
        unmatchedCount++
      }
    }

    // 2) Batch-refresh already-resolved cards (20 per request)
    for (let i = 0; i < resolved.length; i += BATCH_SIZE) {
      if (requestsUsed >= MAX_REQUESTS) break
      requestsUsed++
      const chunk = resolved.slice(i, i + BATCH_SIZE)
      const results = await batchGetJustTCGCards(
        chunk.map(c => c.justtcg_card_id as string)
      )
      const byId = new Map(results.map(r => [r.id, r]))
      for (const card of chunk) {
        const fresh = byId.get(card.justtcg_card_id as string)
        if (!fresh) continue
        await service.from('pokemon_cards').update({
          justtcg_variants:   fresh.variants,
          justtcg_updated_at: new Date().toISOString(),
        }).eq('id', card.id)
        batchRefreshed++
      }
    }
  } catch (e: unknown) {
    if (e instanceof JustTCGRateLimitError) {
      return NextResponse.json({
        error: e.message,
        refreshed: batchRefreshed + resolvedCount,
        resolved: resolvedCount,
        rateLimited: true,
      }, { status: 429 })
    }
    const msg = e instanceof Error ? e.message : 'Price refresh failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  const remaining =
    Math.max(unresolved.length - resolvedCount - unmatchedCount, 0) +
    Math.max(resolved.length - batchRefreshed, 0)

  return NextResponse.json({
    totalOwned: cards.size,
    refreshed: batchRefreshed + resolvedCount,
    newlyResolved: resolvedCount,
    unmatched: unmatchedCount,
    remaining,
    requestsUsed,
  })
}
