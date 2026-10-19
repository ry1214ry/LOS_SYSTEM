// src/rbac/rbac.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Permission } from './entities/permission.entity.js';
import { Role } from './entities/role.entity.js';
import { RbacController } from './rbac.controller.js';
import { RbacSeedService } from './rbac-seed.service.js';
import { RbacService } from './rbac.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Role, Permission])],
  controllers: [RbacController],
  providers: [RbacService, RbacSeedService],
  exports: [RbacService, RbacSeedService, TypeOrmModule],
})
export class RbacModule {}
