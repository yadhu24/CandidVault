'use client'

import { Button } from '@/components/ui/Button'

// Guest-facing boundary for the public upload page. Friendly and non-technical —
// guests should never see a raw error.
export default function PublicError({ reset }: { reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-5 py-8 text-center">
      <div className="w-full max-w-md space-y-4">
        <h1 className="font-display text-h2 text-foreground">Something went wrong</h1>
        <p className="text-body-sm text-muted-foreground">
          We couldn’t load this page right now. Please try again in a moment.
        </p>
        <Button onClick={() => reset()}>Try again</Button>
      </div>
    </main>
  )
}
