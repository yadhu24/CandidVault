'use client'

// Last-resort boundary: catches errors in the root layout itself, so it replaces
// the whole document (no access to globals.css → inline styles for reliability).
// Next logs the error server-side; we never surface internals to the user.
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          background: '#faf7f2',
          color: '#1c1917',
        }}
      >
        <div style={{ maxWidth: 420, padding: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 8px' }}>Something went wrong</h1>
          <p style={{ fontSize: 14, color: '#57534e', margin: '0 0 20px' }}>
            An unexpected error occurred. Please try again.
          </p>
          <button
            onClick={() => reset()}
            style={{
              cursor: 'pointer',
              borderRadius: 8,
              border: 'none',
              padding: '10px 18px',
              fontSize: 14,
              fontWeight: 500,
              background: '#1c1917',
              color: '#fff',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
