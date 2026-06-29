'use client'
// src/components/search/CardSearchResult.tsx
import { HoloCard } from '@/components/card/HoloCard'
import { PRINT_TYPE_LABELS, type PokemonCardAPI, type PrintType } from '@/types'
import { getAvailablePrintTypes } from '@/lib/pokemon-tcg'

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
  // Find the best available market price across all print types
  const allPriceSlots = Object.values(
    (card.tcgplayer?.prices ?? {}) as Record<string, { market?: number | null }>
  )
  const marketPrice = allPriceSlots.find(p => p?.market != null)?.market ?? null

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
          compact
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
