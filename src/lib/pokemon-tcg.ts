import { createClient } from '@/lib/supabase/client'
import type { PokemonCardAPI, PokemonCardRow, CardSearchParams, CardSearchResult, TCGPlayerPrices } from '@/types'

const BASE_URL = 'https://api.pokemontcg.io/v2'
const PRICE_STALE_HOURS = 6

function apiHeaders(): HeadersInit {
  const key = process.env.POKEMON_TCG_API_KEY
  return key ? { 'X-Api-Key': key } : {}
}

async function fetchFromAPI<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`)
  if (params) Object.entries(params).forEach(([k, v]) => v && url.searchParams.set(k, v))
  const res = await fetch(url.toString(), { headers: apiHeaders(), next: { revalidate: 300 } })
  if (!res.ok) throw new Error(`Pokemon TCG API error ${res.status}`)
  return res.json()
}

export async function searchCards(params: CardSearchParams): Promise<CardSearchResult> {
  const { q, set, supertype, types, rarity, page = 1, pageSize = 20 } = params
  const queryParts: string[] = []

  if (q) {
    const words = q.trim().split(/\s+/).filter(Boolean)

    // Recognize card-number tokens anywhere in the query:
    //   "125/094"   → number 125 (printed "125 of 094")
    //   "TG12/TG30" → number TG12 (trainer gallery / promo prefixes)
    //   "#125"      → number 125
    //   trailing "125"   → number 125 (legacy behavior)
    //   trailing "xy124" → number XY124 (promo numbers — needs a name word too,
    //                      so "Porygon2" alone stays a name search)
    const nameWords: string[] = []
    let cardNumber: string | null = null
    words.forEach((word, i) => {
      const isLast = i === words.length - 1
      const slashMatch = word.match(/^#?([A-Za-z]{0,4}\d+[a-z]?)\/[A-Za-z]{0,4}\d+$/)
      const hashMatch  = word.match(/^#([A-Za-z]{0,4}\d+[a-z]?)$/)
      const isTrailingNumber = isLast && /^\d+$/.test(word)
      const isTrailingPromo  = isLast && words.length > 1 && /^[A-Za-z]{1,5}\d+[a-z]?$/.test(word)
      if (slashMatch)            cardNumber = slashMatch[1]
      else if (hashMatch)        cardNumber = hashMatch[1]
      else if (isTrailingNumber) cardNumber = word
      else if (isTrailingPromo)  cardNumber = word
      else nameWords.push(word)
    })

    if (nameWords.length > 0) {
      if (nameWords.length === 1) {
        // Single word — prefix wildcard for broad matching
        queryParts.push(`name:${nameWords[0]}*`)
      } else {
        // Multi-word — quoted phrase match is most accurate.
        // pokemontcg.io Lucene supports wildcards OUTSIDE quotes only,
        // so we use quoted phrase for the full name.
        queryParts.push(`name:"${nameWords.join(' ')}"`)
      }
    }
    if (cardNumber) {
      // Sets vary on leading zeros ("049" vs "49") — match either
      const stripped = (cardNumber as string).replace(/^([A-Za-z]*)0+(\d)/, '$1$2')
      queryParts.push(
        stripped !== cardNumber
          ? `(number:${cardNumber} OR number:${stripped})`
          : `number:${cardNumber}`
      )
    }
  }

  if (set)       queryParts.push(`set.id:${set}`)
  if (supertype) queryParts.push(`supertype:"${supertype}"`)
  if (types?.length) queryParts.push(`types:${types.join(',')}`)
  if (rarity)    queryParts.push(`rarity:"${rarity}"`)

  const apiParams: Record<string, string> = {
    pageSize: String(pageSize), page: String(page), orderBy: '-set.releaseDate',
  }
  if (queryParts.length) apiParams.q = queryParts.join(' ')

  const result = await fetchFromAPI<{ data: PokemonCardAPI[]; page: number; pageSize: number; count: number; totalCount: number }>('/cards', apiParams)
  cacheCards(result.data).catch(console.error)
  return result
}

export async function getCard(cardId: string): Promise<PokemonCardRow | null> {
  const supabase = createClient()
  const { data: cached } = await supabase.from('pokemon_cards').select('*').eq('id', cardId).maybeSingle()
  if (cached) {
    const updatedAt = cached.price_updated_at ? new Date(cached.price_updated_at) : null
    if (!updatedAt || Date.now() - updatedAt.getTime() > PRICE_STALE_HOURS * 3600000) {
      refreshCardPrices(cardId).catch(console.error)
    }
    return cached as PokemonCardRow
  }
  const { data } = await fetchFromAPI<{ data: PokemonCardAPI }>(`/cards/${cardId}`)
  if (!data) return null
  await cacheCards([data])
  const { data: fresh } = await supabase.from('pokemon_cards').select('*').eq('id', cardId).maybeSingle()
  return fresh as PokemonCardRow | null
}

export async function cacheCards(cards: PokemonCardAPI[]): Promise<void> {
  if (!cards.length) return
  const { createClient: createServiceClient } = await import('@/lib/supabase/service')
  const supabase = createServiceClient()
  const rows = cards.map(card => ({
    id: card.id, name: card.name, set_id: card.set.id, set_name: card.set.name,
    set_series: card.set.series ?? null, set_logo_url: card.set.images?.logo ?? null,
    set_symbol_url: card.set.images?.symbol ?? null, number: card.number,
    rarity: card.rarity ?? null, supertype: card.supertype ?? null,
    subtypes: card.subtypes ?? null, hp: card.hp ?? null, types: card.types ?? null,
    evolves_from: card.evolvesFrom ?? null, image_url: card.images?.large ?? null,
    image_url_small: card.images?.small ?? null, tcgplayer_prices: card.tcgplayer ?? null,
    cardmarket_prices: card.cardmarket ?? null, price_updated_at: new Date().toISOString(),
    raw_data: card,
  }))
  const { error } = await supabase.from('pokemon_cards').upsert(rows, { onConflict: 'id' })
  if (error) console.error('Cache write error:', error)
}

async function refreshCardPrices(cardId: string): Promise<void> {
  try {
    const { data } = await fetchFromAPI<{ data: PokemonCardAPI }>(`/cards/${cardId}`)
    if (!data) return
    const { createClient: createServiceClient } = await import('@/lib/supabase/service')
    const supabase = createServiceClient()
    await supabase.from('pokemon_cards').update({
      tcgplayer_prices: data.tcgplayer ?? null,
      cardmarket_prices: data.cardmarket ?? null,
      price_updated_at: new Date().toISOString(),
    }).eq('id', cardId)
  } catch (e) { console.error('Price refresh failed for', cardId, e) }
}

export function getAvailablePrintTypes(prices?: TCGPlayerPrices | null): string[] {
  if (!prices?.prices) return ['normal']
  return Object.keys(prices.prices).filter(k => {
    const p = (prices.prices as Record<string, { market?: number }>)[k]
    return p?.market != null
  })
}
