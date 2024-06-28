import {OnEvent} from '@nestjs/event-emitter';
import {contructorLogger} from '@lib/base-library';
import {UserEntity} from '../../model/user.entity';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {EntityNotificationDto} from '../../dto/events/entity-notification.dto';
import {Logger} from '@nestjs/common';
import {FolderEventNameOptions, TaskEventNameOptions, UserEventNameOptions} from '../../enum/notification-event.enum';
import {NotificationService} from '../notification/notification.service';
import {AutomationNotificationDto, AutomationsEventOptions, AutomationsRedisSendService} from '@lib/automations-library';
import {DashboardService} from '../dashboard/dashboard.service';

/**
 * Class representing the EventsHandlerService.
 * @class
 */
export class EventsHandlerService {
    /**
     * Logger class for logging events and messages.
     *
     * @class
     */
    logger: Logger = new Logger('EventsHandler');

    /**
     * Constructs a new instance of the constructor.
     *
     * @param {Repository<UserEntity>} userRepository - The user repository to inject.
     * @param {NotificationService} notificationService - The notification service.
     * @param {AutomationsRedisSendService} automationsRedisSendService - The automation Redis send service.
     * @param {DashboardService} dashboardService - The dashboard service.
     */
    constructor(
        @InjectRepository(UserEntity) private userRepository: Repository<UserEntity>,
        private readonly notificationService: NotificationService,
        private readonly automationsRedisSendService: AutomationsRedisSendService,
        private readonly dashboardService: DashboardService
    ) {
        contructorLogger(this);
    }

    /**
     * Handles the event when a task approval is created and sends a notification to the user.
     *
     * @param {EntityNotificationDto} taskApprovalCreatedEvent - The event data containing information about the created task approval.
     * @returns {Promise<void>} - A promise that resolves when the notification is created successfully.
     */
    @OnEvent(TaskEventNameOptions.TASK_APPROVAL_CREATED)
    async onTaskApprovalCreatedNotificationEvent(taskApprovalCreatedEvent: EntityNotificationDto): Promise<void> {
        try {
            const user = await this.userRepository.findOneBy({id: taskApprovalCreatedEvent.userId});

            await this.notificationService.create(taskApprovalCreatedEvent, user, TaskEventNameOptions.TASK_APPROVAL_CREATED);
        } catch (e) {
            this.logger.log({level: 'error', message: 'Event Error:' + e, error: e});
        }
    }

    /**
     * Handles the "TASK_APPROVAL_UPDATED" event and sends a notification to the user.
     *
     * @param {EntityNotificationDto} taskApprovalEventDto - The data for the event.
     * @return {Promise<void>} - A promise that resolves when the operation is completed or rejects with an error.
     */
    @OnEvent(TaskEventNameOptions.TASK_APPROVAL_UPDATED)
    async onTaskApprovalUpdatedNotificationEvent(taskApprovalEventDto: EntityNotificationDto): Promise<void> {
        try {
            const user = await this.userRepository.findOneBy({id: taskApprovalEventDto.userId});

            await this.notificationService.create(taskApprovalEventDto, user, TaskEventNameOptions.TASK_APPROVAL_UPDATED);
        } catch (e) {
            this.logger.log({level: 'error', message: 'Event Error:' + e, error: e});
        }
    }

    /**
     * Handles the event for task approval deleted notification.
     *
     * @param {EntityNotificationDto} taskApprovalEventDto - The notification event data for task approval deletion.
     * @return {Promise<void>} - A Promise that resolves when the event is handled successfully.
     */
    @OnEvent(TaskEventNameOptions.TASK_APPROVAL_DELETED)
    async onTaskApprovalDeletedNotificationEvent(taskApprovalEventDto: EntityNotificationDto): Promise<void> {
        try {
            const user = await this.userRepository.findOneBy({id: taskApprovalEventDto.userId});

            await this.notificationService.create(taskApprovalEventDto, user, TaskEventNameOptions.TASK_APPROVAL_DELETED);
        } catch (e) {
            this.logger.log({level: 'error', message: 'Event Error:' + e, error: e});
        }
    }

