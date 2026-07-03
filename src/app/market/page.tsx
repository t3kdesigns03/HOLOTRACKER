'use client'
// ============================================================
// Market / HoloDex — price lookup, trending cards, analytics
// src/app/market/page.tsx
// ============================================================

import { useState, useCallback, useEffect } from 'react'
import { Search, TrendingUp, Zap, Star, Loader2 } from 'lucide-react'
import { HoloCard } from '@/components/card/HoloCard'
import { CardAnalyticsPanel } from '@/components/card/CardAnalyticsPanel'
import { AddToInventoryModal } from '@/components/inventory/AddToInventoryModal'
import { toast } from 'sonner'
import type { PokemonCardAPI } from '@/types'

// Curated cards to show as "trending" — covers classics + current chase cards
const TRENDING_CARDS = [
  'Charizard ex',
  'Pikachu ex',
  'Mewtwo ex',
  'Darkrai ex',
  'Umbreon ex',
  'Rayquaza ex',
  'Lugia ex',
  'Eevee ex',
]

interface CardResult {
  card: PokemonCardAPI
  marketPrice: number | null
}

function getMarketPrice(card: PokemonCardAPI): number | null {
  const slots = Object.values(
    (card.tcgplayer?.prices ?? {}) as Record<string, { market?: number | null }>
  )
  return slots.find(p => p?.market != null)?.market ?? null
}

