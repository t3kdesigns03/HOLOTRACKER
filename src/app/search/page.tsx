'use client'
// src/app/search/page.tsx

import { useState, useCallback } from 'react'
import { CardSearchPanel } from '@/components/search/CardSearchPanel'
import { AddToInventoryModal } from '@/components/inventory/AddToInventoryModal'
import { HoloCard } from '@/components/card/HoloCard'
import type { PokemonCardAPI } from '@/types'
import { toast } from 'sonner'

export default function SearchPage() {
  const [selectedCard,  setSelectedCard]  = useState<PokemonCardAPI | null>(null)
  const [recentlyAdded, setRecentlyAdded] = useState<PokemonCardAPI[]>([])

  const handleSelectCard = useCallback((card: PokemonCardAPI) => {
    setSelectedCard(card)
  }, [])

  const handleSuccess = useCallback(() => {
    if (selectedCard) {
      setRecentlyAdded(prev => [selectedCard, ...prev.slice(0, 7)])
    }
    setSelectedCard(null)
    toast.success('Card added to inventory!')
  }, [selectedCard])

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Add Cards</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Search 20,000+ Pokémon cards and add them to your inventory
          </p>
        </div>

        {/* Recently added — horizontal strip */}
        {recentlyAdded.length > 0 && (
          <div className="mb-6">
            <div className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">
              Recently Added
            </div>
            <div className="flex gap-4 flex-wrap">
              {recentlyAdded.map((card, i) => (
                <div key={`${card.id}-${i}`} className="flex flex-col items-center gap-1">
                  <HoloCard
                    imageUrl={card.images.large}
                    imageUrlSmall={card.images.small}
                    name={card.name}
                    rarity={card.rarity}
                    width={80}
                    compact
                  />
                  <span className="text-[10px] text-zinc-600 text-center truncate max-w-[80px]">
                    {card.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Full-width search panel */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5">
          <CardSearchPanel onSelectCard={handleSelectCard} />
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
