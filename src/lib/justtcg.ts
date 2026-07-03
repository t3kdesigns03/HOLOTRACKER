// ============================================================
// JustTCG API client — condition-aware TCG pricing
// src/lib/justtcg.ts
// SERVER-SIDE ONLY: uses JUSTTCG_API_KEY, never expose to client.
// Docs: https://justtcg.com/docs
// Free tier: 1,000 req/month, 100/day, 10/min, 20 cards per batch.
// ============================================================

import type { JustTCGCard } from '@/types'

const BASE = 'https://api.justtcg.com/v1'

function apiKey(): string {
  const key = process.env.JUSTTCG_API_KEY
  if (!key) throw new Error('JUSTTCG_API_KEY is not set')
  return key
}

async function jtFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'x-api-key': apiKey(),
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    // Pricing data — never cache at the framework level
    cache: 'no-store',
  })
  if (res.status === 429) {
    throw new JustTCGRateLimitError()
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`JustTCG ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

export class JustTCGRateLimitError extends Error {
  constructor() {
    super('JustTCG rate limit hit (free tier: 10 req/min) — try again in a minute')
    this.name = 'JustTCGRateLimitError'
  }
}

interface JustTCGListResponse {
  data: JustTCGCard[]
  meta?: { total: number; limit: number; offset: number; hasMore: boolean }
  _metadata?: { apiPlan?: string; apiRequestsRemaining?: number }
}

/**
 * Search JustTCG for a Pokémon card by name and pick the best match
 * for the given set name / card number. Returns null if no confident match.
 * Costs 1 API request.
 */
export async function resolveJustTCGCard(
  name: string,
  setName: string,
  number: string
): Promise<JustTCGCard | null> {
  const q = encodeURIComponent(name)
  const { data } = await jtFetch<JustTCGListResponse>(
    `/cards?q=${q}&game=pokemon&limit=20`
  )
  if (!data?.length) return null

  const normSet = normalize(setName)
  const normName = normalize(name)

  // 1) exact set-name match, 2) set-name containment, 3) give up rather than guess
  const scored = data
    .map(card => {
      const cSet = normalize(card.set_name ?? '')
      const cName = normalize(card.name ?? '')
      let score = 0
      if (cSet === normSet) score += 4
      else if (cSet.includes(normSet) || normSet.includes(cSet)) score += 2
      if (cName === normName) score += 2
      else if (cName.startsWith(normName)) score += 1
      // JustTCG often embeds the collector number in the name, e.g. "(#199)"
      if (number && card.name?.includes(`#${number}`)) score += 2
      return { card, score }
    })
    .sort((a, b) => b.score - a.score)

  const best = scored[0]
  return best && best.score >= 3 ? best.card : null
}

/**
 * Batch-fetch cards by their JustTCG card IDs. Max 20 per call on the
 * free tier — callers must chunk. Costs 1 API request per call.
 */
export async function batchGetJustTCGCards(cardIds: string[]): Promise<JustTCGCard[]> {
  if (cardIds.length === 0) return []
  if (cardIds.length > 20) throw new Error('Max 20 cards per batch on free tier')
  const { data } = await jtFetch<JustTCGListResponse>('/cards', {
    method: 'POST',
    body: JSON.stringify(cardIds.map(cardId => ({ cardId }))),
  })
  return data ?? []
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}