    /**
     * Handles the TASK_APPROVAL_REJECTED event and sends a notification to the user.
     *
     * @param {EntityNotificationDto} taskApprovalEventDto - The data of the event containing the user ID.
     * @return {Promise<void>} - A promise that resolves when the notification is sent.
     */
    @OnEvent(TaskEventNameOptions.TASK_APPROVAL_REJECTED)
    async onTaskApprovalRejectedNotificationEvent(taskApprovalEventDto: EntityNotificationDto): Promise<void> {
        try {
            const user = await this.userRepository.findOneBy({id: taskApprovalEventDto.userId});

            await this.notificationService.create(taskApprovalEventDto, user, TaskEventNameOptions.TASK_APPROVAL_REJECTED);
        } catch (e) {
            this.logger.log({level: 'error', message: 'Event Error:' + e, error: e});
        }
    }

    /**
     * Handles the onTaskApprovalApprovedNotificationEvent.
     *
     * @param {EntityNotificationDto} taskApprovalEventDto - The DTO containing the task approval event details.
     * @return {Promise<void>} - A Promise that resolves when the event is handled successfully.
     */
    @OnEvent(TaskEventNameOptions.TASK_APPROVAL_APPROVED)
    async onTaskApprovalApprovedNotificationEvent(taskApprovalEventDto: EntityNotificationDto): Promise<void> {
        try {
            const user = await this.userRepository.findOneBy({id: taskApprovalEventDto.userId});

            await this.notificationService.create(taskApprovalEventDto, user, TaskEventNameOptions.TASK_APPROVAL_APPROVED);
        } catch (e) {
            this.logger.log({level: 'error', message: 'Event Error:' + e, error: e});
        }
    }

    /**
     * Handles the TASK_APPROVAL_REROUTED event and creates a notification for the user.
     *
     * @param {EntityNotificationDto} taskApprovalEventDto - The DTO containing information about the task approval event.
     * @return {Promise<void>} - A Promise that resolves when the notification creation is complete.
     */
    @OnEvent(TaskEventNameOptions.TASK_APPROVAL_REROUTED)
    async onTaskApprovalReroutedNotificationEvent(taskApprovalEventDto: EntityNotificationDto): Promise<void> {
        try {
            const user = await this.userRepository.findOneBy({id: taskApprovalEventDto.userId});

            await this.notificationService.create(taskApprovalEventDto, user, TaskEventNameOptions.TASK_APPROVAL_REROUTED);
        } catch (e) {
            this.logger.log({level: 'error', message: 'Event Error:' + e, error: e});
        }
    }

    /**
     * Handles the "onTaskApprovalAttachmentAddedNotificationEvent" event.
     *
     * @param {EntityNotificationDto} taskApprovalEventDto - The event data.
     * @return {Promise<void>}
     * @throws {Error} If there is an error while creating the notification.
     */
    @OnEvent(TaskEventNameOptions.TASK_APPROVAL_ATTACHMENT_ADDED)
    async onTaskApprovalAttachmentAddedNotificationEvent(taskApprovalEventDto: EntityNotificationDto): Promise<void> {
        try {
            const user = await this.userRepository.findOneBy({id: taskApprovalEventDto.userId});

            await this.notificationService.create(taskApprovalEventDto, user, TaskEventNameOptions.TASK_APPROVAL_ATTACHMENT_ADDED);
        } catch (e) {
            this.logger.log({level: 'error', message: 'Event Error:' + e, error: e});
        }
    }

