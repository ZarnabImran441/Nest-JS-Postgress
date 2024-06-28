import {BadRequestException, Inject, Injectable, Logger} from '@nestjs/common';
import {AddApprovalToTaskDto, CreateApprovalDto} from '../../dto/approval/create-approval.dto';
import {TaskEntity} from '../../model/task.entity';
import {ArrayContains, In, Repository} from 'typeorm';
import {TaskService} from '../task/task.service';
import {contructorLogger, formatBytes, getUserFullName, JwtUserInterface, S3Service} from '@lib/base-library';
import {ApprovalEntity} from '../../model/approval.entity';
import {InjectRepository} from '@nestjs/typeorm';
import {Transactional, runOnTransactionCommit} from 'typeorm-transactional';
import {ApprovalActionEntity} from '../../model/approval-action.entity';
import {ApprovalAttachmentEntity} from '../../model/approval-attachment.entity';
import * as dayjs from 'dayjs';
import {readFileType} from '../../utils/helpers';
import {CommentApprovalDto} from '../../dto/approval/comment-approval.dto';
import {ApprovalActionOptions} from '../../enum/approval-action.enum';
import {ApprovalStatusOptions} from '../../enum/approval-status.enum';
import {ApprovalActionResponseDto} from '../../dto/approval/action-response.dto';
import {UpdateApprovalDto} from '../../dto/approval/update-approval.dto';
import {RouteToUsersDto} from '../../dto/approval/route-to-users.dto';
import {Cron, CronExpression} from '@nestjs/schedule';
import {TaskRelationEntity} from '../../model/task-relation.entity';
import {TaskActionOptions} from '../../enum/task-action.enum';
import {MessageId} from '../../enum/message-id.enum';
import {TaskActionEntity} from '../../model/task-action.entity';
import {EventEmitter2} from '@nestjs/event-emitter';
import {NotificationService} from '../notification/notification.service';
import {UserEntity} from '../../model/user.entity';
import {SERVICE_USER_ID} from '../../const/env.const';
import {TaskEventNameOptions} from '../../enum/notification-event.enum';
import {EntityNotificationDto} from '../../dto/events/entity-notification.dto';
import {queries} from '../../recursive-queries';

/**
 * Service responsible for managing approvals.
 */
@Injectable()
export class ApprovalsService {
    private readonly logger = new Logger(ApprovalsService.name);
    public readonly APPROVAL_FILE_S3_DIR = 'approval-file';
    public readonly APPROVAL_FILE_THUMBNAIL_S3_DIR = 'approval-file-thumbnail';

    /**
     * Constructs a new instance of the class.
     *
     * @param {Repository<ApprovalEntity>} approvalRepository - The repository for ApprovalEntity.
     * @param {Repository<ApprovalActionEntity>} approvalActionRepository - The repository for ApprovalActionEntity.
     * @param {Repository<ApprovalAttachmentEntity>} approvalAttachmentRepository - The repository for ApprovalAttachmentEntity.
     * @param {Repository<TaskEntity>} taskEntityRepository - The repository for TaskEntity.
     * @param {Repository<TaskRelationEntity>} taskRelationEntityRepository - The repository for TaskRelationEntity.
     * @param {TaskService} taskService - The task service instance to be used by the constructor.
     * @param {S3Service} s3Service - The S3 service instance to be used by the constructor.
     */
    constructor(
        @InjectRepository(ApprovalEntity) public approvalRepository: Repository<ApprovalEntity>,
        @InjectRepository(ApprovalActionEntity) public approvalActionRepository: Repository<ApprovalActionEntity>,
        @InjectRepository(ApprovalAttachmentEntity) public approvalAttachmentRepository: Repository<ApprovalAttachmentEntity>,
        @InjectRepository(TaskEntity) public taskEntityRepository: Repository<TaskEntity>,
        @InjectRepository(TaskRelationEntity) public taskRelationEntityRepository: Repository<TaskRelationEntity>,
        @InjectRepository(UserEntity) public userRepository: Repository<UserEntity>,
        public taskService: TaskService,
        public s3Service: S3Service,
        public notificationService: NotificationService,
        @Inject(EventEmitter2) protected readonly eventEmitter: EventEmitter2
    ) {
        contructorLogger(this);
    }

