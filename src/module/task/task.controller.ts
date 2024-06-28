import {AutomationNotificationDetailTaskEventDto} from '@lib/automations-library';
import {
    AuthHeaderDto,
    CheckPolicies,
    JwtAuthGuard,
    JwtUser,
    JwtUserInterface,
    PaginationDto,
    PoliciesGuard,
    ServiceUserCheckPolicies,
    TASK_MANAGEMENT,
    contructorLogger,
} from '@lib/base-library';
import {
    Body,
    Controller,
    Delete,
    Get,
    Headers,
    Param,
    ParseIntPipe,
    ParseUUIDPipe,
    Patch,
    Post,
    Put,
    Query,
    UseGuards,
} from '@nestjs/common';
import {ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags} from '@nestjs/swagger';
import {DeleteResult, UpdateResult} from 'typeorm';
import {ArchiveTaskDto} from '../../dto/task/archive-task.dto';
import {AssignedTasksTotalCountDto, GetAssignedTasksDto} from '../../dto/task/assigned-tasks.dto';
import {CreateDependencyDto} from '../../dto/task/create-predecessor.dto';
import {CreateTaskDto} from '../../dto/task/create-task.dto';
import {DeleteArchiveManyDto} from '../../dto/task/delete-archive-many.dto';
import {ArchivedDeletedFolderTasksResponseDto} from '../../dto/task/get-archived-deleted-task.dto';
import {GetFollowingTaskDto} from '../../dto/task/get-following-task.dto';
import {MoveManyResultDto, MoveManyTasksDto} from '../../dto/task/move-many-tasks.dto';
import {CustomFieldsTaskResponseDto, TaskResponseDto} from '../../dto/task/task-response.dto';
import {TaskSharedDto} from '../../dto/task/task-shared.dto';
import {
    TaskAssigneesDto,
    TaskCustomFieldDto,
    UpdateManyTaskDto,
    UpdateManyTaskPositionDto,
    UpdateTaskDto,
    UpdateTaskPositionDto,
} from '../../dto/task/update-task.dto';
import {TagTaskFolderEntity} from '../../model/tag-task-folder.entity';
import {TaskFollowerEntity} from '../../model/task-follower.entity';
import {TaskRelationEntity} from '../../model/task-relation.entity';
import {TaskEntity} from '../../model/task.entity';
import {customFieldValuePolicies, folderPolicies, purgeFoldersAndTasks, userPolicies} from '../../policy/policy-consts';
import {TaskService} from './task.service';

/**
 * Controller responsible for handling HTTP requests related to tasks.
 * @class
 * @description
 *   It handles all the CRUD operations related to tasks, including creating, updating, deleting, and retrieving tasks.
 *   The controller uses the TaskService to interact with the tasks data.
 *   It is protected with authentication and authorization mechanisms (JwtAuthGuard, PoliciesGuard).
 *   The controller is tagged with 'Task' and the base route is '/task'.
 */
@ApiTags('Task')
@Controller('task')
@UseGuards(JwtAuthGuard, PoliciesGuard)
@ApiBearerAuth()
export class TaskController {
    /**
     * Constructs a new instance of the class.
     *
     * @param {TaskService} service - The TaskService instance to be used.
     */
    constructor(protected readonly service: TaskService) {
        contructorLogger(this);
    }

    //** Anyone with Owner|full|Editor|Read permissions on folder or owner|Read permission on task*/
    /**
     * Fetches a task by task id, as viewed from folder id
     *
     * @param {number} folder_id - The id of the folder
     * @param {number} task_id - The id of the task
     * @param {JwtUserInterface} user - The user making the request
     * @returns {Promise<TaskResponseDto>} - The task response DTO
     */
    @Get('/:task_id/folder/:folder_id')
    @ApiOperation({summary: 'Fetch task by task id, as viewed from folder id'})
    @ApiOkResponse({
        status: 200,
        description: 'Get a task',
        type: TaskResponseDto,
    })
    @ApiParam({name: 'task_id', required: true, type: Number, description: 'Task id'})
    @ApiParam({name: 'folder_id', required: true, type: Number, description: 'Folder id'})
    @CheckPolicies(folderPolicies.OwnerFullEditorReadonly('params.folder_id'))
    getOne(
        @Param('folder_id', ParseIntPipe) folderId: number,
        @Param('task_id', ParseIntPipe)
        taskId: number,
        @JwtUser() user: JwtUserInterface
    ): Promise<TaskResponseDto> {
        return this.service.getOneTask(taskId, user, folderId);
    }

