// src/loans/entities/loan-comment.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';
import { LoanApplication } from './loan-application.entity.js';

@Entity('loan_comments')
@Index('IDX_loan_comments_loan_id', ['loanId', 'createdAt'])
@Index('IDX_loan_comments_author_id', ['authorId'])
export class LoanComment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  loanId: string;

  @ManyToOne(() => LoanApplication, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'loanId' })
  loan: LoanApplication;

  @Column({ type: 'uuid' })
  authorId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'authorId' })
  author: User;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'boolean', default: false })
  isInternal: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