    /**
     * Handles the notification event for task approval attachment deletion.
     *
     * @param {EntityNotificationDto} taskApprovalEventDto - The event DTO containing relevant data.
     *
     * @return {Promise<void>} - A Promise that resolves when the event is handled successfully.
     */
    @OnEvent(TaskEventNameOptions.TASK_APPROVAL_ATTACHMENT_DELETED)
    async onTaskApprovalAttachmentDeletedNotificationEvent(taskApprovalEventDto: EntityNotificationDto): Promise<void> {
        try {
            const user = await this.userRepository.findOneBy({id: taskApprovalEventDto.userId});

            await this.notificationService.create(taskApprovalEventDto, user, TaskEventNameOptions.TASK_APPROVAL_ATTACHMENT_DELETED);
        } catch (e) {
            this.logger.log({level: 'error', message: 'Event Error:' + e, error: e});
        }
    }

    /**
     * Handles the onTaskApprovalAttachmentUpdatedNotificationEvent.
     *
     * @param {EntityNotificationDto} taskApprovalEventDto - The task approval event DTO.
     * @return {Promise<void>} - A promise that indicates the completion of the method.
     */
    @OnEvent(TaskEventNameOptions.TASK_APPROVAL_ATTACHMENT_UPDATED)
    async onTaskApprovalAttachmentUpdatedNotificationEvent(taskApprovalEventDto: EntityNotificationDto): Promise<void> {
        try {
            const user = await this.userRepository.findOneBy({id: taskApprovalEventDto.userId});

            await this.notificationService.create(taskApprovalEventDto, user, TaskEventNameOptions.TASK_APPROVAL_ATTACHMENT_UPDATED);
        } catch (e) {
            this.logger.log({level: 'error', message: 'Event Error:' + e, error: e});
        }
    }

    /**
     * Handles the 'onTaskCreatedNotificationEvent' event triggered when a task is created.
     *
     * @param {EntityNotificationDto} taskCreatedEvent - The event data containing information about the created task.
     *
     * @return {Promise<void>} - A promise that resolves when the event handling is completed.
     */
    @OnEvent(TaskEventNameOptions.TASK_CREATE)
    async onTaskCreatedNotificationEvent(taskCreatedEvent: EntityNotificationDto): Promise<void> {
        try {
            const user = await this.userRepository.findOneBy({id: taskCreatedEvent.userId});

            await this.notificationService.create(taskCreatedEvent, user, TaskEventNameOptions.TASK_CREATE);
        } catch (e) {
            this.logger.log({level: 'error', message: 'Event Error:' + e, error: e});
        }
    }

    /**
     * Handle task comment notification event.
     *
     * @param {EntityNotificationDto} taskCommentEvent - The task comment event object.
     * @return {Promise<void>} - A promise that resolves when the operation is completed.
     */
    @OnEvent(TaskEventNameOptions.TASK_COMMENT)
    async onTaskCommentNotificationEvent(taskCommentEvent: EntityNotificationDto): Promise<void> {
        try {
            const user = await this.userRepository.findOneBy({id: taskCommentEvent.userId});

            await this.notificationService.create(taskCommentEvent, user, TaskEventNameOptions.TASK_COMMENT);
        } catch (e) {
            this.logger.log({level: 'error', message: 'Event Error:' + e, error: e});
        }
    }

    /**
     * Handles the onTaskUpdatedNotificationEvent.
     *
     * @param {EntityNotificationDto} taskUpdatedEvent - The task updated event object.
     * @return {Promise<void>} - Returns a promise that resolves to void.
     */
    @OnEvent(TaskEventNameOptions.TASK_UPDATE)
    async onTaskUpdatedNotificationEvent(taskUpdatedEvent: EntityNotificationDto): Promise<void> {
        try {
            const user = await this.userRepository.findOneBy({id: taskUpdatedEvent.userId});

            await this.notificationService.create(taskUpdatedEvent, user, TaskEventNameOptions.TASK_UPDATE);
        } catch (e) {
            this.logger.log({level: 'error', message: 'Event Error:' + e, error: e});
        }
    }

