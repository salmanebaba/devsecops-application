import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { APP_CONFIG, AppConfig, JWT_AUDIENCE, JWT_ISSUER } from '../config/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Module({
  imports: [JwtModule.registerAsync({
    inject: [APP_CONFIG],
    useFactory: (config: AppConfig) => ({
      secret: config.jwtSecret,
      signOptions: { algorithm: 'HS256', expiresIn: config.jwtTtlSeconds, issuer: JWT_ISSUER, audience: JWT_AUDIENCE },
      verifyOptions: { algorithms: ['HS256'], issuer: JWT_ISSUER, audience: JWT_AUDIENCE },
    }),
  })],
  controllers: [AuthController],
  providers: [AuthService, { provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AuthModule {}