    /**
     * Update the approval attachment file and its details.
     *
     * @param {Express.Multer.File} file - The file to be uploaded.
     * @param {number} attachmentId - The ID of the attachment.
     * @returns {Promise<ApprovalAttachmentEntity>} - The updated ApprovalAttachmentEntity object.
     *
     * @throws {Error} - If the attachment is not found.
     * @throws {Error} - If there is an error in creating thumbnails.
     *
     * @example
     * const file = req.file;
     * const attachmentId = 1;
     * const updatedAttachment = await updateApprovalAttachmentFile(file, attachmentId);
     */
    @Transactional()
    async updateApprovalAttachmentFile(file: Express.Multer.File, attachmentId: number, userId: string): Promise<ApprovalAttachmentEntity> {
        let thumbnailOnS3: string;
        const attachmentDB = await this.approvalAttachmentRepository.findOneOrFail({
            where: {id: attachmentId},
            relations: {approval: {task: true}},
        });
        const {thumbnail, predefinedThumbnail} = await this.s3Service.createThumbnail(file.buffer, file.originalname);

        file.originalname = file.originalname.replace(this.s3Service.NORMALIZE_S3_KEY_REPLACE_PLUS, '_');

        const baseFilename = `${dayjs(new Date()).format('YYYYMMDDHHmmssSSS')}-${file.originalname.toLocaleLowerCase()}`;
        const fileOnS3 = `${this.APPROVAL_FILE_S3_DIR}/${baseFilename}`;

        await this.s3Service.uploadFile(file.buffer, fileOnS3);

        if (thumbnail) {
            thumbnailOnS3 = `${this.APPROVAL_FILE_THUMBNAIL_S3_DIR}/${baseFilename}`;
            await this.s3Service.uploadFile(thumbnail, thumbnailOnS3);
        }

        await this.s3Service.deleteFile(attachmentDB.fileName);
        await this.s3Service.deleteFile(attachmentDB.thumbnailName);

        await this.approvalAttachmentRepository.update(
            {id: attachmentId},
            {
                fileType: readFileType(file),
                fileSize: formatBytes(file.size),
                thumbnailName: thumbnail ? thumbnailOnS3 : predefinedThumbnail,
                fileName: fileOnS3,
            }
        );

        // add comment to task
        const repoTaskAction = this.taskEntityRepository.manager.getRepository<TaskActionEntity>(TaskActionEntity);
        await repoTaskAction.insert({
            Task: attachmentDB.approval.task,
            action: TaskActionOptions.APPROVAL_UPDATE_ATTACHMENTS,
            messageId: MessageId.APPROVAL_UPDATE_ATTACHMENTS,
            parameters: {approval: {attachments: {updated: {id: attachmentId}}}},
            task: attachmentDB.approval.task,
            user: {id: userId},
        });
        const recipients = (await this.notificationService.getTaskNotificationRecipients(attachmentDB.approval.task.id)).filter(
            (x) => x !== userId || x !== SERVICE_USER_ID
        );
        const user = await this.userRepository.findOne({where: {id: userId}});
        const {Folder} = await this.taskRelationEntityRepository.findOne({
            where: {childTaskId: attachmentDB.approval.task.id},
            relations: {Folder: true},
        });

        let spaceId: number | null = null;
        if (Folder) {
            const [{id}] = await this.approvalRepository.query(queries.getSpaceWithFolderIdSql, [Folder.id]);
            spaceId = id || null;
        }
        runOnTransactionCommit(() => {
            this.eventEmitter.emit(TaskEventNameOptions.TASK_APPROVAL_ATTACHMENT_UPDATED, {
                data: {
                    event: TaskEventNameOptions.TASK_APPROVAL_ATTACHMENT_UPDATED,
                    message: this.notificationService.setNotificationMessage({
                        actions: {
                            approval: {
                                attachmentUpdated: true,
                            },
                        },
                        entity: 'task',
                        entityTitle: attachmentDB.approval.task.title,
                        sender: getUserFullName(user),
                    }),
                    userId,
                    folderId: Folder.id,
                    taskId: attachmentDB.approval.task.id,
                    spaceId,
                },
                userId,
                recipients,
            } as EntityNotificationDto);
        });
        return attachmentDB;
    }

    /**
     * Uploads approval files and returns an array of ApprovalAttachmentEntity objects.
     *
     * @param files - The array of file objects to be uploaded.
     * @param approvalId - The ID of the approval.
     *
     * @returns A Promise that resolves to an array of ApprovalAttachmentEntity objects.
     *
     * @throws {Error} If any error occurs during the upload process.
     */
    @Transactional()
    async uploadApprovalFiles(files: Express.Multer.File[], approvalId: number, userId: string): Promise<ApprovalAttachmentEntity[]> {
        let fileOnS3: string = null,
            thumbnailOnS3: string = null;
        const uploadResults: ApprovalAttachmentEntity[] = [];
        const addedAttachments: {id: number; name: string}[] = [];
        const approvalDB = await this.approvalRepository.findOne({where: {id: approvalId}, relations: {task: true}});

        for (const file of files) {
            file.originalname = file.originalname.replace(this.s3Service.NORMALIZE_S3_KEY_REPLACE_PLUS, '_');

            const {thumbnail, predefinedThumbnail} = await this.s3Service.createThumbnail(file.buffer, file.originalname);

            const baseFilename = `${dayjs(new Date()).format('YYYYMMDDHHmmssSSS')}-${file.originalname.toLocaleLowerCase()}`;
            fileOnS3 = `${this.APPROVAL_FILE_S3_DIR}/${baseFilename}`;

            await this.s3Service.uploadFile(file.buffer, fileOnS3);

            if (thumbnail) {
                thumbnailOnS3 = `${this.APPROVAL_FILE_THUMBNAIL_S3_DIR}/${baseFilename}`;
                await this.s3Service.uploadFile(thumbnail, thumbnailOnS3);
            }
            const fileType = readFileType(file);
            const attachment = await this.approvalAttachmentRepository.save({
                approval: approvalDB,
                fileName: fileOnS3,
                thumbnailName: thumbnail ? thumbnailOnS3 : predefinedThumbnail,
                fileType,
                originalName: file.originalname,
                fileSize: formatBytes(file.size),
            });
            uploadResults.push(attachment);

            addedAttachments.push({id: attachment.id, name: attachment.originalName});
        }

        // add comment to task
        const repoTaskAction = this.taskEntityRepository.manager.getRepository<TaskActionEntity>(TaskActionEntity);
        await repoTaskAction.insert({
            Task: approvalDB.task,
            action: TaskActionOptions.APPROVAL_ADD_ATTACHMENTS,
            messageId: MessageId.APPROVAL_ADD_ATTACHMENTS,
            parameters: {approval: {attachments: {added: addedAttachments}}},
            task: approvalDB.task,
            user: {id: userId},
        });
        const recipients = (await this.notificationService.getTaskNotificationRecipients(approvalDB.task.id)).filter(
            (x) => x !== userId || x !== SERVICE_USER_ID
        );
        const user = await this.userRepository.findOne({where: {id: userId}});
        const {Folder} = await this.taskRelationEntityRepository.findOne({
            where: {childTaskId: approvalDB.task.id},
            relations: {Folder: true},
        });

        let spaceId: number | null = null;
        if (Folder) {
            const [{id}] = await this.approvalRepository.query(queries.getSpaceWithFolderIdSql, [Folder.id]);
            spaceId = id || null;
        }
        runOnTransactionCommit(() => {
            this.eventEmitter.emit(TaskEventNameOptions.TASK_APPROVAL_ATTACHMENT_ADDED, {
                data: {
                    event: TaskEventNameOptions.TASK_APPROVAL_ATTACHMENT_ADDED,
                    message: this.notificationService.setNotificationMessage({
                        actions: {
                            approval: {
                                attachmentAdded: true,
                            },
                        },
                        entity: 'task',
                        entityTitle: approvalDB.task.title,
                        sender: getUserFullName(user),
                    }),
                    userId,
                    folderId: Folder.id,
                    taskId: approvalDB.task.id,
                    spaceId,
                },
                userId,
                recipients,
            } as EntityNotificationDto);
        });
        return uploadResults;
    }