    //** Anyone with Purge permissions can get archived tasks for a folder*/
    /**
     * Fetches archived tasks by folder Id
     *
     * @param {number} folder_id - The id of the folder
     * @param {JwtUserInterface} user - The user making the request
     * @returns {Promise<ArchivedDeletedFolderTasksResponseDto>} - The tasks response DTO
     */
    @Post('folder/:folder_id')
    @ApiOperation({summary: 'Retrieve multiple archived tasks for a folder'})
    @ApiOkResponse({
        status: 200,
        description: 'Get tasks',
        type: ArchivedDeletedFolderTasksResponseDto,
    })
    @ApiParam({name: 'folder_id', required: true, type: Number, description: 'Folder id'})
    @ApiBody({description: 'limit and offset', type: PaginationDto})
    @ApiQuery({
        name: 'show-on',
        required: false,
        type: String,
        description: `Filter folders by show on property. Default value: "${TASK_MANAGEMENT}"`,
    })
    @CheckPolicies(purgeFoldersAndTasks.Update())
    async getManyTasksByFolder(
        @Query('shown-on') showOn: string = TASK_MANAGEMENT,
        @Param('folder_id', ParseIntPipe) folderId: number,
        @Body() dto: PaginationDto
    ): Promise<ArchivedDeletedFolderTasksResponseDto> {
        return await this.service.getTasksByFolder(dto, folderId, showOn);
    }

    /**
     * Fetches tasks with due date in the future, by folder Id
     *
     * @param {number} folder_id - The id of the folder
     * @returns {Promise<AutomationNotificationDetailTaskEventDto[]>} - The tasks notifications for automations
     */

    @ApiOperation({summary: 'Retrieve tasks that are due for a folder'})
    @ApiBody({type: CreateTaskDto})
    @Post('automationstmduetasks')
    @ServiceUserCheckPolicies(folderPolicies.OwnerFullEditor('body.folderId'))
    async getAutomationsTmDueTasksByFolder(
        @Body() dto: {folderId},
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        @JwtUser() user: JwtUserInterface
    ): Promise<AutomationNotificationDetailTaskEventDto[]> {
        return await this.service.getAutomationsTmDueTasksByFolder(dto.folderId);
    }

    // Todo : add return types
    // level 1 : Folder Full , Owner or TASK Owner or assignee
    // TODO : Separate endpoints for update task for owner and assignees
    /**
     * Updates a task by task ID.
     *
     * @param {UpdateTaskDto} dto - The update task data.
     *
     * @param {number} task_id - The ID of the task to be updated.
     *
     * @param {JwtUserInterface} user - The authenticated user.
     *
     * @returns {Promise<unknown>} The result of the update operation.
     */
    @Patch('/:id')
    @ApiOperation({summary: 'Update task by task Id'})
    @ApiParam({name: 'id', required: true, type: Number, description: 'Task id'})
    @ServiceUserCheckPolicies(folderPolicies.OwnerFullEditor('body.folderId'))
    async updateOne(
        @Body() dto: UpdateTaskDto,
        @Param('id', ParseIntPipe) task_id: number,
        @JwtUser() user: JwtUserInterface
    ): Promise<unknown> {
        return await this.service.updateTask(task_id, dto, user);
    }

    //** Only Owner can update a task assignee */
    //** todo :  */
    /**
     * Updates the task assignee by task Id.
     *
     * @param {TaskAssigneesDto} dto - The task assignee DTO containing the updated assignee information.
     * @param {number} taskId - The ID of the task to update the assignee for.
     * @param {JwtUserInterface} user - The authenticated user making the request.
     * @returns {Promise<UpdateResult>} A promise that resolves to the result of the update operation.
     */
    @Patch('assignees/:id')
    @ApiOperation({summary: 'Add/Remove task assignee by task Id'})
    @ApiParam({name: 'id', required: true, type: Number, description: 'Task id'})
    @ServiceUserCheckPolicies(folderPolicies.OwnerFullEditor('body.folderId'))
    async updateTaskAssigneeOne(
        @Body() dto: TaskAssigneesDto,
        @Param('id', ParseIntPipe) taskId: number,
        @JwtUser() user: JwtUserInterface
    ): Promise<UpdateResult> {
        return await this.service.updateTaskAssignees(taskId, dto, user);
    }