    /**
     * Handles the onTaskUpdatedNotificationEvent.
     *
     * @param {EntityNotificationDto} taskUpdatedEvent - The task updated event object.
     * @return {Promise<void>} - Returns a promise that resolves to void.
     */
    @OnEvent(TaskEventNameOptions.TASK_ARCHIVE)
    async onTaskArchiveNotificationEvent(taskUpdatedEvent: EntityNotificationDto): Promise<void> {
        try {
            const user = await this.userRepository.findOneBy({id: taskUpdatedEvent.userId});

            await this.notificationService.create(taskUpdatedEvent, user, TaskEventNameOptions.TASK_ARCHIVE);
        } catch (e) {
            this.logger.log({level: 'error', message: 'Event Error:' + e, error: e});
        }
    }

    /**
     * Handles the onTaskUpdatedNotificationEvent.
     *
     * @param {EntityNotificationDto} taskUpdatedEvent - The task updated event object.
     * @return {Promise<void>} - Returns a promise that resolves to void.
     */
    @OnEvent(TaskEventNameOptions.TASK_UNARCHIVE)
    async onTaskUnarchiveNotificationEvent(taskUpdatedEvent: EntityNotificationDto): Promise<void> {
        try {
            const user = await this.userRepository.findOneBy({id: taskUpdatedEvent.userId});

            await this.notificationService.create(taskUpdatedEvent, user, TaskEventNameOptions.TASK_UNARCHIVE);
        } catch (e) {
            this.logger.log({level: 'error', message: 'Event Error:' + e, error: e});
        }
    }

    /**
     * Handles the onTaskUpdatedNotificationEvent.
     *
     * @param {EntityNotificationDto} taskUpdatedEvent - The task updated event object.
     * @return {Promise<void>} - Returns a promise that resolves to void.
     */
    @OnEvent(TaskEventNameOptions.TASK_RESTORE)
    async onTaskRestoreNotificationEvent(taskUpdatedEvent: EntityNotificationDto): Promise<void> {
        try {
            const user = await this.userRepository.findOneBy({id: taskUpdatedEvent.userId});

            await this.notificationService.create(taskUpdatedEvent, user, TaskEventNameOptions.TASK_RESTORE);
        } catch (e) {
            this.logger.log({level: 'error', message: 'Event Error:' + e, error: e});
        }
    }

    /**
     * Handles the task moved notification event.
     *
     * @param {EntityNotificationDto} taskMovedEvent - The notification event data.
     *
     * @return {Promise<void>} - A promise that resolves when the event handling is complete.
     */
    @OnEvent(TaskEventNameOptions.TASK_MOVE)
    async onTaskMovedNotificationEvent(taskMovedEvent: EntityNotificationDto): Promise<void> {
        try {
            const user = await this.userRepository.findOneBy({id: taskMovedEvent.userId});

            await this.notificationService.create(taskMovedEvent, user, TaskEventNameOptions.TASK_MOVE);
        } catch (e) {
            this.logger.log({level: 'error', message: 'Event Error:' + e, error: e});
        }
    }

    /**
     * Handles the onTaskUnassignedNotificationEvent.
     * @param {EntityNotificationDto} taskUnassignedEvent - The task unassigned notification event.
     * @return {Promise<void>} - A promise that resolves once the event is handled successfully.
     */
    @OnEvent(TaskEventNameOptions.TASK_UNASSIGN_TASK)
    async onTaskUnassignedNotificationEvent(taskUnassignedEvent: EntityNotificationDto): Promise<void> {
        try {
            const user = await this.userRepository.findOneBy({id: taskUnassignedEvent.userId});
            await this.notificationService.create(taskUnassignedEvent, user, TaskEventNameOptions.TASK_UNASSIGN_TASK);
        } catch (e) {
            this.logger.log({level: 'error', message: 'Event Error:' + e, error: e});
        }
    }

