import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { isUUID } from 'class-validator';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedRequest, IS_PUBLIC } from './auth.decorators';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly jwt: JwtService, private readonly database: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    const match = header?.match(/^Bearer ([^\s]+)$/i);
    if (!match?.[1]) throw new UnauthorizedException('A valid bearer token is required');
    let userId: string;
    try {
      const payload = await this.jwt.verifyAsync<{ sub?: unknown; exp?: unknown }>(match[1]);
      if (typeof payload.sub !== 'string' || !isUUID(payload.sub, '4') || typeof payload.exp !== 'number') {
        throw new Error('Invalid token claims');
      }
      userId = payload.sub;
    } catch {
      throw new UnauthorizedException('A valid bearer token is required');
    }
    const { rows } = await this.database.query<{ id: string }>('SELECT id FROM users WHERE id = $1', [userId]);
    if (!rows[0]) throw new UnauthorizedException('A valid bearer token is required');
    request.user = { id: userId };
    return true;
  }
}
