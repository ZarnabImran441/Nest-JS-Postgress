import {Injectable, InternalServerErrorException, Logger} from '@nestjs/common';
import {AppIndexesOptions, SearchDocumentOptions} from '@plexxis/eureka-api';
import {Connection, EntitySubscriberInterface, InsertEvent, RemoveEvent} from 'typeorm';
import {runOnTransactionCommit} from 'typeorm-transactional';
import {TagTaskFolderTypeOptions} from '../../enum/tag.enum';
import {SearchService} from '../../module/search/search.service';
import {TagTaskFolderEntity} from '../tag-task-folder.entity';

@Injectable()
export class TagTaskFolderEntitySubscriber implements EntitySubscriberInterface<TagTaskFolderEntity> {
    private readonly logger = new Logger(TagTaskFolderEntitySubscriber.name);

    constructor(private readonly connection: Connection, private readonly searchService: SearchService) {
        connection.subscribers.push(this);
    }

    listenTo(): typeof TagTaskFolderEntity {
        return TagTaskFolderEntity;
    }

    afterInsert(event: InsertEvent<TagTaskFolderEntity>): void {
        runOnTransactionCommit(async () => {
            if (event.entity.type === TagTaskFolderTypeOptions.TASK_TAG) {
                this.logger.verbose('Sending insert task label event to Eureka');
                await this.searchService.sendMessage({
                    documentType: AppIndexesOptions.TaskManagementTaskLabel,
                    operation: SearchDocumentOptions.upsert,
                    recordId: parseInt(String(event.entity.id)),
                });
            }
        });
    }

    beforeRemove(event: RemoveEvent<TagTaskFolderEntity>): void {
        if (!event.entity.id) {
            throw new InternalServerErrorException('Missing id field on task label delete');
        }
        const entityId = event.entity.id;
        runOnTransactionCommit(async () => {
            if (event.entity.type === TagTaskFolderTypeOptions.TASK_TAG) {
                this.logger.verbose('Sending delete task label event to Eureka');
                await this.searchService.sendMessage({
                    documentType: AppIndexesOptions.TaskManagementTaskLabel,
                    operation: SearchDocumentOptions.delete,
                    recordId: entityId,
                });
            }
        });
    }
}
