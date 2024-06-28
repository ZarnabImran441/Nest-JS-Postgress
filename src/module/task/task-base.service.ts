import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Inject,
    Injectable,
    Logger,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import * as moment from 'moment';
import {DeleteResult, In, InsertResult, IsNull, Not, Repository, UpdateResult} from 'typeorm';
import {
    AutomationsApplicationIdOptions,
    AutomationsSourceOptions,
    contructorLogger,
    getStringArrayDifferences,
    getUserFullName,
    JwtUserInterface,
    listToTree,
    modifyTree,
    PaginationDto,
    removeHtmlTags,
    S3Service,
} from '@lib/base-library';
import {runOnTransactionCommit, Transactional} from 'typeorm-transactional';
import {TaskEntity} from '../../model/task.entity';
import {TaskAttachmentBaseService} from './task-attachment/task-attachment-base.service';
import {
    CustomFieldsTaskResponseDto,
    TaskPredecessorSuccessorResponseDto,
    TaskResponseDto,
    UpdateTaskDateDto,
} from '../../dto/task/task-response.dto';
import {TaskAssigneesDto, UpdateManyTaskPositionDto, UpdateTaskDto, UpdateTaskPositionDto} from '../../dto/task/update-task.dto';
import {TaskActionEntity} from '../../model/task-action.entity';
import {TaskActionOptions} from '../../enum/task-action.enum';
import {MessageId} from '../../enum/message-id.enum';
import {TagTaskFolderEntity} from '../../model/tag-task-folder.entity';
import {TagTaskFolderTypeOptions} from '../../enum/tag.enum';
import {RelationTypeOptions} from '../../enum/folder-task-predecessor.enum';
import {TaskRelationEntity} from '../../model/task-relation.entity';
import {FolderTaskPredecessorEntity} from '../../model/folder-task-predecessor.entity';
import {FolderEntity} from '../../model/folder.entity';
import {CustomFieldValueEntity} from '../../model/custom-field-value.entity';
import {TaskFollowerEntity} from '../../model/task-follower.entity';
import {FolderViewOptions} from '../../enum/folder-position.enum';
import {CreateTaskDto} from '../../dto/task/create-task.dto';
import {checkForTaskLoop, validateCustomFieldValue, validateSource} from '../../utils/helpers';
import {TaskManySharedDto, TaskSharedDto} from '../../dto/task/task-shared.dto';
import {CreateDependencyDto} from '../../dto/task/create-predecessor.dto';
import {CustomFieldDefinitionEntity} from '../../model/custom-field-definition.entity';
import {GetFollowingTaskDto} from '../../dto/task/get-following-task.dto';
import {queries} from '../../recursive-queries';
import {AssignedTasksTotalCountDto, GetAssignedTasksDto} from '../../dto/task/assigned-tasks.dto';
import {AssignedPermissionEntity} from '../../model/assigned-permission.entity';
import {EventEmitter2} from '@nestjs/event-emitter';
import {EntityTypeOptions} from '../authorization-impl/authorization.enum';
import {ImportanceEntity} from '../../model/importance.entity';
import {EntityNotificationDto} from '../../dto/events/entity-notification.dto';
import {TaskEventNameOptions} from '../../enum/notification-event.enum';
import {NotificationService} from '../notification/notification.service';
import {UserEntity} from '../../model/user.entity';
import {SERVICE_USER_ID} from '../../const/env.const';
import {NotificationEntity} from '../../model/notification.entity';
import {
    AutomationNotificationDetailTaskEventDto,
    AutomationNotificationDto,
    AutomationsEventOptions,
    AutomationsRedisSendService,
    AutomationUtils,
} from '@lib/automations-library';
import {MapWorkflowStateDto} from '../../dto/workflow/update-workflow.dto';
import {MoveManyResultDto} from '../../dto/task/move-many-tasks.dto';
import {ArchiveTaskDto} from '../../dto/task/archive-task.dto';
import {WorkFlowStateEntity} from '../../model/workflow-state.entity';
import {WorkFlowTransitionEntity} from '../../model/workflow-transition.entity';
import {ArchivedDeletedFolderTasksDto, ArchivedDeletedFolderTasksResponseDto} from '../../dto/task/get-archived-deleted-task.dto';
import {RawDatabaseConfig} from '../../config/database.config';
import {ArchivedTypeOptions} from '../../enum/folder.enum';
import {SortDto} from '../../dto/folder/filter/folder-task-filter.dto';
/**
 * Service class for handling tasks.
 * @injectable
 */
@Injectable()
export class TaskBaseService {
    /**
     * A utility for logging messages and errors.
     *
     * @class
     * @constructor
     */
    protected logger: Logger;

    /**
     * Creates a new instance of the constructor.
     *
     * @param {Repository<TaskEntity>} repo - The repository for TaskEntity.
     * @param {TaskAttachmentBaseService} taskAttachment - The task attachment service.
     * @param {Repository<AssignedPermissionEntity>} repoAssignedPermission - The repository for AssignedPermissionEntity.
     * @param {EventEmitter2} eventEmitter - The event emitter for EventEmitter2.
     * @param {AutomationsRedisSendService} automationsSendService - The automations send service.
     * @param {NotificationService} notificationService - The notification service.
     */
    constructor(
        @InjectRepository(TaskEntity) protected readonly repo: Repository<TaskEntity>,
        protected readonly taskAttachment: TaskAttachmentBaseService,
        @InjectRepository(AssignedPermissionEntity) protected readonly repoAssignedPermission: Repository<AssignedPermissionEntity>,
        @Inject(EventEmitter2) protected readonly eventEmitter: EventEmitter2,
        protected automationsSendService: AutomationsRedisSendService,
        protected notificationService: NotificationService,
        protected readonly s3Service: S3Service
    ) {
        this.logger = new Logger(this.constructor.name);
        contructorLogger(this);
    }

    /**
     * Retrieves assigned tasks based on the provided user and query parameters.
     *
     * @param {JwtUserInterface} user - The user for whom to retrieve assigned tasks.
     * @param {GetAssignedTasksDto} queryDto - The query parameters for filtering the assigned tasks.
     * @returns {Promise<AssignedTasksTotalCountDto[]>} - A promise that resolves to an array of assigned task response objects.
     */
    async getAssignedTasks(user: JwtUserInterface, body: GetAssignedTasksDto): Promise<AssignedTasksTotalCountDto> {
        const {filter, sort, pagination} = body;
        const sorting = this.createSort(sort),
            {offset, limit} = this.createPagination(pagination),
            str = [''],
            params: unknown[] = [];
        let filterString = '',
            startParamIndex = 4;
        if (filter?.folderId) {
            str.push(`TR.FOLDER_ID = ${'$' + startParamIndex++}`);
            params.push(filter.folderId);
        }
        if (filter?.stateIds) {
            str.push(`WS.ID = ANY (${'$' + startParamIndex++})`);
            params.push(filter.stateIds);
        }
        if (filter?.active) {
            str.push(`WS.COMPLETED = ${'$' + startParamIndex++}`);
            params.push(false);
        }
        if (filter?.importanceId) {
            str.push(`T.IMPORTANCE_ID = ${'$' + startParamIndex++}`);
            params.push(filter.importanceId);
        }
        if (filter?.endDateFrom && filter?.endDateTo) {
            str.push(`T.END_DATE BETWEEN ${'$' + startParamIndex++} AND ${'$' + startParamIndex++}`);
            params.push(filter.endDateFrom, filter.endDateTo);
        }
        if (params.length > 0) {
            filterString = str.join(' AND ');
        }
        const baseQuery = `WITH filtered_tasks AS (
                    SELECT 
                        T.id, 
                        T.TITLE,
                        T.ASSIGNEES,
                        T.END_DATE AS "endDate",
                        T.START_DATE AS "startDate", 
                        T.IMPORTANCE_ID AS "importanceId", 
                        F.TITLE AS "folderTitle", 
                        F.ID AS "folderId",
                        TR.workflow_state_id as "stateId",
                        COALESCE((SELECT JSON_AGG(X) FROM (SELECT A.assigned_approvers as "assignedApprovers",A.created_at as "createdAt",A.created_by as "createdBy",A.deleted_at as "deletedAt",A.required_approvals as "requiredApprovals",A.resolution_date as "resolutionDate",A.status,A.task_id as "taskId",A.updated_at as "updatedAt", A.ID,
                                                COALESCE((SELECT JSON_AGG(Y) FROM (SELECT * FROM approval_attachment AA WHERE AA.approval_id = A.ID) AS Y),JSON_ARRAY()) AS attachments,
                                                COALESCE((SELECT JSON_AGG(Z) FROM (SELECT * FROM approval_action AA WHERE AA.approval_id = A.ID) AS Z),JSON_ARRAY()) AS actions
                        FROM APPROVAL A WHERE A.TASK_ID = T.ID) AS X),JSON_ARRAY()) AS approvals,
                        COALESCE((SELECT JSON_AGG(X) FROM (SELECT UA.id,UA."checkedOn",UA.checked,UA.description,UA.task_id as "taskId",UA.user_id as "userId" FROM USER_ACTION UA WHERE UA.TASK_ID = T.ID) AS X),JSON_ARRAY()) AS "userActions",
                        (SELECT WS.TITLE FROM WORKFLOW_STATE WS WHERE WS.ID = TR.WORKFLOW_STATE_ID) AS "stateTitle"
                    FROM TASK T 
                    INNER JOIN TASK_RELATION TR ON TR.CHILD_TASK_ID = T.ID
                    INNER JOIN FOLDER F ON F.ID = TR.FOLDER_ID
                    INNER JOIN WORKFLOW_STATE WS ON TR.WORKFLOW_STATE_ID = WS.ID
                    WHERE $1 = ANY(T.ASSIGNEES) AND T.ARCHIVED_AT IS NULL AND T.DELETED_AT IS NULL 
                    ${filterString}
                )
                SELECT 
                    *,
                    (SELECT COUNT(id)
                    FROM filtered_tasks) AS total_count
                FROM filtered_tasks
                ${sorting}
                OFFSET $2 LIMIT $3;`;

        const tasks = await this.repo.query(baseQuery, [user.id, offset, limit, ...params]);
        const totalCount = tasks && tasks[0] ? tasks[0].total_count : 0;

        for (const task of tasks) {
            for (const approval of task.approvals) {
                if (approval.attachments && approval.attachments.length > 0) {
                    for (const attachment of approval.attachments) {
                        const fileNameUrl = await this.s3Service.getSignedFileUrl(attachment.file_name, {expiresIn: 3600});
                        const thumbnailUrl = await this.s3Service.getSignedFileUrl(attachment.thumbnail_name, {expiresIn: 3600});
                        Object.assign(attachment, {fileNameUrl, thumbnailUrl});
                    }
                }
            }
            delete task.total_count;
        }

        return {totalCount: Number(totalCount), tasks};
    }

    /**
     * Retrieves the folder id associated with a given task id.
     *
     * @async
     * @param {number} taskId - The id of the task.
     * @return {Promise<number>} - The folder id.
     */
    async getFolderIdByTaskId(taskId: number): Promise<number> {
        const repoTaskRelation = this.repo.manager.getRepository(TaskRelationEntity);
        const result = await repoTaskRelation
            .createQueryBuilder('task_relation')
            .select('task_relation.folder_id', 'folderId')
            .where('task_relation.child_task_id =:task_id', {task_id: taskId})
            .getRawOne();
        return result.folderId;
    }

    /**
     * Retrieves a task by its ID.
     *
     * @param {number} taskId - The ID of the task to retrieve.
     * @param {string} userId - The ID of the user.
     * @param {number} folderId - The ID of the folder.
     * @return {Promise<TaskResponseDto>} - A promise that resolves to the retrieved task.
     */
    async getOneById(taskId: number, userId: string, folderId: number): Promise<TaskResponseDto> {
        const manager = this.repo.manager;
        const sql = `SELECT T.ID,
                            T.TITLE,
                            T.DESCRIPTION,
                            T.start_date AS "startDate",
                            T.end_date AS "endDate",
                            T.COMPLETE,
                            T.DURATION,
                            T.USER_ID                                           AS "ownerId",
                            T.CREATED_AT    AS "createdAt",
                            T.UPDATED_AT     AS "updatedAt",
                            T.IMPORTANCE_ID                                AS "importanceId",
                            T.SOURCE,
                            T.EXTRA,
                            T.SHOW_ON  AS "showOn",
                            (SELECT ARRAY
                                        (SELECT TS.USER_ID
                                         FROM TASK_FOLLOWER TS
                                         WHERE TS.TASK_ID = $1))                AS FOLLOWERS,
                            T.EFFORT,
                            T.FIXED_START_DATE   AS "fixedStartDate",
                            (SELECT ARRAY
                                        (SELECT TR.PARENT_TASK_ID
                                         FROM TASK_RELATION TR
                                         WHERE TR.CHILD_TASK_ID = T.ID
                                           AND TR.FOLDER_ID = TT.FOLDER_ID
                                           AND TR.PARENT_TASK_ID IS NOT NULL))  AS PARENTS,
                            (SELECT JSON_AGG(X)
                             FROM (SELECT TC.ID,
                                          TC.TITLE,
                                          TC.ASSIGNEES AS CHILDASSIGNEES,
                                          --(SELECT ARRAY
                                          --            ($ { queries. taskAssignees } AND CAST(ASSIGNED_PERMISSION.ENTITY_ID as integer) = TC.ID)) AS CHILDASSIGNEES,
                                          (SELECT JSON_AGG(X)
                                           FROM (SELECT TR.WORKFLOW_STATE_ID       AS "workflowStateId",
                                                        WS.WORKFLOW_ID       AS "workflowId",
                                                        F.ID     AS "folderId"
                                                 FROM WORKFLOW_STATE WS
                                                          INNER JOIN WORKFLOW W ON W.ID = WS.WORKFLOW_ID
                                                          INNER JOIN FOLDER F ON F.WORKFLOW_ID = W.ID
                                                 WHERE F.ID = TR.FOLDER_ID
                                                   AND TR.WORKFLOW_STATE_ID = WS.ID) AS X) AS CHILDSTATES
                                   FROM TASK TC
                                            INNER JOIN TASK_RELATION TR ON TR.CHILD_TASK_ID = TC.ID
                                   WHERE TR.PARENT_TASK_ID = T.ID
                                     AND TR.FOLDER_ID = TT.FOLDER_ID
                                     AND TC.archived_at IS NULL
                                     AND TC.deleted_at IS NULL
                                     ORDER BY TR.STATE_INDEX) AS X)               AS CHILDREN,
                                   
                                 (SELECT ARRAY
                                        (SELECT LT.TAG_ID
                                         FROM TAGS_TASK_FOLDER LT
                                                  INNER JOIN TAGS L
                                                             ON (L.ID = LT.TAG_ID) AND (L.USER_ID IS NULL OR L.USER_ID = $2)
                                         WHERE LT.TASK_ID = T.ID
                                           AND LT.TYPE = 'taskTag'))            AS TAGS,
                                           
                            (SELECT LT.TAG_ID as id
                                   FROM TAGS_TASK_FOLDER LT
                                            INNER JOIN TAGS L
                                                       ON L.ID = LT.TAG_ID
                                   WHERE LT.TASK_ID = T.ID
                                     AND LT.TYPE = 'prominentTag')        AS "commonProminentTagId",

                        (SELECT LT.TAG_ID as id
                                   FROM TAGS_TASK_FOLDER LT
                                            INNER JOIN TAGS L
                                                       ON (L.ID = LT.TAG_ID) AND (LT.USER_ID = $2)
                                   WHERE LT.TASK_ID = T.ID
                                     AND LT.TYPE = 'userProminentTag')    AS "userProminentTagId",
                            
                            T.ASSIGNEES,
                            -- (SELECT ARRAY
                            --             ($ { queries.taskAssignees } AND CAST(ASSIGNED_PERMISSION.ENTITY_ID as integer) = T.ID))   AS ASSIGNEES,
                            COALESCE((SELECT JSON_AGG(X)
                             FROM (SELECT PRED.ID,
                                          PRED."relationType",
                                          PRED.TASK_SUCCESSOR_ID AS "taskId"
                                   FROM FOLDER_TASK_PREDECESSOR PRED
                                   WHERE PRED.TASK_PREDECESSOR_ID = T.ID) AS X),JSON_ARRAY()) AS SUCCESSORS,
                            COALESCE((SELECT JSON_AGG(X)
                             FROM (SELECT PRED.ID,
                                          PRED."relationType",
                                          PRED.TASK_PREDECESSOR_ID AS "taskId"
                                   FROM FOLDER_TASK_PREDECESSOR PRED
                                   WHERE PRED.TASK_SUCCESSOR_ID = T.ID) AS X),JSON_ARRAY())   AS PREDECESSORS,
                            (SELECT JSON_AGG(X)
                             FROM (SELECT TR.WORKFLOW_STATE_ID    AS "workflowStateId",
                                          WS.WORKFLOW_ID     AS "workflowId" ,
                                          F.ID   AS "folderId",
                                          SS.ID AS "systemStageId"
                                   FROM WORKFLOW_STATE WS
                                            INNER JOIN WORKFLOW W ON W.ID = WS.WORKFLOW_ID
                                            INNER JOIN FOLDER F ON F.WORKFLOW_ID = W.ID
                                            INNER JOIN TASK_RELATION TR ON TR.FOLDER_ID = F.ID AND TR.WORKFLOW_STATE_ID = WS.ID
                                            LEFT JOIN DISPLACEMENT_CODE DC ON WS.DISPLACEMENT_CODE_ID = DC.ID
                                            INNER JOIN SYSTEM_STAGE SS ON WS.SYSTEM_STAGE_ID = SS.ID OR SS.ID = DC.SYSTEM_STAGE_ID
                                   WHERE TR.CHILD_TASK_ID = T.ID order by TR.ID) AS X)         AS STATES,
                                   T.EFFORT,
                                   T.FIXED_START_DATE  AS "fixedStartDate",
                            (SELECT ARRAY
                                        (SELECT TR.PARENT_TASK_ID
                                         FROM TASK_RELATION TR
                                         WHERE TR.CHILD_TASK_ID = T.ID
                                           AND TR.FOLDER_ID = TT.FOLDER_ID
                                           AND TR.PARENT_TASK_ID IS NOT NULL))  AS PARENTS
                     FROM TASK T
                              JOIN TASK_RELATION TT ON TT.CHILD_TASK_ID = T.ID
                     WHERE T.ID = $1
                       AND T.archived_at IS NULL
                       AND T.deleted_at IS NULL
                       AND TT.FOLDER_ID = $3`;

        const found = await manager.query(sql, [taskId, userId, folderId]);
        if (!found || found.length == 0) {
            return null;
        }
        //todo : fix this
        return found[0];
    }