    /**
     * Handles the "onTaskAssigneeAddedNotificationEvent" method
     * triggered by the "TASK_ASSIGN" event.
     *
     * @param {EntityNotificationDto} taskAssigneeAdded - The notification data for the task assignee added event.
     * @return {Promise<void>} - A promise that resolves when the method execution is complete.
     */
    @OnEvent(TaskEventNameOptions.TASK_ASSIGN)
    async onTaskAssigneeAddedNotificationEvent(taskAssigneeAdded: EntityNotificationDto): Promise<void> {
        try {
            const user = await this.userRepository.findOneBy({id: taskAssigneeAdded.userId});

            await this.notificationService.create(taskAssigneeAdded, user, TaskEventNameOptions.TASK_ASSIGN);
        } catch (e) {
            this.logger.log({level: 'error', message: 'Event Error:' + e, error: e});
        }
    }

    /**
     * Handle the onTaskAttachmentAddedNotificationEvent event.
     *
     * @param {EntityNotificationDto} taskAttachmentAdded - The task attachment notification object.
     * @return {Promise<void>} - A promise that resolves when the event is handled.
     */
    @OnEvent(TaskEventNameOptions.TASK_ADD_ATTACH)
    async onTaskAttachmentAddedNotificationEvent(taskAttachmentAdded: EntityNotificationDto): Promise<void> {
        try {
            const user = await this.userRepository.findOneBy({id: taskAttachmentAdded.userId});

            await this.notificationService.create(taskAttachmentAdded, user, TaskEventNameOptions.TASK_ADD_ATTACH);
        } catch (e) {
            this.logger.log({level: 'error', message: 'Event Error:' + e, error: e});
        }
    }

    /**
     * Handle the onTaskAttachmentDeletedNotificationEvent
     *
     * @param {EntityNotificationDto} taskAttachmentDeleted - The deleted task attachment notification
     *
     * @return {Promise<void>} - A promise that resolves to void
     */
    @OnEvent(TaskEventNameOptions.TASK_DEL_ATTACH)
    async onTaskAttachmentDeletedNotificationEvent(taskAttachmentDeleted: EntityNotificationDto): Promise<void> {
        try {
            const user = await this.userRepository.findOneBy({id: taskAttachmentDeleted.userId});

            await this.notificationService.create(taskAttachmentDeleted, user, TaskEventNameOptions.TASK_DEL_ATTACH);
        } catch (e) {
            this.logger.log({level: 'error', message: 'Event Error:' + e, error: e});
        }
    }

    /**
     * Handles the Task Tagged Notification event.
     *
     * @param {EntityNotificationDto} taskTagged - The notification data for the tagged task.
     * @return {Promise<void>} - A promise that resolves when the event handling is complete.
     */
    @OnEvent(TaskEventNameOptions.TASK_TAG)
    async onTaskTaggedNotificationEvent(taskTagged: EntityNotificationDto): Promise<void> {
        try {
            const user = await this.userRepository.findOneBy({id: taskTagged.userId});
            await this.notificationService.create(taskTagged, user, TaskEventNameOptions.TASK_TAG);
        } catch (e) {
            this.logger.log({level: 'error', message: 'Event Error:' + e, error: e});
        }
    }

    /**
     * Handles the onTaskDeletedNotificationEvent, triggered when a task is deleted.
     *
     * @param {EntityNotificationDto} taskDeleted - The object containing the data of the deleted task.
     * @returns {Promise<void>} - A promise that resolves when the method has finished executing.
     */
    @OnEvent(TaskEventNameOptions.TASK_DELETE)
    async onTaskDeletedNotificationEvent(taskDeleted: EntityNotificationDto): Promise<void> {
        try {
            const user = await this.userRepository.findOneBy({id: taskDeleted.userId});
            await this.notificationService.create(taskDeleted, user, TaskEventNameOptions.TASK_DELETE);
        } catch (e) {
            this.logger.log({level: 'error', message: 'Event Error:' + e, error: e});
        }
    }

