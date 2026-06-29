'use client'
// ============================================================
// CardSearchPanel — TCGPlayer-style autocomplete + 3D card grid
// Falls back to eBay listings when pokemontcg.io has no results
// src/components/search/CardSearchPanel.tsx
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, SlidersHorizontal, X, Loader2, ChevronLeft, ChevronRight, ExternalLink, MapPin } from 'lucide-react'
import { HoloCard } from '@/components/card/HoloCard'
import type { PokemonCardAPI, CardSearchParams, EbayListing } from '@/types'

interface Props {
  onSelectCard: (card: PokemonCardAPI) => void
  /** Optional: called when user wants to add an eBay listing not in pokemontcg.io */
  onSelectEbayListing?: (listing: EbayListing) => void
}

const SUPERTYPES = ['Pokémon', 'Trainer', 'Energy']
const RARITIES = [
  'Common', 'Uncommon', 'Rare', 'Rare Holo',
  'Rare Ultra', 'Rare Secret', 'Double Rare',
  'Illustration Rare', 'Special Illustration Rare',
  'Hyper Rare', 'ACE SPEC Rare', 'Promo',
]

function getMarketPriceFromCard(card: PokemonCardAPI): number | null {
  const slots = Object.values(
    (card.tcgplayer?.prices ?? {}) as Record<string, { market?: number | null }>
  )
  return slots.find(p => p?.market != null)?.market ?? null
}