    /**
     * Creates an approval and a task.
     *
     * @param {CreateApprovalDto} body - The data needed to create the approval.
     * @param {JwtUserInterface} user - The user creating the approval.
     * @param {Express.Multer.File[]} [files] - Optional array of files to attach to the approval.
     * @returns {Promise<ApprovalEntity>} The created approval.
     */
    @Transactional()
    async createApprovalAndTask(body: CreateApprovalDto, user: JwtUserInterface, files?: Express.Multer.File[]): Promise<ApprovalEntity> {
        const {createTaskDto, requiredApprovals, assignedApprovers, description} = body;
        const task: TaskEntity = await this.taskService.createOneTask(createTaskDto, user);

        const approval = {
            task,
            createdBy: user.id,
            requiredApprovals,
            assignedApprovers,
            description,
        };
        const savedApproval = await this.approvalRepository.save(approval);
        // add comment to task
        const repoTaskAction = this.taskEntityRepository.manager.getRepository<TaskActionEntity>(TaskActionEntity);
        await repoTaskAction.insert({
            Task: savedApproval.task,
            action: TaskActionOptions.ADD_APPROVAL_TO_TASK,
            messageId: MessageId.ADD_APPROVAL_TO_TASK,
            parameters: {approval: {task: task.id}},
            task: savedApproval.task,
            user: {id: user.id},
        });

        if (files) {
            // Save approval attachments
            await this.uploadApprovalFiles(files, savedApproval.id, user.id);
        }
        const recipients = (await this.notificationService.getTaskNotificationRecipients(savedApproval.task.id)).filter(
            (x) => x !== user.id || x !== SERVICE_USER_ID
        );
        const dbUser = await this.userRepository.findOne({where: {id: user.id}});
        const {Folder} = await this.taskRelationEntityRepository.findOne({
            where: {childTaskId: savedApproval.task.id},
            relations: {Folder: true},
        });

        let spaceId: number | null = null;
        if (Folder) {
            const [{id}] = await this.approvalRepository.query(queries.getSpaceWithFolderIdSql, [Folder.id]);
            spaceId = id || null;
        }

        runOnTransactionCommit(() => {
            this.eventEmitter.emit(TaskEventNameOptions.TASK_APPROVAL_CREATED, {
                data: {
                    event: TaskEventNameOptions.TASK_APPROVAL_CREATED,
                    message: this.notificationService.setNotificationMessage({
                        actions: {
                            approval: {
                                created: true,
                            },
                        },
                        entity: 'task',
                        entityTitle: savedApproval.task.title,
                        sender: getUserFullName(dbUser),
                    }),
                    userId: dbUser.id,
                    folderId: Folder.id,
                    taskId: savedApproval.task.id,
                    spaceId,
                },
                userId: dbUser.id,
                recipients,
            } as EntityNotificationDto);
        });
        return savedApproval;
    }

    /**
     * Adds an approval to a task.
     *
     * @param {AddApprovalToTaskDto} body - The DTO containing the approval details.
     * @param {number} taskId - The ID of the task.
     * @param {JwtUserInterface} user - The user creating the approval.
     * @param {Express.Multer.File[]} [files] - Optional array of files to be uploaded as attachments.
     * @returns {Promise<ApprovalEntity>} - A Promise that resolves to the saved ApprovalEntity.
     *
     * @throws Error - If the task with the given taskId does not exist.
     *
     * @note This method is decorated with @Transactional(), ensuring that the database operations are performed within a single transaction.
     */
    @Transactional()
    async addAprovalToTask(
        body: AddApprovalToTaskDto,
        taskId: number,
        user: JwtUserInterface,
        files?: Express.Multer.File[]
    ): Promise<ApprovalEntity> {
        const {requiredApprovals, assignedApprovers, description} = body;
        let task: TaskEntity;
        if (taskId) {
            task = await this.taskEntityRepository.findOneByOrFail({id: taskId});
        }
        const approval = {
            task,
            createdBy: user.id,
            requiredApprovals,
            assignedApprovers,
            description,
        };
        const savedApproval = await this.approvalRepository.save(approval);

        const repoTaskAction = this.taskEntityRepository.manager.getRepository<TaskActionEntity>(TaskActionEntity);
        await repoTaskAction.insert({
            Task: savedApproval.task,
            action: TaskActionOptions.ADD_APPROVAL_TO_TASK,
            messageId: MessageId.ADD_APPROVAL_TO_TASK,
            parameters: {approval: {task: task.id}},
            task: savedApproval.task,
            user: {id: user.id},
        });
        const recipients = (await this.notificationService.getTaskNotificationRecipients(savedApproval.task.id)).filter(
            (x) => x !== user.id || x !== SERVICE_USER_ID
        );
        const dbUser = await this.userRepository.findOne({where: {id: user.id}});
        const {Folder} = await this.taskRelationEntityRepository.findOne({
            where: {childTaskId: savedApproval.task.id},
            relations: {Folder: true},
        });

        let spaceId: number | null = null;
        if (Folder) {
            const [{id}] = await this.approvalRepository.query(queries.getSpaceWithFolderIdSql, [Folder.id]);
            spaceId = id || null;
        }
        runOnTransactionCommit(() => {
            this.eventEmitter.emit(TaskEventNameOptions.TASK_APPROVAL_CREATED, {
                data: {
                    event: TaskEventNameOptions.TASK_APPROVAL_CREATED,
                    message: this.notificationService.setNotificationMessage({
                        actions: {
                            approval: {
                                created: true,
                            },
                        },
                        entity: 'task',
                        entityTitle: savedApproval.task.title,
                        sender: getUserFullName(dbUser),
                    }),
                    userId: dbUser.id,
                    folderId: Folder.id,
                    taskId: savedApproval.task.id,
                    spaceId,
                },
                userId: dbUser.id,
                recipients,
            } as EntityNotificationDto);
        });
        if (files?.length > 0) {
            // Save approval attachments
            await this.uploadApprovalFiles(files, savedApproval.id, user.id);
        }

        return savedApproval;
    }

