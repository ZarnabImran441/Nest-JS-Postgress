import {Injectable, InternalServerErrorException, Logger} from '@nestjs/common';
import {AppIndexesOptions, SearchDocumentOptions} from '@plexxis/eureka-api';
import {Connection, EntitySubscriberInterface, InsertEvent, RemoveEvent} from 'typeorm';
import {runOnTransactionCommit} from 'typeorm-transactional';
import {SearchService} from '../../module/search/search.service';
import {CustomFieldValueEntity} from '../custom-field-value.entity';

@Injectable()
export class CustomFieldValueEntitySubscriber implements EntitySubscriberInterface<CustomFieldValueEntity> {
    private readonly logger = new Logger(CustomFieldValueEntitySubscriber.name);

    constructor(private readonly connection: Connection, private readonly searchService: SearchService) {
        connection.subscribers.push(this);
    }

    listenTo(): typeof CustomFieldValueEntity {
        return CustomFieldValueEntity;
    }

    afterInsert(event: InsertEvent<CustomFieldValueEntity>): void {
        runOnTransactionCommit(async () => {
            if (event.entity.Task?.id) {
                this.logger.verbose('Sending insert task custom field event to Eureka');
                await this.searchService.sendMessage({
                    documentType: AppIndexesOptions.TaskManagementTaskCustomField,
                    operation: SearchDocumentOptions.upsert,
                    recordId: parseInt(String(event.entity.id)),
                });
            }
        });
    }

    beforeRemove(event: RemoveEvent<CustomFieldValueEntity>): void {
        if (!event.entity.id) {
            throw new InternalServerErrorException('Missing id field on task custom field delete');
        }
        const entityId = event.entity.id;
        runOnTransactionCommit(async () => {
            if (event.entity.taskId) {
                this.logger.verbose('Sending delete task custom field event to Eureka');
                await this.searchService.sendMessage({
                    documentType: AppIndexesOptions.TaskManagementTaskCustomField,
                    operation: SearchDocumentOptions.delete,
                    recordId: entityId,
                });
            }
        });
    }
}