    //level 1 :  Folder Read && TASK UPDATE & READ | Owner
    // level 2 : Actions that a owner and assignee can perform will be validated in business logic.
    //** Required folder id in the route  for folder policy *//
    /**
     * Updates multiple tasks.
     *
     * @param {UpdateManyTaskDto} dto - The data transfer object containing the updated task information.
     * @param {JwtUserInterface} user - The user object obtained from the JWT token.
     * @returns {Promise<unknown>} - A promise that resolves with the updated tasks.
     *
     * @api {patch} /many/update Update multiple tasks
     * @summary Update multiple tasks
     * @body {UpdateManyTaskDto} - The updated task information.
     * @checkPolicies ownerPolicies.OwnerFullEditor('body.folderId')
     */
    @Patch('many/update')
    @ApiOperation({summary: 'Update multiple tasks'})
    @ApiBody({type: UpdateManyTaskDto, required: true})
    @CheckPolicies(folderPolicies.OwnerFullEditor('body.folderId'))
    async updateManyTasks(@Body() dto: UpdateManyTaskDto, @JwtUser() user: JwtUserInterface): Promise<unknown> {
        return await this.service.updateManyTasks(dto, user);
    }

    //** Person with FULL|EDITOR|OWNER permissions on folder & Create permission on task */
    /**
     * Creates a new task.
     *
     * @param {CreateTaskDto} dto - The data for creating the task.
     * @param {JwtUserInterface} user - The user who wants to create the task.
     * @returns {Promise<TaskEntity>} - The created task entity.
     */
    @Post()
    @ApiOperation({summary: 'Create a new task'})
    @ApiBody({type: CreateTaskDto})
    @ServiceUserCheckPolicies(folderPolicies.OwnerFullEditor('body.folderId'))
    async createOneTask(@Body() dto: CreateTaskDto, @JwtUser() user: JwtUserInterface): Promise<TaskEntity> {
        return await this.service.createOneTask(dto, user);
    }

    //discuss : route is changed
    /**
     * Deletes a task and all its children.
     *
     * @param {number} task_id - The ID of the task to be deleted.
     * @param {JwtUserInterface} user - The user making the request.
     * @return {Promise<unknown>} - A Promise that resolves to an unknown value.
     */
    @Delete('folder/:folder_id/task/:task_id')
    @ApiOperation({summary: 'Permanent Delete a task and all its children'})
    @ApiParam({name: 'task_id', required: true, type: Number, description: 'Task id'})
    @ApiParam({name: 'folder_id', required: true, type: Number, description: 'Folder id'})
    @CheckPolicies(purgeFoldersAndTasks.Delete())
    async deleteTree(@Param('task_id', ParseIntPipe) task_id: number, @JwtUser() user: JwtUserInterface): Promise<unknown> {
        return await this.service.permanentDeleteTask(task_id, user.id);
    }

    /**
     * Deletes many tasks and all their children
     *
     * @param {number[]} tasks - An array of task ids to be deleted
     * @param {JwtUserInterface} user - The user object from the JWT token
     *
     * @returns {Promise<unknown>} - A promise that resolves to an unknown value
     */
    @Post('folder/:folder_id/delete-many')
    @ApiOperation({summary: 'Deletes many tasks and all their children'})
    @ApiParam({name: 'folder_id', required: true, type: DeleteArchiveManyDto, description: 'Folder id'})
    @CheckPolicies(folderPolicies.OwnerFullEditor('params.folder_id'))
    async deleteManyTasks(@Body('tasks') tasks: number[], @JwtUser() user: JwtUserInterface): Promise<unknown> {
        return await this.service.deleteManyTasks(tasks, user);
    }

    /**
     * Archives multiple tasks and all their children.
     *
     * @param {JwtUserInterface} user - The user performing the action.
     * @param {number[]} tasks - An array of task IDs to archive.
     * @returns {Promise<unknown>} - A Promise that resolves with the result of the archiving operation.
     */
    @Post('folder/:folder_id/archive-many')
    @ApiOperation({summary: 'Archives a task and all its children'})
    @ApiBody({description: 'List of task ids to archive', type: DeleteArchiveManyDto, required: true})
    @ApiParam({name: 'folder_id', required: true, type: Number, description: 'Folder id'})
    @CheckPolicies(folderPolicies.OwnerFullEditor('params.folder_id'))
    async archiveManyTasks(@Body() dto: DeleteArchiveManyDto, @JwtUser() user: JwtUserInterface): Promise<unknown> {
        return await this.service.archiveManyTasks(dto.tasks, user);
    }

