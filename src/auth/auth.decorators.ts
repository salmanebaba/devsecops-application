import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Request } from 'express';

export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);
export interface AuthenticatedRequest extends Request { user: { id: string } }
export const CurrentUserId = createParamDecorator((_data: unknown, context: ExecutionContext): string =>
  context.switchToHttp().getRequest<AuthenticatedRequest>().user.id);
