import {AutomationsMailDto} from '@lib/automations-library';
import {
    AppTypeOptions,
    ChannelTypeOptions,
    contructorLogger,
    getInitials,
    getUserFullName,
    InputSelectionOptions,
    JwtUserInterface,
    NotificationsSubscriptionService,
    SchemaPreferencesDto,
    SectionTypeOptions,
    UserNotificationChannelOptions,
} from '@lib/base-library';
import {Inject, Injectable, Logger, NotFoundException} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {NotificationsApiEvent} from '@plexxis/notification-api';
import Bull from 'bull';
import {format} from 'date-fns';
import {In, Repository, SelectQueryBuilder, UpdateResult} from 'typeorm';
import {runOnTransactionCommit, Transactional} from 'typeorm-transactional';
import {EntityNotificationDto, NotificationMessageDto} from '../../dto/events/entity-notification.dto';
import {FolderActionOptions} from '../../enum/folder-action.enum';
import {FolderTypeOptions} from '../../enum/folder.enum';
import {FolderEventNameOptions, TaskEventNameOptions, UserEventNameOptions} from '../../enum/notification-event.enum';
import {TaskActionOptions} from '../../enum/task-action.enum';
import {EventChannel, FolderNotificationsSettingsEntity} from '../../model/folder-notifications-settings.entity';
import {FolderRelationEntity} from '../../model/folder-relation.entity';
import {FolderEntity} from '../../model/folder.entity';
import {NotificationEntity} from '../../model/notification.entity';
import {TagTaskFolderEntity} from '../../model/tag-task-folder.entity';
import {TaskRelationEntity} from '../../model/task-relation.entity';
import {TaskEntity} from '../../model/task.entity';
import {UserEntity} from '../../model/user.entity';
import {NotificationDto} from '../notifications-api-connector/dto/notification.dto';
import {NotificationApiConnectorService, NotificationTypeOptions} from '../notifications-api-connector/notification-api-connector.service';
import {TaskAttachmentBaseService} from '../task/task-attachment/task-attachment-base.service';
import {NotificationFiltersAndPaginationDto} from './dto/filters.dto';
import {NotificationResponseDto} from './dto/notificationResponseDto';

@Injectable()
export class NotificationService {
    private logger: Logger;

    @Inject()
    private readonly notificationsApiConnectorService: NotificationApiConnectorService;

