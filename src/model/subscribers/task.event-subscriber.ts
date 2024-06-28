import {Injectable, InternalServerErrorException, Logger} from '@nestjs/common';
import {AppIndexesOptions, SearchDocumentOptions} from '@plexxis/eureka-api';
import {Connection, EntitySubscriberInterface, InsertEvent, RemoveEvent, UpdateEvent} from 'typeorm';
import {runOnTransactionCommit} from 'typeorm-transactional';
import {SearchService} from '../../module/search/search.service';
import {TaskEntity} from '../task.entity';

@Injectable()
export class TaskEntitySubscriber implements EntitySubscriberInterface<TaskEntity> {
    private readonly logger = new Logger(TaskEntitySubscriber.name);

    constructor(private readonly connection: Connection, private readonly searchService: SearchService) {
        connection.subscribers.push(this);
    }

    listenTo(): typeof TaskEntity {
        return TaskEntity;
    }

    afterInsert(event: InsertEvent<TaskEntity>): void {
        runOnTransactionCommit(async () => {
            this.logger.verbose('Sending insert task event to Eureka');
            await this.searchService.sendMessage({
                documentType: AppIndexesOptions.TaskManagementTask,
                operation: SearchDocumentOptions.upsert,
                recordId: parseInt(String(event.entityId)),
            });
        });
    }

    beforeUpdate(event: UpdateEvent<TaskEntity>): void {
        if (!event.entity.id) {
            throw new InternalServerErrorException('Missing id field on task update');
        }
        runOnTransactionCommit(async () => {
            this.logger.verbose('Sending update task event to Eureka');
            await this.searchService.sendMessage({
                documentType: AppIndexesOptions.TaskManagementTask,
                operation: event.entity.deletedAt ? SearchDocumentOptions.delete : SearchDocumentOptions.upsert,
                recordId: event.entity.id,
            });
        });
    }

    beforeRemove(event: RemoveEvent<TaskEntity>): void {
        if (!event.entityId) {
            throw new InternalServerErrorException('Missing id field on task delete');
        }
        const entityId = event.entityId;
        runOnTransactionCommit(async () => {
            this.logger.verbose('Sending delete task event to Eureka');
            await this.searchService.sendMessage({
                documentType: AppIndexesOptions.TaskManagementTask,
                operation: SearchDocumentOptions.delete,
                recordId: entityId,
            });
        });
    }
}
