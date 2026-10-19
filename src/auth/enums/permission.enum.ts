// src/auth/enums/permission.enum.ts
/**
 * Every discrete action a role may be granted.
 *
 * The string value is the stable API/storage identifier written to the
 * `permissions.action` column. Never rename a value once it has been seeded —
 * that would silently revoke the permission from every role.
 */
export enum Permission {
  LOAN_VIEW = 'loan:view',
  LOAN_CREATE = 'loan:create',
  LOAN_EDIT = 'loan:edit',
  LOAN_SUBMIT = 'loan:submit',
  LOAN_APPROVE = 'loan:approve',
  LOAN_REJECT = 'loan:reject',
  LOAN_COMMENT = 'loan:comment',
  LOAN_DELETE_DRAFT = 'loan:delete-draft',
  DOC_DOWNLOAD = 'doc:download',
  DOC_UPLOAD = 'doc:upload',
  ASSIGNEE_ADD = 'assignee:add',
  ASSIGNEE_REMOVE = 'assignee:remove',
}
