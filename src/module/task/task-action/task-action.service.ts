import {ForbiddenException, Inject, Injectable, NotFoundException} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {AutomationsApplicationIdOptions, contructorLogger, JwtUserInterface} from '@lib/base-library';
import {InsertResult, Repository, UpdateResult} from 'typeorm';
import {runOnTransactionCommit, Transactional} from 'typeorm-transactional';
import * as moment from 'moment';
import {TaskActionBaseService} from './task-action-base.service';
import {TaskActionEntity} from '../../../model/task-action.entity';
import {CreateTaskActionDto} from '../../../dto/task/task-action/create-task-action.dto';
import {TaskEntity} from '../../../model/task.entity';
import {UpdateTaskActionDto} from '../../../dto/task/task-action/update-task-action.dto';
import {TaskActionOptions} from '../../../enum/task-action.enum';
import {TaskAttachmentService} from '../task-attachment/task-attachment.service';
import {EventEmitter2} from '@nestjs/event-emitter';
import {NotificationService} from '../../notification/notification.service';
import {TaskAttachmentEntity} from '../../../model/task-attachment.entity';
import {SERVICE_USER_ID} from '../../../const/env.const';
import {
    AutomationNotificationDetailTaskEventDto,
    AutomationNotificationDto,
    AutomationsEventOptions,
    AutomationsRedisSendService,
    AutomationsSourceOptions,
} from '@lib/automations-library';
import {EntityTypeOptions} from '../../authorization-impl/authorization.enum';
import {TaskRelationEntity} from '../../../model/task-relation.entity';
import {SpaceService} from '../../space/space.service';

@Injectable()
export class TaskActionService extends TaskActionBaseService {
    constructor(
        @InjectRepository(TaskActionEntity) protected readonly repo: Repository<TaskActionEntity>,
        protected readonly taskAttachmentService: TaskAttachmentService,
        @Inject(EventEmitter2) protected readonly eventEmitter: EventEmitter2,
        protected notificationService: NotificationService,
        protected automationsSendService: AutomationsRedisSendService,
        protected spaceService: SpaceService
    ) {
        super(repo, taskAttachmentService, eventEmitter, notificationService, spaceService);
        contructorLogger(this);
    }

    @Transactional()
    async addComment(dto: CreateTaskActionDto, taskId: number, user: JwtUserInterface): Promise<InsertResult> {
        try {
            const repoTask = this.repo.manager.getRepository<TaskEntity>(TaskEntity);
            const taskDB = await repoTask.findOne({where: {id: taskId}});
            if (!taskDB) {
                throw new NotFoundException(`Task ${taskId} not found`);
            }
            const result = await super.comment(dto, taskId, user);

            const folderId = await this.getFolderIdByTaskId(taskId);
            runOnTransactionCommit(async () => {
                // Prevent infinite loop in automations by checking this is not the service user
                if (user.id != SERVICE_USER_ID) {
                    const notification = new AutomationNotificationDto();
                    notification.eventType = AutomationsEventOptions.TASK_COMMENT_ADDED;
                    notification.applicationId = AutomationsApplicationIdOptions.TASK_MANAGEMENT;
                    notification.fromSource = AutomationsSourceOptions.API;
                    notification.fromUser = user.id;
                    notification.locationType = EntityTypeOptions.Folder;
                    notification.locationId = folderId.toString();
                    notification.entityId = taskId.toString();
                    const detail = new AutomationNotificationDetailTaskEventDto();
                    detail.commentText = dto.comment;
                    detail.commentMentionMembers = dto.mentionMembers;
                    notification.detail = detail;
                    await this.automationsSendService.queueMessage(notification);
                }
            });

            return result;
        } catch (err) {
            this.logger.error(`There was an error with a new comment [${JSON.stringify(dto)}]`, JSON.stringify(err));
            throw err;
        }
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

    @Transactional()
    async updateComment(commentId: number, dto: UpdateTaskActionDto, userId: string): Promise<UpdateResult> {
        try {
            /// Todo : Only owner of the comment user can edit the comment
            const repoTaskAction = this.repo.manager.getRepository<TaskActionEntity>(TaskActionEntity),
                taskActionDB = await repoTaskAction.findOne({
                    where: {id: commentId, action: TaskActionOptions.COMMENT},
                });
            if (!taskActionDB) {
                throw new NotFoundException();
            }
            const commentTime = moment(taskActionDB.date);
            const currentTime = moment();
            const difference = commentTime.diff(currentTime, 'hours');
            if (difference <= 24 && userId) {
                // Remove attachments that are removed from the comments
                if (dto.attachmentsIds) {
                    const removedAttachments = taskActionDB.attachmentsIds.filter((at) => !dto.attachmentsIds.includes(at));
                    if (removedAttachments.length) {
                        for (const id of removedAttachments) {
                            await this.taskAttachmentService.deleteTaskAttachment(id, userId);
                        }
                    }
                }
                return await super.updateOneComment(commentId, dto);
            }
            throw new ForbiddenException();
        } catch (err) {
            this.logger.error(`There was an error with Updating comment [${JSON.stringify(dto)}]`, JSON.stringify(err));
            throw err;
        }
    }

    async getActionsByTaskId(taskId: number): Promise<TaskActionEntity[]> {
        try {
            const repoTask = this.repo.manager.getRepository<TaskEntity>(TaskEntity),
                taskDB = await repoTask.findOne({where: {id: taskId}});

            if (!taskDB) {
                throw new NotFoundException(`Task ${taskId} not found`);
            }

            return await super.getActionsByTaskId(taskId);
        } catch (err) {
            this.logger.error(`There was an error getting task actions of a task ${taskId}`, JSON.stringify(err));
            throw err;
        }
    }

    @Transactional()
    async deleteComment(commentId: number, taskId: number, user: JwtUserInterface): Promise<unknown> {
        try {
            //Todo : We need to level 2 per if a comment belong to the user the user can only delete it
            const repoTaskAction = this.repo.manager.getRepository<TaskActionEntity>(TaskActionEntity),
                repoTaskAttachement = this.repo.manager.getRepository<TaskAttachmentEntity>(TaskAttachmentEntity),
                taskActionDB = await repoTaskAction.findOne({
                    where: {id: commentId, action: TaskActionOptions.COMMENT, Task: {id: taskId}},
                });

            if (!taskActionDB) {
                throw new NotFoundException();
            }

            //Delete attachments

            const ret = await super.deleteOneComment(taskActionDB);
            if (taskActionDB.attachmentsIds) {
                for (const id of taskActionDB.attachmentsIds) {
                    const attachmentExist = await repoTaskAttachement.findOne({where: {id}});
                    if (attachmentExist) {
                        await this.taskAttachmentService.deleteTaskAttachment(id, user.id);
                    }
                }
            }
            return ret;
        } catch (err) {
            this.logger.error(`There was an error while deleting the comment ${commentId}`, JSON.stringify(err));
            throw err;
        }
    }
}
