// src/loans/entities/loan-application.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';
import { LoanStatus } from '../enums/loan-status.enum.js';


const numericTransformer = {
  to: (value: number | null | undefined): number | null | undefined => value,
  from: (value: string | null): number | null => (value === null ? null : Number(value)),
};


@Entity('loan_applications')
@Index('IDX_loan_applications_status', ['status'])
@Index('IDX_loan_applications_created_by', ['createdById'])
@Index('IDX_loan_applications_assigned_to', ['assignedToId'])
@Index('IDX_loan_applications_status_created_at', ['status', 'createdAt'])
export class LoanApplication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 32, unique: true })
  reference: string;

  @Column({ type: 'varchar', length: 160 })
  applicantName: string;

  @Index('IDX_loan_applications_applicant_email')
  @Column({ type: 'varchar', length: 255 })
  applicantEmail: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  applicantPhone: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  nationalId: string | null;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: numericTransformer,
  })
  amount: number;

  @Column({ type: 'char', length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'int' })
  termMonths: number;

  @Column({ type: 'text', nullable: true })
  purpose: string | null;

  @Column({ type: 'varchar', length: 20, default: LoanStatus.DRAFT })
  status: LoanStatus;

  // ---- Relationships (all FK columns are indexed above) ----------------

  @Column({ type: 'uuid' })
  createdById: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @Column({ type: 'uuid', nullable: true })
  assignedToId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'assignedToId' })
  assignedTo: User | null;

  // ---- Lifecycle audit -------------------------------------------------
  @Column({ type: 'uuid', nullable: true })
  submittedById: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  decidedById: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  decidedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  decisionNotes: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
