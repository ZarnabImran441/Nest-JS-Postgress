import {Injectable, Logger} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {In, IsNull, Repository} from 'typeorm';
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
import {EntityDataDto, StreamActionDto, StreamViewDataDto, StreamViewResponseDto} from '../../dto/stream-view/stream-view-response.dto';
import {StreamViewOptions} from '../../enum/stream-view-type.enum';
import {contructorLogger} from '@lib/base-library';
import {TaskEntity} from '../../model/task.entity';

/**
 * Service for retrieving stream view data for a specified folder.
 */
@Injectable()
export class StreamViewBaseService {
    protected readonly logger: Logger;

    constructor(
        @InjectRepository(TaskActionEntity) protected readonly taskActionsRepository: Repository<TaskActionEntity>,
        @InjectRepository(FolderActionEntity) protected readonly folderActionsRepository: Repository<FolderActionEntity>,
        @InjectRepository(TaskRelationEntity) protected readonly taskRelationsRepository: Repository<TaskRelationEntity>,
        @InjectRepository(TaskEntity) private readonly taskEntityRepository: Repository<TaskEntity>,
        @InjectRepository(FolderUserViewEntity) protected readonly folderUserViewRepository: Repository<FolderUserViewEntity>,
        @InjectRepository(TaskFollowerEntity) protected readonly taskFollowerRepository: Repository<TaskFollowerEntity>,
        @InjectRepository(FolderFollowerEntity) protected readonly folderFollowerRepository: Repository<FolderFollowerEntity>,
        @InjectRepository(WorkFlowStateEntity)
        protected readonly workflowStateRepository: Repository<WorkFlowStateEntity>,
        @InjectRepository(FolderEntity) protected readonly folderRepository: Repository<FolderEntity>,
        @InjectRepository(FolderRelationEntity) protected readonly folderRelationRepository: Repository<FolderRelationEntity>
    ) {
        this.logger = new Logger(this.constructor.name);
        contructorLogger(this);
    }

