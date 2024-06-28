import {IsArray, IsBoolean, IsDate, IsOptional, IsString, MaxLength, ValidateNested} from 'class-validator';
import {ApiProperty, ApiPropertyOptional} from '@nestjs/swagger';
import {Type} from 'class-transformer';
import {UserPermissionsGroupEntity} from '../../model/user-permission-groups.entity';

export class UserFilterDto {
    @IsOptional()
    @ApiPropertyOptional({description: 'An array of feature.', isArray: true})
    @IsArray()
    @IsOptional()
    featureFilter: [];

    @ApiPropertyOptional({description: 'A name to search for.', required: false})
    @IsString()
    @IsOptional()
    nameSearchQuery: string;

    @ApiPropertyOptional({
        description: 'Create-date start filter, create-date end filter is also needed.',
        required: false,
        type: 'date',
    })
    @IsDate()
    @IsOptional()
    @Type(() => Date)
    createDateStart: Date;

    @ApiPropertyOptional({
        description: 'Create-date end filter, create-date start filter is also needed.',
        required: false,
        type: 'date',
    })
    @IsDate()
    @IsOptional()
    @Type(() => Date)
    createDateEnd: Date;
}

export class UserPermissonsGroupDto {
    @ApiProperty({description: 'User first name'})
    @MaxLength(64)
    @IsString()
    firstName!: string;

    @ApiProperty({description: 'User is active or not'})
    @IsBoolean()
    isActive: boolean;

    @ApiProperty({description: 'User last name'})
    @IsOptional()
    @IsString()
    @MaxLength(64)
    lastName?: string;

    @ApiProperty({description: 'User email'})
    @IsString()
    @MaxLength(256)
    email!: string;

    @ApiProperty({description: 'User profile picture'})
    @IsOptional()
    @IsArray()
    @Type(() => UserPermissionsGroupEntity)
    @ValidateNested()
    permissionGroups: UserPermissionsGroupEntity[];
}
