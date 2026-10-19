// src/auth/entities/refresh-token.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Persisted refresh-token state enabling rotation and reuse detection.
 *
 * Only the SHA-256 of the opaque token is stored, so a database leak does not
 * hand an attacker a usable session. `familyId` groups every token descended
 * from a single login: if an already-rotated token is presented again we treat
 * it as theft and revoke the whole family.
 */
@Entity('refresh_tokens')
@Index('IDX_refresh_tokens_user_id', ['userId', 'revokedAt'])
@Index('IDX_refresh_tokens_family_id', ['familyId'])
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  /** SHA-256 (hex) of the raw token handed to the client. */
  @Index('IDX_refresh_tokens_token_hash', { unique: true })
  @Column({ type: 'char', length: 64, unique: true })
  tokenHash: string;

  @Column({ type: 'uuid' })
  familyId: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  /** Id of the token this one was rotated into (audit chain). */
  @Column({ type: 'uuid', nullable: true })
  replacedByTokenId: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  createdByIp: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  userAgent: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