    /**
     * Retrieves a stream of activity actions based on the folder ID.
     *
     * @async
     * @param {number} folderId - The ID of the folder.
     * @param {string} userId - The ID of the user.
     * @param {number} [pageSize=30] - The number of actions per page.
     * @param {number} [pageNumber=1] - The current page number.
     * @param {StreamFilterOptions} [filter=StreamFilterOptions.ALL] - The filter options for the stream.
     * @returns {Promise<StreamViewResponseDto>} The stream view response containing the actions.
     */
    async getStreamByFolderId(
        folderId: number,
        userId: string,
        pageSize = 30,
        pageNumber = 1,
        filter: StreamFilterOptions = StreamFilterOptions.ALL
    ): Promise<StreamViewResponseDto> {
        let taskIds: number[] = [];
        let folderIds: number[] = [folderId];
        let taskRelations: TaskRelationEntity[] = [];
        // Include the specified folder and its children folders
        folderIds = folderIds.concat(await this.getAllChildFolderIds(folderId));
        if (filter === StreamFilterOptions.FOLLOWED) {
            const followedFolders = await this.folderFollowerRepository.find({
                where: {userId, Folder: {id: In(folderIds), archivedAt: IsNull(), deletedAt: IsNull()}},
                relations: {Folder: true},
            });

            folderIds = folderIds.concat(followedFolders.map((folderFollower) => folderFollower.Folder.id));
            taskRelations = await this.taskRelationsRepository.find({
                where: {
                    Folder: {
                        id: In(folderIds),
                        archivedAt: IsNull(),
                        deletedAt: IsNull(),
                    },
                },
                relations: {Folder: true, ChildTask: true, ParentTask: true, WorkFlowState: true},
            });
            taskRelations.forEach((taskRelation) => {
                if (taskRelation.ParentTask && !taskIds.includes(taskRelation.ParentTask.id)) {
                    taskIds.push(taskRelation.ParentTask.id);
                }
                if (taskRelation.ChildTask && !taskIds.includes(taskRelation.ChildTask.id)) {
                    taskIds.push(taskRelation.ChildTask.id);
                }
            });
            const followedTasks = await this.taskFollowerRepository.find({
                where: {userId, Task: {id: In(taskIds), archivedAt: null, deletedAt: null}},
                relations: {Task: true},
            });
            taskIds = followedTasks.map((taskFollower) => taskFollower.Task.id);
        } else if (filter === StreamFilterOptions.ASSIGNED_TO_ME) {
            const assignedFolders = await this.folderUserViewRepository.find({
                where: {userId, folderId: In(folderIds)},
                // relations: {Folder: true},
            });
            folderIds = folderIds.concat(assignedFolders.map((folderFollower) => folderFollower.folderId));
            taskRelations = await this.taskRelationsRepository.find({
                where: {Folder: {id: In(folderIds), archivedAt: IsNull(), deletedAt: IsNull()}},
                relations: {Folder: true, ChildTask: true, ParentTask: true, WorkFlowState: true},
            });
            taskRelations.forEach((taskRelation) => {
                if (taskRelation.ParentTask && !taskIds.includes(taskRelation.ParentTask.id)) {
                    taskIds.push(taskRelation.ParentTask.id);
                }
                if (taskRelation.ChildTask && !taskIds.includes(taskRelation.ChildTask.id)) {
                    taskIds.push(taskRelation.ChildTask.id);
                }
            });

            let assignedTasks = [];
            if (taskIds.length > 0) {
                assignedTasks = await this.taskEntityRepository
                    .createQueryBuilder('T')
                    .select('id')
                    .where({id: In(taskIds)})
                    .andWhere(`:userId = ANY(T.assignees)`, {userId})
                    .getRawMany();
            }
            taskIds = assignedTasks.map((t: TaskEntity) => Number(t.id));
        } else if (filter === StreamFilterOptions.ALL) {
            taskRelations = await this.taskRelationsRepository.find({
                where: {Folder: {id: In(folderIds), archivedAt: IsNull(), deletedAt: IsNull()}},
                relations: {Folder: true, ChildTask: true, ParentTask: true, WorkFlowState: true},
            });
            taskRelations.forEach((taskRelation) => {
                if (taskRelation.ParentTask && !taskIds.includes(taskRelation.ParentTask.id)) {
                    taskIds.push(taskRelation.ParentTask.id);
                }
                if (taskRelation.ChildTask && !taskIds.includes(taskRelation.ChildTask.id)) {
                    taskIds.push(taskRelation.ChildTask.id);
                }
            });
        }
        let {folderQueryPageSize, taskQueryPageSize} = this.calculatePageSizes(pageSize);
        if (folderIds.length == 0 && taskIds.length == 0)
            return {
                data: [],
                metadata: {totalRecords: 0, pageSize, pageNumber},
            };
        if (taskIds.length == 0) folderQueryPageSize = pageSize;
        if (folderIds.length == 0) taskQueryPageSize = pageSize;
        const [folderActions, folderActionsCount] = await this.folderActionsRepository.findAndCount({
            where: {Folder: {id: In(folderIds), archivedAt: IsNull(), deletedAt: IsNull()}},
            take: folderQueryPageSize,
            skip: folderQueryPageSize * (pageNumber - 1),
            relations: {Folder: true},
            order: {
                date: 'DESC',
            },
        });

        const [taskActions, taskActionsCount] = await this.taskActionsRepository.findAndCount({
            where: {Task: {id: In(taskIds), archivedAt: null, deletedAt: null}},
            take: taskQueryPageSize,
            skip: taskQueryPageSize * (pageNumber - 1),
            relations: {Task: true},
            order: {
                date: 'DESC',
            },
        });

        const aggregatedActionsByTaskId: Record<
            number,
            {
                actions: TaskActionEntity[];
                entityData: EntityDataDto;
                hasMoreUpdates: boolean;
            }
        > = {};

        taskActions.forEach((action) => {
            const taskId = action.Task.id;

            if (!aggregatedActionsByTaskId[taskId]) {
                aggregatedActionsByTaskId[taskId] = {actions: [action], entityData: null, hasMoreUpdates: false};
                return;
            }
            aggregatedActionsByTaskId[taskId].actions.push(action);
        });

        const folderRelation = await this.folderRelationRepository.findOneBy({
            ChildFolder: {
                id: folderId,
            },
        });
        const parentFolder = {
            id: folderRelation?.ParentFolder?.id ?? null,
            title: folderRelation?.ParentFolder?.title ?? null,
        };

        for (const taskId in aggregatedActionsByTaskId) {
            const task = aggregatedActionsByTaskId[taskId];
            /* Query DB for task data and to check if there are more updates
Search TaskRelation Table to check for folder workflow state */
            const taskRelation = taskRelations.find((taskRelation) => taskRelation.ChildTask.id == Number(taskId));

            const taskAction = task.actions[0];

            const state = await this.workflowStateRepository.findOneBy({id: taskRelation.WorkFlowState.id});
            const taskFolder = await this.folderRepository.findOneBy({id: taskRelation.Folder.id});
            aggregatedActionsByTaskId[taskId].entityData = {
                taskFolderTitle: taskFolder.title,
                taskFolderColor: taskFolder.color,
                taskFolderId: taskFolder.id,
                currentTaskStateName: state.title,
                currentTaskStateColor: state.color,
                taskTitle: taskAction.Task.title,
                parentFolderId: parentFolder.id,
                parentFolderTitle: parentFolder.title,
            };
            const totalTaskActionsById = await this.taskActionsRepository.countBy({
                Task: {
                    id: Number(taskId),
                    archivedAt: null,
                    deletedAt: null,
                },
            });
            /* 
calculate if there are more updates for this task
check amount of task actions in DB and compare to the amount of task actions in the aggregatedActionsByTaskId + the sum of the skipped task actions

*/
            if (aggregatedActionsByTaskId[taskId]) {
                aggregatedActionsByTaskId[taskId].hasMoreUpdates =
                    totalTaskActionsById > aggregatedActionsByTaskId[taskId].actions.length + taskQueryPageSize * (pageNumber - 1);
            }
        }

        const aggregatedActionsByFolderId: Record<
            number,
            {actions: FolderActionEntity[]; entityData: EntityDataDto; hasMoreUpdates: boolean}
        > = {};
        const totalFolderActionsById = await this.folderActionsRepository.countBy({
            Folder: {
                id: folderId,
                archivedAt: IsNull(),
                deletedAt: IsNull(),
            },
        });
        if (folderActions.length == 0) {
            aggregatedActionsByFolderId[folderId] = {actions: [], entityData: null, hasMoreUpdates: false};
        } else {
            folderActions.forEach((action) => {
                const folderId = action.Folder.id;
                if (!aggregatedActionsByFolderId[folderId]) {
                    aggregatedActionsByFolderId[folderId] = {actions: [action], entityData: null, hasMoreUpdates: false};
                    return;
                }
                aggregatedActionsByFolderId[folderId].actions.push(action);
            });
        }
        /* 
calculate if there are more updates for this folder
check amount of folder actions in DB and compare to the amount of folder actions in the aggregatedActionsByFolderId + the sum of the skipped folder actions

*/
        if (aggregatedActionsByFolderId[folderId]) {
            aggregatedActionsByFolderId[folderId].hasMoreUpdates =
                totalFolderActionsById > aggregatedActionsByFolderId[folderId].actions.length + folderQueryPageSize * (pageNumber - 1);
        }

        const actions = [...taskActions, ...folderActions].sort((a, b) => b.date.getTime() - a.date.getTime());
        const result: StreamViewDataDto[] = [];
        actions.forEach((action) => {
            if ('Task' in action) {
                const taskId = action.Task.id;
                const found = result.find((entity) => {
                    return entity.entityId == taskId && (entity.type == StreamViewOptions.Task || StreamViewOptions[entity.type] == 'task');
                });
                if (!found) {
                    result.push({
                        type: StreamViewOptions.Task,
                        actions: aggregatedActionsByTaskId[taskId].actions.sort(
                            (a, b) => b.date.getTime() - a.date.getTime()
                        ) as unknown as StreamActionDto[],
                        entityId: taskId,
                        entityData: aggregatedActionsByTaskId[taskId].entityData,
                        hasMoreUpdates: aggregatedActionsByTaskId[taskId].hasMoreUpdates,
                    });
                }
            } else {
                const folderAction = action as FolderActionEntity;
                const folderId = folderAction.Folder.id;
                const found = result.find(
                    (entity) =>
                        entity.entityId == folderId &&
                        (entity.type == StreamViewOptions.Folder || StreamViewOptions[entity.type] == 'folder')
                );
                if (!found) {
                    result.push({
                        type: StreamViewOptions.Folder,
                        actions: aggregatedActionsByFolderId[folderId].actions.sort(
                            (a, b) => b.date.getTime() - a.date.getTime()
                        ) as unknown as StreamActionDto[],
                        entityId: folderId,
                        entityData: {
                            parentFolderId: parentFolder.id ?? null,
                            parentFolderTitle: parentFolder.title ?? null,
                        },
                        hasMoreUpdates: aggregatedActionsByFolderId[folderId].hasMoreUpdates,
                    });
                }
            }
        });
        return {
            data: result,
            metadata: {
                totalRecords: taskActionsCount + folderActionsCount,
                pageSize,
                pageNumber,
            },
        };
    }