    //The return type should be updateResult
    //update task - Assignee Version
    /*TODO: see if task_user_ap is enough
async updateAssignees(taskId: number, dto: TaskAssigneesDto, user: JwtUserInterface): Promise<void> {
const userId = user.id;
const manager = this.repo.manager;
const repoTaskUser = manager.getRepository<TaskUserEntity>(TaskUserEntity),
repoTaskAction = manager.getRepository<TaskActionEntity>(TaskActionEntity);
// if (dto.assignees) {
const findTaskMembersDB = await repoTaskUser.find({
where: {Task: {id: taskId}},
// relations: {User: true},
});

if (findTaskMembersDB.length) {
const findTaskMembersDBIds = findTaskMembersDB.map((m) => m.userId );
const newAssignedMember = dto.assignees.filter((sf) => !findTaskMembersDBIds.some((sfd) => sf === sfd));
const removedAssignedMembers = findTaskMembersDBIds.filter((word) => !dto.assignees.includes(word));
if (newAssignedMember.length) {
await repoTaskAction.insert({
Task: {id: taskId},
action: TaskActionOptions.ASSIGN,
messageId: MessageId.ASSIGN_TASK,
parameters: {members: {assigned: newAssignedMember.map((member) => ({id: member}))}},
task: dto,
user: {id: userId},
});
} else {
await repoTaskAction.insert({
Task: {id: taskId},
action: TaskActionOptions.UNASSIGN_TASK,
messageId: MessageId.UNASSIGN_TASK,
parameters: {members: {removed: removedAssignedMembers.map((member) => ({id: member}))}},
task: dto,
user: {id: userId},
});
}
} else {
await repoTaskAction.insert({
Task: {id: taskId},
action: TaskActionOptions.ASSIGN,
messageId: MessageId.ASSIGN_TASK,
parameters: {members: {assigned: dto.assignees.map((member) => ({id: member}))}},
task: dto,
user: {id: userId},
});
}
await repoTaskUser.delete({Task: {id: taskId}});
if (dto.assignees.length) {
for (const assignee of dto.assignees) {
await repoTaskUser.insert({Task: {id: taskId}, userId: assignee });
}
}
// }
return;
}
*/
    /**
     * Updates a task with the specified taskId using the given data and user credentials.
     *
     * @param {number} taskId - The ID of the task to update.
     * @param {UpdateTaskDto} data - The updated task data.
     * @param {JwtUserInterface} user - The user credentials.
     * @returns {Promise<TaskEntity>} - The updated task entity.
     */
    async update(taskId: number, data: UpdateTaskDto, user: JwtUserInterface): Promise<TaskEntity> {
        const userId = user.id;
        const manager = this.repo.manager;
        // try {
        const repoTaskAction = manager.getRepository<TaskActionEntity>(TaskActionEntity),
            repoTagTaskFolder = manager.getRepository<TagTaskFolderEntity>(TagTaskFolderEntity),
            repoTaskFollower = manager.getRepository<TaskFollowerEntity>(TaskFollowerEntity),
            taskDB = await this.repo.findOne({where: {id: taskId}});

        const newData = {
            ...data,
            updatedAt: new Date(),
            ...(data.importanceId && {Importance: {id: data.importanceId}}),
        };
        const folder = await manager.getRepository<FolderEntity>(FolderEntity).findOne({where: {id: data.folderId}});
        delete newData.importanceId;
        delete newData.folderId;

        if ('userProminentTagId' in data) {
            //delete tag if assigned to a task
            const tagTaskFolderToRemove = await repoTagTaskFolder.findBy({
                Task: {id: taskId},
                type: TagTaskFolderTypeOptions.USER_PROMINENT_TAG,
                userId,
            });
            await repoTagTaskFolder.remove(tagTaskFolderToRemove);

            if (data.userProminentTagId != null) {
                await repoTagTaskFolder.insert({
                    Tag: {
                        id: data.userProminentTagId,
                    },
                    Task: {id: taskId},
                    type: TagTaskFolderTypeOptions.USER_PROMINENT_TAG,
                    userId,
                });
            }
            delete newData.userProminentTagId;
        }

        if ('commonProminentTagId' in data) {
            //delete tag if assigned to a task
            const tagTaskFolderToRemove = await repoTagTaskFolder.findBy({
                Task: {id: taskId},
                type: TagTaskFolderTypeOptions.COMMON_PROMINENT_TAG,
            });
            await repoTagTaskFolder.remove(tagTaskFolderToRemove);

            if (data.commonProminentTagId != null) {
                await repoTagTaskFolder.insert({
                    Tag: {
                        id: data.commonProminentTagId,
                    },
                    Task: {id: taskId},
                    type: TagTaskFolderTypeOptions.COMMON_PROMINENT_TAG,
                });
            }
            delete newData.commonProminentTagId;
        }
        const keys = Object.keys(newData);
        if (keys.length > 0) {
            const startDate = newData.startDate || taskDB.startDate;
            const endDate = newData.endDate || taskDB.endDate;
            if ((keys.includes('startDate') || keys.includes('endDate')) && startDate && endDate && startDate > endDate) {
                throw new BadRequestException(`Out of Range Start or End Date`);
            }
            await this.repo.update({id: taskId}, {...newData, id: taskId});
            const updates: {
                property: string;
                oldValue: string;
                newValue: string;
            }[] = [];
            for (const key in data) {
                const oldValue = taskDB[key];
                const newValue = data[key];
                if (oldValue !== newValue) {
                    if (key == 'folderId') continue;

                    if (key === 'description') {
                        updates.push({
                            property: key,
                            oldValue: removeHtmlTags(oldValue) ?? null,
                            newValue: removeHtmlTags(newValue),
                        });
                    } else {
                        updates.push({property: key, oldValue: oldValue ?? null, newValue});
                    }

                    // Automations notification
                    if (key == 'importanceId') {
                        const folderId = await this.getFolderIdByTaskId(taskId);
                        const assignees = await this.getAssignees(taskId);
                        // eslint-disable-next-line @typescript-eslint/require-await
                        runOnTransactionCommit(async () => {
                            if (userId != SERVICE_USER_ID) {
                                const notification = new AutomationNotificationDto();
                                notification.eventType = AutomationsEventOptions.TASK_IMPORTANCE_CHANGED;
                                notification.applicationId = AutomationsApplicationIdOptions.TASK_MANAGEMENT;
                                notification.fromSource = AutomationsSourceOptions.API;
                                notification.fromUser = user.id;
                                notification.locationType = EntityTypeOptions.Folder;
                                notification.locationId = folderId.toString();
                                notification.entityId = taskId.toString();
                                const detail = new AutomationNotificationDetailTaskEventDto();
                                detail.assignees = assignees;
                                detail.importanceId = newValue.toString();
                                detail.customFields = [];
                                notification.detail = detail;
                                await this.automationsSendService.queueMessage(notification);
                            }
                        });
                    } // Automations Notification End
                }
            }

            //these functions are only called when change in dates occurr
            if ((newData.startDate || newData.endDate) && data.folderId) {
                await this.handleTaskDateChanges(taskId, data.folderId, user);
            }

            if (data.complete) {
                await this.updateParentComplete(taskId);
            }
            if (updates.length > 0) {
                await repoTaskAction.insert({
                    Task: taskDB,
                    task: taskDB,
                    action: TaskActionOptions.UPDATE,
                    messageId: MessageId.UPDATE_TASK,
                    parameters: {updates},
                    user: {id: userId},
                });
            }
            const recipients = (await this.notificationService.getTaskNotificationRecipients(taskId)).filter(
                (x) => x !== userId || x !== SERVICE_USER_ID
            );
            const emailDto = await this.notificationService.setTaskEmailDto(taskId, user, updates, TaskActionOptions.UPDATE);

            // add task editor as follower if it hasn't been done
            if (data?.endDate || data?.startDate || data?.description || data?.title || data?.importanceId) {
                if (!(await repoTaskFollower.exists({where: {taskId, userId}}))) {
                    await repoTaskFollower.insert({
                        Task: {id: taskId},
                        userId,
                    });
                }
            }

            let spaceId: number | null = null;
            if (folder) {
                const [{id}] = await this.repo.query(queries.getSpaceWithFolderIdSql, [folder.id]);
                spaceId = id || null;
            }

            runOnTransactionCommit(() => {
                for (const update of updates) {
                    if (!['title', 'description'].includes(update.property)) continue;
                    this.eventEmitter.emit(TaskEventNameOptions.TASK_UPDATE, {
                        data: {
                            event: TaskEventNameOptions.TASK_UPDATE,
                            folderId: folder.id,
                            taskId: taskId,
                            spaceId,
                            userId,
                            message: this.notificationService.setNotificationMessage({
                                entity: 'task',
                                entityTitle: taskDB.title,
                                sender: user.firstName + ' ' + user.lastName,
                                actions: {
                                    updated: update,
                                },
                            }),
                            ...emailDto,
                        },
                        userId,

                        recipients: recipients.length > 0 ? recipients : [userId],
                    } as EntityNotificationDto);
                }
            });
        }

        return taskDB;
    }

    /**
     * Retrieves the assignees for a given task ID.
     *
     * @param {number} taskId - The ID of the task.
     * @returns {Promise<string[]>} - A promise that resolves to an array of assignees.
     */
    async getAssignees(taskId: number): Promise<string[]> {
        const assignees = await this.repo.findOne({select: {assignees: true}, where: {id: taskId}});
        return assignees?.assignees;
    }

    async getTags(taskId: number): Promise<string[]> {
        const manager = this.repo.manager;
        const result = await manager.query(
            `
                SELECT DISTINCT tag_id
                FROM "${RawDatabaseConfig.schema}".tags_task_folder
                WHERE task_id=$1
            `,
            [taskId]
        );
        const tagIds: string[] = result.map((row: {tag_id: number}) => row.tag_id.toString());
        return tagIds;
    }

    /**
     * Retrieves the importance of a task from the database.
     *
     * @param {number} taskId - The ID of the task.
     * @returns {Promise<string>} - A promise that resolves with the importance ID as a string.
     */
    async getImportance(taskId: number): Promise<string> {
        const taskDb = await this.repo.findOne({select: {importanceId: true}, where: {id: taskId}});
        return taskDb?.importanceId.toString();
    }

    /**
     * Updates the date of successor tasks for a specific task.
     *
     * @param folderId - The folder ID of the task.
     * @param taskId - The task ID.
     * @param user - The user performing the update.
     *
     * @throws - Throws an error if an error occurs during the update process.
     *
     * @return - Returns a Promise that resolves with no value once the update is complete.
     */
    @Transactional()
    async updateSuccessorTaskDate(folderId: number, taskId: number, user: JwtUserInterface | UserEntity): Promise<void> {
        const successor = await this.getSuccessorTasks(taskId, folderId);
        if (successor.length) {
            for (const {id, startDate, endDate, parent_task_id, relationType} of successor) {
                if (parent_task_id) {
                    await this.updateSuccessor(id, parent_task_id, relationType, startDate, endDate, user);
                    await this.updateParentTasksQuery(folderId, id, user);
                }
            }
        }
    }

    /**
     * Updates the successor task based on the given relationship type and dates.
     *
     * @param {number} taskId - The ID of the successor task.
     * @param {number} predecessorTaskId - The ID of the predecessor task.
     * @param {string} relation - The relationship type between the tasks (START_TO_START, START_TO_FINISH, FINISH_TO_START, FINISH_TO_FINISH).
     * @param {Date} startDate - The new start date for the successor task.
     * @param {Date} endDate - The new end date for the successor task.
     * @param {JwtUserInterface | UserEntity} user - The user performing the operation.
     * @return {Promise<void>} A Promise that resolves when the successor task is updated successfully.
     */
    @Transactional()
    async updateSuccessor(
        taskId: number,
        predecessorTaskId: number,
        relation: string,
        startDate: Date,
        endDate: Date,
        user: JwtUserInterface | UserEntity
    ): Promise<void> {
        const repoTask = this.repo.manager.getRepository<TaskEntity>(TaskEntity);
        const {startDate: predecessorStartDate, endDate: predecessorEndDate} = await repoTask.findOne({where: {id: predecessorTaskId}});
        const duration = moment(endDate).diff(moment(startDate), 'days');
        switch (relation) {
            case RelationTypeOptions.START_TO_START:
                if (predecessorStartDate <= startDate) break;
                const SSEndDate = moment(predecessorStartDate).add(duration, 'days').toDate();
                await this.updateTaskDate(taskId, predecessorStartDate, SSEndDate, user);
                break;
            case RelationTypeOptions.START_TO_FINISH:
                if (predecessorStartDate <= endDate) break;
                const SFStartDate = moment(predecessorStartDate).subtract(duration, 'days').toDate();
                await this.updateTaskDate(taskId, SFStartDate, predecessorStartDate, user);
                break;
            case RelationTypeOptions.FINISH_TO_START:
                if (predecessorEndDate <= startDate) break;
                const FSEndDate = moment(predecessorEndDate).add(duration, 'days').toDate();
                await this.updateTaskDate(taskId, predecessorEndDate, FSEndDate, user);
                break;
            case RelationTypeOptions.FINISH_TO_FINISH:
                if (predecessorEndDate <= endDate) break;
                const FFStartDate = moment(predecessorEndDate).subtract(duration, 'days').toDate();
                await this.updateTaskDate(taskId, FFStartDate, predecessorEndDate, user);
                break;
            default:
                break;
        }
    }

    /**
     * Update the date for a child task based on the parent task's dates.
     * The child task's start date and end date will be adjusted if necessary.
     *
     * @param {Date} parentStartDate - The start date of the parent task.
     * @param {Date} parentEndDate - The end date of the parent task.
     * @param {Date} startDate - The start date of the child task.
     * @param {Date} endDate - The end date of the child task.
     * @param {number} childId - The ID of the child task.
     * @param {JwtUserInterface|UserEntity} user - The user performing the update.
     * @return {Promise<void>} - A Promise that resolves when the update is complete.
     */
    @Transactional()
    async updateChildTaskDate(
        parentStartDate: Date,
        parentEndDate: Date,
        startDate: Date,
        endDate: Date,
        childId: number,
        user: JwtUserInterface | UserEntity
    ): Promise<void> {
        let smallestStartDate = null,
            largestEndDate = null;

        //start date is only changed when start date is null or is lesser than its parent
        if (parentStartDate && parentStartDate > startDate) {
            smallestStartDate = parentStartDate;
            if (parentEndDate && endDate) {
                const diffStartDays = moment(parentStartDate).diff(moment(startDate), 'days');
                const diffEndDays = moment(parentEndDate).diff(moment(endDate), 'days');
                largestEndDate = moment(endDate).add(diffStartDays > diffEndDays ? diffEndDays : diffStartDays, 'days');
            }
        }

        //end date is only changed when end date is null or is greater than its parent
        if (parentEndDate && parentEndDate < endDate) {
            largestEndDate = parentEndDate;
            if (parentStartDate && startDate) {
                const diffEndDays = Math.abs(moment(endDate).diff(moment(parentEndDate), 'days'));
                const diffStartDays = Math.abs(moment(startDate).diff(moment(parentStartDate), 'days'));
                smallestStartDate = moment(startDate).subtract(diffEndDays > diffStartDays ? diffStartDays : diffEndDays, 'days');
            }
        }

        await this.updateTaskDate(childId, smallestStartDate, largestEndDate, user);
    }

    /**
     * Updates the start and end dates of a parent task based on the start and end dates of its child tasks.
     *
     * @param {number} taskId - The ID of the parent task to update.
     * @param {JwtUserInterface | UserEntity} user - The user performing the update.
     *
     * @returns {Promise<void>} A Promise that resolves when the update is completed.
     *
     * @throws {Error} If there is an error while updating the task dates.
     *
     * @transactional
     */
    @Transactional()
    async updateParentTaskDate(taskId: number, user: JwtUserInterface | UserEntity): Promise<void> {
        const children = await this.getChildTasks(taskId);
        let smallestStartDate = null,
            largestEndDate = null;

        for (const child of children) {
            smallestStartDate = smallestStartDate > child.startDate || smallestStartDate === null ? child.startDate : smallestStartDate;
            largestEndDate = largestEndDate < child.endDate || largestEndDate === null ? child.endDate : largestEndDate;
        }

        // update the start and end dates of the parent task
        await this.updateTaskDate(taskId, smallestStartDate, largestEndDate, user);
    }

    /**
     * Updates the completion status of the parent task based on the completion status of its child tasks.
     *
     * @param {number} taskId - The ID of the task whose parent completion status needs to be updated.
     * @returns {Promise<void>} - A promise that resolves when the parent task completion status has been updated.
     *
     * @throws {Error} - If there is an error in updating the parent task completion status.
     */
    @Transactional()
    async updateParentComplete(taskId: number): Promise<void> {
        const repoTask = this.repo.manager.getRepository<TaskEntity>(TaskEntity);
        const parent = await this.getParentTask(taskId);

        if (parent) {
            const children = await this.getChildTasks(parent.id);
            let total = 0;
            for (const {complete} of children) {
                total += complete;
            }
            total = total / children.length;
            await repoTask.update(parent.id, {complete: total, id: parent.id});
            await this.updateParentComplete(parent.id);
        }
    }

    /**
     * Retrieves the list of child tasks for a given task ID.
     * @param {number} taskId - The ID of the parent task.
     * @return {Promise<TaskEntity[]>} - A Promise that resolves to an array of TaskEntity objects representing the child tasks.
     * @throws {Error} - If there is an error while retrieving the child tasks.
     */
    async getChildTasks(taskId: number): Promise<TaskEntity[]> {
        const manager = this.repo.manager;
        try {
            const repoTaskRelation = manager.getRepository<TaskRelationEntity>(TaskRelationEntity);
            const childTasks = await repoTaskRelation
                .createQueryBuilder('TaskRelationEntity')
                .leftJoinAndSelect('TaskRelationEntity.ChildTask', 'ChildTask')
                .where({
                    ParentTask: {id: taskId},
                })
                .andWhere('ChildTask.archived_at IS NULL')
                .andWhere('ChildTask.deleted_at IS NULL')
                .getMany();

            return childTasks?.map((task) => (task.ChildTask ? task.ChildTask : null));
        } catch (error) {
            this.logger.error(`There was an error while updating a task ${taskId}`, JSON.stringify(error));
            throw error;
        }
    }

    /**
     * Retrieves a list of successor tasks for a given task in a specific folder.
     *
     * @param {number} taskId - The ID of the task.
     * @param {number} folderId - The ID of the folder containing the task.
     * @return {Promise<TaskPredecessorSuccessorResponseDto[]>} - A promise that resolves to an array of TaskPredecessorSuccessorResponseDto objects representing the successor tasks.
     */
    async getSuccessorTasks(taskId: number, folderId: number): Promise<TaskPredecessorSuccessorResponseDto[]> {
        try {
            const repoTask = this.repo.manager.getRepository<FolderTaskPredecessorEntity>(FolderTaskPredecessorEntity);
            return await repoTask.query(
                `WITH RECURSIVE TASKS AS (SELECT NULL::INTEGER         PARENT_TASK_ID,
                                                 TR.CHILD_TASK_ID,
                                                 FTP."relationType" AS "relationType",
                                                 T.ID,
                                                 T.start_date AS "startDate",
                                                 T.end_date AS "endDate"
                                          FROM TASK_RELATION TR
                                                   INNER JOIN TASK T ON T.ID = TR.CHILD_TASK_ID
                                                   INNER JOIN FOLDER_TASK_PREDECESSOR FTP ON T.ID = FTP.TASK_PREDECESSOR_ID
                                          WHERE TR.FOLDER_ID = $1
                                            AND TR.CHILD_TASK_ID = $2
                                            AND T.archived_at IS NULL
                                            AND T.deleted_at IS NULL
                                          UNION ALL
                                          SELECT FTP.TASK_PREDECESSOR_ID AS PARENT_TASK_ID,
                                                 FTP.TASK_SUCCESSOR_ID   AS CHILD_TASK_ID,
                                                 FTP."relationType"      AS "relationType",
                                                 T.ID,
                                                 T.start_date AS "startDate",
                                                 T.end_date AS "endDate"
                                          FROM FOLDER_TASK_PREDECESSOR FTP
                                                   INNER JOIN TASKS TS ON TS.CHILD_TASK_ID = FTP.TASK_PREDECESSOR_ID
                                                   INNER JOIN TASK T ON T.ID = FTP.TASK_SUCCESSOR_ID
                                          WHERE FTP.FOLDER_ID = $1 AND T.archived_at IS NULL AND T.deleted_at IS NULL)
                     CYCLE CHILD_TASK_ID
                SET IS_CYCLE USING PATH
                SELECT *
                FROM TASKS`,
                [folderId, taskId]
            );
        } catch (error) {
            this.logger.error(`There was an error while updating a task ${taskId}`, JSON.stringify(error));
            throw error;
        }
    }

