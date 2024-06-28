import {Injectable, InternalServerErrorException, Logger} from '@nestjs/common';
import {AppIndexesOptions, SearchDocumentOptions} from '@plexxis/eureka-api';
import {flatten, uniq} from 'ramda';
import {Connection, EntitySubscriberInterface, InsertEvent, RemoveEvent, UpdateEvent} from 'typeorm';
import {runOnTransactionCommit} from 'typeorm-transactional';
import {FolderTypeOptions} from '../../enum/folder.enum';
import {SearchService} from '../../module/search/search.service';
import {FolderRelationEntity} from '../folder-relation.entity';
import {FolderEntity} from '../folder.entity';

@Injectable()
export class FolderRelationEntitySubscriber implements EntitySubscriberInterface<FolderRelationEntity> {
    private readonly logger = new Logger(FolderRelationEntitySubscriber.name);

    constructor(private readonly connection: Connection, private readonly searchService: SearchService) {
        connection.subscribers.push(this);
    }

    listenTo(): typeof FolderRelationEntity {
        return FolderRelationEntity;
    }

    private updateAllPathIdsFolders = (childFolderId: number): void => {
        runOnTransactionCommit(async () => {
            this.logger.verbose('Getting all folders with childFolderId in path_ids');
            const pathIdRelations = await this.connection
                .getRepository(FolderRelationEntity)
                .createQueryBuilder()
                .where(':childFolderId = any(path_ids)', {childFolderId})
                .getMany();

            const foldersToProcess: Array<FolderEntity> = [];
            const tasksToProcess: Array<number> = [];
            for (const relation of pathIdRelations) {
                for (const pathId of relation.pathIds) {
                    if (foldersToProcess.some((element) => element.id === pathId) === false) {
                        const folder = await this.connection
                            .getRepository(FolderEntity)
                            .findOne({where: {id: pathId}, relations: {FolderTasks: true}});
                        foldersToProcess.push(folder);
                        const tasks = flatten(folder.FolderTasks.map((ft) => ft.pathIds));

                        tasksToProcess.push(...tasks);
                    }
                }
            }
            for (const folder of foldersToProcess) {
                this.logger.verbose('Sending update folder event to Eureka. Id:' + folder.id);
                await this.searchService.sendMessage({
                    documentType:
                        folder.folderType === FolderTypeOptions.FOLDER
                            ? AppIndexesOptions.TaskManagementFolder
                            : AppIndexesOptions.TaskManagementSpace,
                    operation: folder.deletedAt ? SearchDocumentOptions.delete : SearchDocumentOptions.upsert,
                    recordId: folder.id,
                });
            }

            for (const taskId of uniq(tasksToProcess)) {
                this.logger.verbose('Sending update task event to Eureka. Id:' + taskId);
                await this.searchService.sendMessage({
                    documentType: AppIndexesOptions.TaskManagementTask,
                    operation: SearchDocumentOptions.upsert,
                    recordId: taskId,
                });
            }
        });
    };

    afterInsert(event: InsertEvent<FolderRelationEntity>): void {
        this.logger.verbose('Receiving insert folder relation event in subscriber');
        this.updateAllPathIdsFolders(parseInt(String(event.entity.childFolderId)));
    }

    afterUpdate(event: UpdateEvent<FolderRelationEntity>): void {
        this.logger.verbose('Receiving update folder relation event in subscriber');
        if (!event.entity.childFolderId) {
            throw new InternalServerErrorException('Missing id field on folder-relation update');
        }
        this.updateAllPathIdsFolders(event.entity.childFolderId);
    }

    beforeRemove(event: RemoveEvent<FolderRelationEntity>): void {
        this.logger.verbose('Receiving delete folder relation event in subscriber');
        if (!event.entity.childFolderId) {
            throw new InternalServerErrorException('Missing id field on folder-relation delete');
        }
        this.updateAllPathIdsFolders(event.entity.childFolderId);
    }
}
