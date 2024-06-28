import {ApiProperty} from '@nestjs/swagger';
import {NotificationEntity} from '../../../../src/model/notification.entity';
import {Transform} from 'class-transformer';
import {IsInt, IsOptional, Max, Min} from 'class-validator';

export type OrderByType = {
    [Key in keyof Omit<NotificationEntity, 'id'>]?: 'ASC' | 'DESC';
};

export class NotificationFiltersAndPaginationDto {
    @ApiProperty({description: 'Pagination limit', minimum: 1, maximum: 1000, default: 100})
    @Transform(({value}) => parseInt(value))
    @IsInt()
    @Max(1000)
    @Min(1)
    limit = 100;

    @ApiProperty({description: 'Pagination offset', minimum: 0, default: 0})
    @Transform(({value}) => parseInt(value))
    @IsInt()
    @Min(0)
    offset = 0;
    @ApiProperty({required: false, type: String, example: '2024-01-21'})
    @IsOptional()
    dateFrom: string;
    @ApiProperty({required: false, type: String, example: '2024-01-24'})
    @IsOptional()
    dateTo: string;
    @ApiProperty({required: false, type: String})
    @Transform(({value}) => parseInt(value))
    @IsOptional()
    spaceId: string;
    @ApiProperty({required: false, type: String})
    @Transform(({value}) => parseInt(value))
    @IsOptional()
    folderId: string;
    @ApiProperty({required: false, type: String})
    @IsOptional()
    userId: string;
    @ApiProperty({required: false, type: String})
    @IsOptional()
    event: string;

    @ApiProperty({required: false, type: String})
    @Transform(({value}) => JSON.parse(value))
    @IsOptional()
    orderBy: OrderByType;
}