    /**
     * Retrieves the parent task of a given task.
     *
     * @param {number} taskId - The unique identifier of the task.
     * @returns {Promise<TaskEntity>} - The parent task of the given task.
     * @throws {Error} - If there is an error while retrieving the parent task.
     */
    async getParentTask(taskId: number): Promise<TaskEntity> {
        const manager = this.repo.manager;
        try {
            const repoTaskRelation = manager.getRepository<TaskRelationEntity>(TaskRelationEntity);
            const parentTask = await repoTaskRelation
                .createQueryBuilder('TaskRelationEntity')
                .leftJoinAndSelect('TaskRelationEntity.ParentTask', 'ParentTask')
                .leftJoinAndSelect('TaskRelationEntity.ChildTask', 'ChildTask')
                .where('ChildTask.archived_at IS NULL')
                .andWhere('ChildTask.deleted_at IS NULL')
                .andWhere({id: taskId})
                .getOne();

            return parentTask?.ParentTask;
        } catch (error) {
            this.logger.error(`There was an error while updating a task ${taskId}`, JSON.stringify(error));
            throw error;
        }
    }

    /**
     * Updates the start date and end date of a project based on the tasks within the specified folder.
     *
     * @param {number} folderId - The ID of the folder containing the tasks.
     *
     * @return {Promise<void>} - A Promise that resolves with no value upon successful updating of project dates.
     */
    @Transactional()
    async updateProjectDate(folderId: number): Promise<void> {
        try {
            const repoTask = this.repo.manager.getRepository<TaskRelationEntity>(TaskRelationEntity);
            const repoFolder = this.repo.manager.getRepository<FolderEntity>(FolderEntity);
            const projectTasks = await repoTask.find({
                where: {Folder: {id: folderId}, ChildTask: {archivedAt: null, deletedAt: null}},
                relations: {ChildTask: true},
            });
            let startDate = null,
                endDate = null;
            for (const {ChildTask} of projectTasks) {
                startDate = startDate === null || startDate > ChildTask.startDate ? ChildTask.startDate : startDate;
                endDate = endDate === null || endDate < ChildTask.endDate ? ChildTask.endDate : endDate;
            }

            const folder = await repoFolder.findOne({where: {id: folderId}});

            const updateDates = {
                ...(folder.startDate > startDate && {startDate}),
                ...(folder.endDate < endDate && {endDate}),
            };
            if (Object.keys(updateDates).length) {
                await repoFolder.update(folderId, {...updateDates, id: folderId});
            }
        } catch (error) {
            this.logger.error(`There was an error while updating project ${folderId}`, JSON.stringify(error));
            throw error;
        }
    }

    /**
     * Update the start and end dates of a task.
     *
     * @param {number} taskId - The ID of the task to update.
     * @param {Date} [startDate=null] - The new start date for the task.
     * @param {Date} [endDate=null] - The new end date for the task.
     * @param {JwtUserInterface|UserEntity} user - The user updating the task.
     *
     * @returns {Promise<void>} - A promise that resolves when the task has been updated.
     */
    @Transactional()
    async updateTaskDate(taskId: number, startDate: Date = null, endDate: Date = null, user: JwtUserInterface | UserEntity): Promise<void> {
        try {
            const repoTask = this.repo.manager.getRepository<TaskEntity>(TaskEntity);
            const repoTaskRelation = this.repo.manager.getRepository<TaskRelationEntity>(TaskRelationEntity);
            const data = {...(startDate && {startDate}), ...(endDate && {endDate})};
            if (Object.keys(data).length) {
                const task = await this.repo.findOne({where: {id: taskId}, relations: {}});
                const parentFolder = await repoTaskRelation.findOne({
                    where: {ChildTask: {id: taskId}},
                    relations: {Folder: true},
                });
                await repoTask.update({id: taskId}, {...data, id: taskId});
                const recipients = (await this.notificationService.getTaskNotificationRecipients(taskId)).filter(
                    (x) => x !== user.id || x !== SERVICE_USER_ID
                );
                const updates = [];
                if (data.startDate) {
                    updates.push({
                        property: 'start date',
                        oldValue: task.startDate.toISOString(),
                        newValue: data.startDate.toISOString(),
                    });
                }
                if (data.endDate) {
                    updates.push({
                        property: 'end date',
                        ...(task.endDate && {oldValue: task.endDate.toISOString()}),
                        newValue: data.endDate.toISOString(),
                    });
                }
                const emailDto = await this.notificationService.setTaskEmailDto(
                    taskId,
                    user as unknown as JwtUserInterface,
                    updates,
                    TaskActionOptions.UPDATE
                );

                let spaceId: number | null = null;
                if (parentFolder) {
                    const [{id}] = await this.repo.query(queries.getSpaceWithFolderIdSql, [parentFolder.folderId]);
                    spaceId = id || null;
                }

                runOnTransactionCommit(() => {
                    if (data.startDate) {
                        this.eventEmitter.emit(TaskEventNameOptions.TASK_UPDATE, {
                            data: {
                                event: TaskEventNameOptions.TASK_UPDATE,
                                message: this.notificationService.setNotificationMessage({
                                    actions: {
                                        updated: {
                                            property: 'start date',
                                            oldValue: task.startDate.toISOString(),
                                            newValue: data.startDate.toISOString(),
                                        },
                                    },
                                    sender: getUserFullName(user),
                                    entity: 'task',
                                    entityTitle: task.title,
                                }),
                                userId: user.id,
                                folderId: parentFolder.folderId ?? parentFolder.Folder.id,
                                taskId: taskId,
                                spaceId,
                                ...emailDto,
                            },
                            userId: user.id,
                            recipients,
                        } as EntityNotificationDto);
                    }
                    if (data.endDate) {
                        this.eventEmitter.emit(TaskEventNameOptions.TASK_UPDATE, {
                            data: {
                                event: TaskEventNameOptions.TASK_UPDATE,
                                message: this.notificationService.setNotificationMessage({
                                    actions: {
                                        updated: {
                                            property: 'end date',
                                            oldValue: task.endDate.toISOString(),
                                            newValue: data.endDate.toISOString(),
                                        },
                                    },
                                    sender: getUserFullName(user),
                                    entity: 'task',
                                    entityTitle: task.title,
                                }),
                                userId: user.id,
                                folderId: parentFolder.folderId ?? parentFolder.Folder.id,
                                taskId: taskId,
                                spaceId,
                                ...emailDto,
                            },
                            userId: null,
                            recipients,
                        } as EntityNotificationDto);
                    }
                });
            }
        } catch (error) {
            this.logger.error(`There was an error while updating a task ${taskId}`, JSON.stringify(error));
            throw error;
        }
    }

    /**
     * Deletes a task and its related entities.
     *
     * @param taskId - The ID of the task to delete.
     * @param userId - The ID of the user performing the delete action.
     * @return - A promise that resolves to void.
     */
    @Transactional()
    async permanentDelete(taskId: number, userId: string): Promise<void> {
        const taskTreeQuery = queries.taskTree + `WHERE path::text LIKE '%${taskId}%' ORDER BY ID DESC`;
        const manager = this.repo.manager;
        this.logger.log('Getting task ' + taskId);
        const {title} = await this.repo.findOneOrFail({where: {id: taskId}, select: {title: true}});
        this.logger.log('Creating thousand of repositories ...');
        const repoCustomFieldValue = manager.getRepository(CustomFieldValueEntity),
            repoTaskRelation = manager.getRepository(TaskRelationEntity),
            repoTagTaskFolder = manager.getRepository(TagTaskFolderEntity),
            repoTaskAction = manager.getRepository(TaskActionEntity),
            repoFolderTaskPredecessor = manager.getRepository(FolderTaskPredecessorEntity),
            repoTaskFollower = manager.getRepository(TaskFollowerEntity),
            repoNotifications = manager.getRepository(NotificationEntity),
            tasks = await this.repo.query(taskTreeQuery, []);
        const recipients = (await this.notificationService.getTaskNotificationRecipients(taskId)).filter(
            (x) => x !== userId || x !== SERVICE_USER_ID
        );

        this.logger.log('Finding user');
        const user = await manager.getRepository(UserEntity).findOne({where: {id: userId}});

        this.logger.log('Prepare notifications DTO');
        const emailDto = await this.notificationService.setTaskEmailDto(
            taskId,
            user as unknown as JwtUserInterface,
            [],
            TaskActionOptions.DELETE
        );

        this.logger.log('Start delete to all entities');
        for (const task of tasks) {
            await repoTaskFollower.delete({Task: {id: task.id}});
            const parentTaskRelationToRemove = await repoTaskRelation.findBy({ParentTask: {id: task.id}});
            const childTaskRelationToRemove = await repoTaskRelation.findBy({ChildTask: {id: task.id}});
            await repoTaskRelation.remove(parentTaskRelationToRemove);
            await repoTaskRelation.remove(childTaskRelationToRemove);
            await this.taskAttachment.deleteTaskAttachmentsByTaskId(task.id, userId);
            await this.taskAttachment.deleteTaskAttachmentsByTaskId(task.id, userId);
            await repoFolderTaskPredecessor.delete({Predecessor: {id: task.id}});
            await repoFolderTaskPredecessor.delete({Successor: {id: task.id}});
            const taskActionToRemove = await repoTaskAction.findBy({Task: {id: task.id}});
            await repoTaskAction.remove(taskActionToRemove);
            const customFieldValuesToRemove = await repoCustomFieldValue.findBy({Task: {id: task.id}});
            await repoCustomFieldValue.remove(customFieldValuesToRemove);
            await repoNotifications.delete({task: {id: task.id}});
            const tagTaskFolderToRemove = await repoTagTaskFolder.findBy({
                Task: {id: taskId},
            });
            await repoTagTaskFolder.remove(tagTaskFolderToRemove);
            await this.repo.remove(task);
        }

        const [{id: spaceId}] = await this.repo.query(queries.getSpaceWithFolderIdSql, [tasks[0].folder_id]);
        runOnTransactionCommit(() => {
            this.eventEmitter.emit(TaskEventNameOptions.TASK_DELETE, {
                data: {
                    event: TaskEventNameOptions.TASK_DELETE,
                    message: this.notificationService.setNotificationMessage({
                        actions: {
                            deleted: {
                                id: taskId,
                            },
                        },
                        sender: getUserFullName(user),
                        entity: 'task',
                        entityTitle: title,
                    }),
                    userId,
                    folderId: tasks[0].folder_id,
                    taskId,
                    spaceId,
                    ...emailDto,
                },
                userId,
                recipients: recipients.length > 0 ? recipients : [userId],
            } as EntityNotificationDto);
        });
    }

    /**
     * Retrieves a task tree based on the provided task IDs.
     *
     * @param {number[]} task_ids - An array of task IDs to retrieve the tree for.
     * @param {boolean} [includeWorkflow=false] - Specifies whether to include workflow information in the task tree. Default is false.
     * @returns {Promise<TaskEntity[]>} - A promise that resolves to an array of task entities representing the task tree.
     */
    async getTaskTree(task_ids: number[], includeWorkflow = false): Promise<TaskEntity[]> {
        try {
            const manager = this.repo.manager;
            const repoTask = manager.getRepository<TaskEntity>(TaskEntity),
                sql = `SELECT DISTINCT T.ID, NULL::INTEGER AS PARENT_TASK_ID, TR.INDEX
                       FROM TASK T
                                LEFT JOIN TASK_RELATION TR ON T.ID = TR.PARENT_TASK_ID
                       WHERE T.archived_at IS NULL 
                       AND T.deleted_at IS NULL
                         AND ${task_ids.length > 0 ? 'T.ID IN (:...ids)' : 'TR.PARENT_TASK_ID IS NULL'}
                       UNION ALL
                       SELECT T.ID,
                              TR.PARENT_TASK_ID,
                              TR.INDEX
                       FROM TASK T
                                LEFT JOIN TASK_RELATION TR
                                          ON T.ID = TR.CHILD_TASK_ID
                                INNER JOIN "RECUR" TS ON TR.PARENT_TASK_ID = TS.ID
                       WHERE T.archived_at IS NULL AND T.deleted_at IS NULL`,
                tasks2 = repoTask
                    .createQueryBuilder('Task')
                    .addCommonTableExpression(sql, 'RECUR', {recursive: true})
                    .innerJoin('RECUR', 'RECUR2', 'Task.id = "RECUR2".id')
                    .leftJoinAndSelect('Task.ChildrenTasks', 'ChildrenTasks')
                    .leftJoinAndSelect('ChildrenTasks.ParentTask', 'ParentTask')
                    .leftJoinAndSelect('Task.Importance', 'importance')
                    .leftJoinAndSelect('Task.Predecessors', 'Predecessors')
                    .leftJoinAndSelect('Task.Tags', 'Tags')
                    .leftJoinAndSelect('Tags.Tag', 'Tag')
                    .leftJoinAndSelect('Predecessors.Successor', 'Successor')
                    .leftJoinAndSelect('Task.Successors', 'Successors')
                    .leftJoinAndSelect('Task.CustomFieldValues', 'CustomFieldValues')
                    .leftJoinAndSelect('CustomFieldValues.CustomFieldDefinition', 'CustomFieldDefinition')
                    .leftJoinAndSelect('Successors.Predecessor', 'Predecessor')
                    .orderBy('"RECUR2".index')
                    .setParameter('ids', task_ids);
            if (includeWorkflow) {
                tasks2
                    .leftJoinAndSelect('Task.FolderWorkFlowStateParentTasks', 'FolderWorkFlowStateParentTasks')
                    .leftJoinAndSelect('FolderWorkFlowStateParentTasks.FolderWorkFlowState', 'ParentFolderWorkFlowState')
                    .leftJoinAndSelect('Task.FolderWorkFlowStateChildTasks', 'FolderWorkFlowStateChildTasks')
                    .leftJoinAndSelect('FolderWorkFlowStateChildTasks.FolderWorkFlowState', 'ChildFolderWorkFlowState');
            }
            const tasks = await tasks2.getMany();
            const ret = listToTree<TaskEntity>(tasks, 'id', (x: TaskEntity) => x.ChildrenTasks?.map((z) => z.ParentTask?.id), 'children');
            modifyTree(ret, (x) => delete x.ChildrenTasks, 'children');
            return ret;
        } catch (e) {
            this.logger.error(`There was an error while getting a task tree ${task_ids}`, e);
            throw e;
        }
    }

    /**
     * Updates the position of a task.
     *
     * @param {number} taskId - The ID of the task to update.
     * @param {UpdateTaskPositionDto} dto - The updated task position DTO.
     * @param {JwtUserInterface} user - The user performing the update.
     * @returns {Promise<Partial<TaskEntity>>} - The updated task entity.
     */
    @Transactional()
    async updatePosition(taskId: number, dto: UpdateTaskPositionDto, user: JwtUserInterface): Promise<Partial<TaskEntity>> {
        const userId = user.id;
        const manager = this.repo.manager;
        const repoWorkFlowState = manager.getRepository<WorkFlowStateEntity>(WorkFlowStateEntity),
            repoTaskFollower = manager.getRepository<TaskFollowerEntity>(TaskFollowerEntity),
            repoWorkFlowTransition = manager.getRepository<WorkFlowTransitionEntity>(WorkFlowTransitionEntity),
            repoTaskRelation = manager.getRepository(TaskRelationEntity),
            repoTaskAction = manager.getRepository(TaskActionEntity),
            sql = `SELECT T.ID                   AS TASK_ID,
                              T.TITLE,
                              T.extra AS extra,
                              WS.ID                  AS WORKFLOW_STATE_ID,
                              TR.PARENT_TASK_ID      AS PARENT_TASK_ID,
                              TR.ID                  AS WORKFLOW_STATE_TASK_ID,
                              TR.INDEX               AS INDEX,
                              TR.STATE_INDEX         AS "stateIndex",
                              F.WORKFLOW_ID          AS "workflowId",
                              COALESCE(
                                        (SELECT JSON_AGG(X)
                                   FROM (SELECT WT.ID,
                                                WT.FROM_STATE_ID as "fromStateId",
                                                WT.TO_STATE_ID as "toStateId"
                                         FROM WORKFLOW_TRANSITION WT
                                         WHERE TR.WORKFLOW_STATE_ID = WT.FROM_STATE_ID) AS X),JSON_ARRAY()) AS "swimlaneConstraint"
                       FROM TASK T
                                INNER JOIN TASK_RELATION TR ON TR.CHILD_TASK_ID = T.ID
                                INNER JOIN FOLDER F ON TR.FOLDER_ID = F.ID
                                INNER JOIN WORKFLOW W ON F.WORKFLOW_ID = W.ID
                                INNER JOIN WORKFLOW_STATE WS ON WS.ID = TR.WORKFLOW_STATE_ID
                           AND WS.WORKFLOW_ID = W.ID
                       WHERE T.ID = $1
                         AND T.archived_at IS NULL
                         AND T.deleted_at IS NULL
                         AND F.ID = $2
                         AND F.archived_at IS NULL  
                         AND F.deleted_at IS NULL`,
            tasksDB = await this.repo.query(sql, [taskId, dto.folderId]),
            taskDB: TaskEntity & {
                title: string;
                workflow_state_id: number;
                parent_task_id: number;
                stateIndex: number;
                index: number;
                extra?: object;
                completed?: boolean;
                swimlaneConstraint?: {id: number; fromStateId: number; toStateId: number}[];
            } = tasksDB[0];
        taskDB.id = tasksDB[0].task_id;

        if (!taskDB) {
            throw new NotFoundException(`Task with id ${taskId} not found`);
        }
        const oldState = await repoWorkFlowState.findOne({
            where: {id: taskDB.workflow_state_id},
            select: {title: true},
        });
        // stay on the same column and update task index
        if (dto.columnId === taskDB.workflow_state_id) {
            switch (dto.view) {
                case FolderViewOptions.BOARD:
                    await this.updateFolderWorkflowStateSiblings(
                        taskDB.parent_task_id,
                        dto.folderId,
                        dto.index,
                        taskId,
                        dto.columnId,
                        taskDB.stateIndex,
                        taskDB.workflow_state_id
                    );
                    await this.updateTaskSiblings(taskDB.parent_task_id, dto.folderId, dto.index, taskId, taskDB.index);
                    break;
                default:
                    await this.updateTaskSiblings(taskDB.parent_task_id, dto.folderId, dto.index, taskId, taskDB.index);
                    break;
            }
        }
        let newStateTitle: string;
        // move the task to a new column
        if (dto.columnId !== taskDB.workflow_state_id) {
            const workflowTransition = await repoWorkFlowTransition.findOne({
                where: {fromStateId: taskDB.workflow_state_id, toStateId: dto.columnId},
                relations: {WorkflowConstraint: true},
            });
            if (
                !workflowTransition ||
                (workflowTransition.WorkflowConstraint.length &&
                    !workflowTransition.WorkflowConstraint.find((workflowConstraint) => workflowConstraint.userIds.includes(user.id)))
            ) {
                throw new BadRequestException(`Task not allowed to move from state ${taskDB.workflow_state_id} to ${dto.columnId}`);
            }
            const workflowStateDB = await repoWorkFlowState.findOne({
                where: {id: dto.columnId},
                select: {title: true, completed: true},
            });
            newStateTitle = workflowStateDB.title;
            taskDB.completed = workflowStateDB?.completed ?? false;
            const completed = {
                completedAt: taskDB.completed ? new Date() : null,
                completedBy: taskDB.completed ? userId : null,
            };
            await this.repo.update({id: taskId}, {...completed, id: taskId});

            // remove old task relationship
            const foundTaskRelationDB = await repoTaskRelation.findOne({
                where: {
                    Folder: {id: dto.folderId},
                    ChildTask: {id: taskId},
                    WorkFlowState: {id: taskDB.workflow_state_id},
                },
            });
            if (foundTaskRelationDB) {
                // update new task relationship
                await repoTaskRelation.update({id: foundTaskRelationDB.id}, {WorkFlowState: {id: dto.columnId}});
            } else {
                throw new NotFoundException('Task parent not found');
            }
            // update folder workflow state task siblings index
            await this.updateFolderWorkflowStateSiblings(
                taskDB.parent_task_id,
                dto.folderId,
                dto.index,
                taskId,
                dto.columnId,
                taskDB.stateIndex,
                taskDB.workflow_state_id
            );

            // add current user to follower on updating task status
            if (!(await repoTaskFollower.existsBy({Task: {id: taskId}, userId: user.id}))) {
                await repoTaskFollower.insert({
                    Task: {id: taskId},
                    userId: user.id,
                });
            }

            // Automations notification
            const assignees = await this.getAssignees(taskId);
            const importanceId = await this.getImportance(taskId);
            runOnTransactionCommit(async () => {
                if (userId != SERVICE_USER_ID) {
                    const notification = new AutomationNotificationDto();
                    notification.eventType = AutomationsEventOptions.TASK_STATUS_CHANGED;
                    notification.applicationId = AutomationsApplicationIdOptions.TASK_MANAGEMENT;
                    notification.fromSource = AutomationsSourceOptions.API;
                    notification.fromUser = user.id;
                    notification.locationType = EntityTypeOptions.Folder;
                    notification.locationId = dto.folderId.toString();
                    notification.entityId = taskId.toString();
                    const detail = new AutomationNotificationDetailTaskEventDto();
                    detail.statusFrom = taskDB.workflow_state_id.toString();
                    detail.statusTo = dto.columnId.toString();
                    detail.assignees = assignees;
                    detail.importanceId = importanceId;
                    detail.customFields = [];
                    notification.detail = detail;
                    await this.automationsSendService.queueMessage(notification);
                }
            });
        }

        // Change parent of a task and assign a new parent
        if (dto.parentTaskNewId && dto.parentTaskOldId) {
            // remove old task relationship
            const foundTaskRelationDB = await repoTaskRelation.findOne({
                where: {Folder: {id: dto.folderId}, ChildTask: {id: taskId}, ParentTask: {id: dto.parentTaskOldId}},
            });
            if (foundTaskRelationDB) {
                // update new task relationship
                await repoTaskRelation.update({id: foundTaskRelationDB.id}, {ParentTask: {id: dto.parentTaskNewId}});
            } else {
                throw new NotFoundException('Task parent not found');
            }
            // update task siblings index
            await this.updateTaskSiblings(dto.parentTaskNewId, dto.folderId, dto.index, taskId, taskDB.index);
            const parentTask = await this.repo.findOne({where: {id: dto.parentTaskNewId}});
            await this.repo.update(taskId, {startDate: parentTask.startDate, endDate: parentTask.endDate, id: taskId});
            await this.handleTaskDateChanges(taskId, dto.folderId, user);
        }

        // Root to children
        if (dto.parentTaskNewId && !dto.parentTaskOldId) {
            // remove old task relationship
            const foundTaskRelationDB = await repoTaskRelation.findOne({
                where: {Folder: {id: dto.folderId}, ParentTask: IsNull(), ChildTask: {id: taskId}},
            });
            if (foundTaskRelationDB) {
                // update new task relationship
                await repoTaskRelation.update({id: foundTaskRelationDB.id}, {ParentTask: {id: dto.parentTaskNewId}});
            } else {
                throw new NotFoundException('Task parent not found');
            }
            // update task siblings index
            await this.updateTaskSiblings(dto.parentTaskNewId, dto.folderId, dto.index, taskId, taskDB.index);
            const parentTask = await this.repo.findOne({where: {id: dto.parentTaskNewId}});
            await this.repo.update(taskId, {startDate: parentTask.startDate, endDate: parentTask.endDate, id: taskId});
            await this.handleTaskDateChanges(taskId, dto.folderId, user);
        }

        // Children to root
        if (!dto.parentTaskNewId && dto.parentTaskOldId) {
            // remove old task relationship
            const foundTaskRelationDB = await repoTaskRelation.findOne({
                where: {Folder: {id: dto.folderId}, ChildTask: {id: taskId}, ParentTask: Not(IsNull())},
            });
            if (foundTaskRelationDB) {
                // update new task relationship
                await repoTaskRelation.update({id: foundTaskRelationDB.id}, {ParentTask: null});
            } else {
                throw new NotFoundException('Task parent not found');
            }
            // update task siblings index
            await this.updateTaskSiblings(null, dto.folderId, dto.index, taskId, foundTaskRelationDB.index);
        }

        // notifications
        await repoTaskAction.insert({
            Task: {id: taskDB.id},
            task: taskDB,
            action: TaskActionOptions.MOVE,
            messageId: MessageId.MOVE_TASK,
            parameters: {updatePosition: {...dto, workflowId: tasksDB[0].workflowId}},
            user: {id: userId},
        });
        const recipients = (await this.notificationService.getTaskNotificationRecipients(taskId)).filter(
            (x) => x !== userId || x !== SERVICE_USER_ID
        );
        const emailDto = await this.notificationService.setTaskEmailDto(
            taskId,
            user,
            [{property: 'state', oldValue: oldState.title, newValue: newStateTitle}],
            TaskActionOptions.MOVE
        );

        const [{id}] = await this.repo.query(queries.getSpaceWithFolderIdSql, [dto.folderId]);

        runOnTransactionCommit(() => {
            this.eventEmitter.emit(TaskEventNameOptions.TASK_MOVE, {
                data: {
                    taskId: taskId,
                    folderId: dto.folderId,
                    spaceId: id ?? null,
                    event: TaskEventNameOptions.TASK_MOVE,
                    fromTaskIndex: taskDB.index,
                    toTaskIndex: dto.index,
                    fromColumnId: taskDB.workflow_state_id,
                    toColumnId: dto.columnId,
                    message: this.notificationService.setNotificationMessage({
                        entity: 'task',
                        entityTitle: taskDB.title,
                        sender: user.firstName + ' ' + user.lastName,
                        actions: {
                            moved: true,
                        },
                    }),
                    userId,
                    ...emailDto,
                },
                userId,
                recipients: recipients.length > 0 ? recipients : [userId],
            } as EntityNotificationDto);
        });
        return taskDB;
    }

