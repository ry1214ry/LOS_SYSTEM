// src/loans/entities/loan-assignee.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';
import { LoanApplication } from './loan-application.entity.js';

/** Join table: which users are working a given loan application. */
@Entity('loan_assignees')
@Unique('UQ_loan_assignees_loan_user', ['loanId', 'userId'])
@Index('IDX_loan_assignees_loan_id', ['loanId'])
@Index('IDX_loan_assignees_user_id', ['userId'])
export class LoanAssignee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  loanId: string;

  @ManyToOne(() => LoanApplication, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'loanId' })
  loan: LoanApplication;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  assignedById: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
