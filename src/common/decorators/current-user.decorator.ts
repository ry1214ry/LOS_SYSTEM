
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { SystemRole } from '../../auth/enums/role.enum.js';


export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: SystemRole;
  jti?: string;
  exp?: number;
}


export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    return data && user ? user[data] : user;
  },
);
