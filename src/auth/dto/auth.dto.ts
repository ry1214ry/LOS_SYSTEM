// src/auth/dto/auth.dto.ts
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { SystemRole } from '../enums/role.enum.js';

export class LoginDto {
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password: string;
}

/** Response body for login/refresh. The refresh token itself is a cookie. */
export interface TokenResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
  user: {
    id: string;
    email: string;
    role: SystemRole;
    mustChangePassword: boolean;
  };
}
