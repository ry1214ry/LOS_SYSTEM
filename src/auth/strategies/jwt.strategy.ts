// src/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { UsersService } from '../../users/users.service.js';
import { SystemRole } from '../enums/role.enum.js';
import { TokenDenylistService } from '../token-denylist.service.js';

export interface JwtPayload {
  sub: string;
  email: string;
  role?: string;
  jti?: string;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly denylist: TokenDenylistService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
      algorithms: ['HS256'],
      issuer: 'los-system',
      audience: 'los-system-client',
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (payload.jti && this.denylist.isRevoked(payload.jti)) {
      throw new UnauthorizedException('Token has been revoked.');
    }

    // Never trust the role claim on the token: load the user so deletions,
    // role changes and deactivations take effect immediately.
    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User no longer exists or is deactivated.');
    }

    return {
      userId: user.id,
      email: user.email,
      role: (user.role?.name ?? SystemRole.OPERATIONS_USER) as SystemRole,
      jti: payload.jti,
      exp: payload.exp,
    };
  }
}