    protected taskAttachment: TaskAttachmentBaseService;
    constructor(
        @InjectRepository(NotificationEntity) private readonly repo: Repository<NotificationEntity>,
        @InjectRepository(UserEntity) private readonly userRepo: Repository<UserEntity>,
        @InjectRepository(FolderEntity) private readonly folderRepo: Repository<FolderEntity>,
        @InjectRepository(FolderRelationEntity) private readonly folderRelationRepo: Repository<FolderRelationEntity>,
        @InjectRepository(TaskEntity) private readonly taskRepo: Repository<TaskEntity>,
        @InjectRepository(FolderNotificationsSettingsEntity)
        private readonly folderNotificationsSettingsRepo: Repository<FolderNotificationsSettingsEntity>,
        @Inject('NOTIFICATION_SUBSCRIPTION_SERVICE') protected notificationsSubscriptionService: NotificationsSubscriptionService
    ) {
        this.logger = new Logger(this.constructor.name);
        contructorLogger(this);
    }
    @Transactional()
    async create(
        notificationMessage: EntityNotificationDto,
        user: UserEntity,
        eventName: TaskEventNameOptions | FolderEventNameOptions | UserEventNameOptions
    ): Promise<NotificationEntity[]> {
        const result: NotificationEntity[] = [];
        try {
            this.logger.log(
                `=======> Sending a notification with eventName ${eventName} and user ${user.email} and event ${notificationMessage.data.event}`
            );
            const {folderId, spaceId, taskId, message} = notificationMessage.data;
            let folder: FolderEntity = null;
            let space: FolderEntity = null;
            let task: TaskEntity = null;

            if (folderId) folder = await this.folderRepo.findOne({where: {id: folderId}});
            if (spaceId) space = await this.folderRepo.findOneBy({id: spaceId, folderType: FolderTypeOptions.SPACE});
            if (taskId) task = await this.taskRepo.findOne({where: {id: taskId}});

            const folderHasSettings = await this.folderNotificationsSettingsRepo.find({
                where: {folder: {id: folderId, userId: In(notificationMessage.recipients)}},
            });
            let emailRecipients = notificationMessage.recipients;
            let notificationCenterRecipients = notificationMessage.recipients;
            if (folderHasSettings?.length > 0) {
                for (const setting of folderHasSettings) {
                    for (const eventChannel of setting.eventChannels) {
                        if (eventChannel.event === eventName) {
                            for (const channel of eventChannel.channels) {
                                if (!channel.checked) {
                                    if (channel.channel === ChannelTypeOptions.EMAIL) {
                                        emailRecipients = emailRecipients.filter((recipient) => recipient !== setting.user.id);
                                    }
                                    if (channel.channel === ChannelTypeOptions.WEB_SOCKET) {
                                        notificationCenterRecipients = notificationCenterRecipients.filter(
                                            (recipient) => recipient !== setting.user.id
                                        );
                                    }
                                }
                            }
                        }
                    }
                }
            }
            for (const recipient of notificationCenterRecipients) {
                const notificationUser = await this.userRepo.findOneOrFail({where: {id: recipient}});
                const saved = await this.repo.save({
                    message,
                    user: notificationUser,
                    date: new Date(),
                    read: false,
                    content: notificationMessage.data ?? null,
                    space,
                    folder,
                    task,
                    event: notificationMessage.data.event,
                });
                result.push(saved);
                await this.sendUnReadNotificationCount(notificationUser.id);
            }
            const notificationBody = {
                emitEvent: NotificationTypeOptions.NOTIFICATION,
                notification: notificationMessage.data as NotificationDto,
                streamUpdate: notificationMessage.streamUpdate ?? false,
                recipients: {
                    emailRecipients,
                    notificationCenterRecipients,
                },
            };
            runOnTransactionCommit(async () => {
                await this.notificationsApiConnectorService.notification(user, eventName, notificationBody);
            });
            return result;
        } catch (e) {
            this.logger.error(
                `There was an error while creating/sending a notification ${JSON.stringify(notificationMessage.data.message)}`,
                e
            );
            throw e;
        }
    }

    @Transactional()
    async read(id: number, userId: string): Promise<NotificationEntity> {
        try {
            const foundNotification = await this.repo.findOne({where: {id}});
            if (foundNotification) {
                foundNotification.read = true;
                const notificationUpdated = await this.repo.save(foundNotification);
                if (notificationUpdated) {
                    await this.sendUnReadNotificationCount(userId);
                }
                return notificationUpdated;
            }
            throw new NotFoundException();
        } catch (e) {
            this.logger.error(`There was an error while reading a notification ${JSON.stringify(id)}`, e);
            throw e;
        }
    }

    @Transactional()
    async readAll(userId: string): Promise<UpdateResult> {
        try {
            return await this.repo.update({read: false, user: {id: userId}}, {read: true});
        } catch (e) {
            this.logger.error(`There was an error while reading a notification for user ${JSON.stringify(userId)}`, e);
            throw e;
        }
    }

    @Transactional()
    async unread(id: number, userId: string): Promise<NotificationEntity> {
        try {
            const foundNotification = await this.repo.findOne({where: {id}});
            if (foundNotification) {
                foundNotification.read = false;
                const notificationUpdated = await this.repo.save(foundNotification);

                if (notificationUpdated) {
                    await this.sendUnReadNotificationCount(userId);
                }
                return notificationUpdated;
            }
            throw new NotFoundException();
        } catch (e) {
            this.logger.error(`There was an error while marking a notification unread ${JSON.stringify(id)}`, e);
            throw e;
        }
    }

