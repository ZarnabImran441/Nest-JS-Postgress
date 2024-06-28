import {BadRequestException, Inject, Injectable, Logger, NotFoundException, UnauthorizedException} from '@nestjs/common';
import {DeleteResult, In, InsertResult, IsNull, Like, Not, Repository, UpdateResult} from 'typeorm';
import {Transactional} from 'typeorm-transactional';
import {
    ABSTRACT_AUTHORIZATION_SERVICE,
    contructorLogger,
    extractEmails,
    get_cell_value,
    get_header_row,
    JwtUserInterface,
    listToTree,
    modifyTree,
    S3Service,
} from '@lib/base-library';
import * as XLSX from 'xlsx';
import {WorkBook, WorkSheet} from 'xlsx';
import {FolderEntity} from '../../model/folder.entity';
import {TreeViewBaseService} from '../tree-view/tree-view-base.service';
import {CustomFieldDefinitionService} from '../custom-field-definition/custom-field-definition.service';
import {CreateFolderDto, TeamsDto} from '../../dto/folder/folder/create-folder.dto';
import {FolderRelationEntity} from '../../model/folder-relation.entity';
import {FolderPositionEntity} from '../../model/folder-position.entity';
import {TagTaskFolderEntity} from '../../model/tag-task-folder.entity';
import {TagTaskFolderTypeOptions} from '../../enum/tag.enum';
import {FolderViewOptions} from '../../enum/folder-position.enum';
import {
    FolderFavouriteDto,
    UpdateFolderDto,
    UpdateFolderPositionDto,
    UpdateFolderSpaceCustomFieldCollectionsDto,
    UpdateFolderSpaceTagsCollectionsDto,
} from '../../dto/folder/folder/update-folder.dto';
import {TaskRelationEntity} from '../../model/task-relation.entity';
import {FolderGanttColumnEntity} from '../../model/folder-gantt-column.entity';
import {FolderBoardColumnEntity} from '../../model/folder-board-column.entity';
import {FolderUserViewEntity} from '../../model/folder-user-view.entity';
import {FolderTaskPredecessorEntity} from '../../model/folder-task-predecessor.entity';
import {FolderFavouriteEntity} from '../../model/folder-favourite.entity';
import {FolderCustomFieldEntity} from '../../model/folder-custom-field.entity';
import {CustomFieldValueEntity} from '../../model/custom-field-value.entity';
import {TreeViewFolderEntity} from '../../model/tree-view-folder.entity';
import {GetFolderDto} from '../../dto/folder/folder/get-folder.dto';
import {ArchivedTypeOptions, DefaultViewOptions, FolderTypeOptions, FolderViewTypeOptions} from '../../enum/folder.enum';
import {ChangeWorkflowFolderDto, ChangeWorkflowOptions} from '../../dto/folder/folder/change-workflow.dto';
import {WorkFlowEntity} from '../../model/workflow.entity';
import {TaskEntity} from '../../model/task.entity';
import {MembersDto} from '../../dto/folder/folder/members.dto';
import {
    checkForFolderLoop,
    checkForFolderLoopV2,
    getImportance,
    getRelationType,
    validateCustomFieldValue,
    validateSource,
} from '../../utils/helpers';
import {FolderCustomFieldDto} from '../../dto/folder/folder/folder-custom-field.dto';
import {CustomFieldDefinitionEntity} from '../../model/custom-field-definition.entity';
import {GetFollowingFolderDto} from '../../dto/folder/folder/get-following-folder.dto';
import {TaskAttachmentEntity} from '../../model/task-attachment.entity';
import {FolderFollowerEntity} from '../../model/folder-follower.entity';
import {TaskFollowerEntity} from '../../model/task-follower.entity';
import {CreateFolderCustomFieldValueDto} from '../../dto/folder/folder/create-folder-custom-field-value.dto';
import {UpdateFolderTagsTasksDto} from '../../dto/folder-tag-task/update-tags-task-folder.dto';
import {TagEntity} from '../../model/tag.entity';
import {CopyFolderDto} from '../../dto/folder/folder/copy-folder.dto';
import {FolderFilterEntity} from '../../model/folder-filter.entity';
import {ImportanceEntity} from '../../model/importance.entity';
import {ImportTasksFromExcelDto} from '../../dto/task/import-tasks-from-excel.dto';
import {CustomFieldDefinitionTypeOptions, InheritanceTypeOptions} from '../../enum/custom-field-definition.enum';
import {FolderActionEntity} from '../../model/folder-action.entity';
import {queries} from '../../recursive-queries';
import {FolderTreeDto} from '../../dto/folder/folder/folder-tree.dto';
import {AuthorizationImplService} from '../authorization-impl/authorization-impl.service';
import {TaskService} from '../task/task.service';
import {FolderWorkflowService} from './folder-workflow/folder-workflow.service';
import {TaskTreeDto} from '../../dto/folder/folder/task-tree.dto';
import * as JSZip from 'jszip';
import {EntityTypeOptions, PermissionOptions} from '../authorization-impl/authorization.enum';
import {UserService} from '../user/user.service';
import {RawDatabaseConfig} from '../../config/database.config';
import {FolderViewDto} from '../../dto/folder/folder/folder-view.dto';
import {trim} from 'lodash';
import {UserEntity} from '../../model/user.entity';
import {NotificationEntity} from '../../model/notification.entity';
import {WorkFlowService} from '../workflow/workflow.service';
import {ArchiveFolderDto} from '../../dto/folder/folder/archive-folder.dto';
import {WorkFlowStateEntity} from '../../model/workflow-state.entity';
import {ArchivedDeletedFoldersTasksDto, ArchivedDeletedFoldersTasksResponseDto} from '../../dto/folder/folder/get-archived-deleted.dto';
import {PaginationDto} from '../../utils/pagination.dto';
import {WidgetsRelationEntity} from '../../model/widget-relation.entity';
import {FolderSpaceCustomFieldCollectionEntity} from '../../model/folder-space-custom-field-collections.entity';
import {FolderSpaceTagsCollectionEntity} from '../../model/folder-space-labels-collection.entity';
import {FolderSpaceTeamEntity} from '../../model/folder-space-team.entity';
import {SpaceService} from '../space/space.service';
import {FolderSpaceWorkflowEntity} from '../../model/folder-space-workflow.entity';
/**
 * Class representing a FolderBaseService.
 *
 * @class
 */
@Injectable()
export class FolderBaseService {
    protected logger: Logger;
    private TITLE = 'Title';
    private DESCRIPTION = 'Description';
    private START_DATE = 'Start Date';
    private END_DATE = 'End Date';
    private KEY = 'Key';
    private PARENT_TASK = 'Parent task';
    private ASSIGNED_TO = 'Assigned To';
    private DEPENDS_ON = 'Depends On';
    private PRIORITY = 'Priority';
    private FOLDER = 'Folder';
    private DEFAULT_PROJECT_WORKFLOW = 'Default project workflow';
    private CUSTOM_STATUS = 'Custom status';
    private DURATION = 'Duration (Hours)';
    private EFFORT = 'Effort';
    private START_DATE_CONSTRAINT = 'Start Date Constraint';

    /**
     * Constructs a new instance of the class.
     *
     * @param {Repository<FolderEntity>} repoFolder - The repository for managing folder entities.
     * @param {TreeViewBaseService} treeViewService - The service for managing tree view.
     * @param {CustomFieldDefinitionService} customFieldDefinitionService - The service for managing custom field definitions.
     * @param {TaskService} taskService - The service for managing tasks.
     * @param {SpaceService} spaceService - The service for managing spaces.
     * @param {UserService} userService - The service for managing users.
     * @param {S3Service} s3Service - The service for managing S3.
     * @param {AuthorizationImplService} authorization - The authorization service.
     * @param {FolderWorkflowService} folderWorkflowService - The service for managing folder workflows.
     * @param {WorkFlowService} workflowService - The service for managing workflows.
     *
     * @return {void}
     */
    constructor(
        protected readonly repoFolder: Repository<FolderEntity>,
        protected readonly treeViewService: TreeViewBaseService,
        protected readonly customFieldDefinitionService: CustomFieldDefinitionService,
        protected readonly taskService: TaskService,
        protected readonly userService: UserService,
        protected readonly spaceService: SpaceService,
        protected readonly s3Service: S3Service,
        @Inject(ABSTRACT_AUTHORIZATION_SERVICE) protected readonly authorization: AuthorizationImplService,
        protected readonly folderWorkflowService: FolderWorkflowService,
        protected readonly workflowService: WorkFlowService
    ) {
        this.logger = new Logger(this.constructor.name);
        contructorLogger(this);
    }

    /**
     * This method creates a new folder in the system.
     *
     * @param {CreateFolderDto} dto - The data transfer object containing folder details.
     * @param {string} userId - The ID of the user creating the folder.
     * @param {number} parentFolderId - (Optional) The ID of the parent folder if the folder is being created inside another folder.
     *
     * @return {Promise<FolderEntity>} - A Promise that resolves to the created FolderEntity.
     *
     * @throws {Error} - If there is an error while creating the folder.
     *
     * @Transactional() - This method is wrapped in a transaction to ensure atomicity.
     */
    @Transactional()
    async createFolder(
        dto: CreateFolderDto,
        userId: string,
        parentFolderId: number,
        entityType: EntityTypeOptions = EntityTypeOptions.Folder
    ): Promise<FolderEntity> {
        const manager = this.repoFolder.manager;
        const repoFolder = manager.getRepository<FolderEntity>(FolderEntity),
            repoFolderRelation = manager.getRepository<FolderRelationEntity>(FolderRelationEntity),
            repoFolderPosition = manager.getRepository<FolderPositionEntity>(FolderPositionEntity),
            repoTagTaskFolder = manager.getRepository<TagTaskFolderEntity>(TagTaskFolderEntity),
            repoFolderSpaceCustomFieldsCollections = manager.getRepository<FolderSpaceCustomFieldCollectionEntity>(
                FolderSpaceCustomFieldCollectionEntity
            ),
            repoFolderTagsCollections = manager.getRepository<FolderSpaceTagsCollectionEntity>(FolderSpaceTagsCollectionEntity),
            repoFolderSpaceTeams = manager.getRepository<FolderSpaceTeamEntity>(FolderSpaceTeamEntity),
            folderFollowerRepo = this.repoFolder.manager.getRepository<FolderFollowerEntity>(FolderFollowerEntity);

        //Source cannot be a empty string

        validateSource(dto.source);

        const folderDB: FolderEntity = await repoFolder.save({
            color: dto.color,
            description: dto.description,
            endDate: dto.endDate,
            icon: dto.icon ? dto.icon : null,
            startDate: dto.startDate || new Date(),
            title: dto.title,
            viewType: dto.viewType,
            folderType: dto.folderType,
            defaultView: dto.defaultView,
            availableViews: [{name: dto.defaultView, index: 1}],
            userId,
            source: dto.source,
            showOn: dto.showOn,
            extra: dto.extra ? dto.extra : null,
            createdBy: userId,
            createdAt: new Date(),
        });

        if (parentFolderId) {
            // Get the parent folder entity
            const parentFolderEntity = await repoFolderRelation.findOneBy({
                childFolderId: parentFolderId,
                isBind: false,
            });

            // add folder relation
            const folderRelation = await repoFolderRelation.save({
                ChildFolder: {id: folderDB.id},
                ParentFolder: {id: parentFolderId},
                pathStr: [...parentFolderEntity.pathStr, folderDB.title],
                pathIds: [...parentFolderEntity.pathIds, folderDB.id],
            });

            // set index on ROOT view
            const newIndex = await repoFolderPosition
                .createQueryBuilder('FolderPosition')
                .select('COALESCE(MAX(index), 0) + 1', 'index')
                .innerJoin('FolderPosition.FolderRelation', 'FolderRelation')
                .innerJoin('FolderRelation.ParentFolder', 'ParentFolder')
                .where({
                    userId,
                    view: FolderViewOptions.ROOT,
                    FolderRelation: {ParentFolder: {id: parentFolderId}},
                })
                .getRawOne();
            await repoFolderPosition.insert({
                FolderRelation: {id: folderRelation.id},
                userId,
                view: FolderViewOptions.ROOT,
                index: newIndex ? newIndex.index : 0,
            });
        } else {
            // add folder relation
            const folderRelation = await repoFolderRelation.save({
                ChildFolder: {id: folderDB.id},
                ParentFolder: null,
                pathStr: [folderDB.title],
                pathIds: [folderDB.id],
            });
            // set index on ROOT view
            const newIndex = await repoFolderPosition
                .createQueryBuilder('FolderPosition')
                .select('COALESCE(MAX(index + 1), 0)', 'index')
                .leftJoin('FolderPosition.FolderRelation', 'FolderRelation')
                .leftJoin('FolderRelation.ParentFolder', 'ParentFolder')
                .where({
                    FolderRelation: {ParentFolder: IsNull()},
                    userId,
                    view: FolderViewOptions.ROOT,
                })
                .getRawOne();
            await repoFolderPosition.insert({
                FolderRelation: {id: folderRelation.id},
                userId,
                view: FolderViewOptions.ROOT,
                index: newIndex ? newIndex.index : 0,
            });
        }

        this.logger.debug(`Set workflow to folder ${folderDB.id}`);

        const spaceId = await this.spaceService.getSpaceFromFolderId(folderDB.id);

        //create a function to validate space properties

        if (dto.tags && dto.tags.length > 0) {
            //** validate that the tags should be one of the space tags */
            if (spaceId && dto.folderType != FolderTypeOptions.SPACE) {
                this.logger.debug(`Validating Tags on folders`);
                await this.validateTagsOnFolders(spaceId, dto.tags);
            }

            for (const tagId of dto.tags) {
                this.logger.debug(`Inserting folder tag`);
                await repoTagTaskFolder.insert({
                    Tag: {id: tagId},
                    Folder: folderDB,
                    type: TagTaskFolderTypeOptions.FOLDER_TAG,
                });
            }
        }

        //if type is not space then we will assign workflow
        if (dto.workflow) {
            if (dto.workflow.commonWorkflow !== null && dto.folderType != FolderTypeOptions.SPACE && spaceId) {
                this.logger.debug(`Validating workflows on folders`);
                await this.validateWorkflowsOnFolders(spaceId, dto.workflow.commonWorkflow);
            }
            await this.changeWorkflow(folderDB.id, dto.workflow, userId, entityType);
        }

        if (dto.customFieldValues) {
            this.logger.debug(`Adding custom field value to folder`);
            await this.addFolderCustomFieldValue(folderDB.id, dto.customFieldValues, userId, entityType);
        }

        // //** Assign teams to the folder if we found them in dto */
        if (dto.teams) {
            if (spaceId && dto.folderType != FolderTypeOptions.SPACE) {
                this.logger.debug(`Validating teams`);
                await this.validateTeams(spaceId, dto.teams);
            }
            for (const team of dto.teams) {
                //** todo : grant permissions to the teams on folder level*/
                await repoFolderSpaceTeams.insert({
                    Folder: {id: folderDB.id},
                    Team: {id: team.id},
                    teamPermissions: team.teamPermission,
                });
            }
        }

        //** Assign custom fields to the folder if we found them in dto */
        if (dto.customFieldCollections && dto.customFieldCollections.length > 0) {
            if (spaceId && entityType !== EntityTypeOptions.Space) {
                // Retrieve custom field collections associated with the space
                this.logger.debug(`Validating custom field collections`);
                await this.validateCustomFieldCollections(spaceId, dto.customFieldCollections);
            }
            for (const collectionId of dto.customFieldCollections) {
                await repoFolderSpaceCustomFieldsCollections.insert({
                    Folder: {id: folderDB.id},
                    CustomFieldCollection: {id: collectionId},
                });
            }
        }

        //** Assign tags collections to the space */
        if (dto.tagsCollections && dto.tagsCollections.length > 0) {
            if (spaceId && entityType !== EntityTypeOptions.Space) {
                this.logger.debug(`Validating tags collections`);
                await this.validateTagsCollections(spaceId, dto.tagsCollections);
            }
            for (const tagsCollectionId of dto.tagsCollections) {
                await repoFolderTagsCollections.insert({
                    Folder: {id: folderDB.id},
                    TagsCollection: {id: tagsCollectionId},
                });
            }
        }

        if (dto.activeView) {
            const {id, body} = dto.activeView;
            body.folderIds?.push(folderDB.id);
            this.logger.debug(`Updating tree view`);
            await this.treeViewService.update(id, body, userId);
        }

        // Make creator a folder watcher
        await folderFollowerRepo.insert({Folder: {id: folderDB.id}, userId});

        return folderDB;
    }
    private async validateTagsCollections(spaceId: number, tagsCollections: number[]): Promise<boolean> {
        // Retrieve tag collections associated with the space
        const repoFolderTagsCollections =
            this.repoFolder.manager.getRepository<FolderSpaceTagsCollectionEntity>(FolderSpaceTagsCollectionEntity);
        const spaceFolderTagsCollections = await repoFolderTagsCollections.find({
            where: {Folder: {id: spaceId}},
        });
        const spaceTagCollectionIds = spaceFolderTagsCollections?.map((sf) => sf.tagCollectionId);

        // Check if all provided tag collection IDs are valid for the space
        const allTagsValid = tagsCollections.every((tagsCollectionId) => spaceTagCollectionIds?.includes(tagsCollectionId));

        if (!spaceFolderTagsCollections.length || !allTagsValid) {
            throw new BadRequestException('Not all tags are in space tags collections list');
        }
        return true;
    }

    private async validateCustomFieldCollections(spaceId: number, customFieldCollections: number[]): Promise<boolean> {
        const repoFolderSpaceCustomFieldsCollections = this.repoFolder.manager.getRepository<FolderSpaceCustomFieldCollectionEntity>(
            FolderSpaceCustomFieldCollectionEntity
        );
        const spaceCustomFieldCollections = await repoFolderSpaceCustomFieldsCollections.find({
            where: {Folder: {id: spaceId}},
        });

        const spaceCustomFieldCollectionIds = spaceCustomFieldCollections?.map((sc) => sc.customFieldCollectionId);

        // Check if all provided custom field collections are valid for the space
        const allCollectionsValid = customFieldCollections.every((collectionId) => spaceCustomFieldCollectionIds?.includes(collectionId));

        if (!spaceCustomFieldCollections.length || !allCollectionsValid) {
            throw new BadRequestException('Not all custom field collections are in space custom field collections list');
        }
        return true;
    }

