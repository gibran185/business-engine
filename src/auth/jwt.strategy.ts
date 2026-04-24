import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { JwtUser, SupabaseJwtPayload } from './types/jwt-user.types.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    const secret = process.env.SUPABASE_JWT_SECRET;
    if (!secret) {
      throw new Error('SUPABASE_JWT_SECRET is not set');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      algorithms: ['HS256'],
    });
  }

  validate(payload: SupabaseJwtPayload): JwtUser {
    return {
      userId: payload.sub,
      email: payload.email,
    };
  }
}
