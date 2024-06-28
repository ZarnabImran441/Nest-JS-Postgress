import {Injectable, InternalServerErrorException, Logger} from '@nestjs/common';
import {AppIndexesOptions, SearchDocumentOptions} from '@plexxis/eureka-api';
import {Connection, EntitySubscriberInterface, InsertEvent, RemoveEvent, UpdateEvent} from 'typeorm';
import {runOnTransactionCommit} from 'typeorm-transactional';
import {SearchService} from '../../module/search/search.service';
import {TaskAttachmentEntity} from '../task-attachment.entity';

@Injectable()
export class TaskAttachmentEntitySubscriber implements EntitySubscriberInterface<TaskAttachmentEntity> {
    private readonly logger = new Logger(TaskAttachmentEntitySubscriber.name);

    constructor(private readonly connection: Connection, private readonly searchService: SearchService) {
        connection.subscribers.push(this);
    }

    listenTo(): typeof TaskAttachmentEntity {
        return TaskAttachmentEntity;
    }

    afterInsert(event: InsertEvent<TaskAttachmentEntity>): void {
        runOnTransactionCommit(async () => {
            this.logger.verbose('Sending insert task attachment event to Eureka');
            await this.searchService.sendMessage({
                documentType: AppIndexesOptions.TaskManagementTaskAttachment,
                operation: SearchDocumentOptions.upsert,
                recordId: parseInt(String(event.entityId)),
            });
        });
    }

    afterUpdate(event: UpdateEvent<TaskAttachmentEntity>): void {
        if (!event.entity.id) {
            throw new InternalServerErrorException('Missing id field on task attachment update');
        }
        runOnTransactionCommit(async () => {
            this.logger.verbose('Sending update task attachment event to Eureka');
            await this.searchService.sendMessage({
                documentType: AppIndexesOptions.TaskManagementTaskAttachment,
                operation: SearchDocumentOptions.upsert,
                recordId: event.entity.id,
            });
        });
    }

    beforeRemove(event: RemoveEvent<TaskAttachmentEntity>): void {
        if (!event.entityId) {
            throw new InternalServerErrorException('Missing id field on task attachment delete');
        }
        const entityId = event.entityId;
        runOnTransactionCommit(async () => {
            this.logger.verbose('Sending delete task attachment event to Eureka');
            await this.searchService.sendMessage({
                documentType: AppIndexesOptions.TaskManagementTaskAttachment,
                operation: SearchDocumentOptions.delete,
                recordId: entityId,
            });
        });
    }
}
