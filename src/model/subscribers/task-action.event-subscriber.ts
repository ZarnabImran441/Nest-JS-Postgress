import {Injectable, InternalServerErrorException, Logger} from '@nestjs/common';
import {AppIndexesOptions, SearchDocumentOptions} from '@plexxis/eureka-api';
import {Connection, EntitySubscriberInterface, InsertEvent, RemoveEvent, UpdateEvent} from 'typeorm';
import {runOnTransactionCommit} from 'typeorm-transactional';
import {SearchService} from '../../module/search/search.service';
import {TaskActionEntity} from '../task-action.entity';
import {TaskActionOptions} from '../../enum/task-action.enum';

@Injectable()
export class TaskActionEntitySubscriber implements EntitySubscriberInterface<TaskActionEntity> {
    private readonly logger = new Logger(TaskActionEntitySubscriber.name);

    constructor(private readonly connection: Connection, private readonly searchService: SearchService) {
        connection.subscribers.push(this);
    }

    listenTo(): typeof TaskActionEntity {
        return TaskActionEntity;
    }

    afterInsert(event: InsertEvent<TaskActionEntity>): void {
        runOnTransactionCommit(async () => {
            if (event.entity.action === TaskActionOptions.COMMENT) {
                this.logger.verbose('Sending insert task comment event to Eureka');
                await this.searchService.sendMessage({
                    documentType: AppIndexesOptions.TaskManagementTaskComment,
                    operation: SearchDocumentOptions.upsert,
                    recordId: parseInt(String(event.entity.id)),
                });
            }
        });
    }

    afterUpdate(event: UpdateEvent<TaskActionEntity>): void {
        if (!event.entity.id) {
            throw new InternalServerErrorException('Missing id field on task action update');
        }
        runOnTransactionCommit(async () => {
            const entity = await this.connection.getRepository(TaskActionEntity).findOne({where: {id: event.entity.id}});
            if (entity.action === TaskActionOptions.COMMENT) {
                this.logger.verbose('Sending update task comment event to Eureka');
                await this.searchService.sendMessage({
                    documentType: AppIndexesOptions.TaskManagementTaskComment,
                    operation: SearchDocumentOptions.upsert,
                    recordId: event.entity.id,
                });
            }
        });
    }

    beforeRemove(event: RemoveEvent<TaskActionEntity>): void {
        if (!event.entityId) {
            throw new InternalServerErrorException('Missing id field on task action delete');
        }
        const entityId = event.entityId;
        runOnTransactionCommit(async () => {
            this.logger.verbose('Sending delete task comment event to Eureka');
            await this.searchService.sendMessage({
                documentType: AppIndexesOptions.TaskManagementTaskComment,
                operation: SearchDocumentOptions.delete,
                recordId: entityId,
            });
        });
    }
}
