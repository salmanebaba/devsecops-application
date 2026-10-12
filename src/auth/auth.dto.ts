import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ format: 'email', maxLength: 254 })
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().normalize('NFC').toLowerCase() : value)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ minLength: 1, maxLength: 128, format: 'password' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}

export class RegisterDto extends LoginDto {
  @ApiProperty({ minLength: 12, maxLength: 128, format: 'password' })
  @MinLength(12)
  declare password: string;
}

export class UserResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'email' }) email!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}

export class LoginResponseDto {
  @ApiProperty() access_token!: string;
  @ApiProperty({ enum: ['Bearer'] }) token_type!: string;
  @ApiProperty({ description: 'Token lifetime in seconds' }) expires_in!: number;
  @ApiProperty({ type: UserResponseDto }) user!: UserResponseDto;
}
