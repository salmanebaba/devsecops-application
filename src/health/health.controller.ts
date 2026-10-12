import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { DatabaseService } from '../database/database.service';
import { Public } from '../auth/auth.decorators';

@ApiTags('health')
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly database: DatabaseService) {}

  @Get('live')
  @ApiOperation({ summary: 'Process liveness' })
  live() { return { status: 'ok' }; }

  @Get('ready')
  @ApiOperation({ summary: 'Database connectivity and migration readiness' })
  @ApiResponse({ status: 503, description: 'Database unavailable or migrations out of date' })
  async ready() {
    if (!(await this.database.isReady())) throw new ServiceUnavailableException('Database is not ready');
    return { status: 'ok', database: 'ready' };
  }
}
