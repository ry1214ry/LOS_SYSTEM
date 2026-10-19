// src/rbac/rbac-seed.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PermissionCatalog } from '../auth/config/permission-catalog.config.js';
import {
  RoleDescriptions,
  RolePermissionsMap,
} from '../auth/config/role-permissions.config.js';
import { SystemRole } from '../auth/enums/role.enum.js';
import { Permission } from './entities/permission.entity.js';
import { Role } from './entities/role.entity.js';
import { RbacService } from './rbac.service.js';

/**
 * Idempotently materialises the compiled-in RBAC matrix into
 * `permissions`, `roles` and `role_permissions`.
 *
 * Safe to run on every boot (SEED_ON_BOOT=true) and from `npm run seed`.
 */
@Injectable()
export class RbacSeedService {
  private readonly logger = new Logger(RbacSeedService.name);

  constructor(
    @InjectRepository(Role)
    private readonly rolesRepository: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionsRepository: Repository<Permission>,
    private readonly rbac: RbacService,
  ) {}

  async seed(): Promise<{ roles: number; permissions: number }> {
    await this.seedPermissions();
    const permissionsByAction = new Map(
      (await this.permissionsRepository.find()).map((permission) => [
        permission.action,
        permission,
      ]),
    );

    let seededRoles = 0;
    for (const roleName of Object.values(SystemRole)) {
      const granted = RolePermissionsMap[roleName]
        .map((action) => permissionsByAction.get(action))
        .filter((permission): permission is Permission => permission !== undefined);

      const role =
        (await this.rolesRepository.findOne({ where: { name: roleName } })) ??
        this.rolesRepository.create({ name: roleName, isSystem: true });

      role.description = RoleDescriptions[roleName];
      role.permissions = granted;
      await this.rolesRepository.save(role);
      seededRoles += 1;
    }

    // Force the guard to pick up any grant changes immediately.
    this.rbac.invalidate();

    this.logger.log(
      `RBAC matrix seeded: ${seededRoles} roles, ${permissionsByAction.size} permissions.`,
    );
    return { roles: seededRoles, permissions: permissionsByAction.size };
  }

  private async seedPermissions(): Promise<void> {
    for (const definition of PermissionCatalog) {
      const existing = await this.permissionsRepository.findOne({
        where: { action: definition.action },
      });
      const permission =
        existing ?? this.permissionsRepository.create({ action: definition.action });

      permission.resource = definition.resource;
      permission.label = definition.label;
      permission.description = definition.description;
      await this.permissionsRepository.save(permission);
    }
  }
}