    /* @OnEvent(TaskEventNameOptions.TASK_STREAM_UPDATE)
async onTaskStreamUpdateNotificationEvent(taskStreamUpdate: EntityNotificationDto): Promise<void> {
const user = await this.userRepository.findOneBy({id: taskStreamUpdate.userId});
await this.notificationsService.create(taskStreamUpdate, user, TaskEventNameOptions.TASK_STREAM_UPDATE);
} */

    /**
     * Handles the `FOLDER_CREATE` event and creates a notification for the folder creation.
     *
     * @param {EntityNotificationDto} folderCreated - The entity notification DTO containing information about the folder creation.
     *
     * @return {Promise<void>} - A promise that resolves when the notification creation has completed.
     */
    @OnEvent(FolderEventNameOptions.FOLDER_CREATE)
    async onFolderCreatedNotificationEvent(folderCreated: EntityNotificationDto): Promise<void> {
        try {
            const user = await this.userRepository.findOneBy({id: folderCreated.userId});
            await this.notificationService.create(folderCreated, user, FolderEventNameOptions.FOLDER_CREATE);
        } catch (e) {
            this.logger.log({level: 'error', message: 'Event Error:' + e, error: e});
        }
    }

    /**
     * Handles the 'onFolderDeletedNotificationEvent' event.
     *
     * @param {EntityNotificationDto} folderDeleted - The entity notification DTO for the deleted folder.
     * @return {Promise<void>} - A promise that resolves to void.
     */
    @OnEvent(FolderEventNameOptions.FOLDER_DELETE)
    async onFolderDeletedNotificationEvent(folderDeleted: EntityNotificationDto): Promise<void> {
        try {
            const user = await this.userRepository.findOneBy({id: folderDeleted.userId});
            await this.notificationService.create(folderDeleted, user, FolderEventNameOptions.FOLDER_DELETE);
        } catch (e) {
            this.logger.log({level: 'error', message: 'Event Error:' + e, error: e});
        }
    }

    /**
     * Handles the folder archived notification event.
     *
     * @param {EntityNotificationDto} folderArchived - The folder archived notification object.
     * @return {Promise<void>} - A promise that resolves when the method successfully executes.
     * @throws {Error} - If there was an error on the event.
     */
    @OnEvent(FolderEventNameOptions.FOLDER_ARCHIVE)
    async onFolderArchivedNotificationEvent(folderArchived: EntityNotificationDto): Promise<void> {
        try {
            const user = await this.userRepository.findOneBy({id: folderArchived.userId});

            await this.notificationService.create(folderArchived, user, FolderEventNameOptions.FOLDER_ARCHIVE);
        } catch (e) {
            this.logger.log({level: 'error', message: 'Event Error:' + e, error: e});
        }
    }

    /**
     * Handle the `FOLDER_RESTORE_ARCHIVE` event and create a notification for the restored folder.
     *
     * @param {EntityNotificationDto} folderRestoreArchived - The notification data for the restored folder.
     * @return {Promise<void>} - A promise that resolves when the operation is complete.
     */
    @OnEvent(FolderEventNameOptions.FOLDER_RESTORE_ARCHIVE)
    async onFolderRestoreArchivedNotificationEvent(folderRestoreArchived: EntityNotificationDto): Promise<void> {
        try {
            const user = await this.userRepository.findOneBy({id: folderRestoreArchived.userId});
            await this.notificationService.create(folderRestoreArchived, user, FolderEventNameOptions.FOLDER_RESTORE_ARCHIVE);
        } catch (e) {
            this.logger.log({level: 'error', message: 'Event Error:' + e, error: e});
        }
    }

