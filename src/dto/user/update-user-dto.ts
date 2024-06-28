import {ApiProperty} from '@nestjs/swagger';
import {IsBoolean, IsOptional, IsString, MaxLength} from 'class-validator';

export class UpdateUserDto {
    //** We should create a new endpoint for password discuss with Julio */
    @ApiProperty({description: 'User Password'})
    @IsOptional()
    password?: string;

    @ApiProperty({description: 'User first name'})
    @MaxLength(64)
    @IsString()
    @IsOptional()
    firstName?: string;

    @ApiProperty({description: 'User is active or not'})
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;

    @ApiProperty({description: 'User last name'})
    @IsOptional()
    @IsString()
    @MaxLength(64)
    lastName?: string;

    @ApiProperty({description: 'User avatar color'})
    @IsOptional()
    @IsString()
    @MaxLength(64)
    color?: string;

    @ApiProperty({description: 'User profile picture'})
    @IsOptional()
    @IsString()
    profileImage?: string;
}

export class UpdatePasUserDto extends UpdateUserDto {}
