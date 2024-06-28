import {BadRequestException, Inject, Injectable, NotFoundException} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {DeleteResult, In, Not, Repository, UpdateResult} from 'typeorm';
import {
    ABSTRACT_AUTHORIZATION_SERVICE,
    AutomationsApplicationIdOptions,
    AutomationsSourceOptions,
    contructorLogger,
    getUserFullName,
    JwtUser,
    JwtUserInterface,
    PaginationDto,
    S3Service,
    TASK_MANAGEMENT,
} from '@lib/base-library';
import {runOnTransactionCommit, Transactional} from 'typeorm-transactional';
import {EntityTypeOptions, PermissionOptions} from '../authorization-impl/authorization.enum';
import {TaskAttachmentService} from './task-attachment/task-attachment.service';
import {TaskBaseService} from './task-base.service';
import {TaskEntity} from '../../model/task.entity';
import {AuthorizationImplService} from '../authorization-impl/authorization-impl.service';
import {CustomFieldsTaskResponseDto, TaskResponseDto} from '../../dto/task/task-response.dto';
import {
    TaskAssigneesDto,
    TaskCustomFieldDto,
    UpdateManyTaskDto,
    UpdateManyTaskPositionDto,
    UpdateTaskDto,
    UpdateTaskPositionDto,
} from '../../dto/task/update-task.dto';
import {CreateTaskDto} from '../../dto/task/create-task.dto';
import {CreateDependencyDto} from '../../dto/task/create-predecessor.dto';
import {TagTaskFolderEntity} from '../../model/tag-task-folder.entity';
import {TagEntity} from '../../model/tag.entity';
import {TaskFollowerEntity} from '../../model/task-follower.entity';
import {GetFollowingTaskDto} from '../../dto/task/get-following-task.dto';
import {TaskSharedDto} from '../../dto/task/task-shared.dto';
import {TaskRelationEntity} from '../../model/task-relation.entity';
import {AssignedPermissionEntity} from '../../model/assigned-permission.entity';
import {TagTaskFolderTypeOptions} from '../../enum/tag.enum';
import {TaskTreeDto} from '../../dto/folder/folder/task-tree.dto';
import {AssignedTasksTotalCountDto, GetAssignedTasksDto} from '../../dto/task/assigned-tasks.dto';
import {EventEmitter2} from '@nestjs/event-emitter';
import {CustomFieldValueEntity} from '../../model/custom-field-value.entity';
import {EntityNotificationDto} from '../../dto/events/entity-notification.dto';
import {TaskEventNameOptions} from '../../enum/notification-event.enum';
import {NotificationService} from '../notification/notification.service';
import {TaskActionOptions} from '../../enum/task-action.enum';
import {UserEntity} from '../../model/user.entity';
import {SERVICE_USER_ID} from '../../const/env.const';
import {
    AutomationNotificationDetailTaskEventDto,
    AutomationNotificationDto,
    AutomationsEventOptions,
    AutomationsRedisSendService,
} from '@lib/automations-library';
import {MapWorkflowStateDto} from '../../dto/workflow/update-workflow.dto';
import {MoveManyResultDto} from '../../dto/task/move-many-tasks.dto';
import {ArchiveTaskDto} from '../../dto/task/archive-task.dto';
import {WorkFlowStateEntity} from '../../model/workflow-state.entity';
import {WorkFlowEntity} from '../../model/workflow.entity';
import {ArchivedDeletedFolderTasksResponseDto} from '../../dto/task/get-archived-deleted-task.dto';
import {RawDatabaseConfig} from '../../config/database.config';
import {queries} from '../../recursive-queries';

/**
 * TaskService class provides methods for manipulating tasks.
 *
 * @class TaskService
 * @extends {TaskBaseService}
 */
@Injectable()
export class TaskService extends TaskBaseService {
    /**
     * Constructor for the class.
     *
     * @param {Repository<TaskEntity>} repo - The repository for TaskEntity.
     * @param {TaskAttachmentService} taskAttachmentService - The service for TaskAttachmentService.
     * @param {Repository<AssignedPermissionEntity>} repoAssignedPermission - The repository for AssignedPermissionEntity.
     * @param {EventEmitter2} eventEmitter - The EventEmitter2 for event handling.
     * @param {AuthorizationImplService} authorization - The AuthorizationImplService for authorization.
     * @param {AutomationsRedisSendService} automationsSendService - The service for AutomationsRedisSendService.
     * @param {NotificationService} notificationService - The service for NotificationService.
     * @return {void}
     */
    constructor(
        @InjectRepository(TaskEntity) protected readonly repo: Repository<TaskEntity>,
        protected readonly taskAttachmentService: TaskAttachmentService,
        @InjectRepository(AssignedPermissionEntity) repoAssignedPermission: Repository<AssignedPermissionEntity>,
        @Inject(EventEmitter2) protected readonly eventEmitter: EventEmitter2,
        @Inject(ABSTRACT_AUTHORIZATION_SERVICE) protected readonly authorization: AuthorizationImplService,
        protected automationsSendService: AutomationsRedisSendService,
        protected notificationService: NotificationService,
        protected readonly s3Service: S3Service
    ) {
        super(repo, taskAttachmentService, repoAssignedPermission, eventEmitter, automationsSendService, notificationService, s3Service);
        contructorLogger(this);
    }

    /**
     * Retrieves a specific task by its ID.
     *
     * @param {number} taskId - The ID of the task to retrieve.
     * @param {JwtUserInterface} user - The user making the request.
     * @param {number} folderId - The ID of the folder containing the task.
     * @return {Promise<TaskResponseDto>} A promise that resolves with the retrieved task.
     * @throws {NotFoundException} If the task doesn't exist in the database.
     */
    async getOneTask(taskId: number, user: JwtUserInterface, folderId: number): Promise<TaskResponseDto> {
        const ret = await super.getOneById(taskId, user.id, folderId);
        if (ret === null) {
            throw new NotFoundException(`task doesn't exist in db with id: ${taskId}`);
        }
        return ret;
    }

