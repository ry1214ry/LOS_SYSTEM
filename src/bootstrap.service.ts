// src/bootstrap.service.ts
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SystemRole } from './auth/enums/role.enum.js';
import { RbacSeedService } from './rbac/rbac-seed.service.js';
import { UsersService } from './users/users.service.js';

/**
 * Optional first-boot provisioning, gated behind `SEED_ON_BOOT=true`.
 *
 * Off by default so a normal restart is a no-op; the same work is available
 * explicitly through `npm run seed`.
 */
@Injectable()
export class BootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BootstrapService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly rbacSeed: RbacSeedService,
    private readonly usersService: UsersService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.config.get<boolean>('SEED_ON_BOOT') !== true) return;

    await this.rbacSeed.seed();

    const email = this.config.get<string>('SEED_SUPER_ADMIN_EMAIL');
    const password = this.config.get<string>('SEED_SUPER_ADMIN_PASSWORD');
    if (!email || !password) {
      this.logger.warn(
        'SEED_ON_BOOT is true but SEED_SUPER_ADMIN_EMAIL/PASSWORD are unset; skipping bootstrap user.',
      );
      return;
    }

    await this.usersService.ensureBootstrapUser(email, password, SystemRole.SUPER_ADMINISTRATOR);
    this.logger.log(`Bootstrap Super Administrator ready: ${email}`);
  }
}
