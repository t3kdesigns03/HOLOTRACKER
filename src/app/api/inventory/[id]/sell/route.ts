import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { RecordSaleForm, CardSnapshot } from '@/types'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: userCard, error: fetchErr } = await supabase
    .from('user_cards')
    .select('*, card:pokemon_cards(*)')
    .eq('id', id)
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
    name: card.name, set_name: card.set_name, number: card.number,
    image_url: card.image_url, print_type: userCard.print_type, condition: userCard.condition,
  }

  const { data: sale, error: saleErr } = await supabase
    .from('sales_log')
    .insert({
      user_id: user.id, user_card_id: id, card_id: userCard.card_id,
      card_snapshot: snapshot, quantity_sold: qtySold, cost_basis: userCard.cost_basis,
      sale_price: parseFloat(body.sale_price), platform: body.platform || null,
      fees: parseFloat(body.fees || '0'),
      sold_at: body.sold_at || new Date().toISOString().split('T')[0],
      notes: body.notes || null,
    })
    .select().single()

  if (saleErr) return NextResponse.json({ error: saleErr.message }, { status: 500 })

  const newQty = userCard.quantity - qtySold
  await supabase.from('user_cards').update({
    quantity: newQty, status: newQty === 0 ? 'traded' : userCard.status,
  }).eq('id', id)

  return NextResponse.json({ sale, new_quantity: newQty }, { status: 201 })
}