    /**
     * Retrieves archived Tasks by folder Id.
     * @return {Promise<ArchivedDeletedFolderTasksResponseDto>} A promise that resolves with the retrieved task.
     * @throws {NotFoundException} If the task doesn't exist in the database.
     */
    async getTasksByFolder(dto: PaginationDto, folderId: number, showOn: string): Promise<ArchivedDeletedFolderTasksResponseDto> {
        const ret = await super.getFolderTasks(dto, folderId, showOn);
        if (ret === null) {
            throw new NotFoundException(`tasks doesn't exist in db with folder id: ${folderId}`);
        }
        return ret;
    }

    /**
     * Retrieves Task Management due Tasks by folder Id.
     * @return {Promise<ArchivedDeletedFolderTasksResponseDto>} A promise that resolves with the retrieved task.
     * @throws {NotFoundException} If the task doesn't exist in the database.
     */
    async getAutomationsTmDueTasksByFolder(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        folderId: number
    ): Promise<AutomationNotificationDetailTaskEventDto[]> {
        const query = `
                SELECT DISTINCT
                             T.id AS "taskId"
                            ,T.title as "title"
                            ,T.start_date as "startDate"
                            ,T.end_date as "endDate"
                            ,TR.folder_id as "folderId"
                            ,T.importance_id as "importanceId"
                FROM 
                            "${RawDatabaseConfig.schema}".task T
                INNER JOIN 
                            "${RawDatabaseConfig.schema}".task_relation TR 
                            ON TR.CHILD_TASK_ID = T.ID 
                            AND TR.FOLDER_ID = $1
                            AND '${TASK_MANAGEMENT}'=ANY(T.SHOW_ON)
                            AND T.archived_at is null
                            AND T.deleted_at is null
                            AND T.end_date is not null
                            AND T.end_date >= CURRENT_TIMESTAMP - INTERVAL '1 days'
                            AND T.end_date <= CURRENT_TIMESTAMP + INTERVAL '40 seconds'`;

        const tasks = (await this.repo.manager.query(query, [folderId])) as AutomationNotificationDetailTaskEventDto[];
        for (const task of tasks) {
            task.assignees = await this.getAssignees(Number(task.taskId));
        }
        return tasks;
    }

    /**
     * Updates a task with the provided task ID, DTO and user information.
     *
     * @param {number} taskId - The ID of the task to be updated.
     * @param {UpdateTaskDto} dto - The updated task data.
     * @param {JwtUserInterface} user - The user information.
     * @return {Promise<TaskEntity>} - The updated task entity.
     */
    @Transactional()
    async updateTask(taskId: number, dto: UpdateTaskDto, user: JwtUserInterface): Promise<TaskEntity> {
        // Update task
        return await super.update(taskId, dto, user);
    }

    /**
     * Update multiple tasks based on the given DTO.
     *
     * @param {UpdateManyTaskDto} dto - The DTO containing the tasks to be updated.
     * @param {JwtUserInterface} user - The user performing the update.
     * @throws {BadRequestException} Throws a BadRequestException if there was an error updating tasks.
     * @returns {Promise<void>} Returns a Promise that resolves to void.
     */
    @Transactional()
    async updateManyV2(dto: UpdateManyTaskDto, user: JwtUserInterface): Promise<void> {
        if (dto.tasks.length) {
            for (const task of dto.tasks) {
                const {id, assignees, tagIds, ...rest} = task;
                if (assignees) {
                    await this.updateTaskAssignees(id, {assignees, folderId: dto.folderId}, user);
                }

                if (tagIds != null) {
                    await super.removeAllTags(task.id);
                    for (const tagId of tagIds) {
                        await this.addTagInTask(task.id, tagId, dto.folderId, user.id);
                    }
                }

                if (Object.keys(rest).length) {
                    await this.update(id, {...rest, folderId: dto.folderId}, user);
                }
            }
        } else {
            throw new BadRequestException('There was an error updating tasks');
        }
    }

    /**
     * Updates the assignees of a task.
     *
     * @param {number} taskId - The ID of the task to update.
     * @param {TaskAssigneesDto} dto - The DTO containing the new assignees for the task.
     * @param {JwtUserInterface} user - The user making the update request.
     * @returns {Promise<UpdateResult>} - A Promise that resolves to the result of the update operation.
     */
    @Transactional()
    async updateTaskAssignees(taskId: number, dto: TaskAssigneesDto, user: JwtUserInterface): Promise<UpdateResult> {
        const task = await this.repo.findOne({where: {id: taskId}});

        const ret = await super.updateAssignees(taskId, dto, user.id);

        // // Get permissions for all users on this task
        // const actualPermissions: AssignedPermissionEntity[] = await this.authorization.getPermissionsForEntity(
        //     EntityTypeOptions.Task,
        //     taskId.toString()
        // );
        // // Revoke all permissions currently assigned except for owner
        // for (const permission of actualPermissions) {
        //     const isOwner = this.authorization.isOwner(permission.permissions);
        //
        //     await this.authorization.revokeFromUser(
        //         isOwner ? PermissionOptions.ASSIGNEE : permission.permissions,
        //         permission.entityType,
        //         permission.userId,
        //         permission.entityId
        //     );
        // }
        //
        // // Add the new permissions for the assignees specified in the dto
        // for (const assignee of dto.assignees) {
        //     await this.authorization.grantToUser(
        //         PermissionOptions.ASSIGNEE | PermissionOptions.READ | PermissionOptions.UPDATE,
        //         EntityTypeOptions.Task,
        //         assignee,
        //         taskId.toString()
        //     );
        // }
        //
        // // OWNER of the folder has full control over the task within that folder
        const folderId = await super.getFolderIdByTaskId(taskId);
        // await this.grantFullControlToFolderOwner(folderId, taskId);

        // Emit a notification about assignee change
        const emailDto = await this.notificationService.setTaskEmailDto(taskId, user, [], TaskActionOptions.ASSIGN);
        const recipients = (await this.notificationService.getTaskNotificationRecipients(taskId)).filter(
            (userId) => userId !== user.id || userId !== SERVICE_USER_ID
        );
        const beforeAssignment = task?.assignees ?? [];
        const afterAssignment = dto?.assignees ?? [];
        const users = await this.repo.manager
            .getRepository<UserEntity>(UserEntity)
            .find({where: {id: In(beforeAssignment.concat(afterAssignment))}});

        const newAssignedMembers = users.filter((user) => !beforeAssignment.find((id) => id === user.id));
        const removedMembers = users.filter((user) => !afterAssignment.find((id) => id === user.id));
        const eventType = newAssignedMembers?.length ? TaskEventNameOptions.TASK_ASSIGN : TaskEventNameOptions.TASK_UNASSIGN_TASK;
        const members = newAssignedMembers?.length
            ? {assigned: newAssignedMembers.map((user) => getUserFullName(user))}
            : {unassigned: removedMembers.map((user) => getUserFullName(user))};

        const [{id = null}] = await this.repo.query(queries.getSpaceWithFolderIdSql, [dto.folderId]);

        runOnTransactionCommit(() => {
            this.eventEmitter.emit(eventType, {
                data: {
                    event: eventType,
                    taskId: taskId,
                    folderId: folderId,
                    spaceId: id,
                    userId: user.id,
                    message: this.notificationService.setNotificationMessage({
                        actions: {members},
                        sender: getUserFullName(user),
                        entity: 'task',
                        entityTitle: task.title,
                    }),
                    ...emailDto,
                    updates: [
                        {assignees: newAssignedMembers?.length ? newAssignedMembers.map((m) => m.id) : removedMembers.map((m) => m.id)},
                    ],
                },
                userId: user.id,
                recipients: recipients.length > 0 ? recipients : dto.assignees,
            } as EntityNotificationDto);
        });
        return ret;
    }

