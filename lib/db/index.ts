// Single entry point for data access (CLAUDE.md §2: one source of truth per
// concern). Import the pool, the typed query helpers, the row types, and the
// per-entity query namespaces from here.
export { getDb } from './client'
export {
  query,
  queryOne,
  withTransaction,
  resolvePage,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from './query'
export type { PageOptions } from './query'

export * from './types'

export * as users from './queries/users'
export * as events from './queries/events'
export * as guests from './queries/guests'
export * as uploads from './queries/uploads'
export * as albums from './queries/albums'
export * as moderation from './queries/moderation'
export * as exportJobs from './queries/exports'
