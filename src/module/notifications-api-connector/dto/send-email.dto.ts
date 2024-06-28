import {Type} from 'class-transformer';
import {IsArray, IsNotEmpty, IsOptional, IsString} from 'class-validator';
import {ApiProperty} from '@nestjs/swagger';

export class SendEmailDto {
    @ApiProperty({description: 'HTML for email'})
    @IsString()
    @IsNotEmpty()
    template: string;

    @ApiProperty({description: 'title of email'})
    @IsString()
    @IsOptional()
    subject: string;

    @ApiProperty({description: 'List of email recipients'})
    @IsArray()
    @IsString({each: true})
    @Type(() => String)
    @IsNotEmpty()
    recipients: string[];

    @ApiProperty({description: 'name of sender'})
    @IsString()
    @IsNotEmpty()
    senderName: string;
}
