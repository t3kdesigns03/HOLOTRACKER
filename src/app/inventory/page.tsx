'use client'
// ============================================================
// Inventory Dashboard Page
// src/app/inventory/page.tsx
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import {
  LayoutGrid, List, Plus, Search,
  TrendingUp, TrendingDown, Minus as FlatIcon
} from 'lucide-react'
import Link from 'next/link'
import { HoloCard, MiniCard } from '@/components/card/HoloCard'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { InventoryTableRow } from '@/components/inventory/InventoryTableRow'
import { CardAnalyticsPanel } from '@/components/card/CardAnalyticsPanel'
import { CardViewer } from '@/components/card/CardViewer'
import { EditInventoryModal } from '@/components/inventory/EditInventoryModal'
import { RefreshPricesButton } from '@/components/inventory/RefreshPricesButton'
import {
  getMarketPrice, getJustTCGPrice, STATUS_COLORS, STATUS_LABELS,
  CONDITION_LABELS, PRINT_TYPE_LABELS,
  type InventoryCard, type CardStatus, type PrintType,
  type CardCondition, type JustTCGVariant,
} from '@/types'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type ViewMode = 'table' | 'grid'
type SortKey  = 'name' | 'value' | 'pl' | 'added' | 'qty'

const STATUSES: { value: CardStatus | ''; label: string }[] = [
  { value: '',           label: 'All' },
  { value: 'collection', label: 'Collection' },
  { value: 'for_sale',   label: 'For Sale' },
  { value: 'pending',    label: 'Pending' },
  { value: 'traded',     label: 'Traded' },
]

function computeInventoryCard(raw: {
  id: string
  card: {
    name: string; set_name: string; number: string; rarity?: string | null
    image_url: string | null; image_url_small: string | null
    tcgplayer_prices?: unknown
    justtcg_variants?: unknown
  }
  print_type: string
  condition: string
  quantity: number
  cost_basis: number | null
  [key: string]: unknown
}): InventoryCard {
  const card = raw as unknown as InventoryCard
  // Prefer JustTCG condition-aware price; fall back to TCGplayer market
  const jt = getJustTCGPrice(
    (raw.card.justtcg_variants ?? null) as JustTCGVariant[] | null,
    raw.print_type as PrintType,
    raw.condition as CardCondition
  )
  const mp = jt?.price ?? getMarketPrice(
    (raw.card.tcgplayer_prices ?? null) as Parameters<typeof getMarketPrice>[0],
    raw.print_type as Parameters<typeof getMarketPrice>[1]
  )
  card.market_price = mp
  card.unrealized_pl = mp != null && raw.cost_basis != null
    ? (mp - raw.cost_basis) * raw.quantity
    : null
  return card
}

