'use client'
// ============================================================
// CardAnalyticsPanel — 3D card + TCGPlayer + eBay + Regional
// src/components/card/CardAnalyticsPanel.tsx
// ============================================================

import { useState, useEffect } from 'react'
import { X, ExternalLink, MapPin, TrendingUp, TrendingDown, Minus, Globe } from 'lucide-react'
import { HoloCard } from '@/components/card/HoloCard'
import type { EbayListing, EbaySoldListing, PrintType, TCGPlayerPrices, CardmarketPrices } from '@/types'

// ── US state normalization ─────────────────────────────────────
const US_STATES: Record<string, string> = {
  AL:'Alabama',    AK:'Alaska',        AZ:'Arizona',       AR:'Arkansas',
  CA:'California', CO:'Colorado',      CT:'Connecticut',   DE:'Delaware',
  FL:'Florida',    GA:'Georgia',       HI:'Hawaii',        ID:'Idaho',
  IL:'Illinois',   IN:'Indiana',       IA:'Iowa',          KS:'Kansas',
  KY:'Kentucky',   LA:'Louisiana',     ME:'Maine',         MD:'Maryland',
  MA:'Massachusetts', MI:'Michigan',   MN:'Minnesota',     MS:'Mississippi',
  MO:'Missouri',   MT:'Montana',       NE:'Nebraska',      NV:'Nevada',
  NH:'New Hampshire', NJ:'New Jersey', NM:'New Mexico',    NY:'New York',
  NC:'North Carolina', ND:'North Dakota', OH:'Ohio',       OK:'Oklahoma',
  OR:'Oregon',     PA:'Pennsylvania',  RI:'Rhode Island',  SC:'South Carolina',
  SD:'South Dakota', TN:'Tennessee',   TX:'Texas',         UT:'Utah',
  VT:'Vermont',    VA:'Virginia',      WA:'Washington',    WV:'West Virginia',
  WI:'Wisconsin',  WY:'Wyoming',       DC:'D.C.',
}
const STATE_NAMES = Object.values(US_STATES)

function parseState(raw: string): string | null {
  if (!raw) return null
  const up = raw.toUpperCase()
  const lo = raw.toLowerCase()
  // 2-letter abbreviation (word boundary — works for "TX, US", "Houston, TX", "TX")
  for (const [abbr, name] of Object.entries(US_STATES)) {
    if (new RegExp(`(^|[^A-Z])${abbr}([^A-Z]|$)`).test(up)) return name
  }
  // Full state name
  for (const name of STATE_NAMES) {
    if (lo.includes(name.toLowerCase())) return name
  }
  return null
}

// ── Sparkline ──────────────────────────────────────────────────
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const w = 120; const h = 36; const pad = 4
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2)
    const y = h - pad - ((v - min) / range) * (h - pad * 2)
    return `${x},${y}`
  }).join(' ')
  const trend = values[values.length - 1] - values[0]
  const color = trend > 0 ? '#34d399' : trend < 0 ? '#f87171' : '#71717a'
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Source badge ────────────────────────────────────────────────
function SourceBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded
      bg-zinc-800 border border-zinc-700 text-[9px] text-zinc-500 font-medium">
      {label}
    </span>
  )
}

// ── Props ───────────────────────────────────────────────────────
interface Props {
  cardName: string
  imageUrl: string | null
  imageUrlSmall?: string | null
  rarity?: string | null
  printType?: PrintType
  setName?: string
  cardNumber?: string
  tcgplayer?: TCGPlayerPrices | null
  cardmarket?: CardmarketPrices | null
  onClose: () => void
}

type TabId = 'overview' | 'regional' | 'ebay-buy' | 'ebay-sold'

