import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const CASE_SELECT = '*, user_card:user_cards(*, card:pokemon_cards(*))'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const allowed = [
    'user_card_id', // pass null to unassign
    'location', 'notes',
    'is_public', 'show_value', 'show_grade', 'show_notes', 'show_tags',
  ]
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  // If assigning, verify the inventory item belongs to this user
  // (the FK alone wouldn't stop linking someone else's row).
  if (update.user_card_id) {
    const { data: owned } = await supabase
      .from('user_cards')
      .select('id')
      .eq('id', update.user_card_id as string)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!owned) {
      return NextResponse.json({ error: 'Inventory item not found' }, { status: 404 })
    }
  }

  const { data, error } = await supabase
    .from('cases')
    .update(update)
    .eq('id', id)
    .eq('user_id', user.id)
    .select(CASE_SELECT)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { error } = await supabase
    .from('cases')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