export default function MarketPage() {
  const [searchQuery,    setSearchQuery]    = useState('')
  const [searchResults,  setSearchResults]  = useState<CardResult[]>([])
  const [searching,      setSearching]      = useState(false)
  const [trendingCards,  setTrendingCards]  = useState<CardResult[]>([])
  const [trendingLoaded, setTrendingLoaded] = useState(false)
  const [trendingLoading,setTrendingLoading]= useState(false)
  const [selectedCard,   setSelectedCard]   = useState<PokemonCardAPI | null>(null)
  const [addCard,        setAddCard]        = useState<PokemonCardAPI | null>(null)

  // Load trending cards on demand
  const loadTrending = useCallback(async () => {
    if (trendingLoaded) return
    setTrendingLoading(true)
    try {
      const results: CardResult[] = []
      // Fetch top result for each trending card name (in parallel batches)
      await Promise.all(
        TRENDING_CARDS.map(async name => {
          try {
            const sp = new URLSearchParams({ q: name, pageSize: '8', page: '1' })
            const res = await fetch(`/api/cards/search?${sp}`)
            if (!res.ok) return
            const data = await res.json()
            const cards: PokemonCardAPI[] = data.data ?? []
            if (!cards.length) return
            // Results are newest-first; brand-new sets often have no price
            // data yet. Prefer the highest-priced printing of this card.
            const best = cards
              .map(card => ({ card, marketPrice: getMarketPrice(card) }))
              .sort((a, b) => (b.marketPrice ?? -1) - (a.marketPrice ?? -1))[0]
            results.push(best)
          } catch { /* skip */ }
        })
      )
      // Sort by market price descending (most valuable first)
      results.sort((a, b) => (b.marketPrice ?? 0) - (a.marketPrice ?? 0))
      setTrendingCards(results)
      setTrendingLoaded(true)
    } finally {
      setTrendingLoading(false)
    }
  }, [trendingLoaded])

  // Load trending cards on mount
  useEffect(() => { loadTrending() }, [loadTrending])

  // Card search
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    setSearching(true)
    setSearchResults([])
    try {
      const sp = new URLSearchParams({ q: searchQuery.trim(), pageSize: '12', page: '1' })
      const res = await fetch(`/api/cards/search?${sp}`)
      if (!res.ok) return
      const data = await res.json()
      setSearchResults(
        (data.data ?? []).map((c: PokemonCardAPI) => ({ card: c, marketPrice: getMarketPrice(c) }))
      )
    } finally {
      setSearching(false)
    }
  }

  const displayCards = searchResults.length > 0 ? searchResults : trendingCards
  const isShowingSearch = searchResults.length > 0

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-5 h-5 text-purple-400" />
            <h1 className="text-2xl font-bold text-white">HoloDex Market</h1>
          </div>
          <p className="text-zinc-500 text-sm">
            Real-time price data across TCGPlayer, Cardmarket, and eBay — one place
          </p>
        </div>

        {/* Search bar */}
        <form onSubmit={handleSearch} className="mb-8">
          <div className="relative max-w-2xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search any card — name, set, Japanese exclusive…"
              className="w-full pl-11 pr-28 py-3 bg-zinc-900 border border-zinc-700 rounded-xl
                text-sm text-white placeholder:text-zinc-600
                focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500
                transition-colors"
            />
            <button
              type="submit"
              disabled={searching}
              className="absolute right-2 top-1/2 -translate-y-1/2
                px-4 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50
                text-white text-sm font-medium rounded-lg transition-colors"
            >
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
            </button>
          </div>
        </form>

        {/* Section label */}
        <div className="flex items-center gap-2 mb-5">
          {isShowingSearch ? (
            <>
              <Search className="w-4 h-4 text-zinc-500" />
              <span className="text-sm font-medium text-zinc-400">
                Results for &ldquo;{searchQuery}&rdquo;
              </span>
              <button
                onClick={() => { setSearchResults([]); setSearchQuery('') }}
                className="text-xs text-zinc-600 hover:text-zinc-400 ml-2"
              >
                ✕ Clear
              </button>
            </>
          ) : (
            <>
              <TrendingUp className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium text-zinc-400">Trending Cards</span>
            </>
          )}
        </div>

        {/* Card grid */}
        {trendingLoading && !isShowingSearch ? (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-zinc-900 border border-zinc-800 animate-pulse h-56" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
            {displayCards.map(({ card, marketPrice }) => {
              const cmAvg = card.cardmarket?.prices?.averageSellPrice ?? null
              return (
                <button
                  key={card.id}
                  onClick={() => setSelectedCard(card)}
                  className="group flex flex-col items-center gap-3 p-3 rounded-2xl
                    bg-zinc-900/60 border border-zinc-800 hover:border-purple-500/40
                    hover:bg-zinc-900 transition-all duration-200 text-center"
                >
                  {/* 3D Card */}
                  <HoloCard
                    imageUrl={card.images.large}
                    imageUrlSmall={card.images.small}
                    name={card.name}
                    rarity={card.rarity}
                    width={130}
                  />

                  {/* Info */}
                  <div className="w-full">
                    <div className="text-xs font-semibold text-white truncate">{card.name}</div>
                    <div className="text-[10px] text-zinc-600 truncate mt-0.5">
                      {card.set.name} #{card.number}
                    </div>

                    {/* Prices */}
                    <div className="mt-2 space-y-0.5">
                      {marketPrice != null && (
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-zinc-600">TCG</span>
                          <span className="text-xs font-mono font-semibold text-emerald-400">
                            ${marketPrice.toFixed(2)}
                          </span>
                        </div>
                      )}
                      {cmAvg != null && (
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-zinc-600">CM</span>
                          <span className="text-xs font-mono text-zinc-400">
                            €{cmAvg.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[10px] text-purple-400 font-medium">
                        View Analytics →
                      </span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Empty search state */}
        {isShowingSearch && searchResults.length === 0 && !searching && (
          <div className="text-center py-16 text-zinc-600">
            <div className="text-4xl mb-3">🔍</div>
            <div className="text-sm">No cards found for &ldquo;{searchQuery}&rdquo;</div>
            <div className="text-xs mt-1 text-zinc-700">
              Try a different name — Japanese-only cards won&apos;t appear here yet
            </div>
          </div>
        )}

        {/* eBay coming soon banner */}
        <div className="mt-12 p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl
          flex items-start gap-3">
          <Star className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-medium text-zinc-300">eBay live pricing coming soon</div>
            <div className="text-xs text-zinc-600 mt-0.5">
              Once eBay API keys are added, each card here will show live eBay asking prices,
              last-sold data, and a regional breakdown of where cards are most active —
              perfect for scoping a show before you go.
            </div>
          </div>
        </div>
      </div>

      {/* Analytics panel */}
      {selectedCard && (
        <CardAnalyticsPanel
          cardName={selectedCard.name}
          imageUrl={selectedCard.images.large}
          imageUrlSmall={selectedCard.images.small}
          rarity={selectedCard.rarity}
          setName={selectedCard.set.name}
          cardNumber={selectedCard.number}
          tcgplayer={selectedCard.tcgplayer}
          cardmarket={selectedCard.cardmarket}
          onClose={() => setSelectedCard(null)}
          onAddToInventory={() => setAddCard(selectedCard)}
        />
      )}

      {/* Add to inventory (from HoloDex search) */}
      {addCard && (
        <AddToInventoryModal
          card={addCard}
          onClose={() => setAddCard(null)}
          onSuccess={() => {
            toast.success(`${addCard.name} added to your inventory`)
            setAddCard(null)
            setSelectedCard(null)
          }}
        />
      )}
    </div>
  )
}