    /**
     * Update the custom field collections for a space.
     *
     * @param {number} spaceId - The ID of the space.
     * @param {UpdateFolderSpaceCustomFieldCollectionsDto} dto - The data transfer object.
     * @return {Promise<void>} - A promise that resolves when the update is complete.
     */
    @Transactional()
    async updateOneFolderCustomFieldCollections(
        folderId: number,
        dto: UpdateFolderSpaceCustomFieldCollectionsDto,
        entityType: EntityTypeOptions
    ): Promise<void> {
        //** get space Id */
        const repoFolderSpaceCustomFieldsCollections = this.repoFolder.manager.getRepository<FolderSpaceCustomFieldCollectionEntity>(
            FolderSpaceCustomFieldCollectionEntity
        );

        const spaceId = await this.spaceService.getSpaceFromFolderId(folderId);

        if (dto?.insert.length) {
            //** Validate custom fields */
            if (spaceId && entityType != EntityTypeOptions.Space) {
                await this.validateCustomFieldCollections(spaceId, dto.insert);
            }
            for (const collectionId of dto.insert) {
                await repoFolderSpaceCustomFieldsCollections.insert({
                    Folder: {id: folderId},
                    CustomFieldCollection: {id: collectionId},
                });
            }
        }

        if (dto?.delete.length) {
            //** todo : revoke permissions of the custom fields on folder level*/
            for (const collectionId of dto.delete) {
                await repoFolderSpaceCustomFieldsCollections.delete({
                    Folder: {id: folderId},
                    CustomFieldCollection: {id: collectionId},
                });
            }
        }

        return;
    }

    /**
     * Updates the collections of tags for a specific space.
     * This method inserts or deletes the specified collections from the space's tags collections.
     *
     * @param {number} folderId - The ID of the space.
     * @param {UpdateSpaceTagsCollectionsDto} dto - The data transfer object containing the collections to insert or delete.
     * @returns {Promise<void>} - A promise that resolves with no value upon successful update.
     *
     * @throws {Error} - If an error occurs during the update process.
     *
     * @example

     */
    @Transactional()
    async updateOneFolderTagsCollections(
        folderId: number,
        dto: UpdateFolderSpaceTagsCollectionsDto,
        entityType: EntityTypeOptions
    ): Promise<void> {
        try {
            const repoFolderTagsCollections =
                this.repoFolder.manager.getRepository<FolderSpaceTagsCollectionEntity>(FolderSpaceTagsCollectionEntity);

            const spaceID = await this.spaceService.getSpaceFromFolderId(folderId);

            if (dto?.insert.length) {
                //** validate */
                if (spaceID && entityType != EntityTypeOptions.Space) {
                    await this.validateTagsCollections(spaceID, dto.insert);
                }
                for (const collectionId of dto.insert) {
                    await repoFolderTagsCollections.insert({
                        Folder: {id: folderId},
                        TagsCollection: {id: collectionId},
                    });
                }
            }

            if (dto?.delete.length) {
                for (const collectionId of dto.delete) {
                    await repoFolderTagsCollections.delete({
                        Folder: {id: folderId},
                        TagsCollection: {id: collectionId},
                    });
                }
            }

            return;
        } catch (error) {
            this.logger.error(`An error occurred while updating collections of tags for a folder/space : ${dto}, id: ${folderId}`, error);
            throw error;
        }
    }

    /**
     * Updates a folder with the provided data.
     *
     * @param {number} folderId - The ID of the folder to update.
     * @param {UpdateFolderDto} dto - The updated folder data.
     * @param {UserEntity | JwtUserInterface} user - The user or JWT user performing the update.
     * @return {Promise<UpdateResult>} A Promise that resolves to the update result.
     * @throws {Error} If there was an error updating the folder.
     */
    @Transactional()
    async updateFolder(
        folderId: number,
        dto: UpdateFolderDto,
        user: UserEntity | JwtUserInterface,
        entityType: EntityTypeOptions = EntityTypeOptions.Folder
    ): Promise<UpdateResult> {
        const manager = this.repoFolder.manager;
        try {
            const repoFolder = manager.getRepository<FolderEntity>(FolderEntity);
            const folderView = await repoFolder.findOne({
                where: {id: folderId},
                select: ['availableViews'],
            });
            const availableViews = folderView.availableViews as FolderViewDto[];

            if (dto.defaultView) {
                const defaultViewExists = availableViews.some((view) => view.name === dto.defaultView);

                if (!defaultViewExists) {
                    availableViews.push({
                        name: dto.defaultView,
                        index: availableViews.length + 1,
                    });
                }
            }

            if (dto.customFieldCollections) {
                await this.updateOneFolderCustomFieldCollections(folderId, dto.customFieldCollections, entityType);
                delete dto['customFieldCollections'];
            }

            if (dto.tagsCollection) {
                await this.updateOneFolderTagsCollections(folderId, dto.tagsCollection, entityType);
                delete dto['tagsCollection'];
            }

            dto['availableViews'] = availableViews;
            const updatedFolder = await repoFolder.update(folderId, {...dto, updatedAt: new Date(), updatedBy: user.id, id: folderId});
            if (dto.startDate || dto.endDate) {
                const folder = await repoFolder.findOne({
                    where: {id: folderId, FolderTasks: {ChildTask: {archivedAt: null, deletedAt: null}}},
                    relations: {FolderTasks: {ChildTask: true}},
                });
                if (!folder) return updatedFolder;
                for (const task of folder.FolderTasks) {
                    const {id, startDate, endDate} = task.ChildTask;
                    await this.taskService.updateChildTaskDate(dto.startDate, dto.endDate, startDate, endDate, id, user);
                }
            }

            return updatedFolder;
        } catch (e) {
            this.logger.error(
                `There was an error updating a ${
                    entityType === EntityTypeOptions.Space ? 'space' : 'folder'
                } ${folderId} - [${JSON.stringify(dto)}]`,
                e
            );
            throw e;
        }
    }

    /**
     * Deletes a folder and all associated data permanently from the database.
     *
     * @param {number} folderId - The ID of the folder to be deleted.
     * @returns {Promise<DeleteResult>} - A Promise that resolves to the deletion result.
     *
     * @throws {Error} - If there is an error while deleting the folder.
     *
     * @example
     * await permanentDeleteFolder(1);
     */
    @Transactional()
    async permanentDeleteFolder(folderId: number): Promise<FolderEntity> {
        const manager = this.repoFolder.manager;
        const repoFolder = manager.getRepository<FolderEntity>(FolderEntity),
            repoTaskRelation = manager.getRepository<TaskRelationEntity>(TaskRelationEntity),
            repoWorkFlowState = manager.getRepository<WorkFlowStateEntity>(WorkFlowStateEntity),
            repoFolderGanntColumn = manager.getRepository<FolderGanttColumnEntity>(FolderGanttColumnEntity),
            repoFolderBoardColumn = manager.getRepository<FolderBoardColumnEntity>(FolderBoardColumnEntity),
            // repoFolderUserView = manager.getRepository<FolderUserViewEntity>(FolderUserViewEntity),
            repoFolderTaskPredecessor = manager.getRepository<FolderTaskPredecessorEntity>(FolderTaskPredecessorEntity),
            widgetsRelationEntity = manager.getRepository(WidgetsRelationEntity),
            repoFolderRelation = manager.getRepository<FolderRelationEntity>(FolderRelationEntity),
            repoFolderPosition = manager.getRepository<FolderPositionEntity>(FolderPositionEntity),
            repoFolderFavourite = manager.getRepository<FolderFavouriteEntity>(FolderFavouriteEntity),
            repoTagTaskFolder = manager.getRepository<TagTaskFolderEntity>(TagTaskFolderEntity),
            repoFolderCustomField = manager.getRepository<FolderCustomFieldEntity>(FolderCustomFieldEntity),
            repoCustomFieldValue = manager.getRepository<CustomFieldValueEntity>(CustomFieldValueEntity),
            repoFolderTreeView = manager.getRepository<TreeViewFolderEntity>(TreeViewFolderEntity),
            repoFolderAction = manager.getRepository<FolderActionEntity>(FolderActionEntity),
            repoNotification = manager.getRepository<NotificationEntity>(NotificationEntity);

        const relationParent = await repoFolderRelation.find({
            select: {id: true},
            where: {ParentFolder: {id: folderId}},
        });

        const relationChild = await repoFolderRelation.find({
            select: {id: true},
            where: {ChildFolder: {id: folderId}},
        });
        await repoFolderPosition.delete({folderRelationId: In(relationChild.map((x) => x.id))});
        await repoFolderPosition.delete({folderRelationId: In(relationParent.map((x) => x.id))});
        const childFolderRelationToRemove = await repoFolderRelation.findBy({ChildFolder: {id: folderId}});
        await repoFolderRelation.remove(childFolderRelationToRemove);
        const parentFolderRelationToRemove = await repoFolderRelation.findBy({ParentFolder: {id: folderId}});
        await repoFolderRelation.remove(parentFolderRelationToRemove);
        await repoFolderGanntColumn.delete({Folder: {id: folderId}});
        await repoFolderBoardColumn.delete({Folder: {id: folderId}});
        const tagTaskFolderToRemove = await repoTagTaskFolder.findBy({Folder: {id: folderId}});
        await repoTagTaskFolder.remove(tagTaskFolderToRemove);
        await repoFolderCustomField.delete({Folder: {id: folderId}});
        const customFieldValueToRemove = await repoCustomFieldValue.findBy({Folder: {id: folderId}});
        await repoCustomFieldValue.remove(customFieldValueToRemove);
        await widgetsRelationEntity.delete({folderId});

        // delete task predecessor
        await repoFolderTaskPredecessor.delete({Folder: {id: folderId}});
        const workflowStates = await repoWorkFlowState.find({
            select: {id: true},
            where: {WorkFlow: {Folders: {id: In([folderId])}}},
        });
        await repoTaskRelation.delete({WorkFlowState: {id: In(workflowStates.map((x) => x.id))}});
        await repoFolderTreeView.delete({Folder: {id: folderId}});
        await repoFolderAction.delete({Folder: {id: folderId}});
        await repoNotification.delete({folder: {id: folderId}});
        await repoFolderFavourite.delete({Folder: {id: folderId}});
        const folderToRemove = await repoFolder.findOneBy({id: folderId});
        return await repoFolder.remove(folderToRemove);
    }

    /**
     * Archives a folder.
     *
     * @param {number} folderId - The ID of the folder to be archived.
     * @param {string} userId - The ID of the user who is performing the archiving.
     * @param {ArchiveFolderDto} [dto] - Optional DTO (Data Transfer Object) containing additional information for archiving the folder.
     * @returns {Promise<void>} Resolves when the folder and its contents have been archived successfully.
     * @throws {Error} If there was an error archiving the folder.
     * @since 1.0.0
     */
    @Transactional()
    async archive(folderId: number, userId: string, folderTypes: FolderTypeOptions[], dto?: ArchiveFolderDto): Promise<void> {
        const manager = this.repoFolder.manager;
        const repoFolder = manager.getRepository<FolderEntity>(FolderEntity.name);
        //This check is to identify that we are not trying to archive a deleted folder
        const folderDB = await repoFolder.findOne({where: {id: folderId, deletedAt: IsNull(), folderType: In(folderTypes)}});
        if (!folderDB) {
            throw new NotFoundException();
        }
        await repoFolder.update(
            {id: folderId},
            {
                archivedAt: new Date(),
                archivedBy: userId,
                archivedWhy: dto?.archiveReason ?? '',
                id: folderId,
            }
        );
        return await this.archiveRecursive(folderId, userId, dto);
    }

    /**
     * Deletes a folder and all its contents recursively.
     *
     * @param {number} folderId - The ID of the folder to delete.
     * @param {string} userId - The ID of the user performing the deletion.
     * @returns {Promise<void>} - A promise that resolves when the deletion is complete.
     *
     * @throws {Error} - If there is an error deleting the folder.
     */
    @Transactional()
    async delete(folderId: number, userId: string, folderTypes: FolderTypeOptions[]): Promise<void> {
        const manager = this.repoFolder.manager;
        try {
            const repoFolder = manager.getRepository<FolderEntity>(FolderEntity.name);
            await repoFolder.update(
                {id: folderId, folderType: In(folderTypes)},
                {archivedAt: null, archivedBy: null, archivedWhy: null, deletedAt: new Date(), deletedBy: userId, id: folderId}
            );
            return await this.deleteRecursive(folderId, userId);
        } catch (err) {
            const isSpace = folderTypes.find((type) => type === FolderTypeOptions.SPACE);
            this.logger.error(`There was an error deleting ${isSpace ? 'space' : 'folder'} ${folderId}`, JSON.stringify(err));
            throw err;
        }
    }

    /**
     * Archives a folder and its children recursively.
     * @param {number} parentFolderId - The ID of the parent folder.
     * @param {string} userId - The ID of the user performing the archive.
     * @param {ArchiveFolderDto} [dto] - Optional DTO containing archive information.
     * @returns {Promise<void>} Returns a promise that resolves when the archive process is complete.
     */
    @Transactional()
    async archiveRecursive(parentFolderId: number, userId: string, dto?: ArchiveFolderDto): Promise<void> {
        const manager = this.repoFolder.manager,
            repoFolderRelation = manager.getRepository<FolderRelationEntity>(FolderRelationEntity),
            repoFolderPosition = manager.getRepository<FolderPositionEntity>(FolderPositionEntity),
            repoFolder = manager.getRepository<FolderEntity>(FolderEntity),
            childrenFoldersDB = await repoFolderRelation.find({
                where: {ParentFolder: {id: parentFolderId}, ChildFolder: {archivedAt: null}, isBind: false},
                relations: {ChildFolder: true, ParentFolder: true},
            });
        for (const folderRelationDB of childrenFoldersDB) {
            const archivedParents = await repoFolderRelation
                .createQueryBuilder('FR')
                .innerJoin('FR.ParentFolder', 'ParentFolder', 'ParentFolder.archived_at IS NULL')
                .where('FR.child_folder_id = :childFolderId', {childFolderId: folderRelationDB.ChildFolder.id})
                .andWhere('FR.is_bind = false')
                .getCount();
            if (archivedParents === 0) {
                await repoFolder.update(
                    {id: folderRelationDB.ChildFolder.id},
                    {archivedAt: new Date(), archivedWhy: dto?.archiveReason ?? '', archivedBy: userId, id: folderRelationDB.ChildFolder.id}
                );
                await this.archiveRecursive(folderRelationDB.ChildFolder.id, userId, dto);
            }

            //Note : The else condition will run's because we have already archived the parent in the func "archive()".
            else {
                await repoFolderPosition.delete({
                    folderRelationId: folderRelationDB.id,
                });
                const folderRelationToRemove = await repoFolderRelation.findBy({id: folderRelationDB.id});
                await repoFolderRelation.remove(folderRelationToRemove);
            }
        }
    }

    /**
     * Deletes a folder and all its children recursively. Any parent-child relationships associated with the deleted folders are also removed.
     *
     * @param {number} parentFolderId - The ID of the parent folder to delete.
     * @param {string} userId - The ID of the user performing the deletion.
     * @return {Promise<void>} - A promise that resolves when the deletion is complete.
     */
    @Transactional()
    async deleteRecursive(parentFolderId: number, userId: string): Promise<void> {
        const manager = this.repoFolder.manager,
            repoFolderRelation = manager.getRepository<FolderRelationEntity>(FolderRelationEntity),
            repoFolderPosition = manager.getRepository<FolderPositionEntity>(FolderPositionEntity),
            repoFolder = manager.getRepository<FolderEntity>(FolderEntity),
            childrenFoldersDB = await repoFolderRelation.find({
                where: {ParentFolder: {id: parentFolderId}, ChildFolder: {deletedAt: null}, isBind: false},
                relations: {ChildFolder: true, ParentFolder: true},
            });
        for (const folderRelationDB of childrenFoldersDB) {
            const archivedParents = await repoFolderRelation
                .createQueryBuilder('FR')
                .innerJoin('FR.ParentFolder', 'ParentFolder', 'ParentFolder.deleted_at IS NULL')
                .where('FR.child_folder_id = :childFolderId', {childFolderId: folderRelationDB.ChildFolder.id})
                .getCount();
            if (archivedParents === 0) {
                await repoFolder.update(
                    {id: folderRelationDB.ChildFolder.id},
                    {deletedAt: new Date(), deletedBy: userId, id: folderRelationDB.ChildFolder.id}
                );
                await this.deleteRecursive(folderRelationDB.ChildFolder.id, userId);
            }

            //Note : The else condition will run's because we have already archived the parent in the func "delete()".
            else {
                await repoFolderPosition.delete({
                    folderRelationId: folderRelationDB.id,
                });
                const folderRelationToRemove = await repoFolderRelation.findBy({id: folderRelationDB.id});
                await repoFolderRelation.remove(folderRelationToRemove);
            }
        }
    }

    /**
     * Restores an archived folder and its children recursively.
     *
     * @param {number} parentFolderId - The ID of the parent folder.
     * @returns {Promise<void>} - A Promise that resolves when the restoration is complete.
     */
    @Transactional()
    async restoreArchivedFolderRecursive(parentFolderId: number): Promise<void> {
        const manager = this.repoFolder.manager;
        const repoFolderRelation = manager.getRepository<FolderRelationEntity>(FolderRelationEntity),
            repoFolder = manager.getRepository<FolderEntity>(FolderEntity),
            childrenFoldersDB = await repoFolderRelation.find({
                where: {ParentFolder: {id: parentFolderId}},
                relations: {ChildFolder: true, ParentFolder: true},
            });

        for (const folderRelationDB of childrenFoldersDB) {
            // Update folder
            await repoFolder.update(
                {id: folderRelationDB.ChildFolder.id},
                {
                    archivedAt: null,
                    archivedWhy: '',
                    archivedBy: null,
                    id: folderRelationDB.ChildFolder.id,
                }
            );
            await this.restoreArchivedFolderRecursive(folderRelationDB.ChildFolder.id);
        }
    }

