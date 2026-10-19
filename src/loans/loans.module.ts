// src/loans/loans.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module.js';
import { LoanApplication } from './entities/loan-application.entity.js';
import { LoanAssignee } from './entities/loan-assignee.entity.js';
import { LoanComment } from './entities/loan-comment.entity.js';
import { LoanDocument } from './entities/loan-document.entity.js';
import { LoanController } from './loan.controller.js';
import { LoansService } from './loans.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([LoanApplication, LoanComment, LoanDocument, LoanAssignee]),
    UsersModule,
  ],
  controllers: [LoanController],
  providers: [LoansService],
})
export class LoansModule {}
