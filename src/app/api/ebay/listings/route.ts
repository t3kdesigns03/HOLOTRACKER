import { NextRequest, NextResponse } from 'next/server'
import { searchEbayListings } from '@/lib/ebay'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q) return NextResponse.json([])

  const listings = await searchEbayListings(q, 10)
  return NextResponse.json(listings, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  })
}