    //todo : add return type
    //** Owner and Assignee(UPDATE & READ) can change Workflow State and position and folder read permission  */
    /**
     * Update the position and column of a task.
     *
     * @param {number} task_id - The ID of the task to update.
     * @param {UpdateTaskPositionDto} data - The new position and column of the task.
     * @param {JwtUserInterface} user - The user performing the update.
     *
     * @returns {Promise<Partial<TaskEntity>>} - A promise that resolves when the task position is updated.
     *
     * @Patch('position/:task_id')
     * @ApiOperation({summary: 'Update Task column and position'})
     * @ApiParam({name: 'task_id', required: true, type: Number, description: 'Task id to update position/column'})
     * @ApiBody({description: 'Task new position and column', type: UpdateTaskPositionDto})
     * @CheckPolicies(folderPolicies.OwnerFullEditor('body.folderId'))
     */
    @Patch('position/:task_id')
    @ApiOperation({summary: 'Update Task column and position'})
    @ApiParam({name: 'task_id', required: true, type: Number, description: 'Task id to update position/column'})
    @ApiBody({description: 'Task new position and column', type: UpdateTaskPositionDto})
    @ServiceUserCheckPolicies(folderPolicies.OwnerFullEditor('body.folderId'))
    async updateTaskPosition(
        @Param('task_id', ParseIntPipe) task_id: number,
        @Body() data: UpdateTaskPositionDto,
        @JwtUser() user: JwtUserInterface
    ): Promise<Partial<TaskEntity>> {
        return await this.service.updateTaskPosition(task_id, data, user);
    }

    //todo : add return type
    //** Owner and Assignee(UPDATE & READ) can change Workflow State and position and folder read permission  */
    /**
     * Updates the position of multiple tasks.
     *
     * @param {UpdateManyTaskPositionDto} dto - The DTO containing the updated positions of the tasks.
     * @param {JwtUserInterface} user - The user making the update request.
     *
     * @returns {Promise<unknown>} - A promise that resolves when the positions of the tasks are successfully updated.
     */
    @Patch('many/position')
    @ApiOperation({summary: 'Update multiple tasks position'})
    @ApiBody({type: UpdateManyTaskPositionDto, required: true})
    @CheckPolicies(folderPolicies.OwnerFullEditor('body.folderId'))
    async updateManyTaskPosition(@Body() dto: UpdateManyTaskPositionDto, @JwtUser() user: JwtUserInterface): Promise<unknown> {
        return await this.service.updateManyPosition(dto, user);
    }

    //todo : add return type
    //** Full , editor or owner permissions of the shared to and from folder and Owner permission on tasks} */
    /**
     * Shares a task with other users.
     *
     * @param {number} task_id - The id of the task which is being shared.
     * @param {TaskSharedDto} data - Task new workflow.
     * @param {JwtUserInterface} user - The user performing the share operation.
     * @param {AuthHeaderDto} authorization - The authorization header containing the JWT token.
     * @returns {Promise<unknown>} - A promise that resolves to the result of the share operation.
     */
    @Post('share/:task_id')
    @ApiParam({name: 'task_id', required: true, type: Number, description: 'The id of the task which is being shared'})
    @ApiBody({description: 'Task new workflow', type: TaskSharedDto})
    @ServiceUserCheckPolicies(
        folderPolicies.OwnerFullEditor('body.fromFolderId'),
        folderPolicies.OwnerFullEditor('body.folderId') // to folder id
    )
    async share(
        @Param('task_id') task_id: number,
        @Body() data: TaskSharedDto,
        @JwtUser() user: JwtUserInterface,
        @Headers() {authorization}: AuthHeaderDto
    ): Promise<TaskRelationEntity> {
        return await this.service.shareTask(task_id, data, user, authorization);
    }

    //todo : add return type
    //** Owner|Full Permission on folder and Owner of the task */
    /**
     * Deletes the sharing of a task from a folder.
     *
     * @param {number} task_id - The id of the task which is shared.
     * @param {number} folder_id - The id of the folder which is shared.
     * @param {JwtUserInterface} user - The user making the request.
     * @param {AuthHeaderDto} authorization - The authorization header.
     * @returns {Promise<unknown>} - A promise that resolves with the result of the unshare operation.
     */
    @Delete('un-share/:task_id/:folder_id')
    @ApiParam({name: 'task_id', required: true, type: Number, description: 'The id of the task which is shared'})
    @ApiParam({name: 'folder_id', required: true, type: Number, description: 'The id of the folder which is shared'})
    @CheckPolicies(folderPolicies.OwnerFullEditor('params.folder_id'))
    async unShare(
        @Param('task_id', ParseIntPipe) task_id: number,
        @Param('folder_id', ParseIntPipe) folder_id: number,
        @JwtUser() user: JwtUserInterface,
        @Headers() {authorization}: AuthHeaderDto
    ): Promise<unknown> {
        return await this.service.unshareTask(task_id, folder_id, user, authorization);
    }

