import { NextRequest, NextResponse } from 'next/server'
import { getCard } from '@/lib/pokemon-tcg'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const card = await getCard(id)
    if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 })
    return NextResponse.json(card)
  } catch (err) {
    console.error('Card fetch error:', err)
    return NextResponse.json({ error: 'Failed to fetch card' }, { status: 500 })
  }
}