    // overide and send the user message that the message is deleted.
    @Transactional()
    async delete(id: number, userId: string): Promise<NotificationEntity[]> {
        try {
            const foundNotification = await this.repo.findOne({where: {id}});
            if (foundNotification) {
                foundNotification.read = false;
                const notificationDeleted = await this.repo.find({where: {id}});

                if (notificationDeleted) {
                    await this.sendUnReadNotificationCount(userId);
                }
                return notificationDeleted;
            }
            throw new NotFoundException();
        } catch (e) {
            this.logger.error(`There was an error while deleting a notification unread ${JSON.stringify(id)}`, e);
            throw e;
        }
    }
    @Transactional()
    async sendUnReadNotificationCount(userId: string): Promise<void> {
        try {
            const user = await this.userRepo.findOne({where: {id: userId}});
            const unReadNotificationCount = await this.repo.count({where: {read: false, user: {id: userId}}});
            runOnTransactionCommit(async () => {
                await this.notificationsApiConnectorService.sendUnreadNotification(user, NotificationTypeOptions.UNREAD_NOTIFICATIONS, {
                    emitEvent: NotificationTypeOptions.UNREAD_NOTIFICATIONS,
                    notification: unReadNotificationCount,
                    recipients: [userId],
                    streamUpdate: false,
                });
            });
        } catch (error) {
            this.logger.log({level: 'error', message: 'Error while sending a notification:' + error, error});
            throw error;
        }
    }

    async getManyNotification(
        currentUserId: string,
        filtersAndPagination: NotificationFiltersAndPaginationDto
    ): Promise<NotificationResponseDto> {
        try {
            const {limit, offset, spaceId, folderId, dateFrom, dateTo, event, userId, orderBy} = filtersAndPagination;
            const skip = limit * offset;
            const queryBuilder = this.repo
                .createQueryBuilder('notification')
                .leftJoinAndSelect('notification.folder', 'folder')
                .leftJoinAndSelect('folder_relation', 'folder_relation', 'folder_relation.child_folder_id = folder.id')
                .leftJoinAndSelect('notification.space', 'space')
                .leftJoinAndSelect('notification.task', 'task')
                .leftJoinAndSelect('notification.user', 'user')
                .where('user.id = :currentUserId', {currentUserId});
            if (spaceId) queryBuilder.andWhere('notification.space_id = :spaceId', {spaceId});
            if (folderId) queryBuilder.andWhere('folder.id = :folderId', {folderId});
            if (dateFrom) queryBuilder.andWhere('notification.date > :dateFrom', {dateFrom});
            if (dateTo) queryBuilder.andWhere('notification.date < :dateTo', {dateTo});
            if (event) queryBuilder.andWhere('notification.event = :event', {event});
            if (userId) {
                queryBuilder.andWhere('folder.user_id = :userId', {userId});
                queryBuilder.orWhere('task.user_id = :userId', {userId});
            }
            this.insertOrderBy(queryBuilder, orderBy, 'date', 'notification');
            const [notifications, count] = await queryBuilder.take(limit).skip(skip).getManyAndCount();
            return {
                data: notifications,
                total: count,
                page: offset,
                pageCount: limit,
            };
        } catch (error) {
            this.logger.error('There was an error while fetching all notifications of the current user', error);
            throw error;
        }
    }

    async getOneNotification(id: number, userId: string): Promise<NotificationEntity> {
        try {
            const foundNotification = await this.repo.findOne({where: {id, user: {id: userId}}});
            if (!foundNotification) {
                throw new NotFoundException();
            }
            return foundNotification;
        } catch (error) {
            this.logger.log({level: 'error', message: 'Error while fetching a notifications of the current user:' + error, error});
            throw error;
        }
    }