    /**
     * Handles the folder member added notification event.
     *
     * @param {EntityNotificationDto} folderMemberAdded - The entity notification object containing information about the added folder member.
     * @return {Promise<void>} - A promise that resolves once the event is handled.
     */
    @OnEvent(FolderEventNameOptions.FOLDER_ADD_MEMBER)
    async onFolderMemberAddedNotificationEvent(folderMemberAdded: EntityNotificationDto): Promise<void> {
        try {
            const user = await this.userRepository.findOneBy({id: folderMemberAdded.userId});

            await this.notificationService.create(folderMemberAdded, user, FolderEventNameOptions.FOLDER_ADD_MEMBER);
        } catch (e) {
            this.logger.log({level: 'error', message: 'Event Error:' + e, error: e});
        }
    }

    /**
     * Handles the onFolderMemberUpdatedNotificationEvent.
     *
     * @param {EntityNotificationDto} folderMemberUpdated - The folder member updated notification.
     * @return {Promise<void>} - A promise that resolves when the operation is complete.
     */
    @OnEvent(FolderEventNameOptions.FOLDER_UPDATE_MEMBER)
    async onFolderMemberUpdatedNotificationEvent(folderMemberUpdated: EntityNotificationDto): Promise<void> {
        try {
            const user = await this.userRepository.findOneBy({id: folderMemberUpdated.userId});
            await this.notificationService.create(folderMemberUpdated, user, FolderEventNameOptions.FOLDER_UPDATE_MEMBER);
        } catch (e) {
            this.logger.log({level: 'error', message: 'Event Error:' + e, error: e});
        }
    }

    /**
     * Handles the folder member removed notification event.
     *
     * @param {EntityNotificationDto} folderMemberRemoved - The entity notification for the removed folder member.
     * @return {Promise<void>} - A promise that resolves when the event is handled.
     */
    @OnEvent(FolderEventNameOptions.FOLDER_REMOVE_MEMBER)
    async onFolderMemberRemovedNotificationEvent(folderMemberRemoved: EntityNotificationDto): Promise<void> {
        try {
            const user = await this.userRepository.findOneBy({id: folderMemberRemoved.userId});

            await this.notificationService.create(folderMemberRemoved, user, FolderEventNameOptions.FOLDER_REMOVE_MEMBER);
        } catch (e) {
            this.logger.log({level: 'error', message: 'Event Error:' + e, error: e});
        }
    }

    /**
     * Handles the folder copied notification event.
     *
     * @param {EntityNotificationDto} folderCopied - The folder copied notification data.
     * @return {Promise<void>} A promise that resolves when the operation is complete.
     */
    @OnEvent(FolderEventNameOptions.FOLDER_COPY)
    async onFolderCopiedNotificationEvent(folderCopied: EntityNotificationDto): Promise<void> {
        try {
            const user = await this.userRepository.findOneBy({id: folderCopied.userId});
            await this.notificationService.create(folderCopied, user, FolderEventNameOptions.FOLDER_COPY);
        } catch (e) {
            this.logger.log({level: 'error', message: 'Event Error:' + e, error: e});
        }
    }

    /**
     * Handles the `FOLDER_SET_OWNER` event and creates a notification for the specified folder owner.
     *
     * @param {EntityNotificationDto} setFolderOwner - The data of the folder owner notification.
     * @return {Promise<void>} - A promise that resolves when the notification is created successfully.
     * @throws {Error} - If there was an error while creating the notification.
     */
    @OnEvent(FolderEventNameOptions.FOLDER_SET_OWNER)
    async onSetFolderOwnerNotificationEvent(setFolderOwner: EntityNotificationDto): Promise<void> {
        try {
            const user = await this.userRepository.findOneBy({id: setFolderOwner.userId});
            await this.notificationService.create(setFolderOwner, user, FolderEventNameOptions.FOLDER_SET_OWNER);
        } catch (e) {
            this.logger.log({level: 'error', message: 'Event Error:' + e, error: e});
        }
    }

