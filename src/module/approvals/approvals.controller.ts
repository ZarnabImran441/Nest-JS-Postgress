import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseIntPipe,
    Post,
    Put,
    Query,
    UploadedFile,
    UploadedFiles,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import {ApiBearerAuth, ApiBody, ApiConsumes, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags} from '@nestjs/swagger';
import {CheckPolicies, contructorLogger, JwtAuthGuard, JwtUser, JwtUserInterface, PoliciesGuard} from '@lib/base-library';
import {ApprovalsService} from './approvals.service';
import {AddApprovalToTaskDto, CreateApprovalDto} from '../../dto/approval/create-approval.dto';
import {FileInterceptor, FilesInterceptor} from '@nestjs/platform-express';
import {FilesUploadDto, FileUploadDto} from '../../dto/folder/folder/file-upload.dto';
import {ApprovalAttachmentEntity} from '../../model/approval-attachment.entity';
import {ApprovalEntity} from '../../model/approval.entity';
import {ApprovalStatusOptions} from '../../enum/approval-status.enum';
import {CommentApprovalDto} from '../../dto/approval/comment-approval.dto';
import {approvalPolicies, folderPolicies} from '../../policy/policy-consts';
import {ApprovalActionEntity} from '../../model/approval-action.entity';
import {ApprovalActionResponseDto} from '../../dto/approval/action-response.dto';
import {RouteToUsersDto} from '../../dto/approval/route-to-users.dto';
import {UpdateApprovalDto} from '../../dto/approval/update-approval.dto';
import {ApprovalEntityResponseDto} from '../../dto/approval/approval-entity-response.dto';

/**
 * Controller for handling approval-related operations
 * @class
 * @@ApiBearerAuth()
 * @ApiTags('Approvals')
 * @Controller('approvals')
 * @UseGuards(JwtAuthGuard, PoliciesGuard)
 */