    /**
     * Restores the deleted folder recursively.
     * @param {number} parentFolderId - The ID of the parent folder.
     * @returns {Promise<void>} - A Promise that resolves when the folders have been restored.
     * @throws {Error} - If an error occurs while restoring the folders.
     * @async
     * @Transactional()
     */
    @Transactional()
    async restoreDeletedFolderRecursive(parentFolderId: number): Promise<void> {
        const manager = this.repoFolder.manager;
        const repoFolderRelation = manager.getRepository<FolderRelationEntity>(FolderRelationEntity),
            repoFolder = manager.getRepository<FolderEntity>(FolderEntity),
            childrenFoldersDB = await repoFolderRelation.find({
                where: {ParentFolder: {id: parentFolderId}},
                relations: {ChildFolder: true, ParentFolder: true},
            });

        for (const folderRelationDB of childrenFoldersDB) {
            // Update folder
            await repoFolder.update(
                {id: folderRelationDB.ChildFolder.id},
                {
                    deletedAt: null,
                    deletedWhy: '',
                    deletedBy: null,
                    id: folderRelationDB.ChildFolder.id,
                }
            );
            await this.restoreArchivedFolderRecursive(folderRelationDB.ChildFolder.id);
        }
    }

    /**
     * Restores an archived folder by setting its archivedAt, archivedWhy, and archivedBy properties to null.
     * Also restores any child folders recursively.
     * @param {number} folderId - The ID of the folder to restore.
     * @returns {Promise<void>} - A promise that resolves when the restoration is complete.
     */
    @Transactional()
    async restoreArchivedFolder(folderId: number, folderTypes: FolderTypeOptions[], user?: JwtUserInterface): Promise<void> {
        const manager = this.repoFolder.manager;
        try {
            const repoFolderRelation = manager.getRepository<FolderRelationEntity>(FolderRelationEntity),
                repoFolderPosition = manager.getRepository<FolderPositionEntity>(FolderPositionEntity),
                repoFolder = manager.getRepository<FolderEntity>(FolderEntity),
                folderDB = await repoFolder.findOne({
                    where: {id: folderId, archivedAt: null, deletedAt: IsNull(), folderType: In(folderTypes)},
                    relations: {ChildrenFolders: true},
                });

            if (!folderDB) {
                throw new NotFoundException();
            }

            await repoFolder.update(folderDB.id, {archivedAt: null, archivedWhy: '', archivedBy: null, id: folderDB.id});
            await this.restoreArchivedFolderRecursive(folderId);

            const isSpace = folderTypes.find((type) => type === FolderTypeOptions.SPACE);
            // check if the parent folder is also archived, if so, send the folder to root and delete all binding relation. Skip check if restoring a space
            if (folderDB.ChildrenFolders?.length && user && !isSpace) {
                for (const relation of folderDB.ChildrenFolders) {
                    const checkParentIsArchived = await repoFolder.exists({
                        where: {id: relation.parentFolderId, archivedAt: Not(IsNull()), archivedBy: Not(IsNull())},
                    });
                    if (checkParentIsArchived) {
                        const spaceId = await this.spaceService.getSpaceFromFolderId(folderDB.id, true);

                        //delete the relation, including bind relations
                        await repoFolderPosition.delete({folderRelationId: relation.id, userId: user.id});
                        const folderRelatioToRemove = await repoFolderRelation.findBy({id: relation.id});
                        await repoFolderRelation.remove(folderRelatioToRemove);

                        // Remove inherited Permission
                        await this.authorization.updateEntityPosition(EntityTypeOptions.Folder, folderId);

                        // send folder back to space 🚀 if it was not a bind copy
                        if (!relation.isBind) {
                            const newParent = await repoFolderRelation.findOne({
                                where: {
                                    ChildFolder: {id: spaceId},
                                },
                            });

                            const newFolderRelation = await repoFolderRelation.save({
                                ParentFolder: {id: spaceId},
                                ChildFolder: {id: folderDB.id},
                                pathIds: [...newParent.pathIds, folderDB.id],
                                pathStr: [...newParent.pathStr, folderDB.title],
                            });

                            await repoFolderPosition.insert({
                                FolderRelation: {id: newFolderRelation.id},
                                userId: user.id,
                                view: FolderViewOptions.ROOT,
                                index: 99999,
                            });
                        }
                    }
                }
            }
        } catch (err) {
            this.logger.error(`There was an error restoring archived folder ${folderId}`, err);
            throw err;
        }
    }

    /**
     * Restores a deleted folder and all its subfolders recursively.
     *
     * @param {number} folderId - The ID of the folder to restore.
     * @return {Promise<void>} - Resolves when the folder and its subfolders are restored successfully.
     * @throws {Error} - If there was an error restoring the folder.
     */
    @Transactional()
    async restoreDeletedFolder(folderId: number): Promise<void> {
        const manager = this.repoFolder.manager;
        try {
            const repoFolder = manager.getRepository<FolderEntity>(FolderEntity),
                folderDB = await repoFolder.findOne({where: {id: folderId, deletedAt: null}});

            await repoFolder.update(folderDB.id, {deletedAt: null, deletedWhy: '', deletedBy: null, id: folderDB.id});
            await this.restoreDeletedFolderRecursive(folderId);
        } catch (err) {
            this.logger.error(`There was an error restoring archived folder ${folderId}`, err);
            throw err;
        }
    }

    //done
    /**
     * Retrieves a single folder based on the given parameters.
     *
     * @param {number} folderId - The ID of the folder.
     * @param {string} showOn - The value to match against the "SHOW_ON" field.
     * @param {string} userId - The ID of the user.
     * @param {boolean} [showArchived=false] - An optional flag indicating whether to include archived folders. Default is false.
     * @returns {Promise<GetFolderDto>} A promise that resolves with the retrieved folder data, or null if no folder is found.
     */
    async getOne(folderId: number, showOn: string, userId: string, showArchived?: boolean): Promise<GetFolderDto> {
        const sql = queries.folder.concat(
            ` WHERE (F.ID = $2) AND ($3 = ANY (F.SHOW_ON)) ${
                !showArchived ? 'AND (F.archived_at IS NULL)' : ''
            }  AND (F.folder_type = 'space' OR F.folder_type = 'folder' OR F.folder_type = 'project') `
        );

        //add teams with members
        const result = await this.repoFolder.query(sql, [userId, folderId, showOn]);

        if (result.length) {
            const members = this.spaceService.filterMembersNotInAnyTeam(result[0].teams, result[0].members);

            const responseData = {
                ...result[0],
                customFields: result[0].customFields.filter(
                    (field) => field.CustomFieldDefinition.userId === userId || field.CustomFieldDefinition.userId === null
                ),
                members,
            };
            return responseData;
        }
        throw new NotFoundException(`Folder with id :${folderId} not found`);
    }

    /**
     * Retrieves one archived folder by its ID.
     * @param {number} folderId - The ID of the folder to retrieve.
     * @param {string} userId - The ID of the user.
     * @returns {Promise<GetFolderDto>} - A Promise that resolves to the retrieved folder DTO if found, otherwise null.
     */
    async getOneArchive(folderId: number, userId: string): Promise<GetFolderDto> {
        const sql = queries.folder + ` WHERE (F.archived_at IS NOT NULL )  AND (F.ID = $2)`;
        const result = await this.repoFolder.query(sql, [userId, folderId]);
        if (result.length) {
            return result[0];
        }
        return null;
    }

    /**
     * Retrieves a deleted folder by its ID.
     *
     * @param {number} folderId - The ID of the folder to retrieve.
     * @param {string} userId - The ID of the user.
     * @return {Promise<GetFolderDto>} - A Promise that resolves to the deleted folder.
     *                                  If no deleted folder is found, the Promise resolves to null.
     */
    async getOneDelete(folderId: number, userId: string): Promise<GetFolderDto> {
        const sql = queries.folder + ` WHERE (F.deleted_at IS NOT NULL) AND (F.ID = $2)`;
        const result = await this.repoFolder.query(sql, [userId, folderId]);
        if (result.length) {
            return result[0];
        }
        return null;
    }

    /**
     * Retrieves multiple archived folders.
     *
     * @returns {Promise<FolderEntity[]>} A promise that resolves to an array of FolderEntity objects representing the archived folders.
     */
    async getManyArchivedFolders(): Promise<FolderEntity[]> {
        const manager = this.repoFolder.manager;
        const repoFolder = manager.getRepository<FolderEntity>(FolderEntity);
        return await repoFolder.find({where: {archivedAt: Not(IsNull())}});
    }

    /**
     * Retrieves multiple folders based on the specified showOn value.
     *
     * @param {string} showOn - The value to filter the folders by.
     * @param {string} userId - The ID of the user.
     * @returns {Promise<GetFolderDto[]>} A promise that resolves to an array of GetFolderDto objects.
     */
    async getManyFolders(showOn: string, userId: string): Promise<GetFolderDto[]> {
        const sql =
            queries.folder +
            ` WHERE (F.archived_at IS NULL) AND (F.deleted_at IS NULL) AND ($2 = ANY (F.SHOW_ON)) AND (F.folder_type = 'folder' OR F.folder_type = 'project') `;
        return await this.repoFolder.query(sql, [userId, showOn]);
    }

    /**
     * Marks a folder as favourite for a specific user.
     *
     * @param {number} folderId - The ID of the folder to be marked as favourite.
     * @param {string} userId - The ID of the user.
     * @returns {Promise<InsertResult>} - The result of the insert operation.
     */
    @Transactional()
    async markFolderFavourite(folderId: number, userId: string, folderTypes: FolderTypeOptions[]): Promise<InsertResult> {
        const manager = this.repoFolder.manager;
        try {
            const repoFolderFavourite = manager.getRepository<FolderFavouriteEntity>(FolderFavouriteEntity);

            const newIndex = await repoFolderFavourite
                .createQueryBuilder('FF')
                .leftJoinAndSelect('FF.Folder', 'folder')
                .select('COALESCE(MAX(index + 1), 0)', 'index')
                .where('FF.user_id = :user_id', {user_id: userId})
                .andWhere('folder.folderType IN (:...types)', {types: folderTypes})
                .getRawOne();

            return await repoFolderFavourite.insert({
                Folder: {id: folderId},
                userId,
                index: newIndex.index,
            });
        } catch (err) {
            this.logger.error(`There was an error marking folder ${folderId} as favourite of user`, err);
            throw err;
        }
    }

    /**
     * Removes the marked favourite status for a folder for a specific user.
     *
     * @param {number} folderId - The ID of the folder to unmark as favourite.
     * @param {string} userId - The ID of the user who marked the folder as favourite.
     * @return {Promise<DeleteResult>} The result of the delete operation.
     */
    @Transactional()
    async unmarkFavourite(folderId: number, userId: string): Promise<DeleteResult> {
        const manager = this.repoFolder.manager;
        try {
            const repoFolderFavourite = manager.getRepository<FolderFavouriteEntity>(FolderFavouriteEntity);
            return await repoFolderFavourite.delete({Folder: {id: folderId}, userId});
        } catch (err) {
            this.logger.error(`There was an error un-marking folder ${folderId} as favourite of user`, err);
            throw err;
        }
    }

    //** Change query to nbuolder */
    /**
     * Retrieves the user's favorite folders based on the given parameters.
     *
     * @param {string} userId - The ID of the user.
     * @param {string} showOn - The type of pages the folders should be shown on.
     *
     * @returns {Promise<FolderFavouriteDto[]>} A promise that resolves to an array of FolderFavouriteDto objects representing the user's favorite folders. Each object contains the ID and
     * title of a folder.
     */

    //** added array of types because we have folder,project from here*/
    async getFavourites(userId: string, showOn: string, entityTypes: FolderTypeOptions[]): Promise<FolderFavouriteDto[]> {
        const repoFolderFavourite = this.repoFolder.manager.getRepository<FolderFavouriteEntity>(FolderFavouriteEntity);

        const ret = await repoFolderFavourite
            .createQueryBuilder('folderFavourite')
            .leftJoinAndSelect('folderFavourite.Folder', 'folder')
            .where('folder.archived_at IS NULL')
            .andWhere('folder.deleted_at IS NULL')
            .andWhere('folderFavourite.userId = :userId', {userId})
            .andWhere(':showOn = ANY(folder.showOn)', {showOn})
            .andWhere('folder.folderType IN (:...types)', {types: entityTypes})
            .orderBy('folderFavourite.index', 'ASC')
            .getMany();
        return ret?.map((x) => ({id: x.Folder.id, title: x.Folder.title, folderType: x.Folder.folderType}));
    }

    /**
     * Sets the views for a folder.
     *
     * @param {number} folderId - The ID of the folder.
     * @param {FolderViewDto[]} views - An array of FolderViewDto objects representing the views to be set.
     *
     * @throws {BadRequestException} If the views array is empty or does not contain valid view names.
     *
     * @returns {Promise<UpdateResult>} A Promise that resolves to the UpdateResult object of the update operation.
     */
    @Transactional()
    async setViews(folderId: number, views: FolderViewDto[]): Promise<UpdateResult> {
        const manager = this.repoFolder.manager;
        const repoFolder = manager.getRepository<FolderEntity>(FolderEntity);

        if (views && views.length > 0) {
            for (const view of views) {
                if (!Object.values(DefaultViewOptions).includes(view.name)) {
                    throw new BadRequestException(`[${view}] is not a valid view`);
                }
            }
        } else {
            throw new BadRequestException(`There must be al least one view`);
        }
        return await repoFolder.update(folderId, {availableViews: views, id: folderId});
    }

    /**
     * Creates gantt columns for a specific folder.
     *
     * This method inserts the specified gantt columns into the database for a given folder.
     *
     * @param {number} folderId - The ID of the folder.
     * @param {string[]} columns - An array of gantt column names.
     * @param {string} userId - The ID of the user.
     * @returns {Promise<InsertResult>} - A promise that resolves to the result of the insert operation.
     * @throws {Error} - If there was an error creating the gantt columns.
     */
    @Transactional()
    async createGanttColumns(folderId: number, columns: string[], userId: string): Promise<InsertResult> {
        const manager = this.repoFolder.manager;
        try {
            const repoGannt = manager.getRepository<FolderGanttColumnEntity>(FolderGanttColumnEntity);

            return await repoGannt.insert({Folder: {id: folderId}, userId, columns: columns});
        } catch (e) {
            this.logger.error(`There was an error creating gantt columns of folder ${folderId}`, e);
            throw e;
        }
    }

    /**
     * Sets the Gantt columns for a specific folder.
     *
     * @param {number} folderId - The ID of the folder.
     * @param {string[]} columns - An array of strings representing the column names.
     * @param {string} userId - The ID of the user making the update.
     * @returns {Promise<UpdateResult>} - A Promise that resolves with the result of the update operation.
     */
    @Transactional()
    async setGanttColumns(folderId: number, columns: string[], userId: string): Promise<UpdateResult> {
        const manager = this.repoFolder.manager;
        try {
            const repoGannt = manager.getRepository<FolderGanttColumnEntity>(FolderGanttColumnEntity),
                ret = await repoGannt.findOne({
                    where: {
                        Folder: {id: folderId},
                        userId,
                    },
                });

            return await repoGannt.update(ret.id, {columns: columns});
        } catch (e) {
            this.logger.error(`There was an error setting gannt columns of folder ${folderId}`, e);
            throw e;
        }
    }

    /**
     * Retrieves the gantt columns for a given folder and user.
     *
     * @param {number} folderId - The id of the folder.
     * @param {string} userId - The id of the user.
     * @returns {Promise<FolderGanttColumnEntity>} - A promise that resolves with the gantt columns for the specified folder and user.
     * @throws {Error} If there was an error fetching the gantt columns.
     */
    async getGanttColumns(folderId: number, userId: string): Promise<FolderGanttColumnEntity> {
        try {
            const manager = this.repoFolder.manager,
                repoGannt = manager.getRepository<FolderGanttColumnEntity>(FolderGanttColumnEntity);

            return await repoGannt.findOne({
                where: {
                    Folder: {id: folderId},
                    userId,
                },
            });
        } catch (e) {
            this.logger.error(`There was an error fetching gantt columns of folder ${folderId}`, e);
            throw e;
        }
    }

    /** Update Workflow of a folder  */
    /**
     * Changes the workflow of a folder.
     *
     * @param {number} folderId - The ID of the folder.
     * @param {ChangeWorkflowFolderDto} dto - The DTO object containing the new workflow information.
     * @param {string} userId - The ID of the user.
     * @returns {Promise<Partial<WorkFlowEntity>>} - A promise that resolves to the updated workflow entity.
     * @throws {BadRequestException} - If there are errors with the parameters.
     * @throws {BadRequestException} - If the common workflow or personal workflow is not found.
     */
    @Transactional()
    async changeWorkflow(
        folderId: number,
        dto: ChangeWorkflowFolderDto,
        userId: string,
        entityType: EntityTypeOptions
    ): Promise<Partial<WorkFlowEntity>> {
        const manager = this.repoFolder.manager;
        const repoWorkflow = manager.getRepository<WorkFlowEntity>(WorkFlowEntity),
            repoTaskRelation = manager.getRepository<TaskRelationEntity>(TaskRelationEntity);

        let newWorkFlowDB: WorkFlowEntity;
        const oldWorkFlowDB = await repoWorkflow.findOne({
            where: {Folders: {id: In([folderId])}},
            relations: {WorkFlowStates: true},
        });

        const spaceId = await this.spaceService.getSpaceFromFolderId(folderId);

        // create new workflow and states
        if (
            (dto.type === ChangeWorkflowOptions.COMMON_TO_COMMON || dto.type === ChangeWorkflowOptions.PERSONALISE_TO_COMMON) &&
            dto.commonWorkflow &&
            dto.commonWorkflow > 0
        ) {
            //** validate here */
            if (spaceId && entityType !== EntityTypeOptions.Space) {
                await this.validateWorkflowsOnFolders(spaceId, dto.commonWorkflow);
            }
            // get the new common workflow
            newWorkFlowDB = await repoWorkflow.findOne({
                where: {id: dto.commonWorkflow},
                relations: {WorkFlowStates: true},
            });
            if (!newWorkFlowDB) {
                throw new BadRequestException(`Common workflow ${dto.commonWorkflow} not found`);
            }

            await this.repoFolder.update(folderId, {workFlowId: dto.commonWorkflow, id: folderId});
        } else {
            // the new workflow is personalized
            if (
                (dto.type === ChangeWorkflowOptions.COMMON_TO_PERSONALISE ||
                    dto.type === ChangeWorkflowOptions.PERSONALISE_TO_PERSONALISE) &&
                !dto.commonWorkflow &&
                dto.personaliseWorkflow &&
                dto.personaliseWorkflow > 0
            ) {
                // get the new personal workflow
                newWorkFlowDB = await repoWorkflow.findOne({
                    where: {id: dto.personaliseWorkflow, userId},
                    relations: {WorkFlowStates: true},
                });
                if (!newWorkFlowDB) {
                    throw new BadRequestException(`Personal workflow ${dto.personaliseWorkflow} not found`);
                }

                await this.repoFolder.update(folderId, {workFlowId: dto.personaliseWorkflow, id: folderId});
            } else {
                throw new BadRequestException(`There are errors with the parameters`);
            }
        }

        // assign task to new folder workflow states according to then mapping
        if (dto.Mapping?.length > 0) {
            const tasks = await repoTaskRelation.find({
                where: {
                    Folder: {id: folderId},
                    WorkFlowState: {id: In(oldWorkFlowDB.WorkFlowStates.map((x) => x.id))},
                },
                order: {index: 'ASC'},
                relations: {WorkFlowState: true, ChildTask: true, ParentTask: true},
            });
            for (const task of tasks) {
                const sourceCode = dto.Mapping.find((x) => x.SourceWorkflowStateCode === task.WorkFlowState?.code),
                    destinationState = newWorkFlowDB.WorkFlowStates.find((x) => x.code === sourceCode.DestinationWorkflowStateCode);
                await repoTaskRelation.update(task.id, {
                    Folder: {id: folderId},
                    WorkFlowState: {id: destinationState.id},
                    ParentTask: task.ParentTask ? {id: task.ParentTask.id} : null,
                    ChildTask: task.ChildTask ? {id: task.ChildTask.id} : null,
                    index: task.index,
                    stateIndex: task.stateIndex,
                });
            }
        }
        return newWorkFlowDB;
    }

