'use client'
// ============================================================
// CardSearchPanel — direct "type → find → add" search
// Results grid updates as you type (debounced). No dropdown,
// no Enter required. Understands "Charizard 125/094" syntax.
// Falls back to eBay listings when pokemontcg.io has no results.
// src/components/search/CardSearchPanel.tsx
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Search, SlidersHorizontal, X, Loader2,
  ChevronLeft, ChevronRight, ExternalLink, MapPin, Plus,
} from 'lucide-react'
import { HoloCard } from '@/components/card/HoloCard'
import type { PokemonCardAPI, EbayListing } from '@/types'

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

const PAGE_SIZE = 20
const DEBOUNCE_MS = 300

function getMarketPriceFromCard(card: PokemonCardAPI): number | null {
  const slots = Object.values(
    (card.tcgplayer?.prices ?? {}) as Record<string, { market?: number | null }>
  )
  return slots.find(p => p?.market != null)?.market ?? null
}

export function CardSearchPanel({ onSelectCard, onSelectEbayListing }: Props) {
  const [inputValue, setInputValue]   = useState('')
  const [supertype,  setSupertype]    = useState('')
  const [rarity,     setRarity]       = useState('')
  const [page,       setPage]         = useState(1)
  const [showFilters, setShowFilters] = useState(false)

  const [results,    setResults]    = useState<PokemonCardAPI[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  // eBay fallback state
  const [ebayResults, setEbayResults] = useState<EbayListing[]>([])
  const [ebayLoading, setEbayLoading] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const requestSeq  = useRef(0)

  // ── Search (single code path, race-safe) ─────────────────────
  const doSearch = useCallback(async (
    q: string, sType: string, rar: string, pg: number
  ) => {
    const seq = ++requestSeq.current
    setLoading(true)
    setError(null)
    try {
      const sp = new URLSearchParams()
      if (q)     sp.set('q', q)
      if (sType) sp.set('supertype', sType)
      if (rar)   sp.set('rarity', rar)
      sp.set('page', String(pg))
      sp.set('pageSize', String(PAGE_SIZE))

      const res = await fetch(`/api/cards/search?${sp}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      if (seq !== requestSeq.current) return // a newer search superseded this one

      setResults(data.data ?? [])
      setTotalCount(data.totalCount ?? 0)
      setEbayResults([])

      // Zero pokemontcg.io hits → best-effort eBay fallback
      if ((data.totalCount ?? 0) === 0 && q) {
        setEbayLoading(true)
        fetch(`/api/ebay/listings?q=${encodeURIComponent(q)}`)
          .then(r => (r.ok ? r.json() : []))
          .then((listings: EbayListing[]) => {
            if (seq === requestSeq.current) setEbayResults(listings ?? [])
          })
          .catch(() => {})
          .finally(() => { if (seq === requestSeq.current) setEbayLoading(false) })
      }
    } catch {
      if (seq === requestSeq.current) setError('Search failed. Please try again.')
    } finally {
      if (seq === requestSeq.current) setLoading(false)
    }
  }, [])

  // ── Type → results, debounced. No Enter, no commit step. ────
  useEffect(() => {
    clearTimeout(debounceRef.current)
    const q = inputValue.trim()
    debounceRef.current = setTimeout(() => {
      if (!q && !supertype && !rarity) {
        requestSeq.current++ // cancel in-flight
        setResults([]); setTotalCount(0); setEbayResults([]); setLoading(false)
        return
      }
      setPage(1)
      doSearch(q, supertype, rarity, 1)
    }, q ? DEBOUNCE_MS : 0)
    return () => clearTimeout(debounceRef.current)
  }, [inputValue, supertype, rarity, doSearch])

  // Pagination (explicit user action — no debounce)
  useEffect(() => {
    if (page === 1) return
    const t = setTimeout(() => doSearch(inputValue.trim(), supertype, rarity, page), 0)
    return () => clearTimeout(t)
  }, [page]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)
  const hasFilters = !!supertype || !!rarity
  const isSearchActive = !!inputValue.trim() || hasFilters

  const clearAll = () => {
    requestSeq.current++
    setInputValue(''); setSupertype(''); setRarity('')
    setResults([]); setTotalCount(0); setEbayResults([])
    setLoading(false); setEbayLoading(false); setError(null)
  }

  return (
    <div className="flex flex-col gap-3">

      {/* ── Search input ───────────────────────────────────── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none z-10" />
        <input
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          placeholder={'Try "Charizard 125/094" or "Mewtwo 150/151"…'}
          className="w-full pl-9 pr-9 py-3 bg-zinc-900 border border-zinc-700 rounded-lg
            text-sm text-white placeholder:text-zinc-600
            focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500
            transition-colors"
          autoFocus
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 z-10">
          {(loading || ebayLoading) && (
            <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />
          )}
          {(inputValue || hasFilters) && !loading && !ebayLoading && (
            <button onClick={clearAll} className="text-zinc-600 hover:text-zinc-400 transition-colors p-1">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── Optional filters ───────────────────────────────── */}
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
            <select value={supertype} onChange={e => setSupertype(e.target.value)}
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
            <select value={rarity} onChange={e => setRarity(e.target.value)}
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

      {/* ── Results: 3D card grid ──────────────────────────── */}
      {results.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-600">{totalCount.toLocaleString()} results</span>
            {totalPages > 1 && (
              <span className="text-xs text-zinc-600">Page {page} of {totalPages}</span>
            )}
          </div>

          <div
            className={`grid gap-3 max-h-[600px] overflow-y-auto pr-0.5
              scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent
              ${loading ? 'opacity-60' : ''} transition-opacity`}
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}
          >
            {results.map(card => {
              const mp = getMarketPriceFromCard(card)
              return (
                <button
                  key={card.id}
                  onClick={() => onSelectCard(card)}
                  className="group flex flex-col items-center gap-2 p-2.5 rounded-xl
                    bg-zinc-900/60 border border-zinc-800 hover:border-purple-500/50
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
                    {/* Always visible (hover isn't a thing on touch) */}
                    <div className="mt-1.5 flex items-center justify-center gap-1 text-[10px]
                      font-medium text-purple-400/80 group-hover:text-purple-300 transition-colors">
                      <Plus className="w-3 h-3" /> Add
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || loading}
                className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400
                  disabled:opacity-40 hover:bg-zinc-700 transition-colors">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs text-zinc-500">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || loading}
                className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400
                  disabled:opacity-40 hover:bg-zinc-700 transition-colors">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Loading skeleton (first load only) ─────────────── */}
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
      {ebayResults.length > 0 && (
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
                {listing.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={listing.imageUrl} alt=""
                    className="w-10 h-14 object-contain rounded shrink-0" />
                ) : (
                  <div className="w-10 h-14 bg-zinc-800 rounded shrink-0 flex items-center justify-center">
                    <span className="text-lg">🃏</span>
                  </div>
                )}

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

      {ebayLoading && (
        <div className="flex items-center gap-2 text-xs text-zinc-600 py-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Searching eBay for this card…
        </div>
      )}

      {/* ── Empty state (searched, nothing anywhere) ───────── */}
      {!loading && !ebayLoading && results.length === 0 && ebayResults.length === 0 && isSearchActive && (
        <div className="text-center py-10 text-zinc-600">
          <div className="text-3xl mb-2">🔍</div>
          <div className="text-sm">No cards found</div>
          <div className="text-xs mt-1">
            Check the spelling, or try just the name — e.g. &ldquo;Charizard&rdquo;
          </div>
        </div>
      )}

      {/* ── Initial prompt ─────────────────────────────────── */}
      {!isSearchActive && !loading && (
        <div className="text-center py-10 text-zinc-700">
          <div className="text-3xl mb-2">✨</div>
          <div className="text-sm">Start typing to search 20,000+ cards</div>
          <div className="text-xs mt-1">
            Name works alone — add the number for an exact hit, like &ldquo;Mewtwo 150/151&rdquo;
          </div>
        </div>
      )}
    </div>
  )
}
