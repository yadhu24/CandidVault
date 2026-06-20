import { queryOne } from '../query'
import type { PhotographerProfile, User, UserRole } from '../types'

export interface CreateUserInput {
  // Supabase Auth user id. Supply it on signup so app rows line up with auth;
  // omit only for local seeds/tests, where the DB default generates one.
  id?: string
  email: string
  role?: UserRole
  displayName?: string | null
}

export async function createUser(input: CreateUserInput): Promise<User> {
  const row = await queryOne<User>(
    `INSERT INTO users (id, email, role, display_name)
     VALUES (COALESCE($1, gen_random_uuid()), lower($2), COALESCE($3, 'photographer'), $4)
     RETURNING *`,
    [input.id ?? null, input.email, input.role ?? null, input.displayName ?? null],
  )
  return row as User
}

export function getUserById(id: string): Promise<User | null> {
  return queryOne<User>(`SELECT * FROM users WHERE id = $1`, [id])
}

export function getUserByEmail(email: string): Promise<User | null> {
  return queryOne<User>(`SELECT * FROM users WHERE lower(email) = lower($1)`, [email])
}

export interface PhotographerProfileInput {
  businessName?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  websiteUrl?: string | null
}

export async function upsertPhotographerProfile(
  userId: string,
  input: PhotographerProfileInput,
): Promise<PhotographerProfile> {
  const row = await queryOne<PhotographerProfile>(
    `INSERT INTO photographer_profiles
       (user_id, business_name, contact_email, contact_phone, website_url)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id) DO UPDATE SET
       business_name = EXCLUDED.business_name,
       contact_email = EXCLUDED.contact_email,
       contact_phone = EXCLUDED.contact_phone,
       website_url = EXCLUDED.website_url
     RETURNING *`,
    [
      userId,
      input.businessName ?? null,
      input.contactEmail ?? null,
      input.contactPhone ?? null,
      input.websiteUrl ?? null,
    ],
  )
  return row as PhotographerProfile
}

export function getPhotographerProfile(userId: string): Promise<PhotographerProfile | null> {
  return queryOne<PhotographerProfile>(`SELECT * FROM photographer_profiles WHERE user_id = $1`, [
    userId,
  ])
}