    // //todo : add return type
    // // folder owner | folder full | owner task 1 & owner of task 2
    /**
     * Create a task predecessors/successors dependency.
     *
     * @param {CreateDependencyDto} dto - The DTO containing the information for creating the dependency.
     * @param {JwtUserInterface} user - The user making the request.
     * @returns {Promise<unknown>} - A promise that resolves to the created dependency.
     */
    @ApiOperation({summary: 'Create a task predecessors/successors dependency'})
    @Post('dependency/folder/:folder_id')
    @ApiParam({
        name: 'folder_id',
        required: true,
        type: Number,
        description: 'The id of the folder where the task is added',
    })
    @CheckPolicies(folderPolicies.OwnerFullEditor('params.folder_id'))
    async createDependency(@Body() dto: CreateDependencyDto, @JwtUser() user: JwtUserInterface): Promise<unknown> {
        return await this.service.createTaskDependency(dto, user);
    }

    //todo: Add return type
    //** todo: Add predecessors and successors in the route to validate in policies */
    /**
     * Deletes a task's predecessors/successors dependency.
     *
     * @param {number} dependencyId - The id of the dependency.
     * @returns {Promise<unknown>} - A promise that resolves when the dependency is deleted.
     */
    @ApiOperation({summary: 'Delete a task predecessors/successors dependency'})
    @ApiParam({name: 'dependency_id', required: true, type: Number, description: 'The id of the dependency'})
    @ApiParam({
        name: 'folder_id',
        required: true,
        type: Number,
        description: 'The id of the folder where the task is added',
    })
    @Delete('dependency/:dependency_id/predecessors/:predecessor_id/successors/:successor_id/folder/:folder_id')
    @CheckPolicies(folderPolicies.OwnerFullEditor('params.folder_id'))
    async deleteTaskDependency(@Param('dependency_id', ParseIntPipe) dependencyId: number): Promise<unknown> {
        return await this.service.deleteTaskDependency(dependencyId);
    }

    /**
     * Retrieves the custom fields with their values for a specific task,
     * including the custom fields of the current user.
     *
     * @param {number} task_id - The id of the task for which to retrieve the custom fields.
     * @param {JwtUserInterface} user - The current authenticated user.
     * @returns {Promise<CustomFieldsTaskResponseDto>} - A promise that resolves to the custom fields for the task.
     */
    @ApiOperation({summary: "Get task's custom fields with values, include current user's custom fields"})
    @ApiParam({name: 'task_id', required: true, type: Number, description: 'Task id'})
    @ApiParam({
        name: 'folder_id',
        required: true,
        type: Number,
        description: 'The id of the folder where the task is added',
    })
    @Get('custom-field/folder/:folder_id/task/:task_id')
    @CheckPolicies(folderPolicies.OwnerFullEditorReadonly('params.folder_id'))
    async getCustomFields(
        @Param('task_id', ParseIntPipe) task_id: number,
        @JwtUser() user: JwtUserInterface
    ): Promise<CustomFieldsTaskResponseDto> {
        return await this.service.getCustomFields(task_id, user.id);
    }

    /**
     * Add a custom field to a task.
     *
     * @param {number} task_id - The id of the task.
     * @param {number} folder_id - The id of the folder where the task is added.
     * @param {JwtUserInterface} user - The current user.
     *
     * @return {Promise<unknown>} - A promise that resolves with the result of adding the custom field to the task.
     */
    @ApiOperation({summary: "Add/Remove custom fields to task, can be one of the current user's custom fields"})
    @ApiParam({name: 'task_id', required: true, type: Number, description: 'Task id'})
    @ApiParam({
        name: 'folder_id',
        required: true,
        type: Number,
        description: 'The id of the folder where the task is added',
    })
    @ApiBody({required: true, type: TaskCustomFieldDto, description: 'IDs of CFs to insert or delete from task'})
    @Post('custom-field/folder/:folder_id/task/:task_id')
    @CheckPolicies(folderPolicies.OwnerFull('params.folder_id'))
    async addCustomField(
        @Param('task_id', ParseIntPipe) task_id: number,
        @Body() dto: TaskCustomFieldDto,
        @JwtUser() user: JwtUserInterface
    ): Promise<TaskCustomFieldDto> {
        return await this.service.addTaskCustomFields(task_id, dto, user);
    }

