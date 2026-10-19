// src/auth/refresh-token.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { LessThan, Repository } from 'typeorm';
import { RefreshToken } from './entities/refresh-token.entity.js';

export interface IssueOptions {
  userId: string;
  /** Reuse the family id when rotating; omit to start a new session. */
  familyId?: string;
  ttlMs: number;
  ip?: string | null;
  userAgent?: string | null;
}

export interface IssuedRefreshToken {
  /** The opaque value that goes into the HttpOnly cookie. */
  token: string;
  entity: RefreshToken;
}

/**
 * Issues, verifies and rotates refresh tokens.
 *
 * Token strategy: 48 random bytes (base64url) returned to the client once; only
 * its SHA-256 digest is persisted, so verification is a single indexed lookup
 * and a stolen database cannot be replayed.
 */
@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  constructor(
    @InjectRepository(RefreshToken)
    private readonly repository: Repository<RefreshToken>,
  ) {}

  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async issue(options: IssueOptions): Promise<IssuedRefreshToken> {
    const token = randomBytes(48).toString('base64url');
    const entity = this.repository.create({
      userId: options.userId,
      tokenHash: this.hash(token),
      familyId: options.familyId ?? randomUUID(),
      expiresAt: new Date(Date.now() + options.ttlMs),
      createdByIp: options.ip ?? null,
      userAgent: options.userAgent ?? null,
    });
    await this.repository.save(entity);
    return { token, entity };
  }

  findActiveByToken(token: string): Promise<RefreshToken | null> {
    return this.repository.findOne({ where: { tokenHash: this.hash(token) } });
  }

  async revoke(entity: RefreshToken, replacedByTokenId: string | null = null): Promise<void> {
    if (entity.revokedAt) return;
    entity.revokedAt = new Date();
    entity.replacedByTokenId = replacedByTokenId;
    await this.repository.save(entity);
  }

  /**
   * Revokes every token in a session family. Called when a rotated token is
   * replayed, which means the token was stolen.
   */
  async revokeFamily(familyId: string): Promise<void> {
    const result = await this.repository
      .createQueryBuilder()
      .update(RefreshToken)
      .set({ revokedAt: () => 'now()' })
      .where('"familyId" = :familyId', { familyId })
      .andWhere('"revokedAt" IS NULL')
      .execute();

    if (result.affected && result.affected > 0) {
      this.logger.warn(
        `Refresh-token reuse detected: revoked ${result.affected} token(s) in family ${familyId}.`,
      );
    }
  }

  /** Housekeeping: drop tokens that expired more than 30 days ago. */
  async pruneExpired(olderThan = new Date(Date.now() - 30 * 86_400_000)): Promise<number> {
    const result = await this.repository.delete({ expiresAt: LessThan(olderThan) });
    return result.affected ?? 0;
  }
}
