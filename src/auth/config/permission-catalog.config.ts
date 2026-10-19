// src/auth/config/permission-catalog.config.ts
import { Permission } from '../enums/permission.enum.js';

export interface PermissionDefinition {
  action: Permission;
  /** Coarse grouping used by the API/docs and the admin UI. */
  resource: 'loan' | 'document' | 'assignee';
  /** Human readable label, mirrors the column header in the RBAC matrix. */
  label: string;
  description: string;
}

/**
 * Single source of truth for permission metadata. Consumed by:
 *   - the migration/seed script that populates `permissions`,
 *   - the GET /rbac/matrix introspection endpoint,
 *   - documentation.
 */
export const PermissionCatalog: readonly PermissionDefinition[] = [
  {
    action: Permission.LOAN_VIEW,
    resource: 'loan',
    label: 'View',
    description: 'Read loan applications and their details.',
  },
  {
    action: Permission.LOAN_CREATE,
    resource: 'loan',
    label: 'Create',
    description: 'Create a new loan application draft.',
  },
  {
    action: Permission.LOAN_EDIT,
    resource: 'loan',
    label: 'Edit',
    description: 'Edit a loan application draft.',
  },
  {
    action: Permission.LOAN_SUBMIT,
    resource: 'loan',
    label: 'Submit',
    description: 'Submit a draft into the review workflow.',
  },
  {
    action: Permission.LOAN_APPROVE,
    resource: 'loan',
    label: 'Approve',
    description: 'Approve a submitted loan application.',
  },
  {
    action: Permission.LOAN_REJECT,
    resource: 'loan',
    label: 'Reject',
    description: 'Reject a submitted loan application.',
  },
  {
    action: Permission.LOAN_COMMENT,
    resource: 'loan',
    label: 'Comment',
    description: 'Post a comment on a loan application.',
  },
  {
    action: Permission.LOAN_DELETE_DRAFT,
    resource: 'loan',
    label: 'Delete Draft',
    description: 'Delete a loan application that is still a draft.',
  },
  {
    action: Permission.DOC_DOWNLOAD,
    resource: 'document',
    label: 'Document Download',
    description: 'Download documents attached to a loan application.',
  },
  {
    action: Permission.DOC_UPLOAD,
    resource: 'document',
    label: 'Document Upload',
    description: 'Upload documents to a loan application.',
  },
  {
    action: Permission.ASSIGNEE_ADD,
    resource: 'assignee',
    label: 'Assignee Add',
    description: 'Add a user as an assignee on a loan application.',
  },
  {
    action: Permission.ASSIGNEE_REMOVE,
    resource: 'assignee',
    label: 'Assignee Remove',
    description: 'Remove an assignee from a loan application.',
  },
] as const;
