import { NextRequest, NextResponse } from 'next/server'
import { searchEbaySold } from '@/lib/ebay'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q) return NextResponse.json([])

  const sold = await searchEbaySold(q, 12)
  return NextResponse.json(sold, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  })
}