    setNotificationMessage(notificationDto: NotificationMessageDto): string {
        for (const action in notificationDto.actions) {
            if (notificationDto.actions[action]) {
                const message: (dto: NotificationMessageDto) => string = NotificationMessageDto.actionMessageMappers[action];
                return message(notificationDto);
            }
        }
    }
    async getTaskNotificationRecipients(task_id: number): Promise<string[]> {
        const taskDB = await this.repo.manager.getRepository(TaskEntity).findOne({
            select: {id: true, assignees: true, Followers: true},
            where: {id: task_id},
            relations: {Followers: true},
        });
        const ret = [];
        if (taskDB.assignees) {
            for (const assignee of taskDB.assignees) {
                ret.push(assignee);
            }
        }
        if (taskDB.Followers) {
            for (const follower of taskDB.Followers) {
                ret.push(follower.userId);
            }
        }

        return [...new Set(ret)];
    }

    async setTaskEmailDto(
        taskId: number,
        // Coud be used in future
        user: JwtUserInterface,
        updates: {property: string; oldValue?: string; newValue?: string; message?: string}[],
        // Coud be used in future
        action: TaskActionOptions,
        comment?: {content: string; mentioned: boolean}
    ): Promise<Partial<NotificationDto>> {
        const taskEntity = this.repo.manager.getRepository<TaskEntity>(TaskEntity);
        const userEntity = this.userRepo.manager.getRepository<UserEntity>(UserEntity);
        const tagRelationEntity = this.userRepo.manager.getRepository<TagTaskFolderEntity>(TagTaskFolderEntity);

        this.logger.log('Getting task to prepare email dto. Task id:' + taskId);
        const taskDB = await taskEntity.findOneOrFail({
            where: {id: taskId},
            relations: {Followers: true, ChildrenTasks: {WorkFlowState: true}},
        });

        let taskAssigneesDB = [];
        if (taskDB.assignees) {
            taskAssigneesDB = await userEntity.find({where: {id: In(taskDB.assignees)}});
        }

        const tagsDB = await tagRelationEntity.findOne({
            where: {taskId},
            relations: {Tag: true},
        });

        const relation = await this.repo.manager.getRepository<TaskRelationEntity>(TaskRelationEntity).findOne({
            where: {ChildTask: {id: taskId}},
            relations: {Folder: {FolderTasks: {WorkFlowState: true}}},
        });
        const folder = relation.Folder;

        const date = new Date();
        const formattedDate = format(date, 'EEE, dd MMM p');

        const dto: Partial<NotificationDto> = {
            taskId: taskDB.id,
            title: taskDB.title,
            assignees: taskAssigneesDB?.slice(0, 2).map((el) => {
                return {
                    name: getUserFullName(el),
                    initials: getInitials(el),
                    color: el.color !== '' ? el.color : ['#6166e5', '#00b245', '#00b245'][Math.floor(Math.random() * 3)],
                };
            }),
            assigneesLength: taskAssigneesDB.length > 2 ? taskAssigneesDB.length - 2 : 0,
            taskUrl: `www.plexxisjs-deployment4.task-api.plexxislabs.com/#/tasks/folders/${folder.id}/board?taskId=${taskDB.id}&taskFolderId=${folder.id}`,
            description: taskDB.description,
            comment: comment ?? undefined,
            date: formattedDate,
            folderName: folder.title,
            taskLabel: tagsDB?.Tag?.title,
            updates,
            emailSubject: `[Plexxis] / Project - ${folder.title}`,
            action: TaskActionOptions.UPDATE,
            emailTitle: `[Plexxis] / Project - ${folder.title}`,
            type: 'task',
        };

        return dto;
    }
    async sendAutomationEmail(automationsMailDto: AutomationsMailDto): Promise<Bull.Job<NotificationsApiEvent>> {
        const users = automationsMailDto.to
            .toString()
            .split(',')
            .map((email) => email.trim());
        if (users.length > 0) automationsMailDto.to = users;
        // Replace user ids with email
        for (let i = 0; i < automationsMailDto.to.length; i++) {
            try {
                const userId = automationsMailDto.to[i];
                const user = await this.userRepo.findOne({where: {id: userId}});
                automationsMailDto.to[i] = user.email;
            } catch (err) {
                this.logger.error(
                    `NoticicationService::sendAutomationEmail: There was a problem obtaining user data. Recepient position ${i}, uid: ${automationsMailDto.to[i]}`
                );
            }
        }
        // Remove recipients that are not email addresses
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        automationsMailDto.to = automationsMailDto.to.filter((email) => emailPattern.test(email));
        // Send the Email
        return await this.notificationsApiConnectorService.sendAutomationEmail(automationsMailDto);
    }
    async setFolderEmailDto(
        folderId: number,
        user: JwtUserInterface | UserEntity,
        action: FolderActionOptions,
        updates: {property: string; oldValue: string; newValue: string}[],
        members?: {added?: string[]; removed?: string[]}
    ): Promise<Partial<NotificationDto>> {
        const folder = await this.repo.manager.getRepository(FolderEntity).findOne({
            where: {id: folderId},
            relations: {Followers: true, ChildrenFolders: {ChildFolder: true}, WorkFlow: {WorkFlowStates: true}},
        });

        const state = folder.folderType === FolderTypeOptions.SPACE ? '' : folder.WorkFlow?.title;

        const dto: Partial<NotificationDto> = {
            userName: getUserFullName(user),
            userProfilePicture: user.pictureUrl,
            userInitials: getInitials(user),
            date: format(new Date(), 'yyyy-MM-dd'),
            description: folder.description,
            title: folder.title,
            state,
            members,
            updates,
            emailSubject: `Folder ${folder.title} has been updated`,
            action,
            folderUrl: `plexxis-js://www.plexxisjs-deployment4.task-api.plexxislabs.com/#/tasks/folders/${folderId}/board`,
            emailTitle: `Folder Update`,
        };
        return dto;
    }

