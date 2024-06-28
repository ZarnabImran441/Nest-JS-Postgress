import {ApiProperty} from '@nestjs/swagger';
import {NotificationEntity} from '../../../model/notification.entity';
import {Type} from 'class-transformer';
import {IsArray, IsNotEmpty, IsNumber, ValidateNested} from 'class-validator';
import {FolderEntity} from 'apps/task-management/src/model/folder.entity';

export class NotificationResponseDto {
    @ApiProperty({description: 'List of notifications'})
    @IsNotEmpty()
    @IsArray()
    @ValidateNested({each: true})
    @Type(() => NotificationEntity)
    data!: (NotificationEntity & {space?: Pick<FolderEntity, 'id' | 'title'>})[];

    @ApiProperty({description: 'Total number of notifications'})
    @IsNotEmpty()
    @IsNumber()
    total!: number;

    @ApiProperty({description: 'Page number of notifications list'})
    @IsNotEmpty()
    @IsNumber()
    page!: number;

    @ApiProperty({description: 'Page Count  of notifications list'})
    @IsNotEmpty()
    @IsNumber()
    pageCount!: number;
}
