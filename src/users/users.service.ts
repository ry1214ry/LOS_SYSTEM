// src/users/users.service.ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { SystemRole } from '../auth/enums/role.enum.js';
import { Role } from '../rbac/entities/role.entity.js';
import { User } from './entities/user.entity.js';
import { ProvisionUserDto } from './dto/provision-user.dto.js';

/** Fields safe to return over the wire. Never includes `passwordHash`. */
export interface SafeUser {
  id: string;
  email: string;
  role: SystemRole;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

const PRIVILEGED_PROVISIONERS: readonly SystemRole[] = [
  SystemRole.SUPER_ADMINISTRATOR,
  SystemRole.ADMINISTRATOR,
];

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly rolesRepository: Repository<Role>,
    private readonly config: ConfigService,
  ) {}

  /**
   * Creates an internal user and binds a system role.
   *
   * Callers are restricted to Super Administrator / Administrator at the route
   * level (`@Roles`), and re-checked here so the rule survives any future
   * endpoint that reuses this method. Only a Super Administrator may mint
   * another Super Administrator.
   */
  async provision(
    dto: ProvisionUserDto,
    actor: AuthenticatedUser,
  ): Promise<{ user: SafeUser; temporaryPassword?: string }> {
    if (!PRIVILEGED_PROVISIONERS.includes(actor.role)) {
      throw new ForbiddenException(
        'Only a Super Administrator or Administrator may provision users.',
      );
    }

    const email = dto.email.toLowerCase().trim();
    const roleName = dto.role ?? SystemRole.LOAN_OFFICER;

    if (!Object.values(SystemRole).includes(roleName)) {
      throw new BadRequestException(
        `Invalid role '${roleName}'. Allowed roles: ${Object.values(SystemRole).join(', ')}.`,
      );
    }

    if (
      roleName === SystemRole.SUPER_ADMINISTRATOR &&
      actor.role !== SystemRole.SUPER_ADMINISTRATOR
    ) {
      this.logger.warn(
        `Privilege-escalation attempt: '${actor.email}' tried to provision a Super Administrator.`,
      );
      throw new ForbiddenException(
        'Only a Super Administrator may provision another Super Administrator.',
      );
    }

    const role = await this.rolesRepository.findOne({ where: { name: roleName } });
    if (!role) {
      throw new InternalServerErrorException(
        `Role '${roleName}' is not provisioned. Run \`npm run seed\` to load the RBAC matrix.`,
      );
    }

    const existing = await this.usersRepository.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException(`A user with the email '${email}' already exists.`);
    }

    const suppliedPassword = dto.temporaryPassword;
    const temporaryPassword = suppliedPassword ?? this.generateTemporaryPassword();
    const rounds = this.config.get<number>('BCRYPT_ROUNDS', 12);
    const passwordHash = await bcrypt.hash(temporaryPassword, rounds);

    const user = this.usersRepository.create({
      email,
      passwordHash,
      roleId: role.id,
      role,
      isActive: true,
      mustChangePassword: true,
      passwordChangedAt: null,
    });

    const saved = await this.usersRepository.save(user);

    this.logger.log(
      `User provisioned: email='${saved.email}' role='${roleName}' by='${actor.email}'`,
    );

    return {
      user: this.toSafeUser(saved),
      // Only echo a password the administrator did not choose themselves.
      ...(suppliedPassword ? {} : { temporaryPassword }),
    };
  }

  /**
   * Creates or rotates a well-known account (the bootstrap Super
   * Administrator). Bypasses the privilege-escalation guard because it is only
   * reachable from trusted startup code, never from a request.
   */
  async ensureBootstrapUser(
    email: string,
    password: string,
    roleName: SystemRole = SystemRole.SUPER_ADMINISTRATOR,
  ): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();
    const role = await this.rolesRepository.findOne({ where: { name: roleName } });
    if (!role) {
      throw new InternalServerErrorException(
        `Role '${roleName}' is not provisioned. Run \`npm run seed\` first.`,
      );
    }

    const rounds = this.config.get<number>('BCRYPT_ROUNDS', 12);
    const passwordHash = await bcrypt.hash(password, rounds);
    const existing = await this.findByEmailWithPassword(normalizedEmail);

    if (existing) {
      existing.passwordHash = passwordHash;
      existing.roleId = role.id;
      existing.role = role;
      existing.isActive = true;
      existing.passwordChangedAt = new Date();
      await this.usersRepository.save(existing);
      return;
    }

    await this.usersRepository.save(
      this.usersRepository.create({
        email: normalizedEmail,
        passwordHash,
        roleId: role.id,
        role,
        isActive: true,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
      }),
    );
  }

  /** Includes the bcrypt hash. Use only for credential verification. */
  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      // Eager relations are NOT applied by the query builder — join explicitly.
      .leftJoinAndSelect('user.role', 'role')
      .addSelect('user.passwordHash')
      .where('LOWER(user.email) = LOWER(:email)', { email: email.trim() })
      .getOne();
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async findAll(): Promise<SafeUser[]> {
    const users = await this.usersRepository.find({
      order: { createdAt: 'DESC' },
      take: 200,
    });
    return users.map((user) => this.toSafeUser(user));
  }

  async findOne(id: string): Promise<SafeUser> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`No user with id '${id}'.`);
    }
    return this.toSafeUser(user);
  }

  async markLoggedIn(id: string): Promise<void> {
    await this.usersRepository.update({ id }, { lastLoginAt: new Date() });
  }

  toSafeUser(user: User): SafeUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role?.name,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }

  private generateTemporaryPassword(): string {
    // base64url of 18 bytes ≈ 24 chars of mixed case + digits.
    return `${randomBytes(18).toString('base64url')}aA1!`;
  }
}
