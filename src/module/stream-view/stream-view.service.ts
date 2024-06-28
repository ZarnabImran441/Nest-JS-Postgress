import {Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {StreamViewBaseService} from './stream-view-base.service';
import {TaskActionEntity} from '../../model/task-action.entity';
import {FolderActionEntity} from '../../model/folder-action.entity';
import {TaskRelationEntity} from '../../model/task-relation.entity';
import {FolderUserViewEntity} from '../../model/folder-user-view.entity';
import {TaskFollowerEntity} from '../../model/task-follower.entity';
import {FolderFollowerEntity} from '../../model/folder-follower.entity';
import {WorkFlowStateEntity} from '../../model/workflow-state.entity';
import {FolderEntity} from '../../model/folder.entity';
import {FolderRelationEntity} from '../../model/folder-relation.entity';
import {StreamFilterOptions} from '../../enum/stream-filter-type.enum';
import {StreamViewResponseDto} from '../../dto/stream-view/stream-view-response.dto';
import {contructorLogger} from '@lib/base-library';
import {TaskEntity} from '../../model/task.entity';

/**
 * A service class for retrieving stream views.
 * @public
 * @extends StreamViewBaseService
 */
@Injectable()
export class StreamViewService extends StreamViewBaseService {
    constructor(
        @InjectRepository(TaskActionEntity) taskActionsRepository: Repository<TaskActionEntity>,
        @InjectRepository(FolderActionEntity) folderActionsRepository: Repository<FolderActionEntity>,
        @InjectRepository(TaskRelationEntity) taskRelationsRepository: Repository<TaskRelationEntity>,
        @InjectRepository(TaskEntity) taskEntityRepository: Repository<TaskEntity>,
        @InjectRepository(FolderUserViewEntity) folderUserViewRepository: Repository<FolderUserViewEntity>,
        @InjectRepository(TaskFollowerEntity) taskFollowerRepository: Repository<TaskFollowerEntity>,
        @InjectRepository(FolderFollowerEntity) folderFollowerRepository: Repository<FolderFollowerEntity>,
        @InjectRepository(WorkFlowStateEntity) folderWorkflowStateRepository: Repository<WorkFlowStateEntity>,
        @InjectRepository(FolderEntity) folderRepository: Repository<FolderEntity>,
        @InjectRepository(FolderRelationEntity) folderRelationRepository: Repository<FolderRelationEntity>
    ) {
        super(
            taskActionsRepository,
            folderActionsRepository,
            taskRelationsRepository,
            taskEntityRepository,
            folderUserViewRepository,
            taskFollowerRepository,
            folderFollowerRepository,
            folderWorkflowStateRepository,
            folderRepository,
            folderRelationRepository
        );
        contructorLogger(this);
    }

    /**
     * Retrieves the stream by folder ID.
     *
     * @param {number} folderId - The ID of the folder.
     * @param {string} userId - The ID of the user.
     * @param {number} pageSize - The number of items to display per page.
     * @param {number} pageNumber - The page number.
     * @param {StreamFilterOptions} filter - The filter options for the stream.
     * @return {Promise<StreamViewResponseDto>} - A promise that resolves to a StreamViewResponseDto object.
     */
    async getStreamByFolderId(
        folderId: number,
        userId: string,
        pageSize: number,
        pageNumber: number,
        filter: StreamFilterOptions
    ): Promise<StreamViewResponseDto> {
        return await super.getStreamByFolderId(folderId, userId, pageSize, pageNumber, filter);
    }

    /**
     * Retrieves a stream by task ID.
     *
     * @param {number} taskId - The ID of the task.
     * @param {number} pageSize - The maximum number of stream items to retrieve per page.
     * @param {number} pageNumber - The page number of the stream items to retrieve.
     * @returns {Promise<StreamViewResponseDto>} A Promise that resolves to a StreamViewResponseDto object representing the retrieved stream.
     */
    async getStreamByTaskId(taskId: number, pageSize: number, pageNumber: number): Promise<StreamViewResponseDto> {
        return await super.getStreamByTaskId(taskId, pageSize, pageNumber);
    }
}
