// src/auth/auth.controller.ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/auth.dto.js';
import { Public } from './decorators/public.decorator.js';
import {
  getRefreshCookieName,
  getRefreshCookieOptions,
  getRefreshTtlMs,
} from './refresh-cookie.config.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly config: ConfigService,
  ) {}

  /** POST /auth/login — public, strict rate limit to slow credential stuffing. */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { response, refreshToken } = await this.authService.login(dto, {
      ip: req.ip,
      userAgent: req.get('user-agent') ?? null,
    });

    this.setRefreshCookie(res, refreshToken);
    return response;
  }

  /**
   * POST /auth/refresh — public route, but useless without the HttpOnly cookie.
   * Rotates the refresh token and issues a new access token.
   */
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const cookieName = getRefreshCookieName(this.config);
    const raw = (req.cookies as Record<string, string> | undefined)?.[cookieName];

    try {
      const { response, refreshToken } = await this.authService.refresh(raw, {
        ip: req.ip,
        userAgent: req.get('user-agent') ?? null,
      });
      this.setRefreshCookie(res, refreshToken);
      return response;
    } catch (error) {
      // Never leave a dead cookie on the client.
      res.clearCookie(cookieName, getRefreshCookieOptions(this.config));
      throw error;
    }
  }

  /** POST /auth/logout — revokes the access token and the refresh family. */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookieName = getRefreshCookieName(this.config);
    const raw = (req.cookies as Record<string, string> | undefined)?.[cookieName];

    const result = await this.authService.logout(actor, raw);
    res.clearCookie(cookieName, getRefreshCookieOptions(this.config));
    return result;
  }

  /** GET /auth/me — the currently authenticated principal. */
  @Get('me')
  me(@CurrentUser() actor: AuthenticatedUser) {
    return this.usersService.findOne(actor.userId);
  }

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie(
      getRefreshCookieName(this.config),
      token,
      getRefreshCookieOptions(this.config, getRefreshTtlMs(this.config)),
    );
  }
}
