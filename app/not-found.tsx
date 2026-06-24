import Link from 'next/link'

// Branded 404, shown for unmatched routes and any notFound() call without a
// closer not-found boundary (e.g. an event a photographer doesn't own).
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-5 text-center">
      <div className="max-w-md space-y-3">
        <p className="font-display text-display text-primary">404</p>
        <h1 className="font-display text-h2 text-foreground">Page not found</h1>
        <p className="text-body-sm text-muted-foreground">
          The page you’re looking for doesn’t exist or has moved.
        </p>
        <Link
          href="/"
          className="mt-2 inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 text-body-sm font-medium text-primary-foreground transition-[filter] hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Go home
        </Link>
      </div>
    </main>
  )
}
