'use server'

import { revalidatePath } from 'next/cache'
import { requirePhotographer } from '@/lib/account/photographers'
import {
  addAlbumItem,
  createAlbum,
  getAlbumForEvent,
  removeAlbumItem,
} from '@/lib/db/queries/albums'
import { getEventByIdForPhotographer } from '@/lib/db/queries/events'
import { getUploadById, setUploadFavorite } from '@/lib/db/queries/uploads'

export interface ActionResult {
  ok: boolean
  error?: string
}

// Ownership comes from the session, never the client (CLAUDE.md §7).
async function ownsEvent(eventId: string): Promise<boolean> {
  const { user } = await requirePhotographer()
  return Boolean(await getEventByIdForPhotographer(eventId, user.id))
}

export async function createAlbumAction(
  eventId: string,
  name: string,
  description?: string,
): Promise<ActionResult> {
  const trimmed = name.trim()
  if (!trimmed) return { ok: false, error: 'Give the album a name.' }
  if (trimmed.length > 120) return { ok: false, error: 'That name is too long.' }
  if (!(await ownsEvent(eventId))) return { ok: false, error: 'Event not found.' }

  await createAlbum({ eventId, name: trimmed, description: description?.trim() || null })
  revalidatePath(`/events/${eventId}/albums`)
  return { ok: true }
}

export async function addToAlbumAction(
  eventId: string,
  albumId: string,
  uploadId: string,
): Promise<ActionResult> {
  if (!(await ownsEvent(eventId))) return { ok: false, error: 'Event not found.' }

  const album = await getAlbumForEvent(albumId, eventId)
  if (!album) return { ok: false, error: 'Album not found.' }

  // Only approved uploads from THIS event may be added.
  const upload = await getUploadById(uploadId)
  if (!upload || upload.eventId !== eventId || upload.moderationStatus !== 'approved') {
    return { ok: false, error: 'Only approved uploads from this event can be added.' }
  }

  await addAlbumItem(albumId, uploadId)
  revalidatePath(`/events/${eventId}/albums/${albumId}`)
  revalidatePath(`/events/${eventId}/albums`)
  return { ok: true }
}

export async function removeFromAlbumAction(
  eventId: string,
  albumId: string,
  uploadId: string,
): Promise<ActionResult> {
  if (!(await ownsEvent(eventId))) return { ok: false, error: 'Event not found.' }

  const album = await getAlbumForEvent(albumId, eventId)
  if (!album) return { ok: false, error: 'Album not found.' }

  await removeAlbumItem(albumId, uploadId)
  revalidatePath(`/events/${eventId}/albums/${albumId}`)
  revalidatePath(`/events/${eventId}/albums`)
  return { ok: true }
}

export async function toggleFavoriteAction(
  eventId: string,
  uploadId: string,
  favorite: boolean,
): Promise<ActionResult> {
  if (!(await ownsEvent(eventId))) return { ok: false, error: 'Event not found.' }

  const updated = await setUploadFavorite(uploadId, eventId, favorite)
  if (!updated) return { ok: false, error: 'Upload not found.' }
  revalidatePath(`/events/${eventId}/gallery`)
  return { ok: true }
}