    /**
     * Updates multiple tasks with the provided data.
     *
     * @param {UpdateManyTaskDto} dto - The DTO containing the data to update the tasks.
     * @param {JwtUserInterface} user - The user making the request.
     * @return {Promise<void>} - A Promise that resolves with no value once the tasks are updated.
     * @throws {Error} - Throws an error if there are any issues updating the tasks.
     * @example
     *
     * const dto = {
     *   ids: [1, 2, 3],
     *   assignees: [4, 5, 6]
     * };
     * const user = {
     *   id: 7,
     *   name: 'John Doe',
     *   role: 'admin'
     * };
     *
     * await updateManyTasks(dto, user);
     */
    @Transactional()
    async updateManyTasks(dto: UpdateManyTaskDto, @JwtUser() user: JwtUserInterface): Promise<void> {
        //TODO: See if task_user_ap is enough
        await this.updateManyV2(dto, user);

        /* Permissions */
        // {
        //     // updateManyV2 appends a group of assignees all the same to a list of tasks, so we delete any previous permissions and re-add them based on all current assignees
        //     // ** Commented this part because now we have separate api for assignees */
        //     if (dto.assignees?.length > 0) {
        //         for (const taskId of dto.ids) {
        //             // Get permissions for all users on this task
        //             const actualPermissions: AssignedPermissionEntity[] = await this.authorization.getPermissionsForEntity(
        //                 EntityTypeOptions.Task,
        //                 taskId.toString()
        //             );
        //             // Revoke all permissions currently assigned except for owner
        //             for (const permission of actualPermissions) {
        //                 if (!this.authorization.isOwner(permission.permissions)) {
        //                     await this.authorization.revokeFromUser(
        //                         permission.permissions,
        //                         permission.entityType,
        //                         permission.userId,
        //                         permission.entityId
        //                     );
        //                 }
        //             }
        //             // Add the new permissions for the assignees specified in the dto
        //             for (const assignee of dto.assignees) {
        //                 await this.authorization.grantToUser(
        //                     PermissionOptions.ASSIGNEE | PermissionOptions.READ | PermissionOptions.UPDATE,
        //                     EntityTypeOptions.Task,
        //                     assignee,
        //                     taskId.toString()
        //                 );
        //             }
        //             // OWNER of the folder has full control over the task within that folder
        //             const folderId = await super.getFolderIdByTaskId(taskId);
        //             await this.grantFullControlToFolderOwner(folderId, taskId);
        //         }
        //     }
        // }
    }

    // async grantFullControlToFolderOwner(folderId: number, taskId: number): Promise<void> {
    //     if (folderId == null) throw new Error(`Can't give permissions to the owner of the folder because the id of the folder is invalid`);
    //     const userId: string = await this.authorization.getEntityOwnerUserId(EntityTypeOptions.Folder, folderId);
    //     //await this.authorization.grantOwner(EntityTypeOptions.Task, userId, taskId);
    //     // await this.authorization.grantToUser(PermissionOptions.CREATE_READ_UPDATE_DELETE, EntityTypeOptions.Task, userId, taskId);
    // }

