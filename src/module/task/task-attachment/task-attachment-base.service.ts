import {Inject, Injectable, Logger, NotFoundException} from '@nestjs/common';
import {In, Repository} from 'typeorm';
import {contructorLogger, formatBytes, getUserFullName, JwtUserInterface, S3Service} from '@lib/base-library';
import {format} from 'date-fns';
import {Cron, CronExpression} from '@nestjs/schedule';
import {runOnTransactionCommit, Transactional} from 'typeorm-transactional';
import {TaskAttachmentEntity} from '../../../model/task-attachment.entity';
import {TaskEntity} from '../../../model/task.entity';
import {TaskActionEntity} from '../../../model/task-action.entity';
import {readFileType} from '../../../utils/helpers';
import {TaskActionOptions} from '../../../enum/task-action.enum';
import {MessageId} from '../../../enum/message-id.enum';
import {EventEmitter2} from '@nestjs/event-emitter';
import {EntityNotificationDto} from '../../../dto/events/entity-notification.dto';
import {TaskEventNameOptions} from '../../../enum/notification-event.enum';
import {TaskRelationEntity} from '../../../model/task-relation.entity';
import {NotificationService} from '../../notification/notification.service';
import {UserEntity} from '../../../model/user.entity';
import {queries} from '../../../recursive-queries';

@Injectable()
export class TaskAttachmentBaseService {
    protected logger: Logger;
    private readonly DOCS = 'docs';
    private readonly THUMBNAILS = 'thumbnails';
    constructor(
        protected readonly repo: Repository<TaskAttachmentEntity>,
        protected readonly s3Service: S3Service,
        @Inject(EventEmitter2) protected eventEmitter: EventEmitter2,
        protected notificationService: NotificationService
    ) {
        this.logger = new Logger(this.constructor.name);
        contructorLogger(this);
    }

    // async getOne(id: number): Promise<TaskAttachmentEntity> {
    //     try {
    //         const ret = await this.repo.findOne({where: {id}});
    //         ret['fileNameUrl'] = await this.s3Service.getSignedFileUrl(ret['file_name'], {expiresIn: 3600});
    //         ret['thumbnailUrl'] = await this.s3Service.getSignedFileUrl(ret['thumbnail_name'], {expiresIn: 3600});
    //         return ret;
    //     } catch (e) {
    //         this.logger.error(`There was an error getting task attachment`, JSON.stringify(e));
    //         throw e;
    //     }
    // }

    // async getMany(): Promise<TaskAttachmentEntity | TaskAttachmentEntity[]> {
    //     try {
    //         const ret = await this.repo.find();
    //         for (const datum of ret) {
    //             datum['fileNameUrl'] = await this.s3Service.getSignedFileUrl(datum['file_name'], {expiresIn: 3600});
    //             datum['thumbnailUrl'] = await this.s3Service.getSignedFileUrl(datum['thumbnail_name'], {expiresIn: 3600});
    //         }
    //         return ret;
    //     } catch (e) {
    //         this.logger.error(`There was an error getting task attachments `, JSON.stringify(e));
    //         throw e;
    //     }
    // }

    //TO-DO : Add return types
    @Transactional()
    async deleteTaskAttachment(id: number, userId: string): Promise<TaskAttachmentEntity> {
        const {Task} = await this.repo.findOne({where: {id}, relations: {Task: true}});
        const {folderId} = await this.repo.manager.getRepository(TaskRelationEntity).findOne({where: {ChildTask: {id: Task.id}}});
        const [{id: spaceId = null}] = await this.repo.query(queries.getSpaceWithFolderIdSql, [folderId]);
        const result = await this.deleteTaskAttachmentEx(id, userId);
        const user = await this.repo.manager.getRepository(UserEntity).findOne({where: {id: userId}});
        runOnTransactionCommit(() => {
            this.eventEmitter.emit(TaskEventNameOptions.TASK_DEL_ATTACH, <EntityNotificationDto>{
                userId: userId,
                data: {
                    event: TaskEventNameOptions.TASK_DEL_ATTACH,
                    taskId: Task.id,
                    folderId,
                    spaceId,
                    userId,
                    message: this.notificationService.setNotificationMessage({
                        entity: 'task',
                        entityTitle: Task.title,
                        actions: {
                            attachment: {
                                deleted: true,
                            },
                        },
                        sender: getUserFullName(user),
                    }),
                },
                recipients: [],
            });
        });
        return result;
    }

