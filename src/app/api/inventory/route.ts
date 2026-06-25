import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { AddCardForm } from '@/types'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const status = searchParams.get('status')

  let query = supabase
    .from('user_cards')
    .select('*, card:pokemon_cards(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
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
