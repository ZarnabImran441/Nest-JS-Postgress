import {Inject, Injectable, Logger} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {contructorLogger, getUserFullName, JwtUserInterface} from '@lib/base-library';
import {InsertResult, Repository, UpdateResult} from 'typeorm';
import {Transactional, runOnTransactionCommit} from 'typeorm-transactional';
import {TaskActionEntity} from '../../../model/task-action.entity';
import {CreateTaskActionDto} from '../../../dto/task/task-action/create-task-action.dto';
import {TaskActionOptions} from '../../../enum/task-action.enum';
import {MessageId} from '../../../enum/message-id.enum';
import {UpdateTaskActionDto} from '../../../dto/task/task-action/update-task-action.dto';
import {TaskActionParameterInterface} from '../../../interface/task-action-parameter.interface';
import {EventEmitter2} from '@nestjs/event-emitter';
import {EntityNotificationDto} from '../../../dto/events/entity-notification.dto';
import {TaskEventNameOptions} from '../../../enum/notification-event.enum';
import {NotificationService} from '../../notification/notification.service';
import {TaskEntity} from '../../../model/task.entity';
import {TaskRelationEntity} from '../../../model/task-relation.entity';
import {TaskAttachmentService} from '../task-attachment/task-attachment.service';
import {UserEntity} from '../../../model/user.entity';
import {TaskFollowerEntity} from '../../../../src/model/task-follower.entity';
import {queries} from '../../../../src/recursive-queries';
import {SpaceService} from '../../space/space.service';

@Injectable()
export class TaskActionBaseService {
    protected logger: Logger;

    constructor(
        @InjectRepository(TaskActionEntity) protected readonly repo: Repository<TaskActionEntity>,
        protected readonly taskAttachmentService: TaskAttachmentService,
        @Inject(EventEmitter2) protected eventEmitter: EventEmitter2,
        protected notificationService: NotificationService,
        protected spaceService: SpaceService
    ) {
        this.logger = new Logger(this.constructor.name);
        contructorLogger(this);
    }

