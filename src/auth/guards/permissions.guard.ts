// src/auth/guards/permissions.guard.ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { RbacService } from '../../rbac/rbac.service.js';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator.js';
import { Permission } from '../enums/permission.enum.js';

/**
 * Deny-by-default permission check.
 *
 * Registered globally (APP_GUARD) after JwtAuthGuard, so `request.user` is
 * always present. Routes without `@RequirePermissions()` only need a valid
 * session; routes with it demand every listed permission.
 *
 * Effective permissions are resolved through RbacService (DB-backed, cached,
 * with a static-matrix fallback) so grants can be changed without a redeploy.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbac: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user?.role) {
      throw new ForbiddenException('Access denied: authenticated role not found.');
    }

    const granted = await this.rbac.getPermissionsForRole(user.role);
    const missing = requiredPermissions.filter((permission) => !granted.includes(permission));

    if (missing.length > 0) {
      throw new ForbiddenException(
        `Role '${user.role}' lacks permission: ${missing.join(', ')}.`,
      );
    }

    return true;
  }
}