export function CardSearchPanel({ onSelectCard, onSelectEbayListing }: Props) {
  const [inputValue, setInputValue]   = useState('')
  const [query,      setQuery]        = useState('')
  const [supertype,  setSupertype]    = useState('')
  const [rarity,     setRarity]       = useState('')
  const [page,       setPage]         = useState(1)
  const [showFilters, setShowFilters] = useState(false)

  const [results,      setResults]      = useState<PokemonCardAPI[]>([])
  const [suggestions,  setSuggestions]  = useState<PokemonCardAPI[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [totalCount,   setTotalCount]   = useState(0)
  const [loading,      setLoading]      = useState(false)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  // eBay fallback state
  const [ebayResults,    setEbayResults]    = useState<EbayListing[]>([])
  const [ebayLoading,    setEbayLoading]    = useState(false)
  const [showEbay,       setShowEbay]       = useState(false)

  const pageSize      = 20
  const debounceRef   = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const suggestRef    = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const inputRef      = useRef<HTMLInputElement>(null)
  const dropdownRef   = useRef<HTMLDivElement>(null)

  // ── Full results search ────────────────────────────────────
  const doSearch = useCallback(async (params: CardSearchParams) => {
    setLoading(true)
    setError(null)
    setShowEbay(false)
    setEbayResults([])
    try {
      const sp = new URLSearchParams()
      if (params.q)         sp.set('q',         params.q)
      if (params.supertype) sp.set('supertype',  params.supertype)
      if (params.rarity)    sp.set('rarity',     params.rarity)
      sp.set('page',     String(params.page     ?? 1))
      sp.set('pageSize', String(params.pageSize ?? pageSize))

      const res = await fetch(`/api/cards/search?${sp}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setResults(data.data)
      setTotalCount(data.totalCount ?? 0)

      // If pokemontcg.io has zero results, try eBay as fallback
      if ((data.totalCount ?? 0) === 0 && params.q) {
        fetchEbayFallback(params.q)
      }
    } catch {
      setError('Search failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  // ── eBay fallback ─────────────────────────────────────────
  const fetchEbayFallback = useCallback(async (q: string) => {
    setEbayLoading(true)
    try {
      const res = await fetch(`/api/ebay/listings?q=${encodeURIComponent(q)}`)
      if (!res.ok) return
      const data: EbayListing[] = await res.json()
      setEbayResults(data)
      if (data.length > 0) setShowEbay(true)
    } catch {
      // silent — eBay is best-effort
    } finally {
      setEbayLoading(false)
    }
  }, [])

  // ── Autocomplete suggestions ───────────────────────────────
  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) { setSuggestions([]); setShowDropdown(false); return }
    setSuggestLoading(true)
    try {
      const sp = new URLSearchParams({ q, page: '1', pageSize: '8' })
      const res = await fetch(`/api/cards/search?${sp}`)
      if (!res.ok) return
      const data = await res.json()
      setSuggestions(data.data ?? [])
      setShowDropdown(true)
    } catch {
      // silent
    } finally {
      setSuggestLoading(false)
    }
  }, [])

  useEffect(() => {
    clearTimeout(suggestRef.current)
    if (!inputValue) { setSuggestions([]); setShowDropdown(false); return }
    suggestRef.current = setTimeout(() => fetchSuggestions(inputValue), 200)
    return () => clearTimeout(suggestRef.current)
  }, [inputValue, fetchSuggestions])

  useEffect(() => {
    if (!query && !supertype && !rarity) {
      setResults([]); setTotalCount(0); setShowEbay(false); return
    }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPage(1)
      doSearch({ q: query, supertype, rarity, page: 1, pageSize })
    }, 350)
    return () => clearTimeout(debounceRef.current)
  }, [query, supertype, rarity, doSearch])

  useEffect(() => {
    if (page === 1) return
    doSearch({ q: query, supertype, rarity, page, pageSize })
  }, [page]) // eslint-disable-line

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (
        !inputRef.current?.contains(e.target as Node) &&
        !dropdownRef.current?.contains(e.target as Node)
      ) setShowDropdown(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  const commitSearch = (value: string) => {
    setShowDropdown(false)
    setInputValue(value)
    setQuery(value)
  }

  const selectSuggestion = (card: PokemonCardAPI) => {
    setShowDropdown(false)
    setInputValue(card.name)
    setQuery(card.name)
  }

  const totalPages = Math.ceil(totalCount / pageSize)
  const hasFilters = !!supertype || !!rarity
  const isSearchActive = !!query || hasFilters

  const clearAll = () => {
    setInputValue(''); setQuery(''); setSupertype(''); setRarity('')
    setResults([]); setTotalCount(0); setSuggestions([])
    setShowDropdown(false); setEbayResults([]); setShowEbay(false)
  }

  return (
    <div className="flex flex-col gap-3">

      {/* ── Search input ───────────────────────────────────── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none z-10" />
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={e => {
            setInputValue(e.target.value)
            if (!e.target.value) setQuery('')
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') commitSearch(inputValue)
            if (e.key === 'Escape') setShowDropdown(false)
          }}
          onFocus={() => { if (suggestions.length > 0) setShowDropdown(true) }}
          placeholder="Search any card — English, Japanese, any set…"
          className="w-full pl-9 pr-9 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg
            text-sm text-white placeholder:text-zinc-600
            focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500
            transition-colors"
          autoFocus
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 z-10">
          {(loading || suggestLoading || ebayLoading) && (
            <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />
          )}
          {(inputValue || hasFilters) && !loading && !suggestLoading && !ebayLoading && (
            <button onClick={clearAll} className="text-zinc-600 hover:text-zinc-400 transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* ── Autocomplete dropdown ─────────────────────────── */}
        {showDropdown && suggestions.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute top-full left-0 right-0 mt-1.5
              bg-zinc-900 border border-zinc-700 rounded-xl
              shadow-2xl shadow-black/70 z-50 overflow-hidden"
          >
            {suggestions.map(card => {
              const mp = getMarketPriceFromCard(card)
              return (
                <button
                  key={card.id}
                  onMouseDown={e => { e.preventDefault(); selectSuggestion(card) }}
                  className="flex items-center gap-3 w-full px-3 py-2 text-left
                    hover:bg-zinc-800 transition-colors
                    border-b border-zinc-800/60 last:border-0"
                >
                  <img src={card.images.small} alt={card.name}
                    className="w-8 h-11 object-contain rounded shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{card.name}</div>
                    <div className="text-xs text-zinc-500 truncate">
                      {card.set.name} · #{card.number}
                      {card.rarity && <span className="ml-1 text-zinc-600">· {card.rarity}</span>}
                    </div>
                  </div>
                  {mp != null && (
                    <span className="text-xs text-emerald-400 font-mono shrink-0">
                      ${mp.toFixed(2)}
                    </span>
                  )}
                </button>
              )
            })}
            <button
              onMouseDown={e => { e.preventDefault(); commitSearch(inputValue) }}
              className="flex items-center justify-center gap-1.5 w-full px-3 py-2.5
                text-xs font-medium text-purple-400 hover:text-purple-300
                bg-zinc-800/50 hover:bg-zinc-800 transition-colors border-t border-zinc-700/50"
            >
              See all results for &ldquo;{inputValue}&rdquo; →
            </button>
          </div>
        )}
      </div>

      {/* ── Filters ────────────────────────────────────────── */}
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

      {showFilters && (
        <div className="grid grid-cols-2 gap-2 p-3 bg-zinc-900 rounded-xl border border-zinc-800">
          <div>
            <label className="block text-[10px] text-zinc-500 mb-1 font-medium uppercase tracking-wide">
              Type
            </label>
            <select value={supertype} onChange={e => { setSupertype(e.target.value); setPage(1) }}
              className="w-full text-xs bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5
                text-white focus:outline-none focus:ring-1 focus:ring-purple-500">
              <option value="">All types</option>
              {SUPERTYPES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-zinc-500 mb-1 font-medium uppercase tracking-wide">
              Rarity
            </label>
            <select value={rarity} onChange={e => { setRarity(e.target.value); setPage(1) }}
              className="w-full text-xs bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5
                text-white focus:outline-none focus:ring-1 focus:ring-purple-500">
              <option value="">All rarities</option>
              {RARITIES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
      )}

      {error && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* ── pokemontcg.io Results: 3D card grid ───────────── */}
      {results.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-600">{totalCount.toLocaleString()} results</span>
            {totalPages > 1 && (
              <span className="text-xs text-zinc-600">Page {page} of {totalPages}</span>
            )}
          </div>

          <div
            className="grid gap-3 max-h-[600px] overflow-y-auto pr-0.5
              scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}
          >
            {results.map(card => {
              const mp = getMarketPriceFromCard(card)
              return (
                <button
                  key={card.id}
                  onClick={() => onSelectCard(card)}
                  className="group flex flex-col items-center gap-2 p-2.5 rounded-xl
                    bg-zinc-900/60 border border-zinc-800 hover:border-zinc-600
                    transition-colors text-center"
                >
                  <HoloCard
                    imageUrl={card.images.large}
                    imageUrlSmall={card.images.small}
                    name={card.name}
                    rarity={card.rarity}
                    width={110}
                  />
                  <div className="w-full">
                    <div className="text-xs font-semibold text-white truncate leading-tight">
                      {card.name}
                    </div>
                    <div className="text-[10px] text-zinc-500 truncate mt-0.5">
                      {card.set.name} #{card.number}
                    </div>
                    {card.rarity && (
                      <div className="text-[10px] text-zinc-600 truncate">{card.rarity}</div>
                    )}
                    {mp != null ? (
                      <div className="text-xs text-emerald-400 font-mono mt-1">${mp.toFixed(2)}</div>
                    ) : (
                      <div className="text-xs text-zinc-700 mt-1">—</div>
                    )}
                    <div className="mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[10px] text-purple-400 font-medium">+ Add →</span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400
                  disabled:opacity-40 hover:bg-zinc-700 transition-colors">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs text-zinc-500">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400
                  disabled:opacity-40 hover:bg-zinc-700 transition-colors">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Loading skeleton ───────────────────────────────── */}
      {loading && results.length === 0 && (
        <div className="grid gap-3"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-zinc-900 border border-zinc-800 animate-pulse"
              style={{ height: 200 }} />
          ))}
        </div>
      )}

      {/* ── eBay fallback ─────────────────────────────────── */}
      {showEbay && ebayResults.length > 0 && (
        <div className="flex flex-col gap-3 mt-1">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-zinc-800" />
            <span className="text-[10px] font-medium text-zinc-600 uppercase tracking-wide px-2">
              Not in pokemontcg.io · Found on eBay
            </span>
            <div className="flex-1 h-px bg-zinc-800" />
          </div>

          <p className="text-xs text-zinc-600">
            These are live eBay listings — click to view on eBay, or use the link to copy the card
            details and add manually.
          </p>

          <div className="flex flex-col gap-2">
            {ebayResults.map(listing => (
              <div
                key={listing.itemId}
                className="flex items-center gap-3 p-3 rounded-xl
                  bg-zinc-900/60 border border-yellow-600/20 hover:border-yellow-500/40
                  transition-colors"
              >
                {/* Listing image */}
                {listing.imageUrl ? (
                  <img src={listing.imageUrl} alt=""
                    className="w-10 h-14 object-contain rounded shrink-0" />
                ) : (
                  <div className="w-10 h-14 bg-zinc-800 rounded shrink-0 flex items-center justify-center">
                    <span className="text-lg">🃏</span>
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-white truncate">{listing.title}</div>
                  {listing.sellerLocation && (
                    <div className="flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3 text-zinc-600 shrink-0" />
                      <span className="text-[10px] text-zinc-500">{listing.sellerLocation}</span>
                    </div>
                  )}
                  <div className="text-[10px] text-zinc-600 mt-0.5">{listing.condition}</div>
                </div>

                {/* Price + link */}
                <div className="shrink-0 text-right">
                  <div className="text-sm font-bold font-mono text-yellow-400">
                    ${listing.price.toFixed(2)}
                  </div>
                  <a
                    href={listing.itemUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-0.5 text-[10px] text-zinc-500
                      hover:text-zinc-300 transition-colors mt-1 justify-end"
                    onClick={e => e.stopPropagation()}
                  >
                    eBay <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                  {onSelectEbayListing && (
                    <button
                      onClick={() => onSelectEbayListing(listing)}
                      className="text-[10px] text-purple-400 hover:text-purple-300 mt-0.5 font-medium"
                    >
                      + Track →
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* eBay loading (when TCG returned 0) */}
      {ebayLoading && (
        <div className="flex items-center gap-2 text-xs text-zinc-600 py-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Searching eBay for this card…
        </div>
      )}

      {/* ── Empty state ────────────────────────────────────── */}
      {!loading && !ebayLoading && results.length === 0 && ebayResults.length === 0 && isSearchActive && (
        <div className="text-center py-10 text-zinc-600">
          <div className="text-3xl mb-2">🔍</div>
          <div className="text-sm">No cards found</div>
          <div className="text-xs mt-1">Try a different name or adjust filters</div>
        </div>
      )}

      {/* ── Initial prompt ─────────────────────────────────── */}
      {!isSearchActive && !loading && (
        <div className="text-center py-10 text-zinc-700">
          <div className="text-3xl mb-2">✨</div>
          <div className="text-sm">Search 20,000+ cards</div>
          <div className="text-xs mt-1">Japanese exclusives fall back to live eBay listings</div>
        </div>
      )}
    </div>
  )
}
