'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'

type Status = 'idle' | 'copied' | 'error'

export function CopyLinkButton({ url }: { url: string }) {
  const [status, setStatus] = useState<Status>('idle')

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setStatus('copied')
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