    //TODO : user => userId:string
    /**
     * Creates a new task.
     *
     * @param {CreateTaskDto} dto - The task data.
     * @param {JwtUserInterface} user - The user creating the task.
     *
     * @return {Promise<TaskEntity>} - A promise that resolves to the created task entity.
     *
     * @throws {Error} - If an error occurs while creating the task.
     */
    @Transactional()
    async createOneTask(dto: CreateTaskDto, user: JwtUserInterface): Promise<TaskEntity> {
        const newTask = await super.create(dto, user);
        /* Permissions */
        {
            // await this.authorization.grantOwner(EntityTypeOptions.Task, user.id, newTask.id);
            // await this.authorization.grantToUser(PermissionOptions.READ_UPDATE_DELETE, EntityTypeOptions.Task, user.id, newTask.id);

            // // GRANT read & update to assignees
            if (dto.assignees?.length > 0) {
                // for (const assignee of dto.assignees) {
                //     await this.authorization.grantToUser(
                //         PermissionOptions.ASSIGNEE | PermissionOptions.READ | PermissionOptions.UPDATE,
                //         EntityTypeOptions.Task,
                //         assignee,
                //         newTask.id.toString()
                //     );
                // }

                // Automations notification
                const importanceId = await super.getImportance(newTask.id);
                // eslint-disable-next-line @typescript-eslint/require-await
                runOnTransactionCommit(async () => {
                    if (user.id != SERVICE_USER_ID) {
                        const notification = new AutomationNotificationDto();
                        notification.eventType = AutomationsEventOptions.TASK_ASSIGNEE_ADDED;
                        notification.applicationId = AutomationsApplicationIdOptions.TASK_MANAGEMENT;
                        notification.fromSource = AutomationsSourceOptions.API;
                        notification.fromUser = user.id;
                        notification.locationType = EntityTypeOptions.Folder;
                        notification.locationId = dto.folderId.toString();
                        notification.entityId = newTask.id.toString();
                        const detail = new AutomationNotificationDetailTaskEventDto();
                        detail.assignees = dto.assignees;
                        detail.importanceId = importanceId;
                        detail.customFields = [];
                        notification.detail = detail;
                        await this.automationsSendService.queueMessage(notification);
                    }
                });
            }

            if (dto.followers) {
                for (const follower of dto.followers) {
                    await this.follow(newTask.id, follower);
                }
            }

            // // The OWNER of the folder has full control over the task within that folder
            // await this.grantFullControlToFolderOwner(dto.folderId, newTask.id);
            //
            // // Grant read permission on the task to folder members
            // await this.grantReadOnTaskToFolderMembers(dto.folderId, newTask.id);
        }

        return newTask;
    }

    /**
     * Deletes a task with the specified task ID and user ID.
     *
     * @param {number} taskId - The ID of the task to be deleted.
     * @param {string} userId - The ID of the user who owns the task.
     * @returns {Promise<void>} - A Promise that resolves when the task is successfully deleted.
     * @throws {Error} - If an error occurs during the deletion process.
     */
    @Transactional()
    async permanentDeleteTask(taskId: number, userId: string): Promise<void> {
        this.logger.log('Delete Task Permanently');
        const ret = await super.permanentDelete(taskId, userId);
        /* Permissions */
        // {
        //     await this.authorization.processEntityDeletion(EntityTypeOptions.Task, taskId);
        // }
        return ret;
    }

    /**
     * Deletes multiple tasks for a given user.
     *
     * @param {number[]} taskIds - An array of task IDs to delete
     * @param {string} userId - The ID of the user associated with the tasks
     *
     * @returns {Promise<void>} - A promise that resolves when the tasks are deleted
     *
     * @description
     * This method deletes multiple tasks for a given user. It iterates over the provided
     * task IDs and calls the `delete` method from the superclass, passing in the
     * task ID and user ID. This method is wrapped in a transaction for ensuring consistency.
     */
    @Transactional()
    async deleteManyTasks(taskIds: number[], user: JwtUserInterface): Promise<void> {
        for (const taskId of taskIds) {
            await super.delete(taskId, user);
        }
    }

    /**
     * Archives multiple tasks.
     *
     * @param {number[]} taskIds - An array of task IDs to be archived.
     * @param {string} userId - The user ID who is archiving the tasks.
     * @return {Promise<void>} - A Promise that resolves when all tasks are archived.
     *
     * @throws {Error} - If any error occurs while archiving the tasks.
     *
     * @example
     * const taskIds = [1, 2, 3];
     * const userId = 'abc123';
     *
     * try {
     *   await archiveManyTasks(taskIds, userId);
     * } catch (error) {
     *   console.error(error);
     * }
     */
    @Transactional()
    async archiveManyTasks(taskIds: number[], user: JwtUserInterface): Promise<void> {
        for (const taskId of taskIds) {
            await super.archive(taskId, user);
        }
    }

    /**
     * Update the project date for the given folder id.
     *
     * @param {number} folderId - The id of the folder to update.
     * @return {Promise<void>} - A promise that resolves when the update is completed.
     *
     * @throws {Error} - If the update fails or encounters an error.
     */
    @Transactional()
    async updateProjectDate(folderId: number): Promise<void> {
        return await super.updateProjectDate(folderId);
    }

    /**
     * Updates the position of a task.
     * @param {number} taskId - The ID of the task to update.
     * @param {UpdateTaskPositionDto} dto - The DTO containing the new position information.
     * @param {JwtUserInterface} user - The authenticated user performing the update.
     * @returns {Promise<TaskEntity>} - The updated task entity.
     */
    @Transactional()
    async updateTaskPosition(taskId: number, dto: UpdateTaskPositionDto, user: JwtUserInterface): Promise<Partial<TaskEntity>> {
        /*
        Check permissions on  parentTaskNewId and parentTaskOldId
        Validate folderId
        Validate columnId
    */

        const result = await super.updatePosition(taskId, dto, user);
        // {
        //     await this.authorization.updateEntityPosition(EntityTypeOptions.Task, taskId);
        // }
        return result;
    }

    /**
     * Updates the position of multiple tasks using the provided DTO and user information.
     * This method is transactional.
     *
     * @param {UpdateManyTaskPositionDto} dto - The DTO containing the updated position information.
     * @param {JwtUserInterface} user - The user information.
     *
     * @return {Promise<void>} - A promise that resolves when the update is complete.
     */
    @Transactional()
    async updateManyPosition(dto: UpdateManyTaskPositionDto, user: JwtUserInterface): Promise<void> {
        const result = await super.updateManyTaskPositionV2(dto, user);

        // for (const taskId of dto.ids) {
        //     await this.authorization.updateEntityPosition(EntityTypeOptions.Task, taskId);
        // }

        return result;
    }