    @Transactional()
    async comment(dto: CreateTaskActionDto, taskId: number, user: JwtUserInterface): Promise<InsertResult> {
        const repoTaskFollower = this.repo.manager.getRepository<TaskFollowerEntity>(TaskFollowerEntity);
        const insertResult = await this.repo.insert({
            Task: {id: taskId},
            action: TaskActionOptions.COMMENT,
            messageId: MessageId.COMMENT_TASK,
            mentionMembers: dto.mentionMembers ?? [],
            attachmentsIds: dto.attachmentsIds ?? [],
            parameters: {comment: dto.comment},
            user,
            task: {id: taskId},
        });
        const task = await this.repo.manager.getRepository(TaskEntity).findOne({where: {id: taskId}});
        const taskRelation = await this.repo.manager.getRepository(TaskRelationEntity).findOne({where: {ChildTask: {id: taskId}}});
        let recipients = await this.notificationService.getTaskNotificationRecipients(taskId);
        const mentionedMembers = dto.mentionMembers ?? [];
        recipients = recipients.filter((member) => !mentionedMembers.includes(member));
        const mentionedMemberEmailDto = await this.notificationService.setTaskEmailDto(taskId, user, [], TaskActionOptions.COMMENT, {
            content: dto.comment,
            mentioned: true,
        });
        const emailDto = await this.notificationService.setTaskEmailDto(taskId, user, [], TaskActionOptions.COMMENT, {
            content: dto.comment,
            mentioned: false,
        });

        // add commenter to task follower if it hasn't been done
        if (!(await repoTaskFollower.exists({where: {taskId, userId: user.id}}))) {
            await repoTaskFollower.insert({
                Task: {id: taskId},
                userId: user.id,
            });
        }

        // and mentionedMembers who is also a member to the space to follower if it hasn't been done
        let spaceId = null;
        if (mentionedMembers?.length) {
            spaceId = await this.spaceService.getSpaceFromFolderId(taskRelation.folderId);
            const sql = queries.folder.concat(
                ` WHERE (F.ID = $2) AND ($3 = ANY (F.SHOW_ON)) AND (F.deleted_at IS NULL) AND F.folder_type = 'space'`
            );
            const [space] = await this.repo.query(sql, [user.id, spaceId, 'task-management']);
            const allMemberIds = [];
            if (space?.members?.length) {
                for (const member of space.members) {
                    allMemberIds.push(member.userId);
                }
            }
            if (space?.teams?.length) {
                for (const team of space.teams) {
                    if (team?.members?.legnth) {
                        for (const member of team.members) {
                            allMemberIds.push(member.id);
                        }
                    }
                }
            }

            mentionedMembers.map(async (member) => {
                // skip if the membmer is not a space member
                if (allMemberIds.includes(member)) {
                    if (!(await repoTaskFollower.exists({where: {taskId, userId: member}}))) {
                        await repoTaskFollower.insert({
                            Task: {id: taskId},
                            userId: member,
                        });
                    }
                }
            });
        }

        runOnTransactionCommit(() => {
            if (mentionedMembers.length > 0) {
                this.eventEmitter.emit(TaskEventNameOptions.TASK_COMMENT, {
                    recipients: mentionedMembers,
                    userId: user.id,

                    data: {
                        ...mentionedMemberEmailDto,
                        userId: user.id,
                        taskId,
                        message: this.notificationService.setNotificationMessage({
                            entity: 'task',
                            entityTitle: task.title,
                            actions: {
                                mention: {
                                    comment: dto.comment,
                                },
                            },
                            ...mentionedMemberEmailDto,
                            sender: getUserFullName(user),
                        }),
                        event: TaskEventNameOptions.TASK_COMMENT,
                        folderId: taskRelation.folderId,
                        spaceId,
                    },
                } as EntityNotificationDto);
            }
            this.eventEmitter.emit(TaskEventNameOptions.TASK_COMMENT, {
                recipients,
                userId: user.id,
                data: {
                    ...emailDto,
                    taskId,
                    userId: user.id,
                    message: this.notificationService.setNotificationMessage({
                        entity: 'task',
                        entityTitle: task.title,
                        actions: {
                            comment: dto.comment,
                        },
                        sender: getUserFullName(user),
                    }),
                    event: TaskEventNameOptions.TASK_COMMENT,
                    folderId: taskRelation.folderId,
                    spaceId,
                },
            } as EntityNotificationDto);
        });
        return insertResult;
    }

    @Transactional()
    async updateOneComment(commentId: number, dto: UpdateTaskActionDto): Promise<UpdateResult> {
        return await this.repo.update(
            {id: commentId},
            {
                parameters: {comment: dto.comment},
                ...(dto.attachmentsIds && {attachmentsIds: dto.attachmentsIds}),
                id: commentId,
            }
        );
    }

    async getActionsByTaskId(taskId: number): Promise<TaskActionEntity[]> {
        //TODO: Added default values when properties are null so UI doesn't explode. This is for data migrated from insight2
        let result = await this.repo.find({where: {Task: {id: taskId}}, order: {date: 'ASC'}});
        const users = await this.repo.manager
            .getRepository(UserEntity)
            .find({select: {firstName: true, lastName: true, id: true, pictureUrl: true, color: true}});
        result = result.map((item) => ({
            ...item,
            attachmentsIds: item.attachmentsIds || [],
            parameters:
                item.parameters ||
                ({
                    updates: [],
                    members: {},
                    comment: '',
                    updatePosition: {},
                    create: {},
                    attachment: '',
                } as TaskActionParameterInterface),
            mentionMembers: item.mentionMembers || [],
            user: users.find((u) => u.id === item.user['id']),
        }));
        return result;
    }

    //todo : add return types
    @Transactional()
    async deleteOneComment(comment: TaskActionEntity): Promise<unknown> {
        return await this.repo.remove(comment);
    }
}