    //TO-DO : Add return types
    @Transactional()
    async deleteTaskAttachmentEx(id: number, _userId: string): Promise<TaskAttachmentEntity> {
        const repoTaskAttachment = this.repo.manager.getRepository<TaskAttachmentEntity>(TaskAttachmentEntity),
            taskAttachmentDB = await repoTaskAttachment.findOne({where: {id}, relations: {Task: true}});
        if (taskAttachmentDB) {
            await this.s3Service.deleteFile(taskAttachmentDB.fileName);
            await this.s3Service.deleteFile(taskAttachmentDB.thumbnailName);
            return await repoTaskAttachment.remove(taskAttachmentDB);
        }
        throw new NotFoundException();
    }

    // TODO : Add s3 bucket configrations
    @Transactional()
    async uploadFiles(id: number, files: Array<Express.Multer.File>, user: JwtUserInterface): Promise<unknown> {
        let fileOnS3: string = null,
            thumbnailOnS3: string = null;
        const manager = this.repo.manager;
        try {
            const ret = [],
                repoTask = manager.getRepository<TaskEntity>(TaskEntity),
                repoTaskAction = manager.getRepository<TaskActionEntity>(TaskActionEntity),
                repoTaskAttachment = manager.getRepository<TaskAttachmentEntity>(TaskAttachmentEntity),
                repoTaskRelation = this.repo.manager.getRepository(TaskRelationEntity);
            const taskDB = await repoTask.findOneOrFail({where: {id}});
            for (const file of files) {
                // normalize file name
                file.originalname = file.originalname.replace(this.s3Service.NORMALIZE_S3_KEY_REPLACE_PLUS, ' ');
                const {thumbnail, predefinedThumbnail} = await this.s3Service.createThumbnail(file.buffer, file.originalname);
                const baseFilename = `${format(new Date(), 'yyyyMMddHHmmssSSS')}-${file.originalname.toLocaleLowerCase()}`;
                fileOnS3 = `${this.DOCS}/${baseFilename}`;
                await this.s3Service.uploadFile(file.buffer, fileOnS3);
                if (thumbnail) {
                    thumbnailOnS3 = `${this.THUMBNAILS}/${baseFilename}`;
                    await this.s3Service.uploadFile(thumbnail, thumbnailOnS3);
                }
                const fileType = readFileType(file);
                const attachment = await repoTaskAttachment.save({
                    Task: {id: taskDB.id},
                    originalName: file.originalname,
                    fileName: fileOnS3,
                    thumbnailName: thumbnail ? thumbnailOnS3 : predefinedThumbnail,
                    fileSize: formatBytes(file.size),
                    addedBy: user.id,
                    lastSeenBy: user.id,
                    lastSeenAt: new Date(),
                    fileType: fileType,
                });

                await repoTaskAction.insert({
                    Task: taskDB,
                    task: taskDB,
                    action: TaskActionOptions.ADD_ATTACH,
                    messageId: MessageId.ADD_ATTACH_TASK,
                    parameters: {attachment: file.originalname},
                    user: {id: user.id},
                });

                const fileNameUrl = await this.s3Service.getSignedFileUrl(fileOnS3, {expiresIn: 3600});
                const thumbnailUrl = await this.s3Service.getSignedFileUrl(attachment.thumbnailName, {expiresIn: 3600});
                ret.push({...attachment, fileNameUrl, thumbnailUrl});
            }
            const taskRelation = await repoTaskRelation.findOne({where: {childTaskId: taskDB.id}});
            const [{id: spaceId}] = await this.repo.query(queries.getSpaceWithFolderIdSql, [taskRelation.folderId]);

            const recipients = await this.notificationService.getTaskNotificationRecipients(id);
            const emailDto = await this.notificationService.setTaskEmailDto(id, user, [], TaskActionOptions.ADD_ATTACH, null);
            runOnTransactionCommit(() => {
                this.eventEmitter.emit(TaskEventNameOptions.TASK_ADD_ATTACH, <EntityNotificationDto>{
                    userId: user.id,

                    data: {
                        event: TaskEventNameOptions.TASK_ADD_ATTACH,
                        taskId: id,
                        folderId: taskRelation.folderId,
                        spaceId,
                        userId: user.id,
                        ...emailDto,
                        message: this.notificationService.setNotificationMessage({
                            entity: 'task',
                            entityTitle: taskDB.title,
                            actions: {
                                attachment: {
                                    added: true,
                                },
                            },
                            sender: getUserFullName(user),
                        }),
                    },
                    recipients,
                });
            });

            return ret;
        } catch (e) {
            if (fileOnS3) {
                try {
                    await this.s3Service.deleteFile(fileOnS3);
                } catch (e) {
                    this.logger.error(`There was an error deleting ${fileOnS3} on S3`, JSON.stringify(e));
                }
            }
            if (thumbnailOnS3) {
                try {
                    await this.s3Service.deleteFile(thumbnailOnS3);
                } catch (e) {
                    this.logger.error(`There was an error deleting ${thumbnailOnS3} on S3`, JSON.stringify(e));
                }
            }
            this.logger.error(`There was an error uploading ${files.length} files of task ${id}`, JSON.stringify(e));
            throw e;
        }
    }