    /**
     * Updates the sibling tasks of a given task.
     *
     * @param {number} parentTaskId - The ID of the parent task. If null, it indicates that the task has no parent.
     * @param {number} folderId - The ID of the folder containing the tasks.
     * @param {number} index - The new index of the task being moved.
     * @param {number} taskId - The ID of the task being moved.
     * @param {number} oldIndex - The current index of the task being moved.
     *
     * @return {Promise<unknown>} - A promise that resolves to an unknown value.
     */
    @Transactional()
    private async updateTaskSiblings(
        parentTaskId: number,
        folderId: number,
        index: number,
        taskId: number,
        oldIndex: number
    ): Promise<unknown> {
        // fix index on task relation
        const repoTaskRelation = this.repo.manager.getRepository(TaskRelationEntity),
            parentFilter = parentTaskId ? `AND parent_task_id = ${parentTaskId}` : `AND parent_task_id IS NULL`;
        let sql: string;
        // actualizo indice de la tarea a mover
        await repoTaskRelation.update({ChildTask: {id: taskId}}, {index: index});
        // muevo el resto de las tareas
        // caso 1
        if (index === 0) {
            sql = `UPDATE task_relation
                   SET index = sub.row_num
                   FROM (SELECT id, (row_number() over (order by (index))) as row_num, child_task_id, index
                         FROM task_relation
                         WHERE folder_id = $1
                           AND child_task_id NOT IN ($2)
                             ${parentFilter}
                         order by index) as sub
                   where task_relation.id = sub.id`;
            return await repoTaskRelation.query(sql, [folderId, taskId]);
        }
        if (index > oldIndex && index !== 0) {
            // caso 1
            sql = `UPDATE TASK_RELATION
                   SET INDEX = INDEX - 1
                   WHERE ID IN (SELECT ID
                                FROM TASK_RELATION
                                WHERE FOLDER_ID = $1
                                  AND INDEX <= $2
                                  AND INDEX > $3
                                  AND CHILD_TASK_ID NOT IN ($4) ${parentFilter}
                       )`;
            return await repoTaskRelation.query(sql, [folderId, index, oldIndex, taskId]);
        }
        if (oldIndex > index && index !== 0) {
            // caso 2
            sql = `UPDATE TASK_RELATION
                   SET INDEX = INDEX + 1
                   WHERE ID IN (SELECT ID
                                FROM TASK_RELATION
                                WHERE FOLDER_ID = $1
                                  AND INDEX < $2
                                  AND INDEX >= $3
                                  AND CHILD_TASK_ID NOT IN ($4) ${parentFilter}
                       )`;
            return await repoTaskRelation.query(sql, [folderId, oldIndex, index, taskId]);
        } else {
            if (oldIndex === index) {
                // do nothing
            } else {
                throw new BadRequestException();
            }
        }
    }

    /**
     * Update the state index of tasks related to a folder workflow state.
     *
     * @param {number} parentTaskId - The ID of the parent task. Use null for tasks without a parent.
     * @param {number} folderId - The ID of the folder.
     * @param {number} stateIndex - The new state index to set.
     * @param {number} taskId - The ID of the task.
     * @param {number} workflowStateId - The ID of the folder workflow state.
     * @param {number} oldStateIndex - The old state index.
     * @param {number} oldWorkflowStateId - The old folder workflow state ID.
     *
     * @returns {Promise<void>} - A promise that resolves when the update is complete.
     */
    @Transactional()
    async updateFolderWorkflowStateSiblings(
        parentTaskId: number,
        folderId: number,
        stateIndex: number,
        taskId: number,
        workflowStateId: number,
        oldStateIndex: number,
        oldWorkflowStateId: number
    ): Promise<void> {
        // fix index on task relation
        const repoTaskRelation = this.repo.manager.getRepository(TaskRelationEntity),
            parentFilter = parentTaskId ? `AND parent_task_id = ${parentTaskId}` : `AND parent_task_id IS NULL`;
        let sql: string;
        //caso 1
        await repoTaskRelation.update(
            {ChildTask: {id: taskId}},
            {
                stateIndex: stateIndex,
            }
        );
        if (workflowStateId == oldWorkflowStateId) {
            if (stateIndex === 0) {
                sql = `UPDATE task_relation
                           SET STATE_INDEX = sub.row_num
                           FROM (SELECT id,
                                        (row_number() over (order by (STATE_INDEX))) as row_num,
                                        child_task_id,
                                        STATE_INDEX
                                 FROM task_relation
                                 WHERE folder_id = $1
                                   AND child_task_id != ($2)
                                   AND workflow_state_id = $3
                                     ${parentFilter}
                                 order by STATE_INDEX) as sub
                           where task_relation.id = sub.id`;
                await repoTaskRelation.query(sql, [folderId, taskId, workflowStateId]);
            } else if (stateIndex > oldStateIndex && stateIndex !== 0) {
                sql = `UPDATE TASK_RELATION
                           SET STATE_INDEX = STATE_INDEX - 1
                           WHERE ID IN (SELECT ID
                                        FROM TASK_RELATION
                                        WHERE FOLDER_ID = $1
                                          AND STATE_INDEX <= $2
                                          AND STATE_INDEX > $3
                                          AND CHILD_TASK_ID != $4
                                          AND workflow_state_id = $5
                                            ${parentFilter})`;
                await repoTaskRelation.query(sql, [folderId, stateIndex, oldStateIndex, taskId, workflowStateId]);
            } else {
                sql = `UPDATE TASK_RELATION
                           SET STATE_INDEX = STATE_INDEX + 1
                           WHERE ID IN (SELECT ID
                                        FROM TASK_RELATION
                                        WHERE FOLDER_ID = $1
                                          AND STATE_INDEX < $2
                                          AND STATE_INDEX >= $3
                                          AND CHILD_TASK_ID != $4
                                          AND workflow_state_id = $5
                                            ${parentFilter})`;
                await repoTaskRelation.query(sql, [folderId, oldStateIndex, stateIndex, taskId, workflowStateId]);
            }
        } else if (workflowStateId !== oldWorkflowStateId) {
            if (stateIndex === 0) {
                sql = `UPDATE TASK_RELATION
                           SET STATE_INDEX = STATE_INDEX - 1
                           WHERE ID IN (SELECT ID
                                        FROM TASK_RELATION
                                        WHERE FOLDER_ID = $1
                                          AND STATE_INDEX >= $2
                                          AND CHILD_TASK_ID != $3
                                          AND workflow_state_id = $4
                                            ${parentFilter})`;
                await repoTaskRelation.query(sql, [folderId, oldStateIndex, taskId, oldWorkflowStateId]);
                sql = `UPDATE task_relation
                           SET STATE_INDEX = sub.row_num
                           FROM (SELECT id,
                                        (row_number() over (order by (STATE_INDEX))) as row_num,
                                        child_task_id,
                                        STATE_INDEX
                                 FROM task_relation
                                 WHERE folder_id = $1
                                   AND child_task_id != ($2)
                                   AND workflow_state_id = $3
                                     ${parentFilter}
                                 order by STATE_INDEX) as sub
                           where task_relation.id = sub.id`;
                await repoTaskRelation.query(sql, [folderId, taskId, workflowStateId]);
            } else {
                sql = `UPDATE TASK_RELATION
                           SET STATE_INDEX = STATE_INDEX - 1
                           WHERE ID IN (SELECT ID
                                        FROM TASK_RELATION
                                        WHERE FOLDER_ID = $1
                                          AND STATE_INDEX > $2
                                          AND CHILD_TASK_ID != $3
                                          AND workflow_state_id = $4
                                            ${parentFilter})`;
                await repoTaskRelation.query(sql, [folderId, oldStateIndex, taskId, oldWorkflowStateId]);
                sql = `UPDATE TASK_RELATION
                           SET STATE_INDEX = STATE_INDEX + 1
                           WHERE ID IN (SELECT ID
                                        FROM TASK_RELATION
                                        WHERE FOLDER_ID = $1
                                          AND STATE_INDEX >= $2
                                          AND CHILD_TASK_ID != $3
                                          AND workflow_state_id = $4
                                            ${parentFilter})`;
                await repoTaskRelation.query(sql, [folderId, oldStateIndex, taskId, workflowStateId]);
            }
        } else {
            throw new BadRequestException();
        }
    }

    /**
     * Creates a new TaskEntity and saves it to the database.
     *
     * @param {CreateTaskDto} dto - The data for creating the TaskEntity.
     * @param {JwtUserInterface} user - The user creating the task.
     * @returns {Promise<TaskEntity>} - The created TaskEntity.
     */
    @Transactional()
    async create(dto: CreateTaskDto, user: JwtUserInterface): Promise<TaskEntity> {
        const manager = this.repo.manager;
        const repoFolder = manager.getRepository(FolderEntity),
            repoTaskFollower = manager.getRepository(TaskFollowerEntity),
            repoTaskRelation = manager.getRepository(TaskRelationEntity),
            repoTaskAction = manager.getRepository(TaskActionEntity),
            repoTagTaskFolder = manager.getRepository(TagTaskFolderEntity),
            repoCustomFieldValue = manager.getRepository(CustomFieldValueEntity),
            repoImportance = manager.getRepository(ImportanceEntity);

        this.logger.log('Getting folderDB');

        const folderDB = await repoFolder
            .createQueryBuilder('Folder')
            .leftJoinAndSelect('Folder.Members', 'Followers')
            .leftJoinAndSelect('Folder.Followers', 'Members')
            .leftJoinAndSelect('Folder.CustomFieldValues', 'CustomFieldValues')
            .leftJoinAndSelect('CustomFieldValues.CustomFieldDefinition', 'CustomFieldDefinition')
            .leftJoinAndSelect('Folder.WorkFlow', 'WorkFlow')
            .leftJoinAndSelect('WorkFlow.WorkFlowStates', 'WorkFlowStates')
            .where({id: dto.folderId})
            .addOrderBy('WorkFlowStates.id', 'ASC')
            .getOne();
        //Source cannot be an empty string
        validateSource(dto.source);

        const defaultImportance = await repoImportance.findOne({where: {default: true}});
        // save task
        this.logger.log('Saving task');
        const savedTask = await this.repo.save({
            createdAt: new Date(),
            description: dto.description,
            title: dto.title,
            endDate: dto.endDate,
            userId: dto.owner,
            startDate: dto.startDate,
            duration: dto.duration,
            complete: dto.complete,
            effort: dto.effort,
            fixed_start_date: dto.fixedStartDate,
            Importance: dto.importanceId ? {id: dto.importanceId} : defaultImportance ? {id: defaultImportance.id} : null,
            archivedAt: null,
            deletedAt: null,
            source: dto.source,
            extra: dto.extra ? dto.extra : null,
            showOn: dto.showOn,
            assignees: dto.assignees,
        });
        //check for folder follow
        const taskFollower = [];
        if (folderDB.Followers.length) {
            const followers = folderDB.Followers.map((x) => x.userId /*User*/);
            for (const follower of followers) {
                taskFollower.push({
                    Task: {id: savedTask.id},
                    userId: follower /*User: {id: follower.id},*/,
                });
            }

            await repoTaskFollower.insert(taskFollower);
        }

        // add the createor to followers as well
        if (!taskFollower.find((el) => el.userId === user.id)) {
            if (!(await repoTaskFollower.existsBy({Task: {id: savedTask.id}, userId: user.id}))) {
                await repoTaskFollower.insert({
                    Task: {id: savedTask.id},
                    userId: user.id,
                });
            }
        }

        // If the dto doesn't have a Workflow state, we set it to the first column
        if (!dto.workflowStateId) {
            dto.workflowStateId = folderDB.WorkFlow.WorkFlowStates[0]?.id;
        }

        const taskRelation = {
            Folder: {id: dto.folderId},
            ChildTask: {id: savedTask.id},
            index: dto.index ?? 0,
            WorkFlowState: {id: dto.workflowStateId},
            stateIndex: 0,
        };
        if (dto.parentTaskId) {
            const parentTask = await repoTaskRelation.findOne({where: {childTaskId: dto.parentTaskId}});
            Object.assign(taskRelation, {
                ParentTask: {id: dto.parentTaskId},
                pathStr: [...parentTask.pathStr, savedTask.title],
                pathIds: [...parentTask.pathIds, savedTask.id],
            });
        } else {
            Object.assign(taskRelation, {
                ParentTask: null,
                pathStr: [savedTask.title],
                pathIds: [savedTask.id],
            });
        }
        // save task relation
        const relationDB = await repoTaskRelation.save(taskRelation);
        // update task siblings index
        await this.updateTaskSiblings(dto.parentTaskId, dto.folderId, relationDB.index, savedTask.id, relationDB.index);
        // update task siblings index
        await this.updateFolderWorkflowStateSiblings(
            dto.parentTaskId,
            dto.folderId,
            relationDB.stateIndex,
            savedTask.id,
            dto.workflowStateId,
            relationDB.stateIndex,
            dto.workflowStateId
        );

        if (dto.Tags) {
            const tags = [];
            for (const tag of dto.Tags) {
                tags.push({tagId: tag, Task: savedTask, type: TagTaskFolderTypeOptions.TASK_TAG});
            }
            await repoTagTaskFolder.insert(tags);
        }
        // task action
        await repoTaskAction.insert({
            Task: savedTask,
            action: TaskActionOptions.CREATE,
            messageId: MessageId.CREATE_TASK,
            parameters: {create: dto},
            task: savedTask,
            user: {id: user.id},
        });
        // task assignees
        if (dto.assignees) {
            const taskUser = [];

            for (const assignee of dto.assignees) {
                taskUser.push({Task: savedTask, userId: assignee});
            }
            // await repoTaskUserView.insert(taskUser);
            await repoTaskAction.insert({
                Task: savedTask,
                action: TaskActionOptions.ASSIGN,
                messageId: MessageId.ASSIGN_TASK,
                parameters: {
                    members: {
                        assigned: dto.assignees.map((assignee) => {
                            return {
                                id: assignee,
                            };
                        }),
                    },
                },
                task: savedTask,
                user: {id: user.id},
            });
        }

        if (folderDB.CustomFieldValues.length) {
            const fieldValues = [];
            for (const field of folderDB.CustomFieldValues) {
                fieldValues.push({
                    value: field.value,
                    Task: savedTask,
                    customFieldDefinitionId: field.CustomFieldDefinition.id ? field.CustomFieldDefinition.id : null,
                    index: field.index,
                });
            }

            await repoCustomFieldValue.insert(fieldValues);
        }

        // Automations notification
        const importanceId = await this.getImportance(savedTask.id);
        // eslint-disable-next-line @typescript-eslint/require-await
        runOnTransactionCommit(async () => {
            if (user.id != SERVICE_USER_ID) {
                const notification = new AutomationNotificationDto();
                notification.eventType = AutomationsEventOptions.TASK_CREATED;
                notification.applicationId = AutomationsApplicationIdOptions.TASK_MANAGEMENT;
                notification.fromSource = AutomationsSourceOptions.API;
                notification.fromUser = user.id;
                notification.locationType = EntityTypeOptions.Folder;
                notification.locationId = dto.folderId.toString();
                notification.entityId = savedTask.id.toString();
                const detail = new AutomationNotificationDetailTaskEventDto();
                detail.assignees = dto.assignees;
                detail.importanceId = importanceId;
                detail.customFields = [];
                notification.detail = detail;
                await this.automationsSendService.queueMessage(notification);
            }
        });

        const recipients = (await this.notificationService.getTaskNotificationRecipients(savedTask.id)).filter(
            (userId) => userId !== user.id || userId !== SERVICE_USER_ID
        );
        const emailDto = await this.notificationService.setTaskEmailDto(savedTask.id, user, [], TaskActionOptions.CREATE);

        let spaceId: number | null = null;
        if (folderDB) {
            const [{id}] = await this.repo.query(queries.getSpaceWithFolderIdSql, [folderDB.id]);
            spaceId = id || null;
        }

        runOnTransactionCommit(() => {
            this.eventEmitter.emit(TaskEventNameOptions.TASK_CREATE, {
                data: {
                    event: TaskEventNameOptions.TASK_CREATE,
                    message: this.notificationService.setNotificationMessage({
                        actions: {
                            created: true,
                        },
                        entity: 'task',
                        entityTitle: savedTask.title,
                        sender: getUserFullName(user),
                    }),
                    workflowStateId: dto.workflowStateId,
                    workflowId: folderDB.WorkFlow.id,
                    folderId: dto.folderId,
                    taskId: savedTask.id,
                    spaceId,
                    userId: user.id,
                    ...emailDto,
                },
                recipients,
                userId: user.id,
            } as EntityNotificationDto);
        });

        return savedTask;
    }

