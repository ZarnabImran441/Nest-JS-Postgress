import {Inject, Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {FolderWorkflowBaseService} from './folder-workflow-base.service';
import {AuthorizationImplService} from '../../authorization-impl/authorization-impl.service';
import {FolderViewOptions} from '../../../enum/folder-position.enum';
import {FolderTaskFilterDto} from '../../../dto/folder/filter/folder-task-filter.dto';
import {BoardResponseDto} from '../../../dto/folder/workflow/board-response.dto';
import {EntityTypeOptions, PermissionOptions} from '../../authorization-impl/authorization.enum';
import {GanttResponseDto} from '../../../dto/folder/workflow/gantt-response.dto';
import {ListResponseDto} from '../../../dto/folder/workflow/list-response.dto';
import {ProjectWorkFlowResponseDto} from '../../../dto/folder/workflow/project-workFlow-response.dto';
import {CreateFolderWorkFlowDto} from '../../../dto/folder/workflow/create-folder-workflow.dto';
import {CreateFolderWorkflowResponseDto} from '../../../dto/folder/workflow/create-folder-workflow-response.dto';
import {ABSTRACT_AUTHORIZATION_SERVICE, contructorLogger} from '@lib/base-library';
import {WorkFlowEntity} from '../../../model/workflow.entity';

@Injectable()
export class FolderWorkflowService extends FolderWorkflowBaseService {
    constructor(
        @InjectRepository(WorkFlowEntity) protected readonly repoWorkflow: Repository<WorkFlowEntity>,
        @Inject(ABSTRACT_AUTHORIZATION_SERVICE) protected readonly authorization: AuthorizationImplService
    ) {
        super(repoWorkflow);
        contructorLogger(this);
    }

    async getProjectsFlowsAndTasksBoardView(
        folderId: number,
        userId: string,
        view: FolderViewOptions,
        filter: FolderTaskFilterDto,
        showArchived: boolean,
        showDeleted: boolean
    ): Promise<BoardResponseDto[]> {
        try {
            // Check If User has Purge Folders Permissions
            let hasPurgePermissions = false;
            if (showDeleted) {
                hasPurgePermissions = await this.authorization.getUserHasPermissions(
                    userId,
                    PermissionOptions.UPDATE,
                    EntityTypeOptions.PurgeFoldersAndTasks,
                    null
                );
            }

            const boardResponseDto: BoardResponseDto[] = await super.getProjectsFlowsAndTasksBoard(
                folderId,
                userId,
                view,
                filter,
                showArchived,
                showDeleted,
                hasPurgePermissions
            );
            /* Permissions */
            {
                // If the user can read the folder, he can see all tasks within it
                const result: boolean = await this.authorization.getUserHasPermissions(
                    userId,
                    PermissionOptions.READ,
                    EntityTypeOptions.Folder,
                    folderId
                );
                if (!result) {
                    for (const board of boardResponseDto) {
                        for (const column of board.columns) {
                            column.tasks = [];
                        }
                    }
                }
            }

            /* Permissions */
            /*{
                for (const board of result) {
                    for (const column of board.columns) {
                        if (column.tasks.length > 0) {
                            column.tasks = await this.authorization.filterArrayNodeWithPermission(
                                column.tasks,
                                userId,
                                EntityTypeOptions.Task,
                                PermissionOptions.READ
                            );
                        }
                    }
                }
            }*/

            return boardResponseDto;
        } catch (e) {
            this.logger.error(`There was an error while fetching workflow states of the project ${folderId}`, e);
            throw e;
        }
    }

    async getProjectsFlowsAndTasksGanttView(
        folderId: number,
        userId: string,
        filter: FolderTaskFilterDto,
        showArchived: boolean,
        showDeleted: boolean
    ): Promise<GanttResponseDto> {
        try {
            let hasPurgePermissions = false;
            // Check If User has Purge Folders Permissions
            if (showDeleted) {
                hasPurgePermissions = await this.authorization.getUserHasPermissions(
                    userId,
                    PermissionOptions.UPDATE,
                    EntityTypeOptions.PurgeFoldersAndTasks,
                    null
                );
            }

            return await super.getProjectsFlowsAndTasksGantt(folderId, userId, filter, showArchived, showDeleted, hasPurgePermissions);
        } catch (e) {
            this.logger.error(`There was an error while fetching workflow states of the project ${folderId}`, e);
            throw e;
        }
    }

    async getProjectsFlowsAndTasksListView(
        folderId: number,
        userId: string,
        filter: FolderTaskFilterDto,
        showArchived: boolean,
        showDeleted: boolean
    ): Promise<ListResponseDto> {
        try {
            let hasPurgePermissions = false;
            // Check If User has Purge Folders Permissions
            if (showDeleted) {
                hasPurgePermissions = await this.authorization.getUserHasPermissions(
                    userId,
                    PermissionOptions.UPDATE,
                    EntityTypeOptions.PurgeFoldersAndTasks,
                    null
                );
            }

            return await super.getProjectsFlowsAndTasksList(folderId, userId, filter, showArchived, showDeleted, hasPurgePermissions);
        } catch (e) {
            this.logger.error(`There was an error while fetching workflow states of the project ${folderId}`, e);
            throw e;
        }
    }

    async getProjectWorkflow(folderIds: number[], userId: string): Promise<ProjectWorkFlowResponseDto[]> {
        try {
            return await super.getProjectWorkflow(folderIds, userId);
        } catch (e) {
            this.logger.error(`There was an error while fetching workflow states of the project ${folderIds.join(', ')}`, e);
            throw e;
        }
    }

    async getOneFolderWorkflow(id: number): Promise<WorkFlowEntity> {
        return await this.repo.findOne({
            where: {id},
            relations: {
                Folders: true,
                WorkFlowStates: true,
            },
        });
    }

    async createWorkflowWithStates(dto: CreateFolderWorkFlowDto): Promise<CreateFolderWorkflowResponseDto> {
        try {
            return await super.createWorkflowWithState(dto);
        } catch (error) {
            this.logger.error(`There was an error while creating a workflow ${JSON.stringify(dto)}`, error);
            throw error;
        }
    }
}