    //** TODO : Refactoring and add return types */
    /**
     * Retrieves folders based on the provided parameters.
     *
     * @param {boolean} archived - Specifies whether to retrieve archived folders or not.
     * @param {string} showOn - The show on property to filter the folders.
     * @param {string} userId - The ID of the user.
     * @return {Promise<GetFolderDto[]>} - A promise that resolves to an array of folder objects.
     */
    async getFolders(archived: boolean, showOn: string, userId: string): Promise<GetFolderDto[]> {
        const archivedQuery = archived ? `F.archived_at IS NOT NULL` : `F.archived_at IS NULL`;
        const sql = queries.folder + ` WHERE (${archivedQuery}) AND ($2 = ANY (F.SHOW_ON))`;
        return await this.repoFolder.query(sql, [userId, showOn]);
    }

    /**
     * Retrieves archived and deleted folders and tasks based on the specified criteria.
     *
     * @async
     * @param {PaginationDto} dto - The pagination data, including the offset and limit.
     * @param {string} showOn - The criteria to filter folders and tasks.
     * @param {boolean} deleted - Flag to indicate whether to retrieve deleted tasks or not.
     * @param {string} userId - The ID of the user.
     * @param {number[]} spaceIds - Optional array of space IDs to filter the results.
     * @returns {Promise<ArchivedDeletedFoldersTasksResponseDto>} - The response containing the modified folder tree and archived tasks.
     * @throws {Error} - If there is an error retrieving the data.
     */
    async getArchivedDeletedFoldersTasks(
        dto: PaginationDto,
        showOn: string,
        search: string,
        deleted: boolean,
        userId: string,
        spaceIds: number[] = []
    ): Promise<ArchivedDeletedFoldersTasksResponseDto> {
        const manager = this.repoFolder.manager;
        const repoTask = manager.getRepository<TaskEntity>(TaskEntity);

        let condition;
        if (deleted) {
            condition = {deletedAt: Not(IsNull())};
        } else {
            condition = {archivedAt: Not(IsNull()), deletedAt: IsNull()};
        }

        if (search) {
            const searchParams = `%${search}%`;
            condition = {...condition, title: Like({searchParams})};
        }

        const totalTasks = await repoTask.count({where: condition});
        const totalFolders = await this.repoFolder.count({where: condition});
        const {offset, limit} = this.createPagination(dto);
        // space filter
        const allowedSpaceIds = await this.authorization.getRecursiveIdsForUser(userId, EntityTypeOptions.Space, PermissionOptions.READ);
        const parentFolderParams = [showOn, limit, offset];
        if (spaceIds.length === 0) {
            spaceIds = allowedSpaceIds.map((s) => s.id);
        } else {
            spaceIds = allowedSpaceIds.map((s) => s.id).filter((x) => spaceIds.includes(x));
        }
        if (spaceIds.length === 0) {
            this.logger.error(`No space ids found for user ${userId}`);
            throw new BadRequestException(`No space ids found for user ${userId}`);
        }
        let parentFoldersQuery = `
                    SELECT
                        F.id
                        FROM FOLDER F
                        INNER JOIN "${RawDatabaseConfig.schema}".folder_relation FR ON FR.child_folder_id = F.id
                        WHERE ($1 = ANY (F.show_on))
                        AND (FR.parent_folder_id IS NULL OR EXISTS (SELECT 1 FROM "${
                            RawDatabaseConfig.schema
                        }"."folder" FE WHERE FE.ID = FR.parent_folder_id AND ${
            deleted ? ' FE.deleted_at IS NULL' : ' FE.archived_at IS NULL AND F.deleted_at IS NULL'
        } ))`;
        if (deleted) {
            parentFoldersQuery += ` AND F.deleted_at IS NOT NULL`;
        } else {
            parentFoldersQuery += ` AND F.archived_at IS NOT NULL AND F.deleted_at IS NULL`;
        }
        // ` AND ${deleted ? ' F.deleted_at IS NOT NULL' : ' F.archived_at IS NOT NULL AND F.deleted_at IS NULL '
        // } AND ($1 = ANY (F.show_on)) AND (FS.parent_folder_id IS NULL OR EXISTS (SELECT 1 FROM "${
        //     RawDatabaseConfig.schema
        // }"."folder" FE WHERE FE.ID = FS.parent_folder_id AND FE.DELETED_AT IS NULL)) LIMIT $2 OFFSET $3`;
        parentFoldersQuery += ` LIMIT $2 OFFSET $3`;

        const parentFolders: FolderTreeDto[] = await this.repoFolder.query(parentFoldersQuery, parentFolderParams);

        //Get Parent Folder Ids
        const parentFolderIds = parentFolders?.map((el) => el.id);
        const childFolderParams = [showOn, parentFolderIds];

        //Get Children for parent Folders
        let childFoldersQuery = `WITH RECURSIVE FolderHierarchy AS (
                SELECT f.id, fr.parent_folder_id
                FROM "${RawDatabaseConfig.schema}".folder f
                inner join "${RawDatabaseConfig.schema}".folder_relation fr on fr.child_folder_id = f.id AND fr.is_bind = false
                WHERE f.id = ANY($2)
                
                UNION ALL
                SELECT f.id, fr.parent_folder_id
                FROM "${RawDatabaseConfig.schema}".folder f
                inner join "${RawDatabaseConfig.schema}".folder_relation fr on fr.child_folder_id = f.id AND fr.is_bind = false
                JOIN FolderHierarchy fh ON fr.parent_folder_id = fh.id
                WHERE ($1 = ANY (F.show_on))
                )
                SELECT F.id,
                F.title,
                F.default_view AS "defaultView",
            F.color,
            F.available_views AS "availableViews",
            F.folder_type AS "folderType",
            F.user_id AS "ownerId",
            F.extra,
            F.show_on,
            F.archived_at AS "archivedAt",
            F.archived_by AS "archivedBy",
            F.archived_why AS "archiveReason",
            F.deleted_at AS "deletedAt",
            F.deleted_by AS "deletedBy",
            (SELECT JSON_AGG(json_build_object('title', F2.title, 'type', F2.folder_type,'color',F2.color)) AS pathDetails
            FROM "${RawDatabaseConfig.schema}".folder F2
            WHERE F2.id = ANY(FR.path_ids)) AS "pathString",
            (SELECT JSON_AGG(X)
            FROM (SELECT FU.user_id  AS "userId", FU.user_permission as "userPermission", FU.inherit
            FROM "${RawDatabaseConfig.schema}".folder_user_ap FU
            WHERE FU.folder_id = F.id) AS X) AS members,
            ARRAY_TO_STRING(FR.path_ids, ',') AS path
            FROM FolderHierarchy FH
            INNER JOIN "${RawDatabaseConfig.schema}".folder F ON FH.id = F.id
            INNER JOIN "${RawDatabaseConfig.schema}".folder_relation fr ON fr.child_folder_id = fh.id AND fr.is_bind = false`;

        if (search) {
            childFoldersQuery += ` WHERE F.title ILIKE '%' || $3 || '%' AND similarity(F.title,$3) > 0.1`;
            childFolderParams.push(search);
        }
        const folders: FolderTreeDto[] = await this.repoFolder.query(childFoldersQuery, childFolderParams);

        const folderIds = folders?.map((el) => el.id);
        let modifiedFolderTree: ArchivedDeletedFoldersTasksDto[] = [];

        if (folders?.length) {
            const modifiedFolders = folders.map((folder) => {
                return {
                    id: folder.id,
                    type: folder.folderType,
                    archivedBy: folder.archivedBy,
                    archivedAt: folder.archivedAt,
                    deletedBy: folder.deletedBy,
                    deletedAt: folder.deletedAt,
                    archiveReason: folder.archiveReason,
                    title: folder.title,
                    path: folder.path,
                    pathStr: folder.pathString,
                    children: [],
                    taskCount: 0,
                };
            });

            //Calculate Task Count for Folders
            for (const folder of modifiedFolders) {
                folder.taskCount = await repoTask.count({where: {ChildrenTasks: {folderId: folder.id}}});
            }

            modifiedFolderTree = listToTree<ArchivedDeletedFoldersTasksDto>(
                modifiedFolders,
                'path',
                (x: ArchivedDeletedFoldersTasksDto) => {
                    const ret = x.path.split(',');
                    ret.splice(-1);
                    return ret.join(',');
                },
                'children'
            );
        }

        //Exclude Tasks Where Folders are deleted
        const taskSearchParams = [showOn, limit, offset];

        let archivedTasksQuery = `SELECT T.ID,
            T.TITLE,
			T.ARCHIVED_AT,
            T.ARCHIVED_BY,
            T.ARCHIVED_WHY,
            T.DELETED_AT,
            T.DELETED_BY,
            T.DELETED_WHY,
            T.SHOW_ON,
			TR.FOLDER_ID,
            TR.path_ids,
			TR.PARENT_TASK_ID AS "parentTaskId",
			TR.CHILD_TASK_ID,
            (
                SELECT JSON_AGG(
                            json_build_object(
                                'title', T2.title,
                                'type', CASE WHEN T3.PARENT_TASK_ID IS NOT NULL THEN 'subtask' ELSE 'task' END
                            )
                        ) AS pathDetails
                FROM "${RawDatabaseConfig.schema}".task T2
                LEFT JOIN "${RawDatabaseConfig.schema}".task_relation T3 ON T2.ID = T3.CHILD_TASK_ID
                WHERE T2.id = ANY(TR.path_ids)
            ) AS "pathString"
		FROM "${RawDatabaseConfig.schema}".task T
		INNER JOIN "${RawDatabaseConfig.schema}".task_relation TR ON TR.CHILD_TASK_ID = T.ID WHERE ${
            deleted ? ' T.DELETED_AT IS NOT NULL ' : ' T.ARCHIVED_AT IS NOT NULL AND T.DELETED_AT IS NULL '
        } AND ($1 = ANY (T.SHOW_ON))`;

        if (folderIds?.length) {
            archivedTasksQuery += ` AND TR.FOLDER_ID NOT IN (${folderIds})`;
        }

        if (search) {
            archivedTasksQuery += ` AND T.title ILIKE '%' || $4 || '%' AND similarity(T.title,$4) > 0.1`;
            taskSearchParams.push(search);
        }

        archivedTasksQuery += ` LIMIT $2 OFFSET $3`;

        const archivedTasks = await this.repoFolder.query(archivedTasksQuery, taskSearchParams);

        const modifiedArchivedTasks: ArchivedDeletedFoldersTasksDto[] = archivedTasks.map((task) => {
            return {
                id: task.id,
                type: task.parentTaskId ? ArchivedTypeOptions.SUB_TASK : ArchivedTypeOptions.TASK,
                archivedBy: task.archived_by,
                archivedAt: task.archived_at,
                archiveReason: task.archived_why,
                deletedBy: task.deleted_by,
                deletedAt: task.deleted_at,
                deleteReason: task.deleted_why,
                title: task.title,
                pathIds: task.path_ids,
                pathStr: task.pathString,
                folderId: task.folder_id,
            };
        });

        return {
            data: modifiedFolderTree.concat(modifiedArchivedTasks),
            metadata: {totalRecords: totalFolders + totalTasks ?? 0},
        };
    }

    /**
     * Retrieves the folder tree based on the provided parameters.
     *
     * @param {number[]} folderIds - Array of folder IDs to retrieve. If empty, it will not show any folders.
     * @param {FolderViewOptions} view - The folder view options.
     * @param {string} userId - The ID of the user.
     * @param {number|null} depth - The depth of the folder tree. Default value is null.
     * @param {number|null} parentFolderId - The ID of the parent folder. Default value is null.
     * @param {number|null} treeViewId - The ID of the tree view. Default value is null.
     * @param {string} showOn - The condition to include folders in the result.
     * @param {boolean} showArchived - Whether to include archived folders in the result.
     * @param {boolean} showDeleted - Whether to include deleted folders in the result.
     * @param {boolean} hasPurgePermissions - Whether the user has purge permissions.
     *
     * @returns {Promise<FolderTreeDto[]>} The folder tree as an array of FolderTreeDto objects.
     * @throws {Error} If there was an error while retrieving the folder tree.
     */
    async getFolderTreeBase(
        folderIds: number[],
        view: FolderViewOptions,
        userId: string,
        depth: number = null,
        parentFolderId: number = null,
        treeViewId: number = null,
        showOn: string,
        showArchived: boolean,
        showDeleted: boolean,
        hasPurgePermissions: boolean,
        spaceIds: number[]
    ): Promise<FolderTreeDto[]> {
        try {
            let startParamIndex = 4;
            const params: unknown[] = [userId, view, showOn];
            let query = FolderBaseService.folderTreeQuery(spaceIds);
            query += ` WHERE  ($3 = ANY (F.show_on))`;

            if (showArchived === false) query = query + `AND F.archived_at IS NULL `;
            if (!(hasPurgePermissions && showDeleted)) query = query + `AND F.deleted_at IS NULL `;

            if (folderIds.length > 0) {
                // Exclude folders where is_bind is true, and parent_folder_id is not present in the allowedIds array
                query += `AND F.id = ANY (${
                    '$' + startParamIndex
                }) AND (RECUR.is_bind = FALSE OR (RECUR.is_bind = TRUE OR RECUR.parent_folder_id = ANY (${'$' + startParamIndex++}))) `;
                params.push(folderIds);
            } else {
                // this is needed for not show folders that the user don't have permissions
                query = query + `AND F.id <> F.id `;
            }

            if (depth !== null) {
                query = query + `AND RECUR.depth = ${'$' + startParamIndex++} `;
                params.push(depth);
            }

            if (parentFolderId !== null) {
                query = query + `AND RECUR.parent_folder_id = ${'$' + startParamIndex++} `;
                params.push(parentFolderId);
            }

            if (treeViewId !== null) {
                query += `AND F.id IN (SELECT folder_id FROM "${RawDatabaseConfig.schema}".tree_view_folder WHERE tree_view_id = ${
                    '$' + startParamIndex++
                }) `;
                params.push(treeViewId);
            }

            query = query + `ORDER BY RECUR.depth, FP.index`;

            const folders: FolderTreeDto[] = await this.repoFolder.manager.query(query, params);

            for (const folder of folders) {
                folder.members = this.spaceService.filterMembersNotInAnyTeam(folder.teams, folder.members);
                const filteredIds: number[] = (folder.path.match(/\d+/g) || []).map(Number).filter((id) => folderIds.includes(id));
                folder.path = '(' + filteredIds.join('),(') + ')';
            }

            const folderTree: FolderTreeDto[] = listToTree<FolderTreeDto>(
                folders,
                'path',
                (x: FolderTreeDto) => {
                    const ret = x.path.split(',');
                    ret.splice(-1);
                    return ret.join(',');
                },
                'children'
            );

            modifyTree(
                folderTree,
                (x: FolderTreeDto) => {
                    // delete x.path;
                    delete x.parent_folder_id;
                    delete x.child_folder_id;
                    delete x.depth;
                },
                'children'
            );

            return folderTree;
        } catch (e) {
            this.logger.error(`There was an error while getting a folder tree ${folderIds}`, e);
            throw e;
        }
    }

