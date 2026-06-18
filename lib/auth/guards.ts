import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from './server'

export async function requireAuth(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return null

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null
  return user
}
