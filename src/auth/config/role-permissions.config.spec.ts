import { describe, expect, it } from 'vitest';
import { Permission } from '../enums/permission.enum.js';
import { SystemRole } from '../enums/role.enum.js';
import { RolePermissionsMap } from './role-permissions.config.js';

/**
 * Locks the authorization matrix to the approved policy table.
 *
 * This test deliberately does not touch the database: it is the contract
 * between the product spec and the code, and a regression here is a security
 * regression, not a flaky integration test.
 */
describe('RBAC matrix', () => {
  const expected: Record<SystemRole, Permission[]> = {
    [SystemRole.SUPER_ADMINISTRATOR]: [
      Permission.LOAN_VIEW,
      Permission.LOAN_CREATE,
      Permission.LOAN_EDIT,
      Permission.LOAN_SUBMIT,
      Permission.LOAN_COMMENT,
      Permission.LOAN_DELETE_DRAFT,
    ],
    [SystemRole.ADMINISTRATOR]: [
      Permission.LOAN_VIEW,
      Permission.LOAN_CREATE,
      Permission.LOAN_EDIT,
      Permission.LOAN_SUBMIT,
      Permission.LOAN_COMMENT,
      Permission.DOC_DOWNLOAD,
      Permission.DOC_UPLOAD,
      Permission.ASSIGNEE_ADD,
      Permission.ASSIGNEE_REMOVE,
    ],
    [SystemRole.LOAN_OFFICER]: [
      Permission.LOAN_VIEW,
      Permission.LOAN_CREATE,
      Permission.LOAN_EDIT,
      Permission.LOAN_SUBMIT,
      Permission.LOAN_COMMENT,
      Permission.DOC_DOWNLOAD,
      Permission.DOC_UPLOAD,
    ],
    [SystemRole.CREDIT_ANALYST]: [
      Permission.LOAN_VIEW,
      Permission.LOAN_SUBMIT,
      Permission.LOAN_APPROVE,
      Permission.LOAN_COMMENT,
      Permission.DOC_DOWNLOAD,
      Permission.DOC_UPLOAD,
      Permission.ASSIGNEE_ADD,
    ],
    [SystemRole.APPROVER]: [
      Permission.LOAN_VIEW,
      Permission.LOAN_APPROVE,
      Permission.LOAN_COMMENT,
      Permission.DOC_DOWNLOAD,
    ],
    [SystemRole.OPERATIONS_USER]: [],
  };

  it('matches the approved role/permission matrix exactly', () => {
    for (const role of Object.values(SystemRole)) {
      expect(new Set(RolePermissionsMap[role])).toEqual(new Set(expected[role]));
    }
  });

  it('grants Approve to exactly Credit Analyst and Approver', () => {
    const approvers = Object.values(SystemRole).filter((role) =>
      RolePermissionsMap[role].includes(Permission.LOAN_APPROVE),
    );
    expect(new Set(approvers)).toEqual(
      new Set([SystemRole.CREDIT_ANALYST, SystemRole.APPROVER]),
    );
  });

  it('grants Reject to nobody', () => {
    for (const role of Object.values(SystemRole)) {
      expect(RolePermissionsMap[role]).not.toContain(Permission.LOAN_REJECT);
    }
  });

  it('grants Delete Draft only to Super Administrator, and no document rights to it', () => {
    for (const role of Object.values(SystemRole)) {
      const permissions = RolePermissionsMap[role];
      expect(permissions.includes(Permission.LOAN_DELETE_DRAFT)).toBe(
        role === SystemRole.SUPER_ADMINISTRATOR,
      );
    }
    expect(RolePermissionsMap[SystemRole.SUPER_ADMINISTRATOR]).not.toContain(
      Permission.DOC_UPLOAD,
    );
    expect(RolePermissionsMap[SystemRole.SUPER_ADMINISTRATOR]).not.toContain(
      Permission.DOC_DOWNLOAD,
    );
  });

  it('gives Operations User no permissions at all', () => {
    expect(RolePermissionsMap[SystemRole.OPERATIONS_USER]).toHaveLength(0);
  });

  it('is immutable at runtime', () => {
    expect(Object.isFrozen(RolePermissionsMap)).toBe(true);
  });
});