    /**
     * Retrieves the list of approvals for a given task ID.
     *
     * @param {number} taskId - The ID of the task for which to retrieve the approvals.
     * @param {JwtUserInterface} user - The user object containing the JWT token.
     * @param {ApprovalStatusOptions} [status] - Optional parameter to filter approvals by status.
     *
     * @returns {Promise<ApprovalEntity[]>} - A promise that resolves to an array of ApprovalEntity objects.
     */
    async getApprovalsByTaskId(taskId: number, user: JwtUserInterface, status?: ApprovalStatusOptions): Promise<ApprovalEntity[]> {
        const findConditions = status ? {task: {id: taskId}, status: status} : {task: {id: taskId}};
        const approvals = await this.approvalRepository.find({
            where: findConditions,
            relations: {task: true, actions: true, attachments: true},
        });
        for (const approval of approvals) {
            approval.attachments = await this.getApprovalAttachments(approval.attachments);
        }
        return approvals;
    }

    /**
     * Returns a list of approvals created by a specific user.
     *
     * @param {string} userId - The ID of the user who created the approvals.
     * @param {ApprovalStatusOptions} [status] - Optional. The status of the approvals to filter.
     * @return {Promise<ApprovalEntity[]>} A promise that resolves with an array of ApprovalEntity objects representing the approvals.
     */
    async getApprovalsCreatedByUser(userId: string, status?: ApprovalStatusOptions): Promise<ApprovalEntity[]> {
        const findConditions = status ? {createdBy: userId, status: status} : {createdBy: userId};
        const approvals = await this.approvalRepository.find({
            where: findConditions,
            relations: {task: true, actions: true, attachments: true},
        });
        for (const approval of approvals) {
            approval.attachments = await this.getApprovalAttachments(approval.attachments);
        }
        return approvals;
    }

    /**
     * Retrieves the approvals assigned to a specific user.
     *
     * @param {string} userId - The ID of the user.
     * @param {ApprovalStatusOptions} [status] - Optional status filter for the approvals.
     * @returns {Promise<ApprovalEntity[]>} - A Promise that resolves with an array of ApprovalEntity objects.
     */
    async getApprovalsAssignedToUser(userId: string, status?: ApprovalStatusOptions): Promise<ApprovalEntity[]> {
        const findConditions = status
            ? {assignedApprovers: ArrayContains([userId]), status: status}
            : {assignedApprovers: ArrayContains([userId])};

        const approvals = await this.approvalRepository.find({
            where: findConditions,
            relations: {task: true, actions: true, attachments: true},
        });
        const approvalTasksIds = [...new Set(approvals.map((approval) => approval.task.id))];
        const taskRelations = await this.taskRelationEntityRepository.find({
            where: {ChildTask: In(approvalTasksIds)},
            relations: {
                Folder: true,
                WorkFlowState: true,
                ChildTask: true,
            },
        });
        for (const approval of approvals) {
            approval.attachments = await this.getApprovalAttachments(approval.attachments);
            const folderId = taskRelations.find((relation) => relation?.ChildTask?.id == approval?.task?.id)?.Folder?.id;
            Object.assign(approval.task, {folderId});
        }

        return approvals;
    }

