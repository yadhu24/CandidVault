'use client'

import { Button } from '@/components/ui/Button'

// Error boundary for the authenticated dashboard. Keeps the user in-app with a
// recover action instead of a blank screen; Next logs the underlying error.
export default function DashboardError({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-display text-h2 text-foreground">Something went wrong</h1>
      <p className="text-body-sm text-muted-foreground">
        We hit an unexpected error loading this page. You can try again, or head back to your events.
      </p>
      <div className="flex gap-3">
        <Button onClick={() => reset()}>Try again</Button>
        <Button variant="outline" onClick={() => (window.location.href = '/dashboard')}>
          Back to events
        </Button>
      </div>
    </div>
  )
}