    //todo : add return type
    /**
     * Set custom field value in a task.
     *
     * @param {number} task_id - Task id.
     * @param {number} custom_field_id - Custom Field id.
     * @param {string} value - Value to set.
     * @param {JwtUserInterface} user - The user making the request.
     * @returns {Promise<unknown>} - Resolves when the custom field value is set successfully.
     */
    @ApiOperation({summary: 'Set custom field value, will validate if the custom field is per user or not'})
    @ApiParam({name: 'task_id', required: true, type: Number, description: 'Task id'})
    @ApiParam({name: 'custom_field_id', required: true, type: Number, description: 'Custom Field id'})
    @ApiQuery({name: 'value', required: true, description: 'Value to set', type: 'string'})
    @ApiParam({
        name: 'folder_id',
        required: true,
        type: Number,
        description: 'The id of the folder where the task is added',
    })
    @Patch('custom-field/:custom_field_id/folder/:folder_id/task/:task_id')
    @ServiceUserCheckPolicies(folderPolicies.OwnerFullEditor('params.folder_id'), customFieldValuePolicies.Create())
    async setCustomFieldValue(
        @Param('task_id', ParseIntPipe) task_id: number,
        @Param('custom_field_id', ParseIntPipe) custom_field_id: number,
        @Query('value') value: string,
        @JwtUser() user: JwtUserInterface
    ): Promise<unknown> {
        return await this.service.setCustomFieldValueInTask(task_id, custom_field_id, value, user);
    }

    //todo : add return types
    //** Create Separate endpoints for assigning user and common tags */
    /**
     * Adds a tag to a task.
     *
     * @param {number} task_id - The ID of the task.
     * @param {number} tag_id - The ID of the tag.
     * @param {number} folder_id - The ID of the folder.
     * @param {JwtUserInterface} user - The authenticated user.
     * @returns {Promise<TagTaskFolderEntity>} - A promise that resolves to the updated TagTaskFolderEntity.
     */
    @ApiOperation({summary: 'Add tag to task'})
    @ApiParam({name: 'task_id', required: true, type: Number, description: 'Task id'})
    @ApiParam({name: 'tag_id', required: true, type: Number, description: 'Tag id'})
    @ApiParam({name: 'folder_id', required: true, type: Number, description: 'Folder id'})
    @Post('tag/:task_id/:tag_id/:folder_id')
    @ServiceUserCheckPolicies(folderPolicies.OwnerFull('params.folder_id'))
    async addTag(
        @Param('task_id', ParseIntPipe) task_id: number,
        @Param('tag_id', ParseIntPipe) tag_id: number,
        @Param('folder_id', ParseIntPipe) folder_id: number,
        @JwtUser() user: JwtUserInterface
    ): Promise<TagTaskFolderEntity> {
        return await this.service.addTagInTask(task_id, tag_id, folder_id, user.id);
    }

    /**
     * Remove tag from task.
     *
     * @param {number} task_id - Task id
     * @param {number} tag_id - Tag id
     * @param {number} folder_id - Folder id
     * @returns {Promise<DeleteResult>} - Promise that resolves to the DeleteResult object
     */
    @ApiOperation({summary: 'Remove tag from task'})
    @ApiParam({name: 'task_id', required: true, type: Number, description: 'Task id'})
    @ApiParam({name: 'tag_id', required: true, type: Number, description: 'Tag id'})
    @ApiParam({name: 'folder_id', required: true, type: Number, description: 'Folder id'})
    @Delete('tag/:tag_id/folder/:folder_id/task/:task_id')
    @CheckPolicies(folderPolicies.OwnerFullEditor('params.folder_id'))
    async removeTags(
        @Param('task_id', ParseIntPipe) task_id: number,
        @Param('tag_id', ParseIntPipe) tag_id: number,
        @JwtUser() user: JwtUserInterface
    ): Promise<TagTaskFolderEntity> {
        return await this.service.removeTagFromTask(task_id, tag_id, user);
    }

