# HOLOTRACKER Phase 1A - File Generator v3

New-Item -LiteralPath "src\app\api\cards\[id]\route.ts" -ItemType File -Force | Out-Null
Set-Content -LiteralPath "src\app\api\cards\[id]\route.ts" -Value @'
// src/app/api/cards/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getCard } from ' @/lib/pokemon-tcg'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const card = await getCard(params.id)
    if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 })
    return NextResponse.json(card)
  } catch (err) {
    console.error('Card fetch error:', err)
    return NextResponse.json({ error: 'Failed to fetch card' }, { status: 500 })
  }
}

'@

New-Item -LiteralPath "src\app\api\cards\search\route.ts" -ItemType File -Force | Out-Null
Set-Content -LiteralPath "src\app\api\cards\search\route.ts" -Value @'
// src/app/api/cards/search/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { searchCards } from ' @/lib/pokemon-tcg'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const q         = searchParams.get('q') ?? undefined
  const set       = searchParams.get('set') ?? undefined
  const supertype = searchParams.get('supertype') ?? undefined
  const rarity    = searchParams.get('rarity') ?? undefined
  const page      = Number(searchParams.get('page') ?? '1')
  const pageSize  = Number(searchParams.get('pageSize') ?? '20')

  if (!q && !set && !supertype && !rarity) {
    return NextResponse.json({ data: [], page: 1, pageSize, count: 0, totalCount: 0 })
  }

  try {
    const result = await searchCards({ q, set, supertype, rarity, page, pageSize })
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' }
    })
  } catch (err) {
    console.error('Card search error:', err)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}

'@