    /**
     * Retrieves folder tree information based on the given space IDs.
     *
     * @param {number[]} spaceIds - The space IDs to query folder tree information for.
     * @returns {string} - The SQL query to retrieve the folder tree information.
     */
    static folderTreeQuery(spaceIds: number[]): string {
        return `
SELECT
    F.id,
    F.title,
    F.default_view AS "defaultView",
    F.color,
    F.available_views AS "availableViews",
    F.folder_type AS "folderType",
    F.user_id AS "ownerId",
    F.extra,
    F.show_on,
    F.archived_at AS "archivedAt",
    F.archived_by AS "archivedBy",
    F.archived_why AS "archiveReason",
    F.deleted_at AS "deletedAt",
    F.deleted_by AS "deletedBy",
    F.view_type AS "viewType",
    RECUR.parent_folder_id,
    FR.path_ids AS "pathIds",
    (SELECT JSON_AGG(json_build_object('title', F2.title, 'type', F2.folder_type,'color',F2.color)) AS pathDetails
        FROM "${RawDatabaseConfig.schema}".folder F2
        WHERE F2.id = ANY(FR.path_ids)) AS "pathString",
    (SELECT JSON_AGG(X)
        FROM (SELECT FU.user_id  AS "userId", FU.user_permission as "userPermission", FU.inherit
        FROM "${RawDatabaseConfig.schema}".folder_user_ap FU
        WHERE FU.folder_id = F.id AND (FU.entity_type = 'folder' OR FU.entity_type = 'space')) AS X) AS members,
        	(
    SELECT
        JSON_AGG(X)
    FROM
        (
            SELECT
                R.id,
                R.code,
                R.active,
                R.description,
                FST.team_permissions as "teamPermission",
                JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'id', UR.user_id,
                        'userPermissions', FU.USER_PERMISSION
                    )
                ) as members
            FROM
                "${RawDatabaseConfig.schema}".FOLDER_SPACE_TEAMS FST
                INNER JOIN "${RawDatabaseConfig.schema}".ROLE R ON FST.TEAM_ID = R.ID
                INNER JOIN "${RawDatabaseConfig.schema}".USER_ROLE UR ON UR.ROLE_ID = R.ID
                INNER JOIN "${RawDatabaseConfig.schema}".FOLDER_USER_AP FU ON FU.USER_ID = UR.USER_ID
            WHERE
                FST.FOLDER_ID = F.ID AND FU.FOLDER_ID = F.ID AND (FU.ENTITY_TYPE = 'folder' OR FU.ENTITY_TYPE = 'space') 
            GROUP BY R.id, R.code, R.active, R.description, FST.team_permissions
        ) AS X
        ) AS TEAMS,
    RECUR.depth,
    RECUR.fr_id,
    RECUR.is_bind AS "isBind",
    ARRAY_TO_STRING(RECUR.path, ',') AS path
    FROM (${queries.folderTree(spaceIds)}) AS RECUR
    INNER JOIN "${RawDatabaseConfig.schema}".folder F ON RECUR.id = F.id
    INNER JOIN "${RawDatabaseConfig.schema}".folder_relation FR ON FR.id = RECUR.fr_id
    LEFT  JOIN "${
        RawDatabaseConfig.schema
    }"."folder_position" FP ON FP.folder_relation_id = RECUR.fr_id AND FP.user_id = $1 AND FP.view::text = $2  
 `;
    }

    //Todo : Add return types
    /**
     * Retrieves the task tree for a given folder.
     *
     * @param {number} folderId - The ID of the folder.
     * @param {string} showOn - The showOn value for the tasks.
     * @param {boolean} includeArchived - Optional. Whether to include archived tasks. Defaults to false.
     * @param {boolean} includeDeleted - Optional. Whether to include deleted tasks. Defaults to false.
     *
     * @returns {Promise<TaskTreeDto[]>} The task tree as an array of TaskTreeDto objects.
     *
     * @throws {Error} If there was an error while retrieving the task tree.
     */
    async getTaskTree(folderId: number, showOn: string, includeArchived = false, includeDeleted = false): Promise<TaskTreeDto[]> {
        const manager = this.repoFolder.manager;
        try {
            const repoTask = manager.getRepository<TaskEntity>(TaskEntity),
                sql =
                    `WITH RECURSIVE TASKS AS
                (SELECT T.ID,
                        T.TITLE,
                        T.DESCRIPTION,
                        T.start_date AS "startDate",
                        T.end_date AS "endDate",
                        T.CREATED_AT   AS "createdAt",
                        T.UPDATED_AT AS "updatedAt",
                        T.USER_ID AS "userId",
                        T.IMPORTANCE_ID AS "importanceId",
                        T.ARCHIVED_AT,
                        T.DELETED_AT,
                        T.DURATION,
                        T.COMPLETE,
                        T.EFFORT,
                        T.FIXED_START_DATE AS "fixedStartDate",
                        T.SOURCE,
                        T.EXTRA,
                        T.SHOW_ON AS "showOn",
                        TR.FOLDER_ID AS "folderId",
                        TR.PARENT_TASK_ID AS "parentTaskId",
                        TR.CHILD_TASK_ID AS "childTaskId",
                        TR.INDEX,
                        TR.STATE_INDEX AS "stateIndex",
                        TR.WORKFLOW_STATE_ID AS "workflowStateId",
                        TR.PATH_IDS as "pathIds",
                        TR.PATH_STR as "pathString"
                    FROM TASK T
                    INNER JOIN TASK_RELATION TR ON TR.CHILD_TASK_ID = T.ID
                    AND TR.PARENT_TASK_ID IS NULL
                      WHERE TR.FOLDER_ID = $1 ` +
                    (!includeArchived && !includeDeleted ? ` AND T.ARCHIVED_AT IS NULL AND T.DELETED_AT IS NULL ` : '') +
                    (!includeArchived ? ` AND T.ARCHIVED_AT IS NULL ` : '') +
                    (!includeDeleted ? ` AND T.DELETED_AT IS NULL ` : '') +
                    ` AND ($2 = ANY (T.SHOW_ON))
                    UNION ALL
                    SELECT T.ID,
                        T.TITLE,
                        T.DESCRIPTION,
                        T.start_date AS "startDate",
                        T.end_date AS "endDate",
                        T.created_at AS "createdAt",
                        T.updated_at AS "updatedAt",
                        T.USER_ID,
                        T.IMPORTANCE_ID,
                        T.ARCHIVED_AT,
                        T.DELETED_AT,
                        T.DURATION,
                        T.COMPLETE,
                        T.EFFORT,
                        T.FIXED_START_DATE,
                        T.SOURCE,
                        T.EXTRA,
                        T.show_on AS "showOn",
                        TR.FOLDER_ID,
                        TR.PARENT_TASK_ID,
                        TR.CHILD_TASK_ID,
                        TR.INDEX,
                        TR.STATE_INDEX,
                        TR.WORKFLOW_STATE_ID,
                        TR.PATH_IDS as "pathIds",
                        TR.PATH_STR as "pathString"
                    FROM TASK T
                   INNER JOIN TASK_RELATION TR ON TR.CHILD_TASK_ID = T.ID
                          INNER JOIN TASKS TS ON TR.PARENT_TASK_ID = TS.ID AND TR.FOLDER_ID = TS."folderId"
                    WHERE TR.FOLDER_ID = $1 ` +
                    (!includeArchived ? ` AND T.ARCHIVED_AT IS NULL ` : '') +
                    ` AND ($2 = ANY (T.SHOW_ON)))
                SELECT *
                FROM TASKS
                ORDER BY "parentTaskId"`,
                tasks = await repoTask.query(sql, [folderId, showOn]);
            return listToTree<TaskTreeDto>(tasks, 'id', (x: TaskTreeDto) => (x.parentTaskId ? x.parentTaskId : undefined), 'children');
        } catch (e) {
            this.logger.error(`There was an error while getting a task tree ${folderId}`, e);
            throw e;
        }
    }

    //test
    /**
     * Retrieves custom field definitions for a given set of folder IDs and user ID.
     *
     * @param {number[]} folderIds - An array of folder IDs.
     * @param {string} userId - The ID of the user.
     * @returns {Promise<CustomFieldDefinitionEntity[]>} - A promise that resolves to an array of custom field definition entities.
     * @throws {Error} - If an error occurs while fetching the custom field definitions.
     */
    async getFolderCustomFields(folderIds: number[], userId: string): Promise<CustomFieldDefinitionEntity[]> {
        try {
            const manager = this.repoFolder.manager,
                repoCustomFieldDefinition = manager.getRepository<CustomFieldDefinitionEntity>(CustomFieldDefinitionEntity);

            return await repoCustomFieldDefinition
                .createQueryBuilder('CustomFieldDefinition')
                .innerJoin(
                    'custom_field_value',
                    'cfv',
                    'CustomFieldDefinition.id = cfv.customFieldDefinitionId AND (CustomFieldDefinition.userId = :userId OR CustomFieldDefinition.userId IS NULL )',
                    {userId}
                )
                .innerJoin('folder', 'f', 'cfv.folderId = f.id')
                .andWhere('cfv.folder_id IN (:...folderIds)', {folderIds})
                .getMany();
        } catch (e) {
            this.logger.error(`There was an error while fetching custom fields`, e);
            throw e;
        }
    }

    /**
     * Updates the position of a folder.
     *
     * @param {number} folder_id - The ID of the folder to update.
     * @param {UpdateFolderPositionDto} dto - The new position of the folder.
     * @param {JwtUserInterface} user - The user requesting the update.
     *
     * @return {Promise<void>} - A promise that resolves when the update is complete.
     *
     * @throws {Error} - If there was an error moving the folder.
     *
     * @remarks
     * This method is decorated with @Transactional() to ensure the update is performed within a transaction.
     */
    @Transactional()
    async updateFolderPosition(folder_id: number, dto: UpdateFolderPositionDto, user: JwtUserInterface): Promise<void> {
        try {
            // update folder position
            await this._updateFolderPositionEx(folder_id, dto, user);

            // update user permissions
            //await this.updateFolderPositionUserPermissions(folder_id, dto, user);
        } catch (e) {
            this.logger.error(`There was an error moving a folder ${folder_id} - [${JSON.stringify(dto)}]`);
            throw e;
        }
    }

    // todo : add return types
    /**
     * Sets the members of a folder.
     *
     * @param {number} folderId - The ID of the folder.
     * @param {MembersDto} dto - The DTO containing the members.
     * @param {string} userId - The ID of the user setting the members.
     * @returns {Promise<void>} A promise that resolves when the members have been set successfully.
     * @throws When there is an error setting the folder members.
     *
     * @example
     * setFolderMembers(1, { members: ['user1', 'user2'] }, '123')
     *   .then(() => {
     *       console.log('Folder members set successfully.');
     *   })
     *   .catch((err) => {
     *       console.error('An error occurred while setting folder members:', err);
     *   });
     */
    @Transactional()
    async setFolderMembers(folderId: number, dto: MembersDto, userId: string): Promise<void> {
        try {
            return await this.setFolderMembersEx(folderId, dto, userId);
        } catch (err) {
            this.logger.error(`There was an error setting folder members ${folderId} / ${JSON.stringify(dto)}`, err);
            throw err;
        }
    }

    /**
     * Sets the members of a folder based on the provided DTO.
     * @param {number} folderId - The ID of the folder.
     * @param {MembersDto} dto - The DTO containing the members to be set.
     * @param {string} _userId - The ID of the user performing the operation.
     * @return {Promise<void>} A promise that resolves once the operation is complete.
     * @throws {BadRequestException} If a provided user does not have permission on the folder.
     */
    @Transactional()
    async setFolderMembersEx(folderId: number, dto: MembersDto, _userId: string): Promise<void> {
        const manager = this.repoFolder.manager;
        const repoFolderUserView = manager.getRepository<FolderUserViewEntity>(FolderUserViewEntity);

        // if (
        //     dto.update &&
        //     dto.update.length === 0 &&
        //     dto.insert &&
        //     dto.insert.length === 0 &&
        //     dto.delete &&
        //     dto.delete.length === 1 &&
        //     dto.delete[0].id === userId
        // ) {
        //     // userPermission.push(UserPermissionOptions.READONLY);
        // }
        if (dto.insert && dto.insert.length > 0) {
            for (const genericMemberDto of dto.insert) {
                // validate that the permission does not exist
                const folderUserDB = await repoFolderUserView.findOne({
                    where: {
                        folderId: folderId,
                        userId: genericMemberDto.id /*User: {id: genericMemberDto.id}*/,
                    },
                });
                if (!folderUserDB) {
                    //TODO: See if view folder_user_ap is enough
                    /*
await repoFolderUser.insert({
Folder: {id: folderDB.id},
userId: genericMemberDto.id //User: {id: genericMemberDto.id},
userPermission: genericMemberDto.userPermission,
inherit: false,
});
*/
                }
            }
        }
        if (dto.update && dto.update.length > 0) {
            for (const genericMemberDto of dto.update) {
                // validate that the permission exists
                const folderUserDB = await repoFolderUserView.findOne({
                    where: {
                        folderId: folderId,
                        userId: genericMemberDto.id /*User: {id: genericMemberDto.id}*/,
                    },
                });
                if (folderUserDB) {
                    //TODO: See if view folder_user_ap is enough
                    /*
await repoFolderUser.update(
{
Folder: {id: folderDB.id},
userId: genericMemberDto.id //User: {id: genericMemberDto.id},
},
{
userPermission: genericMemberDto.userPermission,
}
);
*/
                } else {
                    throw new BadRequestException(`The user ${genericMemberDto.id} does not has permission on folder ${folderId}`);
                }
            }
        }
        //TODO: See if view folder_user_ap is enough
        /*
if (dto.delete && dto.delete.length > 0) {
for (const genericMemberDto of dto.delete) {
// validate that the permission exists
const folderUserDB = await repoFolderUser.findOne({
where: {
Folder: {id: folderDB.id},
userId: genericMemberDto.id, //User: {id: genericMemberDto.id},
},
});

if (folderUserDB) {
await repoFolderUser.delete({
Folder: {id: folderDB.id},
userId: genericMemberDto.id //User: {id: genericMemberDto.id},
});
} else {
throw new BadRequestException(`The user ${genericMemberDto.id} does not has permission on folder ${folderId}`);
}

}
}
*/
    }

    /**
     * Binds a child folder to a parent folder.
     *
     * @param {number} parentFolderId - The ID of the parent folder.
     * @param {number} childFolderId - The ID of the child folder.
     * @param {JwtUserInterface} user - The user object.
     * @returns {Promise<FolderRelationEntity>} - The newly created FolderRelationEntity object.
     * @throws {BadRequestException} - If the parent folder is the same as the child folder.
     * @throws {ConflictException} - If a parent-child relation already exists or if a folder loop is found.
     * @throws {Error} - If there was an error binding the folders.
     */
    @Transactional()
    async bindFolder(parentFolderId: number, childFolderId: number, user: JwtUserInterface): Promise<FolderRelationEntity> {
        if (parentFolderId === childFolderId) {
            throw new BadRequestException(`Parent folder can not be also child folder`);
        }
        const manager = this.repoFolder.manager;
        try {
            const // userPermission = [UserPermissionOptions.FULL, UserPermissionOptions.EDITOR],
                repoFolder = manager.getRepository<FolderEntity>(FolderEntity),
                repoFolderRelation = manager.getRepository<FolderRelationEntity>(FolderRelationEntity),
                repoFolderPosition = manager.getRepository<FolderPositionEntity>(FolderPositionEntity),
                parentFolderDB = await repoFolder
                    .createQueryBuilder('Folder')
                    .leftJoinAndSelect('Folder.Members', 'Members')
                    .where({id: parentFolderId})
                    .getOne(),
                childFolderDB = await repoFolder
                    .createQueryBuilder('Folder')
                    .leftJoinAndSelect('Folder.Members', 'Members')
                    .where({id: childFolderId})
                    .getOne();

            // folderRelation = await repoFolderRelation.findOne({
            //     where: {
            //         ParentFolder: {id: parent_folder_id},
            //         ChildFolder: {id: child_folder_id},
            //     },
            //     relations: {ParentFolder: true, ChildFolder: true},
            // });
            // if (folderRelation) {
            //     // throw new ConflictException(`Parent child relation already exists`);
            // }

            // check for folder loops
            const loop = await checkForFolderLoop(repoFolder, parentFolderId, childFolderId);

            // deep check for possible loop in the folder and parent trees
            const spaceId = await this.spaceService.getSpaceFromFolderId(childFolderId);
            const check: boolean = await checkForFolderLoopV2(repoFolder, spaceId, user.id, parentFolderId, childFolderId);

            if (loop || check) {
                throw new BadRequestException(`Folder loop found`);
            }

            const parentFolderEntity = await repoFolderRelation.findOneBy({
                childFolderId: parentFolderId,
            });
            const ret = await repoFolderRelation.save({
                ParentFolder: parentFolderDB,
                ChildFolder: childFolderDB,
                isBind: true,
                pathStr: [...parentFolderEntity.pathStr, childFolderDB.title],
                pathIds: [...parentFolderEntity.pathIds, childFolderDB.id],
            });
            const newIndex = await repoFolderPosition
                .createQueryBuilder('FolderPosition')
                .select('COALESCE(MAX(index), 0) + 1', 'index')
                .leftJoin('FolderPosition.FolderRelation', 'FolderRelation')
                .leftJoin('FolderRelation.ParentFolder', 'ParentFolder')
                .where({
                    FolderRelation: {ParentFolder: {id: parentFolderDB.id}},
                    userId: user.id,
                    view: FolderViewOptions.ROOT,
                })
                .getRawOne();
            await repoFolderPosition.insert({
                FolderRelation: {id: ret.id},
                userId: user.id,
                view: FolderViewOptions.ROOT,
                index: newIndex.index,
            });
            return ret;
        } catch (err) {
            this.logger.error(`There was an error binding folders ${parentFolderId} / ${childFolderId}`, err);
            throw err;
        }
    }

    /**
     * Unbinds a child folder from a parent folder.
     *
     * @param {number} parentFolderId - The ID of the parent folder.
     * @param {number} childFolderId - The ID of the child folder.
     * @param {JwtUserInterface} user - The user initiating the unbinding process.
     *
     * @returns {Promise<DeleteResult>} - A Promise that resolves with the delete result.
     *
     * @throws {Error} - If an error occurs while unbinding the folders.
     */
    @Transactional()
    async unbindFolder(parentFolderId: number, childFolderId: number, user: JwtUserInterface): Promise<FolderRelationEntity[]> {
        const manager = this.repoFolder.manager;
        try {
            const repoFolderRelation = manager.getRepository<FolderRelationEntity>(FolderRelationEntity),
                repoFolderPosition = manager.getRepository<FolderPositionEntity>(FolderPositionEntity),
                folderRelation = await repoFolderRelation.findOne({
                    where: {
                        ParentFolder: {id: parentFolderId},
                        ChildFolder: {id: childFolderId},
                    },
                });

            const spaceId = await this.spaceService.getSpaceFromFolderId(childFolderId);

            await repoFolderPosition.delete({
                FolderRelation: {id: folderRelation.id},
                userId: user.id,
            });
            const folderRelationToRemove = await repoFolderRelation.findBy({
                id: folderRelation.id,
            });
            await repoFolderRelation.remove(folderRelationToRemove);

            if (
                !(await repoFolderRelation.findOne({
                    where: {
                        ChildFolder: {id: childFolderId},
                    },
                    relations: {ChildFolder: true},
                }))
            ) {
                const childFolder = await this.repoFolder.findOne({where: {id: childFolderId}});
                await repoFolderRelation.save({
                    ChildFolder: {id: childFolderId},
                    ParentFolder: {id: spaceId},
                    pathStr: [childFolder.title],
                    pathIds: [childFolderId],
                });
            }
            return folderRelationToRemove;
        } catch (err) {
            this.logger.error(`There was an error binding folders ${parentFolderId} / ${childFolderId}`, err);
            throw err;
        }
    }

