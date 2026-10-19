// src/auth/token-denylist.service.ts
import { Injectable } from '@nestjs/common';

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 1 day, matches the JWT expiry

/**
 * Holds revoked JWT ids (jti) so logout can invalidate a token before it expires.
 *
 * LIMITATION: this is in-memory. Revocations are lost on restart and are NOT
 * shared across multiple instances. For production, back this with Redis or a
 * `revoked_tokens` table.
 */
@Injectable()
export class TokenDenylistService {
  private readonly revoked = new Map<string, number>();

  revoke(jti: string, expiresAtMs?: number): void {
    this.revoked.set(jti, expiresAtMs ?? Date.now() + DEFAULT_TTL_MS);
  }

  isRevoked(jti: string): boolean {
    const expiresAt = this.revoked.get(jti);
    if (expiresAt === undefined) return false;

    if (Date.now() > expiresAt) {
      this.revoked.delete(jti);
      return false;
    }

    return true;
  }
}