@ApiBearerAuth()
@ApiTags('Approvals')
@Controller('approvals')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class ApprovalsController {
    constructor(public service: ApprovalsService) {
        contructorLogger(this);
    }

    /**
     * Creates an approval request along with a task and a task attachment if needed.
     *
     * @param {CreateApprovalDto} body - The request body containing the information needed to create an approval
     * @param {JwtUserInterface} user - The user requesting the creation of the approval
     * @param {Array<Express.Multer.File>} files - An array of files uploaded with the request
     *
     * @returns {Promise<ApprovalEntity>} A Promise that resolves to the created ApprovalEntity
     */
    @Post('folder/:folderId')
    @ApiConsumes('multipart/form-data')
    @ApiOperation({summary: 'Create Approval Request'})
    @ApiOkResponse({
        status: 200,
        description: 'Creates an approval, along with a task and a task attachment if needed',
        type: ApprovalEntityResponseDto,
    })
    @CheckPolicies(approvalPolicies.Create(), folderPolicies.OwnerFullEditor('params.folderId'))
    @UseInterceptors(FilesInterceptor('files'))
    async createApprovalAndTask(
        @Body() body: CreateApprovalDto,
        @JwtUser() user: JwtUserInterface,
        @UploadedFiles() files: Array<Express.Multer.File>
    ): Promise<ApprovalEntity> {
        return await this.service.createApprovalAndTask(body, user, files);
    }

    /**
     * Add approval to task.
     *
     * @param {number} taskId - The ID of the task.
     * @param {AddApprovalToTaskDto} body - The data containing the approval details.
     * @param {JwtUserInterface} user - The user performing the action.
     * @param {Array<Express.Multer.File>} files - The files attached to the approval.
     * @return {Promise<ApprovalEntity>} A promise that resolves with the added approval entity.
     */
    @Post('/task/:taskId/folder/:folderId')
    @ApiConsumes('multipart/form-data')
    @ApiOperation({summary: 'Add Approval to task'})
    @ApiOkResponse({
        status: 200,
        description: 'Adds an approval to a task',
        type: ApprovalEntityResponseDto,
    })
    //** Acc to the new permissions changed an owner, full and editor of the folder can add approvals */
    @CheckPolicies(folderPolicies.OwnerFullEditor('params.folderId'), approvalPolicies.Create())
    @UseInterceptors(FilesInterceptor('files'))
    async addApprovalToTask(
        @Param('taskId', ParseIntPipe) taskId: number,
        @Body() body: AddApprovalToTaskDto,
        @JwtUser() user: JwtUserInterface,
        @UploadedFiles() files: Array<Express.Multer.File>
    ): Promise<ApprovalEntity> {
        return await this.service.addAprovalToTask(body, taskId, user, files);
    }

    /**
     * Updates the attachments of an approval.
     * @param {Array<Express.Multer.File>} files - List of attachments to be uploaded.
     * @param {number} approvalId - The ID of the approval.
     * @returns {Promise<ApprovalAttachmentEntity[]>} - Promise representing the updated approval attachments.
     */
    @Post('upload/:approvalId')
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        description: 'List of attachments',
        type: FilesUploadDto,
    })
    @ApiParam({name: 'approvalId', type: Number})
    @UseInterceptors(FilesInterceptor('files'))
    @CheckPolicies(approvalPolicies.Update())
    async updateApprovalAttachments(
        @UploadedFiles() files: Array<Express.Multer.File>,
        @Param('approvalId', ParseIntPipe) approvalId: number,
        @JwtUser() user: JwtUserInterface
    ): Promise<ApprovalAttachmentEntity[]> {
        return await this.service.uploadApprovalFiles(files, approvalId, user.id);
    }

    /**
     * Update approval attachment.
     *
     * @param {Express.Multer.File} file - Attachment file.
     * @param {number} attachmentId - Attachment ID.
     * @return {Promise<ApprovalAttachmentEntity>} - Updated approval attachment.
     */
    @Post('update/:attachmentId')
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        description: 'Attachment file',
        type: FileUploadDto,
    })
    @ApiParam({name: 'attachmentId', type: Number})
    @UseInterceptors(FileInterceptor('file'))
    @CheckPolicies(approvalPolicies.Update())
    async updateApprovalAttachment(
        @UploadedFile() file: Express.Multer.File,
        @Param('attachmentId', ParseIntPipe) attachmentId: number,
        @JwtUser() user: JwtUserInterface
    ): Promise<ApprovalAttachmentEntity> {
        return await this.service.updateApprovalAttachmentFile(file, attachmentId, user.id);
    }

    /**
     * Retrieves approvals based on the given task ID.
     *
     * @param {number} taskId - The ID of the task.
     * @param {JwtUserInterface} user - The user object obtained from the JWT token.
     * @param {ApprovalStatusOptions} [status] - The status of the approvals (optional).
     * @returns {Promise<ApprovalEntity[]>} - A promise that resolves to an array of ApprovalEntity objects.
     */
    @Get('folder/:folderId/task/:taskId')
    @ApiParam({name: 'taskId', type: Number})
    @ApiParam({name: 'folderId', type: Number})
    @ApiQuery({name: 'status', enum: ApprovalStatusOptions, required: false})
    @ApiOkResponse({
        status: 200,
        description: 'Get approvals by task id',
        type: ApprovalEntityResponseDto,
        isArray: true,
    })
    @CheckPolicies(folderPolicies.OwnerFullEditor('params.folderId'), approvalPolicies.Read())
    async getApprovalsByTaskId(
        @Param('taskId', ParseIntPipe) taskId: number,
        @JwtUser() user: JwtUserInterface,
        @Query('status') status?: ApprovalStatusOptions
    ): Promise<ApprovalEntity[]> {
        return await this.service.getApprovalsByTaskId(taskId, user, status ?? null);
    }

    /**
     * Retrieves the approvals created by a user.
     *
     * @param {JwtUserInterface} user - The user who created the approvals.
     * @returns {Promise<ApprovalEntity[]>} - A promise that resolves to an array of ApprovalEntity objects.
     *
     * @example
     * // Usage
     * const user = {
     *   id: '1234',
     *   // other user properties
     * };
     * const approvals = await getApprovalsCreatedByUser(user);
     *
     * @api {GET} /user
     * @apiDescription Retrieves the approvals created by the user.
     * @apiSuccess (200) {ApprovalEntity[]} - An array of ApprovalEntity objects.
     * @apiUse ApprovalEntityResponseDto
     * @apiExample {curl} Example usage:
     *    curl -X GET /user
     *    -H "Authorization: Bearer <jwt-token>"
     */
    @Get('user')
    @ApiOkResponse({
        status: 200,
        description: 'Get approvals created by user',
        type: ApprovalEntityResponseDto,
        isArray: true,
    })
    @CheckPolicies(approvalPolicies.Read())
    async getApprovalsCreatedByUser(@JwtUser() user: JwtUserInterface): Promise<ApprovalEntity[]> {
        return await this.service.getApprovalsCreatedByUser(user.id);
    }

    /**
     * Retrieves the approvals assigned to the logged-in user, optionally filtered by status.
     *
     * @param {JwtUserInterface} user - The logged-in user.
     * @param {ApprovalStatusOptions} [status] - The status of the approvals to filter. Optional.
     *
     * @returns {Promise<ApprovalEntity[]>} The approvals assigned to the user.
     */
    @Get('assigned')
    @ApiOkResponse({
        status: 200,
        description: 'Get approvals assigned to the logged user, additionally with status',
        type: ApprovalEntityResponseDto,
        isArray: true,
    })
    @ApiQuery({name: 'status', enum: ApprovalStatusOptions, required: false})
    @CheckPolicies(approvalPolicies.Read())
    async getApprovalsAssignedToUser(
        @JwtUser() user: JwtUserInterface,
        @Query('status') status?: ApprovalStatusOptions
    ): Promise<ApprovalEntity[]> {
        return await this.service.getApprovalsAssignedToUser(user.id, status ?? null);
    }

    /**
     * Approves an approval.
     *
     * @param {number} approvalId - The ID of the approval to be approved.
     * @param {CommentApprovalDto} dto - The data required to approve the approval.
     * @param {JwtUserInterface} user - The user who is approving the approval.
     *
     * @returns {Promise<ApprovalActionResponseDto>} - A promise that resolves to the result of the approval action.
     */
    @Post('approve/:approvalId')
    @ApiBody({type: CommentApprovalDto, required: true})
    @ApiParam({name: 'approvalId', type: Number})
    @ApiOkResponse({
        status: 200,
        description: 'Approves an approval',
        type: ApprovalActionResponseDto,
    })
    @CheckPolicies(approvalPolicies.Update())
    async approve(
        @Param('approvalId', ParseIntPipe) approvalId: number,
        @Body() dto: CommentApprovalDto,
        @JwtUser() user: JwtUserInterface
    ): Promise<ApprovalActionResponseDto> {
        return await this.service.approve(approvalId, dto, user);
    }

    /**
     * Rejects an approval.
     *
     * @param {number} approvalId - The ID of the approval.
     * @param {CommentApprovalDto} dto - The comment approval data.
     * @param {JwtUserInterface} user - The JWT user object.
     * @returns {Promise<ApprovalActionResponseDto>} - The response of the approval action.
     */
    @Post('reject/:approvalId')
    @ApiBody({type: CommentApprovalDto, required: true})
    @ApiParam({name: 'approvalId', type: Number})
    @ApiOkResponse({
        status: 200,
        description: 'Rejects an approval',
        type: ApprovalActionResponseDto,
    })
    @CheckPolicies(approvalPolicies.Update())
    async reject(
        @Param('approvalId', ParseIntPipe) approvalId: number,
        @Body() dto: CommentApprovalDto,
        @JwtUser() user: JwtUserInterface
    ): Promise<ApprovalActionResponseDto> {
        return await this.service.reject(approvalId, dto, user);
    }

    /**
     * Route an approval to users.
     *
     * @param approvalId - The ID of the approval to be routed.
     * @param dto - The data for routing the approval to users.
     * @param user - The authenticated user.
     * @returns A promise that resolves to an ApprovalActionResponseDto.
     */
    @Post('redirect/:approvalId')
    @ApiBody({type: RouteToUsersDto, required: true})
    @ApiParam({name: 'approvalId', type: Number})
    @ApiOkResponse({
        status: 200,
        description: 'Redirects an approval',
        type: ApprovalActionResponseDto,
    })
    @CheckPolicies(approvalPolicies.Update())
    async routeToUsers(
        @Param('approvalId', ParseIntPipe) approvalId: number,
        @Body() dto: RouteToUsersDto,
        @JwtUser() user: JwtUserInterface
    ): Promise<ApprovalActionResponseDto> {
        return await this.service.routeToUsers(approvalId, dto, user);
    }

    /**
     * Cancels an approval.
     *
     * @param {number} approvalId - The ID of the approval to cancel.
     * @param {JwtUserInterface} user - The user object containing the JWT token details.
     * @returns {Promise<ApprovalActionResponseDto>} - A Promise that resolves to the ApprovalActionResponseDto.
     */
    @Put('cancel/:approvalId')
    @ApiParam({name: 'approvalId', type: Number})
    @ApiOkResponse({
        status: 200,
        description: 'Cancels an approval',
        type: ApprovalActionResponseDto,
    })
    @CheckPolicies(approvalPolicies.Update())
    async cancelApproval(
        @Param('approvalId', ParseIntPipe) approvalId: number,
        @JwtUser() user: JwtUserInterface
    ): Promise<ApprovalActionResponseDto> {
        return await this.service.cancelApproval(approvalId, user);
    }

    /**
     * Retrieves the approval history for a given approval ID.
     *
     * @param {number} approvalId - The ID of the approval.
     * @returns {Promise<ApprovalActionEntity[]>} - A promise that resolves to an array of ApprovalActionEntity objects representing the approval history.
     */
    @Get('history/:approvalId')
    @ApiOkResponse({
        status: 200,
        description: 'Get approval history',
        type: ApprovalActionEntity,
        isArray: true,
    })
    @ApiParam({name: 'approvalId', type: Number})
    @CheckPolicies(approvalPolicies.Read())
    async getApprovalHistory(@Param('approvalId', ParseIntPipe) approvalId: number): Promise<ApprovalActionEntity[]> {
        return await this.service.getApprovalHistory(approvalId);
    }

    /**
     * Update an approval.
     *
     * @param {number} approvalId - The ID of the approval being updated.
     * @param {UpdateApprovalDto} dto - The updated approval data.
     * @param {JwtUserInterface} user - The authenticated user.
     *
     * @returns {Promise<ApprovalEntity>} - The updated approval entity.
     */
    @Put(':approvalId')
    @ApiParam({name: 'approvalId', type: Number})
    @ApiBody({type: UpdateApprovalDto, required: true})
    @ApiOkResponse({
        status: 200,
        description: 'Update an approval',
        type: ApprovalEntityResponseDto,
    })
    @CheckPolicies(approvalPolicies.Update())
    async updateApproval(
        @Param('approvalId', ParseIntPipe) approvalId: number,
        @Body() dto: UpdateApprovalDto,
        @JwtUser() user: JwtUserInterface
    ): Promise<ApprovalEntity> {
        return await this.service.update(approvalId, dto, user);
    }

    /**
     * Deletes an approval by approvalId.
     *
     * @param {number} approvalId - The ID of the approval to be deleted.
     * @param {JwtUserInterface} user - The user object obtained from JWT token.
     *
     * @returns {Promise<void>} - A promise that resolves to void.
     */
    @Delete(':approvalId')
    @ApiParam({name: 'approvalId', type: Number})
    @ApiOkResponse({
        status: 200,
        description: 'Delete an approval',
    })
    @CheckPolicies(approvalPolicies.Delete())
    async deleteApproval(@Param('approvalId', ParseIntPipe) approvalId: number, @JwtUser() user: JwtUserInterface): Promise<void> {
        return await this.service.delete(approvalId, user);
    }
}