    /**
     * Moves multiple tasks between folders.
     * Moves the tasks and their related entities (tags, custom fields, assignees) from a source folder to a destination folder.
     * Updates the folder workflow state of each task based on the provided mapping.
     *
     * @param taskIds - An array of task IDs to be shared between folders.
     * @param sourceFolderId - The ID of the source folder from which the tasks will be moved.
     * @param destinationFolderId - The ID of the destination folder where the tasks will be moved.
     * @param folderWorkflowStatesMapping - An array of objects representing the mapping between source and destination folder workflow states.
     * @returns A promise that resolves to an array of MoveManyResultDto objects.
     * @throws NotFoundException if the source or destination folder is not found.
     * @throws NotFoundException if a task relation is not found for a task.
     * @throws NotFoundException if no mapping is found for a folder workflow state.
     */
    @Transactional()
    async moveBetweenFolders(
        taskIds: number[],
        sourceFolderId: number,
        destinationFolderId: number,
        folderWorkflowStatesMapping: MapWorkflowStateDto[]
    ): Promise<MoveManyResultDto[]> {
        const manager = this.repo.manager;
        const repoTask = manager.getRepository<TaskEntity>(TaskEntity);

        const repoWorkflowState = manager.getRepository<WorkFlowStateEntity>(WorkFlowStateEntity);
        const repoTaskRelation = manager.getRepository<TaskRelationEntity>(TaskRelationEntity);
        const tasks = await repoTask.find({
            where: {id: In(taskIds)},
            relations: {
                Tags: {Tag: true},
                CustomFieldValues: {CustomFieldDefinition: true},
            },
        });
        const response: MoveManyResultDto[] = [];
        //Check each tasks and its relations, if it has children tasks and relations move them too and set the appropiate states based on the translations

        const sourceFolder = await manager.getRepository(FolderEntity).findOne({
            where: {id: sourceFolderId},
        });

        const destinationFolder = await manager.getRepository(FolderEntity).findOne({
            where: {id: destinationFolderId},
            relations: {
                Tags: {Tag: true},
                CustomFieldValues: {CustomFieldDefinition: true},
                Members: true,
            },
        });
        if (!sourceFolder || !destinationFolder) {
            throw new NotFoundException('Source or destination folder not found');
        }

        const destinationFolderMembers = destinationFolder.Members;
        const processedTasksIds: number[] = [];
        for (const task of tasks) {
            // skip if the task has already been processed
            if (processedTasksIds.includes(task.id)) continue;

            //Check task assignees and add them as folder members if they aren't already
            for (const assignee of task.assignees) {
                if (!destinationFolderMembers.find((member) => member.userId === assignee)) {
                    const sourceFolderMemberPermissions = await manager
                        .getRepository<AssignedPermissionEntity>(AssignedPermissionEntity)
                        .findOne({
                            where: {
                                userId: assignee,
                                entityId: sourceFolderId.toString(),
                                entityType: EntityTypeOptions.Folder,
                            },
                        });
                    await manager.getRepository<AssignedPermissionEntity>(AssignedPermissionEntity).insert({
                        userId: assignee,
                        entityId: destinationFolderId.toString(),
                        entityType: EntityTypeOptions.Folder,
                        permissions: sourceFolderMemberPermissions.permissions,
                        Role: sourceFolderMemberPermissions.Role,
                        roleId: sourceFolderMemberPermissions.roleId,
                        inherited: sourceFolderMemberPermissions.inherited,
                        banned: sourceFolderMemberPermissions.banned,
                    });
                }
            }
            const existingTaskRelation = await repoTaskRelation.findOne({
                where: {ChildTask: {id: task.id}, Folder: {id: sourceFolderId}},
                relations: {
                    WorkFlowState: {
                        WorkFlow: true,
                    },
                },
            });

            if (!existingTaskRelation) {
                throw new NotFoundException(`Task relation not found for task with id ${task.id}`);
            }
            // Update task relation with the new folder workflow state
            const taskStateCode = existingTaskRelation.WorkFlowState.code;
            const state = folderWorkflowStatesMapping.find((x) => x.SourceWorkflowStateCode === taskStateCode);
            if (!state) {
                throw new NotFoundException(`No mapping found for state with code ${taskStateCode}`);
            }
            const newState = await repoWorkflowState.findOneOrFail({where: {code: state.DestinationWorkflowStateCode}});

            // update tasks relation
            const sql = `
            WITH RECURSIVE TASKS AS 
            (
                        SELECT 
                            TR.PARENT_TASK_ID,
                            TR.CHILD_TASK_ID,
                            TR.ID AS "taskRelationId",
                            T.ID AS "taskId",
                            T.TITLE
                        FROM 
                                TASK_RELATION TR
                                INNER JOIN TASK T ON T.ID = TR.CHILD_TASK_ID
                            WHERE 
                                TR.FOLDER_ID = $1
                                AND T.archived_at IS NULL
                                AND T.deleted_at IS NULL
                                AND TR.PARENT_TASK_ID = $2
                        UNION ALL
                            
                        SELECT 
                            TR.PARENT_TASK_ID,
                            TR.CHILD_TASK_ID,
                            TR.ID AS "taskRelationId",
                            T.ID AS "taskId",
                            T.TITLE
                        FROM 
                            TASK_RELATION TR
                            INNER JOIN TASK T ON T.ID = TR.CHILD_TASK_ID
                            INNER JOIN TASKS TS ON TS.CHILD_TASK_ID = TR.PARENT_TASK_ID
                        WHERE 
                            TR.FOLDER_ID = $1 
                            AND T.archived_at IS NULL 
                            AND T.deleted_at IS NULL
                    )
                    CYCLE CHILD_TASK_ID
                SET IS_CYCLE USING PATH
                SELECT "taskId", "taskRelationId"
                FROM TASKS`;

            const allSubtasks = await repoTaskRelation.query(sql, [sourceFolderId, task.id]);

            // Main task
            const taskRelationUpdateResult = await repoTaskRelation.update(
                {id: existingTaskRelation.id},
                {
                    Folder: destinationFolder,
                    folderId: destinationFolderId,
                    WorkFlowState: newState,
                    stateIndex: newState.index,
                    parentTaskId: null,
                }
            );
            response.push({taskId: task.id, taskRelationUpdateResult});

            // Sub-tasks
            if (allSubtasks?.length) {
                for (const task of allSubtasks) {
                    const taskRelationUpdateResult = await repoTaskRelation.update(
                        {id: task.taskRelationId},
                        {
                            Folder: destinationFolder,
                            folderId: destinationFolderId,
                            WorkFlowState: newState,
                            stateIndex: newState.index,
                        }
                    );
                    response.push({taskId: task.taskId, taskRelationUpdateResult});
                    processedTasksIds.push(task.taskId);
                }
            }
        }
        return response;
    }

    /**
     * Shares a task within a folder.
     *
     * @param {number} taskId - The ID of the task to be shared.
     * @param {TaskSharedDto} dto - The DTO containing the necessary information for sharing the task.
     * @param {string} userId - The ID of the user performing the sharing operation.
     * @param {string} authorization - The authorization token for the user.
     * @param {number} [parentTaskId=null] - The ID of the parent task, if any. Defaults to null.
     *
     * @returns {Promise<TaskRelationEntity>} - A promise that resolves to the newly created TaskRelationEntity.
     *
     * @throws {NotFoundException} - If the task, fromFolderId, folderId, or stateId is not found.
     * @throws {BadRequestException} - If the task is being shared within the same folder.
     */
    @Transactional()
    async share(
        taskId: number,
        dto: TaskSharedDto,
        userId: string,
        authorization: string,
        parentTaskId: number = null
    ): Promise<TaskRelationEntity> {
        const manager = this.repo.manager;
        const repoTask = manager.getRepository<TaskEntity>(TaskEntity),
            repoFolder = manager.getRepository<FolderEntity>(FolderEntity),
            repoWorkflowState = manager.getRepository<WorkFlowStateEntity>(WorkFlowStateEntity),
            repoTaskRelation = manager.getRepository<TaskRelationEntity>(TaskRelationEntity),
            repoTaskAction = manager.getRepository<TaskActionEntity>(TaskActionEntity),
            taskDB = await repoTask.findOne({where: {id: taskId}});
        if (!taskDB) {
            throw new NotFoundException(`Task with id ${taskId} not found`);
        }
        const folderFromDB = repoFolder.findOne({where: {id: dto.fromFolderId}});

        const taskRelationDB = await repoTaskRelation.findOne({
            where: {
                Folder: {id: dto.folderId},
                ChildTask: {id: taskId},
            },
        });

        //Check if task is already shared
        if (taskRelationDB) {
            const taskRelationToRemove = await repoTaskRelation.findBy({
                Folder: {id: dto.folderId},
                ChildTask: {id: taskId},
            });
            await repoTaskRelation.remove(taskRelationToRemove);
        }

        if (!folderFromDB) {
            throw new NotFoundException(`Folder with id ${dto.fromFolderId} not found`);
        }

        const folderToDB = repoFolder.findOne({where: {id: dto.folderId}});
        if (!folderToDB) {
            throw new NotFoundException(`Folder with id ${dto.folderId} not found`);
        }
        const stateDB = await repoWorkflowState.findOne({where: {id: dto.stateId}});
        if (!stateDB) {
            throw new NotFoundException(`Workflow State with id ${dto.stateId} not found`);
        }
        if (dto.fromFolderId === dto.folderId) {
            throw new BadRequestException(`Can't share task within same folder`);
        }
        const taskRelation = {
            index: 0,
            stateIndex: 0,
            ChildTask: {id: taskId},
            WorkFlowState: {id: dto.stateId},
            Folder: {id: dto.folderId},
        };
        if (parentTaskId) {
            const parentTask = await repoTaskRelation.findOne({where: {childTaskId: parentTaskId}});
            Object.assign(taskRelation, {
                ParentTask: {id: parentTaskId},
                pathStr: [...parentTask.pathStr, taskDB.title],
                pathIds: [...parentTask.pathIds, taskDB.id],
            });
        } else {
            Object.assign(taskRelation, {
                ParentTask: null,
                pathStr: [taskDB.title],
                pathIds: [taskDB.id],
            });
        }
        const ret = await repoTaskRelation.save(taskRelation);
        // update task siblings index
        await this.updateTaskSiblings(parentTaskId, dto.folderId, ret.index, taskId, ret.index);
        // update task siblings index
        await this.updateFolderWorkflowStateSiblings(
            parentTaskId,
            dto.folderId,
            ret.stateIndex,
            taskId,
            dto.stateId,
            ret.stateIndex,
            dto.stateId
        );
        // share children also
        const childrenQuery =
            queries.taskTree +
            ` INNER JOIN task t ON TASKS.ID = t.id where PARENT_TASK_ID =$1 AND folder_id =$2 AND t.archived_at IS NULL AND t.deleted_at IS NULL`;

        const children = await this.repo.query(childrenQuery, [taskId, dto.fromFolderId]);

        await repoTaskAction.insert({
            taskId: taskId,
            Task: taskDB,
            action: TaskActionOptions.SHARE_TASK,
            messageId: MessageId.SHARE_TASK,
            parameters: {
                share: dto,
            },
            task: taskDB,
            user: {id: userId},
        });

        for (const child of children) {
            await this.share(child.id, dto, userId, authorization, taskId);
        }

        return ret;
    }

    /**
     * Unshare method
     *
     * Unshares a task from a folder. If a parentTaskId is provided, it will only unshare the relation between the folder and the child task. If no parentTaskId is provided, it will
     * unshare the task and all its children from the folder recursively.
     *
     * @param {number} taskId - The ID of the task to unshare.
     * @param {number} folderId - The ID of the folder from which to unshare the task.
     * @param {string} userId - The ID of the user performing the unshare action.
     * @param {string} authorization - The authorization token for the user.
     * @param {number|null} parentTaskId - The ID of the parent task. If provided, only unshare the relation between the folder and this child task.
     * @returns {Promise<unknown>} - A promise that resolves with the result of the unshare operation.
     */
    @Transactional()
    async unshare(taskId: number, folderId: number, userId: string, authorization: string, parentTaskId: number = null): Promise<unknown> {
        // try {
        const manager = this.repo.manager;
        const repoFolder = manager.getRepository<FolderEntity>(FolderEntity),
            repoTaskRelation = manager.getRepository<TaskRelationEntity>(TaskRelationEntity),
            repoTaskAction = manager.getRepository<TaskActionEntity>(TaskActionEntity),
            taskDB = await this.repo.findOne({where: {id: taskId}});
        if (!taskDB) {
            throw new NotFoundException(`Task with id ${taskId} not found`);
        }
        const folderDB = repoFolder.findOne({where: {id: folderId}});

        if (!folderDB) {
            throw new NotFoundException(`Folder with id ${folderId} not found`);
        }
        // share children also
        const childrenQuery =
            queries.taskTree +
            `INNER JOIN task t ON TASKS.ID = t.id where PARENT_TASK_ID =$1 AND folder_id =$2 AND t.archived_at IS NULL AND t.deleted_at IS NULL`;
        const children = await this.repo.query(childrenQuery, [taskId, folderId]);

        await repoTaskAction.insert({
            taskId: taskId,
            Task: taskDB,
            action: TaskActionOptions.UNSHARED_TASK,
            messageId: MessageId.UNSHARED_TASK,
            parameters: {
                unshared: {folder_id: folderId},
            },
            task: taskDB,
            user: {id: userId},
        });

        for (const child of children) {
            await this.unshare(child.id, folderId, userId, authorization, taskId);
        }

        // check if there are more than one relations linked to the taskId
        if (parentTaskId == null) {
            const checkIfOtherRelationExists = await repoTaskRelation.existsBy({
                Folder: {id: Not(folderId)},
                ChildTask: {id: taskId},
            });

            if (!checkIfOtherRelationExists) {
                throw new ForbiddenException('You cannot unbind the last project from the task');
            }
        }

        const taskRelationToRemove = await repoTaskRelation.findBy({
            Folder: {id: folderId},
            ParentTask: parentTaskId ? {id: parentTaskId} : {id: IsNull()},
            ChildTask: {id: taskId},
        });
        return await repoTaskRelation.remove(taskRelationToRemove);
    }

    //todo : add return types
    /**
     * Creates a dependency between two tasks in a folder.
     *
     * @param {CreateDependencyDto} dto - The DTO containing the dependency information.
     * @param {string} userId - The ID of the user creating the dependency.
     *
     * @returns {Promise<unknown>} - The result of creating the dependency.
     *
     * @throws {ForbiddenException} - If the user does not have the required permissions.
     * @throws {NotFoundException} - If the specified folder is not found.
     */
    @Transactional()
    async createDependency(dto: CreateDependencyDto, userId: string): Promise<unknown> {
        // try {
        const manager = this.repo.manager;
        const repoFolderTaskPredecessor = manager.getRepository<FolderTaskPredecessorEntity>(FolderTaskPredecessorEntity),
            repoFolder = manager.getRepository<FolderEntity>(FolderEntity);

        const predecessorTaskPermissions = await this.repo.findOne({
                select: {id: true},
                where: {id: dto.predecessorId, userId},
            }),
            successorTaskPermissions = await this.repo.findOne({
                select: {id: true},
                where: {id: dto.successorId, userId},
            }),
            folderDB = await repoFolder.findOne({where: {id: dto.folderId}});

        if (!predecessorTaskPermissions || !successorTaskPermissions) {
            throw new ForbiddenException('Dont have required permissions');
        }
        if (!folderDB) {
            throw new NotFoundException(`Folder ${dto.folderId} not found`);
        }
        const user = await manager.getRepository(UserEntity).findOne({where: {id: userId}});
        // Add a predecessor in folder task Predecessor's
        const insertResult = await repoFolderTaskPredecessor.insert({
            Folder: {id: folderDB.id},
            Predecessor: predecessorTaskPermissions,
            Successor: successorTaskPermissions,
            relationType: dto.relationType,
        });

        await this.handleTaskDateChanges(dto.predecessorId, dto.folderId, user);
        return insertResult;
        // } catch (error) {
        //     this.logger.error('There was an error while creating dependencies for task', error);
        //     throw error;
        // }
    }

    //todo : add return types
    /**
     * Deletes a dependency with the specified ID.
     *
     * @param {number} dependencyId - The ID of the dependency to be deleted.
     * @returns {Promise<unknown>} - A Promise that resolves to the result of the delete operation.
     * @throws {Error} - If the delete operation fails.
     * @example
     * // Example usage:
     * const dependencyId = 123;
     * await deleteDependency(dependencyId);
     */
    @Transactional()
    async deleteDependency(dependencyId: number): Promise<unknown> {
        return await this.repo.manager.getRepository<FolderTaskPredecessorEntity>(FolderTaskPredecessorEntity).delete({id: dependencyId});
    }

