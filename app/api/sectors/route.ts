/**
 * app/api/sectors/route.ts
 * Returns all sectors that have at least one active company.
 */
import { NextResponse } from 'next/server'
import { getAllSectors } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const sectors = await getAllSectors()
    return NextResponse.json({ sectors }, { status: 200 })
  } catch (err) {
    console.error('[/api/sectors]', err)
    return NextResponse.json({ error: 'Failed to load sectors' }, { status: 500 })
  }
}