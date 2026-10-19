// src/rbac/entities/permission.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Permission as PermissionAction } from '../../auth/enums/permission.enum.js';

/**
 * A single grantable action, e.g. `loan:approve`.
 *
 * The inverse side of the Role <-> Permission many-to-many is intentionally
 * omitted to keep the module graph acyclic; `Role` owns the join table.
 */
@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Stable machine identifier. `@see PermissionAction`. */
  @Index('IDX_permissions_action', { unique: true })
  @Column({ type: 'varchar', length: 100, unique: true })
  action: PermissionAction;

  @Column({ type: 'varchar', length: 50 })
  resource: string;

  @Column({ type: 'varchar', length: 100 })
  label: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
