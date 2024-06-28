import {ApiProperty} from '@nestjs/swagger';
import {IsBoolean, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength} from 'class-validator';

export class CreateUserDto {
    @ApiProperty({description: 'User Password', isArray: true})
    @IsNotEmpty()
    password!: string;

    @ApiProperty({description: 'User first name'})
    @MaxLength(64)
    @IsString()
    firstName!: string;

    @ApiProperty({description: 'User last name'})
    @MaxLength(64)
    @IsString()
    lastName!: string;

    @ApiProperty({description: 'User is active or not'})
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;

    @ApiProperty({description: 'User email'})
    @IsNotEmpty()
    @IsString()
    @MaxLength(256)
    email!: string;

    @ApiProperty({description: 'User avatar color'})
    @IsOptional()
    @IsString()
    @MaxLength(64)
    color?: string;

    @ApiProperty({description: 'User settings'})
    @IsOptional()
    @IsObject()
    settings?: object;

    @ApiProperty({description: 'User profile picture'})
    @IsOptional()
    @IsString()
    profileImage?: string;
}

export class CreatePasUserDto extends CreateUserDto {}
