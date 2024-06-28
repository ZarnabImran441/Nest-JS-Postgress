import {CheckPolicies, JwtAuthGuard, JwtUser, JwtUserInterface, PoliciesGuard, contructorLogger} from '@lib/base-library';
import {Controller, Delete, Get, Param, Post, UploadedFiles, UseGuards, UseInterceptors} from '@nestjs/common';
import {FilesInterceptor} from '@nestjs/platform-express';
import {ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiParam, ApiTags} from '@nestjs/swagger';
import {FilesUploadDto} from '../../../dto/folder/folder/file-upload.dto';
import {TaskAttachmentEntity} from '../../../model/task-attachment.entity';
import {folderPolicies} from '../../../policy/policy-consts';
import {TaskAttachmentService} from './task-attachment.service';

@ApiTags('Task Attachment')
@Controller('task-attachment')
@UseGuards(JwtAuthGuard, PoliciesGuard)
@ApiBearerAuth()
export class TaskAttachmentController {
    constructor(public service: TaskAttachmentService) {
        contructorLogger(this);
    }

    // Every endpoint should receive task & folder ID the attachments
    //task read,update and attachments delete
    @ApiOperation({summary: 'delete a single task attachment by id'})
    @Delete('folder/:folderId/:id/task/:task_id')
    @CheckPolicies(folderPolicies.OwnerFullEditor('params.folderId'))
    async deleteTaskAttachment(@Param('id') id: number, @JwtUser() user: JwtUserInterface): Promise<TaskAttachmentEntity> {
        return await this.service.deleteTaskAttachment(id, user.id);
    }

    //TODO : Add return types
    @ApiOperation({summary: 'Add files to task '})
    @ApiConsumes('multipart/form-data')
    @ApiParam({name: 'task_id', required: true, type: 'number', description: "the task's id"})
    @ApiParam({name: 'folderId', required: true, type: 'number', description: "the folder's id"})
    @ApiBody({
        description: 'List of attachments',
        type: FilesUploadDto,
    })
    @Post('upload/:task_id/folder/:folderId')
    @UseInterceptors(FilesInterceptor('files'))
    @CheckPolicies(folderPolicies.OwnerFullEditor('params.folderId'))
    async uploadFiles(
        @Param('task_id') taskId: number,
        @UploadedFiles() files: Array<Express.Multer.File>,
        @JwtUser() user: JwtUserInterface
    ): Promise<unknown> {
        return await this.service.uploadFiles(taskId, files, user);
    }

    //TODO : Add return types
    @ApiOperation({summary: 'Get the attachments of a file'})
    @ApiParam({name: 'task_id', required: true, type: Number, description: 'Task id'})
    @Get('folder/:folderId/task/:task_id')
    @CheckPolicies(folderPolicies.OwnerFullEditorReadonly('params.folderId'))
    async getTaskAttachments(@Param('task_id') taskId: number, @JwtUser() user: JwtUserInterface): Promise<unknown> {
        return await this.service.getManyTaskAttachment(taskId, user);
    }
}
