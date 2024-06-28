import {IsNotEmpty, IsObject} from 'class-validator';
import {ApiProperty} from '@nestjs/swagger';

export class UpdateUserSettingsDto {
    @ApiProperty({required: true})
    @IsNotEmpty()
    @IsObject()
    settings: object;
}
