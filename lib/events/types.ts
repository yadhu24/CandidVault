// Field-level errors keyed by form field name, plus an optional form-level error.
export interface CreateEventState {
  error?: string
  fieldErrors?: Record<string, string>
}
