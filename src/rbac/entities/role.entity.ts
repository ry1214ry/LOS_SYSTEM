// src/rbac/entities/role.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SystemRole } from '../../auth/enums/role.enum.js';
import { Permission } from './permission.entity.js';

/**
 * A system role together with its granted permissions.
 *
 * `permissions` is eager so both the authorization guard and the seed script
 * can resolve a role's effective permission set in a single query.
 */
@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** e.g. `Super Administrator`. Unique, matches SystemRole. */
  @Index('IDX_roles_name', { unique: true })
  @Column({ type: 'varchar', length: 64, unique: true })
  name: SystemRole;

  @Column({ type: 'varchar', length: 255, default: '' })
  description: string;

  /** System roles cannot be deleted through the API. */
  @Column({ type: 'boolean', default: true })
  isSystem: boolean;

  @ManyToMany(() => Permission, { eager: true })
  @JoinTable({
    name: 'role_permissions',
    joinColumn: { name: 'roleId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'permissionId', referencedColumnName: 'id' },
  })
  permissions: Permission[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
