// src/rbac/rbac.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from '../auth/enums/permission.enum.js';
import { SystemRole } from '../auth/enums/role.enum.js';
import { RolePermissionsMap } from '../auth/config/role-permissions.config.js';
import { Role } from './entities/role.entity.js';

interface CacheEntry {
  permissions: Permission[];
  expiresAt: number;
}

/**
 * Resolves the effective permission set for a role.
 *
 * Reads from the database (which the seed script keeps in sync with the frozen
 * `RolePermissionsMap`) and caches for a short TTL so authorization does not
 * cost a query per request. If the database is unreachable or a role has not
 * been seeded yet, it degrades to the compiled-in matrix rather than failing
 * open — an unknown role resolves to "no permissions".
 */
@Injectable()
export class RbacService {
  private readonly logger = new Logger(RbacService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly ttlMs = 60_000;

  constructor(
    @InjectRepository(Role)
    private readonly rolesRepository: Repository<Role>,
  ) {}

  async getPermissionsForRole(roleName: string): Promise<Permission[]> {
    const cached = this.cache.get(roleName);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.permissions;
    }

    let permissions: Permission[];
    try {
      const role = await this.rolesRepository.findOne({
        where: { name: roleName as SystemRole },
      });
      permissions = role
        ? role.permissions.map((permission) => permission.action)
        : this.fromStaticMatrix(roleName);
    } catch (error) {
      this.logger.warn(
        `Falling back to the static RBAC matrix for '${roleName}': ${(error as Error).message}`,
      );
      permissions = this.fromStaticMatrix(roleName);
    }

    this.cache.set(roleName, { permissions, expiresAt: Date.now() + this.ttlMs });
    return permissions;
  }

  /** Drops the cache after a role's grants change. */
  invalidate(roleName?: string): void {
    if (roleName) {
      this.cache.delete(roleName);
      return;
    }
    this.cache.clear();
  }

  private fromStaticMatrix(roleName: string): Permission[] {
    return [...(RolePermissionsMap[roleName as SystemRole] ?? [])];
  }
}