    /**
     * Approves an approval request.
     *
     * @param {number} approvalId - The ID of the approval request.
     * @param {CommentApprovalDto} dto - The comment approval DTO.
     * @param {JwtUserInterface} user - The user performing the approval.
     * @returns {Promise<ApprovalActionResponseDto>} - The response DTO containing the current status of the approval request.
     * @throws {BadRequestException} - If the user has already acted on the approval, the approval is not found, or the user is not allowed to approve.
     */
    @Transactional()
    async approve(approvalId: number, dto: CommentApprovalDto, user: JwtUserInterface): Promise<ApprovalActionResponseDto> {
        const approval = await this.approvalRepository.findOne({where: {id: approvalId}, relations: {task: true}});
        if (!approval) throw new BadRequestException('Approval not found');

        const approvalActions = await this.approvalActionRepository.find({
            where: {approval: {id: approvalId}, cancelled: false},
            relations: {approval: true},
        });
        if (approvalActions.find((action) => action.user == user.id)) {
            throw new BadRequestException('User has already acted on this approval');
        }
        const approvedActions = approvalActions.filter((action) => action.action == ApprovalActionOptions.APPROVE);
        if (!approval) throw new BadRequestException('Approval not found');
        const assignedApprovers = approval.assignedApprovers;

        if (!assignedApprovers.find((approver) => approver == user.id)) {
            throw new BadRequestException('User is not allowed to approve');
        }
        const approvalAction = {
            approval,
            action: ApprovalActionOptions.APPROVE,
            comment: dto.comment ?? null,
            mentionedUsers: dto.mentionedUsers ?? null,
            user: user.id,
            redirectTo: null,
            cancelled: false,
            date: new Date().toISOString(),
        };

        await this.approvalActionRepository.insert(approvalAction);
        let approvalStatus: ApprovalStatusOptions = approval.status;
        if (approvedActions.length + 1 >= approval.requiredApprovals && approvalStatus != ApprovalStatusOptions.APPROVED) {
            await this.approvalRepository.update(
                {id: approval.id},
                {status: ApprovalStatusOptions.APPROVED, resolutionDate: new Date().toISOString()}
            );
            approvalStatus = ApprovalStatusOptions.APPROVED;
        }

        // add comment to task
        const repoTaskAction = this.taskEntityRepository.manager.getRepository<TaskActionEntity>(TaskActionEntity);
        await repoTaskAction.insert({
            Task: approval.task,
            action: TaskActionOptions.APPROVE_APPROVAL,
            messageId: MessageId.APPROVE_APPROVAL,
            parameters: {approval: {status: {approved: true}}},
            task: approval.task,
            user: {id: user.id},
        });
        const recipients = (await this.notificationService.getTaskNotificationRecipients(approval.task.id)).filter(
            (x) => x !== user.id || x !== SERVICE_USER_ID
        );
        const dbUser = await this.userRepository.findOne({where: {id: user.id}});
        const {Folder} = await this.taskRelationEntityRepository.findOne({
            where: {childTaskId: approval.task.id},
            relations: {Folder: true},
        });

        let spaceId: number | null = null;
        if (Folder) {
            const [{id}] = await this.approvalRepository.query(queries.getSpaceWithFolderIdSql, [Folder.id]);
            spaceId = id || null;
        }

        runOnTransactionCommit(() => {
            this.eventEmitter.emit(TaskEventNameOptions.TASK_APPROVAL_APPROVED, {
                data: {
                    event: TaskEventNameOptions.TASK_APPROVAL_APPROVED,
                    message: this.notificationService.setNotificationMessage({
                        actions: {
                            approval: {
                                approved: true,
                            },
                        },
                        entity: 'task',
                        entityTitle: approval.task.title,
                        sender: getUserFullName(dbUser),
                    }),
                    userId: dbUser.id,
                    folderId: Folder.id,
                    taskId: approval.task.id,
                    spaceId,
                },
                userId: dbUser.id,
                recipients,
            } as EntityNotificationDto);
        });
        return {status: approvalStatus} as ApprovalActionResponseDto;
    }

    /**
     * Rejects an approval.
     *
     * @param {number} approvalId - The ID of the approval to reject.
     * @param {CommentApprovalDto} dto - The comment and mentioned users for the rejection.
     * @param {JwtUserInterface} user - The user performing the rejection action.
     *
     * @returns {Promise<ApprovalActionResponseDto>} A Promise that resolves to the response of the rejection action.
     *
     * @throws {BadRequestException} If the user has already acted on this approval, the approval is not found, or the user is not allowed to approve or reject.
     */
    @Transactional()
    async reject(approvalId: number, dto: CommentApprovalDto, user: JwtUserInterface): Promise<ApprovalActionResponseDto> {
        const approval = await this.approvalRepository.findOne({where: {id: approvalId}, relations: {task: true}});
        if (!approval) throw new BadRequestException('Approval not found');

        const approvalActions = await this.approvalActionRepository.find({
            where: {approval: {id: approvalId}, cancelled: false},
            relations: {approval: true},
        });
        if (approvalActions.find((action) => action.user == user.id)) {
            throw new BadRequestException('User has already acted on this approval');
        }
        if (!approval) throw new BadRequestException('Approval not found');
        const assignedApprovers = approval.assignedApprovers;

        if (!assignedApprovers.find((approver) => approver == user.id)) {
            throw new BadRequestException('User is not allowed to approve or reject');
        }
        const approvalAction = {
            approval,
            action: ApprovalActionOptions.REJECT,
            comment: dto.comment ?? null,
            mentionedUsers: dto.mentionedUsers ?? null,
            user: user.id,
            redirectTo: null,
            cancelled: false,
            date: new Date().toISOString(),
        };

        await this.approvalActionRepository.insert(approvalAction);
        let approvalStatus: ApprovalStatusOptions = approval.status;
        //Sets the rejected status when ONLY ONE user rejects it
        if (approvalStatus != ApprovalStatusOptions.REJECTED) {
            await this.approvalRepository.update(
                {id: approval.id},
                {status: ApprovalStatusOptions.REJECTED, resolutionDate: new Date().toISOString()}
            );
            approvalStatus = ApprovalStatusOptions.REJECTED;
        }

        // add comment to task
        const repoTaskAction = this.taskEntityRepository.manager.getRepository<TaskActionEntity>(TaskActionEntity);
        await repoTaskAction.insert({
            Task: approval.task,
            action: TaskActionOptions.REJECT_APPROVAL,
            messageId: MessageId.REJECT_APPROVAL,
            parameters: {approval: {status: {approved: false}}},
            task: approval.task,
            user: {id: user.id},
        });
        const recipients = (await this.notificationService.getTaskNotificationRecipients(approval.task.id)).filter(
            (x) => x !== user.id || x !== SERVICE_USER_ID
        );
        const dbUser = await this.userRepository.findOne({where: {id: user.id}});
        const {Folder} = await this.taskRelationEntityRepository.findOne({
            where: {childTaskId: approval.task.id},
            relations: {Folder: true},
        });

        let spaceId: number | null = null;
        if (Folder) {
            const [{id}] = await this.approvalRepository.query(queries.getSpaceWithFolderIdSql, [Folder.id]);
            spaceId = id || null;
        }
        runOnTransactionCommit(() => {
            this.eventEmitter.emit(TaskEventNameOptions.TASK_APPROVAL_REJECTED, {
                data: {
                    event: TaskEventNameOptions.TASK_APPROVAL_REJECTED,
                    message: this.notificationService.setNotificationMessage({
                        actions: {
                            approval: {
                                approved: true,
                            },
                        },
                        entity: 'task',
                        entityTitle: approval.task.title,
                        sender: getUserFullName(dbUser),
                    }),
                    userId: dbUser.id,
                    folderId: Folder.id,
                    taskId: approval.task.id,
                    spaceId,
                },
                userId: dbUser.id,
                recipients,
            } as EntityNotificationDto);
        });
        return {status: approvalStatus} as ApprovalActionResponseDto;
    }

