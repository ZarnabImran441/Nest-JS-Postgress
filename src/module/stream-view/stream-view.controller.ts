import {Controller, DefaultValuePipe, Get, Param, ParseIntPipe, Query, UseGuards} from '@nestjs/common';
import {ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags} from '@nestjs/swagger';
import {StreamViewService} from './stream-view.service';
import {CheckPolicies, contructorLogger, JwtAuthGuard, JwtUser, JwtUserInterface, PoliciesGuard} from '@lib/base-library';
import {StreamViewResponseDto} from '../../dto/stream-view/stream-view-response.dto';
import {folderPolicies} from '../../policy/policy-consts';
import {StreamFilterOptions} from '../../enum/stream-filter-type.enum';

/**
 * @classdesc Represents a Stream View Controller.
 * @class
 * @ApiTags('Stream View')
 * @Controller('stream-view')
 * @UseGuards(JwtAuthGuard, PoliciesGuard)
 */
@ApiTags('Stream View')
@Controller('stream-view')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class StreamViewController {
    constructor(public service: StreamViewService) {
        contructorLogger(this);
    }

    /**
     * Get stream view for a specific folder
     *
     * @param {number} folderId - Folder id to stream
     * @param {JwtUserInterface} user - User object from JWT token
     * @param {number} [pageSize] - Number of items to display per page (optional)
     * @param {number} [pageNumber] - Page number to retrieve (optional)
     * @param {StreamFilterOptions} [filter] - Optional filter options for the stream
     *
     * @returns {Promise<StreamViewResponseDto>} - Paginated folder stream
     */
    @Get('/folder/:folderId')
    @ApiOperation({summary: 'Get stream view for a specific folder'})
    @ApiOkResponse({type: StreamViewResponseDto, description: 'Paginated folder stream'})
    @ApiParam({name: 'folderId', required: true, description: 'Folder id to stream'})
    @ApiQuery({name: 'pageSize', required: false})
    @ApiQuery({name: 'pageNumber', required: false})
    @ApiQuery({name: 'filter', required: false})
    @CheckPolicies(folderPolicies.OwnerFullEditorReadOnlyFolderSpace('params.folderId'))
    async getStreamViewByFolderId(
        @Param('folderId', ParseIntPipe) folderId: number,
        @JwtUser() user: JwtUserInterface,
        @Query('pageSize', new DefaultValuePipe(30), ParseIntPipe) pageSize?: number,
        @Query('pageNumber', new DefaultValuePipe(1), ParseIntPipe) pageNumber?: number,
        @Query('filter') filter?: StreamFilterOptions
    ): Promise<StreamViewResponseDto> {
        return await this.service.getStreamByFolderId(folderId, user.id, pageSize, pageNumber, filter);
    }

    /**
     * Retrieves the stream view for a specific task.
     *
     * @param {number} taskId - The ID of the task to stream.
     * @param {number} [pageSize] - The number of items per page (optional).
     * @param {number} [pageNumber] - The page number (optional).
     * @returns {Promise<StreamViewResponseDto>} - A promise that resolves to the paginated task stream.
     */
    @Get('folder/:folderId/task/:taskId')
    @ApiOperation({summary: 'Get stream view for a specific task'})
    @ApiOkResponse({type: StreamViewResponseDto, description: 'Paginated task stream'})
    @ApiParam({name: 'taskId', description: 'Task id to stream'})
    @ApiParam({name: 'taskId', description: 'Folder Id'})
    @ApiQuery({name: 'pageSize', required: false})
    @ApiQuery({name: 'pageNumber', required: false})
    @CheckPolicies(folderPolicies.OwnerFullEditorReadonly('params.folderId'))
    async getStreamViewByTaskId(
        @Param('taskId', ParseIntPipe) taskId: number,
        @Query('pageSize', new DefaultValuePipe(40), ParseIntPipe) pageSize?: number,
        @Query('pageNumber', new DefaultValuePipe(1), ParseIntPipe) pageNumber?: number
    ): Promise<StreamViewResponseDto> {
        return await this.service.getStreamByTaskId(taskId, pageSize, pageNumber);
    }
}