    /**
     * Creates a task dependency.
     *
     * @param {CreateDependencyDto} dto - The dependency data transfer object.
     * @param {JwtUserInterface} user - The user object containing JWT data.
     * @return {Promise<unknown>} - A promise that resolves with the created task dependency.
     */
    @Transactional()
    async createTaskDependency(dto: CreateDependencyDto, user: JwtUserInterface): Promise<unknown> {
        return await super.createDependency(dto, user.id);
    }

    /**
     * Deletes a task dependency by its ID.
     *
     * @param {number} dependencyId - The ID of the task dependency to delete.
     * @return {Promise<unknown>} - A promise that resolves with the result of the deletion.
     *
     * @throws {Error} - If an error occurs during the deletion process.
     *
     * @example
     * const dependencyId = 1234;
     * await deleteTaskDependency(dependencyId);
     */
    @Transactional()
    async deleteTaskDependency(dependencyId: number): Promise<unknown> {
        return await super.deleteDependency(dependencyId);
    }

    /**
     * Retrieves custom fields for a specific task with the provided task ID and user ID.
     *
     * @param {number} taskId - The ID of the task.
     * @param {string} userId - The ID of the user.
     * @returns {Promise<CustomFieldsTaskResponseDto>} - A Promise that resolves with a CustomFieldsTaskResponseDto object.
     * @throws {Error} - If there was an error fetching the custom fields.
     */
    async getCustomFields(taskId: number, userId: string): Promise<CustomFieldsTaskResponseDto> {
        try {
            return await super.getCustomFields(taskId, userId);
        } catch (e) {
            this.logger.error(`There was an error fetching custom fields of task ${taskId}`, e);
            throw e;
        }
    }

    /**
     * Adds custom fields to a task.
     *
     * @param {number} taskId - The ID of the task.
     * @param {number} customFieldId - The ID of the custom field to be added.
     * @param {JwtUserInterface} user - The user object.
     * @returns {Promise<unknown>} - A promise that resolves when the custom fields are added successfully.
     * @throws {Error} - If there was an error adding the custom fields.
     */
    @Transactional()
    async addTaskCustomFields(taskId: number, dto: TaskCustomFieldDto, user: JwtUserInterface): Promise<TaskCustomFieldDto> {
        const result: TaskCustomFieldDto = {insert: [], delete: []};
        if (dto?.insert?.length) {
            for (const insertId of dto.insert) {
                const customField = await super.addCustomFields(taskId, insertId, user.id);
                if (customField.identifiers.length) {
                    result.insert.push(insertId);
                }
            }
        }
        if (dto?.delete?.length) {
            for (const deleteId of dto.delete) {
                const customFieldsRemoved = await super.removeCustomFields(taskId, deleteId, false, user.id);
                if (customFieldsRemoved.length > 0) {
                    result.delete.push(...customFieldsRemoved.map((cf) => cf.id));
                }
            }
        }
        return result;
    }

    /**
     * Sets the custom field value in a task.
     *
     * @param {number} taskId - The ID of the task.
     * @param {number} customFieldId - The ID of the custom field.
     * @param {string} value - The value to set for the custom field.
     * @param {JwtUserInterface} user - The user object.
     * @returns {Promise<unknown>} - A Promise that resolves when the custom field value is set, or rejects with an error.
     * @throws {Error} - If there was an error while setting the custom field value.
     */
    @Transactional()
    async setCustomFieldValueInTask(taskId: number, customFieldId: number, value: string, user: JwtUserInterface): Promise<unknown> {
        try {
            return await super.setCustomFieldValue(taskId, customFieldId, value, user.id);
        } catch (error) {
            this.logger.error(`There was an error fetching gantt columns of task ${taskId}`, error);
            throw error;
        }
    }

    /**
     * Adds a tag to a task.
     *
     * @param {number} taskId - The ID of the task.
     * @param {number} tagId - The ID of the tag.
     * @param {number} _folder_id - Unused parameter (can be ignored).
     * @param {string} userId - The ID of the user.
     * @returns {Promise<TagTaskFolderEntity>} - A promise that resolves to the updated TagTaskFolderEntity after adding the tag to the task.
     * @throws {NotFoundException} - If the tag with the specified tagId is not found.
     * @throws {BadRequestException} - If the user does not have permission to remove this personal tag.
     */
    @Transactional()
    async addTagInTask(taskId: number, tagId: number, _folder_id: number, userId: string): Promise<TagTaskFolderEntity> {
        const tagDB = await this.repo.manager.getRepository<TagEntity>(TagEntity).findOne({
            // select: {id: true, User: {id: true}},
            where: {id: tagId},
            // relations: {User: true},
        });

        if (!tagDB) {
            throw new NotFoundException(`Tag ${tagId} not found`);
        }

        if (tagDB.userId /*User*/) {
            if (tagDB.userId /*User.id*/ !== userId) {
                throw new BadRequestException(`The user can't remove this personal tag`);
            }
        }
        const result = await super.addTag(taskId, tagId, userId);

        const folderId = await this.getFolderIdByTaskId(taskId);
        const importanceId = await this.getImportance(taskId);
        const assignees = await this.getAssignees(taskId);
        const tags = await this.getTags(taskId);
        runOnTransactionCommit(async () => {
            // Prevent infinite loop in automations by checking this is not the service user
            if (userId != SERVICE_USER_ID) {
                const notification = new AutomationNotificationDto();
                notification.eventType = AutomationsEventOptions.TASK_TAG_ADDED;
                notification.applicationId = AutomationsApplicationIdOptions.TASK_MANAGEMENT;
                notification.fromSource = AutomationsSourceOptions.API;
                notification.fromUser = userId;
                notification.locationType = EntityTypeOptions.Folder;
                notification.locationId = folderId.toString();
                notification.entityId = taskId.toString();
                const detail = new AutomationNotificationDetailTaskEventDto();
                detail.tags = tags;
                detail.tagAdded = tagId.toString();
                detail.assignees = assignees;
                detail.importanceId = importanceId;
                detail.customFields = [];
                notification.detail = detail;
                await this.automationsSendService.queueMessage(notification);
            }
        });

        return result;
    }