New-Item -LiteralPath "src\app\api\inventory\[id]\route.ts" -ItemType File -Force | Out-Null
Set-Content -LiteralPath "src\app\api\inventory\[id]\route.ts" -Value @'
// src/app/api/inventory/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from ' @/lib/supabase/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  // Sanitize: only allow known fields
  const allowed = [
    'quantity','condition','print_type','cost_basis','acquired_at',
    'acquisition_notes','storage_location','status','is_public',
    'asking_price','is_graded','grading_company','grade','cert_number',
  ]
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  const { data, error } = await supabase
    .from('user_cards')
    .update(update)
    .eq('id', params.id)
    .eq('user_id', user.id)   // RLS double-check
    .select('*, card:pokemon_cards(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('user_cards')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}

'@

New-Item -LiteralPath "src\app\api\inventory\[id]\sell\route.ts" -ItemType File -Force | Out-Null
Set-Content -LiteralPath "src\app\api\inventory\[id]\sell\route.ts" -Value @'
// src/app/api/inventory/[id]/sell/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from ' @/lib/supabase/server'
import type { RecordSaleForm, CardSnapshot } from ' @/types'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch the user_card to validate ownership + build snapshot
  const { data: userCard, error: fetchErr } = await supabase
    .from('user_cards')
    .select('*, card:pokemon_cards(*)')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (fetchErr || !userCard) {
    return NextResponse.json({ error: 'Card not found' }, { status: 404 })
  }

  const body: RecordSaleForm = await req.json()
  const qtySold = Number(body.quantity_sold)

  if (qtySold > userCard.quantity) {
    return NextResponse.json(
      { error: `Cannot sell ${qtySold} — only ${userCard.quantity} in inventory` },
      { status: 400 }
    )
  }

  const card = userCard.card as { name: string; set_name: string; number: string; image_url: string | null }

  const snapshot: CardSnapshot = {
    name:       card.name,
    set_name:   card.set_name,
    number:     card.number,
    image_url:  card.image_url,
    print_type: userCard.print_type,
    condition:  userCard.condition,
  }

  // Insert sale log
  const { data: sale, error: saleErr } = await supabase
    .from('sales_log')
    .insert({
      user_id:       user.id,
      user_card_id:  params.id,
      card_id:       userCard.card_id,
      card_snapshot: snapshot,
      quantity_sold: qtySold,
      cost_basis:    userCard.cost_basis,
      sale_price:    parseFloat(body.sale_price),
      platform:      body.platform || null,
      fees:          parseFloat(body.fees || '0'),
      sold_at:       body.sold_at || new Date().toISOString().split('T')[0],
      notes:         body.notes || null,
    })
    .select()
    .single()

  if (saleErr) return NextResponse.json({ error: saleErr.message }, { status: 500 })

  // Update inventory quantity (or mark as traded if 0)
  const newQty = userCard.quantity - qtySold
  const { error: updateErr } = await supabase
    .from('user_cards')
    .update({
      quantity: newQty,
      status: newQty === 0 ? 'traded' : userCard.status,
    })
    .eq('id', params.id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({ sale, new_quantity: newQty }, { status: 201 })
}

'@

New-Item -LiteralPath "src\app\api\inventory\route.ts" -ItemType File -Force | Out-Null
Set-Content -LiteralPath "src\app\api\inventory\route.ts" -Value @'
// src/app/api/inventory/route.ts
// GET  /api/inventory           → user's full inventory
// POST /api/inventory           → add card to inventory
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from ' @/lib/supabase/server'
import type { AddCardForm } from ' @/types'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const status = searchParams.get('status')

  let query = supabase
    .from('user_cards')
    .select(`
      *,
      card:pokemon_cards (*)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: AddCardForm = await req.json()

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

'@

New-Item -LiteralPath "src\app\globals-additions.css" -ItemType File -Force | Out-Null
Set-Content -LiteralPath "src\app\globals-additions.css" -Value @'
/* src/app/globals.css — append these to your existing globals.css */

/* ── Field utilities (used throughout forms) ───────────────── */
@layer components {
  .field-label {
    @apply block text-xs font-medium text-zinc-500 uppercase tracking-wide;
  }

  .field {
    @apply w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg
      text-sm text-white placeholder:text-zinc-600
      focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500
      transition-colors;
  }

  .icon-btn {
    @apply p-1.5 rounded-lg bg-zinc-800 border border-zinc-700
      text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors;
  }
}

/* ── Scrollbar (thin + dark) ───────────────────────────────── */
.scrollbar-thin {
  scrollbar-width: thin;
  scrollbar-color: #3f3f46 transparent;
}

.scrollbar-thin::-webkit-scrollbar {
  width: 4px;
}

.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  background-color: #3f3f46;
  border-radius: 4px;
}

'@

New-Item -LiteralPath "src\app\inventory\page.tsx" -ItemType File -Force | Out-Null
Set-Content -LiteralPath "src\app\inventory\page.tsx" -Value @'
'use client'
// ============================================================
// Inventory Dashboard Page
// src/app/inventory/page.tsx
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import {
  LayoutGrid, List, Plus, Search, RefreshCw,
  TrendingUp, TrendingDown, Minus as FlatIcon
} from 'lucide-react'
import Link from 'next/link'
import { HoloCard, MiniCard } from ' @/components/card/HoloCard'
import { StatusBadge } from ' @/components/ui/StatusBadge'
import { InventoryTableRow } from ' @/components/inventory/InventoryTableRow'
import {
  getMarketPrice, STATUS_COLORS, STATUS_LABELS,
  CONDITION_LABELS, PRINT_TYPE_LABELS,
  type InventoryCard, type CardStatus
} from ' @/types'
import { toast } from 'sonner'
import { cn } from ' @/lib/utils'

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
  }
  print_type: string
  quantity: number
  cost_basis: number | null
  [key: string]: unknown
}): InventoryCard {
  const card = raw as unknown as InventoryCard
  const mp = getMarketPrice(
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
  const [cards,     setCards]     = useState<InventoryCard[]>([])
  const [loading,   setLoading]   = useState(true)
  const [view,      setView]      = useState<ViewMode>('table')
  const [status,    setStatus]    = useState<CardStatus | ''>('')
  const [search,    setSearch]    = useState('')
  const [sortKey,   setSortKey]   = useState<SortKey>('added')
  const [sortDesc,  setSortDesc]  = useState(true)

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

          {/* View toggle */}
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1 ml-auto">
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

        {/* Grid view */}
        {!loading && filtered.length > 0 && view === 'grid' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filtered.map(card => (
              <div
                key={card.id}
                className="flex flex-col items-center gap-2 p-3 rounded-xl
                  bg-zinc-900/50 border border-zinc-800 hover:border-zinc-600 transition-colors"
              >
                <HoloCard
                  imageUrl={card.card.image_url}
                  imageUrlSmall={card.card.image_url_small}
                  name={card.card.name}
                  rarity={card.card.rarity}
                  printType={card.print_type as Parameters<typeof HoloCard>[0]['printType']}
                  width={120}
                  compact
                />
                <div className="w-full text-center">
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
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer count */}
        {!loading && filtered.length > 0 && (
          <div className="text-center text-xs text-zinc-700 mt-4">
            Showing {filtered.length} of {cards.length} cards
          </div>
        )}
      </div>
    </div>
  )
}

'@

New-Item -LiteralPath "src\app\onboarding\page.tsx" -ItemType File -Force | Out-Null
Set-Content -LiteralPath "src\app\onboarding\page.tsx" -Value @'
// src/app/onboarding/page.tsx
import { OnboardingModal } from ' @/components/auth/OnboardingModal'

export default function OnboardingPage() {
  return <OnboardingModal />
}

'@

New-Item -LiteralPath "src\app\search\page.tsx" -ItemType File -Force | Out-Null
Set-Content -LiteralPath "src\app\search\page.tsx" -Value @'
'use client'
// src/app/search/page.tsx  (or integrated into /inventory as a drawer)
// Full search-and-add page for adding cards to inventory

import { useState, useCallback } from 'react'
import { CardSearchPanel } from ' @/components/search/CardSearchPanel'
import { AddToInventoryModal } from ' @/components/inventory/AddToInventoryModal'
import { HoloCard } from ' @/components/card/HoloCard'
import type { PokemonCardAPI } from ' @/types'
import { toast } from 'sonner'

export default function SearchPage() {
  const [selectedCard, setSelectedCard] = useState<PokemonCardAPI | null>(null)
  const [recentlyAdded, setRecentlyAdded] = useState<PokemonCardAPI[]>([])

  const handleSelectCard = useCallback((card: PokemonCardAPI) => {
    setSelectedCard(card)
  }, [])

  const handleSuccess = useCallback((newCard: unknown) => {
    if (selectedCard) {
      setRecentlyAdded(prev => [selectedCard, ...prev.slice(0, 7)])
    }
    setSelectedCard(null)
    toast.success('Card added to inventory!')
  }, [selectedCard])

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Add Cards</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Search 20,000+ Pokémon cards and add them to your inventory
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Search panel */}
          <div className="lg:col-span-2">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4">
              <CardSearchPanel onSelectCard={handleSelectCard} />
            </div>
          </div>

          {/* Sidebar: recently added */}
          <div className="lg:col-span-1">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4">
              <h3 className="text-sm font-medium text-zinc-400 mb-3">Recently Added</h3>
              {recentlyAdded.length === 0 ? (
                <div className="text-center py-8 text-zinc-700">
                  <div className="text-2xl mb-2">🃏</div>
                  <div className="text-xs">Cards you add will appear here</div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {recentlyAdded.map((card, i) => (
                    <div key={`${card.id}-${i}`} className="flex flex-col items-center gap-1">
                      <HoloCard
                        imageUrl={card.images.large}
                        imageUrlSmall={card.images.small}
                        name={card.name}
                        rarity={card.rarity}
                        width={90}
                        compact
                      />
                      <span className="text-[10px] text-zinc-600 text-center truncate w-full px-1">
                        {card.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add to inventory modal */}
      {selectedCard && (
        <AddToInventoryModal
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  )
}

'@

New-Item -LiteralPath "src\components\auth\OnboardingModal.tsx" -ItemType File -Force | Out-Null
Set-Content -LiteralPath "src\components\auth\OnboardingModal.tsx" -Value @'
'use client'
// ============================================================
// OnboardingModal — username setup on first login
// src/components/auth/OnboardingModal.tsx
// ============================================================

import { useState, useEffect } from 'react'
import { Loader2, Check, X } from 'lucide-react'
import { createClient } from ' @/lib/supabase/client'
import { useRouter } from 'next/navigation'

const USERNAME_RE = /^[a-z0-9_-]{3,24}$/

export function OnboardingModal() {
  const [username,    setUsername]    = useState('')
  const [displayName, setDisplayName] = useState('')
  const [status,      setStatus]      = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  // Debounce username availability check
  useEffect(() => {
    if (!username) { setStatus('idle'); return }
    if (!USERNAME_RE.test(username)) { setStatus('invalid'); return }

    setStatus('checking')
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username)
        .maybeSingle()
      setStatus(data ? 'taken' : 'available')
    }, 400)
    return () => clearTimeout(t)
  }, [username, supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (status !== 'available') return
    setSaving(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not logged in'); setSaving(false); return }

    const { error: err } = await supabase
      .from('profiles')
      .update({ username, display_name: displayName || null })
      .eq('id', user.id)

    if (err) {
      setError(err.message.includes('unique') ? 'Username taken' : err.message)
      setSaving(false)
      return
    }

    router.replace('/inventory')
    router.refresh()
  }

  const statusIcon = {
    idle:      null,
    checking:  <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />,
    available: <Check className="w-4 h-4 text-emerald-400" />,
    taken:     <X className="w-4 h-4 text-red-400" />,
    invalid:   <X className="w-4 h-4 text-red-400" />,
  }[status]

  const statusMsg = {
    idle:      '',
    checking:  'Checking…',
    available: '✓ Available',
    taken:     'Already taken',
    invalid:   '3–24 chars, letters/numbers/_ only',
  }[status]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🃏</div>
          <h1 className="text-2xl font-bold text-white">Welcome to Jokemon</h1>
          <p className="text-zinc-500 text-sm mt-2">
            Set up your profile to get started
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Username */}
          <div>
            <label className="field-label">
              Username
              <span className="text-zinc-600 font-normal ml-1">— your public URL</span>
            </label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 text-sm">
                jokemon.app/u/
              </span>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                placeholder="your-name"
                maxLength={24}
                required
                className="field pl-[108px] pr-9"
                autoFocus
              />
              {statusIcon && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {statusIcon}
                </div>
              )}
            </div>
            {statusMsg && (
              <div className={`text-xs mt-1 ${
                status === 'available' ? 'text-emerald-400'
                : status === 'idle' || status === 'checking' ? 'text-zinc-600'
                : 'text-red-400'
              }`}>
                {statusMsg}
              </div>
            )}
          </div>

          {/* Display name */}
          <div>
            <label className="field-label">
              Display Name
              <span className="text-zinc-600 font-normal ml-1">(optional)</span>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your name"
              maxLength={64}
              className="field mt-1"
            />
          </div>

          {error && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20
              rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={status !== 'available' || saving}
            className="w-full px-4 py-3 rounded-xl bg-purple-600 hover:bg-purple-500
              text-white font-semibold transition-colors
              disabled:opacity-40 disabled:cursor-not-allowed
              flex items-center justify-center gap-2 mt-2"
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Setting up…</>
            ) : (
              'Create Profile & Go to Inventory →'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

'@

New-Item -LiteralPath "src\components\card\HoloCard.tsx" -ItemType File -Force | Out-Null
Set-Content -LiteralPath "src\components\card\HoloCard.tsx" -Value @'
'use client'
// ============================================================
// HoloCard — 3D tilt + holographic shine for real Pokémon cards
// src/components/card/HoloCard.tsx
//
// Adapted from the original JokeMon 3D viewer but redesigned
// to work with real card images from pokemontcg.io.
// No R3F required — pure CSS transforms + canvas grain.
// ============================================================

import React, { useRef, useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { isHoloCard, type PrintType } from ' @/types'

export interface HoloCardProps {
  imageUrl: string | null
  imageUrlSmall?: string | null
  name: string
  rarity?: string | null
  printType?: PrintType
  /** px — rendered size. Card is always 2.5:3.5 ratio */
  width?: number
  /** If true, card is in a gallery — smaller effects */
  compact?: boolean
  /** Disable all hover effects (e.g. in table rows) */
  static?: boolean
  onClick?: () => void
  className?: string
}

// Rarity → effect intensity
function getEffectConfig(rarity?: string | null, printType?: PrintType) {
  const holo = isHoloCard(rarity, printType)

  if (rarity?.includes('Hyper') || rarity?.includes('Rainbow') || rarity?.includes('Special Illustration')) {
    return { shine: 1.0, rainbow: true, shimmer: true, grain: 0.4, tiltMax: 20 }
  }
  if (rarity?.includes('Full Art') || rarity?.includes('Alt Art') || rarity?.includes('Illustration Rare')) {
    return { shine: 0.85, rainbow: false, shimmer: true, grain: 0.3, tiltMax: 18 }
  }
  if (rarity?.includes('Rare Secret') || rarity?.includes('Rare Ultra')) {
    return { shine: 0.8, rainbow: true, shimmer: true, grain: 0.35, tiltMax: 18 }
  }
  if (holo) {
    return { shine: 0.65, rainbow: false, shimmer: true, grain: 0.25, tiltMax: 15 }
  }
  if (printType === 'reverseHolofoil') {
    return { shine: 0.45, rainbow: false, shimmer: true, grain: 0.15, tiltMax: 12 }
  }
  // Common / non-holo
  return { shine: 0.2, rainbow: false, shimmer: false, grain: 0.0, tiltMax: 10 }
}

export function HoloCard({
  imageUrl,
  imageUrlSmall,
  name,
  rarity,
  printType = 'normal',
  width = 220,
  compact = false,
  static: isStatic = false,
  onClick,
  className = '',
}: HoloCardProps) {
  const cardRef   = useRef<HTMLDivElement>(null)
  const grainRef  = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)

  const [tilt, setTilt]     = useState({ x: 0, y: 0 })
  const [shine, setShine]   = useState({ x: 50, y: 50 })
  const [hovered, setHovered] = useState(false)

  const cfg = getEffectConfig(rarity, printType)
  const height = Math.round(width * (3.5 / 2.5))

  // ── Grain canvas ──────────────────────────────────────────
  useEffect(() => {
    if (!cfg.grain || isStatic) return
    const canvas = grainRef.current
    if (!canvas) return
    canvas.width  = 256
    canvas.height = 358
    const ctx = canvas.getContext('2d')!
    const data = ctx.createImageData(256, 358)

    function regenerate() {
      for (let i = 0; i < data.data.length; i += 4) {
        const v = Math.random() * 255
        data.data[i]     = v
        data.data[i + 1] = v
        data.data[i + 2] = v
        data.data[i + 3] = Math.random() * 40 * cfg.grain
      }
      ctx.putImageData(data, 0, 0)
      rafRef.current = requestAnimationFrame(regenerate)
    }
    regenerate()
    return () => cancelAnimationFrame(rafRef.current)
  }, [cfg.grain, isStatic])

  // ── Mouse handlers ────────────────────────────────────────
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isStatic || !cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width   // 0..1
    const y = (e.clientY - rect.top)  / rect.height  // 0..1

    const rotY =  (x - 0.5) * cfg.tiltMax * 2
    const rotX = -(y - 0.5) * cfg.tiltMax * 2

    setTilt({ x: rotX, y: rotY })
    setShine({ x: x * 100, y: y * 100 })
  }, [isStatic, cfg.tiltMax])

  const handleMouseLeave = useCallback(() => {
    setTilt({ x: 0, y: 0 })
    setShine({ x: 50, y: 50 })
    setHovered(false)
  }, [])

  // ── Shine gradient string ─────────────────────────────────
  const shineGradient = cfg.rainbow
    ? `
      radial-gradient(
        ellipse at ${shine.x}% ${shine.y}%,
        rgba(255,255,255,0.0) 10%,
        rgba(255,255,255,0.08) 30%,
        rgba(255,255,255,0.0) 60%
      ),
      linear-gradient(
        ${125 + tilt.y * 2}deg,
        transparent 10%,
        rgba(255, 80, 80, ${cfg.shine * 0.35}) 25%,
        rgba(255, 200, 80, ${cfg.shine * 0.35}) 35%,
        rgba(80, 255, 120, ${cfg.shine * 0.35}) 45%,
        rgba(80, 180, 255, ${cfg.shine * 0.35}) 55%,
        rgba(160, 80, 255, ${cfg.shine * 0.35}) 65%,
        transparent 80%
      )
    `
    : cfg.shimmer
    ? `
      radial-gradient(
        ellipse at ${shine.x}% ${shine.y}%,
        rgba(255,255,255,${cfg.shine * 0.55}) 0%,
        rgba(200,220,255,${cfg.shine * 0.3}) 35%,
        transparent 70%
      )
    `
    : `
      radial-gradient(
        ellipse at ${shine.x}% ${shine.y}%,
        rgba(255,255,255,${cfg.shine * 0.3}) 0%,
        transparent 60%
      )
    `

  const cardStyle: React.CSSProperties = {
    width,
    height,
    transform: isStatic
      ? 'none'
      : `perspective(800px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${hovered ? 1.04 : 1})`,
    transition: hovered
      ? 'transform 0.05s ease-out'
      : 'transform 0.4s cubic-bezier(0.23, 1, 0.32, 1)',
  }

  const fallback = (
    <div
      className="flex items-center justify-center text-zinc-600 text-xs font-mono"
      style={{ width, height }}
    >
      <div className="text-center p-2">
        <div className="text-2xl mb-1">🃏</div>
        <div>{name}</div>
      </div>
    </div>
  )

  return (
    <div
      ref={cardRef}
      className={`relative select-none ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={cardStyle}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
    >
      {/* Card image */}
      <div
        className="relative w-full h-full rounded-[4.5%] overflow-hidden"
        style={{
          boxShadow: hovered && !isStatic
            ? `0 ${14 + Math.abs(tilt.x) * 0.8}px ${40 + Math.abs(tilt.y) * 2}px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.08)`
            : '0 4px 16px rgba(0,0,0,0.5)',
        }}
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={name}
            fill
            sizes={`${width}px`}
            className="object-contain"
            priority={false}
            placeholder={imageUrlSmall ? 'blur' : 'empty'}
            blurDataURL={imageUrlSmall ?? undefined}
          />
        ) : fallback}

        {/* Holographic shine overlay */}
        {!isStatic && (hovered || compact) && (
          <div
            className="absolute inset-0 rounded-[4.5%] pointer-events-none mix-blend-screen"
            style={{ background: shineGradient, opacity: hovered ? 1 : 0.4 }}
          />
        )}

        {/* Always-on subtle sheen for holo cards in compact mode */}
        {isStatic && cfg.shimmer && (
          <div
            className="absolute inset-0 rounded-[4.5%] pointer-events-none"
            style={{
              background: 'linear-gradient(135deg, transparent 40%, rgba(160,200,255,0.12) 60%, transparent 70%)',
            }}
          />
        )}

        {/* Grain texture */}
        {cfg.grain > 0 && !isStatic && (
          <canvas
            ref={grainRef}
            className="absolute inset-0 w-full h-full rounded-[4.5%] pointer-events-none mix-blend-overlay"
            style={{ opacity: hovered ? 0.6 : 0 }}
          />
        )}

        {/* Edge glare */}
        {hovered && !isStatic && (
          <div
            className="absolute inset-0 rounded-[4.5%] pointer-events-none"
            style={{
              background: `linear-gradient(
                ${160 + tilt.y * 3}deg,
                rgba(255,255,255,${0.05 + (tilt.x / cfg.tiltMax) * 0.05}) 0%,
                transparent 40%,
                transparent 60%,
                rgba(0,0,0,${0.05 + (-tilt.x / cfg.tiltMax) * 0.05}) 100%
              )`,
            }}
          />
        )}
      </div>

      {/* Rarity badge (compact mode) */}
      {compact && rarity && (
        <div className="absolute -bottom-5 left-0 right-0 flex justify-center">
          <span className="text-[9px] text-zinc-500 truncate max-w-full px-1">{rarity}</span>
        </div>
      )}
    </div>
  )
}

