import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { APP_CONFIG, AppConfig } from '../config/config';
import { DatabaseService } from '../database/database.service';
import { LoginDto, LoginResponseDto, RegisterDto, UserResponseDto } from './auth.dto';
import { hashPassword, verifyPassword } from './password';

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  created_at: Date;
}

function publicUser(user: UserRow): UserResponseDto {
  return { id: user.id, email: user.email, createdAt: user.created_at.toISOString() };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly database: DatabaseService,
    private readonly jwt: JwtService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async register(dto: RegisterDto): Promise<UserResponseDto> {
    const hash = await hashPassword(dto.password);
    try {
      const { rows } = await this.database.query<UserRow>(
        'INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3) RETURNING id, email, created_at',
        [randomUUID(), dto.email, hash],
      );
      return publicUser(rows[0]!);
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
        throw new ConflictException('Email already registered');
      }
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const { rows } = await this.database.query<UserRow>('SELECT id, email, password_hash, created_at FROM users WHERE email = $1', [dto.email]);
    const user = rows[0];
    const valid = await verifyPassword(dto.password, user?.password_hash ?? null);
    if (!user || !valid) throw new UnauthorizedException('Invalid email or password');
    return {
      access_token: await this.jwt.signAsync({ sub: user.id }),
      token_type: 'Bearer',
      expires_in: this.config.jwtTtlSeconds,
      user: publicUser(user),
    };
  }
}
