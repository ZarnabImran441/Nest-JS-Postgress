import {Injectable, InternalServerErrorException, Logger} from '@nestjs/common';
import {AppIndexesOptions, SearchDocumentOptions} from '@plexxis/eureka-api';
import {Connection, EntitySubscriberInterface, InsertEvent, SoftRemoveEvent} from 'typeorm';
import {runOnTransactionCommit} from 'typeorm-transactional';
import {SearchService} from '../../module/search/search.service';
import {ApprovalEntity} from '../approval.entity';

@Injectable()
export class ApprovalEntitySubscriber implements EntitySubscriberInterface<ApprovalEntity> {
    private readonly logger = new Logger(ApprovalEntitySubscriber.name);

    constructor(private readonly connection: Connection, private readonly searchService: SearchService) {
        connection.subscribers.push(this);
    }

    listenTo(): typeof ApprovalEntity {
        return ApprovalEntity;
    }

    afterInsert(event: InsertEvent<ApprovalEntity>): void {
        runOnTransactionCommit(async () => {
            this.logger.verbose('Sending insert task approval event to Eureka');
            await this.searchService.sendMessage({
                documentType: AppIndexesOptions.TaskManagementTaskApproval,
                operation: SearchDocumentOptions.upsert,
                recordId: parseInt(String(event.entityId)),
            });
        });
    }

    beforeSoftRemove(event: SoftRemoveEvent<ApprovalEntity>): void {
        if (!event.entityId) {
            throw new InternalServerErrorException('Missing id field on task approval delete');
        }
        const entityId = event.entityId;
        runOnTransactionCommit(async () => {
            this.logger.verbose('Sending delete task event to Eureka');
            await this.searchService.sendMessage({
                documentType: AppIndexesOptions.TaskManagementTaskApproval,
                operation: SearchDocumentOptions.delete,
                recordId: entityId,
            });
        });
    }
}
