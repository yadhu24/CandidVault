// Field-level errors keyed by form field name, plus an optional form-level error.
export interface CreateEventState {
  error?: string
  fieldErrors?: Record<string, string>
}

// Same shape as create, plus `ok` so the settings form can show a saved state
// (create redirects on success, so it never needs `ok`).
export interface UpdateEventState {
  ok?: boolean
  error?: string
  fieldErrors?: Record<string, string>
}
