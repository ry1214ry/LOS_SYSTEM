// src/auth/auth.service.ts
import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { SystemRole } from './enums/role.enum.js';
import { User } from '../users/entities/user.entity.js';
import { UsersService } from '../users/users.service.js';
import { LoginDto, TokenResponse } from './dto/auth.dto.js';
import { RefreshTokenService } from './refresh-token.service.js';
import { TokenDenylistService } from './token-denylist.service.js';
import { getRefreshTtlMs } from './refresh-cookie.config.js';

export interface RequestMeta {
  ip?: string | null;
  userAgent?: string | null;
}

export interface AuthResult {
  response: TokenResponse;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly denylist: TokenDenylistService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly config: ConfigService,
  ) {}

  /** Validates credentials and starts a new session (access + refresh pair). */
  async login(dto: LoginDto, meta: RequestMeta = {}): Promise<AuthResult> {
    const user = await this.usersService.findByEmailWithPassword(dto.email);

    // Compare even when the user is unknown so response timing does not
    // reveal whether an address is registered.
    const passwordMatches = user
      ? await bcrypt.compare(dto.password, user.passwordHash)
      : await bcrypt.compare(dto.password, DUMMY_HASH).then(() => false);

    if (!user || !passwordMatches || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const { token } = await this.refreshTokens.issue({
      userId: user.id,
      ttlMs: getRefreshTtlMs(this.config),
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    await this.usersService.markLoggedIn(user.id);

    return { response: await this.issueAccessToken(user), refreshToken: token };
  }

  /**
   * Rotates a refresh token: the presented token is revoked and a fresh one is
   * issued into the same family. A revoked token being presented again is
   * treated as theft and the entire family is invalidated.
   */
  async refresh(rawToken: string | undefined, meta: RequestMeta = {}): Promise<AuthResult> {
    if (!rawToken) {
      throw new UnauthorizedException('Missing refresh token.');
    }

    const record = await this.refreshTokens.findActiveByToken(rawToken);
    if (!record) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    if (record.revokedAt) {
      await this.refreshTokens.revokeFamily(record.familyId);
      throw new UnauthorizedException('Refresh token has already been used.');
    }

    if (record.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token has expired.');
    }

    const user = await this.usersService.findById(record.userId);
    if (!user || !user.isActive) {
      await this.refreshTokens.revokeFamily(record.familyId);
      throw new UnauthorizedException('User is no longer active.');
    }

    const rotated = await this.refreshTokens.issue({
      userId: user.id,
      familyId: record.familyId,
      ttlMs: getRefreshTtlMs(this.config),
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    await this.refreshTokens.revoke(record, rotated.entity.id);

    return { response: await this.issueAccessToken(user), refreshToken: rotated.token };
  }

  /** Revokes the current access token (jti denylist) and the refresh family. */
  async logout(actor: AuthenticatedUser, rawToken?: string): Promise<{ message: string }> {
    if (actor.jti) {
      this.denylist.revoke(actor.jti, actor.exp ? actor.exp * 1000 : undefined);
    }

    if (rawToken) {
      const record = await this.refreshTokens.findActiveByToken(rawToken);
      if (record && !record.revokedAt) {
        await this.refreshTokens.revokeFamily(record.familyId);
      }
    }

    return { message: 'Logged out successfully.' };
  }

  private async issueAccessToken(user: User): Promise<TokenResponse> {
    const role = user.role?.name ?? SystemRole.OPERATIONS_USER;
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role,
      jti: randomUUID(),
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: this.config.get<string>('JWT_EXPIRES_IN', '15m'),
      user: {
        id: user.id,
        email: user.email,
        role,
        mustChangePassword: user.mustChangePassword,
      },
    };
  }
}

/**
 * A real bcrypt hash (of a value no user can supply) used to equalise the
 * timing of the unknown-account login path so it cannot be used to enumerate
 * registered email addresses.
 */
const DUMMY_HASH = bcrypt.hashSync('los-system-timing-equaliser', 12);