    /**
     * Sets custom fields for a folder.
     *
     * @param {number} folderId - The ID of the folder.
     * @param {FolderCustomFieldDto[]} dtos - An array of custom field DTOs.
     * @param {JwtUserInterface} user - The user performing the action.
     * @return {Promise<InsertResult[]>} - A promise that resolves with an array of insert results.
     *
     * @throws {BadRequestException} - if there is an error with the custom field data.
     * @throws {Error} - if there is an error setting the custom fields.
     */
    @Transactional()
    async setCustomFields(folderId: number, dtos: FolderCustomFieldDto[], user: JwtUserInterface): Promise<InsertResult[]> {
        const manager = this.repoFolder.manager;
        try {
            const repoFolderCustomField = manager.getRepository<FolderCustomFieldEntity>(FolderCustomFieldEntity),
                repoCustomFieldDefinition = manager.getRepository<CustomFieldDefinitionEntity>(CustomFieldDefinitionEntity),
                // validate folder
                ret = [];
            // delete user custom fields
            await repoFolderCustomField.delete({userId: user.id});
            for (const dto of dtos) {
                // validate each dto
                if (dto.mandatory) {
                    const countCFD = await repoCustomFieldDefinition
                        .createQueryBuilder('CDF')
                        .where('CDF.id = :id')
                        .andWhere('CDF.user_id IS NULL')
                        .setParameter('id', dto.customFieldDefinitionId)
                        .setParameter('user_id', user.id)
                        .getCount();
                    if (countCFD === 1) {
                        // if (folderDB.Members.find((x) => x.userPermission === UserPermissionOptions.FULL)) {
                        ret.push(
                            await repoFolderCustomField.insert({
                                Folder: {id: folderId},
                                CustomFieldDefinition: {id: dto.customFieldDefinitionId},
                                userId: user.id,
                                mandatory: false,
                            })
                        );
                        // } else {
                        //     throw new BadRequestException(`The user must be has FULL permissions on the folder`);
                        // }
                    } else {
                        throw new BadRequestException(`The custom field ${dto.customFieldDefinitionId} must be common`);
                    }
                } else {
                    const count = await repoCustomFieldDefinition
                        .createQueryBuilder('CDF')
                        .where('CDF.id = :id')
                        .andWhere('(CDF.user_id = :user_id OR CDF.user_id IS NULL)')
                        .setParameter('id', dto.customFieldDefinitionId)
                        .setParameter('user_id', user.id)
                        .getCount();
                    if (count === 1) {
                        ret.push(
                            await repoFolderCustomField.insert({
                                Folder: {id: folderId},
                                CustomFieldDefinition: {id: dto.customFieldDefinitionId},
                                userId: user.id,
                                mandatory: false,
                            })
                        );
                    } else {
                        throw new BadRequestException(
                            `The custom field ${dto.customFieldDefinitionId} must be common or be owned by the current user`
                        );
                    }
                }
            }
            return ret;
        } catch (e) {
            this.logger.error(`There was an error setting gannt columns of folder ${folderId}`, e);
            throw e;
        }
    }

    /**
     * Update the favourite position of a folder for a specific user.
     * @param {number} folderId - The ID of the folder to update.
     * @param {number} index - The new position index for the folder.
     * @param {string} userId - The ID of the user.
     * @return {Promise<void>} - A Promise that resolves with no value once the update is complete.
     */
    @Transactional()
    async updateFavouritePosition(folderId: number, index: number, userId: string): Promise<void> {
        const manager = this.repoFolder.manager;
        const repoFolderFavourite = manager.getRepository<FolderFavouriteEntity>(FolderFavouriteEntity),
            siblings = await repoFolderFavourite.find({
                select: {Folder: {id: true}, index: true, id: true},
                where: {userId},
                relations: {Folder: true},
                order: {index: 'ASC'},
            });
        const folderToMoveIndex = siblings.findIndex((x) => x.Folder.id === folderId),
            folderToMove = siblings[folderToMoveIndex];
        siblings.splice(folderToMoveIndex, 1);
        siblings.splice(index, 0, folderToMove);
        let newIndex = 0;
        for (const sibling of siblings) {
            await repoFolderFavourite.update(sibling.id, {index: newIndex});
            newIndex++;
        }
    }

    //text
    /**
     * Retrieves the list of folders that a given user is following based on the showOn criteria.
     *
     * @param {JwtUserInterface} user - The user object representing the authenticated user.
     * @param {string} showOn - The criteria for determining which folders to include in the result. Can be a single value or an array of values.
     *
     * @returns {Promise<GetFollowingFolderDto[]>} - A Promise resolving to an array of GetFollowingFolderDto objects representing the folders the user is following.
     */
    getFollowing(user: JwtUserInterface, showOn: string): Promise<GetFollowingFolderDto[]> {
        // folders: id, title, folderType, members (ids), color
        const query = `SELECT F.ID,
                              F.TITLE,
                              F.USER_ID    AS "ownerId",
                              F.folder_type AS "folderType",
                              F.color,
                              F.SHOW_ON AS "showOn",
                              (SELECT ARRAY
                                          (SELECT FU.USER_ID
                                           FROM folder_user_ap FU
                                           WHERE FU.FOLDER_ID = F.ID AND FU.ENTITY_TYPE = 'folder')) AS ASSIGNEES
                       FROM FOLDER F
                                INNER JOIN FOLDER_FOLLOWER FF ON F.ID = FF.FOLDER_ID
                       WHERE FF.USER_ID = $1
                         AND ((F.USER_ID = $1) OR (EXISTS(SELECT FU.USER_ID
                                                          FROM folder_user_ap FU
                                                          WHERE FU.FOLDER_ID = F.ID AND FU.ENTITY_TYPE = 'folder'
                                                            AND FU.USER_ID = $1 AND ($2 = ANY (F.SHOW_ON)))))`;
        return this.repoFolder.manager.query(query, [user.id, showOn]);
    }

    /**
     * Retrieves files from specified folders.
     *
     * @param {number[]} folderIds - An array of folder IDs to fetch files from.
     * @return {Promise<TaskAttachmentEntity[]>} - A promise that resolves to an array of TaskAttachmentEntity objects representing the retrieved files.
     * @throws {Error} - If there was an error while fetching the files.
     */
    async getFiles(folderIds: number[]): Promise<TaskAttachmentEntity[]> {
        const manager = this.repoFolder.manager;
        try {
            const repoTaskAttachment = manager.getRepository<TaskAttachmentEntity>(TaskAttachmentEntity);
            const query = `SELECT TA.id AS id,
                            TA.file_name AS "fileName",
                            TA.thumbnail_name AS "thumbnailName",
                            TA.original_name AS "originalName",
                            TA.file_type AS "fileType",
                            TA.file_size AS "fileSize",
                            TA.added_by AS "addedBy",
                            TA.added_at AS "addedAt",
                            TA.last_seen_by AS "lastSeenBy",
                            TA.last_seen_at AS "lastSeenAt",
                            TA.task_id AS "taskId",
                            F.title AS "title"
                            FROM task_attachment TA
                            INNER JOIN task_relation TR ON TA.task_id = TR.child_task_id
                            INNER JOIN folder F ON TR.folder_id = F.id
                            WHERE TR.folder_id = ANY($1)`;
            const filesDB = await repoTaskAttachment.query(query, [folderIds]);
            for (const fileDB of filesDB) {
                fileDB['fileNameUrl'] = await this.s3Service.getSignedFileUrl(fileDB.fileName, {expiresIn: 3600});
                fileDB['thumbnailUrl'] = await this.s3Service.getSignedFileUrl(fileDB.thumbnailName, {expiresIn: 3600});
            }
            return filesDB;
        } catch (e) {
            this.logger.error(`There was an error while fetching files form folder ${folderIds}`, e);
            throw e;
        }
    }

    //todo : add return types
    /**
     * Retrieves the followers of a folder.
     *
     * @param {number} folderId - The ID of the folder.
     * @return {Promise<FolderFollowerEntity[]>} - A promise that resolves to an array of FolderFollowerEntity instances representing the followers of the folder.
     */
    async getFollowers(folderId: number): Promise<FolderFollowerEntity[]> {
        const manager = this.repoFolder.manager;
        const repoFolderFollower = manager.getRepository<FolderFollowerEntity>(FolderFollowerEntity);

        return await repoFolderFollower.find({
            // select: {User: {id: true}},
            where: {Folder: {id: folderId}},
            relations: {/*User: true,*/ Folder: true},
        });
    }

    /**
     * Change the owner of a folder.
     *
     * @async
     * @param {number} folderId - The ID of the folder to change the owner of.
     * @param {string} newOwnerId - The ID of the new owner.
     * @returns {Promise<void>} - A promise that resolves when the owner has been changed successfully or rejects with an error.
     *
     * @throws {Error} - If there was an error while changing the owner of the folder.
     */
    @Transactional()
    async changeOwner(folderId: number, newOwnerId: string): Promise<void> {
        const manager = this.repoFolder.manager;
        try {
            const repoFolder = manager.getRepository<FolderEntity>(FolderEntity);
            // change owner
            await repoFolder.update({id: folderId}, {userId: newOwnerId, id: folderId});
        } catch (error) {
            this.logger.error(`There was an error while changing owner of folder ${JSON.stringify(newOwnerId)}`, error);
            throw error;
        }
    }

    /**
     * Subscribe to a Folder to get emails when it is updated.
     * @param {number} folderId - The ID of the folder to subscribe to.
     * @param {string} userId - The ID of the user subscribing to the folder.
     * @param {string} showOn - The type of update to show on (e.g. "all", "parent", "none").
     * @return {Promise<FolderFollowerEntity>} - The subscription entity.
     */
    @Transactional()
    async follow(folderId: number, userId: string, showOn: string): Promise<FolderFollowerEntity> {
        const manager = this.repoFolder.manager;
        try {
            const repoFolderFollower = manager.getRepository<FolderFollowerEntity>(FolderFollowerEntity),
                repoTaskFollower = manager.getRepository<TaskFollowerEntity>(TaskFollowerEntity),
                subscription = await repoFolderFollower.findOne({
                    where: {
                        Folder: {id: folderId},
                        userId: userId,
                    },
                });
            if (subscription) {
                throw new BadRequestException('You are already subscribed to this folder');
            }
            const tasks = await this.getTaskTree(folderId, showOn);

            const funcFollowTask = async (tasks): Promise<void> => {
                for (const task of tasks) {
                    const foundFollow = await repoTaskFollower.findOne({
                        where: {
                            Task: {id: task.id},
                            userId: userId,
                        },
                    });
                    if (!foundFollow) {
                        await repoTaskFollower.insert({
                            Task: {id: task.id},
                            userId: userId,
                        });
                    }
                    await funcFollowTask(task.children);
                }
            };
            await funcFollowTask(tasks);

            return await repoFolderFollower.save({
                Folder: {id: folderId},
                userId: userId,
            });
        } catch (err) {
            this.logger.error(`There was an error subscribing to folder ${folderId}`, err);
            throw err;
        }
    }

    /**
     * Remove a subscription from a specific Folder
     *
     * @param {number} folderId - The ID of the folder to unfollow
     * @param {string} userId - The ID of the user unfollowing the folder
     * @param {string} showOn - The type of task to show when unfollowing (optional)
     *
     * @returns {Promise<DeleteResult>} - The result of the delete operation
     */
    @Transactional()
    async unfollow(folderId: number, userId: string, showOn: string): Promise<DeleteResult> {
        const manager = this.repoFolder.manager;
        try {
            const repoFolderFollower = manager.getRepository<FolderFollowerEntity>(FolderFollowerEntity),
                repoTaskFollower = manager.getRepository<TaskFollowerEntity>(TaskFollowerEntity),
                subscription = await repoFolderFollower.findOne({
                    where: {
                        Folder: {id: folderId},
                        userId: userId,
                    },
                });
            if (!subscription) {
                throw new BadRequestException(`You are not subscribed to this folder`);
            }
            const tasks = await this.getTaskTree(folderId, showOn);

            const funcUnfollowTask = async (tasks): Promise<void> => {
                for (const task of tasks) {
                    const foundFollow = await repoTaskFollower.findOne({
                        where: {
                            Task: {id: task.id},
                            userId: userId,
                        },
                    });
                    if (foundFollow) {
                        await repoTaskFollower.delete({id: foundFollow.id});
                    }
                    await funcUnfollowTask(task.children);
                }
            };
            await funcUnfollowTask(tasks);

            return await repoFolderFollower.delete({id: subscription.id});
        } catch (err) {
            this.logger.error(`There was an error unsubscribing to folder ${folderId}`, err);
            throw err;
        }
    }

    public async validateUpdateFolderParameters(
        folder: FolderEntity,
        user: JwtUserInterface,
        dto: UpdateFolderPositionDto,
        repoFolderPosition: Repository<FolderPositionEntity>,
        repoFolderRelation: Repository<FolderRelationEntity>
    ): Promise<void> {
        //*move index of spaces
        if (folder.folderType === FolderTypeOptions.SPACE && !dto.parentFolderNewId && !dto.parentFolderOldId) {
            await this.fixIndex(
                repoFolderRelation,
                user.id,
                dto.view,
                dto.index,
                dto.parentFolderNewId,
                repoFolderPosition,
                folder.id,
                EntityTypeOptions.Space
            );
            return;
        }

        //*folder move only inside spaces
        if (!dto.parentFolderNewId || !dto.parentFolderOldId) {
            if (!dto.parentFolderNewId) {
                throw new BadRequestException(`Can't place a folder in place of a space`);
            }
            if (!dto.parentFolderOldId) {
                throw new BadRequestException(`Can't place a space in place of a space`);
            }
        }

        //*check old and new parents spacesIds
        const oldParentSpace = await this.spaceService.getSpaceFromFolderId(dto.parentFolderOldId);
        const newParentSpace = await this.spaceService.getSpaceFromFolderId(dto.parentFolderNewId);

        //*check old and new parents spacesIds are the same
        if (oldParentSpace && newParentSpace && oldParentSpace !== newParentSpace) {
            throw new BadRequestException(`Can only move folders inside the same space`);
        }

        if (!dto.parentFolderNewId && !dto.parentFolderOldId) {
            throw new BadRequestException(`There are errors in the parameters`);
        }
    }

    /**
     * Updates the position of a folder in the folder hierarchy.
     *
     * @param {number} folder_id - The ID of the folder to update.
     * @param {UpdateFolderPositionDto} dto - The data to update the folder position.
     * @param {JwtUserInterface} user - The user performing the update.
     * @returns {Promise<void>} - A Promise that resolves when the folder position is updated.
     *
     * @throws {BadRequestException} - If there are errors in the parameters or if a loop is found in the folder hierarchy.
     */
    @Transactional()
    private async _updateFolderPositionEx(folder_id: number, dto: UpdateFolderPositionDto, user: JwtUserInterface): Promise<void> {
        const manager = this.repoFolder.manager;
        const // userPermissionForEdit = [UserPermissionOptions.FULL, UserPermissionOptions.EDITOR],
            repoFolder = manager.getRepository<FolderEntity>(FolderEntity),
            repoFolderRelation = manager.getRepository<FolderRelationEntity>(FolderRelationEntity),
            repoFolderPosition = manager.getRepository<FolderPositionEntity>(FolderPositionEntity);

        const folder = await repoFolder.findOne({
            where: {id: folder_id},
        });

        await this.validateUpdateFolderParameters(folder, user, dto, repoFolderPosition, repoFolderRelation);

        //*move between folders
        if (dto.parentFolderNewId && dto.parentFolderOldId) {
            //check for loop
            const loop = await checkForFolderLoop(repoFolder, dto.parentFolderNewId, folder_id);

            const spaceId = await this.spaceService.getSpaceFromFolderId(folder_id);

            // deep check for possible loop in the folder and parent trees
            const check: boolean = await checkForFolderLoopV2(repoFolder, spaceId, user.id, dto.parentFolderNewId, folder_id);

            if (loop || check) {
                throw new BadRequestException('Loop found');
            }

            // different parents
            if (dto.parentFolderNewId !== dto.parentFolderOldId) {
                //*----------- remove from old parent folder
                const folderRelation = await repoFolderRelation.findOne({
                    where: {
                        ParentFolder: {id: dto.parentFolderOldId},
                        ChildFolder: {id: folder_id},
                    },
                });

                const folderRelationFolderRelationId = await repoFolderPosition.findBy({FolderRelation: {id: folderRelation.id}});

                await repoFolderPosition.remove(folderRelationFolderRelationId);
                await repoFolderRelation.remove(folderRelation);
                // fix index on old parent folder
                await this.fixIndex(repoFolderRelation, user.id, dto.view, dto.index, dto.parentFolderOldId, repoFolderPosition);

                // * -------------------- add to new parent folder ------------------- * //
                const newParent = await repoFolderRelation.findOne({
                    where: {
                        ChildFolder: {id: dto.parentFolderNewId},
                    },
                });

                const newFolderRelation = await repoFolderRelation.save({
                    ParentFolder: {id: dto.parentFolderNewId},
                    ChildFolder: {id: folder_id},
                    pathIds: [...newParent.pathIds, folder_id],
                    pathStr: [...newParent.pathStr, folder.title],
                });

                await repoFolderPosition.insert({
                    FolderRelation: {id: newFolderRelation.id},
                    userId: user.id,
                    view: dto.view,
                    index: 99999,
                });
                // fix index on new parent folder
                await this.fixIndex(repoFolderRelation, user.id, dto.view, dto.index, dto.parentFolderNewId, repoFolderPosition, folder_id);
            } else {
                // same parents
                // fix index on (old === new) parent folder
                await this.fixIndex(repoFolderRelation, user.id, dto.view, dto.index, dto.parentFolderNewId, repoFolderPosition, folder_id);
            }
        }
    }

