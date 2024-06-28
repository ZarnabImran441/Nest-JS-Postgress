import {IsInt, Max, Min} from 'class-validator';
import {ApiProperty} from '@nestjs/swagger';

export class PaginationDto {
    @ApiProperty({description: 'Pagination limit', minimum: 1, maximum: 1000, default: 100})
    @IsInt()
    @Max(1000)
    @Min(1)
    limit = 100;

    @ApiProperty({description: 'Pagination offset', minimum: 0, default: 0})
    @IsInt()
    @Min(0)
    offset = 0;
}