    //PEOPLE WITH READ POLICIES CAN ALSO FOLLOW A TASK.
    /**
     * Follows a task to get emails when it is updated.
     *
     * @param {number} task_id - The id of the task to follow.
     * @param {string} user_id - The id of the user following the task.
     * @returns {Promise<TaskFollowerEntity>} A promise that resolves to the task follower entity representing the follow relationship.
     */
    @ApiOperation({summary: 'Follow to a task to get emails when it is updated'})
    @ApiParam({name: 'task_id', required: true, type: Number, description: 'Task id'})
    @ApiParam({name: 'user_id', required: true, type: String, description: 'User id'})
    @ApiParam({name: 'folder_id', required: true, type: Number, description: 'Folder id'})
    @Post('follow/:folder_id/:task_id/:user_id')
    @CheckPolicies(folderPolicies.OwnerFullEditorReadonly('params.folder_id'))
    async follow(
        @Param('task_id', ParseIntPipe) task_id: number,
        @Param('user_id', ParseUUIDPipe) userId: string
    ): Promise<TaskFollowerEntity> {
        return await this.service.follow(task_id, userId);
    }

    /**
     * Remove a follower from a specific task.
     *
     * @param {number} task_id - Task id.
     * @param {string} user_id - User id.
     *
     * @returns {Promise<DeleteResult>} - The result of the deletion operation.
     */
    @ApiOperation({summary: 'Remove a follower from a specific task'})
    @ApiParam({name: 'task_id', required: true, type: Number, description: 'Task id'})
    @ApiParam({name: 'user_id', required: true, type: String, description: 'User id'})
    @ApiParam({name: 'folder_id', required: true, type: Number, description: 'Folder id'})
    @Delete('unfollow/:folder_id/:task_id/:user_id')
    @CheckPolicies(folderPolicies.OwnerFullEditorReadonly('params.folder_id'))
    async unfollow(
        @Param('task_id', ParseIntPipe) task_id: number,
        @Param('user_id', ParseUUIDPipe) user_id: string
    ): Promise<DeleteResult> {
        return await this.service.unfollow(task_id, user_id);
    }

    //todo : add return types
    //** Owner Read */
    /**
     * Fetch all followers from a specific task.
     *
     * @param {number} task_id - Task ID.
     * @returns {Promise<unknown>} - A Promise that resolves to the followers of the task.
     */
    @ApiOperation({summary: 'Fetch all followers from a specific task'})
    @ApiParam({name: 'task_id', required: true, type: Number, description: 'Task id'})
    @ApiParam({name: 'folder_id', required: true, type: Number, description: 'Folder id'})
    @Get('follow/:task_id/folder/:folder_id')
    @CheckPolicies(folderPolicies.OwnerFullEditorReadonly('params.folder_id'))
    async getFollowers(@Param('task_id', ParseIntPipe) task_id: number): Promise<unknown> {
        return await this.service.getFollowers(task_id);
    }

    //on following what permission, we should have .?
    /**
     * Retrieve the tasks that the current user is following.
     *
     * @param {JwtUserInterface} user - The user object obtained from the JWT token.
     * @return {Promise<GetFollowingTaskDto[]>} - A promise that resolves to an array of GetFollowingTaskDto objects representing the tasks that the user is following.
     */
    @Get('following')
    @ApiOperation({summary: 'Get the tasks that the current user is following'})
    @CheckPolicies(userPolicies.Read())
    async getFollowing(@JwtUser() user: JwtUserInterface): Promise<GetFollowingTaskDto[]> {
        return await this.service.getFollowing(user);
    }

    //todo : add return types
    //Folder read and task delete or owner
    /**
     * Archives a task and all its children.
     *
     * @param {number} task_id - The task id to be archived.
     * @param {number} folder_id - The folder id where the task is located.
     *
     * @returns {Promise<unknown>} A Promise that resolves when the task is successfully archived.
     */
    @ApiOperation({summary: 'Archives a task and all children'})
    @ApiParam({name: 'task_id', required: true, type: Number, description: 'Task id'})
    @ApiParam({name: 'folder_id', required: true, type: Number, description: 'Folder id'})
    @ApiBody({description: 'Archive Reason ', type: ArchiveTaskDto})
    @Post('archive/:task_id/folder/:folder_id')
    @CheckPolicies(folderPolicies.OwnerFullEditor('params.folder_id'))
    async archive(
        @Param('task_id', ParseIntPipe) task_id: number,
        @JwtUser() user: JwtUserInterface,
        @Body() dto: ArchiveTaskDto
    ): Promise<unknown> {
        return await this.service.archiveTask(task_id, user, dto);
    }

