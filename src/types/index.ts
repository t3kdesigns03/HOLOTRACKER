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
  justtcg_card_id: string | null
  justtcg_variants: JustTCGVariant[] | null
  justtcg_updated_at: string | null
  raw_data: PokemonCardAPI | null
  created_at: string
}

// ── JustTCG Types ────────────────────────────────────────────

export interface JustTCGVariant {
  id: string
  uuid?: string
  condition: string        // "Near Mint" | "Lightly Played" | …
  printing: string         // "Normal" | "Holofoil" | "Reverse Holofoil" | …
  price: number
  priceChange24hr?: number
  lastUpdated?: number     // unix seconds
}

export interface JustTCGCard {
  id: string
  uuid?: string
  name: string
  game: string
  set: string
  set_name: string
  rarity?: string | null
  tcgplayerId?: string | null
  variants: JustTCGVariant[]
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
  tags: string[]
  created_at: string
  updated_at: string
}

export interface CaseRow {
  id: string
  user_id: string
  short_code: string
  user_card_id: string | null
  location: string | null
  notes: string | null
  is_public: boolean
  show_value: boolean
  show_grade: boolean
  show_notes: boolean
  show_tags: boolean
  created_at: string
  updated_at: string
}

/** CaseRow joined with its assigned inventory item (+ cached card) */
export interface CaseWithCard extends CaseRow {
  user_card: (UserCardRow & { card: PokemonCardRow }) | null
}

/** Shape returned by the get_public_case() RPC */
export interface PublicCaseData {
  short_code: string
  is_owner: boolean
  case_notes: string | null
  created_at: string
  card?: {
    id: string
    name: string
    set_name: string
    set_series: string | null
    set_symbol_url: string | null
    number: string
    rarity: string | null
    image_url: string | null
    image_url_small: string | null
  }
  print_type?: PrintType
  condition?: CardCondition
  tags?: string[] | null
  grading?: {
    company: GradingCompany | null
    grade: string | null
    cert_number: string | null
  } | null
  prices?: TCGPlayerPrices | null
  price_updated_at?: string | null
  // Owner-only fields
  id?: string
  user_card_id?: string | null
  location?: string | null
  is_public?: boolean
  show_value?: boolean
  show_grade?: boolean
  show_notes?: boolean
  show_tags?: boolean
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

// ── eBay Types ───────────────────────────────────────────────

export interface EbayListing {
  itemId: string
  title: string
  price: number
  currency: string
  condition: string
  imageUrl: string
  itemUrl: string
  sellerLocation: string
  endTime: string
  source: 'ebay'
}

export interface EbaySoldListing {
  itemId: string
  title: string
  soldPrice: number
  currency: string
  soldDate: string
  condition: string
  imageUrl: string
  itemUrl: string
  sellerLocation: string
  source: 'ebay'
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

/** Our condition codes → JustTCG condition labels */
export const JUSTTCG_CONDITION_NAMES: Record<CardCondition, string> = {
  NM:  'Near Mint',
  LP:  'Lightly Played',
  MP:  'Moderately Played',
  HP:  'Heavily Played',
  DMG: 'Damaged',
}

/** Our print_type → acceptable JustTCG printing labels, in preference order */
export const JUSTTCG_PRINTING_CANDIDATES: Record<PrintType, string[]> = {
  normal:          ['Normal', 'Unlimited'],
  holofoil:        ['Holofoil', 'Foil', 'Unlimited Holofoil'],
  reverseHolofoil: ['Reverse Holofoil'],
  firstEdition:    ['1st Edition Holofoil', '1st Edition'],
  shadowless:      ['Shadowless', 'Normal'],
  fullArt:         ['Holofoil', 'Normal'],
  altArt:          ['Holofoil', 'Normal'],
  promo:           ['Normal', 'Holofoil'],
  other:           [],
}

/**
 * Pick the condition-aware price from cached JustTCG variants.
 * Returns null when nothing matches — callers should fall back to
 * getMarketPrice() (the TCGplayer market snapshot, NM-agnostic).
 */
export function getJustTCGPrice(
  variants: JustTCGVariant[] | null | undefined,
  printType: PrintType,
  condition: CardCondition
): { price: number; change24h: number | null; printing: string } | null {
  if (!variants?.length) return null
  const wantCondition = JUSTTCG_CONDITION_NAMES[condition]
  const candidates = JUSTTCG_PRINTING_CANDIDATES[printType] ?? []

  const pool = variants.filter(v => v.condition === wantCondition && v.price != null)
  if (!pool.length) return null

  for (const printing of candidates) {
    const hit = pool.find(v => v.printing === printing)
    if (hit) return { price: hit.price, change24h: hit.priceChange24hr ?? null, printing: hit.printing }
  }
  // Unknown printing mapping — only safe if there's exactly one option
  return pool.length === 1
    ? { price: pool[0].price, change24h: pool[0].priceChange24hr ?? null, printing: pool[0].printing }
    : null
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

/** Get available print types from TCGPlayer prices */
export function getAvailablePrintTypes(prices?: TCGPlayerPrices | null): PrintType[] {
  if (!prices?.prices) return ['normal']
  return Object.keys(prices.prices).filter(
    k => PRINT_TYPE_LABELS[k as PrintType] !== undefined
  ) as PrintType[]
}