    /**
     * Fix the index of a folder in the folder hierarchy.
     *
     * @param {Repository<FolderRelationEntity>} repoFolderRelation - The repository for the FolderRelationEntity.
     * @param {string} user_id - The user ID.
     * @param {FolderViewOptions} view - The view options for the folder.
     * @param {number} index - The desired index for the folder.
     * @param {number} parent_folder_id - The parent folder ID.
     * @param {Repository<FolderPositionEntity>} repoFolderPosition - The repository for the FolderPositionEntity.
     * @param {number} [folder_id=null] - (optional) The ID of the folder to move. If provided, the folder will be moved to the desired index.
     *
     * @return {Promise<void>} - A Promise that resolves void when the index is fixed.
     *
     * @throws {Error} - If there is an error updating or inserting folder positions.
     **/
    @Transactional()
    private async fixIndex(
        repoFolderRelation: Repository<FolderRelationEntity>,
        user_id: string,
        view: FolderViewOptions,
        index: number,
        parent_folder_id: number,
        repoFolderPosition: Repository<FolderPositionEntity>,
        folder_id: number = null,
        entityType: EntityTypeOptions = EntityTypeOptions.Folder
    ): Promise<void> {
        try {
            const query = repoFolderRelation
                .createQueryBuilder('fr')
                .select('fr.id', 'fr_id')
                .addSelect('fp.id', 'fp_id')
                .addSelect('fr.child_folder_id')
                .innerJoin(FolderEntity, 'f', 'fr.child_folder_id = f.id')
                .leftJoin(FolderPositionEntity, 'fp', 'fr.id = fp.folder_relation_id and fp.user_id = :user_id and fp.view = :view', {
                    user_id,
                    view,
                })
                .where(
                    `(f.user_id = :user_id or exists (select 1 from folder_user_ap fu where fu.folder_id = f.id and fu.user_id = :user_id AND fu.entity_type = :entityType ))`,
                    {
                        user_id,
                        entityType,
                    }
                )
                .andWhere('(f.archived_at IS NULL)')
                .andWhere('(f.deleted_at IS NULL)')
                .orderBy('fp.index', 'ASC');
            if (parent_folder_id) {
                query.andWhere('(fr.parent_folder_id = :parent_folder_id)', {parent_folder_id});
            } else {
                query.andWhere('(fr.parent_folder_id is null)');
            }
            const siblings = await query.getRawMany();
            if (folder_id) {
                const folderToMoveIndex = siblings.findIndex((x) => x.child_folder_id === folder_id);
                if (folderToMoveIndex >= 0) {
                    const folderToMove = siblings[folderToMoveIndex];
                    siblings.splice(folderToMoveIndex, 1);
                    siblings.splice(index, 0, folderToMove);
                }
            }
            let newIndex = 0;
            for (const sibling of siblings) {
                if (sibling.fp_id) {
                    await repoFolderPosition.update(sibling.fp_id, {index: newIndex});
                } else {
                    await repoFolderPosition.insert({
                        FolderRelation: {id: sibling.fr_id},
                        userId: user_id /*User: {id: user_id}*/,
                        index: newIndex,
                        view,
                    });
                }
                newIndex++;
            }
        } catch (error) {
            this.logger.error(`There was an error fixing index of folder while changing position `, error);
            throw error;
        }
    }

    //todo : remove validate folder from here
    /**
     * Adds custom field values to a folder.
     *
     * @param {number} folderId - The id of the folder.
     * @param {CreateFolderCustomFieldValueDto[]} dto - The array of custom field values to be added.
     * @param {string} userId - The id of the user performing the action.
     * @returns {Promise<InsertResult>} - A promise that resolves to the insert result.
     * @throws {NotFoundException} - If the custom field definition is not found.
     * @throws {UnauthorizedException} - If the current user does not have permission to use the custom field.
     * @throws {Error} - If there was an error creating the custom field values.
     */
    @Transactional()
    async addFolderCustomFieldValue(
        folderId: number,
        dto: CreateFolderCustomFieldValueDto[],
        userId: string,
        entityType: EntityTypeOptions
    ): Promise<InsertResult> {
        const manager = this.repoFolder.manager;
        const repoTaskRelation = manager.getRepository<TaskRelationEntity>(TaskRelationEntity),
            repoCustomFieldDefinition = manager.getRepository<CustomFieldDefinitionEntity>(CustomFieldDefinitionEntity),
            repoCustomFieldValue = manager.getRepository<CustomFieldValueEntity>(CustomFieldValueEntity);

        //** validate new custom fields */
        this.logger.debug('Getting space from folder id');
        const spaceId = await this.spaceService.getSpaceFromFolderId(folderId);
        if (spaceId && entityType !== EntityTypeOptions.Space) {
            this.logger.debug('Validating custom fields');
            await this.validateCustomFields(spaceId, dto);
        }

        const folderTasks = await repoTaskRelation.find({
            where: {folderId: folderId},
            relations: {ChildTask: true},
        });
        const fieldValues = [];
        for (const field of dto.filter((cf) => !cf.needDeleteAlsoForChildren)) {
            // validate custom field definition
            const customFieldDefinitionDB = await repoCustomFieldDefinition.findOne({
                where: {id: field.id},
            });
            if (!customFieldDefinitionDB) {
                throw new NotFoundException(`Custom field definition ${field.id} not found`);
            }
            if (customFieldDefinitionDB.userId && customFieldDefinitionDB.userId !== userId) {
                throw new UnauthorizedException(`The current user don't have permission to use the custom field ${field.id}`);
            }

            this.logger.debug('Validating custom field value');
            validateCustomFieldValue(customFieldDefinitionDB.type, field.value);

            fieldValues.push({
                value: field.value,
                folderId: folderId,
                customFieldDefinitionId: field.id,
                index: field.index,
            });

            for (const task of folderTasks) {
                const value = await repoCustomFieldValue.findOne({
                    where: {customFieldDefinitionId: field.id, taskId: task.ChildTask.id},
                });
                const dto = {
                    value: field.value,
                    taskId: task.ChildTask.id,
                    customFieldDefinitionId: field.id,
                    index: field.index,
                };
                if (!value) {
                    this.logger.debug('Inserting custom field value');
                    await repoCustomFieldValue.insert(dto);
                }
            }
        }

        this.logger.debug('Removing custom field values');
        for (const field of dto.filter((cf) => cf.needDeleteAlsoForChildren)) {
            for (const task of folderTasks) {
                const value = await repoCustomFieldValue.findBy({customFieldDefinitionId: field.id, taskId: task.ChildTask.id});
                await repoCustomFieldValue.remove(value);
            }
        }

        this.logger.debug('Removing custom field value');
        const value = await repoCustomFieldValue.findBy({Folder: {id: folderId}});
        await repoCustomFieldValue.remove(value);

        this.logger.debug('Inserting custom field value');
        return await repoCustomFieldValue.insert(fieldValues);
    }

    /**
     * Creates a new PaginationDto based on the provided PaginationDto.
     *
     * @param {PaginationDto} pagination - The original PaginationDto.
     * @return {PaginationDto} - The new PaginationDto.
     */
    private createPagination(pagination: PaginationDto): PaginationDto {
        if (pagination) {
            return {offset: pagination.offset * pagination.limit, limit: pagination.limit};
        }
        return {offset: 0, limit: 100};
    }

    //to do - test cast
    /**
     * Update folder tags.
     *
     * @param {number} folder_id - The folder id to update folder.
     * @param {UpdateFolderTagsTasksDto} dto - The DTO containing all the tag ids to be updated.
     * @return {Promise<void>} - A promise that resolves when the folder tags have been updated.
     */
    @Transactional()
    async updateFolderTags(folder_id: number, dto: UpdateFolderTagsTasksDto, entityType: EntityTypeOptions): Promise<void> {
        const manager = this.repoFolder.manager;
        const repoTagTaskFolder = manager.getRepository<TagTaskFolderEntity>(TagTaskFolderEntity);

        const spaceId = await this.spaceService.getSpaceFromFolderId(folder_id);

        if (dto.insert && dto.insert.length > 0) {
            //** add validation here that new tags should be part of the space */
            if (spaceId && entityType != EntityTypeOptions.Space) {
                await this.validateTagsOnFolders(spaceId, dto.insert);
            }

            for (const tagId of dto.insert) {
                // validate that the tag does not exist
                const tagFolderDB = await repoTagTaskFolder.findOne({
                    where: {
                        Folder: {id: folder_id},
                        Tag: {id: tagId},
                    },
                });
                if (!tagFolderDB) {
                    await repoTagTaskFolder.insert({
                        type: TagTaskFolderTypeOptions.FOLDER_TAG,
                        Tag: {id: tagId},
                        Folder: {id: folder_id},
                    });
                }
            }
        }
        if (dto.delete && dto.delete.length > 0) {
            for (const tagId of dto.delete) {
                // validate that the tags exists
                const tagFolderDB = await repoTagTaskFolder.findOne({
                    where: {
                        Folder: {id: folder_id},
                        Tag: {id: tagId},
                    },
                });
                if (tagFolderDB) {
                    const tagTasFolderToRemove = await repoTagTaskFolder.findBy({id: tagFolderDB.id});
                    await repoTagTaskFolder.remove(tagTasFolderToRemove);
                }
            }
        }
        return;
    }

    //to do - test cast
    /**
     * Get folder tags
     *
     * @param {number} folder_id - The ID of the folder to get folder tags from
     * @returns {Promise<TagEntity[]>} - A promise that resolves to an array of TagEntity objects representing the folder tags
     */
    async getFolderTags(folder_id: number): Promise<TagEntity[]> {
        const tagsTaskFolder = await this.repoFolder.manager
            .createQueryBuilder('tags_task_folder', 'TF')
            .leftJoinAndSelect('TF.Tag', 'TAG')
            .where('folder_id = :folderId', {folderId: folder_id})
            .getMany();
        if (tagsTaskFolder.length) {
            return tagsTaskFolder.map((t) => {
                return {...t.Tag, type: t.type};
            });
        }
        return [];
    }

    /**
     * Copies a folder and its contents to a new parent folder.
     *
     * @async
     * @function copyFolder
     * @param {number} folderId - The ID of the folder to be copied.
     * @param {number} parentFolderId - The ID of the new parent folder.
     * @param {CopyFolderDto} dto - The data transfer object containing the information needed for the folder copy.
     * @param {JwtUserInterface} user - The authenticated user.
     * @param {string} authorization - The authorization token.
     * @param {string} showOn - The showOn string.
     * @returns {Promise<FolderEntity>} - Promise that resolves to the copied folder entity.
     */
    @Transactional()
    async copyFolder(
        folderId: number,
        parentFolderId: number,
        dto: CopyFolderDto,
        user: JwtUserInterface,
        authorization: string,
        showOn: string,
        entityType: EntityTypeOptions
    ): Promise<FolderEntity> {
        const manager = this.repoFolder.manager;
        try {
            const repoFolder = manager.getRepository<FolderEntity>(FolderEntity),
                repoWorkflow = manager.getRepository<WorkFlowEntity>(WorkFlowEntity),
                repoTagTaskFolder = manager.getRepository<TagTaskFolderEntity>(TagTaskFolderEntity),
                repoCustomFieldValue = manager.getRepository<CustomFieldValueEntity>(CustomFieldValueEntity),
                repoFolderFilter = manager.getRepository<FolderFilterEntity>(FolderFilterEntity),
                repoFolderSpaceCustomFieldCollections = manager.getRepository<FolderSpaceCustomFieldCollectionEntity>(
                    FolderSpaceCustomFieldCollectionEntity
                ),
                repoFolderSpaceTagsCollections = manager.getRepository<FolderSpaceTagsCollectionEntity>(FolderSpaceTagsCollectionEntity),
                repoFolderSpaceTeams = manager.getRepository<FolderSpaceTeamEntity>(FolderSpaceTeamEntity),
                repoWorkflowStates = manager.getRepository<WorkFlowStateEntity>(WorkFlowStateEntity);

            const folderDB = await repoFolder
                .createQueryBuilder('Folder')
                .leftJoinAndSelect('Folder.Members', 'Members')
                .leftJoinAndSelect('Folder.WorkFlow', 'WorkFlow')
                .leftJoinAndSelect('WorkFlow.WorkFlowStates', 'WorkFlowStates')
                .where({id: folderId})
                .getOne();

            //Source cannot be a empty string
            validateSource(dto.source);

            const folderSpaceTeams = await repoFolderSpaceTeams.find({where: {Folder: {id: folderId}}});
            const folderSpaceCustomFieldsCollections = await repoFolderSpaceCustomFieldCollections.find({where: {Folder: {id: folderId}}});
            const folderSpaceTagsCollections = await repoFolderSpaceTagsCollections.find({where: {Folder: {id: folderId}}});

            //2.Copy the workflow assigned to the folder
            const oldWorkflowDB = await repoWorkflow.findOne({
                where: {Folders: {id: In([folderDB.id])}},
                relations: {
                    WorkFlowStates: true,
                },
            });
            if (!oldWorkflowDB) {
                throw new BadRequestException('Folder Workflow Not found');
            }
            const workflow = new ChangeWorkflowFolderDto();
            let newWorkFlowDB: WorkFlowEntity;
            if (!oldWorkflowDB.userId) {
                workflow.type = ChangeWorkflowOptions.COMMON_TO_COMMON;
                workflow.commonWorkflow = oldWorkflowDB.id;
                newWorkFlowDB = oldWorkflowDB;
            } else {
                workflow.type = ChangeWorkflowOptions.PERSONALISE_TO_PERSONALISE;
                newWorkFlowDB = await this.workflowService.createWorkflowState(
                    {
                        title: oldWorkflowDB.title,
                        description: oldWorkflowDB.description,
                        color: oldWorkflowDB.color,
                        active: oldWorkflowDB.active,
                        states: oldWorkflowDB.WorkFlowStates,
                    },
                    user.id
                );
                workflow.personaliseWorkflow = newWorkFlowDB.id;
            }
            const newWorkFlowStates = await repoWorkflowStates.find({where: {workflowId: newWorkFlowDB.id}});
            newWorkFlowDB['WorkFlowStates'] = newWorkFlowStates;
            let newTitle = folderDB.title;
            if (parentFolderId === null) {
                if (dto.newFolderTitle && dto.newFolderTitle !== '') {
                    newTitle = dto.newFolderTitle;
                } else {
                    newTitle = folderDB.title + ' - ' + dto.prefix;
                }
            }

            const createFolderDto: CreateFolderDto = {
                startDate: folderDB.startDate,
                color: folderDB.color,
                defaultView: folderDB.defaultView,
                description: folderDB.description,
                endDate: folderDB.endDate,
                folderType: folderDB.folderType,
                title: newTitle,
                viewType: folderDB.viewType,
                parentFolderId: parentFolderId != null ? parentFolderId : dto.newParentFolderId, // if parentFolderId!=null we are copying subfolders of the folder we are copying. Otherwise we want the parent to be CopyFolderDto.newParentFolderId
                workflow,
                source: dto.source,
                showOn: dto.showOn,
                extra: dto.extra ? dto.extra : null,
            };

            const folderCopy = await this.createFolder(createFolderDto, user.id, createFolderDto.parentFolderId, entityType);

            //** Get teams of the folder/space and reassign.
            if (folderSpaceTeams.length) {
                for (const folderSpaceTeam of folderSpaceTeams) {
                    await repoFolderSpaceTeams.insert({
                        Folder: {id: folderCopy.id},
                        Team: {id: folderSpaceTeam.teamId},
                        teamPermissions: folderSpaceTeam.teamPermissions,
                    });
                }
            }

            //** Assign custom field collection to the folder/space */
            if (folderSpaceCustomFieldsCollections.length) {
                for (const folderSpaceCustomFieldsCollection of folderSpaceCustomFieldsCollections) {
                    await repoFolderSpaceCustomFieldCollections.insert({
                        Folder: {id: folderCopy.id},
                        CustomFieldCollection: {id: folderSpaceCustomFieldsCollection.customFieldCollectionId},
                    });
                }
            }

            //** Assign custom field collection to the folder/space */
            if (folderSpaceTagsCollections.length) {
                for (const folderSpaceTagsCollection of folderSpaceTagsCollections) {
                    await repoFolderSpaceTagsCollections.insert({
                        Folder: {id: folderCopy.id},
                        TagsCollection: {id: folderSpaceTagsCollection.tagCollectionId},
                    });
                }
            }

            if (dto.favoriteFolderCopy) {
                const folderType =
                    entityType === EntityTypeOptions.Space
                        ? [FolderTypeOptions.SPACE]
                        : [FolderTypeOptions.FOLDER, FolderTypeOptions.PROJECT];
                await this.markFolderFavourite(folderCopy.id, user.id, folderType);
            }

            await this.setViews(folderCopy.id, folderDB.availableViews as FolderViewDto[]);

            //3.Copy the task tree
            if (dto.tasks == true) {
                const tasks = await this.getTaskTree(folderId, showOn, dto.includeArchived);

                for (const task of tasks) {
                    await this.taskService.copyTask(
                        task,
                        null,
                        folderCopy.id,
                        oldWorkflowDB.WorkFlowStates,
                        newWorkFlowDB,
                        user,
                        authorization,
                        dto.includeArchived
                    );
                }
            }
            //4.Copy the assigned members to the original folder
            if (dto.members == true) {
                await this.authorization.copyPermissionsFromEntityToAnother(entityType, folderDB.id, folderCopy.id);
            }
            //5.Copy the common custom fields and the personal ones of the active user in the copy folder
            if (dto.customFields === true) {
                const customFields = await repoCustomFieldValue.find({where: {folderId}});
                for (const customField of customFields) {
                    const index = await repoCustomFieldValue
                        .createQueryBuilder('CustomFieldValue')
                        .select('COALESCE(MAX(index), 0) + 1', 'index')
                        .getRawOne();
                    await repoCustomFieldValue.save({
                        value: customField.value,
                        folderId: folderCopy.id,
                        customFieldDefinitionId: customField.customFieldDefinitionId,
                        index: index.index,
                    });
                }
            }
            if (dto.tags == true) {
                const tags = await repoTagTaskFolder.find({
                    select: {Tag: {id: true}, type: true},
                    where: {
                        Folder: {id: folderId},
                    },
                    relations: {Folder: true, Tag: true},
                });
                for (const tag of tags) {
                    await repoTagTaskFolder.insert({
                        Folder: {id: folderCopy.id},
                        type: tag.type,
                        Tag: {id: tag.Tag.id},
                    });
                }
            }
            //6.Copies folder filters
            if (dto.filters == true) {
                const filters = await repoFolderFilter.find({where: {Folder: {id: folderId}}});
                for (const filter of filters) {
                    await repoFolderFilter.save({
                        Folder: {id: folderCopy.id},
                        title: filter.title,
                        filter: filter.filter,
                    });
                }
            }
            //6.Repeat the process for the folder children
            if (dto.children == true && dto.childFolderIdsToCopy != null) {
                const children = await this.getChildren(folderId);
                for (const child of children) {
                    if (dto.childFolderIdsToCopy.includes(child.id)) {
                        await this.copyFolder(child.id, folderCopy.id, dto, user, authorization, showOn, EntityTypeOptions.Folder);
                    }
                }
            }
            return folderCopy;
        } catch (error) {
            this.logger.error(`There was an error while copying a folder ${JSON.stringify(dto)}`, error);
            throw error;
        }
    }