    /**
     * Retrieves the IDs of all child folders under the given parent folder ID.
     *
     * @param {number} parentFolderId - The identifier of the parent folder.
     * @returns {Promise<number[]>} A promise that resolves with an array of child folder IDs.
     */
    async getAllChildFolderIds(parentFolderId: number): Promise<number[]> {
        const folderRelationRepository = this.taskActionsRepository.manager.getRepository(FolderRelationEntity);
        const childrenFolders = await folderRelationRepository.find({
            where: {ParentFolder: {id: parentFolderId, archivedAt: IsNull(), deletedAt: IsNull()}},
            relations: {ParentFolder: true, ChildFolder: true},
        });
        const result = [];

        if (childrenFolders.length === 0) {
            return [];
        }

        result.push(...childrenFolders.map((folderRelation) => folderRelation.ChildFolder?.id));

        return [...new Set(result)];
    }

    /**
     * Calculates the page sizes for folder query and task query.
     *
     * @param {number} pageSize - The total page size.
     * @return {Object} - An object containing the page sizes for folder query and task query.
     *                   - folderQueryPageSize: The page size for folder query.
     *                   - taskQueryPageSize: The page size for task query.
     */
    calculatePageSizes(pageSize: number): {folderQueryPageSize: number; taskQueryPageSize: number} {
        const halfPageSize = Math.floor(pageSize / 2);
        const taskQueryPageSize = pageSize % 2 === 0 ? halfPageSize : halfPageSize + 1;

        return {
            folderQueryPageSize: halfPageSize,
            taskQueryPageSize: taskQueryPageSize,
        };
    }

