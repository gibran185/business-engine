/** Shape attached to `req.user` after JwtStrategy validation. */
export interface JwtUser {
  userId: string;
  email?: string;
}

/** Supabase-issued access token payload (HS256 legacy secret). */
export interface SupabaseJwtPayload {
  sub: string;
  email?: string;
  role?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
}