    /**
     * Removes a tag from a task.
     *
     * @param {number} taskId - The ID of the task.
     * @param {number} tagId - The ID of the tag to be removed.
     * @param {JwtUserInterface} user - The user making the request.
     *
     * @returns {Promise<DeleteResult>} A promise that resolves to a DeleteResult object.
     * @throws {NotFoundException} If the tag specified by tagId is not found.
     * @throws {BadRequestException} If the user is not allowed to remove the tag.
     *
     * @remarks
     * This method is decorated with the @Transactional() decorator, which ensures that the operation is executed within a transaction.
     * It first checks if the specified tag exists in the database, and if not, throws a NotFoundException.
     * It then checks if the user has the permission to remove the tag, and if not, throws a BadRequestException.
     * Finally, it calls the superclass method to remove the tag from the task and returns the result.
     *
     * @example
     * const taskId = 1;
     * const tagId = 2;
     * const user = { id: 3, name: 'John Doe' };
     * const deleteResult = await removeTagFromTask(taskId, tagId, user);
     */
    @Transactional()
    async removeTagFromTask(taskId: number, tagId: number, user: JwtUserInterface): Promise<TagTaskFolderEntity> {
        const tagDB = await this.repo.manager.getRepository<TagEntity>(TagEntity).findOne({
            // select: {id: true, User: {id: true}},
            where: {id: tagId},
            // relations: {User: true},
        });

        if (!tagDB) {
            throw new NotFoundException(`Tag ${tagId} not found`);
        }

        if (tagDB.userId /*User*/) {
            if (tagDB.userId /*User.id*/ !== user.id) {
                throw new BadRequestException(`The user can't remove this personal tag`);
            }
        }
        const result = await super.removeTag(taskId, tagId);

        const folderId = await this.getFolderIdByTaskId(taskId);
        const importanceId = await this.getImportance(taskId);
        const assignees = await this.getAssignees(taskId);
        runOnTransactionCommit(async () => {
            // Prevent infinite loop in automations by checking this is not the service user
            if (user.id != SERVICE_USER_ID) {
                const notification = new AutomationNotificationDto();
                notification.eventType = AutomationsEventOptions.TASK_TAG_REMOVED;
                notification.applicationId = AutomationsApplicationIdOptions.TASK_MANAGEMENT;
                notification.fromSource = AutomationsSourceOptions.API;
                notification.fromUser = user.id;
                notification.locationType = EntityTypeOptions.Folder;
                notification.locationId = folderId.toString();
                notification.entityId = taskId.toString();
                const detail = new AutomationNotificationDetailTaskEventDto();
                detail.tagRemoved = tagId.toString();
                detail.assignees = assignees;
                detail.importanceId = importanceId;
                detail.customFields = [];
                notification.detail = detail;
                await this.automationsSendService.queueMessage(notification);
            }
        });

        return result;
    }

    /**
     * Follows a task.
     *
     * @param {number} taskId - The ID of the task to follow.
     * @param {string} userId - The ID of the user following the task.
     * @return {Promise<TaskFollowerEntity>} - A Promise that resolves to the TaskFollowerEntity created.
     * @throws {Error} - If there is an error subscribing to the task.
     * @transactional()
     */
    @Transactional()
    async follow(taskId: number, userId: string): Promise<TaskFollowerEntity> {
        try {
            return await super.follow(taskId, userId);
        } catch (err) {
            this.logger.error(`There was an error subscribing to task ${taskId}`, err);
            throw err;
        }
    }

    /**
     * Unfollows a task for a specific user.
     *
     * @param {number} taskId - The ID of the task to unfollow.
     * @param {string} userId - The ID of the user who wants to unfollow the task.
     * @returns {Promise<DeleteResult>} - A promise that resolves to a DeleteResult object.
     * @throws {Error} - If there was an error unfollowing the task.
     *
     * @example
     * // Unfollow task with ID 123 for user with ID "abc"
     * const result = await unfollow(123, "abc");
     * console.log(result); // The DeleteResult object
     */
    @Transactional()
    async unfollow(taskId: number, userId: string): Promise<DeleteResult> {
        try {
            return await super.unfollow(taskId, userId);
        } catch (err) {
            this.logger.error(`There was an error un subscribe to task ${taskId}`, err);
            throw err;
        }
    }

    /**
     * Retrieves the followers of a task.
     *
     * @param {number} taskId - The identifier of the task.
     * @return {Promise<unknown>} - A promise that resolves with the followers of the task.
     * @throws {Error} - If there is an error while getting the followers of the task.
     */
    async getFollowers(taskId: number): Promise<unknown> {
        try {
            return await super.getFollowers(taskId);
        } catch (error) {
            this.logger.error(`There was an error while getting followers of a task ${taskId}`, error);
            throw error;
        }
    }

    /**
     * Retrieves the following task for a user.
     *
     * @param {JwtUserInterface} user - The user object for which to retrieve the task following.
     * @return {Promise<GetFollowingTaskDto[]>} - A promise that resolves to an array of GetFollowingTaskDto objects representing the task following for the user.
     * @throws {Error} - If there was an error while retrieving the task following.
     */
    async getFollowing(user: JwtUserInterface): Promise<GetFollowingTaskDto[]> {
        try {
            return await super.getFollowing(user);
        } catch (error) {
            this.logger.error(`There was an error while getting task following for a user ${user}`, error);
            throw error;
        }
    }

    /**
     * Archives a task.
     *
     * @param {number} taskId - The ID of the task to be archived.
     * @param {JwtUserInterface} user - The user who is archiving the task.
     * @returns {Promise<void>} - A promise that resolves when the task is successfully archived.
     * @throws {Error} - If there was an error while archiving the task.
     */
    @Transactional()
    async archiveTask(taskId: number, user: JwtUserInterface, dto: ArchiveTaskDto): Promise<void> {
        try {
            this.logger.log('Archiving Task');
            return await super.archive(taskId, user, dto);
        } catch (error) {
            this.logger.error(`There was an error while archiving task ${taskId}`, error);
            throw error;
        }
    }