export default function InventoryPage() {
  const [cards,        setCards]       = useState<InventoryCard[]>([])
  const [loading,      setLoading]     = useState(true)
  const [view,         setView]        = useState<ViewMode>('grid')   // 3D grid by default
  const [status,       setStatus]      = useState<CardStatus | ''>('')
  const [search,       setSearch]      = useState('')
  const [sortKey,      setSortKey]     = useState<SortKey>('added')
  const [sortDesc,     setSortDesc]    = useState(true)
  const [viewerCard,    setViewerCard]    = useState<InventoryCard | null>(null)
  const [analyticsCard, setAnalyticsCard] = useState<InventoryCard | null>(null)
  const [editCard,      setEditCard]      = useState<InventoryCard | null>(null)

  const fetchInventory = useCallback(async () => {
    setLoading(true)
    try {
      const sp = new URLSearchParams()
      if (status) sp.set('status', status)
      const res = await fetch(`/api/inventory?${sp}`)
      if (!res.ok) throw new Error()
      const raw: unknown[] = await res.json()
      setCards(raw.map(r => computeInventoryCard(r as Parameters<typeof computeInventoryCard>[0])))
    } catch {
      toast.error('Failed to load inventory')
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => { fetchInventory() }, [fetchInventory])

  // Client-side filter + sort
  const filtered = cards
    .filter(c => {
      if (!search) return true
      const q = search.toLowerCase()
      return (
        c.card.name.toLowerCase().includes(q) ||
        c.card.set_name.toLowerCase().includes(q) ||
        c.card.number.includes(q)
      )
    })
    .sort((a, b) => {
      let diff = 0
      switch (sortKey) {
        case 'name':  diff = a.card.name.localeCompare(b.card.name); break
        case 'value': diff = (a.market_price ?? 0) - (b.market_price ?? 0); break
        case 'pl':    diff = (a.unrealized_pl ?? -Infinity) - (b.unrealized_pl ?? -Infinity); break
        case 'qty':   diff = a.quantity - b.quantity; break
        case 'added': diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); break
      }
      return sortDesc ? -diff : diff
    })

  // Portfolio stats
  const stats = cards.reduce(
    (acc, c) => {
      acc.totalCards   += c.quantity
      acc.totalInvested += (c.cost_basis ?? 0) * c.quantity
      acc.totalValue    += (c.market_price ?? 0) * c.quantity
      if (c.unrealized_pl != null) acc.unrealizedPL += c.unrealized_pl
      return acc
    },
    { totalCards: 0, totalInvested: 0, totalValue: 0, unrealizedPL: 0 }
  )

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDesc(d => !d)
    else { setSortKey(key); setSortDesc(true) }
  }

  async function handleDelete(cardId: string) {
    const prev = cards
    setCards(c => c.filter(x => x.id !== cardId))
    try {
      const res = await fetch(`/api/inventory/${cardId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Card removed')
    } catch {
      setCards(prev)
      toast.error('Failed to remove card')
    }
  }

  const plColor = (pl: number | null) =>
    pl == null ? 'text-zinc-600'
    : pl > 0 ? 'text-emerald-400'
    : pl < 0 ? 'text-red-400'
    : 'text-zinc-400'

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">My Inventory</h1>
            <p className="text-zinc-500 text-sm mt-0.5">
              {cards.length} unique cards · {stats.totalCards} total
            </p>
          </div>
          <Link
            href="/search"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600
              hover:bg-purple-500 text-white text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Cards
          </Link>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Market Value',   value: `$${stats.totalValue.toFixed(2)}`,   color: 'text-white' },
            { label: 'Total Invested', value: `$${stats.totalInvested.toFixed(2)}`, color: 'text-zinc-300' },
            {
              label: 'Unrealized P/L',
              value: `${stats.unrealizedPL >= 0 ? '+' : ''}$${stats.unrealizedPL.toFixed(2)}`,
              color: plColor(stats.unrealizedPL)
            },
            {
              label: 'Return',
              value: stats.totalInvested > 0
                ? `${((stats.unrealizedPL / stats.totalInvested) * 100).toFixed(1)}%`
                : '—',
              color: plColor(stats.unrealizedPL)
            },
          ].map(s => (
            <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
              <div className="text-xs text-zinc-600">{s.label}</div>
              <div className={`text-lg font-bold font-mono mt-0.5 ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">

          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter inventory…"
              className="w-full pl-9 py-2 bg-zinc-900 border border-zinc-700 rounded-lg
                text-sm text-white placeholder:text-zinc-600
                focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          {/* Status filter */}
          <div className="flex gap-1.5 flex-wrap">
            {STATUSES.map(s => (
              <button
                key={s.value}
                onClick={() => setStatus(s.value)}
                className={cn(
                  'px-3 py-1.5 text-xs rounded-lg border font-medium transition-colors',
                  status === s.value
                    ? 'bg-purple-500/20 border-purple-500/60 text-purple-300'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600'
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Price refresh (JustTCG) */}
          <div className="ml-auto">
            <RefreshPricesButton onRefreshed={fetchInventory} />
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
            <button
              onClick={() => setView('table')}
              className={cn(
                'p-1.5 rounded transition-colors',
                view === 'table' ? 'bg-zinc-700 text-white' : 'text-zinc-600 hover:text-zinc-400'
              )}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView('grid')}
              className={cn(
                'p-1.5 rounded transition-colors',
                view === 'grid' ? 'bg-zinc-700 text-white' : 'text-zinc-600 hover:text-zinc-400'
              )}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-14 bg-zinc-900 rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-24 text-zinc-700">
            <div className="text-5xl mb-4">📦</div>
            {cards.length === 0 ? (
              <>
                <div className="text-lg font-medium mb-2">Your inventory is empty</div>
                <div className="text-sm mb-6">Start building your collection</div>
                <Link
                  href="/search"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
                    bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add Your First Card
                </Link>
              </>
            ) : (
              <>
                <div className="text-lg font-medium">No cards match your filters</div>
                <div className="text-sm mt-1">Try adjusting the search or status filter</div>
              </>
            )}
          </div>
        )}

        {/* Table view */}
        {!loading && filtered.length > 0 && view === 'table' && (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  {[
                    { key: 'name',  label: 'Card' },
                    { key: null,    label: 'Print / Cond.' },
                    { key: 'qty',   label: 'Qty' },
                    { key: null,    label: 'Cost' },
                    { key: 'value', label: 'Market' },
                    { key: 'pl',    label: 'P/L' },
                    { key: null,    label: 'Status' },
                    { key: null,    label: '' },
                  ].map(col => (
                    <th
                      key={col.label}
                      className={cn(
                        'px-3 py-3 text-left text-xs font-medium text-zinc-600 uppercase tracking-wide',
                        col.key && 'cursor-pointer hover:text-zinc-400 select-none'
                      )}
                      onClick={() => col.key && handleSort(col.key as SortKey)}
                    >
                      {col.label}
                      {col.key === sortKey && (
                        <span className="ml-1">{sortDesc ? '↓' : '↑'}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(card => (
                  <InventoryTableRow
                    key={card.id}
                    card={card}
                    onDelete={handleDelete}
                    onRefresh={fetchInventory}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Grid view — 3D HoloCards */}
        {!loading && filtered.length > 0 && view === 'grid' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filtered.map(card => (
              <button
                key={card.id}
                onClick={() => setViewerCard(card)}
                className="group flex flex-col items-center gap-2 p-3 rounded-xl
                  bg-zinc-900/50 border border-zinc-800 hover:border-purple-500/40
                  hover:bg-zinc-900 transition-all duration-200 text-center"
              >
                <HoloCard
                  imageUrl={card.card.image_url}
                  imageUrlSmall={card.card.image_url_small}
                  name={card.card.name}
                  rarity={card.card.rarity}
                  printType={card.print_type as Parameters<typeof HoloCard>[0]['printType']}
                  width={120}
                />
                <div className="w-full">
                  <div className="text-xs font-medium text-white truncate">{card.card.name}</div>
                  <div className="text-[10px] text-zinc-600 truncate">
                    {card.card.set_name} #{card.card.number}
                  </div>
                  <div className="flex items-center justify-center gap-1.5 mt-1">
                    {card.market_price != null ? (
                      <span className="text-xs text-emerald-400 font-mono">
                        ${card.market_price.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-700">—</span>
                    )}
                    {card.unrealized_pl != null && (
                      <span className={`text-[10px] font-mono ${plColor(card.unrealized_pl)}`}>
                        {card.unrealized_pl >= 0 ? '+' : ''}{card.unrealized_pl.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <div className="mt-1">
                    <span className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded border',
                      STATUS_COLORS[card.status]
                    )}>
                      {STATUS_LABELS[card.status]}
                    </span>
                  </div>
                  <div className="mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[10px] text-purple-400 font-medium">View Card →</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Footer count */}
        {!loading && filtered.length > 0 && (
          <div className="text-center text-xs text-zinc-700 mt-4">
            Showing {filtered.length} of {cards.length} cards
            {view === 'grid' && (
              <span className="ml-2 text-zinc-800">· click any card for analytics</span>
            )}
          </div>
        )}
      </div>

      {/* Fullscreen card viewer */}
      {viewerCard && !analyticsCard && !editCard && (
        <CardViewer
          imageUrl={viewerCard.card.image_url}
          imageUrlSmall={viewerCard.card.image_url_small}
          name={viewerCard.card.name}
          setName={viewerCard.card.set_name}
          cardNumber={viewerCard.card.number}
          rarity={viewerCard.card.rarity}
          printType={viewerCard.print_type as PrintType}
          marketPrice={viewerCard.market_price}
          onClose={() => setViewerCard(null)}
          onViewAnalytics={() => setAnalyticsCard(viewerCard)}
          onEdit={() => setEditCard(viewerCard)}
        />
      )}

      {/* Card analytics panel */}
      {analyticsCard && (
        <CardAnalyticsPanel
          cardName={analyticsCard.card.name}
          imageUrl={analyticsCard.card.image_url}
          imageUrlSmall={analyticsCard.card.image_url_small}
          rarity={analyticsCard.card.rarity}
          printType={analyticsCard.print_type as PrintType}
          setName={analyticsCard.card.set_name}
          cardNumber={analyticsCard.card.number}
          tcgplayer={analyticsCard.card.tcgplayer_prices as import('@/types').TCGPlayerPrices | null}
          cardmarket={analyticsCard.card.cardmarket_prices as import('@/types').CardmarketPrices | null}
          onClose={() => { setAnalyticsCard(null); setViewerCard(null) }}
        />
      )}

      {/* Edit inventory modal */}
      {editCard && (
        <EditInventoryModal
          card={editCard}
          onClose={() => setEditCard(null)}
          onSuccess={(updated) => {
            setCards(prev => prev.map(c => c.id === updated.id ? computeInventoryCard(updated as never) : c))
            setEditCard(null)
            setViewerCard(null)
          }}
        />
      )}
    </div>
  )
}
