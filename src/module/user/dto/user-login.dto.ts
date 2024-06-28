import {IsEmail, IsNotEmpty} from 'class-validator';
import {ApiPropertyOptional} from '@nestjs/swagger';

export class UserLoginDto {
    @ApiPropertyOptional({description: 'User email'})
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiPropertyOptional({description: 'User password'})
    @IsNotEmpty()
    password: string;
}