    async getFolderNotificationRecipients(folder_id: number): Promise<string[]> {
        const folderDB = await this.repo.manager.getRepository(FolderEntity).findOne({
            where: {id: folder_id},
            relations: {Members: true, Followers: true},
        });
        const ret = folderDB.userId ? [folderDB.userId] : [];

        if (folderDB.Followers) {
            for (const follower of folderDB.Followers) {
                ret.push(follower.userId);
            }
        }
        return [...new Set(ret)];
    }
    async setFolderNotificationsPreferences(
        folderId: number,
        schema: SchemaPreferencesDto[],
        user: JwtUserInterface
    ): Promise<SchemaPreferencesDto[]> {
        const preferencesExist = await this.folderNotificationsSettingsRepo.findOne({where: {folder: {id: folderId}, user: {id: user.id}}});
        const folder = await this.folderRepo.findOneOrFail({where: {id: folderId}});
        const eventChannels: EventChannel[] = [];

        for (const preference of schema) {
            const children = preference.children;
            for (const child of children) {
                const event = child.eventName as TaskEventNameOptions | FolderEventNameOptions;
                const channels = child.options.map((option) => {
                    if (option.label == UserNotificationChannelOptions.NOTIFICATIONS_CENTER) {
                        return {channel: ChannelTypeOptions.WEB_SOCKET, checked: option.checked};
                    } else {
                        return {channel: ChannelTypeOptions.EMAIL, checked: option.checked};
                    }
                });
                eventChannels.push({event, channels});
            }
        }
        if (preferencesExist) {
            preferencesExist.eventChannels = eventChannels;
            await this.folderNotificationsSettingsRepo.save(preferencesExist);
        } else {
            await this.folderNotificationsSettingsRepo.save({user, folder, eventChannels});
        }

        return schema;
    }
    async getFolderNotificationPreferences(folderId: number, user: JwtUserInterface): Promise<SchemaPreferencesDto[]> {
        const preferencesExist = await this.folderNotificationsSettingsRepo.findOne({where: {folder: {id: folderId}, user: {id: user.id}}});
        const folder = await this.folderRepo.findOneOrFail({where: {id: folderId}});
        if (!preferencesExist) {
            return await this.notificationsSubscriptionService.getUserSubscriptionsSchema(user.id);
        }
        return this.buildSchema(folder, preferencesExist.eventChannels);
    }
    buildSchema(folder: FolderEntity, eventChannels: EventChannel[]): SchemaPreferencesDto[] {
        const schemaArray = [];

        const appType = AppTypeOptions.TASK_MANAGEMENT;
        schemaArray.push({
            id: 'header',
            appType: this.parseAppTypeFormat(appType),
            sectionType: SectionTypeOptions.SECTION,
            availableChannels: [UserNotificationChannelOptions.EMAIL, UserNotificationChannelOptions.NOTIFICATIONS_CENTER],
            title: folder.title,
            description: `${folder.title} notification preferences settings`,
            children: this.setSchemaChildren(eventChannels),
        });

        return schemaArray;
    }
    setSchemaChildren(eventChannels: EventChannel[]): SchemaPreferencesDto[] {
        const appEventNames = eventChannels.map((event) => event.event);

        const childrenArray = [];
        for (const eventName of appEventNames) {
            const eventChannel = eventChannels.find((event) => event.event === eventName);
            if (eventName.includes('stream-update')) continue;

            const checkedEmail = eventChannel.channels.find((channel) => channel.channel === ChannelTypeOptions.EMAIL).checked;
            const checkedPlatform = eventChannel.channels.find((channel) => channel.channel === ChannelTypeOptions.WEB_SOCKET).checked;
            childrenArray.push({
                id: eventName,
                eventName: eventName,
                sectionType: 'notification',
                title: this.parseEventNameFormat(eventName),
                description: `${this.parseEventNameFormat(eventName)} preferences settings`,
                inputType: InputSelectionOptions.CHECKBOX,
                options: [
                    {checked: checkedEmail, label: UserNotificationChannelOptions.EMAIL},
                    {checked: checkedPlatform, label: UserNotificationChannelOptions.NOTIFICATIONS_CENTER},
                ],
            });
        }
        return childrenArray;
    }
    parseAppTypeFormat(s: string): string {
        return s
            .split('_')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }
    parseEventNameFormat(s: string): string {
        const words = s.split('-');
        if (words[0].toLowerCase() === 'notification') {
            words.shift();
        }
        return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
    }

    insertOrderBy<T>(
        queryBuilder: SelectQueryBuilder<T>,
        orderBy?: {
            [Key in keyof Omit<T, 'id'>]?: 'ASC' | 'DESC';
        },
        defaultOrderBy?: keyof Omit<T, 'id'>,
        nameOfEntity?: string
    ): SelectQueryBuilder<T> {
        if (!orderBy) {
            if (defaultOrderBy) {
                const keyStr = nameOfEntity ? `${nameOfEntity}.${String(defaultOrderBy)}` : `${String(defaultOrderBy)}`;
                return queryBuilder.orderBy(keyStr, 'DESC');
            }
        } else {
            Object.entries(orderBy).forEach(([key, direction], index) => {
                let keyStr;
                if (key.includes('.')) {
                    keyStr = `${String(key)}`;
                } else {
                    keyStr = nameOfEntity ? `${nameOfEntity}.${String(key)}` : `${String(key)}`;
                }
                if (index === 0) {
                    queryBuilder.orderBy(keyStr, direction as 'ASC' | 'DESC');
                } else {
                    queryBuilder.addOrderBy(keyStr, direction as 'ASC' | 'DESC');
                }
            });
        }

        return queryBuilder;
    }
}
