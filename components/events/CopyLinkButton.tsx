'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { trackClient } from '@/lib/analytics/client'

type Status = 'idle' | 'copied' | 'error'

export function CopyLinkButton({ url, eventId }: { url: string; eventId?: string }) {
  const [status, setStatus] = useState<Status>('idle')

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setStatus('copied')
      trackClient('link_copied', { eventId })
      setTimeout(() => setStatus('idle'), 2000)
    } catch {
      // Clipboard API is unavailable in insecure contexts or when blocked by
      // permissions; surface it rather than failing silently.
      setStatus('error')
    }
  }

  return (
    <Button type="button" variant="secondary" size="sm" onClick={copy}>
      {status === 'copied' ? 'Copied!' : status === 'error' ? 'Copy failed' : 'Copy link'}
    </Button>
  )
}
