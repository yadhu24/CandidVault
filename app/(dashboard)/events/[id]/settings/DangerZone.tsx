'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { deleteEventAction } from '@/lib/events/actions'

// Destructive action, gated behind a confirmation modal that requires typing the
// event name — prevents an accidental one-click delete.
export function DangerZone({ eventId, eventName }: { eventId: string; eventName: string }) {
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const canDelete = confirmText.trim() === eventName.trim() && !pending

  function close() {
    if (pending) return
    setOpen(false)
    setConfirmText('')
    setError(null)
  }

  function onDelete() {
    setError(null)
    startTransition(async () => {
      // On success the action redirects to /dashboard, so control won't return.
      const result = await deleteEventAction(eventId)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium text-foreground">Delete this event</p>
          <p className="text-body-sm text-muted-foreground">
            Permanently removes the event and all of its uploads, albums, and exports. This cannot
            be undone.
          </p>
        </div>
        <Button variant="destructive" onClick={() => setOpen(true)} className="shrink-0">
          Delete event
        </Button>
      </div>

      <Modal open={open} onClose={close} title="Delete event?">
        <div className="space-y-4">
          <p className="text-body-sm text-muted-foreground">
            This permanently deletes <span className="font-medium text-foreground">{eventName}</span>{' '}
            and everything in it — uploads, albums, and exports. This action cannot be undone.
          </p>
          <Input
            id="confirmName"
            label={`Type the event name to confirm`}
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={eventName}
            autoComplete="off"
          />
          {error && <p className="text-body-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={close} disabled={pending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onDelete} disabled={!canDelete} isLoading={pending}>
              {pending ? 'Deleting…' : 'Delete event'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