    /**
     * Cancels an approval action.
     *
     * @param {number} approvalId - The ID of the approval to be cancelled.
     * @param {JwtUserInterface} user - The user performing the cancellation.
     *
     * @returns {Promise<ApprovalActionResponseDto>} - The response containing the status of the approval after cancellation.
     */
    @Transactional()
    async cancelApproval(approvalId: number, user: JwtUserInterface): Promise<ApprovalActionResponseDto> {
        const approval = await this.approvalRepository.findOne({where: {id: approvalId}, relations: {task: true}});
        if (!approval) throw new BadRequestException('Approval not found');

        if (!approval) throw new BadRequestException('Approval not found');
        const assignedApprovers = approval.assignedApprovers;

        if (!assignedApprovers.find((approver) => approver == user.id)) {
            throw new BadRequestException('User is not allowed to approve or reject');
        }
        const approvalActions = await this.approvalActionRepository.find({
            where: {approval: {id: approvalId}, cancelled: false, action: ApprovalActionOptions.APPROVE},
            relations: {approval: true},
        });
        const userAction = await this.approvalActionRepository.findOne({
            where: {approval: {id: approvalId}, user: user.id, cancelled: false},
            relations: {approval: true},
        });

        let approvalStatus: ApprovalStatusOptions = approval.status;
        //Check if approval was in rejected state and then change it back to PENDING
        if (approvalStatus == ApprovalStatusOptions.REJECTED) {
            await this.approvalRepository.update(
                {id: approval.id},
                {
                    status: ApprovalStatusOptions.PENDING,
                    resolutionDate: null,
                }
            );
            approvalStatus = ApprovalStatusOptions.PENDING;
        }
        //Check amount of approvals required and if the total number of approve actions drop below, change the status to PENDING
        if (approvalActions.length - 1 < approval.requiredApprovals && approvalStatus == ApprovalStatusOptions.APPROVED) {
            await this.approvalRepository.update(
                {id: approval.id},
                {
                    status: ApprovalStatusOptions.PENDING,
                    resolutionDate: null,
                }
            );
            approvalStatus = ApprovalStatusOptions.PENDING;
        }
        //Cancel user action
        await this.approvalActionRepository.update({id: userAction.id}, {cancelled: true});

        // add comment to task
        const repoTaskAction = this.taskEntityRepository.manager.getRepository<TaskActionEntity>(TaskActionEntity);
        await repoTaskAction.insert({
            Task: approval.task,
            action: TaskActionOptions.CANCEL_APPROVAL,
            messageId: MessageId.CANCEL_APPROVAL,
            parameters: {approval: {status: {approved: false}}},
            task: approval.task,
            user: {id: user.id},
        });

        return {status: approvalStatus} as ApprovalActionResponseDto;
    }

    /**
     * Retrieves the approval history for the specified approval ID.
     *
     * @param {number} approvalId - The ID of the approval.
     * @return {Promise<ApprovalActionEntity[]>} A promise that resolves to an array of ApprovalActionEntity objects representing the approval history.
     */
    async getApprovalHistory(approvalId: number): Promise<ApprovalActionEntity[]> {
        return await this.approvalActionRepository.find({
            where: {approval: {id: approvalId}},
            relations: {approval: true},
        });
    }

