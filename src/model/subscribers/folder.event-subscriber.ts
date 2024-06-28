import {Injectable, InternalServerErrorException, Logger} from '@nestjs/common';
import {AppIndexesOptions, SearchDocumentOptions} from '@plexxis/eureka-api';
import {Connection, EntitySubscriberInterface, InsertEvent, RemoveEvent, UpdateEvent} from 'typeorm';
import {runOnTransactionCommit} from 'typeorm-transactional';
import {FolderTypeOptions} from '../../enum/folder.enum';
import {SearchService} from '../../module/search/search.service';
import {FolderEntity} from '../folder.entity';

@Injectable()
export class FolderEntitySubscriber implements EntitySubscriberInterface<FolderEntity> {
    private readonly logger = new Logger(FolderEntitySubscriber.name);

    constructor(private readonly connection: Connection, private readonly searchService: SearchService) {
        connection.subscribers.push(this);
    }

    listenTo(): typeof FolderEntity {
        return FolderEntity;
    }

    afterInsert(event: InsertEvent<FolderEntity>): void {
        runOnTransactionCommit(async () => {
            this.logger.verbose('Sending insert folder event to Eureka. Id: ' + event.entityId);
            await this.searchService.sendMessage({
                documentType:
                    event.entity.folderType === FolderTypeOptions.FOLDER
                        ? AppIndexesOptions.TaskManagementFolder
                        : AppIndexesOptions.TaskManagementSpace,
                operation: SearchDocumentOptions.upsert,
                recordId: parseInt(String(event.entityId)),
            });
        });
    }

    afterUpdate(event: UpdateEvent<FolderEntity>): void {
        if (!event.entity.id) {
            throw new InternalServerErrorException('Missing id field on folder update');
        }
        runOnTransactionCommit(async () => {
            const entity = await this.connection.getRepository(FolderEntity).findOne({where: {id: event.entity.id}});
            this.logger.verbose('Sending update folder event to Eureka. Id:' + entity.id);
            await this.searchService.sendMessage({
                documentType:
                    entity.folderType === FolderTypeOptions.FOLDER
                        ? AppIndexesOptions.TaskManagementFolder
                        : AppIndexesOptions.TaskManagementSpace,
                operation: entity.deletedAt ? SearchDocumentOptions.delete : SearchDocumentOptions.upsert,
                recordId: entity.id,
            });
        });
    }

    beforeRemove(event: RemoveEvent<FolderEntity>): void {
        if (!event.entityId) {
            throw new InternalServerErrorException('Missing id field on folder delete');
        }
        const entityId = event.entityId;
        const folderType = event.entity.folderType;
        runOnTransactionCommit(async () => {
            this.logger.verbose('Sending delete folder event to Eureka. Id: ' + entityId);
            await this.searchService.sendMessage({
                documentType:
                    folderType === FolderTypeOptions.FOLDER
                        ? AppIndexesOptions.TaskManagementFolder
                        : AppIndexesOptions.TaskManagementSpace,
                operation: SearchDocumentOptions.delete,
                recordId: entityId,
            });
        });
    }
}
