import {Inject, Injectable, NotFoundException} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {contructorLogger, JwtUserInterface, S3Service} from '@lib/base-library';
import {Transactional} from 'typeorm-transactional';
import {TaskAttachmentBaseService} from './task-attachment-base.service';
import {TaskAttachmentEntity} from '../../../model/task-attachment.entity';
import {EventEmitter2} from '@nestjs/event-emitter';
import {NotificationService} from '../../notification/notification.service';

@Injectable()
export class TaskAttachmentService extends TaskAttachmentBaseService {
    constructor(
        @InjectRepository(TaskAttachmentEntity) protected readonly repo: Repository<TaskAttachmentEntity>,
        protected readonly s3Service: S3Service,
        @Inject(EventEmitter2) protected eventEmitter: EventEmitter2,
        protected notificationService: NotificationService
    ) {
        super(repo, s3Service, eventEmitter, notificationService);
        contructorLogger(this);
    }

    //TO-DO : Add return types
    @Transactional()
    async deleteTaskAttachment(id: number, userId: string): Promise<TaskAttachmentEntity> {
        //** Check if user have permissions to delete a task attachment */
        try {
            const taskAttachmentDB = await this.repo.findOne({where: {id}});
            if (!taskAttachmentDB) {
                throw new NotFoundException(`Task Attachment with id : ${id} not found`);
            }
            return await super.deleteTaskAttachment(id, userId);
        } catch (e) {
            this.logger.error(`There was an error deleting task attachment ${id}`, JSON.stringify(e));
            throw e;
        }
    }

    // TODO : Add return types
    @Transactional()
    async getManyTaskAttachment(taskId: number, user: JwtUserInterface): Promise<unknown> {
        //** Check if user have permissions to get a task attachments */
        try {
            return await super.getTaskAttachments(taskId, user.id);
        } catch (e) {
            this.logger.error(`There was an error getting task attachments ${taskId}`, JSON.stringify(e));
            throw e;
        }
    }
}
