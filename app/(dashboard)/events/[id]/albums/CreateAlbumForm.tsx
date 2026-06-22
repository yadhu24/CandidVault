'use client'

import { useState, useTransition } from 'react'
import { Button, Input } from '@/components/ui'
import { PlusIcon } from '@/components/ui/icons'
import { createAlbumAction } from '@/lib/albums/actions'

export function CreateAlbumForm({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <PlusIcon className="size-5" /> Create album
      </Button>
    )
  }

  function submit() {
    setError(null)
    start(async () => {
      const res = await createAlbumAction(eventId, name)
      if (res.ok) {
        setName('')
        setOpen(false)
      } else {
        setError(res.error ?? 'Could not create the album.')
      }
    })
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-2 sm:flex-row sm:items-start">
      <div className="flex-1">
        <Input
          id="albumName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Album name (e.g. Ceremony)"
          maxLength={120}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
          }}
          error={error ?? undefined}
        />
      </div>
      <div className="flex gap-2">
        <Button onClick={submit} isLoading={pending} disabled={!name.trim()}>
          Create
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setOpen(false)
            setError(null)
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
