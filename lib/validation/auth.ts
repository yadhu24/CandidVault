import { z } from 'zod'

// Supabase hashes passwords with bcrypt, which silently truncates input beyond
// 72 bytes — cap there so a long password can't be quietly shortened.
export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 72

export const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(PASSWORD_MIN).max(PASSWORD_MAX),
})
export type SignupInput = z.infer<typeof SignupSchema>

export const LoginSchema = z.object({
  email: z.string().email(),
  // Don't reveal the password policy on the login path; any non-empty value.
  password: z.string().min(1),
})
export type LoginInput = z.infer<typeof LoginSchema>

export const MagicLinkSchema = z.object({
  email: z.string().email(),
})
export type MagicLinkInput = z.infer<typeof MagicLinkSchema>

// Profile fields are all optional; empty strings are allowed in the form and
// normalized to null at the action boundary.
export const ProfileUpdateSchema = z.object({
  businessName: z.string().max(120).optional().or(z.literal('')),
  contactEmail: z.string().email().max(255).optional().or(z.literal('')),
  contactPhone: z.string().max(40).optional().or(z.literal('')),
  websiteUrl: z.string().url().max(255).optional().or(z.literal('')),
})
export type ProfileUpdateInput = z.infer<typeof ProfileUpdateSchema>
