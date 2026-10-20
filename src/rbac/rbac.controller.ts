import { Controller, Get } from '@nestjs/common';
import { RoleDescriptions, RolePermissionsMap } from '../auth/config/role-permissions.config.js';
import { PermissionCatalog } from '../auth/config/permission-catalog.config.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { SystemRole } from '../auth/enums/role.enum.js';


@Controller('rbac')
export class RbacController {
  @Get('matrix')
  @Roles(SystemRole.SUPER_ADMINISTRATOR, SystemRole.ADMINISTRATOR)
  getMatrix() {
    return {
      matrix: Object.fromEntries(
        Object.entries(RolePermissionsMap).map(([role, permissions]) => [
          role,
          { description: RoleDescriptions[role as SystemRole], permissions },
        ]),
      ),
      permissions: PermissionCatalog,
    };
  }
}