    /**
     * Binds multiple child tasks to a parent task.
     *
     * @param {TaskManySharedDto} body - The request body containing the parent task ID and an array of child task IDs.
     *
     * @return {Promise<void>} Returns a promise that resolves when the child tasks are successfully bound to the parent task.
     */
    @Transactional()
    async bindManyTask(body: TaskManySharedDto): Promise<void> {
        const manager = this.repo.manager;
        const repoTask = manager.getRepository<TaskEntity>(TaskEntity),
            repoTaskRelation = manager.getRepository<TaskRelationEntity>(TaskRelationEntity),
            // validate parent task
            parentTaskDB = await repoTask.findOne({where: {id: body.parentTask}}),
            childrenTasks = [];
        for (const child_task_id of body.childrenTasks) {
            const childTaskDB = await repoTask.findOne({where: {id: child_task_id}}),
                taskRelation = await repoTaskRelation.findOne({
                    where: {
                        Folder: {id: body.folderId},
                        ParentTask: {id: parentTaskDB.id},
                        ChildTask: {id: child_task_id},
                    },
                });
            if (taskRelation) {
                throw new ConflictException(`Parent child relation already exists`);
            }
            // check for task loops
            const loop = await checkForTaskLoop(repoTask, parentTaskDB.id, child_task_id);
            if (loop) {
                throw new ConflictException(`Task loop found`);
            }
            const taskRelationToRemove = await repoTaskRelation.findBy({
                Folder: {id: body.folderId},
                ParentTask: null,
                ChildTask: {id: childTaskDB.id},
            });
            await repoTaskRelation.remove(taskRelationToRemove);

            childrenTasks.push(childTaskDB);
        }
        await this.updateTaskSiblings(parentTaskDB?.id, body.folderId, 0, childrenTasks[0].id, childrenTasks[0].ChildrenTasks[0].index);
        // update task siblings index
        await this.updateFolderWorkflowStateSiblings(
            parentTaskDB.id,
            body.folderId,
            0,
            childrenTasks[0].id,
            parentTaskDB.ChildrenTasks[0].WorkFlowState.id,
            childrenTasks[0].ChildrenTasks[0].index,
            childrenTasks[0].ChildrenTasks[0].WorkFlowState.id
        );
    }

    //todo : add return types
    /**
     * Binds a child task to a parent task within a folder.
     *
     * @param {number} folderId - The id of the folder.
     * @param {number} parentTaskId - The id of the parent task.
     * @param {number} childTaskId - The id of the child task.
     * @throws {BadRequestException} - If the parent task id is the same as the child task id.
     * @throws {ConflictException} - If the parent-child relationship already exists or if a task loop is found.
     * @returns {Promise<unknown>} - A Promise that resolves with the bound task relation.
     */
    @Transactional()
    async bindTask(folderId: number, parentTaskId: number, childTaskId: number): Promise<unknown> {
        if (parentTaskId === childTaskId) {
            throw new BadRequestException(`Parent task can not be also child task`);
        }
        const manager = this.repo.manager;
        const repoTask = manager.getRepository<TaskEntity>(TaskEntity),
            repoTaskRelation = manager.getRepository<TaskRelationEntity>(TaskRelationEntity),
            // validate parent task
            parentTaskDB = await repoTask.findOne({where: {id: parentTaskId}}),
            childTaskDB = await repoTask.findOne({where: {id: childTaskId}}),
            taskRelation = await repoTaskRelation.findOne({
                where: {
                    Folder: {id: folderId},
                    ParentTask: {id: parentTaskId},
                    ChildTask: {id: childTaskId},
                },
            });
        if (taskRelation) {
            throw new ConflictException(`Parent child relation already exists`);
        }
        // check for task loops
        const loop = await checkForTaskLoop(repoTask, parentTaskId, childTaskId);
        if (loop) {
            throw new ConflictException(`Task loop found`);
        }
        const taskRelationToRemove = await repoTaskRelation.findBy({
            Folder: {id: folderId},
            ChildTask: {id: childTaskDB.id},
        });
        await repoTaskRelation.remove(taskRelationToRemove);
        const ret = await repoTaskRelation.save({
            Folder: {id: folderId},
            ParentTask: parentTaskDB,
            ChildTask: childTaskDB,
            index: 0,
            WorkFlowState: parentTaskDB.ChildrenTasks[0].WorkFlowState,
            stateIndex: 0,
        });
        // update task siblings index
        await this.updateTaskSiblings(parentTaskDB?.id, folderId, 0, childTaskDB.id, childTaskDB.ChildrenTasks[0].index);
        // update task siblings index
        await this.updateFolderWorkflowStateSiblings(
            parentTaskId,
            folderId,
            ret.stateIndex,
            childTaskDB.id,
            parentTaskDB.ChildrenTasks[0].WorkFlowState.id,
            childTaskDB.ChildrenTasks[0].index,
            childTaskDB.ChildrenTasks[0].WorkFlowState.id
        );
        return ret;
    }

    /**
     * Updates the position of a custom field within a task.
     *
     * @param {number} taskId - The ID of the task.
     * @param {number} customFieldId - The ID of the custom field.
     * @param {number} index - The new index position of the custom field.
     * @param {string} userId - The ID of the user performing the update.
     * @throws {NotFoundException} Throws an exception if the task is not found.
     * @throws {UnauthorizedException} Throws an exception if the user doesn't have sufficient permissions.
     * @returns {Promise<void>} A Promise that resolves with no value.
     */
    @Transactional()
    async updateCustomFieldPosition(taskId: number, customFieldId: number, index: number, userId: string): Promise<void> {
        const manager = this.repo.manager;
        const repoCustomFieldValue = manager.getRepository<CustomFieldValueEntity>(CustomFieldValueEntity),
            repoTask = manager.getRepository<TaskEntity>(TaskEntity),
            // validate task
            taskDB = await repoTask
                .createQueryBuilder('Task')
                .innerJoinAndSelect('Task.CustomFieldValues', 'CustomFieldValues')
                .innerJoinAndSelect('CustomFieldValues.CustomFieldDefinition', 'CustomFieldDefinition')
                .leftJoinAndSelect('CustomFieldDefinition.User', 'User', '(User.id IS NULL) OR (User.id = :user_id)', {
                    user_id: userId,
                })
                .where('Task.id =:taskId', {task_id: taskId})
                .getOne();
        if (!taskDB) {
            throw new NotFoundException(`Task ${taskId} not found`);
        }
        if (!taskDB.CustomFieldValues.map((item) => item.CustomFieldDefinition)) {
            throw new UnauthorizedException('You do not have sufficient permissions to modify this Custom field');
        }
        const customFieldsDB = await repoCustomFieldValue
            .createQueryBuilder('CustomFieldValues')
            .innerJoinAndSelect('CustomFieldValues.Task', 'Task', 'Task.id = :taskId', {task_id: taskId})
            .leftJoinAndSelect('CustomFieldValues.CustomFieldDefinition', 'CustomFieldDefinition')
            .orderBy('index', 'ASC')
            .getMany();
        if (!customFieldsDB) {
            throw new NotFoundException(`Custom Fields from task ${taskId} not found`);
        }
        const customFieldToMoveIndex = customFieldsDB.findIndex((x) => x.id === customFieldId),
            customFieldToMove = customFieldsDB[customFieldToMoveIndex];
        customFieldsDB.splice(customFieldToMoveIndex, 1);
        customFieldsDB.splice(index, 0, customFieldToMove);
        let newIndex = 0;
        for (const sibling of customFieldsDB) {
            await repoCustomFieldValue.update(sibling.id, {index: newIndex});
            newIndex++;
        }
    }

    /**
     * Retrieves custom fields related to a task.
     * @param {number} taskId - The ID of the task.
     * @param {string} userId - The ID of the user.
     * @returns {Promise<CustomFieldsTaskResponseDto>} - A promise that resolves with the custom fields response DTO.
     */
    async getCustomFields(taskId: number, userId: string): Promise<CustomFieldsTaskResponseDto> {
        const taskDB = await this.repo
            .createQueryBuilder('Task')
            .leftJoinAndSelect('Task.CustomFieldValues', 'CustomFieldValues')
            .leftJoinAndSelect('CustomFieldValues.CustomFieldDefinition', 'CustomFieldDefinition')
            .where('CustomFieldValues.task_id = :taskId', {taskId})
            .andWhere('((CustomFieldDefinition.user_id IS NULL) OR (CustomFieldDefinition.user_id = :userId))', {userId})
            .getMany();

        const ret = {customFields: [], userCustomFields: []};
        if (taskDB && taskDB.length) {
            for (const customFieldValue of taskDB[0].CustomFieldValues) {
                if (customFieldValue.CustomFieldDefinition.userId /*User*/) {
                    ret.userCustomFields.push(customFieldValue);
                } else {
                    ret.customFields.push(customFieldValue);
                }
                delete customFieldValue.CustomFieldDefinition.userId /*User*/;
            }
        }
        return ret;
    }

    //todo : add return types
    /**
     * Adds a custom field to a task.
     *
     * @param {number} taskId - The ID of the task.
     * @param {number} customFieldId - The ID of the custom field definition.
     * @param {string} userId - The ID of the user.
     * @returns {Promise<unknown>} - A promise that resolves to the result of adding the custom field to the task.
     * @throws {NotFoundException} - If the task with the given ID is not found.
     * @throws {NotFoundException} - If the custom field definition with the given ID is not found.
     * @throws {UnauthorizedException} - If the current user does not have permission to use the custom field.
     * @throws {BadRequestException} - If the custom field already exists on the task.
     */
    @Transactional()
    async addCustomFields(taskId: number, customFieldId: number, userId: string): Promise<InsertResult> {
        const manager = this.repo.manager;
        const repoCustomFieldDefinition = manager.getRepository<CustomFieldDefinitionEntity>(CustomFieldDefinitionEntity),
            repoCustomFieldValue = manager.getRepository<CustomFieldValueEntity>(CustomFieldValueEntity),
            // validate task
            taskDB = await this.repo.findOne({
                where: {id: taskId},
                relations: {CustomFieldValues: {CustomFieldDefinition: true}},
            });
        if (!taskDB) {
            throw new NotFoundException(`Task ${taskId} not found`);
        }
        // validate custom field definition
        const customFieldDefinitionDB = await repoCustomFieldDefinition.findOne({
            where: {id: customFieldId},
            // relations: {User: true},
        });
        if (!customFieldDefinitionDB) {
            throw new NotFoundException(`Custom field definition ${customFieldId} not found`);
        }
        if (customFieldDefinitionDB.userId /*User*/ && customFieldDefinitionDB.userId /*User.id*/ !== userId) {
            throw new UnauthorizedException(`The current user don't have permission to use the custom field ${customFieldId}`);
        }
        // validate custom field value
        const cfd = taskDB.CustomFieldValues.find((x) => x.CustomFieldDefinition.id === customFieldDefinitionDB.id);
        if (cfd) {
            throw new BadRequestException(`Custom field already exists on the task`);
        }
        //get the index from siblings
        const index = await repoCustomFieldValue
            .createQueryBuilder('CustomFieldValue')
            .select('COALESCE(MAX(index), 0) + 1', 'index')
            .where({Task: {id: taskDB.id}})
            .getRawOne();
        // add the custom field to the task
        const ret = await repoCustomFieldValue.insert({
            Task: {id: taskDB.id},
            CustomFieldDefinition: {id: customFieldDefinitionDB.id},
            index: index.index,
        });
        // add custom field to subtasks
        const tree: TaskEntity[] = await this.getTaskTree([taskId]);
        if (tree && tree.length === 1) {
            await this.addCustomFieldToSubTasks(customFieldId, tree[0]['children']);
        }
        // this.enqueueSearchRequest(SearchDocumentOp.upsert, task_id);
        return ret;
    }

    /**
     * Adds a custom field to the subtasks of a given tree of tasks.
     *
     * @param {number} customFieldId - The ID of the custom field to add.
     * @param {TaskEntity[]} tree - The tree of tasks.
     * @return {Promise<void>} - A promise that resolves when the custom field has been added to all subtasks.
     */
    @Transactional()
    async addCustomFieldToSubTasks(customFieldId: number, tree: TaskEntity[]): Promise<void> {
        if (tree) {
            const manager = this.repo.manager;
            const repoCustomFieldValue = manager.getRepository<CustomFieldValueEntity>(CustomFieldValueEntity);
            for (const taskEntity of tree) {
                const cfvDB = await repoCustomFieldValue.findOne({
                    where: {
                        Task: {id: taskEntity.id},
                        CustomFieldDefinition: {id: customFieldId},
                    },
                });
                const index = await repoCustomFieldValue
                    .createQueryBuilder('CustomFieldValue')
                    .select('COALESCE(MAX(index), 0) + 1', 'index')
                    .where({
                        Task: {id: taskEntity.id},
                        CustomFieldDefinition: {id: customFieldId},
                    })
                    .getRawOne();
                if (!cfvDB) {
                    await repoCustomFieldValue.save({
                        Task: {id: taskEntity.id},
                        CustomFieldDefinition: {id: customFieldId},
                        index: index.index,
                    });
                }
                await this.addCustomFieldToSubTasks(customFieldId, tree['children']);
            }
        }
    }

    //todo : add return types
    /**
     * Removes a custom field from a task and its subtasks.
     *
     * @param {number} taskId - The ID of the task to remove the custom field from.
     * @param {number} customFieldId - The ID of the custom field to remove.
     * @param {boolean} needDeleteAlsoForChildren - Indicates whether the custom field should also be removed from the subtasks of the task.
     * @param {string} userId - The ID of the user performing the operation.
     * @returns {Promise<DeleteResult>} - A promise that resolves with the result of the deletion operation.
     * @throws {NotFoundException} - If the custom field definition is not found.
     * @throws {UnauthorizedException} - If the current user does not have permission to use the custom field.
     * @throws {BadRequestException} - If the custom field does not exist on the task.
     */
    @Transactional()
    async removeCustomFields(
        taskId: number,
        customFieldId: number,
        needDeleteAlsoForChildren: boolean,
        userId: string
    ): Promise<Array<CustomFieldValueEntity>> {
        const manager = this.repo.manager,
            repoCustomFieldDefinition = manager.getRepository<CustomFieldDefinitionEntity>(CustomFieldDefinitionEntity),
            repoCustomFieldValue = manager.getRepository<CustomFieldValueEntity>(CustomFieldValueEntity),
            // validate task
            taskDB = await this.repo.findOne({
                where: {id: taskId},
                relations: {CustomFieldValues: {CustomFieldDefinition: true}},
            });

        // validate custom field definition
        const customFieldDefinitionDB = await repoCustomFieldDefinition.findOne({
            where: {id: customFieldId},
            // relations: {User: true},
        });
        if (!customFieldDefinitionDB) {
            throw new NotFoundException(`Custom field definition ${customFieldId} not found`);
        }
        if (customFieldDefinitionDB.userId /*User*/ && customFieldDefinitionDB.userId /*User.id*/ !== userId) {
            throw new UnauthorizedException(`The current user don't have permission to use the custom field ${customFieldId}`);
        }
        // validate custom field value
        const cfd = taskDB.CustomFieldValues.find((x) => x.CustomFieldDefinition.id === customFieldDefinitionDB.id);
        if (!cfd) {
            throw new BadRequestException(`Custom field does not exists on the task`);
        }
        // remove the custom field to the task
        const customFieldToRemove = await repoCustomFieldValue.findBy({
            Task: {id: taskDB.id},
            CustomFieldDefinition: {id: customFieldId},
        });
        const ret = await repoCustomFieldValue.remove(customFieldToRemove);
        // remove custom field from subtasks
        if (needDeleteAlsoForChildren) {
            const tree: TaskEntity[] = await this.getTaskTree([taskId]);
            if (tree && tree.length === 1) {
                await this.removeCustomFieldToSubTasks(customFieldId, tree[0]['children']);
            }
        }
        // this.enqueueSearchRequest(SearchDocumentOp.upsert, task_id);
        return ret;
    }

    /**
     * Removes a custom field from subtasks in a tree of tasks.
     *
     * @param {number} customFieldId - The id of the custom field to be removed.
     * @param {TaskEntity[]} tree - The tree of tasks to modify.
     *
     * @return {Promise<void>} - A promise that resolves when the custom field has been removed from all subtasks.
     *
     * @throws - Any error*/
    @Transactional()
    async removeCustomFieldToSubTasks(customFieldId: number, tree: TaskEntity[]): Promise<void> {
        if (tree) {
            const manager = this.repo.manager;
            const repoCustomFieldValue = manager.getRepository<CustomFieldValueEntity>(CustomFieldValueEntity);
            for (const taskEntity of tree) {
                const customFieldValuesToRemove = await repoCustomFieldValue.findBy({
                    Task: {id: taskEntity.id},
                    CustomFieldDefinition: {id: customFieldId},
                });
                await repoCustomFieldValue.remove(customFieldValuesToRemove);
                await this.removeCustomFieldToSubTasks(customFieldId, tree['children']);
            }
        }
    }

    //todo : add return types
    /**
     * Sets the value of a custom field for a task.
     *
     * @param {number} taskId - The ID of the task.
     * @param {number} customFieldId - The ID of the custom field.
     * @param {string} value - The value to set for the custom field.
     * @param {string} userId - The ID of the user making the request.
     * @returns {Promise<unknown>} - A Promise that resolves to the result of the update operation.
     * @throws {NotFoundException} - If the task with the provided ID is not found.
     * @throws {NotFoundException} - If the custom field definition with the provided ID is not found.
     * @throws {UnauthorizedException} - If the current user does not have permission to use the custom field.
     * @throws {BadRequestException} - If the custom field does not exist on the task.
     * @throws {Error} - If there was an error fetching the gantt columns of the task.
     */
    @Transactional()
    async setCustomFieldValue(taskId: number, customFieldId: number, value: string, userId: string): Promise<unknown> {
        const manager = this.repo.manager,
            repoCustomFieldDefinition = manager.getRepository<CustomFieldDefinitionEntity>(CustomFieldDefinitionEntity),
            repoCustomFieldValue = manager.getRepository<CustomFieldValueEntity>(CustomFieldValueEntity),
            // validate task
            taskDB = await this.repo.findOne({
                where: {id: taskId},
                relations: {CustomFieldValues: {CustomFieldDefinition: true}},
            });
        if (!taskDB) {
            throw new NotFoundException(`Task ${taskId} not found`);
        }
        // validate custom field definition
        const customFieldDefinitionDB = await repoCustomFieldDefinition.findOne({
            where: {id: customFieldId},
            // relations: {User: true},
        });
        if (!customFieldDefinitionDB) {
            throw new NotFoundException(`Custom field definition ${customFieldId} not found`);
        }
        if (customFieldDefinitionDB.userId /*User*/ && customFieldDefinitionDB.userId /*User.id*/ !== userId) {
            throw new UnauthorizedException(`The current user don't have permission to use the custom field ${customFieldId}`);
        }
        // validate custom field value
        const cfd = taskDB.CustomFieldValues.find((x) => x.CustomFieldDefinition.id === customFieldDefinitionDB.id);
        if (!cfd) {
            throw new BadRequestException(`Custom field does not exists on the task`);
        }
        // this.enqueueSearchRequest(SearchDocumentOp.upsert, taskId);
        validateCustomFieldValue(customFieldDefinitionDB.type, value);

        const retVal = await repoCustomFieldValue.update(
            {
                Task: {id: taskDB.id},
                CustomFieldDefinition: {id: customFieldDefinitionDB.id},
            },
            {value}
        );

        // Automations notification
        const importanceId = await this.getImportance(taskId);
        const assignees = await this.getAssignees(taskId);
        const folderId = await this.getFolderIdByTaskId(taskId);
        // eslint-disable-next-line @typescript-eslint/require-await
        runOnTransactionCommit(async () => {
            if (userId != SERVICE_USER_ID) {
                const notification = AutomationUtils.createNotificationDto(AutomationsEventOptions.TASK_CUSTOM_FIELD_CHANGED);
                const detail = new AutomationNotificationDetailTaskEventDto();
                notification.fromUser = userId;
                notification.locationId = folderId.toString();
                notification.entityId = taskId.toString();
                detail.assignees = assignees;
                detail.importanceId = importanceId;
                detail.customFieldChangedId = customFieldDefinitionDB.id.toString();
                detail.customFieldChangedValueFrom = cfd.value;
                detail.customFieldChangedValueTo = value;
                notification.detail = detail;
                await this.automationsSendService.queueMessage(notification);
            }
        });

        return retVal;
    }

