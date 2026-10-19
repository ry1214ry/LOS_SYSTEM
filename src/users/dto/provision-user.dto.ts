
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SystemRole } from '../../auth/enums/role.enum.js';


export class ProvisionUserDto {
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsOptional()
  @IsEnum(SystemRole, {
    message: `role must be one of: ${Object.values(SystemRole).join(', ')}`,
  })
  role?: SystemRole;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'temporaryPassword must be at least 8 characters long' })
  @MaxLength(72, { message: 'temporaryPassword must be at most 72 characters long' })
  temporaryPassword?: string;
}
