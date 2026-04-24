import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import type { JwtUser, SupabaseJwtPayload } from './types/jwt-user.types.js';

function normalizeSupabaseUrl(url: string): string {
  return url.replace(/\/$/, '');
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL?.trim();
    const jwtSecret = process.env.SUPABASE_JWT_SECRET;

    if (supabaseUrl) {
      const base = normalizeSupabaseUrl(supabaseUrl);
      const issuer = `${base}/auth/v1`;
      super({
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        ignoreExpiration: false,
        secretOrKeyProvider: passportJwtSecret({
          cache: true,
          rateLimit: true,
          jwksRequestsPerMinute: 5,
          jwksUri: `${issuer}/.well-known/jwks.json`,
        }),
        issuer,
        algorithms: ['ES256'],
      });
    } else if (jwtSecret) {
      super({
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        ignoreExpiration: false,
        secretOrKey: jwtSecret,
        algorithms: ['HS256'],
      });
    } else {
      throw new Error(
        'Set SUPABASE_URL (ES256 via JWKS) or SUPABASE_JWT_SECRET (legacy HS256)',
      );
    }
  }

  validate(payload: SupabaseJwtPayload): JwtUser {
    return {
      userId: payload.sub,
      email: payload.email,
    };
  }
}
