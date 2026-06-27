 'use client'
// ============================================================
// CardSearchPanel — debounced search with filters + pagination
// src/components/search/CardSearchPanel.tsx
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, SlidersHorizontal, X, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { CardSearchResult } from './CardSearchResult'
import type { PokemonCardAPI, CardSearchParams } from '@/types'

interface Props {
  onSelectCard: (card: PokemonCardAPI) => void
}

const SUPERTYPES = ['Pokémon', 'Trainer', 'Energy']
const RARITIES   = [
  'Common', 'Uncommon', 'Rare', 'Rare Holo',
  'Rare Ultra', 'Rare Secret', 'Double Rare',
  'Illustration Rare', 'Special Illustration Rare',
  'Hyper Rare', 'ACE SPEC Rare', 'Promo',
]

export function CardSearchPanel({ onSelectCard }: Props) {
  const [query,     setQuery]     = useState('')
  const [supertype, setSupertype] = useState('')
  const [rarity,    setRarity]    = useState('')
  const [page,      setPage]      = useState(1)
  const [showFilters, setShowFilters] = useState(false)

  const [results,    setResults]    = useState<PokemonCardAPI[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading,    setLoading]    = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pageSize = 20
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const doSearch = useCallback(async (params: CardSearchParams) => {
    setLoading(true)
    setError(null)
    try {
      const sp = new URLSearchParams()
      if (params.q)         sp.set('q',         params.q)
      if (params.supertype) sp.set('supertype',  params.supertype)
      if (params.rarity)    sp.set('rarity',     params.rarity)
      sp.set('page',     String(params.page ?? 1))
      sp.set('pageSize', String(params.pageSize ?? pageSize))

      const res = await fetch(`/api/cards/search?${sp}`)
      if (!res.ok) throw new Error('Search failed')
      const data = await res.json()
      setResults(data.data)
      setTotalCount(data.totalCount ?? 0)
    } catch (e) {
      setError('Search failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounce on query/filter changes, reset to page 1
  useEffect(() => {
    if (!query && !supertype && !rarity) {
      setResults([])
      setTotalCount(0)
      return
    }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPage(1)
      doSearch({ q: query, supertype, rarity, page: 1, pageSize })
    }, 350)
    return () => clearTimeout(debounceRef.current)
  }, [query, supertype, rarity, doSearch])

  // Explicit page changes
  useEffect(() => {
    if (page === 1) return // handled above
    doSearch({ q: query, supertype, rarity, page, pageSize })
  }, [page]) // eslint-disable-line

  const totalPages = Math.ceil(totalCount / pageSize)
  const hasFilters = !!supertype || !!rarity

  const clearAll = () => {
    setQuery('')
    setSupertype('')
    setRarity('')
    setResults([])
    setTotalCount(0)
  }

  return (
    <div className="flex flex-col gap-3">

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (query || supertype || rarity)) {
              clearTimeout(debounceRef.current)
              setPage(1)
              doSearch({ q: query, supertype, rarity, page: 1, pageSize })
            }
          }}
          placeholder="Search by card name…"
          className="w-full pl-9 pr-9 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg
            text-sm text-white placeholder:text-zinc-600
            focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500
            transition-colors"
          autoFocus
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {loading && <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />}
          {(query || hasFilters) && !loading && (
            <button onClick={clearAll} className="text-zinc-600 hover:text-zinc-400 transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filter toggle */}
      <button
        onClick={() => setShowFilters(v => !v)}
        className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg
          transition-colors self-start
          ${hasFilters
            ? 'text-purple-400 bg-purple-500/10 border border-purple-500/30'
            : 'text-zinc-500 hover:text-zinc-300 bg-zinc-800 border border-zinc-700'
          }`}
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        Filters
        {hasFilters && <span className="ml-0.5 text-purple-300">●</span>}
      </button>

      {/* Filter panel */}
      {showFilters && (
        <div className="grid grid-cols-2 gap-2 p-3 bg-zinc-900 rounded-xl border border-zinc-800">
          <div>
            <label className="block text-[10px] text-zinc-500 mb-1 font-medium uppercase tracking-wide">
              Type
            </label>
            <select
              value={supertype}
              onChange={e => setSupertype(e.target.value)}
              className="w-full text-xs bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5
                text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="">All types</option>
              {SUPERTYPES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[10px] text-zinc-500 mb-1 font-medium uppercase tracking-wide">
              Rarity
            </label>
            <select
              value={rarity}
              onChange={e => setRarity(e.target.value)}
              className="w-full text-xs bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5
                text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="">All rarities</option>
              {RARITIES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-600">
              {totalCount.toLocaleString()} results
            </span>
            {totalPages > 1 && (
              <span className="text-xs text-zinc-600">
                Page {page} of {totalPages}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1.5 max-h-[420px] overflow-y-auto pr-0.5
            scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
            {results.map(card => (
              <CardSearchResult key={card.id} card={card} onSelect={onSelectCard} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400
                  disabled:opacity-40 hover:bg-zinc-700 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs text-zinc-500">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400
                  disabled:opacity-40 hover:bg-zinc-700 transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!loading && results.length === 0 && (query || hasFilters) && (
        <div className="text-center py-8 text-zinc-600">
          <div className="text-3xl mb-2">🔍</div>
          <div className="text-sm">No cards found</div>
          <div className="text-xs mt-1">Try a different name or adjust filters</div>
        </div>
      )}

      {/* Prompt */}
      {!query && !hasFilters && (
        <div className="text-center py-8 text-zinc-700">
          <div className="text-3xl mb-2">✨</div>
          <div className="text-sm">Search 20,000+ cards</div>
          <div className="text-xs mt-1">Name, set, rarity, and more</div>
        </div>
      )}
    </div>
  )
}
