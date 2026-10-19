// src/auth/config/role-permissions.config.ts
import { Permission } from '../enums/permission.enum.js';
import { SystemRole } from '../enums/role.enum.js';

/**
 * THE AUTHORITATIVE RBAC MATRIX.
 *
 * This object is the frozen policy definition for the Loan Application
 * workflow. It is used by:
 *   - `PermissionsGuard` as the resilient fallback when the database is
 *     unavailable (see RbacService),
 *   - the seed script (`npm run seed`) that populates
 *     role / permission / role_permissions,
 *   - the unit test that asserts the matrix has not drifted.
 *
 * Matrix (View, Create, Edit, Submit, Approve, Reject, Comment,
 *         Delete Draft, Doc Download, Doc Upload, Assignee Add, Assignee Remove):
 *
 *   Super Administrator : Y Y Y Y N N Y Y N N N N
 *   Administrator       : Y Y Y Y N N Y N Y Y Y Y
 *   Loan Officer        : Y Y Y Y N N Y N Y Y N N
 *   Credit Analyst      : Y N N Y Y N Y N Y Y Y N
 *   Approver            : Y N N N Y N Y N Y N N N
 *   Operations User     : N N N N N N N N N N N N
 */
export const RolePermissionsMap: Readonly<Record<SystemRole, readonly Permission[]>> = Object.freeze({
  [SystemRole.SUPER_ADMINISTRATOR]: Object.freeze([
    Permission.LOAN_VIEW,
    Permission.LOAN_CREATE,
    Permission.LOAN_EDIT,
    Permission.LOAN_SUBMIT,
    Permission.LOAN_COMMENT,
    Permission.LOAN_DELETE_DRAFT,
  ]),

  [SystemRole.ADMINISTRATOR]: Object.freeze([
    Permission.LOAN_VIEW,
    Permission.LOAN_CREATE,
    Permission.LOAN_EDIT,
    Permission.LOAN_SUBMIT,
    Permission.LOAN_COMMENT,
    Permission.DOC_DOWNLOAD,
    Permission.DOC_UPLOAD,
    Permission.ASSIGNEE_ADD,
    Permission.ASSIGNEE_REMOVE,
  ]),

  [SystemRole.LOAN_OFFICER]: Object.freeze([
    Permission.LOAN_VIEW,
    Permission.LOAN_CREATE,
    Permission.LOAN_EDIT,
    Permission.LOAN_SUBMIT,
    Permission.LOAN_COMMENT,
    Permission.DOC_DOWNLOAD,
    Permission.DOC_UPLOAD,
  ]),

  [SystemRole.CREDIT_ANALYST]: Object.freeze([
    Permission.LOAN_VIEW,
    Permission.LOAN_SUBMIT,
    Permission.LOAN_APPROVE,
    Permission.LOAN_COMMENT,
    Permission.DOC_DOWNLOAD,
    Permission.DOC_UPLOAD,
    Permission.ASSIGNEE_ADD,
  ]),

  [SystemRole.APPROVER]: Object.freeze([
    Permission.LOAN_VIEW,
    Permission.LOAN_APPROVE,
    Permission.LOAN_COMMENT,
    Permission.DOC_DOWNLOAD,
  ]),

  // Read-only operational visibility; intentionally has no write permission.
  [SystemRole.OPERATIONS_USER]: Object.freeze([]),
});

/** Human-readable role descriptions, used when seeding `roles`. */
export const RoleDescriptions: Readonly<Record<SystemRole, string>> = Object.freeze({
  [SystemRole.SUPER_ADMINISTRATOR]: 'Platform owner. Manages administrators and drafts loan applications.',
  [SystemRole.ADMINISTRATOR]: 'Manages internal users, assigns work and maintains loan documents.',
  [SystemRole.LOAN_OFFICER]: 'Originates loan applications and uploads supporting documents.',
  [SystemRole.CREDIT_ANALYST]: 'Assesses, submits and approves loan applications.',
  [SystemRole.APPROVER]: 'Final credit approval authority.',
  [SystemRole.OPERATIONS_USER]: 'Read-only operational access.',
});
