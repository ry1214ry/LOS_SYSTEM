// src/loans/dto/loan.dto.ts
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { LoanStatus } from '../enums/loan-status.enum.js';

export class CreateLoanDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  applicantName: string;


  @IsEmail()
  @MaxLength(255)
  applicantEmail: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  applicantPhone?: string;
  

  @IsOptional()
  @IsString()
  @MaxLength(64)
  nationalId?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(100_000_000)
  amount: number;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  currency?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(600)
  termMonths: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  purpose?: string;

  @IsOptional()
  @IsUUID()
  assignedToId?: string;
}

export class UpdateLoanDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  applicantName?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  applicantEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  applicantPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  nationalId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(100_000_000)
  amount?: number;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(600)
  termMonths?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  purpose?: string;
}

export class ListLoansDto {
  @IsOptional()
  @IsEnum(LoanStatus)
  status?: LoanStatus;

  @IsOptional()
  @IsUUID()
  assignedToId?: string;

  @IsOptional()
  @IsUUID()
  createdById?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}

export class DecisionDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class CreateCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body: string;
}

export class AddAssigneeDto {
  @IsUUID()
  userId: string;
}

/** Metadata registered after a pre-signed upload completes. */
export class RegisterDocumentDto {
  @IsString()
  @MaxLength(255)
  fileName: string;

  @IsString()
  @MaxLength(128)
  mimeType: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  sizeBytes: number;

  @IsString()
  @MaxLength(512)
  storageKey: string;
}