    @ApiOperation({summary: 'deletes a task and all children'})
    @ApiParam({name: 'task_id', required: true, type: Number, description: 'Task id'})
    @ApiParam({name: 'folder_id', required: true, type: Number, description: 'Folder id'})
    @Delete('delete/:task_id/folder/:folder_id')
    @CheckPolicies(folderPolicies.OwnerFullEditor('params.folder_id'))
    async delete(@Param('task_id', ParseIntPipe) task_id: number, @JwtUser() user: JwtUserInterface): Promise<unknown> {
        return await this.service.deleteTask(task_id, user);
    }

    //todo : add return types
    /**
     * Restore archived folder.
     *
     * @summary Restore archived folder
     *
     * @param {number} task_id - Task id.
     * @param {number} folder_id - Folder id.
     *
     * @returns {Promise<unknown>} - A promise that resolves to the result of the restore operation.
     */
    @ApiOperation({summary: 'Restore archived folder'})
    @ApiParam({name: 'task_id', required: true, type: Number, description: 'Task id'})
    @ApiParam({name: 'folder_id', required: true, type: Number, description: 'Folder id'})
    @CheckPolicies(folderPolicies.OwnerFullEditor('params.folder_id'))
    @Post('archive/restore/:task_id/folder/:folder_id')
    async restoreArchived(@Param('task_id', ParseIntPipe) task_id: number, @JwtUser() user: JwtUserInterface): Promise<unknown> {
        return await this.service.restoreTask(task_id, user);
    }

    //todo : add return types
    @ApiOperation({summary: 'Restore deleted folder'})
    @ApiParam({name: 'task_id', required: true, type: Number, description: 'Task id'})
    @ApiParam({name: 'folder_id', required: true, type: Number, description: 'Folder id'})
    @Post('delete/restore/:task_id/folder/:folder_id')
    @CheckPolicies(purgeFoldersAndTasks.Update())
    async restoreDeleted(@Param('task_id', ParseIntPipe) task_id: number, @JwtUser() user: JwtUserInterface): Promise<unknown> {
        return await this.service.restoreDeletedTask(task_id, user);
    }

    //todo : add return types
    //Note : What policy should we have here for taskPolicies.? Need to define who can archive the task
    // todo : Check policy should return the list of ids of the current user is the owner of the tasks.
    /**
     * Fetches all archived tasks from the active user.
     *
     * @param {JwtUserInterface} user - The JwtUserInterface object representing the active user.
     * @return {Promise<TaskEntity[]>} A promise that resolves to an array of TaskEntity objects representing the archived tasks.
     */
    @Get('many/archive')
    // @CheckPolicies(taskPolicies.Read())
    @CheckPolicies(() => true)
    @ApiOperation({summary: 'Fetch all archived tasks from the active User'})
    async getManyArchived(@JwtUser() user: JwtUserInterface): Promise<TaskEntity[]> {
        return await this.service.getManyArchivedTasks(user);
    }

    /**
     * Fetch all tasks assigned to the current user.
     *
     * @param user - The current user's JWT information.
     * @param queryDto - The query parameters for filtering the tasks.
     * @returns An array of AssignedTasksResponseDto.
     */
    @Post('assigned')
    // @CheckPolicies(taskPolicies.Read())
    @CheckPolicies(() => true)
    @ApiOperation({summary: 'Fetch all tasks assigned to the current user'})
    @ApiBody({required: false, type: GetAssignedTasksDto, description: 'filter,sorting,pagination'})
    @ApiResponse({status: 200, type: AssignedTasksTotalCountDto, isArray: true})
    async getAssignedTasks(@JwtUser() user: JwtUserInterface, @Body() body: GetAssignedTasksDto): Promise<AssignedTasksTotalCountDto> {
        return await this.service.getAssignedTasks(user, body);
    }

    @Put('move-many')
    @CheckPolicies(folderPolicies.OwnerFullEditor('body.sourceFolderId'))
    @ApiOperation({summary: 'Move many tasks from one folder to another'})
    @ApiBody({type: MoveManyTasksDto, required: true})
    @ApiResponse({status: 200, type: MoveManyResultDto, isArray: true})
    async moveBetweenFolders(@Body() dto: MoveManyTasksDto): Promise<MoveManyResultDto[]> {
        return await this.service.moveBetweenFolders(dto.taskIds, dto.sourceFolderId, dto.destinationFolderId, dto.mapWorkflowStates);
    }
}
