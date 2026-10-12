import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from './auth.decorators';
import { LoginDto, LoginResponseDto, RegisterDto, UserResponseDto } from './auth.dto';
import { AuthService } from './auth.service';

@Public()
@ApiTags('authentication')
@Throttle({ default: { limit: 10, ttl: 60000 } })
@Controller('v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register an account for the lab' })
  @ApiCreatedResponse({ type: UserResponseDto })
  register(@Body() body: RegisterDto) { return this.auth.register(body); }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sign in and obtain a short-lived bearer token' })
  @ApiOkResponse({ type: LoginResponseDto })
  login(@Body() body: LoginDto) { return this.auth.login(body); }
}
