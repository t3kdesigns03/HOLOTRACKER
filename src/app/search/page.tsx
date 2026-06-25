'use client'
// src/app/search/page.tsx  (or integrated into /inventory as a drawer)
// Full search-and-add page for adding cards to inventory

import { useState, useCallback } from 'react'
import { CardSearchPanel } from '@/components/search/CardSearchPanel'
import { AddToInventoryModal } from '@/components/inventory/AddToInventoryModal'
import { HoloCard } from '@/components/card/HoloCard'
import type { PokemonCardAPI } from '@/types'
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
