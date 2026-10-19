// src/loans/entities/loan-document.entity.ts
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

/**
 * Metadata for a document attached to a loan application.
 *
 * The binary itself lives in object storage; `storageKey` is the pointer
 * produced by the pre-signed upload. Keeping only metadata in Postgres keeps
 * the database small and the backup window predictable.
 */
@Entity('loan_documents')
@Index('IDX_loan_documents_loan_id', ['loanId', 'createdAt'])
@Index('IDX_loan_documents_uploaded_by', ['uploadedById'])
export class LoanDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  loanId: string;

  @ManyToOne(() => LoanApplication, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'loanId' })
  loan: LoanApplication;

  @Column({ type: 'uuid' })
  uploadedById: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'uploadedById' })
  uploadedBy: User;

  @Column({ type: 'varchar', length: 255 })
  fileName: string;

  @Column({ type: 'varchar', length: 128 })
  mimeType: string;

  @Column({ type: 'bigint' })
  sizeBytes: string;

  /** Opaque key in the object-storage bucket. Never a raw public URL. */
  @Column({ type: 'varchar', length: 512 })
  storageKey: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
