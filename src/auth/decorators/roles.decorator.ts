// src/auth/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { SystemRole } from '../enums/role.enum.js';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: SystemRole[]) => SetMetadata(ROLES_KEY, roles);