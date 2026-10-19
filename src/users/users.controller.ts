// src/users/users.controller.ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { SystemRole } from '../auth/enums/role.enum.js';
import { ProvisionUserDto } from './dto/provision-user.dto.js';
import { UsersService } from './users.service.js';

/**
 * Administrative user-management surface.
 *
 * Authentication is enforced globally (JwtAuthGuard); every route below is
 * additionally restricted with @Roles.
 */
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * POST /users/provision
   * Restricted to Super Administrator and Administrator. The service layer
   * further prevents an Administrator from minting a Super Administrator.
   */
  
  @Post('provision')
  @Roles(SystemRole.SUPER_ADMINISTRATOR, SystemRole.ADMINISTRATOR)
  @HttpCode(HttpStatus.CREATED)
  provision(
    @Body() dto: ProvisionUserDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.usersService.provision(dto, actor);
  }

  @Get()
  @Roles(SystemRole.SUPER_ADMINISTRATOR, SystemRole.ADMINISTRATOR)
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @Roles(SystemRole.SUPER_ADMINISTRATOR, SystemRole.ADMINISTRATOR)
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.usersService.findOne(id);
  }
}