    /**
     * Updates multiple tasks with the provided task IDs, data, and user.
     *
     * @param {number[]} task_ids - The IDs of the tasks to update.
     * @param {UpdateTaskDto} dto - The data to update the tasks with.
     * @param {JwtUserInterface} user - The user performing the update.
     * @returns {Promise<void>} - A Promise indicating the completion of the update.
     * @throws {BadRequestException} - If there was an error updating tasks.
     * @throws {Error} - If there was an error during the update process.
     */
    async updateManyV1(task_ids: number[], dto: UpdateTaskDto, user: JwtUserInterface): Promise<void> {
        const manager = this.repo.manager;
        const repoTask = manager.getRepository<TaskEntity>(TaskEntity),
            res = [];
        const task = await repoTask
            .createQueryBuilder('Task')
            .select('Task.id')
            .where('Task.id IN (:task_ids)', {task_ids: task_ids})
            .andWhere('Task.user_id =:user_id', {user_id: user.id})
            .getMany();
        if (task) {
            res.push(task);
        }
        if (res.length == task_ids.length) {
            for (const ret of res) {
                //folder_id is passed null from here
                await this.update(ret.id, dto, user);
            }
        } else {
            throw new BadRequestException('There was an error updating tasks');
        }
    }

    /**
     * Update the position of multiple tasks.
     *
     * @param {number[]} task_ids - An array of task IDs to update.
     * @param {UpdateTaskPositionDto} dto - The position update details.
     * @param {JwtUserInterface} user - The user performing the update.
     * @returns {Promise<void>} - A promise that resolves when the update is complete.
     * @throws {BadRequestException} - If there was an error updating the tasks.
     */
    @Transactional()
    async updateManyTaskPosition(task_ids: number[], dto: UpdateTaskPositionDto, user: JwtUserInterface): Promise<void> {
        const manager = this.repo.manager,
            repoTask = manager.getRepository<TaskEntity>(TaskEntity),
            tasks = await repoTask
                .createQueryBuilder('Task')
                .where('Task.id IN (:task_ids)', {task_ids: task_ids})
                .andWhere('Task.user_id = :user_id', {user_id: user.id})
                .getMany();
        if (tasks.length === task_ids.length) {
            for (const ret of tasks) {
                await this.updatePosition(ret.id, dto, user);
                dto.index++;
            }
        } else {
            throw new BadRequestException('There was an error updating tasks');
        }
    }

    /**
     * Update the positions of multiple tasks.
     *
     * @param {UpdateManyTaskPositionDto} dto - The DTO containing the tasks to update and their positions.
     * @param {JwtUserInterface} user - The user performing the update.
     * @throws {BadRequestException} - If there is an error updating tasks.
     * @returns {Promise<void>} - A promise that resolves when the update is finished.
     */
    @Transactional()
    async updateManyTaskPositionV2(dto: UpdateManyTaskPositionDto, user: JwtUserInterface): Promise<void> {
        if (dto.tasks.length) {
            for (const task of dto.tasks) {
                await this.updatePosition(task.id, task, user);
                task.index++;
            }
        } else {
            throw new BadRequestException('There was an error updating tasks');
        }
    }

    /**
     * Adds custom fields to multiple tasks.
     *
     * @param {number[]} taskIds - An array of task IDs to update.
     * @param {number} customFieldId - The ID of the custom field to add.
     * @param {string} userId - The ID of the user who owns the tasks.
     * @return {Promise<void>} A promise that resolves when the custom fields have been added to the tasks.
     */
    @Transactional()
    async addManyCustomFields(taskIds: number[], customFieldId: number, userId: string): Promise<void> {
        const manager = this.repo.manager;
        const repoTask = manager.getRepository<TaskEntity>(TaskEntity);
        const task = await repoTask
            .createQueryBuilder('Task')
            .select('Task.id')
            .where('Task.id IN (:taskIds)', {task_ids: taskIds})
            .andWhere('Task.user_id = :user_id', {user_id: userId})
            .getMany();
        if (task.length == taskIds.length) {
            for (const ret of task) {
                await this.addCustomFields(ret.id, customFieldId, userId);
            }
        } else {
            throw new BadRequestException('There was an error updating tasks');
        }
    }

    /**
     * Adds a tag to a task.
     *
     * @param {number} taskId - The ID of the task.
     * @param {number} tagId - The ID of the tag.
     * @param {string} userId - The ID of the user.
     * @return {Promise<TagTaskFolderEntity>} A promise that resolves with the updated TagTaskFolderEntity.
     * @throws {Error} If there was an error adding the tag to the task.
     */
    @Transactional()
    async addTag(taskId: number, tagId: number, userId: string): Promise<TagTaskFolderEntity> {
        //check if user have permissions to add the tag or not
        const result = await this.repo.manager.getRepository<TagTaskFolderEntity>(TagTaskFolderEntity).save({
            Task: {id: taskId},
            Tag: {id: tagId},
            type: TagTaskFolderTypeOptions.TASK_TAG,
        });
        const taskFolder = await this.repo.manager.getRepository<TaskRelationEntity>(TaskRelationEntity).findOne({
            where: {ChildTask: {id: taskId}},
        });
        const recipients = (await this.notificationService.getTaskNotificationRecipients(taskId)).filter(
            (x) => x !== userId || x !== SERVICE_USER_ID
        );
        const tagTitle = result.Tag.title;
        const emailDto = await this.notificationService.setTaskEmailDto(taskId, null, [], TaskActionOptions.TAG);
        const user = await this.repo.manager.getRepository(UserEntity).findOne({where: {id: userId}});
        const [{id: spaceId = null}] = await this.repo.query(queries.getSpaceWithFolderIdSql, [taskFolder.folderId]);
        runOnTransactionCommit(() => {
            this.eventEmitter.emit(TaskEventNameOptions.TASK_TAG, {
                data: {
                    event: TaskEventNameOptions.TASK_TAG,
                    message: this.notificationService.setNotificationMessage({
                        actions: {
                            tagged: {
                                title: tagTitle,
                            },
                        },
                        entity: 'task',
                        entityTitle: taskFolder.ChildTask?.title,
                        sender: getUserFullName(user),
                    }),
                    userId,
                    folderId: taskFolder.folderId,
                    taskId: result.Task.id,
                    spaceId,
                    ...emailDto,
                },
                userId: null,
                recipients,
            } as EntityNotificationDto);
        });
        return result;
    }

    /**
     * Remove a tag from a task
     *
     * @param {number} taskId - The ID of the task
     * @param {number} tagId - The ID of the tag
     * @return {Promise<DeleteResult>} - The number of rows affected
     */
    @Transactional()
    async removeTag(taskId: number, tagId: number): Promise<TagTaskFolderEntity> {
        const recordToDelete = await this.repo.manager
            .getRepository<TagTaskFolderEntity>(TagTaskFolderEntity)
            .findOneBy({Task: {id: taskId}, Tag: {id: tagId}});

        return await this.repo.manager.getRepository<TagTaskFolderEntity>(TagTaskFolderEntity).remove(recordToDelete);
    }

    /**
     * Removes all tags associated with a given task.
     *
     * @param {number} taskId - The id of the task.
     * @returns {Promise<DeleteResult>} - A promise that resolves to a DeleteResult object.
     */
    @Transactional()
    async removeAllTags(taskId: number): Promise<Array<TagTaskFolderEntity>> {
        const tagTaskToRemove = await this.repo.manager
            .getRepository<TagTaskFolderEntity>(TagTaskFolderEntity)
            .findBy({Task: {id: taskId}});
        return await this.repo.manager.getRepository<TagTaskFolderEntity>(TagTaskFolderEntity).remove(tagTaskToRemove);
    }

    /**
     * Follows a task with the given taskId by the user with the specified userId.
     * If the user is already subscribed to the task, it throws a BadRequestException.
     * Uses the @Transactional decorator to ensure the method is executed within a transaction.
     *
     * @param {number} taskId - The ID of the task to follow.
     * @param {string} userId - The ID of the user who wants to follow the task.
     * @returns {Promise<TaskFollowerEntity>} - A Promise that resolves to the TaskFollowerEntity object that represents the subscription.
     * @throws {BadRequestException} - If the user is already subscribed to the task.
     */
    @Transactional()
    async follow(taskId: number, userId: string): Promise<TaskFollowerEntity> {
        const manager = this.repo.manager;
        const repoTaskSubscription = manager.getRepository<TaskFollowerEntity>(TaskFollowerEntity);

        const subscription = await repoTaskSubscription.findOne({
            where: {
                Task: {id: taskId},
                userId: userId,
            },
        });

        if (subscription) {
            throw new BadRequestException('You are already subscribed to this task');
        }

        // TODO: We should use "insert" here
        return await repoTaskSubscription.save({
            Task: {id: taskId},
            userId: userId,
        });
    }

    //todo : add return types
    /**
     * Remove a Follower from a specific task
     *
     * @param {number} taskId - The task id
     * @param {string} userId - The user id to unfollow
     * @returns {Promise<DeleteResult>} - The deleting result
     */
    @Transactional()
    async unfollow(taskId: number, userId: string): Promise<DeleteResult> {
        const manager = this.repo.manager;
        const repoTaskFollower = manager.getRepository<TaskFollowerEntity>(TaskFollowerEntity),
            subscription = await repoTaskFollower.findOne({
                where: {
                    Task: {id: taskId},
                    userId: userId,
                },
            });
        if (!subscription) {
            throw new BadRequestException(`You are not subscribed to this task`);
        }
        return await repoTaskFollower.delete({id: subscription.id});
    }

    //todo : add return types
    /**
     * Retrieves the followers for a given task.
     *
     * @param {number} taskId - The ID of the task.
     * @return {Promise<unknown>} - A promise that resolves with the followers of the task.
     */
    async getFollowers(taskId: number): Promise<unknown> {
        const manager = this.repo.manager;
        const repoTaskFollower = manager.getRepository<TaskFollowerEntity>(TaskFollowerEntity);
        return await repoTaskFollower.find({
            where: {Task: {id: taskId}},
        });
    }

    /**
     * Retrieves the tasks that a user is following.
     *
     * @param {JwtUserInterface} user - The user for whom to retrieve the tasks they are following.
     * @return {Promise<GetFollowingTaskDto[]>} - A promise that resolves to an array of GetFollowingTaskDto objects representing the tasks.
     */
    getFollowing(user: JwtUserInterface): Promise<GetFollowingTaskDto[]> {
        const query = `SELECT T.ID,
                              T.TITLE,
                              T.start_date AS "startDate",
                              T.end_date AS "endDate",
                              T.USER_ID,
                              T.IMPORTANCE_ID,
                              T.ASSIGNEES,
                              --(SELECT ARRAY
                              --($ { queries . taskAssignees } AND CAST(ASSIGNED_PERMISSION.ENTITY_ID as integer) = T.ID)) AS ASSIGNEES,
                              (SELECT ARRAY
                                          (SELECT LT.TAG_ID
                                           FROM TAGS_TASK_FOLDER LT
                                                    INNER JOIN TAGS L
                                                               ON (L.ID = LT.TAG_ID) AND (L.USER_ID IS NULL OR L.USER_ID = $1)
                                           WHERE LT.TASK_ID = T.ID)) AS TAGS,
                              (SELECT JSON_AGG(X)
                               FROM (SELECT TR.WORKFLOW_STATE_ID,
                                            WS.WORKFLOW_ID,
                                            F.ID as FOLDER_ID
                                     FROM WORKFLOW_STATE WS
                                              INNER JOIN WORKFLOW W ON W.ID = WS.WORKFLOW_ID
                                              INNER JOIN FOLDER F ON F.WORKFLOW_ID = W.ID
                                              INNER JOIN TASK_RELATION TR ON TR.FOLDER_ID = F.ID
                                         AND TR.WORKFLOW_STATE_ID = WS.ID
                                     WHERE TR.CHILD_TASK_ID = T.ID
                                       AND F.archived_at IS NULL AND F.deleted_at IS NULL) AS X) AS STATES
                       FROM TASK T
                                INNER JOIN TASK_FOLLOWER TF ON T.ID = TF.TASK_ID
                       WHERE TF.USER_ID = $1`;
        return this.repo.manager.query(query, [user.id]);
    }

    /**
     * Archives a task tree.
     * This method requires 'editor' permission.
     *
     * @param {number} taskId - The id of the task to be archived.
     * @param {string} userId - The id of the user performing the operation*/
    @Transactional()
    async archive(taskId: number, user: JwtUserInterface, dto?: ArchiveTaskDto): Promise<void> {
        const manager = this.repo.manager;
        const repoTask = manager.getRepository<TaskEntity>(TaskEntity.name),
            repoTaskRelation = manager.getRepository<TaskRelationEntity>(TaskRelationEntity.name);

        await repoTask.update(
            {id: taskId},
            {
                archivedAt: new Date(),
                archivedBy: user.id,
                archivedWhy: dto?.archiveReason ?? '',
                id: taskId,
            }
        );

        this.logger.debug('Updating archived task recursive');
        await this.archiveRecursive(taskId, user.id, dto);

        const task = await this.repo.findOne({where: {id: taskId}, relations: {}});
        const parentFolder = await repoTaskRelation.findOne({
            where: {ChildTask: {id: taskId}},
            relations: {Folder: true},
        });

        const recipients = (await this.notificationService.getTaskNotificationRecipients(taskId)).filter(
            (x) => x !== user.id || x !== SERVICE_USER_ID
        );

        const emailDto = await this.notificationService.setTaskEmailDto(
            taskId,
            user as unknown as JwtUserInterface,
            [],
            TaskActionOptions.ARCHIVE
        );

        let spaceId: number | null = null;
        if (parentFolder) {
            const [space] = await this.repo.query(queries.getSpaceWithFolderIdSql, [parentFolder.folderId]);
            spaceId = space?.id || null;
        }

        runOnTransactionCommit(() => {
            this.eventEmitter.emit(TaskEventNameOptions.TASK_ARCHIVE, {
                data: {
                    event: TaskEventNameOptions.TASK_ARCHIVE,
                    message: this.notificationService.setNotificationMessage({
                        actions: {
                            archived: true,
                        },
                        sender: getUserFullName(user),
                        entity: 'task',
                        entityTitle: task.title,
                    }),
                    userId: user.id,
                    folderId: parentFolder.folderId,
                    taskId,
                    spaceId,
                    ...emailDto,
                },
                userId: user.id,
                recipients: recipients.length > 0 ? recipients : [user.id],
            } as EntityNotificationDto);
        });
    }

    @Transactional()
    async delete(taskId: number, user: JwtUserInterface): Promise<void> {
        const manager = this.repo.manager;

        const repoTask = manager.getRepository<TaskEntity>(TaskEntity.name);
        const repoTaskRelation = manager.getRepository<TaskRelationEntity>(TaskRelationEntity);

        await repoTask.update({id: taskId}, {deletedAt: new Date(), deletedBy: user.id, deletedWhy: '', id: taskId});

        await this.deleteRecursive(taskId, user.id);

        const task = await this.repo.findOne({where: {id: taskId}, relations: {}});
        const parentFolder = await repoTaskRelation.findOne({
            where: {ChildTask: {id: taskId}},
            relations: {Folder: true},
        });

        const recipients = (await this.notificationService.getTaskNotificationRecipients(taskId)).filter(
            (x) => x !== user.id || x !== SERVICE_USER_ID
        );

        const emailDto = await this.notificationService.setTaskEmailDto(
            taskId,
            user as unknown as JwtUserInterface,
            [],
            TaskActionOptions.DELETE
        );

        let spaceId: number | null = null;
        if (parentFolder) {
            const [space] = await this.repo.query(queries.getSpaceWithFolderIdSql, [parentFolder.folderId]);
            spaceId = space?.id || null;
        }
        runOnTransactionCommit(() => {
            this.eventEmitter.emit(TaskEventNameOptions.TASK_DELETE, {
                data: {
                    event: TaskEventNameOptions.TASK_DELETE,
                    message: this.notificationService.setNotificationMessage({
                        actions: {
                            deleted: {
                                id: taskId,
                            },
                        },
                        sender: getUserFullName(user),
                        entity: 'task',
                        entityTitle: task.title,
                    }),
                    userId: user.id,
                    folderId: parentFolder.folderId,
                    taskId,
                    spaceId,
                    ...emailDto,
                },
                userId: user.id,
                recipients: recipients.length > 0 ? recipients : [user.id],
            } as EntityNotificationDto);
        });
    }

    /**
     * Archives a task and its children recursively.
     *
     * @param {number} parentTaskId - The ID of the parent task to be archived.
     * @param {string} userId - The ID of the user performing the operation.
     * @return {Promise<void>} - A Promise that resolves when the operation is complete.
     *
     * @throws {ForbiddenException} - If the user does not have permissions to the tasks.
     * @throws {Error} - If there was an error while archiving the tasks.
     */
    @Transactional()
    async archiveRecursive(parentTaskId: number, userId: string, dto?: ArchiveTaskDto): Promise<void> {
        const manager = this.repo.manager;
        const repoTaskRelation = manager.getRepository<TaskRelationEntity>(TaskRelationEntity),
            repoTask = manager.getRepository<TaskEntity>(TaskEntity),
            childrenTaskDB = await repoTaskRelation.find({
                where: {ParentTask: {id: parentTaskId}, ChildTask: {archivedAt: null, deletedAt: null}},
                relations: {ChildTask: true /*{Owner: true}*/, ParentTask: true},
            });
        for (const taskRelationDB of childrenTaskDB) {
            // Update folder
            // according to new permissions we dont check task owner permissions
            // if (taskRelationDB.ChildTask?.userId /*Owner?.id*/ === userId) {
            await repoTask.update(
                {id: taskRelationDB.ChildTask.id},
                {archivedAt: new Date(), archivedBy: userId, archivedWhy: dto?.archiveReason ?? '', id: taskRelationDB.ChildTask.id}
            );
            await this.archiveRecursive(taskRelationDB.ChildTask.id, userId, dto);
            // } else {
            //     throw new ForbiddenException(`The user don't have permissions to the task ${taskRelationDB.ChildTask.id}`);
            // }
        }
    }

    @Transactional()
    async deleteRecursive(parentTaskId: number, userId: string): Promise<void> {
        const manager = this.repo.manager;
        const repoTaskRelation = manager.getRepository<TaskRelationEntity>(TaskRelationEntity),
            repoTask = manager.getRepository<TaskEntity>(TaskEntity),
            childrenTaskDB = await repoTaskRelation.find({
                where: {ParentTask: {id: parentTaskId}, ChildTask: {deletedAt: null}},
                relations: {ChildTask: true /*{Owner: true}*/, ParentTask: true},
            });
        for (const taskRelationDB of childrenTaskDB) {
            // Update folder
            if (taskRelationDB.ChildTask?.userId /*Owner?.id*/ === userId) {
                await repoTask.update(
                    {id: taskRelationDB.ChildTask.id},
                    {
                        deletedAt: new Date(),
                        deletedBy: userId,
                        deletedWhy: '',
                        id: taskRelationDB.ChildTask.id,
                    }
                );
                await this.deleteRecursive(taskRelationDB.ChildTask.id, userId);
            } else {
                throw new ForbiddenException(`The user don't have permissions to the task ${taskRelationDB.ChildTask.id}`);
            }
        }
    }

