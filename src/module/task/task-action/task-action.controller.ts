import {Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards} from '@nestjs/common';
import {ApiBody, ApiOperation, ApiParam, ApiTags} from '@nestjs/swagger';
import {TaskActionService} from './task-action.service';
import {
    CheckPolicies,
    contructorLogger,
    JwtAuthGuard,
    JwtUser,
    JwtUserInterface,
    PoliciesGuard,
    ServiceUserCheckPolicies,
} from '@lib/base-library';
import {InsertResult, UpdateResult} from 'typeorm';
import {CreateTaskActionDto} from '../../../dto/task/task-action/create-task-action.dto';
import {folderPolicies} from '../../../policy/policy-consts';
import {UpdateTaskActionDto} from '../../../dto/task/task-action/update-task-action.dto';
import {TaskActionEntity} from '../../../model/task-action.entity';

@ApiTags('Task Action')
@Controller('task-action')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class TaskActionController {
    constructor(public service: TaskActionService) {
        contructorLogger(this);
    }

    //Update routes on UI that should match these routes

    //UPDATE|OWNER and task action create policy
    @ApiOperation({summary: 'Add a comment to a task'})
    @ApiBody({type: CreateTaskActionDto, description: 'A comment'})
    @ApiParam({name: 'task_id', type: Number, description: 'Task id comment is added in'})
    @ApiParam({name: 'folderId', type: Number, description: 'Folder id'})
    @Post('folder/:folderId/task/:task_id/comment')
    @ServiceUserCheckPolicies(folderPolicies.OwnerFullEditor('params.task_id'))
    async comment(
        @Param('task_id', ParseIntPipe) taskId: number,
        @Body() dto: CreateTaskActionDto,
        @JwtUser() user: JwtUserInterface
    ): Promise<InsertResult> {
        return await this.service.addComment(dto, taskId, user);
    }

    @ApiOperation({summary: 'Update a comment of a task'})
    @ApiBody({type: UpdateTaskActionDto, description: 'A comment'})
    @ApiParam({name: 'comment_id', type: Number, description: 'Task action id'})
    @Patch('folder/:folderId/task/:task_id/comment/:comment_id')
    @CheckPolicies(folderPolicies.OwnerFullEditor('params.folderId'))
    async UpdateComment(
        @Param('comment_id', ParseIntPipe) commentId: number,
        @Body() dto: UpdateTaskActionDto,
        @JwtUser() user: JwtUserInterface
    ): Promise<UpdateResult> {
        return await this.service.updateComment(commentId, dto, user.id);
    }

    @ApiOperation({summary: 'Get task actions of a task'})
    @ApiBody({type: CreateTaskActionDto, description: 'Task actions'})
    @ApiParam({name: 'task_id', type: Number, description: 'Task id'})
    @Get('folder/:folderId/task/:task_id')
    @CheckPolicies(folderPolicies.OwnerFullEditorReadonly('params.folderId'))
    async getActionsByTask(@Param('task_id', ParseIntPipe) taskId: number): Promise<TaskActionEntity[]> {
        return await this.service.getActionsByTaskId(taskId);
    }

    @ApiOperation({summary: 'Delete comment from a task'})
    @ApiParam({name: 'comment_id', type: Number, description: 'Comment id'})
    @Delete('folder/:folderId/task/:task_id/comment/:comment_id')
    @CheckPolicies(folderPolicies.OwnerFullEditor('params.folderId'))
    async deleteComment(
        @Param('comment_id', ParseIntPipe) commentId: number,
        @Param('task_id', ParseIntPipe) taskId: number,
        @JwtUser() user: JwtUserInterface
    ): Promise<unknown> {
        return await this.service.deleteComment(commentId, taskId, user);
    }
}