// ── Mini card (for table rows) ────────────────────────────────

export function MiniCard({
  imageUrl,
  imageUrlSmall,
  name,
  rarity,
  printType,
  size = 48,
}: {
  imageUrl: string | null
  imageUrlSmall?: string | null
  name: string
  rarity?: string | null
  printType?: PrintType
  size?: number
}) {
  return (
    <HoloCard
      imageUrl={imageUrl}
      imageUrlSmall={imageUrlSmall}
      name={name}
      rarity={rarity}
      printType={printType}
      width={size}
      static
    />
  )
}

'@

New-Item -LiteralPath "src\components\inventory\AddToInventoryModal.tsx" -ItemType File -Force | Out-Null
Set-Content -LiteralPath "src\components\inventory\AddToInventoryModal.tsx" -Value @'
'use client'
// ============================================================
// AddToInventoryModal
// src/components/inventory/AddToInventoryModal.tsx
// ============================================================

import { useState, useEffect } from 'react'
import { X, Plus, Minus, Loader2, ChevronDown } from 'lucide-react'
import { HoloCard } from ' @/components/card/HoloCard'
import {
  CONDITION_LABELS, PRINT_TYPE_LABELS, STATUS_LABELS,
  getMarketPrice, getAvailablePrintTypes,
  type PokemonCardAPI, type AddCardForm,
  type CardCondition, type PrintType, type CardStatus
} from ' @/types'

interface Props {
  card: PokemonCardAPI
  onClose: () => void
  onSuccess: (newCard: unknown) => void
}

const CONDITIONS: CardCondition[] = ['NM','LP','MP','HP','DMG']

function defaultForm(card: PokemonCardAPI): AddCardForm {
  // Auto-detect most likely print type from available prices
  const prices = card.tcgplayer
  const available = getAvailablePrintTypes(prices) as PrintType[]
  const defaultPrint: PrintType = available.includes('holofoil') ? 'holofoil'
    : available.includes('reverseHolofoil') ? 'reverseHolofoil'
    : 'normal'

  return {
    card_id:           card.id,
    quantity:          1,
    condition:         'NM',
    print_type:        defaultPrint,
    cost_basis:        '',
    acquired_at:       new Date().toISOString().split('T')[0],
    acquisition_notes: '',
    storage_location:  '',
    status:            'collection',
    is_public:         false,
    asking_price:      '',
    is_graded:         false,
    grading_company:   '',
    grade:             '',
    cert_number:       '',
  }
}