    /* @OnEvent(FolderEventNameOptions.FOLDER_STREAM_UPDATE)
async onFolderStreamUpdateNotificationEvent(folderStreamUpdate: EntityNotificationDto): Promise<void> {
const user = await this.userRepository.findOneBy({id: folderStreamUpdate.userId});
await this.notificationsService.create(folderStreamUpdate, user, FolderEventNameOptions.FOLDER_STREAM_UPDATE);
} */

    /**
     * Handles the event when a folder is updated and sends a notification to the user.
     *
     * @param {EntityNotificationDto} folderUpdated - The updated folder entity notification data.
     * @return {Promise<void>} - A promise that resolves when the event is handled.
     */
    @OnEvent(FolderEventNameOptions.FOLDER_UPDATE)
    async onFolderUpdatedNotificationEvent(folderUpdated: EntityNotificationDto): Promise<void> {
        try {
            const user = await this.userRepository.findOneBy({id: folderUpdated.userId});

            await this.notificationService.create(folderUpdated, user, FolderEventNameOptions.FOLDER_UPDATE);
        } catch (e) {
            this.logger.log({level: 'error', message: 'Event Error:' + e, error: e});
        }
    }

    /**
     * Handles the `TASK_CREATED` event.
     *
     * @param {AutomationNotificationDto} taskCreatedEvent - The task created event object.
     *
     * @return {Promise<void>} - A Promise that resolves once the event is handled.
     */
    @OnEvent(AutomationsEventOptions.TASK_CREATED)
    async onTaskCreatedEvent(taskCreatedEvent: AutomationNotificationDto): Promise<void> {
        try {
            const ret = await this.automationsRedisSendService.queueMessage(taskCreatedEvent);
            this.logger.log(`Task created event sent, job #${ret.id}`);
        } catch (e) {
            this.logger.log({level: 'error', message: 'Event Error:' + e, error: e});
        }
    }

    /**
     * Handles the onTaskAssigneeAddedEvent event.
     *
     * @param {AutomationNotificationDto} taskAssigneeAdded - The task assignee added event.
     *
     * @return {Promise<void>} - A promise that resolves when the event is handled.
     */
    @OnEvent(AutomationsEventOptions.TASK_ASSIGNEE_ADDED)
    async onTaskAssigneeAddedEvent(taskAssigneeAdded: AutomationNotificationDto): Promise<void> {
        try {
            const ret = await this.automationsRedisSendService.queueMessage(taskAssigneeAdded);
            this.logger.log(`Task assignee event sent, job #${ret.id}`);
        } catch (e) {
            this.logger.log({level: 'error', message: 'Event Error:' + e, error: e});
        }
    }

    /**
     * Handles the event when the importance of a task is changed.
     *
     * @param {AutomationNotificationDto} taskImportanceChanged - The object containing the information about the task's importance change.
     * @return {Promise<void>} - A promise that resolves when the event is handled.
     */
    @OnEvent(AutomationsEventOptions.TASK_IMPORTANCE_CHANGED)
    async onTaskImportanceChangedEvent(taskImportanceChanged: AutomationNotificationDto): Promise<void> {
        try {
            const ret = await this.automationsRedisSendService.queueMessage(taskImportanceChanged);
            this.logger.log(`Task importance changed event sent, job #${ret.id}`);
        } catch (e) {
            this.logger.log({level: 'error', message: 'Event Error:' + e, error: e});
        }
    }

    /**
     * Executes when a User Create event is triggered.
     * @param {EntityNotificationDto} event - The event object containing information about the user.
     * @return {Promise<void>} - Returns a Promise that resolves to nothing when the operation is complete.
     */
    @OnEvent(UserEventNameOptions.USER_CREATE)
    async onUserCreateEvent(event: EntityNotificationDto): Promise<void> {
        try {
            await this.dashboardService.createDefaultDashboardForUser(event.userId);
        } catch (e) {
            this.logger.log({level: 'error', message: 'There was an error on event USER_CREATE:' + e, error: e});
        }
    }
}