// ── Component ───────────────────────────────────────────────────
export function CardAnalyticsPanel({
  cardName, imageUrl, imageUrlSmall, rarity, printType,
  setName, cardNumber, tcgplayer, cardmarket, onClose,
}: Props) {
  const [listings,  setListings]  = useState<EbayListing[]>([])
  const [sold,      setSold]      = useState<EbaySoldListing[]>([])
  const [loadingL,  setLoadingL]  = useState(true)
  const [loadingS,  setLoadingS]  = useState(true)
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  useEffect(() => {
    setListings([]); setSold([])
    setLoadingL(true); setLoadingS(true)
    const q = encodeURIComponent(cardName)
    fetch(`/api/ebay/listings?q=${q}`)
      .then(r => r.json()).then(setListings).catch(() => {}).finally(() => setLoadingL(false))
    fetch(`/api/ebay/sold?q=${q}`)
      .then(r => r.json()).then(setSold).catch(() => {}).finally(() => setLoadingS(false))
  }, [cardName])

  // ── Price calcs ─────────────────────────────────────────────
  const tcgPrices = tcgplayer?.prices ?? {}
  const getSlot = (key: keyof typeof tcgPrices) => tcgPrices[key]
  const tcgSlot = (() => {
    if (printType === 'holofoil')        return getSlot('holofoil')
    if (printType === 'reverseHolofoil') return getSlot('reverseHolofoil')
    if (printType === 'firstEdition')    return getSlot('1stEditionHolofoil') ?? getSlot('firstEdition')
    return getSlot('normal') ?? getSlot('holofoil') ?? Object.values(tcgPrices)[0]
  })()

  const tcgMarket     = tcgSlot?.market  ?? null
  const tcgLow        = tcgSlot?.low     ?? null
  const tcgMid        = tcgSlot?.mid     ?? null
  const tcgHigh       = tcgSlot?.high    ?? null
  const cmAvg         = cardmarket?.prices?.averageSellPrice ?? null
  const cmTrend       = cardmarket?.prices?.trendPrice       ?? null
  const ebayAvgSold   = sold.length > 0 ? sold.reduce((s, x) => s + x.soldPrice, 0) / sold.length : null
  const ebayLowestBuy = listings.length > 0 ? Math.min(...listings.map(l => l.price)) : null
  const soldPrices    = [...sold].reverse().map(s => s.soldPrice)
  const priceDelta    = ebayAvgSold != null && tcgMarket != null
    ? ((ebayAvgSold - tcgMarket) / tcgMarket) * 100 : null

  // ── Regional calcs ──────────────────────────────────────────
  const stateMap: Record<string, { count: number; total: number }> = {}
  sold.forEach(s => {
    const state = parseState(s.sellerLocation)
    if (!state) return
    if (!stateMap[state]) stateMap[state] = { count: 0, total: 0 }
    stateMap[state].count++
    stateMap[state].total += s.soldPrice
  })
  const topStates = Object.entries(stateMap)
    .map(([state, d]) => ({ state, count: d.count, avg: d.total / d.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 7)

  const maxStateCount = topStates[0]?.count ?? 1

  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview',  label: 'Overview' },
    { id: 'regional',  label: `Regional${topStates.length > 0 ? ` (${topStates.length})` : ''}` },
    { id: 'ebay-buy',  label: `For Sale (${listings.length})` },
    { id: 'ebay-sold', label: `Sold (${sold.length})` },
  ]

  const whatnotUrl = `https://www.whatnot.com/search?query=${encodeURIComponent(cardName + ' pokemon')}`
  const priceChartingUrl = `https://www.pricecharting.com/search-products?q=${encodeURIComponent(cardName)}&type=prices`
  const point130Url = `https://130point.com/sales/?query=${encodeURIComponent(cardName + ' pokemon card')}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col
        bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">

        {/* ── Header ─────────────────────────────────────── */}
        <div className="flex items-start gap-5 p-5 border-b border-zinc-800 shrink-0">
          <div className="shrink-0 mt-1">
            <HoloCard
              imageUrl={imageUrl} imageUrlSmall={imageUrlSmall}
              name={cardName} rarity={rarity} printType={printType} width={130}
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-white leading-tight">{cardName}</h2>
                {setName && (
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {setName}{cardNumber ? ` · #${cardNumber}` : ''}
                  </p>
                )}
                {rarity && <p className="text-xs text-zinc-600 mt-0.5">{rarity}</p>}
              </div>
              <button onClick={onClose} className="text-zinc-600 hover:text-zinc-400 p-1 shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-wrap gap-3 mt-4">
              {tcgMarket != null && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2">
                  <div className="text-[9px] text-zinc-600 uppercase tracking-wide">TCGPlayer</div>
                  <div className="text-base font-bold font-mono text-emerald-400 mt-0.5">${tcgMarket.toFixed(2)}</div>
                </div>
              )}
              {ebayAvgSold != null && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2">
                  <div className="text-[9px] text-zinc-600 uppercase tracking-wide">eBay Avg Sold</div>
                  <div className="text-base font-bold font-mono text-blue-400 mt-0.5">${ebayAvgSold.toFixed(2)}</div>
                </div>
              )}
              {ebayLowestBuy != null && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2">
                  <div className="text-[9px] text-zinc-600 uppercase tracking-wide">eBay Lowest</div>
                  <div className="text-base font-bold font-mono text-yellow-400 mt-0.5">${ebayLowestBuy.toFixed(2)}</div>
                </div>
              )}
              {priceDelta != null && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2">
                  <div className="text-[9px] text-zinc-600 uppercase tracking-wide">eBay vs TCG</div>
                  <div className={`flex items-center gap-1 text-base font-bold font-mono mt-0.5
                    ${priceDelta > 2 ? 'text-emerald-400' : priceDelta < -2 ? 'text-red-400' : 'text-zinc-400'}`}>
                    {priceDelta > 2 ? <TrendingUp className="w-3.5 h-3.5" />
                      : priceDelta < -2 ? <TrendingDown className="w-3.5 h-3.5" />
                      : <Minus className="w-3.5 h-3.5" />}
                    {priceDelta > 0 ? '+' : ''}{priceDelta.toFixed(1)}%
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Tabs ───────────────────────────────────────── */}
        <div className="flex border-b border-zinc-800 shrink-0 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2.5 text-xs font-medium whitespace-nowrap px-2 transition-colors
                ${activeTab === tab.id
                  ? 'text-white border-b-2 border-purple-500'
                  : 'text-zinc-500 hover:text-zinc-300'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab content ────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* ── OVERVIEW ─────────────────────────────────── */}
          {activeTab === 'overview' && (
            <>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-[10px] text-zinc-500 uppercase tracking-wide font-medium">
                    Price Breakdown
                  </h3>
                  <SourceBadge label="pokemontcg.io + eBay" />
                </div>
                <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
                  {[
                    { label: 'TCGPlayer Market', value: tcgMarket,     color: 'text-emerald-400', bold: true  },
                    { label: 'TCGPlayer Low',    value: tcgLow,        color: 'text-zinc-300'                 },
                    { label: 'TCGPlayer Mid',    value: tcgMid,        color: 'text-zinc-300'                 },
                    { label: 'TCGPlayer High',   value: tcgHigh,       color: 'text-zinc-300'                 },
                    { label: 'Cardmarket Avg',   value: cmAvg,         color: 'text-zinc-400', prefix: '€'   },
                    { label: 'Cardmarket Trend', value: cmTrend,       color: 'text-zinc-400', prefix: '€'   },
                    { label: 'eBay Avg Sold',    value: ebayAvgSold,   color: 'text-blue-400', bold: true     },
                    { label: 'eBay Lowest Buy',  value: ebayLowestBuy, color: 'text-yellow-400'               },
                  ].filter(r => r.value != null).map((row, i, arr) => (
                    <div key={row.label}
                      className={`flex justify-between items-center px-4 py-2.5
                        ${i < arr.length - 1 ? 'border-b border-zinc-800/60' : ''}`}>
                      <span className="text-xs text-zinc-500">{row.label}</span>
                      <span className={`text-sm font-mono ${row.bold ? 'font-bold' : 'font-medium'} ${row.color}`}>
                        {row.prefix ?? '$'}{row.value!.toFixed(2)}
                      </span>
                    </div>
                  ))}
                  {tcgMarket == null && ebayAvgSold == null && (
                    <div className="px-4 py-6 text-center text-xs text-zinc-600">
                      No price data available
                    </div>
                  )}
                </div>
              </div>

              {soldPrices.length >= 2 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-[10px] text-zinc-500 uppercase tracking-wide font-medium">
                      Recent eBay Sale Prices
                    </h3>
                    <SourceBadge label="eBay Finding API" />
                  </div>
                  <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
                    <div className="flex items-end justify-between gap-4">
                      <Sparkline values={soldPrices} />
                      <div className="text-right">
                        <div className="text-[10px] text-zinc-600">
                          {sold.length} recent {sold.length === 1 ? 'sale' : 'sales'}
                        </div>
                        <div className="text-xs text-zinc-500 mt-0.5">
                          ${Math.min(...soldPrices).toFixed(2)} – ${Math.max(...soldPrices).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Regional teaser */}
              {topStates.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[10px] text-zinc-500 uppercase tracking-wide font-medium">
                        Top Seller States
                      </h3>
                      <SourceBadge label="eBay Sold" />
                    </div>
                    <button
                      onClick={() => setActiveTab('regional')}
                      className="text-[10px] text-purple-400 hover:text-purple-300"
                    >
                      Full breakdown →
                    </button>
                  </div>
                  <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
                    {topStates.slice(0, 3).map(({ state, count, avg }, i, arr) => (
                      <div key={state}
                        className={`flex items-center gap-3 px-4 py-2.5
                          ${i < arr.length - 1 ? 'border-b border-zinc-800/60' : ''}`}>
                        <MapPin className="w-3 h-3 text-zinc-600 shrink-0" />
                        <span className="text-xs text-zinc-400 flex-1">{state}</span>
                        <span className="text-[10px] text-zinc-600 w-12 text-right">{count} sold</span>
                        <span className="text-xs font-mono text-blue-400 w-14 text-right">${avg.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── REGIONAL ─────────────────────────────────── */}
          {activeTab === 'regional' && (
            <>
              {/* eBay seller state breakdown */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-[10px] text-zinc-500 uppercase tracking-wide font-medium">
                    Seller Activity by State
                  </h3>
                  <SourceBadge label="eBay Sold · Finding API" />
                </div>

                {loadingS ? (
                  <div className="space-y-1.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="h-10 bg-zinc-900 rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : topStates.length === 0 ? (
                  <div className="bg-zinc-900 rounded-xl border border-zinc-800 px-4 py-8 text-center">
                    <div className="text-2xl mb-2">📍</div>
                    <div className="text-xs text-zinc-500">
                      No regional data yet — eBay API keys needed
                    </div>
                    <div className="text-[10px] text-zinc-700 mt-1">
                      Add EBAY_CLIENT_ID to .env.local to enable
                    </div>
                  </div>
                ) : (
                  <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
                    {/* Header row */}
                    <div className="flex items-center gap-3 px-4 py-2 border-b border-zinc-800 bg-zinc-900/80">
                      <span className="text-[9px] text-zinc-700 uppercase flex-1">State</span>
                      <span className="text-[9px] text-zinc-700 uppercase w-16 text-right">Sales</span>
                      <span className="text-[9px] text-zinc-700 uppercase w-16 text-right">Avg Price</span>
                      <span className="text-[9px] text-zinc-700 uppercase w-16 text-right">vs Avg</span>
                    </div>
                    {topStates.map(({ state, count, avg }, i, arr) => {
                      const delta = ebayAvgSold != null ? avg - ebayAvgSold : null
                      const barWidth = Math.round((count / maxStateCount) * 64)
                      return (
                        <div key={state}
                          className={`flex items-center gap-3 px-4 py-3
                            ${i < arr.length - 1 ? 'border-b border-zinc-800/60' : ''}`}>
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <MapPin className="w-3 h-3 text-zinc-600 shrink-0" />
                            <span className="text-xs text-zinc-300 truncate">{state}</span>
                          </div>
                          {/* Activity bar + count */}
                          <div className="flex items-center gap-1.5 w-16 justify-end">
                            <div className="h-1 bg-purple-500/50 rounded-full"
                              style={{ width: `${barWidth}px` }} />
                            <span className="text-[10px] font-mono text-zinc-500">{count}</span>
                          </div>
                          <span className="text-xs font-mono text-blue-400 w-16 text-right">
                            ${avg.toFixed(2)}
                          </span>
                          <span className={`text-[10px] font-mono w-16 text-right
                            ${delta == null ? 'text-zinc-700'
                              : delta > 1 ? 'text-emerald-500'
                              : delta < -1 ? 'text-red-400'
                              : 'text-zinc-500'}`}>
                            {delta != null
                              ? `${delta >= 0 ? '+' : ''}$${delta.toFixed(2)}`
                              : '—'}
                          </span>
                        </div>
                      )
                    })}
                    <div className="px-4 py-2 border-t border-zinc-800/60 bg-zinc-900/40">
                      <p className="text-[9px] text-zinc-700">
                        Seller origin from eBay completed listings · {sold.length} total sales sampled
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Whatnot */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-[10px] text-zinc-500 uppercase tracking-wide font-medium">
                    Whatnot
                  </h3>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded
                    bg-purple-900/30 border border-purple-800/40 text-[9px] text-purple-400 font-medium">
                    No public API
                  </span>
                </div>
                <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
                  <p className="text-xs text-zinc-500 mb-3">
                    Whatnot hosts live Pokemon card auctions and is a major price signal — especially
                    for hype cards at shows. No developer API is available yet, but you can search
                    directly.
                  </p>
                  <a
                    href={whatnotUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 w-full justify-center py-2.5 rounded-lg
                      bg-purple-600/20 hover:bg-purple-600/30 border border-purple-600/40
                      text-sm font-medium text-purple-300 hover:text-purple-200 transition-colors"
                  >
                    <Globe className="w-4 h-4" />
                    Search &ldquo;{cardName}&rdquo; on Whatnot
                    <ExternalLink className="w-3 h-3 opacity-60" />
                  </a>
                </div>
              </div>

              {/* Other price reference sources */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-[10px] text-zinc-500 uppercase tracking-wide font-medium">
                    Additional Reference Sources
                  </h3>
                  <SourceBadge label="External" />
                </div>
                <div className="space-y-2">
                  {[
                    {
                      name: 'PriceCharting',
                      desc: 'Historical sold price charts for graded + raw cards',
                      url: priceChartingUrl,
                      badge: 'Free',
                    },
                    {
                      name: '130point',
                      desc: 'eBay completed sales tracker with deeper history',
                      url: point130Url,
                      badge: 'eBay data',
                    },
                  ].map(src => (
                    <a
                      key={src.name}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-900
                        border border-zinc-800 hover:border-zinc-600 transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-zinc-300">{src.name}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-600 border border-zinc-700">
                            {src.badge}
                          </span>
                        </div>
                        <div className="text-[10px] text-zinc-600 mt-0.5">{src.desc}</div>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-zinc-700 group-hover:text-zinc-400 shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── EBAY FOR SALE ───────────────────────────── */}
          {activeTab === 'ebay-buy' && (
            <div className="space-y-2">
              {loadingL ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-14 bg-zinc-900 rounded-xl animate-pulse" />
                ))
              ) : listings.length === 0 ? (
                <div className="text-center py-10 text-zinc-600">
                  <div className="text-2xl mb-2">🏷️</div>
                  <div className="text-sm">No active eBay listings found</div>
                  <div className="text-xs mt-1 text-zinc-700">Add EBAY_CLIENT_ID to .env.local to enable</div>
                </div>
              ) : (
                listings.map(listing => (
                  <a key={listing.itemId} href={listing.itemUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900
                      border border-zinc-800 hover:border-zinc-600 transition-colors group">
                    {listing.imageUrl && (
                      <img src={listing.imageUrl} alt="" className="w-10 h-14 object-contain rounded shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-zinc-300 line-clamp-2 leading-relaxed">{listing.title}</div>
                      <div className="flex items-center gap-3 mt-1">
                        {listing.sellerLocation && (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-2.5 h-2.5 text-zinc-600" />
                            <span className="text-[10px] text-zinc-600">
                              {parseState(listing.sellerLocation) ?? listing.sellerLocation}
                            </span>
                          </div>
                        )}
                        <span className="text-[10px] text-zinc-700">{listing.condition}</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-bold font-mono text-yellow-400">${listing.price.toFixed(2)}</div>
                      <ExternalLink className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 mt-1 ml-auto" />
                    </div>
                  </a>
                ))
              )}
            </div>
          )}

          {/* ── EBAY SOLD ───────────────────────────────── */}
          {activeTab === 'ebay-sold' && (
            <div className="space-y-2">
              {loadingS ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-14 bg-zinc-900 rounded-xl animate-pulse" />
                ))
              ) : sold.length === 0 ? (
                <div className="text-center py-10 text-zinc-600">
                  <div className="text-2xl mb-2">💰</div>
                  <div className="text-sm">No recent eBay sales found</div>
                  <div className="text-xs mt-1 text-zinc-700">Add EBAY_CLIENT_ID to .env.local to enable</div>
                </div>
              ) : (
                sold.map(sale => (
                  <a key={sale.itemId} href={sale.itemUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900
                      border border-zinc-800 hover:border-zinc-600 transition-colors group">
                    {sale.imageUrl && (
                      <img src={sale.imageUrl} alt="" className="w-10 h-14 object-contain rounded shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-zinc-300 line-clamp-2 leading-relaxed">{sale.title}</div>
                      <div className="flex items-center gap-3 mt-1">
                        {sale.sellerLocation && (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-2.5 h-2.5 text-zinc-600" />
                            <span className="text-[10px] text-zinc-600">
                              {parseState(sale.sellerLocation) ?? sale.sellerLocation}
                            </span>
                          </div>
                        )}
                        <span className="text-[10px] text-zinc-700">{sale.condition}</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-bold font-mono text-blue-400">${sale.soldPrice.toFixed(2)}</div>
                      <div className="text-[10px] text-zinc-600 mt-0.5">
                        {new Date(sale.soldDate).toLocaleDateString()}
                      </div>
                      <ExternalLink className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 mt-0.5 ml-auto" />
                    </div>
                  </a>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