    /**
     * Update an approval with the provided details.
     *
     * @param {number} approvalId - The ID of the approval to update.
     * @param {UpdateApprovalDto} updateApprovalDto - The data to update the approval with.
     * @param {JwtUserInterface} user - The user performing the update.
     *
     * @returns {Promise<ApprovalEntity>} - The updated approval.
     */
    @Transactional()
    async update(approvalId: number, updateApprovalDto: UpdateApprovalDto, user: JwtUserInterface): Promise<ApprovalEntity> {
        //Validate creator user and then update description, required amount of approvals and assigned approvers
        const approval = await this.approvalRepository.findOne({where: {id: approvalId}, relations: {task: true}});
        if (!approval) throw new BadRequestException('Approval not found');

        const {description, requiredApprovals, assignedApprovers} = updateApprovalDto;

        await this.approvalRepository.update({id: approval.id}, {description, requiredApprovals, assignedApprovers});
        await this.approvalActionRepository.insert({
            approval,
            action: ApprovalActionOptions.UPDATE,
            comment: null,
            mentionedUsers: null,
            user: user.id,
            cancelled: false,
            redirectTo: assignedApprovers,
            date: new Date().toISOString(),
        });

        // add comment to task
        const repoTaskAction = this.taskEntityRepository.manager.getRepository<TaskActionEntity>(TaskActionEntity);
        await repoTaskAction.insert({
            Task: approval.task,
            action: TaskActionOptions.UPDATE_APPROVAL,
            messageId: MessageId.UPDATE_APPROVAL,
            parameters: {approval: {status: {approved: false}}},
            task: approval.task,
            user: {id: user.id},
        });
        const recipients = (await this.notificationService.getTaskNotificationRecipients(approval.task.id)).filter(
            (x) => x !== user.id || x !== SERVICE_USER_ID
        );
        const dbUser = await this.userRepository.findOne({where: {id: user.id}});
        const {Folder} = await this.taskRelationEntityRepository.findOne({
            where: {childTaskId: approval.task.id},
            relations: {Folder: true},
        });

        let spaceId: number | null = null;
        if (Folder) {
            const [{id}] = await this.approvalRepository.query(queries.getSpaceWithFolderIdSql, [Folder.id]);
            spaceId = id || null;
        }
        runOnTransactionCommit(() => {
            this.eventEmitter.emit(TaskEventNameOptions.TASK_APPROVAL_UPDATED, {
                data: {
                    event: TaskEventNameOptions.TASK_APPROVAL_UPDATED,
                    message: this.notificationService.setNotificationMessage({
                        actions: {
                            approval: {
                                updated: true,
                            },
                        },
                        entity: 'task',
                        entityTitle: approval.task.title,
                        sender: getUserFullName(dbUser),
                    }),
                    userId: dbUser.id,
                    folderId: Folder.id,
                    taskId: approval.task.id,
                    spaceId,
                },
                userId: dbUser.id,
                recipients,
            } as EntityNotificationDto);
        });
        return {...approval, description, requiredApprovals};
    }

    /**
     * Deletes an approval and logs the deletion action.
     *
     * @param {number} approvalId - The ID of the approval to delete.
     * @param {JwtUserInterface} user - The user who is performing the deletion.
     *
     * @throws {BadRequestException} If the approval is not found.
     *
     * @returns {Promise<void>}
     */
    @Transactional()
    async delete(approvalId: number, user: JwtUserInterface): Promise<void> {
        const approval = await this.approvalRepository.findOne({where: {id: approvalId}, relations: {task: true}});
        if (!approval) throw new BadRequestException('Approval not found');

        await this.approvalRepository.softRemove(approval);
        await this.approvalActionRepository.insert({
            approval,
            action: ApprovalActionOptions.DELETE,
            comment: null,
            mentionedUsers: null,
            user: user.id,
            cancelled: false,
            redirectTo: null,
            date: new Date().toISOString(),
        });

        // add comment to task
        const repoTaskAction = this.taskEntityRepository.manager.getRepository<TaskActionEntity>(TaskActionEntity);
        await repoTaskAction.insert({
            Task: approval.task,
            action: TaskActionOptions.DELETE_APPROVAL,
            messageId: MessageId.DELETE_APPROVAL,
            parameters: {approval: {status: {approved: false}}},
            task: approval.task,
            user: {id: user.id},
        });
        const recipients = (await this.notificationService.getTaskNotificationRecipients(approval.task.id)).filter(
            (x) => x !== user.id || x !== SERVICE_USER_ID
        );
        const dbUser = await this.userRepository.findOne({where: {id: user.id}});
        const {Folder} = await this.taskRelationEntityRepository.findOne({
            where: {childTaskId: approval.task.id},
            relations: {Folder: true},
        });

        let spaceId: number | null = null;
        if (Folder) {
            const [{id}] = await this.approvalRepository.query(queries.getSpaceWithFolderIdSql, [Folder.id]);
            spaceId = id || null;
        }
        runOnTransactionCommit(() => {
            this.eventEmitter.emit(TaskEventNameOptions.TASK_APPROVAL_DELETED, {
                data: {
                    event: TaskEventNameOptions.TASK_APPROVAL_DELETED,
                    message: this.notificationService.setNotificationMessage({
                        actions: {
                            approval: {
                                deleted: true,
                            },
                        },
                        entity: 'task',
                        entityTitle: approval.task.title,
                        sender: getUserFullName(dbUser),
                    }),
                    userId: dbUser.id,
                    folderId: Folder.id,
                    taskId: approval.task.id,
                    spaceId,
                },
                userId: dbUser.id,
                recipients,
            } as EntityNotificationDto);
        });
    }