    @Transactional()
    async deleteTask(taskId: number, user: JwtUserInterface): Promise<void> {
        try {
            return await super.delete(taskId, user);
        } catch (error) {
            this.logger.error(`There was an error while Deleting task ${taskId}`, error);
            throw error;
        }
    }

    /**
     * Restores a task.
     *
     * @param {number} taskId - The ID of the task to be restored.
     * @param {JwtUserInterface} user - The user performing the operation.
     * @throws {Error} If there was an error restoring the task.
     * @returns {Promise<void>} A Promise that resolves when the task has been restored successfully.
     */
    @Transactional()
    async restoreTask(taskId: number, user: JwtUserInterface): Promise<void> {
        try {
            return await super.restore(taskId, user);
        } catch (error) {
            this.logger.error(`There was an error restoring archived task ${taskId}`, error);
            throw error;
        }
    }

    /**
     * Restores a deleted task.
     *
     * @param {number} taskId - The ID of the task to be restored.
     * @param {JwtUserInterface} user - The user performing the operation.
     * @throws {Error} If there was an error restoring the task.
     * @returns {Promise<void>} A Promise that resolves when the task has been restored successfully.
     */
    @Transactional()
    async restoreDeletedTask(taskId: number, user: JwtUserInterface): Promise<void> {
        try {
            return await super.restoreDeleted(taskId, user);
        } catch (error) {
            this.logger.error(`There was an error restoring archived task ${taskId}`, error);
            throw error;
        }
    }

    /**
     * Retrieves many archived tasks for a given user.
     *
     * @param {JwtUserInterface} user - The user for whom to retrieve tasks.
     *
     * @returns {Promise<TaskEntity[]>} - A promise that resolves to an array of archived tasks.
     *
     * @throws {Error} - If there was an error retrieving the tasks.
     */
    async getManyArchivedTasks(user: JwtUserInterface): Promise<TaskEntity[]> {
        try {
            const allowedIds = await this.authorization.getRecursiveIdsForUser(user.id, EntityTypeOptions.Folder, PermissionOptions.READ);
            const folderIds = allowedIds.map((x) => x.id);
            return await super.getManyArchived(folderIds);
        } catch (error) {
            this.logger.error(`There was an error getting many archived task`, error);
            throw error;
        }
    }

    /**
     * Shares a task.
     *
     * @param {number} taskId - The ID of the task to be shared.
     * @param {TaskSharedDto} dto - The data to be used for sharing the task.
     * @param {JwtUserInterface} user - The user who is sharing the task.
     * @param {string} authorization - The authorization token for the user.
     * @param {number} [parentTaskId=null] - The ID of the parent task, if any.
     * @returns {Promise<TaskRelationEntity>} A promise that resolves with the result of the sharing operation.
     * @throws {Error} If there was an error while sharing the task.
     */
    @Transactional()
    async shareTask(
        taskId: number,
        dto: TaskSharedDto,
        user: JwtUserInterface,
        authorization: string,
        parentTaskId: number = null
    ): Promise<TaskRelationEntity> {
        try {
            const result = await super.share(taskId, dto, user.id, authorization, parentTaskId);
            const assignees = await this.getAssignees(taskId);
            runOnTransactionCommit(async () => {
                // Prevent infinite loop in automations by checking this is not the service user
                if (user.id != SERVICE_USER_ID) {
                    const notification = new AutomationNotificationDto();
                    notification.eventType = AutomationsEventOptions.TASK_MOVED;
                    notification.applicationId = AutomationsApplicationIdOptions.TASK_MANAGEMENT;
                    notification.fromSource = AutomationsSourceOptions.API;
                    notification.fromUser = user.id;
                    notification.locationType = EntityTypeOptions.Folder;
                    notification.locationId = dto.fromFolderId.toString();
                    notification.entityId = taskId.toString();
                    const detail = new AutomationNotificationDetailTaskEventDto();
                    detail.assignees = assignees;
                    detail.moveToLocationId = dto.folderId.toString();
                    detail.moveToLocationStateId = dto.stateId.toString();
                    detail.customFields = [];
                    notification.detail = detail;
                    await this.automationsSendService.queueMessage(notification);
                }
            });
            return result;
        } catch (error) {
            this.logger.error(`There was an error sharing tasks`, error);
            throw error;
        }
    }

    /**
     * Unshares a task from a folder.
     *
     * @param {number} taskId - The ID of the task to unshare.
     * @param {number} folderId - The ID of the folder from which to unshare the task.
     * @param {JwtUserInterface} user - The user object.
     * @param {string} authorization - The authorization token.
     * @param {number} [parentTaskId=null] - The ID of the parent task if the task is a subtask.
     *
     * @returns {Promise<unknown>} - A promise representing the result of the unshare operation.
     *
     * @throws {Error} - If there is an error unsharing the task.
     */
    @Transactional()
    async unshareTask(
        taskId: number,
        folderId: number,
        user: JwtUserInterface,
        authorization: string,
        parentTaskId: number = null
    ): Promise<unknown> {
        try {
            const result = await super.unshare(taskId, folderId, user.id, authorization, parentTaskId);
            /* Permissions */
            {
            }
            return result;
        } catch (error) {
            this.logger.error(`There was an error un share a task`, error);
            throw error;
        }
    }

    /**
     * Checks if a task exists in the database based on the given ID.
     *
     * @param {number} id - The ID of the task to check.
     * @throws {NotFoundException} - Thrown if the task does not exist in the database.
     * @returns {Promise<TaskEntity>} - A promise that resolves to the task entity if it exists.
     */
    async checkTaskExistsInDB(id: number): Promise<TaskEntity> {
        const taskExists = await this.repo.findOne({where: {id}});
        if (!taskExists) {
            throw new NotFoundException(`Task with ${id} not exists`);
        }
        return taskExists;
    }