    @Transactional()
    async deleteTaskAttachmentsByTaskId(taskId: number, userId: string): Promise<void> {
        const manager = this.repo.manager;
        const repoTaskAttachment = manager.getRepository<TaskAttachmentEntity>(TaskAttachmentEntity),
            attachments = await repoTaskAttachment.find({where: {Task: {id: taskId}}}),
            repoTaskAction = manager.getRepository<TaskActionEntity>(TaskActionEntity);
        for (const attachment of attachments) {
            await this.deleteTaskAttachmentEx(attachment.id, userId);
            await repoTaskAction.insert({
                Task: {id: taskId},
                action: TaskActionOptions.DEL_ATTACH,
                messageId: MessageId.DEL_ATTACH_TASK,
                parameters: {attachment: attachment.originalName},
                user: {id: userId},
            });
        }
    }

    // TODO : Add return types
    async getTaskAttachments(
        taskId: number,
        userId: string
    ): Promise<Partial<TaskAttachmentEntity> & {fileNameUrl: string; thumbnailUrl: string}[]> {
        const ret = await this.repo.find({
            select: {
                id: true,
                fileName: true,
                thumbnailName: true,
                originalName: true,
                fileType: true,
                fileSize: true,
                addedAt: true,
                lastSeenAt: true,
            },
            where: {
                Task: {id: taskId},
            },
        });
        for (const datum of ret) {
            datum['fileNameUrl'] = await this.s3Service.getSignedFileUrl(datum.fileName, {expiresIn: 3600});
            datum['thumbnailUrl'] = await this.s3Service.getSignedFileUrl(datum.thumbnailName, {expiresIn: 3600});
            await this.repo.update(datum.id, {lastSeenBy: userId, lastSeenAt: new Date(), id: datum.id});
        }
        return ret as (Partial<TaskAttachmentEntity> & {fileNameUrl: string; thumbnailUrl: string})[];
    }

    @Cron(CronExpression.EVERY_DAY_AT_3AM)
    @Transactional()
    async purgeS3OrphanFiles(): Promise<void> {
        this.logger.log(`Purging S3 orphan files`);
        await this.purgeS3OrphanFilesEx(this.DOCS);
        await this.purgeS3OrphanFilesEx(this.THUMBNAILS);
        this.logger.log(`Purging S3 orphan files ended`);
    }

    // TODO :  add return types
    @Transactional()
    async purgeS3OrphanFilesEx(prefix: string): Promise<void> {
        try {
            let nextContinuationToken = null;
            while (true) {
                const s3Files = await this.s3Service.listObjects(prefix, nextContinuationToken),
                    files = s3Files.Contents.map((x) => x.Key),
                    taskAttachmentEntities = await this.repo.find({
                        where: [{fileName: In(files)}, {thumbnailName: In(files)}],
                    }),
                    s3FilesToDelete = s3Files.Contents.filter(
                        (x) => !taskAttachmentEntities.find((z) => z.fileName === x.Key || z.thumbnailName === x.Key)
                    );
                for (const object of s3FilesToDelete) {
                    this.logger.log(`Deleting ${object.Key} orphan file`);
                    await this.s3Service.deleteFile(object.Key);
                }
                nextContinuationToken = s3Files.NextContinuationToken;
                if (!nextContinuationToken) {
                    break;
                }
            }
        } catch (e) {
            this.logger.log({level: 'error', message: `There was an error purging orphan files`, error: e});
        }
    }
}
