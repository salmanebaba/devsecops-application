import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { ConfigurationModule } from './config/config';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { TasksModule } from './tasks/tasks.module';

@Module({
  imports: [ConfigurationModule, DatabaseModule, ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]), AuthModule, TasksModule],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
