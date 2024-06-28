import {ApiProperty} from '@nestjs/swagger';
import {FolderActionOptions} from '../../../enum/folder-action.enum';
import {IsArray, IsEnum, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString} from 'class-validator';
import {TaskActionOptions} from '../../../enum/task-action.enum';
import {FolderEventNameOptions, TaskEventNameOptions, UserEventNameOptions} from 'apps/task-management/src/enum/notification-event.enum';

export class NotificationDto {
    @ApiProperty({description: 'Title of the task/folder'})
    @IsString()
    @IsNotEmpty()
    title: string;

    @ApiProperty({description: 'description of folder/task'})
    @IsString()
    @IsOptional()
    description: string;

    @ApiProperty({description: 'subject of email'})
    @IsString()
    @IsNotEmpty()
    emailSubject: string;

    @ApiProperty({description: 'title of email'})
    @IsString()
    @IsNotEmpty()
    emailTitle: string;

    @ApiProperty({description: 'Event'})
    @IsString()
    @IsNotEmpty()
    event: TaskEventNameOptions | FolderEventNameOptions | UserEventNameOptions;

    @ApiProperty({description: 'spaceId'})
    @IsNumber()
    spaceId?: number;

    @ApiProperty({description: 'folderId'})
    @IsNumber()
    folderId?: number;

    @ApiProperty({description: 'taskId'})
    @IsNumber()
    taskId?: number;

    @ApiProperty({description: 'Socket notification message'})
    @IsString()
    message?: string;

    @ApiProperty({description: 'Id of user who performed the action'})
    @IsString()
    userId: string;

    @ApiProperty({description: 'Folder url'})
    @IsString()
    folderUrl?: string;

    @ApiProperty({description: 'Date'})
    @IsString()
    @IsNotEmpty()
    date: string;

    @ApiProperty({description: 'Folder or task action', enum: [FolderActionOptions, TaskActionOptions], enumName: 'action'})
    @IsEnum(FolderActionOptions || TaskActionOptions)
    action: FolderActionOptions | TaskActionOptions;

    @ApiProperty({description: 'folder current state'})
    @IsString()
    @IsNotEmpty()
    state: string;

    @ApiProperty({description: "User that performed the action's name"})
    @IsString()
    @IsNotEmpty()
    userName: string;

    @ApiProperty({description: "User that performed the action's initials"})
    @IsString()
    @IsNotEmpty()
    userInitials: string;

    @ApiProperty({description: 'User profile picture'})
    @IsString()
    @IsNotEmpty()
    userProfilePicture?: string;

    @ApiProperty({description: 'Updated members'})
    @IsObject({each: true})
    @IsOptional()
    members?: {added?: string[]; removed?: string[]};

    @ApiProperty({description: 'Name of folder task is assigned to'})
    @IsString()
    @IsNotEmpty()
    folderName?: string;

    @ApiProperty({description: 'task url'})
    @IsString()
    @IsOptional()
    taskUrl?: string;

    @ApiProperty({description: 'task label'})
    @IsString()
    @IsOptional()
    taskLabel?: string;

    @ApiProperty({description: 'task url'})
    @IsString()
    @IsOptional()
    type?: string;

    @ApiProperty({description: 'task comment'})
    @IsOptional()
    comment?: {content: string; mentioned: boolean};

    @ApiProperty({description: 'Updates'})
    @IsArray()
    @IsObject({each: true})
    @IsOptional()
    updates?: {property: string; oldValue?: string; newValue?: string; message?: string; assignees?: string[]}[];

    @ApiProperty({description: 'task attachments'})
    @IsArray()
    @IsString({each: true})
    @IsOptional()
    attachments?: {fileNameUrl: string; thumbnailUrl: string; fileName: string}[];

    @ApiProperty({description: 'folderId'})
    @IsNumber()
    @IsOptional()
    assigneesLength?: number;

    @ApiProperty({description: 'task assignees'})
    @IsArray()
    @IsOptional()
    assignees?: {name: string; initials: string; color: string}[];
}
