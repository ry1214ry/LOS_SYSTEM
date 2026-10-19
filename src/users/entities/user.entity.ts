// src/users/entities/user.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from '../../rbac/entities/role.entity.js';

/**
 * An internal platform user.
 *
 * Authentication state lives here (`passwordHash`), authorization is derived
 * from the eagerly-loaded `role`. There is deliberately no public registration
 * path — users are created through `POST /users/provision`.
 */
@Entity('users')
@Index('IDX_users_role_id', ['roleId'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  /** bcrypt hash. Never selected by default outside the auth flow. */
  @Column({ type: 'varchar', length: 255, select: false })
  passwordHash: string;

  /** Foreign key backing the RBAC binding. Indexed for role-based queries. */
  @Column({ type: 'uuid' })
  roleId: string;

  @ManyToOne(() => Role, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'roleId' })
  role: Role;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  /** Set when an administrator provisions the account with a temp password. */
  @Column({ type: 'boolean', default: false })
  mustChangePassword: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  passwordChangedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