    /**
     * Route the approval to the specified users.
     *
     * @param {number} approvalId - The ID of the approval.
     * @param {RouteToUsersDto} dto - The data transfer object containing information about the routing.
     * @param {JwtUserInterface} user - The authenticated user who is performing the routing.
     *
     * @returns {Promise<ApprovalEntity>} - The updated approval entity after routing.
     *
     * @throws {BadRequestException} - If the approval is not found or the user has already acted on this approval.
     *
     * @Transactional - Marks the method as transactional, ensuring all database operations are executed within a single transaction.
     */
    @Transactional()
    async routeToUsers(approvalId: number, dto: RouteToUsersDto, user: JwtUserInterface): Promise<ApprovalEntity> {
        const approval = await this.approvalRepository.findOne({where: {id: approvalId}, relations: {task: true}});
        if (!approval) throw new BadRequestException('Approval not found');

        const approvalActions = await this.approvalActionRepository.find({
            where: {approval: {id: approvalId}, cancelled: false},
            relations: {approval: true},
        });
        if (approvalActions.find((action) => action.user == user.id)) {
            throw new BadRequestException('User has already acted on this approval');
        }
        const assignedApprovers = approval.assignedApprovers;
        const newApprovers = [];
        for (const user of dto.userIds) {
            if (!assignedApprovers.find((approver) => approver === user)) {
                newApprovers.push(user);
                assignedApprovers.push(user);
            }
        }

        await this.approvalRepository.update({id: approval.id}, {assignedApprovers});

        await this.approvalActionRepository.insert({
            approval,
            action: ApprovalActionOptions.REDIRECT,
            comment: dto.comment ?? null,
            mentionedUsers: dto.mentionedUsers ?? null,
            user: user.id,
            cancelled: false,
            redirectTo: newApprovers,
            date: new Date().toISOString(),
        });

        // add comment to task
        const repoTaskAction = this.taskEntityRepository.manager.getRepository<TaskActionEntity>(TaskActionEntity);
        await repoTaskAction.insert({
            Task: approval.task,
            action: TaskActionOptions.ROUTED_APPROVAL,
            messageId: MessageId.ROUTED_APPROVAL,
            parameters: {approval: {status: {approved: false}}},
            task: approval.task,
            user: {id: user.id},
        });
        const recipients = (await this.notificationService.getTaskNotificationRecipients(approval.task.id)).filter(
            (x) => x !== user.id || x !== SERVICE_USER_ID
        );
        const dbUser = await this.userRepository.findOne({where: {id: user.id}});
        const {Folder} = await this.taskRelationEntityRepository.findOne({
            where: {childTaskId: approval.task.id},
            relations: {Folder: true},
        });

        let spaceId: number | null = null;
        if (Folder) {
            const [{id}] = await this.approvalRepository.query(queries.getSpaceWithFolderIdSql, [Folder.id]);
            spaceId = id || null;
        }
        runOnTransactionCommit(() => {
            this.eventEmitter.emit(TaskEventNameOptions.TASK_APPROVAL_REROUTED, {
                data: {
                    event: TaskEventNameOptions.TASK_APPROVAL_REROUTED,
                    message: this.notificationService.setNotificationMessage({
                        actions: {
                            approval: {
                                rerouted: true,
                            },
                        },
                        entity: 'task',
                        entityTitle: approval.task.title,
                        sender: getUserFullName(dbUser),
                    }),
                    userId: dbUser.id,
                    folderId: Folder.id,
                    taskId: approval.task.id,
                    spaceId,
                },
                userId: dbUser.id,
                recipients,
            } as EntityNotificationDto);
        });
        return {...approval, assignedApprovers};
    }

    /**
     * Get signed file URLs for approval attachments.
     *
     * @param {ApprovalAttachmentEntity[]} approvalAttachments - The approval attachments to get signed file URLs for.
     * @returns {Promise<ApprovalAttachmentEntity[]>} - A promise that resolves with the approval attachments with signed file URLs.
     *
     * @async
     */
    async getApprovalAttachments(approvalAttachments: ApprovalAttachmentEntity[]): Promise<ApprovalAttachmentEntity[]> {
        const response: ApprovalAttachmentEntity[] = [];
        for (const attachment of approvalAttachments) {
            const fileNameUrl = await this.s3Service.getSignedFileUrl(attachment.fileName, {expiresIn: 3600});
            const thumbnailUrl = await this.s3Service.getSignedFileUrl(attachment.thumbnailName, {expiresIn: 3600});

            Object.assign(attachment, {fileNameUrl, thumbnailUrl});
            response.push(attachment);
        }

        return response;
    }

    /**
     * Purge orphan files from S3.
     *
     * @returns {Promise<void>} A Promise that resolves when the orphan files are purged.
     * @Cron(CronExpression.EVERY_DAY_AT_3AM)
     * @async
     */
    @Cron(CronExpression.EVERY_DAY_AT_3AM)
    async purgeS3OrphanFiles(): Promise<void> {
        await this.purgeS3OrphanFilesEx(this.APPROVAL_FILE_S3_DIR);
        await this.purgeS3OrphanFilesEx(this.APPROVAL_FILE_THUMBNAIL_S3_DIR);
    }

    /**
     * Purges orphan files from S3.
     *
     * @param {string} prefix - The prefix used to filter the files in S3.
     *
     * @return {Promise<void>} - A Promise that resolves once the orphan files have been purged.
     *                           If any error occurs, the Promise will be rejected with the error.
     */
    async purgeS3OrphanFilesEx(prefix: string): Promise<void> {
        try {
            let nextContinuationToken = null;
            while (true) {
                this.logger.debug(`Fetching S3 files with prefix ${prefix} ...`);
                const s3Files = await this.s3Service.listObjects(prefix, nextContinuationToken);
                if (s3Files.KeyCount === 0) {
                    this.logger.debug(`No files to process from S3 with prefix: ${prefix}`);
                    return;
                }
                this.logger.debug(`Fetched ${s3Files.Contents.length} files from S3.`);
                const files = s3Files.Contents.map((x) => x.Key);
                this.logger.debug('Fetching approval attachment entities...');
                const approvalAttachmentEntities = await this.approvalAttachmentRepository.find({
                        where: [{fileName: In(files)}, {thumbnailName: In(files)}],
                    }),
                    s3FilesToDelete = s3Files.Contents.filter(
                        (x) => !approvalAttachmentEntities.find((z) => z.fileName === x.Key || z.thumbnailName === x.Key)
                    );
                this.logger.debug(`Found ${s3FilesToDelete.length} files to delete.`);
                for (const object of s3FilesToDelete) {
                    this.logger.debug(`Deleting file: ${object.Key}`);
                    await this.s3Service.deleteFile(object.Key);
                    this.logger.debug(`Deleted file: ${object.Key}`);
                }
                nextContinuationToken = s3Files.NextContinuationToken;
                if (!nextContinuationToken) {
                    this.logger.debug('No more continuation tokens. Breaking the loop.');
                    break;
                }
            }
        } catch (error) {
            this.logger.log({level: 'error', message: 'There was an error purging orphan files:' + error, error});
        }
    }
}