    /**
     * Restore archived task
     * Need at least 'editor' permission
     *
     * @param {number} taskId - The ID of the task
     * @param {string} userId - The ID of the user performing the restore
     * @return {Promise<void>} - A promise that resolves when the task is successfully restored
     */
    @Transactional()
    async restore(taskId: number, user: JwtUserInterface): Promise<void> {
        const manager = this.repo.manager;
        const repoTask = manager.getRepository<TaskEntity>(TaskEntity.name),
            repoTaskRelation = manager.getRepository<TaskRelationEntity>(TaskRelationEntity),
            taskDB = await repoTask.findOne({
                where: {
                    archivedAt: null,
                    id: taskId,
                },
            });
        if (!taskDB) {
            throw new NotFoundException(`There was an error while getting archived task ${taskId}`);
        }
        await repoTask.update(taskDB.id, {archivedAt: null, archivedBy: null, archivedWhy: '', id: taskDB.id});

        await this.restoreRecursive(taskId, user.id);

        const task = await this.repo.findOne({where: {id: taskId}, relations: {}});
        const parentFolder = await repoTaskRelation.findOne({
            where: {ChildTask: {id: taskId}},
            relations: {Folder: true},
        });

        const recipients = (await this.notificationService.getTaskNotificationRecipients(taskId)).filter(
            (x) => x !== user.id || x !== SERVICE_USER_ID
        );

        const emailDto = await this.notificationService.setTaskEmailDto(
            taskId,
            user as unknown as JwtUserInterface,
            [],
            TaskActionOptions.UNARCHIVE
        );

        let spaceId: number | null = null;
        if (parentFolder) {
            const [{id}] = await this.repo.query(queries.getSpaceWithFolderIdSql, [parentFolder.folderId]);
            spaceId = id || null;
        }
        runOnTransactionCommit(() => {
            this.eventEmitter.emit(TaskEventNameOptions.TASK_UNARCHIVE, {
                data: {
                    event: TaskEventNameOptions.TASK_UNARCHIVE,
                    message: this.notificationService.setNotificationMessage({
                        actions: {
                            unarchived: true,
                        },
                        sender: getUserFullName(user),
                        entity: 'task',
                        entityTitle: task.title,
                    }),
                    userId: user.id,
                    folderId: parentFolder.folderId,
                    taskId,
                    spaceId,
                    ...emailDto,
                },
                userId: user.id,
                recipients: recipients.length > 0 ? recipients : [user.id],
            } as EntityNotificationDto);
        });
    }

    /**
     * Restore deleted task
     * Need at least 'editor' permission
     *
     * @param {number} taskId - The ID of the task
     * @param {string} userId - The ID of the user performing the restore
     * @return {Promise<void>} - A promise that resolves when the task is successfully restored
     */
    @Transactional()
    async restoreDeleted(taskId: number, user: JwtUserInterface): Promise<void> {
        const manager = this.repo.manager;
        const repoTask = manager.getRepository<TaskEntity>(TaskEntity.name),
            repoTaskRelation = manager.getRepository<TaskRelationEntity>(TaskRelationEntity),
            taskDB = await repoTask.findOne({
                where: {
                    archivedAt: null,
                    id: taskId,
                },
            });
        if (!taskDB) {
            throw new NotFoundException(`There was an error while getting archived task ${taskId}`);
        }
        await repoTask.update(taskDB.id, {deletedAt: null, deletedBy: null, deletedWhy: '', id: taskDB.id});

        await this.restoreDeletedRecursive(taskId, user.id);

        const task = await this.repo.findOne({where: {id: taskId}, relations: {}});
        const parentFolder = await repoTaskRelation.findOne({
            where: {ChildTask: {id: taskId}},
            relations: {Folder: true},
        });

        const recipients = (await this.notificationService.getTaskNotificationRecipients(taskId)).filter(
            (x) => x !== user.id || x !== SERVICE_USER_ID
        );

        const emailDto = await this.notificationService.setTaskEmailDto(
            taskId,
            user as unknown as JwtUserInterface,
            [],
            TaskActionOptions.RESTORE
        );

        let spaceId: number | null = null;
        if (parentFolder) {
            const [{id}] = await this.repo.query(queries.getSpaceWithFolderIdSql, [parentFolder.folderId]);
            spaceId = id || null;
        }
        runOnTransactionCommit(() => {
            this.eventEmitter.emit(TaskEventNameOptions.TASK_RESTORE, {
                data: {
                    event: TaskEventNameOptions.TASK_RESTORE,
                    message: this.notificationService.setNotificationMessage({
                        actions: {
                            restored: {
                                id: taskId,
                            },
                        },
                        sender: getUserFullName(user),
                        entity: 'task',
                        entityTitle: task.title,
                    }),
                    userId: user.id,
                    folderId: parentFolder.folderId,
                    taskId,
                    spaceId,
                    ...emailDto,
                },
                userId: user.id,
                recipients: recipients.length > 0 ? recipients : [user.id],
            } as EntityNotificationDto);
        });
    }

    /**
     * Restores a task's children recursively
     * @param {number} parentTaskId - The id of the parent task being restored
     * @param {string} userId - The id of the user performing the restore
     * @returns {Promise<void>} - A promise that resolves once the restore operation is complete
     */
    @Transactional()
    async restoreRecursive(parentTaskId: number, userId: string): Promise<void> {
        const manager = this.repo.manager;
        try {
            const repoTaskRelation = manager.getRepository<TaskRelationEntity>(TaskRelationEntity),
                repoTask = manager.getRepository<TaskEntity>(TaskEntity.name),
                childrenTaskDB = await repoTaskRelation.find({
                    where: {ParentTask: {id: parentTaskId, archivedAt: null}},
                    relations: {ChildTask: true /*{Owner: true}*/, ParentTask: true},
                });
            for (const taskRelationDB of childrenTaskDB) {
                // Update folder
                // if (
                //     taskRelationDB.ChildTask?.Owner.id === user.id ||
                //     (await validateFolderTaskPermission(taskRelationDB.ChildTask.id, user, manager))
                // ) {
                await repoTask.update(
                    {id: taskRelationDB.ChildTask.id},
                    {
                        archivedAt: null,
                        archivedBy: null,
                        archivedWhy: '',
                        id: taskRelationDB.ChildTask.id,
                    }
                );
                await this.restoreRecursive(taskRelationDB.ChildTask.id, userId);
                // } else {
                //     throw new ForbiddenException(`The user don't have permissions to the task ${taskRelationDB.ChildTask?.id}`);
                // }
            }
        } catch (error) {
            this.logger.error(`There was an error restoring archived task ${parentTaskId}`, error);
            throw error;
        }
    }

    @Transactional()
    async restoreDeletedRecursive(parentTaskId: number, userId: string): Promise<void> {
        const manager = this.repo.manager;
        try {
            const repoTaskRelation = manager.getRepository<TaskRelationEntity>(TaskRelationEntity),
                repoTask = manager.getRepository<TaskEntity>(TaskEntity.name),
                childrenTaskDB = await repoTaskRelation.find({
                    where: {ParentTask: {id: parentTaskId, archivedAt: null}},
                    relations: {ChildTask: true /*{Owner: true}*/, ParentTask: true},
                });
            for (const taskRelationDB of childrenTaskDB) {
                await repoTask.update(
                    {id: taskRelationDB.ChildTask.id},
                    {
                        deletedAt: null,
                        deletedBy: null,
                        deletedWhy: '',
                        id: taskRelationDB.ChildTask.id,
                    }
                );
                await this.restoreDeletedRecursive(taskRelationDB.ChildTask.id, userId);
            }
        } catch (error) {
            this.logger.error(`There was an error restoring archived task ${parentTaskId}`, error);
            throw error;
        }
    }

    /**
     * Retrieves a list of archived tasks associated with the specified folder IDs.
     *
     * @param {number[]} folderIds - An array of folder IDs to retrieve tasks from.
     */
    async getManyArchived(folderIds: number[]): Promise<TaskEntity[]> {
        const query = `SELECT
                        T.id AS ID,
                        T.title AS TITLE,
                        TR.folder_id AS "folderId",
                        F.user_id AS "ownerId",
                        (SELECT JSON_AGG(X)
                           FROM (SELECT FU.USER_ID  AS "userId", FU.user_permission as "userPermission", FU.inherit
                                 FROM folder_user_ap FU
                                 WHERE FU.FOLDER_ID = TR.FOLDER_ID AND FU.ENTITY_TYPE = 'folder') AS X) AS MEMBERS
                    FROM TASK T
                    INNER JOIN task_relation TR ON T.ID = TR.CHILD_TASK_ID AND TR.FOLDER_ID = ANY($1)
                    INNER JOIN folder F ON F.ID = TR.FOLDER_ID
                    WHERE T.archived_at IS NOT NULL`;

        return await this.repo.query(query, [folderIds]);
    }

    async getFolderTasks(dto: PaginationDto, folderId: number, showOn: string): Promise<ArchivedDeletedFolderTasksResponseDto> {
        const repoTaskRelation = this.repo.manager.getRepository<TaskRelationEntity>(TaskRelationEntity);

        const {offset, limit} = this.createPagination(dto);

        const totalTasks = await repoTaskRelation.count({where: {folderId}});

        const archivedTasksQuery = `SELECT T.ID,
            T.TITLE,
			T.ARCHIVED_AT,
            T.ARCHIVED_BY,
            T.DELETED_AT,
            T.DELETED_BY,
            T.SHOW_ON,
			TR.FOLDER_ID,
            TR.path_ids,
			TR.PARENT_TASK_ID AS "parentTaskId",
			TR.CHILD_TASK_ID,
            (
                SELECT JSON_AGG(
                            json_build_object(
                                'title', T2.title,
                                'type', CASE WHEN T3.PARENT_TASK_ID IS NOT NULL THEN 'subtask' ELSE 'task' END
                            )
                        ) AS pathDetails
                FROM "${RawDatabaseConfig.schema}".task T2
                LEFT JOIN "${RawDatabaseConfig.schema}".task_relation T3 ON T2.ID = T3.CHILD_TASK_ID
                WHERE T2.id = ANY(TR.path_ids)
            ) AS "pathString"
		FROM "${RawDatabaseConfig.schema}".task T
		INNER JOIN "${RawDatabaseConfig.schema}".task_relation TR ON TR.CHILD_TASK_ID = T.ID WHERE TR.FOLDER_ID = $4 AND ($1 = ANY (T.SHOW_ON)) LIMIT $2 OFFSET $3`;

        const archivedTasks = await this.repo.manager.query(archivedTasksQuery, [showOn, limit, offset, folderId]);

        const modifiedArchivedTasks: ArchivedDeletedFolderTasksDto[] = archivedTasks.map((task) => {
            return {
                id: task.id,
                type: task.parentTaskId ? ArchivedTypeOptions.SUB_TASK : ArchivedTypeOptions.TASK,
                archivedBy: task.archived_by,
                archivedAt: task.archived_at,
                deletedBy: task.deleted_by,
                deletedAt: task.deleted_at,
                title: task.title,
                pathIds: task.path_ids,
                pathStr: task.pathString,
                folderId: task.folder_id,
            };
        });
        return {data: modifiedArchivedTasks, metadata: {totalRecords: totalTasks ?? 0}};
    }

    // enqueueSearchRequest(operation: SearchDocumentOp, taskId: number): void {
    //     runOnTransactionCommit(async () => {
    //         try {
    //             await this.enqueuerService.sendMessage({
    //                 documentType: SearchDocumentType.task,
    //                 operation,
    //                 recordId: taskId,
    //             });
    //         } catch (error) {
    //             this.logger.error(`There was an error while enqueuing a task in search service`, error);
    //         }
    //     });
    // }

    /**
     * Handle task date changes.
     *
     * @param {number} taskId - The ID of the task to handle date changes for.
     * @param {number} folderId - The ID of the folder containing the task.
     * @param {JwtUserInterface | UserEntity} user - The user making the changes.
     * @return {Promise<void>} - A Promise that resolves when the date changes are handled successfully.
     */
    async handleTaskDateChanges(taskId: number, folderId: number, user: JwtUserInterface | UserEntity): Promise<void> {
        await this.updateSuccessorTaskDate(folderId, taskId, user);
        await this.updateChildTasksQuery(folderId, taskId, user);
        await this.updateParentTasksQuery(folderId, taskId, user);
        await this.updateProjectDate(folderId);
    }

    /**
     * Updates child tasks query.
     *
     * @param {number} folderId - The ID of the folder.
     * @param {number} taskId - The ID of the task.
     * @param {JwtUserInterface | UserEntity} user - The user performing the update.
     * @return {Promise<void>} - A promise that resolves once the update is complete.
     */
    async updateChildTasksQuery(folderId: number, taskId: number, user: JwtUserInterface | UserEntity): Promise<void> {
        const childQuery = `WITH RECURSIVE TASKS AS (SELECT NULL::INTEGER AS PARENT_TASK_ID,
                                                                        TR.CHILD_TASK_ID,
                                                                        T.ID,
                                                                        T.start_date AS "startDate",
                                                                        T.end_date AS "endDate"
                                                                 FROM TASK_RELATION TR
                                                                          INNER JOIN TASK T ON T.ID = TR.CHILD_TASK_ID
                                                                 WHERE TR.FOLDER_ID = $1
                                                                  AND T.archived_at IS NULL
                                                                  AND T.deleted_at IS NULL
                                                                   AND TR.CHILD_TASK_ID = $2
                                                                 UNION ALL
                                                                 SELECT TR.PARENT_TASK_ID,
                                                                        TR.CHILD_TASK_ID,
                                                                        T.ID,
                                                                        T.start_date AS "startDate",
                                                                        T.end_date AS "endDate"
                                                                 FROM TASK_RELATION TR
                                                                          INNER JOIN TASK T ON T.ID = TR.CHILD_TASK_ID
                                                                          INNER JOIN TASKS TS ON TS.CHILD_TASK_ID = TR.PARENT_TASK_ID
                                                                 WHERE TR.FOLDER_ID = $1 AND T.archived_at IS NULL AND T.deleted_at IS NULL)
                                            CYCLE CHILD_TASK_ID
                            SET IS_CYCLE USING PATH
                            SELECT *
                            FROM TASKS`,
            childTasks: UpdateTaskDateDto[] = await this.repo.query(childQuery, [folderId, taskId]);
        if (childTasks.length) {
            const repoTask = this.repo.manager.getRepository<TaskEntity>(TaskEntity);
            for (const {id, startDate, endDate, parent_task_id} of childTasks) {
                if (parent_task_id) {
                    const {startDate: parentStartDate, endDate: parentEndDate} = await repoTask.findOne({where: {id: parent_task_id}});
                    await this.updateChildTaskDate(parentStartDate, parentEndDate, startDate, endDate, id, user);
                }
            }
        }
    }

    /**
     * Update parent tasks query.
     *
     * @param {number} folderId - The ID of the folder containing the tasks.
     * @param {number} taskId - The ID of the task to update.
     * @param {JwtUserInterface | UserEntity} user - The user making the request.
     * @returns {Promise<void>} - A promise that resolves when the parent tasks have been updated.
     */
    async updateParentTasksQuery(folderId: number, taskId: number, user: JwtUserInterface | UserEntity): Promise<void> {
        const parentQuery = `WITH RECURSIVE TASKS AS (SELECT TR.PARENT_TASK_ID,
                                                                       TR.CHILD_TASK_ID,
                                                                       T.ID,
                                                                       T.start_date AS "startDate",
                                                                       T.end_date AS "endDate"
                                                                FROM TASK_RELATION TR
                                                                         INNER JOIN TASK T ON T.ID = TR.PARENT_TASK_ID
                                                                WHERE TR.FOLDER_ID = $1
                                                                 AND T.archived_at IS NULL
                                                                 AND T.deleted_at IS NULL
                                                                  AND TR.CHILD_TASK_ID = $2
                                                                UNION ALL
                                                                SELECT TR.PARENT_TASK_ID,
                                                                       TR.CHILD_TASK_ID,
                                                                       T.ID,
                                                                       T.start_date AS "startDate",
                                                                       T.end_date AS "endDate"
                                                                FROM TASK_RELATION TR
                                                                         INNER JOIN TASK T ON T.ID = TR.PARENT_TASK_ID
                                                                         INNER JOIN TASKS TS ON TS.PARENT_TASK_ID = TR.CHILD_TASK_ID
                                                                WHERE TR.FOLDER_ID = $1 AND T.archived_at IS NULL AND T.deleted_at IS NULL)
                                           CYCLE CHILD_TASK_ID
                        SET IS_CYCLE USING PATH
                        SELECT *
                        FROM TASKS`,
            parentTasks: UpdateTaskDateDto[] = await this.repo.query(parentQuery, [folderId, taskId]);
        if (parentTasks.length) {
            for (const {parent_task_id} of parentTasks) {
                await this.updateParentTaskDate(parent_task_id, user);
            }
        }
    }

    /**
     * Updates the assignees of a task.
     *
     * @param {number} taskId - The ID of the task to update.
     * @param {TaskAssigneesDto} dto - The DTO containing the updated assignees.
     * @param {string} userId - The ID of the user performing the update.
     * @returns {Promise<UpdateResult>} The result of the update operation.
     */
    async updateAssignees(taskId: number, dto: TaskAssigneesDto, userId: string): Promise<UpdateResult> {
        const manager = this.repo.manager;
        const repoTaskSubscription = manager.getRepository<TaskFollowerEntity>(TaskFollowerEntity);
        const taskDB = await this.repo.findOne({where: {id: taskId}});
        if (!taskDB) throw new NotFoundException();
        const ret = await this.repo.update(taskId, {assignees: dto.assignees, id: taskId});
        const {onlyInA: addedAssignees, onlyInB: removedAssignees} = getStringArrayDifferences(dto.assignees, taskDB.assignees);
        if (addedAssignees.length > 0 || removedAssignees.length > 0) {
            const repoTaskAction = this.repo.manager.getRepository<TaskActionEntity>(TaskActionEntity);
            await repoTaskAction.insert({
                taskId: taskId,
                Task: taskDB,
                action: TaskActionOptions.ASSIGN,
                messageId: MessageId.ASSIGN_TASK,
                parameters: {assignees: {added: addedAssignees, removed: removedAssignees}},
                task: taskDB,
                user: {id: userId},
            });

            // add all new assigned members as follower
            if (addedAssignees?.length) {
                for (const newMember of addedAssignees) {
                    if (!(await repoTaskSubscription.exists({where: {taskId, userId: newMember}}))) {
                        await repoTaskSubscription.insert({
                            Task: {id: taskId},
                            userId: newMember,
                        });
                    }
                }
            }
        }

        const importanceId = await this.getImportance(taskId);
        const folderId = await this.getFolderIdByTaskId(taskId);
        const assignees = await this.getAssignees(taskId);
        runOnTransactionCommit(async () => {
            if (userId != SERVICE_USER_ID && addedAssignees != null && addedAssignees.length > 0) {
                const notification = new AutomationNotificationDto();
                notification.eventType = AutomationsEventOptions.TASK_ASSIGNEE_ADDED;
                notification.applicationId = AutomationsApplicationIdOptions.TASK_MANAGEMENT;
                notification.fromSource = AutomationsSourceOptions.API;
                notification.fromUser = userId;
                notification.locationType = EntityTypeOptions.Folder;
                notification.locationId = folderId.toString();
                notification.entityId = taskId.toString();
                const detail = new AutomationNotificationDetailTaskEventDto();
                detail.assignees = assignees;
                detail.assigneesAdded = addedAssignees;
                detail.importanceId = importanceId;
                detail.customFields = [];
                notification.detail = detail;
                await this.automationsSendService.queueMessage(notification);
            }

            if (userId != SERVICE_USER_ID && removedAssignees != null && removedAssignees.length > 0) {
                const notification = new AutomationNotificationDto();
                notification.eventType = AutomationsEventOptions.TASK_ASSIGNEE_REMOVED;
                notification.applicationId = AutomationsApplicationIdOptions.TASK_MANAGEMENT;
                notification.fromSource = AutomationsSourceOptions.API;
                notification.fromUser = userId;
                notification.locationType = EntityTypeOptions.Folder;
                notification.locationId = folderId.toString();
                notification.entityId = taskId.toString();
                const detail = new AutomationNotificationDetailTaskEventDto();
                detail.assignees = assignees;
                detail.assigneesRemoved = removedAssignees;
                detail.importanceId = importanceId;
                detail.customFields = [];
                notification.detail = detail;
                await this.automationsSendService.queueMessage(notification);
            }
        });

        return ret;
    }

    private createSort(sort: SortDto): string {
        if (sort?.key && sort?.order) {
            return `ORDER BY "${sort.key}" ${sort.order}`;
        }
        return '';
    }

    private createPagination(pagination: PaginationDto): PaginationDto {
        if (pagination) {
            return {offset: pagination.offset * pagination.limit, limit: pagination.limit};
        }
        return {offset: 0, limit: 100};
    }
}
