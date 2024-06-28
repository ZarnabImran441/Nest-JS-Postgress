import {Inject, Injectable, Logger} from '@nestjs/common';
import {format} from 'date-fns';
import {NotificationsApiEvent, NotificationsApiService} from '@plexxis/notification-api';
import {GatewayDto, UnreadNotificationsGatewayDto} from './dto/gateway.dto';
import {contructorLogger, getInitials, getUserFullName, removeImageTag} from '@lib/base-library';
import {APPLICATION} from '../../const/env.const';
import {UserEntity} from '../../model/user.entity';
import {FolderEventNameOptions, TaskEventNameOptions} from '../../enum/notification-event.enum';
import {InjectRepository} from '@nestjs/typeorm';
import {In, Repository} from 'typeorm';
import {NotificationDto} from './dto/notification.dto';
import {AutomationsMailDto} from '@lib/automations-library';
import Bull from 'bull';

export enum FeatureTypeOptions {
    FOLDER = 'folder',
    TASK = 'task',
}

export enum NotificationTypeOptions {
    NOTIFICATION = 'notification',
    UNREAD_NOTIFICATIONS = 'unread-notifications',
    REFRESH_FOLDER = 'refresh-folder',
    REFRESH_TASK = 'refresh-task',
    TASK_STREAM_UPDATE = 'task-stream-update',
    FOLDER_STREAM_UPDATE = 'folder-stream-update',
}

@Injectable()
export class NotificationApiConnectorService {
    private logger: Logger;
    @Inject()
    private notificationsApiService: NotificationsApiService;
    constructor(@InjectRepository(UserEntity) protected usersRepository: Repository<UserEntity>) {
        this.logger = new Logger(this.constructor.name);

        contructorLogger(this);
    }
    async getUsersEmails(ids: string[]): Promise<string[]> {
        return (await this.usersRepository.find({where: {id: In(ids)}})).map((user) => user.email);
    }

    async notification(
        user: UserEntity,
        eventName: string | FolderEventNameOptions | TaskEventNameOptions,
        dto: GatewayDto
    ): Promise<void> {
        if (!dto || !dto.recipients) {
            return;
        }
        const userName = getUserFullName(user);
        const currentUser = user.pictureUrl ? {...user, url: user.pictureUrl} : {...user, initials: getInitials(user)};
        const senderName = `${userName} at ${dto.notification.title}`;

        const config = {
            websocket: {
                emitEvent: dto.emitEvent,
                to: dto.recipients.notificationCenterRecipients,
                streamUpdate: dto.streamUpdate,
            },
            email: {
                to: await this.getUsersEmails(dto.recipients.emailRecipients),
                fromName: senderName,
                subject: dto.notification.emailSubject,
            },
        };

        const dataSent = {email: this.setEmailData(dto.notification, currentUser), websocket: dto.notification};
        const job = await this.notificationsApiService.sendMessage({
            userId: user.id,
            email: user.email,
            appName: APPLICATION,
            eventName,
            data: dataSent,
            config,
        });

        if (job) {
            // Job can be null if audit is disabled
            this.logger.log(`Job id: ${job.id}`);
        }
    }
    async sendAutomationEmail(automationEmailDto: AutomationsMailDto): Promise<Bull.Job<NotificationsApiEvent>> {
        const config = {
            email: {
                to: automationEmailDto.to,
                fromName: null,
                subject: automationEmailDto.subject,
            },
        };

        const data = {message: automationEmailDto.body};
        return await this.notificationsApiService.sendMessage({
            userId: null,
            email: null,
            appName: APPLICATION,
            eventName: TaskEventNameOptions.TASK_AUTOMATION,
            data,
            config,
        });
    }
    async sendUnreadNotification(
        user: UserEntity,
        eventName: string | FolderEventNameOptions | TaskEventNameOptions,
        dto: UnreadNotificationsGatewayDto
    ): Promise<void> {
        if (!dto || !dto.recipients || !dto.recipients.length) {
            return;
        }

        const config = {
            websocket: {
                emitEvent: dto.emitEvent,
                to: dto.recipients,
                streamUpdate: dto.streamUpdate,
            },
        };

        const dataSent = {email: null, websocket: dto.notification};
        const job = await this.notificationsApiService.sendMessage({
            userId: user.id,
            email: user.email,
            appName: APPLICATION,
            eventName,
            data: dataSent,
            config,
        });

        if (job) {
            // Job can be null if audit is disabled
            this.logger.log(`Job id: ${job.id}`);
        }
    }
    setEmailData(message: NotificationDto, user: UserEntity): Record<string, unknown> {
        return {
            title: message.title,
            description: removeImageTag(message.description),
            emailSubject: message.emailSubject,
            emailTitle: message.emailTitle,
            folderUrl: message.folderUrl ?? null,
            folderId: message.folderId ?? null,
            folderName: message.folderName ?? null,
            taskId: message.taskId ?? null,
            taskUrl: message.taskUrl ?? null,
            type: message.type ?? null,
            taskLabel: message.taskLabel ?? null,
            assignees: message.assignees ?? null,
            assigneesLength: message.assigneesLength ?? null,
            comment: message.comment ?? null,
            updates: message.updates ?? null,
            attachments: message.attachments ?? null,
            date: message.date,
            action: message.action,
            state: message.state,
            userName: message.userName,
            userInitials: message.userInitials,
            userProfilePicture: message.userProfilePicture,
            user: {...user, name: getUserFullName(user), color: user.color !== '' ? user.color : '#239b8d'},
            updateDate: format(new Date(), 'MMM Do yyyy'),
            time: format(new Date(), 'MMM Do yyyy, h:mm:ss a'),
        };
    }
}
