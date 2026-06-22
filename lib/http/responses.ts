import { NextResponse } from 'next/server'

// Consistent error envelope (CLAUDE.md §5). Never leak internals in `message`.
export function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status })
}

export function apiJson<T>(data: T, status = 200) {
  return NextResponse.json(data, { status })
}