    /**
     * Retrieves a stream of task actions for a given task ID.
     *
     * @param {number} taskId - The ID of the task.
     * @param {number} [pageSize=40] - The number of actions to retrieve per page. Default is 40.
     * @param {number} [pageNumber=1] - The page number of the actions to retrieve. Default is 1.
     *
     * @returns {Promise<StreamViewResponseDto>} A promise that resolves with a response containing the stream of actions.
     */
    async getStreamByTaskId(taskId: number, pageSize = 40, pageNumber = 1): Promise<StreamViewResponseDto> {
        const [taskActions, taskActionsCount] = await this.taskActionsRepository.findAndCount({
            where: {Task: {id: taskId, archivedAt: null, deletedAt: null}},
            take: pageSize,
            skip: pageSize * (pageNumber - 1),
            relations: {Task: true},
            order: {
                date: 'DESC',
            },
        });
        const taskRelation = await this.taskRelationsRepository.findOne({
            where: {ChildTask: {id: taskId, archivedAt: null, deletedAt: null}},
            relations: {Folder: true, ChildTask: true, ParentTask: true, WorkFlowState: true},
        });
        const aggregatedActionsByTaskId: Record<
            number,
            {
                actions: TaskActionEntity[];
                entityData: EntityDataDto;
                hasMoreUpdates: boolean;
            }
        > = {};

        taskActions.forEach((action) => {
            const taskId = action.Task.id;

            if (!aggregatedActionsByTaskId[taskId]) {
                aggregatedActionsByTaskId[taskId] = {actions: [action], entityData: null, hasMoreUpdates: false};
                return;
            }
            aggregatedActionsByTaskId[taskId].actions.push(action);
        });

        const folderRelation = await this.folderRelationRepository.findOneBy({
            ChildFolder: {
                id: taskRelation.Folder.id,
                archivedAt: IsNull(),
                deletedAt: IsNull(),
            },
        });
        const parentFolder = {
            id: folderRelation?.ParentFolder?.id ?? null,
            title: folderRelation?.ParentFolder?.title ?? null,
        };
        for (const taskId in aggregatedActionsByTaskId) {
            const task = aggregatedActionsByTaskId[taskId];
            /* Query DB for task data and to check if there are more updates
Search TaskRelation Table to check for folder workflow state */

            const taskAction = task.actions[0];

            const state = await this.workflowStateRepository.findOneBy({id: taskRelation.WorkFlowState.id});
            const taskFolder = await this.folderRepository.findOneBy({id: taskRelation.Folder.id});
            aggregatedActionsByTaskId[taskId].entityData = {
                taskFolderTitle: taskFolder.title,
                taskFolderColor: taskFolder.color,
                taskFolderId: taskFolder.id,
                currentTaskStateName: state.title,
                currentTaskStateColor: state.color,
                taskTitle: taskAction.Task.title,
                parentFolderId: parentFolder.id,
                parentFolderTitle: parentFolder.title,
            };
            const totalTaskActionsById = await this.taskActionsRepository.countBy({
                Task: {
                    id: Number(taskId),
                    archivedAt: null,
                    deletedAt: null,
                },
            });
            /* 
calculate if there are more updates for this task
check amount of task actions in DB and compare to the amount of task actions in the aggregatedActionsByTaskId + the sum of the skipped task actions

*/
            aggregatedActionsByTaskId[taskId].hasMoreUpdates =
                totalTaskActionsById > aggregatedActionsByTaskId[taskId].actions.length + pageSize * (pageNumber - 1);
        }
        const result: StreamViewDataDto[] = [];
        taskActions
            .sort((a, b) => b.date.getTime() - a.date.getTime())
            .forEach((action) => {
                const taskId = action.Task.id;
                const found = result.find((entity) => entity.entityId == taskId);
                if (!found) {
                    result.push({
                        type: StreamViewOptions.Task,
                        actions: aggregatedActionsByTaskId[taskId].actions.sort(
                            (a, b) => b.date.getTime() - a.date.getTime()
                        ) as unknown as StreamActionDto[],
                        entityId: taskId,
                        entityData: aggregatedActionsByTaskId[taskId].entityData,
                        hasMoreUpdates: aggregatedActionsByTaskId[taskId].hasMoreUpdates,
                    });
                }
            });

        return {
            data: result,
            metadata: {
                totalRecords: taskActionsCount,
                pageSize,
                pageNumber,
            },
        };
    }
}