    /**
     * Retrieves the child folders of a given parent folder ID.
     *
     * @param {number} folderParentId - The ID of the parent folder.
     * @return {Promise<FolderEntity[]>} - A Promise that resolves with an array of FolderEntity objects representing the child folders.
     */
    async getChildren(folderParentId: number): Promise<FolderEntity[]> {
        const repoFolderRelation = this.repoFolder.manager.getRepository<FolderRelationEntity>(FolderRelationEntity);
        const res = await repoFolderRelation
            .createQueryBuilder('FR')
            .innerJoinAndSelect('FR.ChildFolder', 'ChildFolder')
            .innerJoin('FR.ParentFolder', 'ParentFolder')
            .where('ParentFolder.id =:parent_folder_id', {parent_folder_id: folderParentId})
            .andWhere('ParentFolder.archived_at IS NULL')
            .andWhere('ParentFolder.deleted_at IS NULL')
            .andWhere('ChildFolder.archived_at IS NULL')
            .andWhere('ChildFolder.deleted_at IS NULL')
            .getMany();
        return res.map((x) => x.ChildFolder);
    }

    //TODO : Test Case && move part of the code which belongs to app
    /**
     * Imports tasks from an Excel file and organizes them into folders.
     *
     * @param {Express.Multer.File} file - The Excel file containing the tasks to import.
     * @param {ImportTasksFromExcelDto} dto - The data transfer object containing information about the import.
     * @param {number} [folder_id=null] - The ID of the parent folder to import the tasks into. If not specified, the tasks will be imported into the root folder.
     * @param {JwtUserInterface} user - The user performing the import.
     * @returns {Promise<boolean>} - A promise that resolves to `true` if the import was successful, or `false` otherwise.
     */
    @Transactional()
    async importFoldersTasks(
        file: Express.Multer.File,
        dto: ImportTasksFromExcelDto,
        folder_id: number = null,
        user: JwtUserInterface
    ): Promise<boolean> {
        const manager = this.repoFolder.manager;
        try {
            const repoFolder = manager.getRepository<FolderEntity>(FolderEntity),
                repoImportance = manager.getRepository<ImportanceEntity>(ImportanceEntity),
                repoWorkflow = manager.getRepository<WorkFlowEntity>(WorkFlowEntity),
                importancesDB = await repoImportance.find(),
                workflowsDB = await repoWorkflow.find({
                    select: {id: true, title: true, WorkFlowStates: {id: true, title: true}},
                    relations: {WorkFlowStates: true},
                    order: {WorkFlowStates: {index: 'ASC'}},
                }),
                // open excel
                workbook: WorkBook = XLSX.read(file.buffer, {cellDates: true}),
                listTaskKeyId = {},
                listFolderKeyId = {},
                dependecyList = {},
                customFields = {};

            let parentFolderDB: FolderEntity = null;

            if (!isNaN(folder_id)) {
                parentFolderDB = await repoFolder
                    .createQueryBuilder('Folder')
                    .leftJoinAndSelect('Folder.Members', 'Members')
                    .leftJoinAndSelect('Folder.WorkFlow', 'WorkFlow')
                    .leftJoinAndSelect('WorkFlow.WorkFlowStates', 'WorkFlowStates')
                    .where({id: folder_id})
                    .getOne();
                listFolderKeyId['/'] = {
                    folderId: parentFolderDB.id,
                    workflow: parentFolderDB.WorkFlow,
                };
            }
            // validate structure
            if (workbook?.SheetNames?.length === 0) {
                throw new BadRequestException(`Excel file don't have sheets`);
            }
            const defaultSelectedWrikeColumns = [
                'Key',
                'Folder',
                'Parent task',
                'Default task workflow',
                'Default project workflow',
                'Title',
                'Workflow',
                'Status',
                'Custom status',
                'Priority',
                'Assigned To',
                'Start Date',
                'Duration (Hours)',
                'End Date',
                'Depends On',
                'Start Date Constraint',
                'Description',
            ];
            // process excel

            for (const column of dto.mappedColumns) {
                if (!defaultSelectedWrikeColumns.includes(column.columnName) && column.selected) {
                    if (!column.customFieldId) {
                        const customFieldSaved = await this.customFieldDefinitionService.createCustomField(
                            {
                                title: column.columnName,
                                type: column.type as CustomFieldDefinitionTypeOptions,
                                inheritanceType: InheritanceTypeOptions.ALL,
                                active: true,
                                setting: {decimals: 0, options: []},
                            },
                            user.id
                        );
                        customFields[column.columnName] = {id: customFieldSaved.raw[0].id};
                    } else {
                        customFields[column.columnName] = {id: column.customFieldId};
                    }
                }
            }

            const sheet: WorkSheet = workbook.Sheets[workbook.SheetNames[0]],
                headers = get_header_row(sheet),
                range = XLSX.utils.decode_range(sheet['!ref']);
            for (let R = range.s.r + 1; R <= range.e.r; ++R) {
                const key = get_cell_value<number>(sheet, headers, R, this.KEY),
                    title = get_cell_value<string>(sheet, headers, R, this.TITLE),
                    description = get_cell_value<string>(sheet, headers, R, this.DESCRIPTION),
                    startDate = get_cell_value<Date>(sheet, headers, R, this.START_DATE),
                    endDate = get_cell_value<Date>(sheet, headers, R, this.END_DATE),
                    parentTask = get_cell_value<string>(sheet, headers, R, this.PARENT_TASK),
                    assignedTo = get_cell_value<string>(sheet, headers, R, this.ASSIGNED_TO),
                    dependsOn = get_cell_value<string>(sheet, headers, R, this.DEPENDS_ON),
                    priority = get_cell_value<string>(sheet, headers, R, this.PRIORITY),
                    importance = getImportance(importancesDB, priority),
                    folder = get_cell_value<string>(sheet, headers, R, this.FOLDER),
                    defaultProjectWorkflow = get_cell_value<string>(sheet, headers, R, this.DEFAULT_PROJECT_WORKFLOW),
                    customStatus = get_cell_value<string>(sheet, headers, R, this.CUSTOM_STATUS),
                    duration = get_cell_value<Date>(sheet, headers, R, this.DURATION),
                    effort = get_cell_value<Date>(sheet, headers, R, this.EFFORT),
                    startDateConstraint = get_cell_value<string>(sheet, headers, R, this.START_DATE_CONSTRAINT),
                    assignees = [];
                // is a folder
                let workflowDB = workflowsDB.find((x) => x.title.toLowerCase() === parentFolderDB.WorkFlow.title.toLowerCase());
                if (!workflowDB) {
                    workflowDB = workflowsDB[0];
                }
                if (defaultProjectWorkflow?.length > 0) {
                    // get parent folder
                    let parent_folder_id = null;
                    if (listFolderKeyId[folder]) {
                        parent_folder_id = listFolderKeyId[folder].folderId;
                    }
                    // create folder
                    const folderDB = await this.createFolder(
                        {
                            color: 'red',
                            folderType: startDate ? FolderTypeOptions.PROJECT : FolderTypeOptions.FOLDER,
                            description,
                            endDate,
                            startDate: startDate || new Date(),
                            title: title.replace(/\//g, ''),
                            viewType: FolderViewTypeOptions.PUBLIC,
                            defaultView: DefaultViewOptions.BOARD,
                            workflow: {
                                commonWorkflow: workflowDB.id,
                                personaliseWorkflow: null,
                                type: ChangeWorkflowOptions.COMMON_TO_COMMON,
                                Mapping: [],
                            },
                            source: dto.source,
                            extra: dto.extra ? dto.extra : null,
                            showOn: dto.showOn,
                            parentFolderId: parent_folder_id,
                        },
                        user.id,
                        parent_folder_id,
                        EntityTypeOptions.Folder
                    );
                    /* Permissions */
                    {
                        await this.authorization.grantOwner(EntityTypeOptions.Folder, user.id, folderDB.id);
                        await this.authorization.grantToUser(
                            PermissionOptions.READ_UPDATE_DELETE,
                            EntityTypeOptions.Folder,
                            user.id,
                            folderDB.id
                        );
                        await this.authorization.insertAllMembersPermissionsOfParentInChild(EntityTypeOptions.Folder, folderDB.id);
                    }

                    listFolderKeyId[title] = {
                        folderId: folderDB.id,
                        workflow: workflowDB,
                    };
                    // is a task
                } else {
                    // get parent task
                    let parentTaskDB = null;
                    if (parentTask?.length > 0) {
                        let parentTaskTemp = parentTask;
                        const parentTaskArray = parentTask.split('/');
                        if (parentTaskArray) {
                            parentTaskTemp = trim(parentTaskArray[parentTaskArray.length - 1]);
                        }
                        if (listTaskKeyId[parentTaskTemp]) {
                            parentTaskDB = listTaskKeyId[parentTaskTemp];
                        }
                    }

                    if (assignedTo?.length > 0) {
                        const assignedToList = extractEmails(assignedTo);
                        if (Array.isArray(assignedToList)) {
                            for (const assigneeEmail of assignedToList) {
                                const userDB = await this.userService.getUserByEmail(assigneeEmail);
                                if (userDB) {
                                    assignees.push(userDB.id);
                                }
                            }
                        }
                    }

                    // get folder
                    const folderObj = listFolderKeyId[folder];

                    const mappedState = dto.mappedStates.find((m) => m.SourceWorkflowStateCode === customStatus);

                    let matchedWorkflowState =
                        mappedState &&
                        folderObj?.workflow?.WorkFlowStates?.find(({code}) => code === mappedState.DestinationWorkflowStateCode);
                    if (!matchedWorkflowState) {
                        matchedWorkflowState = folderObj.workflow.WorkFlowStates[0];
                    }
                    // create task
                    const taskDB = await this.taskService.createOneTask(
                        {
                            parentTaskId: parentTaskDB ? parentTaskDB.id : null,
                            description,
                            title,
                            folderId: folderObj.folderId,
                            importanceId: importance?.id,
                            endDate,
                            startDate: startDate || new Date(),
                            assignees,
                            owner: user.id,
                            workflowStateId: matchedWorkflowState.id,
                            effort: effort ? effort.getHours() : null,
                            duration: duration ? duration.getHours() : null,
                            fixedStartDate: !!startDateConstraint,
                            source: dto.source,
                            extra: dto.extra ? dto.extra : null,
                            showOn: dto.showOn,
                        },
                        user
                    );
                    listTaskKeyId[title] = taskDB;
                    // set dependency
                    if (dependsOn) {
                        dependecyList[key] = {dependsOn, folderId: folderObj.folderId};
                    }
                    for (const column of dto.mappedColumns) {
                        if (!defaultSelectedWrikeColumns.includes(column.columnName) && column.selected) {
                            await this.taskService.addCustomFields(taskDB.id, customFields[column.columnName].id, user.id);
                            await this.taskService.setCustomFieldValue(
                                taskDB.id,
                                customFields[column.columnName].id,
                                get_cell_value(sheet, headers, R, column.columnName),
                                user.id
                            );
                        }
                    }
                }
            }
            for (const key of Object.keys(dependecyList)) {
                const dependsOnArray = dependecyList[key].dependsOn.split(', ');
                for (const dependant of dependsOnArray) {
                    if (dependant?.length) {
                        const depKey = Number(dependant.substring(0, dependant.length - 2)),
                            relationType = getRelationType(dependant.slice(-2));
                        const predecessor = listTaskKeyId[depKey],
                            successor = listTaskKeyId[key];
                        if (predecessor && successor) {
                            await this.taskService.createDependency(
                                {
                                    folderId: dependecyList[key].folderId,
                                    predecessorId: predecessor.id,
                                    successorId: successor.id,
                                    relationType,
                                },
                                user.id
                            );
                        }
                    }
                }
            }
            for (const folder of Object.keys(listFolderKeyId)) {
                await this.taskService.updateProjectDate(listFolderKeyId[folder].folderId);
            }
            return true;
        } catch (err) {
            this.logger.error(`There was an error importing tasks to folder ${folder_id}`, err);
            throw err;
        }
    }

    /**
     * Retrieves the last added files from a given folder.
     *
     * @param {number} folderId - The ID of the folder to retrieve files from.
     * @return {Promise<TaskAttachmentEntity[]>} - A Promise that resolves to an array of TaskAttachmentEntity objects representing the last added files.
     * @throws {Error} - If there was an error while fetching the files.
     */
    async getLastAddedFiles(folderId: number): Promise<TaskAttachmentEntity[]> {
        const manager = this.repoFolder.manager;
        try {
            const repoTaskAttachment = manager.getRepository<TaskAttachmentEntity>(TaskAttachmentEntity),
                filesDB = await repoTaskAttachment
                    .createQueryBuilder('attachment')
                    .addSelect('attachment.task_id')
                    .leftJoin('attachment.Task', 'Task')
                    .leftJoin('Task.ChildrenTasks', 'ChildrenTasks')
                    .where('ChildrenTasks.folder_id =:folderId', {folderId})
                    .orderBy('attachment.added_at', 'DESC')
                    .limit(5)
                    .getMany();
            for (const fileDB of filesDB) {
                fileDB['fileNameUrl'] = await this.s3Service.getSignedFileUrl(fileDB.fileName, {expiresIn: 3600});
                fileDB['thumbnailUrl'] = await this.s3Service.getSignedFileUrl(fileDB.thumbnailName, {expiresIn: 3600});
            }
            return filesDB;
        } catch (e) {
            this.logger.error(`There was an error while fetching files form folder ${folderId}`, e);
            throw e;
        }
    }

    /**
     * Downloads multiple files from the database and generates a zip file containing the file data.
     *
     * @param {number[]} ids - An array of file IDs to download.
     * @param {number[]} folderIds - An array of folder IDs to filter the files based on.
     * @returns {Promise<Buffer>} - A Promise resolved with the generated zip file data as a Buffer.
     */
    async downloadMultipleFilesService(ids: number[], folderIds: number[]): Promise<Buffer> {
        try {
            const manager = this.repoFolder.manager;
            const repoTaskAttachment = manager.getRepository<TaskAttachmentEntity>(TaskAttachmentEntity);
            const query = `SELECT TA.id,
                            TA.file_name AS "fileName",
                            TA.original_name AS "originalName"
                            FROM task_attachment TA
                            INNER JOIN task_relation TR ON TR.CHILD_TASK_id = TA.TASK_ID AND TR.FOLDER_ID = ANY($2)
                            WHERE TA.id = ANY($1)`;
            const files = await repoTaskAttachment.query(query, [ids, folderIds]);

            const zip = new JSZip();
            for (const file of files) {
                zip.file(file.fileName, await this.s3Service.getFileBuffer(file.fileName));
            }
            return await zip.generateAsync({type: 'nodebuffer'});
        } catch (e) {
            this.logger.error(`There was an error while fetching files with id ${ids}`, e);
            throw e;
        }
    }

    async validateTeams(spaceId: number, teams: TeamsDto[]): Promise<boolean> {
        if (teams.length) {
            // Retrieve teams associated with the space
            const repoFolderSpaceTeams = this.repoFolder.manager.getRepository<FolderSpaceTeamEntity>(FolderSpaceTeamEntity);
            const spaceTeams = await repoFolderSpaceTeams.find({where: {Folder: {id: spaceId}}});
            const spaceTeamIds = spaceTeams?.map((st) => st.teamId);

            // Check if all provided team IDs are valid for the space
            const allTeamsValid = teams.every((team) => spaceTeamIds?.includes(team.id));

            if (!spaceTeams.length || !allTeamsValid) {
                throw new BadRequestException('Not all teams are not in the space teams list');
            }
            return true;
        }
        return;
    }

    private async validateTagsOnFolders(spaceId: number, tags: number[]): Promise<boolean> {
        if (tags.length) {
            const repoTagTaskFolder = this.repoFolder.manager.getRepository<TagTaskFolderEntity>(TagTaskFolderEntity);
            const spaceTags = await repoTagTaskFolder.find({where: {folderId: spaceId}, select: {tagId: true}});
            if (!spaceTags.length || !tags.every((tag) => spaceTags?.map((st) => st.tagId).includes(tag))) {
                throw new BadRequestException('Not all folder tags are in space tags');
            }
            return true;
        }
        return;
    }

    private async validateWorkflowsOnFolders(spaceId: number, workflowId: number): Promise<boolean> {
        if (workflowId) {
            const repoFolderSpaceWorkflows = this.repoFolder.manager.getRepository<FolderSpaceWorkflowEntity>(FolderSpaceWorkflowEntity);
            const availableWorkflows = await repoFolderSpaceWorkflows.find({
                where: {Folder: {id: spaceId}},
                select: {workflowId: true},
            });

            //** validate that the common workflow should be in the list of space available workflows */
            if (workflowId !== null) {
                const isValidWorkflow = availableWorkflows.map((w) => w.workflowId).includes(workflowId);

                if (!availableWorkflows.length || !isValidWorkflow) {
                    throw new BadRequestException(`workflow with id : ${workflowId} is not in the available workflows list of space`);
                }
            }
            return true;
        }
        return;
    }

    private async validateCustomFields(spaceId: number, customFields: CreateFolderCustomFieldValueDto[]): Promise<boolean> {
        if (customFields.length) {
            const repoCustomFieldValues = this.repoFolder.manager.getRepository<CustomFieldValueEntity>(CustomFieldValueEntity);
            const customFieldValues = await repoCustomFieldValues.find({where: {Folder: {id: spaceId}}});

            if (
                !customFieldValues.length ||
                !customFields.every((c) => customFieldValues?.map((ct) => ct.customFieldDefinitionId).includes(c.id))
            ) {
                throw new BadRequestException('Not all custom fields are not in the space custom fields list');
            }
            return true;
        }
        return;
    }
}
