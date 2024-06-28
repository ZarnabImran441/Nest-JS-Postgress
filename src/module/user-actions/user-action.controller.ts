import {Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, UseGuards} from '@nestjs/common';

import {UserActionService} from './user-action.service';
import {ApiOkResponse, ApiOperation, ApiParam, ApiTags} from '@nestjs/swagger';
import {CheckPolicies, contructorLogger, JwtAuthGuard, JwtUser, PoliciesGuard} from '@lib/base-library';

import {UserActionEntity} from '../../model/user-action.entity';
import {folderPolicies} from '../../policy/policy-consts';
import {UserEntity} from '../../model/user.entity';

@ApiTags('User actions')
@UseGuards(JwtAuthGuard, PoliciesGuard)
@Controller('user-actions')
export class UserActionController {
    constructor(private readonly userActionService: UserActionService) {
        contructorLogger(this);
    }

    @ApiOperation({summary: 'Get all user actions for a task'})
    @ApiOkResponse({type: UserActionEntity, isArray: true})
    @Get('folder/:folderId/task/:taskId')
    @ApiParam({name: 'taskId', description: 'Task id to get user actions for'})
    //** Need folder here to validate the task by folder id */
    @CheckPolicies(folderPolicies.OwnerFullEditorReadonly('params.folderId'))
    async findAllByTaskId(@Param('taskId', ParseIntPipe) taskId: number): Promise<UserActionEntity[]> {
        return await this.userActionService.findAllByTaskId(taskId);
    }

    @ApiOperation({summary: 'Create a user action for a task'})
    @ApiParam({name: 'taskId', description: 'Task id to create user action for'})
    @ApiParam({name: 'folderId', description: 'Folder Id'})
    @ApiOkResponse({type: UserActionEntity})
    @Post('folder/:folderId/task/:taskId')
    @CheckPolicies(folderPolicies.OwnerFullEditor('params.folderId'))
    async create(
        @Param('taskId', ParseIntPipe) taskId: number,
        @Body('description') description: string,
        @JwtUser() user: UserEntity
    ): Promise<UserActionEntity> {
        return await this.userActionService.create(taskId, description, user.id);
    }

    @ApiOperation({summary: 'Update a user action'})
    @ApiOkResponse({type: UserActionEntity})
    @ApiParam({name: 'folderId', description: 'Folder Id'})
    @Put('folder/:folderId/task/:taskId/action/:id')
    @CheckPolicies(folderPolicies.OwnerFullEditor('params.folderId'))
    async update(@Param('id', ParseIntPipe) id: number, @Body('description') description: string): Promise<UserActionEntity | undefined> {
        return await this.userActionService.update(id, description);
    }

    @ApiOperation({summary: 'Delete a user action'})
    @ApiParam({name: 'id', description: 'User action id to delete'})
    @ApiParam({name: 'folderId', description: 'Folder Id'})
    @ApiOkResponse({status: 200})
    @Delete('folder/:folderId/task/:taskId/action/:id')
    @CheckPolicies(folderPolicies.OwnerFullEditor('params.folderId'))
    async delete(@Param('id', ParseIntPipe) id: number): Promise<void> {
        return await this.userActionService.delete(id);
    }

    @ApiOperation({summary: 'Toggle a user action as checked'})
    @ApiParam({name: 'id', description: 'User action id to check or uncheck'})
    @ApiParam({name: 'folderId', description: 'Folder Id'})
    @ApiOkResponse({type: UserActionEntity})
    @Put('folder/:folderId/task/:taskId/check/:id')
    @CheckPolicies(folderPolicies.OwnerFullEditor('params.folderId'))
    async toggleCheck(
        @Param('id', ParseIntPipe) id: number,
        @JwtUser() user: UserEntity,
        @Body('checked') checked: boolean
    ): Promise<UserActionEntity> {
        return await this.userActionService.toggleCheck(id, checked, user.id);
    }
}