export function AddToInventoryModal({ card, onClose, onSuccess }: Props) {
  const [form, setForm] = useState<AddCardForm>(() => defaultForm(card))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const availablePrints = getAvailablePrintTypes(card.tcgplayer) as PrintType[]
  const marketPrice = getMarketPrice(card.tcgplayer ?? null, form.print_type)

  // ESC to close
  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [onClose])

  function set<K extends keyof AddCardForm>(k: K, v: AddCardForm[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to add card')
      }
      const newCard = await res.json()
      onSuccess(newCard)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const totalCost = form.cost_basis
    ? (parseFloat(form.cost_basis) * form.quantity).toFixed(2)
    : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto
        bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl">

        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4
          bg-zinc-950/95 backdrop-blur border-b border-zinc-800">
          <div>
            <h2 className="font-semibold text-white">Add to Inventory</h2>
            <p className="text-xs text-zinc-500 mt-0.5">{card.set.name} · #{card.number}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5">
          <div className="flex gap-5">

            {/* Card preview */}
            <div className="shrink-0 flex flex-col items-center gap-2">
              <HoloCard
                imageUrl={card.images.large}
                imageUrlSmall={card.images.small}
                name={card.name}
                rarity={card.rarity}
                printType={form.print_type}
                width={150}
              />
              <div className="text-center">
                <div className="font-semibold text-white text-sm">{card.name}</div>
                {marketPrice != null && (
                  <div className="text-emerald-400 text-sm font-mono">
                    ${marketPrice.toFixed(2)}
                    <span className="text-zinc-600 text-xs ml-1">market</span>
                  </div>
                )}
              </div>
            </div>

            {/* Form fields */}
            <div className="flex-1 min-w-0 flex flex-col gap-4">

              {/* Quantity */}
              <div>
                <label className="field-label">Quantity</label>
                <div className="flex items-center gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => set('quantity', Math.max(1, form.quantity - 1))}
                    className="icon-btn"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={9999}
                    value={form.quantity}
                    onChange={e => set('quantity', Math.max(1, parseInt(e.target.value) || 1))}
                    className="field w-16 text-center font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => set('quantity', form.quantity + 1)}
                    className="icon-btn"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Condition */}
              <div>
                <label className="field-label">Condition</label>
                <div className="flex gap-1.5 mt-1 flex-wrap">
                  {CONDITIONS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => set('condition', c)}
                      className={`px-2.5 py-1 text-xs rounded-lg border transition-colors font-medium
                        ${form.condition === c
                          ? 'bg-purple-500/20 border-purple-500/60 text-purple-300'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                        }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <div className="text-[11px] text-zinc-600 mt-1">
                  {CONDITION_LABELS[form.condition]}
                </div>
              </div>

              {/* Print type */}
              <div>
                <label className="field-label">Print Type</label>
                <select
                  value={form.print_type}
                  onChange={e => set('print_type', e.target.value as PrintType)}
                  className="field mt-1"
                >
                  {availablePrints.length > 0
                    ? availablePrints.map(pt => (
                        <option key={pt} value={pt}>
                          {PRINT_TYPE_LABELS[pt] ?? pt}
                        </option>
                      ))
                    : Object.entries(PRINT_TYPE_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))
                  }
                </select>
              </div>

              {/* Cost basis */}
              <div>
                <label className="field-label">
                  Purchase Price
                  <span className="text-zinc-600 font-normal ml-1">(per card)</span>
                </label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.cost_basis}
                    onChange={e => set('cost_basis', e.target.value)}
                    placeholder="0.00"
                    className="field pl-6"
                  />
                </div>
                {totalCost && form.quantity > 1 && (
                  <div className="text-[11px] text-zinc-600 mt-1">
                    Total: ${totalCost} for {form.quantity} cards
                  </div>
                )}
                {marketPrice && form.cost_basis && (
                  <div className="text-[11px] mt-1">
                    {parseFloat(form.cost_basis) < marketPrice
                      ? <span className="text-emerald-500">↑ ${(marketPrice - parseFloat(form.cost_basis)).toFixed(2)} below market</span>
                      : <span className="text-red-400">↓ ${(parseFloat(form.cost_basis) - marketPrice).toFixed(2)} above market</span>
                    }
                  </div>
                )}
              </div>

              {/* Status */}
              <div>
                <label className="field-label">Status</label>
                <div className="flex gap-1.5 mt-1 flex-wrap">
                  {(['collection','for_sale','pending'] as CardStatus[]).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => set('status', s)}
                      className={`px-2.5 py-1 text-xs rounded-lg border transition-colors
                        ${form.status === s
                          ? 'bg-purple-500/20 border-purple-500/60 text-purple-300'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                        }`}
                    >
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>

              {/* For sale price */}
              {form.status === 'for_sale' && (
                <div>
                  <label className="field-label">Asking Price</label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.asking_price}
                      onChange={e => set('asking_price', e.target.value)}
                      placeholder="0.00"
                      className="field pl-6"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Advanced fields */}
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowAdvanced(v => !v)}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300
                transition-colors"
            >
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
              />
              Advanced options
            </button>

            {showAdvanced && (
              <div className="grid grid-cols-2 gap-3 mt-3 p-4 bg-zinc-900 rounded-xl border border-zinc-800">
                <div>
                  <label className="field-label">Date Acquired</label>
                  <input
                    type="date"
                    value={form.acquired_at}
                    onChange={e => set('acquired_at', e.target.value)}
                    className="field mt-1"
                  />
                </div>

                <div>
                  <label className="field-label">Storage Location</label>
                  <input
                    type="text"
                    value={form.storage_location}
                    onChange={e => set('storage_location', e.target.value)}
                    placeholder="Binder A, Box 3…"
                    className="field mt-1"
                  />
                </div>

                <div className="col-span-2">
                  <label className="field-label">Notes</label>
                  <textarea
                    value={form.acquisition_notes}
                    onChange={e => set('acquisition_notes', e.target.value)}
                    placeholder="Any notes about this card…"
                    rows={2}
                    className="field mt-1 resize-none"
                  />
                </div>

                <div className="col-span-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_public"
                    checked={form.is_public}
                    onChange={e => set('is_public', e.target.checked)}
                    className="rounded border-zinc-700 bg-zinc-800 text-purple-500 focus:ring-purple-500"
                  />
                  <label htmlFor="is_public" className="text-xs text-zinc-400 cursor-pointer">
                    Make this card visible in my public collection
                  </label>
                </div>

                {/* Graded card */}
                <div className="col-span-2 border-t border-zinc-800 pt-3">
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      type="checkbox"
                      id="is_graded"
                      checked={form.is_graded}
                      onChange={e => set('is_graded', e.target.checked)}
                      className="rounded border-zinc-700 bg-zinc-800 text-purple-500 focus:ring-purple-500"
                    />
                    <label htmlFor="is_graded" className="text-xs text-zinc-400 cursor-pointer">
                      This is a graded card (PSA / BGS / CGC)
                    </label>
                  </div>

                  {form.is_graded && (
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="field-label">Grader</label>
                        <select
                          value={form.grading_company}
                          onChange={e => set('grading_company', e.target.value as 'PSA'|'BGS'|'CGC'|'')}
                          className="field mt-1"
                        >
                          <option value="">Select…</option>
                          <option value="PSA">PSA</option>
                          <option value="BGS">BGS</option>
                          <option value="CGC">CGC</option>
                        </select>
                      </div>
                      <div>
                        <label className="field-label">Grade</label>
                        <input
                          type="text"
                          value={form.grade}
                          onChange={e => set('grade', e.target.value)}
                          placeholder="10, 9.5…"
                          className="field mt-1"
                        />
                      </div>
                      <div>
                        <label className="field-label">Cert #</label>
                        <input
                          type="text"
                          value={form.cert_number}
                          onChange={e => set('cert_number', e.target.value)}
                          placeholder="12345678"
                          className="field mt-1"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="mt-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20
              rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 mt-5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700
                text-zinc-400 text-sm font-medium hover:bg-zinc-700 hover:text-white
                transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500
                text-white text-sm font-semibold transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
                flex items-center justify-center gap-2"
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Adding…</>
              ) : (
                <>+ Add {form.quantity > 1 ? `${form.quantity}×` : ''} to Inventory</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

'@

New-Item -LiteralPath "src\components\inventory\InventoryTableRow.tsx" -ItemType File -Force | Out-Null
Set-Content -LiteralPath "src\components\inventory\InventoryTableRow.tsx" -Value @'
'use client'
// src/components/inventory/InventoryTableRow.tsx

import { useState } from 'react'
import { MoreHorizontal, Trash2, DollarSign, Edit2, Eye } from 'lucide-react'
import { MiniCard } from ' @/components/card/HoloCard'
import {
  CONDITION_COLORS, PRINT_TYPE_LABELS, STATUS_COLORS, STATUS_LABELS,
  type InventoryCard
} from ' @/types'
import { cn } from ' @/lib/utils'
import { RecordSaleModal } from './RecordSaleModal'

interface Props {
  card: InventoryCard
  onDelete: (id: string) => void
  onRefresh: () => void
}

export function InventoryTableRow({ card, onDelete, onRefresh }: Props) {
  const [showMenu,    setShowMenu]    = useState(false)
  const [showSellModal, setShowSellModal] = useState(false)

  const pl = card.unrealized_pl
  const plColor = pl == null ? 'text-zinc-700'
    : pl > 0 ? 'text-emerald-400'
    : pl < 0 ? 'text-red-400'
    : 'text-zinc-500'

  const plPct = pl != null && card.cost_basis
    ? ((pl / (card.cost_basis * card.quantity)) * 100)
    : null

  return (
    <>
      <tr className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors group">
        {/* Card */}
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-2.5">
            <MiniCard
              imageUrl={card.card.image_url}
              imageUrlSmall={card.card.image_url_small}
              name={card.card.name}
              rarity={card.card.rarity}
              printType={card.print_type as Parameters<typeof MiniCard>[0]['printType']}
              size={44}
            />
            <div className="min-w-0">
              <div className="font-medium text-white text-sm truncate max-w-[160px]">
                {card.card.name}
              </div>
              <div className="text-xs text-zinc-600 truncate">
                {card.card.set_name} · #{card.card.number}
              </div>
            </div>
          </div>
        </td>

        {/* Print / Condition */}
        <td className="px-3 py-2.5">
          <div className="text-xs text-zinc-400">
            {PRINT_TYPE_LABELS[card.print_type as keyof typeof PRINT_TYPE_LABELS] ?? card.print_type}
          </div>
          <div className={`text-xs mt-0.5 ${CONDITION_COLORS[card.condition] ?? 'text-zinc-500'}`}>
            {card.condition}
          </div>
        </td>

        {/* Qty */}
        <td className="px-3 py-2.5 text-sm text-zinc-300 font-mono">
          {card.quantity}
        </td>

        {/* Cost */}
        <td className="px-3 py-2.5 font-mono text-xs">
          {card.cost_basis != null ? (
            <div>
              <div className="text-zinc-400">${card.cost_basis.toFixed(2)}</div>
              {card.quantity > 1 && (
                <div className="text-zinc-700">${(card.cost_basis * card.quantity).toFixed(2)} total</div>
              )}
            </div>
          ) : (
            <span className="text-zinc-700">—</span>
          )}
        </td>

        {/* Market value */}
        <td className="px-3 py-2.5 font-mono text-xs">
          {card.market_price != null ? (
            <div>
              <div className="text-emerald-400">${card.market_price.toFixed(2)}</div>
              {card.quantity > 1 && (
                <div className="text-zinc-600">${(card.market_price * card.quantity).toFixed(2)} total</div>
              )}
            </div>
          ) : (
            <span className="text-zinc-700">—</span>
          )}
        </td>

        {/* P/L */}
        <td className="px-3 py-2.5 font-mono text-xs">
          {pl != null ? (
            <div>
              <div className={plColor}>
                {pl >= 0 ? '+' : ''}${pl.toFixed(2)}
              </div>
              {plPct != null && (
                <div className={cn('text-[10px]', plColor, 'opacity-70')}>
                  {plPct >= 0 ? '+' : ''}{plPct.toFixed(1)}%
                </div>
              )}
            </div>
          ) : (
            <span className="text-zinc-700">—</span>
          )}
        </td>

        {/* Status */}
        <td className="px-3 py-2.5">
          <span className={cn(
            'text-[10px] px-1.5 py-0.5 rounded border font-medium',
            STATUS_COLORS[card.status]
          )}>
            {STATUS_LABELS[card.status]}
          </span>
        </td>

        {/* Actions */}
        <td className="px-3 py-2.5">
          <div className="relative">
            <button
              onClick={() => setShowMenu(v => !v)}
              className="p-1.5 rounded-lg text-zinc-700 hover:text-zinc-300 hover:bg-zinc-700
                transition-colors opacity-0 group-hover:opacity-100"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-8 z-20 w-40
                  bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden">
                  <button
                    onClick={() => { setShowMenu(false); setShowSellModal(true) }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-zinc-300
                      hover:bg-zinc-800 transition-colors text-left"
                  >
                    <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                    Record Sale
                  </button>
                  <button
                    onClick={() => { setShowMenu(false) }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-zinc-300
                      hover:bg-zinc-800 transition-colors text-left"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                    Edit
                  </button>
                  <div className="border-t border-zinc-800 my-0.5" />
                  <button
                    onClick={() => {
                      setShowMenu(false)
                      if (confirm('Remove this card from inventory?')) onDelete(card.id)
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-400
                      hover:bg-zinc-800 transition-colors text-left"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove
                  </button>
                </div>
              </>
            )}
          </div>
        </td>
      </tr>

      {showSellModal && (
        <RecordSaleModal
          card={card}
          onClose={() => setShowSellModal(false)}
          onSuccess={() => { setShowSellModal(false); onRefresh() }}
        />
      )}
    </>
  )
}

'@

New-Item -LiteralPath "src\components\inventory\RecordSaleModal.tsx" -ItemType File -Force | Out-Null
Set-Content -LiteralPath "src\components\inventory\RecordSaleModal.tsx" -Value @'
'use client'
// src/components/inventory/RecordSaleModal.tsx

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { MiniCard } from ' @/components/card/HoloCard'
import type { InventoryCard, RecordSaleForm } from ' @/types'
import { toast } from 'sonner'

interface Props {
  card: InventoryCard
  onClose: () => void
  onSuccess: () => void
}

const PLATFORMS = ['TCGPlayer', 'eBay', 'Local', 'Facebook', 'Mercari', 'Other']

export function RecordSaleModal({ card, onClose, onSuccess }: Props) {
  const [form, setForm] = useState<RecordSaleForm>({
    user_card_id:  card.id,
    quantity_sold: 1,
    sale_price:    '',
    platform:      'TCGPlayer',
    fees:          '',
    sold_at:       new Date().toISOString().split('T')[0],
    notes:         '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  function set<K extends keyof RecordSaleForm>(k: K, v: RecordSaleForm[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  const salePrice = parseFloat(form.sale_price) || 0
  const fees      = parseFloat(form.fees) || 0
  const costBasis = (card.cost_basis ?? 0) * form.quantity_sold
  const netProfit = salePrice - fees - costBasis
  const margin    = costBasis > 0 ? ((netProfit / costBasis) * 100) : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/inventory/${card.id}/sell`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Failed to record sale')
      }
      toast.success('Sale recorded!')
      onSuccess()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-md bg-zinc-950 border border-zinc-800
        rounded-2xl shadow-2xl overflow-hidden">

        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="font-semibold text-white">Record Sale</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          {/* Card preview */}
          <div className="flex items-center gap-3 p-3 bg-zinc-900 rounded-xl border border-zinc-800">
            <MiniCard
              imageUrl={card.card.image_url}
              name={card.card.name}
              rarity={card.card.rarity}
              printType={card.print_type as Parameters<typeof MiniCard>[0]['printType']}
              size={40}
            />
            <div>
              <div className="font-medium text-white text-sm">{card.card.name}</div>
              <div className="text-xs text-zinc-500">{card.condition} · {card.print_type}</div>
              <div className="text-xs text-zinc-600">
                {card.quantity} in inventory
                {card.cost_basis && ` · Cost: $${card.cost_basis.toFixed(2)}/ea`}
              </div>
            </div>
          </div>

          {/* Qty sold */}
          <div>
            <label className="field-label">Quantity Sold</label>
            <input
              type="number"
              min={1}
              max={card.quantity}
              value={form.quantity_sold}
              onChange={e => set('quantity_sold', parseInt(e.target.value) || 1)}
              className="field mt-1 w-24"
            />
          </div>

          {/* Sale price */}
          <div>
            <label className="field-label">Sale Price (total)</label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.sale_price}
                onChange={e => set('sale_price', e.target.value)}
                placeholder="0.00"
                required
                className="field pl-6"
              />
            </div>
          </div>

          {/* Platform + fees */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Platform</label>
              <select
                value={form.platform}
                onChange={e => set('platform', e.target.value)}
                className="field mt-1"
              >
                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Fees</label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.fees}
                  onChange={e => set('fees', e.target.value)}
                  placeholder="0.00"
                  className="field pl-6"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="field-label">Date Sold</label>
            <input
              type="date"
              value={form.sold_at}
              onChange={e => set('sold_at', e.target.value)}
              className="field mt-1"
            />
          </div>

          {/* P/L preview */}
          {salePrice > 0 && (
            <div className="p-3 bg-zinc-900 rounded-xl border border-zinc-800 grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-[10px] text-zinc-600 mb-0.5">Net Received</div>
                <div className="text-sm font-mono text-white">${(salePrice - fees).toFixed(2)}</div>
              </div>
              <div>
                <div className="text-[10px] text-zinc-600 mb-0.5">Net Profit</div>
                <div className={`text-sm font-mono ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {netProfit >= 0 ? '+' : ''}${netProfit.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-zinc-600 mb-0.5">Margin</div>
                <div className={`text-sm font-mono ${margin != null && margin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {margin != null ? `${margin >= 0 ? '+' : ''}${margin.toFixed(1)}%` : '—'}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl
              bg-zinc-800 border border-zinc-700 text-zinc-400 text-sm font-medium
              hover:bg-zinc-700 hover:text-white transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 rounded-xl
              bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold
              transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Record Sale'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

'@

New-Item -LiteralPath "src\components\search\CardSearchPanel.tsx" -ItemType File -Force | Out-Null
Set-Content -LiteralPath "src\components\search\CardSearchPanel.tsx" -Value @'
'use client'
// ============================================================
// CardSearchPanel — debounced search with filters + pagination
// src/components/search/CardSearchPanel.tsx
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, SlidersHorizontal, X, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { CardSearchResult } from './CardSearchResult'
import type { PokemonCardAPI, CardSearchParams } from ' @/types'

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
  const [error,      setError]      = useState<string | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const pageSize    = 15

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

'@

New-Item -LiteralPath "src\components\search\CardSearchResult.tsx" -ItemType File -Force | Out-Null
Set-Content -LiteralPath "src\components\search\CardSearchResult.tsx" -Value @'
'use client'
// src/components/search/CardSearchResult.tsx
import { HoloCard } from ' @/components/card/HoloCard'
import { PRINT_TYPE_LABELS, type PokemonCardAPI, type PrintType } from ' @/types'
import { getAvailablePrintTypes } from ' @/lib/pokemon-tcg'

interface Props {
  card: PokemonCardAPI
  onSelect: (card: PokemonCardAPI) => void
}

const RARITY_BADGE: Record<string, string> = {
  'Common':                   'text-zinc-400',
  'Uncommon':                 'text-green-400',
  'Rare':                     'text-blue-400',
  'Rare Holo':                'text-purple-400',
  'Rare Ultra':               'text-yellow-400',
  'Rare Secret':              'text-orange-400',
  'Illustration Rare':        'text-pink-400',
  'Special Illustration Rare':'text-pink-300',
  'Hyper Rare':               'text-yellow-300',
  'Double Rare':              'text-blue-300',
}

export function CardSearchResult({ card, onSelect }: Props) {
  const printTypes = getAvailablePrintTypes(card.tcgplayer) as PrintType[]
  const marketPrice = card.tcgplayer?.prices?.normal?.market
    ?? card.tcgplayer?.prices?.holofoil?.market
    ?? null

  const rarityColor = card.rarity
    ? (RARITY_BADGE[card.rarity] ?? 'text-zinc-400')
    : 'text-zinc-500'

  return (
    <button
      onClick={() => onSelect(card)}
      className="group flex items-center gap-3 w-full p-2.5 rounded-xl
        bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-600
        transition-all duration-150 text-left"
    >
      {/* Card thumbnail */}
      <div className="shrink-0">
        <HoloCard
          imageUrl={card.images.large}
          imageUrlSmall={card.images.small}
          name={card.name}
          rarity={card.rarity}
          width={52}
          static
        />
      </div>

      {/* Card info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="font-semibold text-white text-sm truncate">{card.name}</span>
          {card.hp && (
            <span className="text-xs text-zinc-500">HP {card.hp}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {/* Set info */}
          <span className="text-xs text-zinc-500 truncate">
            {card.set.name} · #{card.number}
          </span>

          {/* Rarity */}
          {card.rarity && (
            <span className={`text-xs ${rarityColor}`}>· {card.rarity}</span>
          )}
        </div>

        {/* Print types available */}
        {printTypes.length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {printTypes.slice(0, 3).map(pt => (
              <span key={pt} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                {PRINT_TYPE_LABELS[pt] ?? pt}
              </span>
            ))}
            {printTypes.length > 3 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500">
                +{printTypes.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Price */}
      <div className="shrink-0 text-right">
        {marketPrice != null ? (
          <div>
            <div className="text-sm font-semibold text-emerald-400">
              ${marketPrice.toFixed(2)}
            </div>
            <div className="text-[10px] text-zinc-600">market</div>
          </div>
        ) : (
          <div className="text-xs text-zinc-600">—</div>
        )}
        <div className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-[10px] text-purple-400 font-medium">+ Add →</span>
        </div>
      </div>
    </button>
  )
}

'@

New-Item -LiteralPath "src\components\ui\StatusBadge.tsx" -ItemType File -Force | Out-Null
Set-Content -LiteralPath "src\components\ui\StatusBadge.tsx" -Value @'
// src/components/ui/StatusBadge.tsx
import { cn } from ' @/lib/utils'
import { STATUS_COLORS, STATUS_LABELS, type CardStatus } from ' @/types'

export function StatusBadge({ status }: { status: CardStatus }) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-medium',
      STATUS_COLORS[status]
    )}>
      {STATUS_LABELS[status]}
    </span>
  )
}

'@

New-Item -LiteralPath "src\lib\pokemon-tcg.ts" -ItemType File -Force | Out-Null
Set-Content -LiteralPath "src\lib\pokemon-tcg.ts" -Value @'
// ============================================================
// Pokémon TCG API Client + Supabase Caching Layer
// src/lib/pokemon-tcg.ts
// ============================================================

import { createClient } from ' @/lib/supabase/server'
import type {
  PokemonCardAPI,
  PokemonCardRow,
  CardSearchParams,
  CardSearchResult,
  TCGPlayerPrices,
} from ' @/types'

const BASE_URL = 'https://api.pokemontcg.io/v2'
const PRICE_STALE_HOURS = 6   // refresh prices if older than 6h

function apiHeaders(): HeadersInit {
  const key = process.env.POKEMON_TCG_API_KEY
  return key ? { 'X-Api-Key': key } : {}
}

// ── Raw API fetch ────────────────────────────────────────────

async function fetchFromAPI<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`)
  if (params) {
    Object.entries(params).forEach(([k, v]) => v && url.searchParams.set(k, v))
  }
  const res = await fetch(url.toString(), {
    headers: apiHeaders(),
    next: { revalidate: 300 }, // 5 min edge cache
  })
  if (!res.ok) {
    throw new Error(`Pokemon TCG API error ${res.status}: ${await res.text()}`)
  }
  return res.json()
}

// ── Search cards (hits API directly, results cached per-card) ─

export async function searchCards(params: CardSearchParams): Promise<CardSearchResult> {
  const { q, set, supertype, types, rarity, page = 1, pageSize = 20 } = params

  // Build the pokemontcg.io query string
  const queryParts: string[] = []
  if (q)         queryParts.push(`name:"${q}*"`)
  if (set)       queryParts.push(`set.id:${set}`)
  if (supertype) queryParts.push(`supertype:"${supertype}"`)
  if (types?.length) queryParts.push(`types:${types.join(',')}`)
  if (rarity)    queryParts.push(`rarity:"${rarity}"`)

  const query = queryParts.join(' ')

  const apiParams: Record<string, string> = {
    pageSize: String(pageSize),
    page: String(page),
    orderBy: '-set.releaseDate',
  }
  if (query) apiParams.q = query

  const result = await fetchFromAPI<{
    data: PokemonCardAPI[]
    page: number
    pageSize: number
    count: number
    totalCount: number
  }>('/cards', apiParams)

  // Background-cache new cards into Supabase (fire-and-forget)
  cacheCards(result.data).catch(console.error)

  return result
}

// ── Get a single card (cache-first) ──────────────────────────

export async function getCard(cardId: string): Promise<PokemonCardRow | null> {
  const supabase = createClient()

  // 1. Try cache
  const { data: cached } = await supabase
    .from('pokemon_cards')
    .select('*')
    .eq('id', cardId)
    .maybeSingle()

  if (cached) {
    // Refresh prices if stale
    const updatedAt = cached.price_updated_at ? new Date(cached.price_updated_at) : null
    const staleMs = PRICE_STALE_HOURS * 60 * 60 * 1000
    if (!updatedAt || Date.now() - updatedAt.getTime() > staleMs) {
      refreshCardPrices(cardId).catch(console.error)
    }
    return cached as PokemonCardRow
  }

  // 2. Fetch from API
  const { data } = await fetchFromAPI<{ data: PokemonCardAPI }>(`/cards/${cardId}`)
  if (!data) return null

  await cacheCards([data])

  // 3. Return from cache
  const { data: fresh } = await supabase
    .from('pokemon_cards')
    .select('*')
    .eq('id', cardId)
    .maybeSingle()

  return fresh as PokemonCardRow | null
}

// ── Cache cards into Supabase ────────────────────────────────

export async function cacheCards(cards: PokemonCardAPI[]): Promise<void> {
  if (!cards.length) return

  // Use service-role client for writes (bypasses RLS)
  const { createClient: createServiceClient } = await import(' @/lib/supabase/service')
  const supabase = createServiceClient()

  const rows = cards.map(card => ({
    id:               card.id,
    name:             card.name,
    set_id:           card.set.id,
    set_name:         card.set.name,
    set_series:       card.set.series ?? null,
    set_logo_url:     card.set.images?.logo ?? null,
    set_symbol_url:   card.set.images?.symbol ?? null,
    number:           card.number,
    rarity:           card.rarity ?? null,
    supertype:        card.supertype ?? null,
    subtypes:         card.subtypes ?? null,
    hp:               card.hp ?? null,
    types:            card.types ?? null,
    evolves_from:     card.evolvesFrom ?? null,
    image_url:        card.images?.large ?? null,
    image_url_small:  card.images?.small ?? null,
    tcgplayer_prices: card.tcgplayer ?? null,
    cardmarket_prices: card.cardmarket ?? null,
    price_updated_at: new Date().toISOString(),
    raw_data:         card,
  }))

  const { error } = await supabase
    .from('pokemon_cards')
    .upsert(rows, { onConflict: 'id', ignoreDuplicates: false })

  if (error) console.error('Cache write error:', error)
}

// ── Refresh just prices for a known card ─────────────────────

async function refreshCardPrices(cardId: string): Promise<void> {
  try {
    const { data } = await fetchFromAPI<{ data: PokemonCardAPI }>(`/cards/${cardId}`)
    if (!data) return

    const { createClient: createServiceClient } = await import(' @/lib/supabase/service')
    const supabase = createServiceClient()

    await supabase
      .from('pokemon_cards')
      .update({
        tcgplayer_prices: data.tcgplayer ?? null,
        cardmarket_prices: data.cardmarket ?? null,
        price_updated_at: new Date().toISOString(),
      })
      .eq('id', cardId)
  } catch (e) {
    console.error('Price refresh failed for', cardId, e)
  }
}

// ── Refresh prices for a batch of cards ──────────────────────
// Called when user opens their inventory dashboard

export async function refreshStaleInventoryPrices(cardIds: string[]): Promise<void> {
  if (!cardIds.length) return

  const supabase = createClient()
  const staleMs = PRICE_STALE_HOURS * 60 * 60 * 1000
  const staleThreshold = new Date(Date.now() - staleMs).toISOString()

  const { data: stale } = await supabase
    .from('pokemon_cards')
    .select('id')
    .in('id', cardIds)
    .or(`price_updated_at.is.null,price_updated_at.lt.${staleThreshold}`)

  if (!stale?.length) return

  // Refresh in batches of 10 to respect rate limits
  const ids = stale.map(r => r.id)
  for (let i = 0; i < ids.length; i += 10) {
    const batch = ids.slice(i, i + 10)
    await Promise.allSettled(batch.map(refreshCardPrices))
    if (i + 10 < ids.length) await sleep(1000) // 1s between batches
  }
}

// ── Get sets list ────────────────────────────────────────────

export interface SetSummary {
  id: string
  name: string
  series: string
  releaseDate: string
  total: number
  images: { symbol: string; logo: string }
}

let _setsCache: SetSummary[] | null = null
let _setsCachedAt = 0

export async function getSets(): Promise<SetSummary[]> {
  if (_setsCache && Date.now() - _setsCachedAt < 1000 * 60 * 60) {
    return _setsCache
  }
  const { data } = await fetchFromAPI<{ data: SetSummary[] }>('/sets', {
    orderBy: '-releaseDate',
    pageSize: '250',
  })
  _setsCache = data
  _setsCachedAt = Date.now()
  return data
}

// ── Helpers ──────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

/** Get available print types for a card based on its TCGPlayer prices */
export function getAvailablePrintTypes(prices?: TCGPlayerPrices | null): string[] {
  if (!prices?.prices) return ['normal']
  return Object.keys(prices.prices).filter(k => {
    const p = (prices.prices as Record<string, { market?: number }>)[k]
    return p?.market != null
  })
}

'@

New-Item -LiteralPath "src\lib\supabase\client.ts" -ItemType File -Force | Out-Null
Set-Content -LiteralPath "src\lib\supabase\client.ts" -Value @'
// src/lib/supabase/client.ts
// Browser-side Supabase client (singleton)
import { createBrowserClient } from ' @supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

'@

New-Item -LiteralPath "src\lib\supabase\server.ts" -ItemType File -Force | Out-Null
Set-Content -LiteralPath "src\lib\supabase\server.ts" -Value @'
// src/lib/supabase/server.ts
// Standard server-side Supabase client (respects RLS via user session)
import { createServerClient, type CookieOptions } from ' @supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) {
          try { cookieStore.set({ name, value, ...options }) } catch {}
        },
        remove(name: string, options: CookieOptions) {
          try { cookieStore.set({ name, value: '', ...options }) } catch {}
        },
      },
    }
  )
}

'@

New-Item -LiteralPath "src\lib\supabase\service.ts" -ItemType File -Force | Out-Null
Set-Content -LiteralPath "src\lib\supabase\service.ts" -Value @'
// src/lib/supabase/service.ts
// Service-role client — bypasses RLS. Server-only. Never expose to client.
import { createClient as _createClient } from ' @supabase/supabase-js'

export function createClient() {
  return _createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

'@

New-Item -LiteralPath "src\lib\utils.ts" -ItemType File -Force | Out-Null
Set-Content -LiteralPath "src\lib\utils.ts" -Value @'
// src/lib/utils.ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

'@

New-Item -LiteralPath "src\middleware.ts" -ItemType File -Force | Out-Null
Set-Content -LiteralPath "src\middleware.ts" -Value @'
// ============================================================
// Middleware — auth guard + onboarding redirect
// src/middleware.ts
// ============================================================

import { createServerClient, type CookieOptions } from ' @supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that require auth
const PROTECTED = ['/inventory', '/search', '/settings', '/api/inventory']
// Routes that redirect authed users away
const AUTH_ROUTES = ['/login', '/signup']

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return request.cookies.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  const { pathname } = request.nextUrl

  const isProtected = PROTECTED.some(p => pathname.startsWith(p))
  const isAuthRoute = AUTH_ROUTES.some(p => pathname.startsWith(p))

  if (isProtected && !session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (isAuthRoute && session) {
    return NextResponse.redirect(new URL('/inventory', request.url))
  }

  // Check if profile setup is needed (first login)
  if (session && isProtected && !pathname.startsWith('/onboarding')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', session.user.id)
      .maybeSingle()

    if (profile && !profile.username) {
      return NextResponse.redirect(new URL('/onboarding', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

'@

New-Item -LiteralPath "src\types\index.ts" -ItemType File -Force | Out-Null
Set-Content -LiteralPath "src\types\index.ts" -Value @'
// ============================================================
// Jokemon TCG - Core TypeScript Types
// src/types/index.ts
// ============================================================

// ── Pokémon TCG API Types ────────────────────────────────────

export interface PokemonSet {
  id: string
  name: string
  series: string
  printedTotal: number
  total: number
  releaseDate: string
  images: {
    symbol: string
    logo: string
  }
}

export interface TCGPrice {
  low?: number
  mid?: number
  high?: number
  market?: number
  directLow?: number
}

export interface TCGPlayerPrices {
  url?: string
  updatedAt?: string
  prices?: {
    normal?: TCGPrice
    holofoil?: TCGPrice
    reverseHolofoil?: TCGPrice
    firstEdition?: TCGPrice
    firstEditionHolofoil?: TCGPrice
    unlimited?: TCGPrice
    unlimitedHolofoil?: TCGPrice
    '1stEdition'?: TCGPrice
    '1stEditionHolofoil'?: TCGPrice
  }
}

export interface CardmarketPrices {
  url?: string
  updatedAt?: string
  prices?: {
    averageSellPrice?: number
    lowPrice?: number
    trendPrice?: number
    avg1?: number
    avg7?: number
    avg30?: number
  }
}

export interface PokemonCardAPI {
  id: string
  name: string
  supertype: 'Pokémon' | 'Trainer' | 'Energy'
  subtypes: string[]
  hp?: string
  types?: string[]
  evolvesWith?: string[]
  evolvesFrom?: string
  rules?: string[]
  number: string
  artist?: string
  rarity?: string
  flavorText?: string
  nationalPokedexNumbers?: number[]
  set: PokemonSet
  images: {
    small: string
    large: string
  }
  tcgplayer?: TCGPlayerPrices
  cardmarket?: CardmarketPrices
}

// ── Database Row Types ───────────────────────────────────────

export interface Profile {
  id: string
  username: string | null
  display_name: string | null
  bio: string | null
  avatar_url: string | null
  collection_public: boolean
  created_at: string
  updated_at: string
}

export interface PokemonCardRow {
  id: string
  name: string
  set_id: string
  set_name: string
  set_series: string | null
  set_logo_url: string | null
  set_symbol_url: string | null
  number: string
  rarity: string | null
  supertype: string | null
  subtypes: string[] | null
  hp: string | null
  types: string[] | null
  evolves_from: string | null
  image_url: string | null
  image_url_small: string | null
  tcgplayer_prices: TCGPlayerPrices | null
  cardmarket_prices: CardmarketPrices | null
  price_updated_at: string | null
  raw_data: PokemonCardAPI | null
  created_at: string
}

export type CardCondition = 'NM' | 'LP' | 'MP' | 'HP' | 'DMG'
export type CardStatus = 'collection' | 'for_sale' | 'pending' | 'traded'
export type PrintType =
  | 'normal'
  | 'holofoil'
  | 'reverseHolofoil'
  | 'firstEdition'
  | 'shadowless'
  | 'fullArt'
  | 'altArt'
  | 'promo'
  | 'other'
export type GradingCompany = 'PSA' | 'BGS' | 'CGC'

export interface UserCardRow {
  id: string
  user_id: string
  card_id: string
  quantity: number
  condition: CardCondition
  print_type: PrintType
  cost_basis: number | null
  acquired_at: string | null
  acquisition_notes: string | null
  storage_location: string | null
  status: CardStatus
  is_public: boolean
  asking_price: number | null
  is_graded: boolean
  grading_company: GradingCompany | null
  grade: string | null
  cert_number: string | null
  created_at: string
  updated_at: string
}

export interface SaleLogRow {
  id: string
  user_id: string
  user_card_id: string | null
  card_id: string | null
  card_snapshot: CardSnapshot
  quantity_sold: number
  cost_basis: number | null
  sale_price: number
  platform: string | null
  fees: number
  net_profit: number     // generated column
  margin_pct: number | null
  sold_at: string
  notes: string | null
  created_at: string
}

export interface WishlistRow {
  id: string
  user_id: string
  card_id: string
  print_type: string
  max_price: number | null
  priority: 1 | 2 | 3
  notes: string | null
  created_at: string
}

// ── Composite / View Types ───────────────────────────────────

export interface CardSnapshot {
  name: string
  set_name: string
  number: string
  image_url: string | null
  print_type: PrintType
  condition: CardCondition
}

/** UserCard joined with the cached PokemonCardRow */
export interface InventoryCard extends UserCardRow {
  card: PokemonCardRow
  /** Derived at render time from tcgplayer_prices + print_type */
  market_price: number | null
  /** (market_price * quantity) - (cost_basis * quantity) */
  unrealized_pl: number | null
}

/** Form data for adding/editing a card in inventory */
export interface AddCardForm {
  card_id: string
  quantity: number
  condition: CardCondition
  print_type: PrintType
  cost_basis: string   // string for controlled inputs, parse before save
  acquired_at: string
  acquisition_notes: string
  storage_location: string
  status: CardStatus
  is_public: boolean
  asking_price: string
  is_graded: boolean
  grading_company: GradingCompany | ''
  grade: string
  cert_number: string
}

/** Form data for recording a sale */
export interface RecordSaleForm {
  user_card_id: string
  quantity_sold: number
  sale_price: string
  platform: string
  fees: string
  sold_at: string
  notes: string
}

// ── Search / Filter Types ────────────────────────────────────

export interface CardSearchParams {
  q?: string           // free text (name)
  set?: string         // set id
  supertype?: string
  types?: string[]
  rarity?: string
  page?: number
  pageSize?: number
}

export interface CardSearchResult {
  data: PokemonCardAPI[]
  page: number
  pageSize: number
  count: number
  totalCount: number
}

// ── Analytics Types ──────────────────────────────────────────

export interface PortfolioStats {
  total_cards: number
  total_quantity: number
  total_invested: number
  total_market_value: number
  unrealized_pl: number
  unrealized_pl_pct: number
  realized_pl: number
  realized_fees: number
}

// ── Utility ──────────────────────────────────────────────────

export const CONDITION_LABELS: Record<CardCondition, string> = {
  NM:  'Near Mint',
  LP:  'Lightly Played',
  MP:  'Moderately Played',
  HP:  'Heavily Played',
  DMG: 'Damaged',
}

export const CONDITION_COLORS: Record<CardCondition, string> = {
  NM:  'text-emerald-400',
  LP:  'text-green-400',
  MP:  'text-yellow-400',
  HP:  'text-orange-400',
  DMG: 'text-red-400',
}

export const PRINT_TYPE_LABELS: Record<PrintType, string> = {
  normal:           'Normal',
  holofoil:         'Holo',
  reverseHolofoil:  'Reverse Holo',
  firstEdition:     '1st Edition',
  shadowless:       'Shadowless',
  fullArt:          'Full Art',
  altArt:           'Alt Art',
  promo:            'Promo',
  other:            'Other',
}

export const STATUS_LABELS: Record<CardStatus, string> = {
  collection: 'In Collection',
  for_sale:   'For Sale',
  pending:    'Pending',
  traded:     'Traded',
}

export const STATUS_COLORS: Record<CardStatus, string> = {
  collection: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  for_sale:   'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  pending:    'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  traded:     'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
}

/** Extract the best market price for a given print type */
export function getMarketPrice(
  prices: TCGPlayerPrices | null | undefined,
  printType: PrintType
): number | null {
  if (!prices?.prices) return null

  const p = prices.prices
  switch (printType) {
    case 'holofoil':        return p.holofoil?.market ?? null
    case 'reverseHolofoil': return p.reverseHolofoil?.market ?? null
    case 'firstEdition':    return p['1stEditionHolofoil']?.market ?? p['1stEdition']?.market ?? null
    default:                return p.normal?.market ?? null
  }
}

/** Determine if a card is holographic based on rarity / print type */
export function isHoloCard(rarity?: string | null, printType?: PrintType): boolean {
  if (printType && ['holofoil','reverseHolofoil','firstEdition','shadowless','fullArt','altArt'].includes(printType)) {
    return true
  }
  if (!rarity) return false
  const holoRarities = ['Rare Holo', 'Rare Ultra', 'Rare Secret', 'Rare Rainbow',
    'Rare Shiny', 'Rare Shining', 'LEGEND', 'Illustration Rare',
    'Special Illustration Rare', 'Hyper Rare', 'Double Rare']
  return holoRarities.some(r => rarity.includes(r))
}

'@

New-Item -LiteralPath "supabase\migrations\001_core_schema.sql" -ItemType File -Force | Out-Null
Set-Content -LiteralPath "supabase\migrations\001_core_schema.sql" -Value @'
-- ============================================================
-- Jokemon TCG Inventory - Core Schema
-- Migration 001: Initial tables + RLS
-- ============================================================

-- ── Profiles ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id                UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  username          TEXT UNIQUE,
  display_name      TEXT,
  bio               TEXT,
  avatar_url        TEXT,
  collection_public BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles: public read"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "profiles: owner write"
  ON profiles FOR ALL USING (auth.uid() = id);

-- Auto-create a profile row on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- ── Pokemon Cards Cache ──────────────────────────────────────
-- Source of truth: pokemontcg.io. Shared across all users.
CREATE TABLE IF NOT EXISTS pokemon_cards (
  id                    TEXT PRIMARY KEY,   -- e.g. "sv3pt5-99"
  name                  TEXT NOT NULL,
  set_id                TEXT NOT NULL,
  set_name              TEXT NOT NULL,
  set_series            TEXT,
  set_logo_url          TEXT,
  set_symbol_url        TEXT,
  number                TEXT NOT NULL,
  rarity                TEXT,
  supertype             TEXT,               -- Pokémon | Trainer | Energy
  subtypes              TEXT[],
  hp                    TEXT,
  types                 TEXT[],
  evolves_from          TEXT,
  image_url             TEXT,               -- large
  image_url_small       TEXT,               -- small
  -- TCGPlayer prices keyed by print type
  -- { normal, holofoil, reverseHolofoil, firstEdition, ... }
  -- each value: { low, mid, high, market, directLow }
  tcgplayer_prices      JSONB,
  cardmarket_prices     JSONB,
  price_updated_at      TIMESTAMPTZ,
  -- Full raw API payload for future-proofing
  raw_data              JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE pokemon_cards ENABLE ROW LEVEL SECURITY;

-- Everyone can read the card cache
CREATE POLICY "pokemon_cards: public read"
  ON pokemon_cards FOR SELECT USING (true);

-- Service role writes (API caching layer only)
CREATE POLICY "pokemon_cards: service write"
  ON pokemon_cards FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS pokemon_cards_name_idx   ON pokemon_cards (name);
CREATE INDEX IF NOT EXISTS pokemon_cards_set_id_idx ON pokemon_cards (set_id);

-- ── User Cards (Inventory) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS user_cards (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  card_id          TEXT NOT NULL REFERENCES pokemon_cards(id),

  -- Acquisition
  quantity         INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  condition        TEXT NOT NULL DEFAULT 'NM'
    CHECK (condition IN ('NM','LP','MP','HP','DMG')),
  print_type       TEXT NOT NULL DEFAULT 'normal'
    CHECK (print_type IN (
      'normal','holofoil','reverseHolofoil','firstEdition',
      'shadowless','fullArt','altArt','promo','other'
    )),
  cost_basis       NUMERIC(10,2),   -- per-card avg cost
  acquired_at      DATE,
  acquisition_notes TEXT,
  storage_location  TEXT,           -- "Binder A", "Box 3", etc.

  -- Status
  status           TEXT NOT NULL DEFAULT 'collection'
    CHECK (status IN ('collection','for_sale','pending','traded')),
  is_public        BOOLEAN NOT NULL DEFAULT false,
  asking_price     NUMERIC(10,2),

  -- Grading (Phase 3 prep)
  is_graded        BOOLEAN NOT NULL DEFAULT false,
  grading_company  TEXT,            -- PSA | BGS | CGC
  grade            TEXT,
  cert_number      TEXT,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_cards: owner full access"
  ON user_cards FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "user_cards: public read when public"
  ON user_cards FOR SELECT
  USING (
    is_public = true
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = user_cards.user_id
        AND profiles.collection_public = true
    )
  );

CREATE INDEX IF NOT EXISTS user_cards_user_id_idx ON user_cards (user_id);
CREATE INDEX IF NOT EXISTS user_cards_card_id_idx ON user_cards (card_id);
CREATE INDEX IF NOT EXISTS user_cards_status_idx  ON user_cards (status);

-- ── Sales Log ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  user_card_id     UUID REFERENCES user_cards(id) ON DELETE SET NULL,
  card_id          TEXT REFERENCES pokemon_cards(id),

  -- Snapshot at time of sale (card may be deleted later)
  card_snapshot    JSONB NOT NULL,  -- { name, setName, number, imageUrl, printType, condition }

  quantity_sold    INTEGER NOT NULL DEFAULT 1 CHECK (quantity_sold > 0),
  cost_basis       NUMERIC(10,2),   -- per-card basis at time of sale
  sale_price       NUMERIC(10,2) NOT NULL CHECK (sale_price >= 0), -- total sale amount
  platform         TEXT,            -- eBay | TCGPlayer | Local | Other
  fees             NUMERIC(10,2) NOT NULL DEFAULT 0,
  -- Computed: sale_price - fees - (cost_basis * quantity_sold)
  net_profit       NUMERIC(10,2) GENERATED ALWAYS AS (
    sale_price - fees - (COALESCE(cost_basis, 0) * quantity_sold)
  ) STORED,
  margin_pct       NUMERIC(6,2),    -- set at insert via trigger

  sold_at          DATE NOT NULL DEFAULT CURRENT_DATE,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE sales_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sales_log: owner full access"
  ON sales_log FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS sales_log_user_id_idx ON sales_log (user_id);
CREATE INDEX IF NOT EXISTS sales_log_sold_at_idx ON sales_log (sold_at DESC);

-- ── Wishlist ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wishlist (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  card_id    TEXT NOT NULL REFERENCES pokemon_cards(id),
  print_type TEXT NOT NULL DEFAULT 'any',
  max_price  NUMERIC(10,2),
  priority   INTEGER NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 3),
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, card_id, print_type)
);

ALTER TABLE wishlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wishlist: owner full access"
  ON wishlist FOR ALL USING (auth.uid() = user_id);

-- ── Triggers: updated_at ─────────────────────────────────────
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE PROCEDURE touch_updated_at();

CREATE TRIGGER user_cards_updated_at
  BEFORE UPDATE ON user_cards
  FOR EACH ROW EXECUTE PROCEDURE touch_updated_at();

-- ── Trigger: margin_pct on sales_log ────────────────────────
CREATE OR REPLACE FUNCTION calc_margin_pct()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  total_cost NUMERIC;
BEGIN
  total_cost := COALESCE(NEW.cost_basis, 0) * NEW.quantity_sold;
  IF total_cost > 0 THEN
    NEW.margin_pct := ROUND(((NEW.sale_price - NEW.fees - total_cost) / total_cost) * 100, 2);
  ELSE
    NEW.margin_pct := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sales_log_margin
  BEFORE INSERT OR UPDATE ON sales_log
  FOR EACH ROW EXECUTE PROCEDURE calc_margin_pct();

'@