    //We should use the task service so that the permissions can also assigned to the user's not the base services
    /**
     * Copies a task to a new folder with new parent and workflow states.
     *
     * @param {TaskTreeDto} task - The task to be copied.
     * @param {number} parentTaskId - The new parent task ID.
     * @param {number} folderId - The new folder ID.
     * @param {WorkFlowStateEntity[]} oldFolderWorkflowStates - The workflow states of the old folder.
     * @param {WorkFlowEntity} newFolderWorkflow - The workflow of the new folder.
     * @param {JwtUserInterface} user - The user initiating the copy task.
     * @param {string} authorization - The authorization string for authentication.
     * @param {boolean} includeArchived - Optional. Whether to include archived tasks. Default is false.
     * @param {boolean} unarchive - Optional. Whether to unarchive the copy if the original was archived. Default is false.
     *
     * @returns {Promise<void>} - Resolves when the task copying process is complete.
     */
    @Transactional()
    async copyTask(
        task: TaskTreeDto,
        parentTaskId: number,
        folderId: number,
        oldWorkFlowStates: WorkFlowStateEntity[],
        newWorkFlow: WorkFlowEntity,
        user: JwtUserInterface,
        authorization: string,
        includeArchived = false,
        unarchive = false
    ): Promise<void> {
        const manager = this.repo.manager;
        const repoTagTaskFolder = manager.getRepository<TagTaskFolderEntity>(TagTaskFolderEntity);
        const repoCustomFieldValue = manager.getRepository<CustomFieldValueEntity>(CustomFieldValueEntity);
        const taskQueryBuilder = this.repo.createQueryBuilder('Task');
        taskQueryBuilder.leftJoinAndSelect('Task.Tags', 'Tags');
        taskQueryBuilder.leftJoinAndSelect('Task.CustomFieldValues', 'CustomFieldValues');
        taskQueryBuilder.where({id: task.id});
        if (!includeArchived) {
            taskQueryBuilder.andWhere(`Task.archived_at IS NULL`);
        }
        const taskDB = await taskQueryBuilder.getOne();

        // get the status of the old column where the original task was located
        const oldState = oldWorkFlowStates.find((x) => x.id === task.workflowStateId);

        // 2.search for the new status of the new task by compo code
        const newState = newWorkFlow.WorkFlowStates.find((x) => x.code === oldState.code);

        // 3.Using this "CreateOneTask" so that we can assign permissions to the new task as well
        const taskCopy = await this.createOneTask(
            {
                folderId: folderId,
                description: task.description,
                title: task.title,
                endDate: task.endDate,
                startDate: task.startDate,
                duration: task.duration,
                complete: task.complete,
                effort: task.effort,
                fixedStartDate: task.fixedStartDate,
                importanceId: task.importanceId,
                assignees: task.assignees,
                parentTaskId: parentTaskId ? parentTaskId : null,
                workflowStateId: newState.id,
                source: task.source,
                showOn: task.showOn,
                extra: task.extra,
                owner: task.userId,
            },
            user
        );

        // New copies will be unarchived by default, if the original was archived we archive the copy.
        if (taskDB.archivedAt && !unarchive) {
            await this.archive(taskCopy.id, user);
        }

        if (taskDB.Tags.length) {
            const tags = await repoTagTaskFolder.find({
                select: {Tag: {id: true}, type: true},
                where: {
                    Task: {id: taskDB.id},
                    type: Not(TagTaskFolderTypeOptions.TASK_TAG),
                },
                relations: {Task: true, Tag: true},
            });
            for (const tag of tags) {
                await repoTagTaskFolder.insert({
                    Task: {id: taskCopy.id},
                    type: tag.type,
                    Tag: {id: tag.Tag.id},
                });
            }
        }
        if (taskDB.CustomFieldValues.length) {
            for (const customField of taskDB.CustomFieldValues) {
                const index = await repoCustomFieldValue
                    .createQueryBuilder('CustomFieldValue')
                    .select('COALESCE(MAX(index), 0) + 1', 'index')
                    .where({Task: {id: taskDB.id}})
                    .getRawOne();
                await repoCustomFieldValue.save({
                    value: customField.value,
                    taskId: taskCopy.id,
                    customFieldDefinitionId: customField.customFieldDefinitionId,
                    index: index.index,
                });
            }
        }
        //4.the process is repeated if the task has children
        if (task.children.length) {
            for (const child of task.children) {
                await this.copyTask(child, taskCopy.id, folderId, oldWorkFlowStates, newWorkFlow, user, authorization);
            }
        }
        return;
    }
    async moveBetweenFolders(
        taskIds: number[],
        sourceFolderId: number,
        destinationFolderId: number,
        folderWorkflowStatesMapping: MapWorkflowStateDto[]
    ): Promise<MoveManyResultDto[]> {
        return await super.moveBetweenFolders(taskIds, sourceFolderId, destinationFolderId, folderWorkflowStatesMapping);
    }
    /**
     * Retrieves a list of assigned tasks for a user.
     *
     * @param {JwtUserInterface} user - The JWT user object.
     * @param {GetAssignedTasksDto} queryDto - The query parameters for retrieving assigned tasks.
     * @return {Promise<AssignedTasksTotalCountDto>} - A promise that resolves to an array of assigned tasks response DTOs.
     */
    async getAssignedTasks(user: JwtUserInterface, body: GetAssignedTasksDto): Promise<AssignedTasksTotalCountDto> {
        return await super.getAssignedTasks(user, body);
    }

    // private async grantReadOnTaskToFolderMembers(folderId: number, taskId: number): Promise<void> {
    //     // retrieve the member of the folder based on folderId
    //     const folderMembers = await this.authorization.getPermissionsForEntity(EntityTypeOptions.Folder, folderId);
    //
    //     // iterate through each member to grant read access
    //     for (const member of folderMembers) {
    //         await this.authorization.grantToUser(PermissionOptions.READ, EntityTypeOptions.Task, member.userId, taskId);
    //     }
    // }
}
