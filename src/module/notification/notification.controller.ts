import {Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, UseGuards} from '@nestjs/common';
import {ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags} from '@nestjs/swagger';
import {NotificationService} from './notification.service';
import {
    CheckPolicies,
    contructorLogger,
    JwtAuthGuard,
    JwtUser,
    JwtUserInterface,
    PoliciesGuard,
    SchemaPreferencesDto,
    ServiceUserCheckPolicies,
} from '@lib/base-library';
import {UpdateResult} from 'typeorm';
import {notificationPolicies} from '../../policy/policy-consts';
import {NotificationEntity} from '../../model/notification.entity';
import {NotificationResponseDto} from './dto/notificationResponseDto';
import {AutomationsMailDto} from '@lib/automations-library';
import {NotificationsApiEvent} from '@plexxis/notification-api';
import Bull from 'bull';
import {NotificationFiltersAndPaginationDto} from './dto/filters.dto';

@ApiTags('Notification')
@Controller('notification')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class NotificationController {
    constructor(public service: NotificationService) {
        contructorLogger(this);
    }

    @ApiOperation({summary: 'Delete a notifications'})
    @ApiParam({name: 'id', required: true, type: Number, description: 'The notification id you want to delete'})
    @Delete('/:id')
    @CheckPolicies(notificationPolicies.Delete())
    async deleteOne(@Param('id') id: number, @JwtUser() user: JwtUserInterface): Promise<NotificationEntity[]> {
        return await this.service.delete(id, user?.id);
    }

    //We are marking all notifications read
    @ApiOperation({summary: 'Mark a notification as read'})
    @Patch('/readAll')
    @CheckPolicies(notificationPolicies.ReadAll())
    async readAll(@JwtUser() user: JwtUserInterface): Promise<UpdateResult> {
        return await this.service.readAll(user?.id);
    }

    @ApiOperation({summary: 'Mark a notification as read'})
    @ApiParam({name: 'id', required: true, type: Number, description: 'The notification id'})
    @Patch('/read/:id')
    @CheckPolicies(notificationPolicies.Update())
    async read(@Param('id') id: number, @JwtUser() user: JwtUserInterface): Promise<NotificationEntity> {
        return await this.service.read(id, user?.id);
    }

    @ApiOperation({summary: 'Mark a notification as unread'})
    @ApiParam({name: 'id', required: true, type: Number, description: 'The notification id'})
    @Patch('/unread/:id')
    @CheckPolicies(notificationPolicies.Update())
    async unread(@Param('id') id: number, @JwtUser() user: JwtUserInterface): Promise<NotificationEntity> {
        return await this.service.unread(id, user?.id);
    }

    @ApiOperation({summary: 'Get all notifications'})
    @ApiQuery({description: 'NotificationFiltersAndPaginationDto', type: NotificationFiltersAndPaginationDto})
    @Get()
    @CheckPolicies(notificationPolicies.Read())
    async getMany(
        @Query() queryParams: NotificationFiltersAndPaginationDto,
        @JwtUser() user: JwtUserInterface
    ): Promise<NotificationResponseDto> {
        return await this.service.getManyNotification(user.id, queryParams);
    }

    @ApiOperation({summary: 'Mark one notification '})
    @ApiParam({name: 'id', required: true, type: Number, description: 'Update a notification by id'})
    @Patch('/:id')
    @CheckPolicies(notificationPolicies.Read())
    async getOne(@Param('id') id: number, @JwtUser() user: JwtUserInterface): Promise<NotificationEntity> {
        return await this.service.getOneNotification(id, user.id);
    }

    @ApiOperation({summary: 'Set folder notifications preferences'})
    @ApiParam({name: 'folderId', required: true, type: Number, description: 'The folder id'})
    @ApiBody({type: SchemaPreferencesDto, isArray: true})
    @Patch('/schema/folder/:folderId')
    @CheckPolicies(notificationPolicies.Update())
    async setFolderNotificationsPreferences(
        @Param('folderId') folderId: number,
        @Body() schema: SchemaPreferencesDto[],
        @JwtUser() user: JwtUserInterface
    ): Promise<SchemaPreferencesDto[]> {
        return await this.service.setFolderNotificationsPreferences(folderId, schema, user);
    }

    @Get('/schema/folder/:folderId')
    @CheckPolicies(notificationPolicies.Read())
    async getFolderNotificationsPreferences(
        @Param('folderId') folderId: number,
        @JwtUser() user: JwtUserInterface
    ): Promise<SchemaPreferencesDto[]> {
        return await this.service.getFolderNotificationPreferences(folderId, user);
    }

    @ApiOperation({summary: 'Send automation mail'})
    @Post('/automation-mail')
    @ApiBody({type: AutomationsMailDto})
    @ServiceUserCheckPolicies(notificationPolicies.Create())
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async sendAutomationMail(@Request() request: Request, @Body() data: AutomationsMailDto): Promise<Bull.Job<NotificationsApiEvent>> {
        const mappedDto = new AutomationsMailDto();
        Object.assign(mappedDto, request.body);
        return await this.service.sendAutomationEmail(mappedDto);
    }
}
