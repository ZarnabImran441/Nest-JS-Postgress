import {BadRequestException, ForbiddenException, forwardRef, Inject, Injectable, NotFoundException} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {DeleteResult, In, InsertResult, Repository, UpdateResult} from 'typeorm';
import {runOnTransactionCommit, Transactional} from 'typeorm-transactional';
import {ABSTRACT_AUTHORIZATION_SERVICE, contructorLogger, getUserFullName, IdType, JwtUserInterface, S3Service} from '@lib/base-library';
import {TreeViewService} from '../tree-view/tree-view.service';
import {EventEmitter2} from '@nestjs/event-emitter';
import {TaskService} from '../task/task.service';
import {FolderBaseService} from './folder-base.service';
import {NotificationApiConnectorService} from '../notifications-api-connector/notification-api-connector.service';
import {CustomFieldDefinitionService} from '../custom-field-definition/custom-field-definition.service';
import {FolderEntity} from '../../model/folder.entity';
import {AuthorizationImplService} from '../authorization-impl/authorization-impl.service';
import {ChangeOwnerDto, CreateFolderDto, FolderBindDto} from '../../dto/folder/folder/create-folder.dto';
import {FolderActionEntity} from '../../model/folder-action.entity';
import {EntityTypeOptions, PermissionOptions} from '../authorization-impl/authorization.enum';
import {FolderActionOptions} from '../../enum/folder-action.enum';
import {FolderMessageId} from '../../utils/folder-message-id';
import {MembersDto} from '../../dto/folder/folder/members.dto';
import {GenericMemberDto} from '../../dto/folder/folder/generic-member.dto';
import {UserPermissionOptions} from '../../enum/folder-user.enum';
import {
    FolderFavouriteDto,
    UpdateFolderDto,
    UpdateFolderPositionDto,
    UpdateFolderSpaceTeamsDto,
} from '../../dto/folder/folder/update-folder.dto';
import {FolderViewOptions} from '../../enum/folder-position.enum';
import {CopyFolderDto} from '../../dto/folder/folder/copy-folder.dto';
import {GetFolderDto} from '../../dto/folder/folder/get-folder.dto';
import {ChangeWorkflowFolderDto} from '../../dto/folder/folder/change-workflow.dto';
import {WorkFlowEntity} from '../../model/workflow.entity';
import {FolderTypeOptions, FolderViewTypeOptions} from '../../enum/folder.enum';
import {FolderCustomFieldDto} from '../../dto/folder/folder/folder-custom-field.dto';
import {FolderFollowerEntity} from '../../model/folder-follower.entity';
import {GetFollowingFolderDto} from '../../dto/folder/folder/get-following-folder.dto';
import {CreateFolderCustomFieldValueDto} from '../../dto/folder/folder/create-folder-custom-field-value.dto';
import {UpdateFolderTagsTasksDto} from '../../dto/folder-tag-task/update-tags-task-folder.dto';
import {TagEntity} from '../../model/tag.entity';
import {TaskAttachmentEntity} from '../../model/task-attachment.entity';
import {UserEntity} from '../../model/user.entity';
import {FolderTreeDto} from '../../dto/folder/folder/folder-tree.dto';
import {FolderUserViewEntity} from '../../model/folder-user-view.entity';
import {FolderWorkflowService} from './folder-workflow/folder-workflow.service';
import {TaskTreeDto} from '../../dto/folder/folder/task-tree.dto';
import {ImportTasksFromExcelDto} from '../../dto/task/import-tasks-from-excel.dto';
import {UserService} from '../user/user.service';
import {FolderViewDto} from '../../dto/folder/folder/folder-view.dto';
import {FolderEmailActionOptions} from '../notifications-api-connector/enum/folder-email.enum';
import {EntityNotificationDto} from '../../dto/events/entity-notification.dto';
import {FolderEventNameOptions} from '../../enum/notification-event.enum';
import {NotificationService} from '../notification/notification.service';
import {CustomFieldDefinitionEntity} from '../../model/custom-field-definition.entity';
import {WorkFlowService} from '../workflow/workflow.service';
import {ArchiveFolderDto} from '../../dto/folder/folder/archive-folder.dto';
import {ArchivedDeletedFoldersTasksResponseDto} from '../../dto/folder/folder/get-archived-deleted.dto';
import {PaginationDto} from '../../utils/pagination.dto';
import {SpaceService} from '../space/space.service';
import {FolderSpaceTeamEntity} from '../../model/folder-space-team.entity';
import {queries} from '../../recursive-queries';
import {RawDatabaseConfig} from '../../config/database.config';

/**
 * Revokes all permissions from a user for a given folder.
 *
 * @param {number} folderId - The ID of the folder.
 * @param {string} userId - The ID of the user to revoke permissions from.
 * @param {string} accessToken - The access token for authorization.
 * @returns {Promise<void>} - A Promise that resolves when the permissions have been revoked.
 */
@Injectable()
export class FolderService extends FolderBaseService {
    /**
     * Constructor for the given class.
     *
     * @param {TreeViewService} treeViewService - The service for handling tree view functionality.
     * @param {TaskService} taskService - The service for handling tasks.
     * @param {UserService} userService - The service for handling user operations.
     * @param {spaceService} spaceService - The service for handling space operations.
     * @param {NotificationApiConnectorService} notificationsApiConnectorService - The service for connecting to a notifications API.
     * @param {NotificationService} notificationService - The service for handling notifications.
     * @param {CustomFieldDefinitionService} customFieldDefinitionService - The service for handling custom field definitions.
     * @param {AuthorizationImplService} authorization - The service for handling authorization.
     * @param {EventEmitter2} eventEmitter - The event emitter service.
     * @param {S3Service} s3Service - The service for handling S3 operations.
     * @param {FolderWorkflowService} folderWorkflowService - The service for handling folder workflows.
     * @param {WorkFlowService} workflowService - The service for handling workflows.
     * @param {Repository<FolderEntity>} repoFolder - The repository for folder entities.
     *
     * @returns {void}
     */
    constructor(
        protected readonly treeViewService: TreeViewService,
        protected readonly taskService: TaskService,
        protected readonly userService: UserService,
        @Inject(forwardRef(() => SpaceService))
        protected readonly spaceService: SpaceService,
        protected readonly notificationsApiConnectorService: NotificationApiConnectorService,
        protected readonly notificationService: NotificationService,
        protected readonly customFieldDefinitionService: CustomFieldDefinitionService,
        @Inject(ABSTRACT_AUTHORIZATION_SERVICE) protected readonly authorization: AuthorizationImplService,
        @Inject(EventEmitter2) protected readonly eventEmitter: EventEmitter2,
        protected readonly s3Service: S3Service,
        protected readonly folderWorkflowService: FolderWorkflowService,
        protected readonly workflowService: WorkFlowService,
        @InjectRepository(FolderEntity) protected readonly repoFolder: Repository<FolderEntity>
    ) {
        super(
            repoFolder,
            treeViewService,
            customFieldDefinitionService,
            taskService,
            userService,
            spaceService,
            s3Service,
            authorization,
            folderWorkflowService,
            workflowService
        );
        contructorLogger(this);
    }

    /**
     * Creates a folder entity.
     *
     * @param {CreateFolderDto} dto - The folder data transfer object.
     * @param {string} userId - The user id.
     * @param {string} accessToken - The access token.
     * @param {EntityTypeOptions} entityType - The entity type option (optional).
     * @returns {Promise<FolderEntity>} - The created folder entity.
     */
    @Transactional()
    async create(dto: CreateFolderDto, userId: string, accessToken: string, entityType: EntityTypeOptions): Promise<FolderEntity> {
        const folderActionRepository = this.repoFolder.manager.getRepository<FolderActionEntity>(FolderActionEntity);

        //** validate that the workflows are part of the space available workflows list */

        this.logger.verbose(`Create folder ${JSON.stringify(dto)}, user ${userId}, parent folder ${dto.parentFolderId}`);
        const folderDB = await super.createFolder(dto, userId, dto.parentFolderId, entityType);

        //treeView
        this.logger.verbose(`Assign node permissions`);
        const userRepository = this.repoFolder.manager.getRepository<UserEntity>(UserEntity);
        const user = await userRepository.findOneBy({id: userId});

        /* Permissions */
        {
            await this.authorization.grantOwner(entityType, userId, folderDB.id);

            if (dto.viewType == FolderViewTypeOptions.PRIVATE) {
                await this.authorization.grantToUser(PermissionOptions.PRIVATE, entityType, userId, folderDB.id);
            }
            await this.authorization.grantToUser(PermissionOptions.READ_UPDATE_DELETE, entityType, userId, folderDB.id);
            if (dto.members != null) {
                await this.setFolderMembersInternal(folderDB.id, {insert: dto.members}, userId, dto.source, entityType);
            }
            await this.authorization.insertAllMembersPermissionsOfParentInChild(entityType, folderDB.id);
        }

        await folderActionRepository.save({
            date: new Date(),
            action: FolderActionOptions.CREATE,
            user,
            messageId: entityType === EntityTypeOptions.Space ? FolderMessageId.CREATE_SPACE : FolderMessageId.CREATE_FOLDER,
            folder: folderDB,
            Folder: folderDB,
            mentionMembers: null,
            parameters: null,
        });
        this.logger.verbose(`Saved folder action`);
        // send websocket messages
        const recipients = await this.notificationService.getFolderNotificationRecipients(folderDB.id);
        const folderEmailDto = await this.notificationService.setFolderEmailDto(folderDB.id, user, FolderActionOptions.CREATE, []);
        runOnTransactionCommit(() => {
            this.eventEmitter.emit(FolderEventNameOptions.FOLDER_CREATE, {
                recipients: recipients.length > 0 ? recipients : [userId],
                userId,
                data: {
                    event: FolderEventNameOptions.FOLDER_CREATE,
                    spaceId: entityType === EntityTypeOptions.Space ? folderDB.id : null,
                    folderId: entityType === EntityTypeOptions.Folder ? folderDB.id : null,
                    taskId: null,
                    ...folderEmailDto,
                    message: this.notificationService.setNotificationMessage({
                        entity: folderDB?.folderType ?? 'folder',
                        entityTitle: folderDB.title,
                        actions: {
                            created: true,
                        },
                        sender: user.firstName + ' ' + user.lastName,
                    }),
                },
            } as EntityNotificationDto);
            this.eventEmitter.emit(FolderEventNameOptions.FOLDER_STREAM_UPDATE, {
                entityId: folderDB.id,
                date: new Date(),
                action: FolderActionOptions.CREATE,
                recipients: recipients.length > 0 ? recipients : [userId],
                authorization: accessToken,
                user,
            });
        });

        return folderDB;
    }

    /**
     * Removes a folder.
     *
     * @param {number} folderId - The ID of the folder to be removed.
     * @param {string} userId - The ID of the user requesting the removal.
     * @param {string} accessToken - The access token for authorization.
     * @returns {Promise<DeleteResult>} - A Promise of the result of the removal operation.
     */
    @Transactional()
    async remove(folderId: number, userId: string, accessToken: string, showOn: string): Promise<FolderEntity> {
        this.logger.log('Get Folder Notification Recipients');
        const recipients = await this.notificationService.getFolderNotificationRecipients(folderId);
        this.logger.log('Getting Folder');
        const folderDB = await super.getOne(folderId, showOn, userId, true);
        this.logger.log('Getting User');
        const userRepository = this.repoFolder.manager.getRepository<UserEntity>(UserEntity);
        const user = await userRepository.findOneBy({id: userId});
        this.logger.log('Removing all followers for the folder');
        const folderFollowersRepo = this.repoFolder.manager.getRepository<FolderFollowerEntity>(FolderFollowerEntity);
        await folderFollowersRepo.delete({folderId});
        this.logger.log('Setting folder email');
        const folderEmailDto = await this.notificationService.setFolderEmailDto(folderId, user, FolderActionOptions.DELETE, []);
        this.logger.log('Deleting folder permanently');
        const result = await super.permanentDeleteFolder(folderId);

        /* Permissions */
        {
            this.logger.log('Processing entity deletion');
            await this.authorization.processEntityDeletion(EntityTypeOptions.Folder, folderId);
        }
        runOnTransactionCommit(() => {
            this.eventEmitter.emit(FolderEventNameOptions.FOLDER_DELETE, {
                recipients: recipients.length > 0 ? recipients : [userId],
                userId,
                data: {
                    event: FolderEventNameOptions.FOLDER_DELETE,
                    folderId: folderId,
                    ...folderEmailDto,
                    taskId: null,
                    message: this.notificationService.setNotificationMessage({
                        entity: folderDB.folderType != FolderTypeOptions.SPACE ? folderDB.folderType : 'folder',
                        entityTitle: folderDB.title,
                        actions: {
                            deleted: {id: folderDB.id},
                        },
                        sender: user.firstName + ' ' + user.lastName,
                    }),
                },
            } as EntityNotificationDto);
            this.eventEmitter.emit(FolderEventNameOptions.FOLDER_STREAM_UPDATE, {
                entityId: folderId,
                date: new Date(),
                action: FolderEmailActionOptions.DELETE,
                recipients: recipients.length > 0 ? recipients : [userId],
                authorization: accessToken,
                user,
            });
        });
        return result;
    }

    /**
     * Revokes all permissions from a user for a given folder.
     *
     * @param {string} userId - The ID of the user whose permissions need to be revoked.
     * @param {number} folderId - The ID of the folder from which the user's permissions need to be revoked.
     * @param {EntityTypeOptions} entityType - The type of entity for which the permissions need to be revoked.
     * @return {Promise<void>} - A Promise that resolves when the permissions have been revoked successfully.
     */
    private async revokeAllPermissions(userId: string, folderId: number, entityType: EntityTypeOptions): Promise<void> {
        await this.authorization.revokeFromUser(
            PermissionOptions.CREATE_READ_UPDATE_DELETE | PermissionOptions.EDITOR_FULL,
            entityType,
            userId,
            folderId
        );
    }

    /**
     * Sets folder members internally.
     * @param {number} folderId - The ID of the folder.
     * @param {MembersDto} dto - The DTO object containing member information.
     * @param {string} userId - The ID of the user making the change.
     * @param {string} showOn - The showOn value.
     * @param {EntityTypeOptions} entityType - The entity type.
     * @returns {Promise<void>} - A promise that resolves to void.
     */
    @Transactional()
    async setFolderMembersInternal(
        folderId: number,
        dto: MembersDto,
        userId: string,
        showOn: string,
        entityType: EntityTypeOptions
    ): Promise<void> {
        //** 1 - Get space of the folder */
        const spaceId = await this.spaceService.getSpaceFromFolderId(folderId);

        //** This does nothing we should remove this */
        const result = await super.setFolderMembers(folderId, dto, userId);

        /* Permissions */
        {
            if (dto.delete?.length) {
                let folders = [{id: folderId, entityType}];
                if (entityType === EntityTypeOptions.Space) {
                    folders = await this.getSpaceChildrenFoldersIds(folderId, userId);
                }
                for (const folder of folders) {
                    for (const genericMemberDto of dto.delete) {
                        await this.revokeAllPermissions(genericMemberDto.id, folder.id, folder.entityType);
                    }
                }
            }

            if (dto.update?.length) {
                for (const genericMemberDto of dto.update) {
                    await this.revokeAllPermissions(genericMemberDto.id, folderId, entityType);
                    await this.addPermissions(folderId, genericMemberDto, entityType);
                }
            }

            if (dto.insert?.length) {
                if (entityType !== EntityTypeOptions.Space) {
                    await this.verifySpaceMembers(spaceId, dto.insert);
                }

                for (const genericMemberDto of dto.insert) {
                    await this.revokeAllPermissions(genericMemberDto.id, folderId, entityType);
                    await this.addPermissions(folderId, genericMemberDto, entityType);
                }
            }
        }

        const usersIds: string[] = [];
        for (const key in dto) {
            usersIds.push(...dto[key].map((x) => x.id));
        }
        const userRepository = this.repoFolder.manager.getRepository<UserEntity>(UserEntity);
        const usersData = await userRepository.find({
            select: {firstName: true, lastName: true, id: true, pictureUrl: true},
            where: {id: In(usersIds)},
        });
        const folderActionRepository = this.repoFolder.manager.getRepository<FolderActionEntity>(FolderActionEntity);
        const user = await userRepository.findOneBy({id: userId});
        const folder = await super.getOne(folderId, showOn, userId);
        const recipients = await this.notificationService.getFolderNotificationRecipients(folderId);
        if (dto.insert?.length > 0) {
            await folderActionRepository.save({
                date: new Date(),
                user,
                folder: folder,
                Folder: folder,
                action: FolderActionOptions.ADD_MEMBER,
                messageId: FolderMessageId.ADD_MEMBER,
                mentionMembers: null,
                parameters: {
                    members: {
                        added: dto.insert.map((insertUser) => {
                            const user = usersData.find((x) => x.id === insertUser.id);
                            if (user)
                                return {
                                    id: user.id,
                                    firstName: user.firstName,
                                    lastName: user.lastName,
                                    pictureUrl: user.pictureUrl,
                                    userPermission: insertUser.userPermission,
                                };
                        }),
                    },
                },
            });
            const emailDto = await this.notificationService.setFolderEmailDto(folderId, user, FolderActionOptions.ADD_MEMBER, [], {
                added: dto.insert.map((insertUser) => {
                    const user = usersData.find((x) => x.id === insertUser.id);
                    return user.firstName + ' ' + user.lastName;
                }),
            });
            runOnTransactionCommit(() => {
                this.eventEmitter.emit(FolderEventNameOptions.FOLDER_ADD_MEMBER, {
                    recipients,
                    userId,

                    data: {
                        ...emailDto,
                        event: FolderEventNameOptions.FOLDER_ADD_MEMBER,
                        folderId,
                        taskId: null,
                        spaceId,
                        message: this.notificationService.setNotificationMessage({
                            entity: folder?.folderType ?? 'folder',
                            entityTitle: folder.title,
                            sender: user.firstName + ' ' + user.lastName,
                            actions: {
                                members: {
                                    added: dto.insert.map((insertUser) => {
                                        const user = usersData.find((x) => x.id === insertUser.id);
                                        return user.firstName + ' ' + user.lastName;
                                    }),
                                },
                            },
                        }),
                    },
                    streamUpdate: true,
                } as EntityNotificationDto);
            });
        }
        if (dto.update?.length > 0) {
            await folderActionRepository.save({
                date: new Date(),
                user,
                folder: folder,
                Folder: folder,
                action: FolderActionOptions.UPDATE_MEMBER,
                messageId: FolderMessageId.UPDATE_MEMBER,
                mentionMembers: null,
                parameters: {
                    members: {
                        updated: dto.update.map((updateUser) => {
                            const user = usersData.find((x) => x.id === updateUser.id);
                            if (user)
                                return {
                                    id: user.id,
                                    firstName: user.firstName,
                                    lastName: user.lastName,
                                    pictureUrl: user.pictureUrl,
                                    userPermission: updateUser.userPermission,
                                };
                        }),
                    },
                },
            });
            const folderEmailDto = await this.notificationService.setFolderEmailDto(folderId, user, FolderActionOptions.UPDATE_MEMBER, []);
            runOnTransactionCommit(() => {
                this.eventEmitter.emit(FolderEventNameOptions.FOLDER_UPDATE_MEMBER, {
                    recipients,
                    userId,
                    data: {
                        event: FolderEventNameOptions.FOLDER_UPDATE_MEMBER,
                        folderId,
                        taskId: null,
                        spaceId,
                        ...folderEmailDto,
                        message: this.notificationService.setNotificationMessage({
                            entity: folder?.folderType ?? 'folder',
                            entityTitle: folder.title,
                            sender: user.firstName + ' ' + user.lastName,
                            actions: {
                                members: {
                                    updated: dto.update.map((updatedUser) => {
                                        const user = usersData.find((x) => x.id === updatedUser.id);

                                        return user.firstName + ' ' + user.lastName;
                                    }),
                                },
                            },
                        }),
                    },
                } as EntityNotificationDto);
            });
        }
        if (dto.delete?.length > 0) {
            await folderActionRepository.save({
                date: new Date(),
                user,
                folder: folder,
                Folder: folder,
                action: FolderActionOptions.REMOVE_MEMBER,
                messageId: FolderMessageId.REMOVE_MEMBER,
                mentionMembers: null,
                parameters: {
                    members: {
                        removed: dto.delete.map((updateUser) => {
                            const user = usersData.find((x) => x.id === updateUser.id);
                            if (user)
                                return {
                                    id: user.id,
                                    firstName: user.firstName,
                                    lastName: user.lastName,
                                    pictureUrl: user.pictureUrl,
                                };
                        }),
                    },
                },
            });
            const emailDto = await this.notificationService.setFolderEmailDto(folderId, user, FolderActionOptions.REMOVE_MEMBER, [], {
                removed: dto.delete.map((deleted) => {
                    const user = usersData.find((x) => x.id === deleted.id);

                    return user.firstName + ' ' + user.lastName;
                }),
            });
            runOnTransactionCommit(() => {
                this.eventEmitter.emit(FolderEventNameOptions.FOLDER_REMOVE_MEMBER, {
                    recipients,
                    userId,

                    data: {
                        event: FolderEventNameOptions.FOLDER_REMOVE_MEMBER,
                        folderId,
                        taskId: null,
                        spaceId,
                        ...emailDto,
                        message: this.notificationService.setNotificationMessage({
                            entity: folder?.folderType ?? 'folder',
                            entityTitle: folder.title,
                            sender: user.firstName + ' ' + user.lastName,
                            actions: {
                                members: {
                                    removed: dto.delete.map((deleted) => {
                                        const user = usersData.find((x) => x.id === deleted.id);

                                        return user.firstName + ' ' + user.lastName;
                                    }),
                                },
                            },
                        }),
                    },
                } as EntityNotificationDto);
            });
        }

        return result;
    }

    /**
     * Adds permissions to a folder for a generic member.
     *
     * @param {number} folderId - The ID of the folder to add permissions to.
     * @param {GenericMemberDto} genericMemberDto - The generic member for whom permissions are being added.
     * @param {EntityTypeOptions} entityType - The type of the entity for which permissions are being added.
     * @returns {Promise<void>} - A promise that resolves when the permissions have been added.
     */
    private async addPermissions(folderId: number, genericMemberDto: GenericMemberDto, entityType: EntityTypeOptions): Promise<void> {
        if (genericMemberDto.userPermission == UserPermissionOptions.FULL) {
            await this.authorization.grantToUser(
                PermissionOptions.READ_UPDATE_DELETE | PermissionOptions.FULL,
                entityType,
                genericMemberDto.id,
                folderId
            );
        } else if (genericMemberDto.userPermission == UserPermissionOptions.EDITOR) {
            await this.authorization.grantToUser(
                PermissionOptions.READ_UPDATE | PermissionOptions.EDITOR,
                entityType,
                genericMemberDto.id,
                folderId
            );
        } else if (genericMemberDto.userPermission == UserPermissionOptions.READONLY) {
            await this.authorization.grantToUser(PermissionOptions.READ, entityType, genericMemberDto.id, folderId);
        }
    }

    /**
     * Updates the position of a folder.
     *
     * @param {number} folderId - The ID of the folder.
     * @param {UpdateFolderPositionDto} dto - The data transfer object containing the updated position information.
     * @param {JwtUserInterface} user - The user performing the update.
     * @param {boolean} [isInheritPermission] - Optional. Whether to inherit permissions for the updated folder. Default is false.
     *
     * @return {Promise<void>} - A promise that resolves once the folder position is updated.
     *
     * @throws {Error} - If there is an error updating the folder position.
     */
    @Transactional()
    async updateFolderOnePosition(
        folderId: number,
        dto: UpdateFolderPositionDto,
        user: JwtUserInterface,
        entityType: EntityTypeOptions,
        isInheritPermission?: boolean
    ): Promise<void> {
        // Update folder relation
        await super.updateFolderPosition(folderId, dto, user);
        /* Permissions */
        {
            if (isInheritPermission) await this.authorization.updateEntityPosition(entityType, folderId);
        }
    }

    /**
     * Retrieves a folder tree based on the provided parameters.
     *
     * @param {number} rootFolderId - The ID of the root folder.
     * @param {FolderViewOptions} view - The options for how the folder tree should be displayed.
     * @param {JwtUserInterface} user - The user requesting the folder tree.
     * @param {number} [depth=null] - The maximum depth of the folder tree to retrieve.
     * @param {number} [parentFolderId=null] - The ID of the parent folder.
     * @param {number} [treeViewId=null] - The ID of the tree view.
     * @param {string} showOn - The view on which the folder tree should be shown.
     * @param {boolean} showArchived - Indicates whether to display archived folders.
     * @param {boolean} showDeleted - Indicates whether to display deleted folders.
     * @param {number[]} spaceIds - An array of space IDs to filter the folder tree by.
     * @returns {Promise<FolderTreeDto[]>} - A promise that resolves to an array of FolderTreeDto objects representing the folder tree.
     */
    async getFolderTree(
        rootFolderId: number,
        view: FolderViewOptions,
        user: JwtUserInterface,
        depth: number = null,
        parentFolderId: number = null,
        treeViewId: number = null,
        showOn: string,
        showArchived: boolean,
        showDeleted: boolean,
        spaceIds: number[]
    ): Promise<FolderTreeDto[]> {
        let hasPurgePermissions = false;
        const spaceId = spaceIds[0];
        // Check If User has Purge Folders Permissions
        if (showDeleted) {
            hasPurgePermissions = await this.authorization.getUserHasPermissions(
                user.id,
                PermissionOptions.UPDATE,
                EntityTypeOptions.PurgeFoldersAndTasks,
                null
            );
        }

        // Permissions
        const allowedFolderIds = await this.authorization.getRecursiveIdsForUser(
            user.id,
            EntityTypeOptions.Folder,
            PermissionOptions.READ,
            rootFolderId
        );
        const folderIds = allowedFolderIds.map((x) => x.id);

        const allowedSpaceIds = await this.authorization.getRecursiveIdsForUser(user.id, EntityTypeOptions.Space, PermissionOptions.READ);
        if (spaceIds.length === 0) {
            spaceIds = allowedSpaceIds.map((s) => s.id);
        } else {
            spaceIds = allowedSpaceIds.map((s) => s.id).filter((x) => spaceIds.includes(x));
        }
        if (spaceIds.length === 0) {
            this.logger.error(`No space ids found for user ${user.id}`);
            throw new BadRequestException(`No space ids found for user ${user.id}`);
        }

        const allowedIds = folderIds.concat(spaceIds);

        // Get a folder tree
        const folderTreeBase = await super.getFolderTreeBase(
            allowedIds,
            view,
            user.id,
            depth,
            parentFolderId,
            treeViewId,
            showOn,
            showArchived,
            showDeleted,
            hasPurgePermissions,
            spaceIds
        );

        if (spaceId) {
            const folderActionRepository = this.repoFolder.manager.getRepository<FolderActionEntity>(FolderActionEntity);
            await folderActionRepository.save({
                date: new Date(),
                user,
                folder: null,
                folderId: spaceId,
                action: FolderActionOptions.VISIT,
                messageId: FolderMessageId.VISIT_SPACE,
                mentionMembers: null,
                parameters: {},
            });
        }

        return folderTreeBase;
    }

    /**
     * Retrieves the task tree for a given folder ID.
     *
     * @param {number} folderId - The ID of the folder.
     * @param {JwtUserInterface} user - The user object containing information about the currently authenticated user.
     * @param {string} showOn - The string indicating when to show the task. Possible values are 'now', 'upcoming' and 'overdue'.
     * @returns {Promise<TaskTreeDto[]>} - The task tree as an array of TaskTreeDto objects.
     */
    async getTaskTreeByFolderId(folderId: number, user: JwtUserInterface, showOn: string): Promise<TaskTreeDto[]> {
        const taskTree = await super.getTaskTree(folderId, showOn);

        /* Permissions */
        // {
        //     // Go through the tree and remove the nodes this user has not READ permissions on.
        //     // each node in result has a children property to access the child folders
        //     taskTree = await this.filterTreeNodesWithPermission2(taskTree, user.id, EntityTypeOptions.Task, PermissionOptions.READ);
        // }

        return taskTree;
    }

    /**
     * Copy a folder to a new parent folder.
     *
     * @param {number} folderId - The ID of the folder to be copied.
     * @param {number} parentFolderId - The ID of the new parent folder.
     * @param {CopyFolderDto} dto - The data transfer object containing data for the copy operation.
     * @param {JwtUserInterface} user - The user performing the operation.
     * @param {string} authorization - The authorization token.
     * @param {string} showOn - The show on parameter.
     * @param {EntityTypeOptions} entityType - The entity type of the folder.
     * @returns {Promise<FolderEntity>} - The copied folder entity.
     * @throws If an error occurs while duplicating the folder.
     */
    @Transactional()
    async copyOneFolder(
        folderId: number,
        parentFolderId: number,
        dto: CopyFolderDto,
        user: JwtUserInterface,
        authorization: string,
        showOn: string,
        entityType: EntityTypeOptions
    ): Promise<FolderEntity> {
        try {
            const copyFolderResult = await super.copyFolder(folderId, parentFolderId, dto, user, authorization, showOn, entityType);

            /* Permissions */
            {
                await this.authorization.copyUnifiedPermissionsFromEntity(entityType, folderId, copyFolderResult.id, false);
                await this.authorization.grantOwner(entityType, user.id, copyFolderResult.id);
                await this.authorization.grantToUser(PermissionOptions.READ_UPDATE_DELETE, entityType, user.id, copyFolderResult.id);
            }

            const folder = await super.getOne(folderId, showOn, user.id);
            const spaceId = await this.spaceService.getSpaceFromFolderId(folderId);
            const folderActionRepository = this.repoFolder.manager.getRepository<FolderActionEntity>(FolderActionEntity);
            const userRepository = this.repoFolder.manager.getRepository<UserEntity>(UserEntity);
            const userEntity = await userRepository.findOneBy({id: user.id});
            await folderActionRepository.save({
                date: new Date(),
                user: userEntity,
                folder: folder,
                Folder: folder,
                action: FolderActionOptions.COPY_FOLDER,
                messageId: FolderMessageId.COPY_FOLDER,
                mentionMembers: null,
                parameters: null,
            });

            //** new folder created */
            await folderActionRepository.save({
                date: new Date(),
                user: userEntity,
                folder: copyFolderResult,
                Folder: copyFolderResult,
                action: FolderActionOptions.CREATE,
                messageId: FolderMessageId.CREATE_FOLDER,
                mentionMembers: null,
                parameters: null,
            });

            const recipients = await this.notificationService.getFolderNotificationRecipients(folderId);
            const folderEmaiLDto = await this.notificationService.setFolderEmailDto(
                folderId,
                userEntity,
                FolderActionOptions.COPY_FOLDER,
                []
            );
            runOnTransactionCommit(() => {
                this.eventEmitter.emit(FolderEventNameOptions.FOLDER_COPY, {
                    recipients: recipients.length > 0 ? recipients : [userEntity.id],
                    userId: userEntity.id,
                    data: {
                        folderId,
                        ...folderEmaiLDto,
                        event: FolderEventNameOptions.FOLDER_COPY,
                        taskId: null,
                        spaceId,
                        message: this.notificationService.setNotificationMessage({
                            entity: folder.folderType != FolderTypeOptions.SPACE ? folder.folderType : 'folder',
                            entityTitle: folder.title,
                            actions: {
                                copied: true,
                            },
                            sender: userEntity.firstName + ' ' + userEntity.lastName,
                        }),
                    },
                } as EntityNotificationDto);
                this.eventEmitter.emit(FolderEventNameOptions.FOLDER_STREAM_UPDATE, {
                    entityId: folderId,
                    date: new Date(),
                    action: FolderActionOptions.COPY_FOLDER,
                    recipients: recipients.length > 0 ? recipients : [userEntity.id],
                    authorization,
                    user: userEntity,
                });
            });
            return copyFolderResult;
        } catch (error) {
            this.logger.error(`There was an error while duplicating the folder`, error);
            throw error;
        }
    }

    /**
     * Retrieves all archived folders for a given user.
     *
     * @param {string} userId - The ID of the user.
     * @param {boolean} archived - Specifies whether to include archived folders or not.
     * @param {string} showOn - Specifies the platform on which the folders are displayed.
     * @return {Promise<GetFolderDto[]>} - A promise that resolves to an array of GetFolderDto objects representing the archived folders.
     */
    async getAllArchivedFolders(userId: string, archived: boolean, showOn: string): Promise<GetFolderDto[]> {
        let result = await super.getFolders(archived, showOn, userId);

        /* Permissions */
        {
            // Filter out the archived folders the user cannot READ
            result = await this.authorization.filterArrayNodeWithPermission(
                result as IdType[],
                userId,
                EntityTypeOptions.Folder,
                PermissionOptions.OWNER_READ_DELETE
            );
        }

        return result;
    }

    /**
     * Retrieves all archived and deleted folders tasks based on the given parameters.
     *
     * @param {PaginationDto} dto - The pagination parameters to apply.
     * @param {string} showOn - The show on parameter to filter the tasks.
     * @param {string} search - The search parameter to filter the tasks.
     * @param {boolean} deleted - Indicates whether to include deleted tasks in the result.
     * @param {string} userId - The ID of the user.
     * @param {number[]} spaceIds - The IDs of the spaces.
     * @return {Promise<ArchivedDeletedFoldersTasksResponseDto>} - A promise that resolves to an object containing the archived and deleted folders tasks.
     */
    async getAllArchivedDeletedFoldersTasks(
        dto: PaginationDto,
        showOn: string,
        search: string,
        deleted: boolean,
        userId: string,
        spaceIds: number[] = []
    ): Promise<ArchivedDeletedFoldersTasksResponseDto> {
        return await super.getArchivedDeletedFoldersTasks(dto, showOn, search, deleted, userId, spaceIds);
    }

    /**
     * Finds all folders based on the specified parameters.
     *
     * @param {string} userId - The ID of the user.
     * @param {string} showOn - The location where folders are shown.
     * @returns {Promise<GetFolderDto[]>} - The array of folders that match the criteria.
     */
    async findAll(userId: string, showOn: string): Promise<GetFolderDto[]> {
        let folderArray = await super.getManyFolders(showOn, userId);

        /* Permissions */
        {
            // Filter out folders the user cannot READ
            folderArray = await this.authorization.filterArrayNodeWithPermission(
                folderArray as IdType[],
                userId,
                EntityTypeOptions.Folder,
                PermissionOptions.READ
            );
        }

        return folderArray;
    }

    /**
     * Finds a folder with the given id, showOn, userId, and showArchived parameters.
     *
     * @param {number} folderId - The id of the folder to find.
     * @param {string} showOn - The showOn parameter to match with.
     * @param {string} userId - The userId parameter to match with.
     * @param {boolean} showArchived - The showArchived parameter to match with.
     * @return {Promise<GetFolderDto>} - The found folder as a GetFolderDto object.
     * @throws {NotFoundException} - If the folder with the given id is not found.
     */
    async findOne(folderId: number, showOn: string, userId: string, showArchived: boolean): Promise<GetFolderDto> {
        return await super.getOne(folderId, showOn, userId, showArchived);
    }

    //** Note : If someone wants to update a user permissions in the teams we will use folderMembers endpoint for this purpose*/
    /**
     * Updates the teams associated with a team space.
     *
     * @param {number} folderId - The ID of the team space.
     * @param {UpdateSpaceTeamsDto} dto - The DTO containing the teams to be updated.
     * @returns {Promise<void>} - A `Promise` that represents the completion of the update.
     *
     * @throws {Error} - If an error occurs while updating the teams.
     */
    @Transactional()
    async updateOneFolderTeams(
        folderId: number,
        dto: UpdateFolderSpaceTeamsDto,
        entityType: EntityTypeOptions,
        userId: string,
        teamMembers: MembersDto
    ): Promise<void> {
        try {
            const repoFolderSpaceTeams = this.repoFolder.manager.getRepository<FolderSpaceTeamEntity>(FolderSpaceTeamEntity);

            const spaceId = await this.spaceService.getSpaceFromFolderId(folderId);

            if (dto?.insert?.length) {
                //** Todo : grant permissions to the teams on folder level*/
                if (spaceId && entityType != EntityTypeOptions.Space) {
                    await this.validateTeams(spaceId, dto.insert);
                }
                //** Send users list in the members property to assign permissions accordingly */
                for (const team of dto.insert) {
                    await repoFolderSpaceTeams.insert({
                        Folder: {id: folderId},
                        Team: {id: team.id},
                        teamPermissions: team.teamPermission,
                    });
                }
            }

            if (dto?.delete?.length) {
                let folders = [{id: folderId, entityType}];
                // const folderIdsToRemoveTeamsFrom = [folderId];
                if (entityType === EntityTypeOptions.Space) {
                    folders = await this.getSpaceChildrenFoldersIds(folderId, userId);
                }

                for (const folder of folders) {
                    //** remove team from the space and with its folders */
                    for (const team of dto.delete) {
                        await repoFolderSpaceTeams.delete({
                            Folder: {id: folder.id},
                            Team: {id: team.id},
                        });
                    }
                }

                //** revoke permissions from the users/members of the team */
                for (const folder of folders) {
                    for (const genericMemberDto of teamMembers.delete) {
                        await this.revokeAllPermissions(genericMemberDto.id, folder.id, folder.entityType);
                    }
                }
            }

            if (dto?.update?.length) {
                //** Todo : update permissions of the teams on folder level*/
                for (const team of dto.update) {
                    await repoFolderSpaceTeams.update(
                        {
                            Folder: {id: folderId},
                            Team: {id: team.id},
                        },
                        {teamPermissions: team.teamPermission}
                    );
                }
            }
            return;
        } catch (error) {
            this.logger.error(`An error occurred while updating teams for a space : ${dto}, id: ${folderId}`, error);
            throw error;
        }
    }

    /**
     * Updates a folder with the given data.
     *
     * @param {number} id - The ID of the folder to update.
     * @param {UpdateFolderDto} updateFolderDto - The data to update the folder with.
     * @param {string} userId - The ID of the user performing the update.
     * @param {string} authorization - The authorization token.
     * @param {string} showOn - The showOn parameter.
     * @param {EntityTypeOptions} [entityType] - The entityType parameter (optional).
     * @returns {Promise<UpdateResult>} A promise that resolves to the result of the update.
     */
    @Transactional()
    async update(
        id: number,
        updateFolderDto: UpdateFolderDto,
        userId: string,
        authorization: string,
        showOn: string,
        entityType: EntityTypeOptions
    ): Promise<UpdateResult> {
        const folder = await super.getOne(id, showOn, userId);
        if (!folder) {
            throw new NotFoundException(`Folder with id ${id} not found`);
        }
        const userRepository = this.repoFolder.manager.getRepository<UserEntity>(UserEntity);
        const user = await userRepository.findOneBy({id: userId});

        if (updateFolderDto?.teams) {
            await this.updateOneFolderTeams(id, updateFolderDto.teams, entityType, user.id, updateFolderDto.members);
            delete updateFolderDto['teams'];
        }

        //** Members */
        if (updateFolderDto?.members) {
            await this.setFolderMembersInternal(id, updateFolderDto.members, userId, showOn, entityType);
            delete updateFolderDto['members'];
        }

        //** Tags */
        if (updateFolderDto?.tags) {
            await this.updateOneFolderTags(id, updateFolderDto.tags, entityType);
            delete updateFolderDto['tags'];
        }

        //** Custom field values */
        if (updateFolderDto?.customFieldValues) {
            await this.addFolderCustomFieldValue(id, updateFolderDto.customFieldValues, userId, entityType);
            delete updateFolderDto['customFieldValues'];
        }

        const resultUpdate = await this.updateFolder(id, updateFolderDto, user, entityType);
        const folderActionRepository = this.repoFolder.manager.getRepository<FolderActionEntity>(FolderActionEntity);
        const updates: {property: string; oldValue: string; newValue: string}[] = [];
        const isPrivate = await this.authorization.getEntityIsPrivate(entityType, id);

        const ownerId = await this.authorization.getEntityOwnerUserId(entityType, id);

        for (const key in updateFolderDto) {
            const oldValue = folder[key];
            const newValue = updateFolderDto[key];
            if (oldValue !== newValue) {
                updates.push({property: key, oldValue, newValue});
            }
        }
        await folderActionRepository.save({
            action: FolderActionOptions.UPDATE,
            date: new Date(),
            user,
            messageId: entityType === EntityTypeOptions.Space ? FolderMessageId.UPDATE_SPACE : FolderMessageId.UPDATE_FOLDER,
            folder: folder,
            Folder: folder,
            mentionMembers: null,
            parameters: {
                updates,
            },
        });

        /* Permissions */
        {
            const reset = async (): Promise<void> => {
                const manager = this.repoFolder.manager;
                const repoFolderUserView = manager.getRepository<FolderUserViewEntity>(FolderUserViewEntity);
                const members = new MembersDto();
                const actualMembers = await repoFolderUserView.find({
                    where: {
                        folderId: id,
                    },
                });

                members.insert = [];
                members.update = [];
                members.delete = [];
                for (const obj of actualMembers) {
                    members.delete.push({id: obj.userId.toString(), userPermission: UserPermissionOptions.FULL});
                }

                //** add space id here */
                await this.setFolderMembersInternal(id, members, userId, showOn, entityType);
            };
            if (updateFolderDto.viewType && folder.viewType !== updateFolderDto.viewType) {
                if (!isPrivate && updateFolderDto.viewType == FolderViewTypeOptions.PRIVATE) {
                    // public to private
                    await reset();
                    await this.authorization.resetPermissions(EntityTypeOptions.Folder, id, null, false);
                    await this.authorization.deleteAllInheritedPermissionsForThisAndChildren(EntityTypeOptions.Folder, id);
                    await this.authorization.grantToUser(PermissionOptions.PRIVATE, EntityTypeOptions.Folder, ownerId, id);
                } else if (isPrivate && updateFolderDto.viewType != FolderViewTypeOptions.PRIVATE) {
                    // private to public
                    await this.authorization.revokeFromUser(PermissionOptions.PRIVATE, entityType, ownerId, id);
                    await reset();
                    await this.authorization.resetPermissions(entityType, id, null, false);
                    await this.authorization.insertAllMembersPermissionsOfParentInChild(entityType, id);
                }
            }
            await this.authorization.grantOwner(entityType, ownerId, id);
            await this.authorization.grantToUser(PermissionOptions.CREATE_READ_UPDATE_DELETE, entityType, ownerId, id);
            await this.authorization.grantToUser(PermissionOptions.EDITOR_FULL, entityType, ownerId, id);
        }

        const recipients = await this.notificationService.getFolderNotificationRecipients(folder.id);
        const emailDto = await this.notificationService.setFolderEmailDto(
            folder.id,
            user,
            FolderActionOptions.UPDATE,
            updates.filter((update) => {
                return update.property == 'title' || update.property == 'description';
            })
        );
        const spaceId = await this.spaceService.getSpaceFromFolderId(folder.id);

        runOnTransactionCommit(() => {
            this.eventEmitter.emit(FolderEventNameOptions.FOLDER_STREAM_UPDATE, {
                entityId: folder.id,
                date: new Date(),
                action: FolderEmailActionOptions.UPDATE,
                recipients: recipients.length > 0 ? recipients : [user.id],
                authorization,
                user,
            });

            for (const update of updates) {
                if (['title', 'description'].includes(update.property)) {
                    this.eventEmitter.emit(FolderEventNameOptions.FOLDER_UPDATE, {
                        recipients: recipients.length > 0 ? recipients : [user.id],
                        userId: user.id,

                        data: {
                            folderId: folder.id,
                            spaceId,
                            event: FolderEventNameOptions.FOLDER_UPDATE,
                            ...emailDto,
                            message: this.notificationService.setNotificationMessage({
                                entity: folder?.folderType ?? 'folder',
                                entityTitle: folder.title,
                                actions: {
                                    updated: {
                                        property: update.property,
                                        oldValue: update.oldValue,
                                        newValue: update.newValue,
                                    },
                                },
                                sender: user.firstName + ' ' + user.lastName,
                            }),
                        },
                    } as EntityNotificationDto);
                }
            }
        });

        return resultUpdate;
    }

    /**
     * Retrieves the custom field definitions for a given folder and user.
     * @param {number} folderId - The ID of the folder to retrieve custom fields for.
     * @param {string} userId - The ID of the user making the request.
     * @param {string} _showOn - The parameter for filtering custom fields (not used in this method).
     * @returns {Promise<CustomFieldDefinitionEntity[]>} - A promise that resolves to an array of custom field definitions.
     */
    async getCustomFields(folderId: number, userId: string, _showOn: string): Promise<CustomFieldDefinitionEntity[]> {
        const allowedIds = await this.authorization.getRecursiveIdsForUser(
            userId,
            EntityTypeOptions.Folder,
            PermissionOptions.READ,
            folderId
        );
        const folderIds = allowedIds.map((x) => x.id);
        return await super.getFolderCustomFields(folderIds, userId);
    }

    // /**
    //  * Retrieves the information of a specific folder.
    //  *
    //  * @param {number} folderId - The ID of the folder to retrieve.
    //  * @param {string} showOn - The display mode of the folder.
    //  * @param {string} userId - The ID of the user making the request.
    //  * @returns {Promise<GetFolderDto>} A promise that resolves to the folder information as a GetFolderDto object.
    //  */
    // async getOneFolder(folderId: number, showOn: string, userId: string): Promise<GetFolderDto> {
    //     return await super.getOne(folderId, showOn, userId);
    // }

    /**
     * Archives a folder.
     *
     * @param {number} folderId - The ID of the folder to be archived.
     * @param {string} userId - The ID of the user performing the action.
     * @param {string} authorization - The authorization token.
     * @param folderTypes
     * @param {ArchiveFolderDto} [dto] - Optional data for archiving the folder.
     * @returns {Promise<void>} - A Promise that resolves when the folder is successfully archived.
     *
     * @throws {NotFoundException} - If the folder does not exist.
     */
    @Transactional()
    async archiveFolder(
        folderId: number,
        userId: string,
        authorization: string,
        folderTypes: FolderTypeOptions[],
        dto?: ArchiveFolderDto
    ): Promise<void> {
        this.logger.log('Archiving a folder');
        const spaceId = await this.spaceService.getSpaceFromFolderId(folderId);
        const archiveResult = await super.archive(folderId, userId, folderTypes, dto);

        this.logger.log('Getting one archive');
        const folder = await super.getOneArchive(folderId, userId);

        if (!folder) {
            throw new NotFoundException();
        }
        const folderActionRepository = this.repoFolder.manager.getRepository<FolderActionEntity>(FolderActionEntity);
        const userRepository = this.repoFolder.manager.getRepository<UserEntity>(UserEntity);
        const user = await userRepository.findOneBy({id: userId});
        await folderActionRepository.save({
            date: new Date(),
            user,
            folder: folder,
            Folder: folder,
            action: FolderActionOptions.ARCHIVE,
            messageId: FolderMessageId.ARCHIVE_FOLDER,
            mentionMembers: null,
            parameters: null,
        });
        this.logger.log('Getting folder notifications recipients');
        const recipients = await this.notificationService.getFolderNotificationRecipients(folder.id);
        this.logger.log('Setting folder DTO');
        const emailDto = await this.notificationService.setFolderEmailDto(folder.id, user, FolderActionOptions.ARCHIVE, []);
        runOnTransactionCommit(() => {
            this.eventEmitter.emit(FolderEventNameOptions.FOLDER_STREAM_UPDATE, {
                entityId: folder.id,
                date: new Date(),
                action: FolderActionOptions.ARCHIVE,
                recipients: recipients.length > 0 ? recipients : [user.id],
                authorization,
                user,
            });

            this.eventEmitter.emit(FolderEventNameOptions.FOLDER_ARCHIVE, {
                recipients: [recipients[0]], //notify only owner
                userId: user.id,
                data: {
                    ...emailDto,
                    folderId: folder.id,
                    event: FolderEventNameOptions.FOLDER_ARCHIVE,
                    taskId: null,
                    spaceId: spaceId ?? null,
                    message: this.notificationService.setNotificationMessage({
                        entity: folder.folderType != FolderTypeOptions.SPACE ? folder.folderType : 'folder',
                        entityTitle: folder.title,
                        sender: user.firstName + ' ' + user.lastName,
                        actions: {archived: true},
                    }),
                },
            } as EntityNotificationDto);
        });
        return archiveResult;
    }

    /**
     * Deletes a folder.
     *
     * @param {number} folderId - The ID of the folder to be deleted.
     * @param {string} userId - The ID of the user who is deleting the folder.
     * @param folderTypes
     * @returns {Promise<void>} - A promise that resolves once the folder is deleted.
     *
     * @throws {Error} - If there is an error during the deletion process.
     */
    @Transactional()
    async deleteFolder(folderId: number, userId: string, folderTypes: FolderTypeOptions[]): Promise<void> {
        const deleteResult = await super.delete(folderId, userId, folderTypes);
        const folder = await super.getOneDelete(folderId, userId);
        const folderActionRepository = this.repoFolder.manager.getRepository<FolderActionEntity>(FolderActionEntity);
        const userRepository = this.repoFolder.manager.getRepository<UserEntity>(UserEntity);
        const user = await userRepository.findOneBy({id: userId});
        const isSpace = folderTypes.find((type) => type === FolderTypeOptions.SPACE);
        await folderActionRepository.save({
            date: new Date(),
            user,
            folder: folder,
            Folder: folder,
            action: FolderActionOptions.DELETE,
            messageId: isSpace ? FolderMessageId.DELETE_SPACE : FolderMessageId.DELETE_FOLDER,
            mentionMembers: null,
            parameters: null,
        });
        return deleteResult;
    }

    /**
     * Change the workflow for a folder.
     *
     * @param {number} folderId - The ID of the folder.
     * @param {ChangeWorkflowFolderDto} dto - The data transfer object containing the new workflow details.
     * @param {string} userId - The ID of the user making the change.
     * @param entityType
     * @return {Promise<Partial<WorkFlowEntity>>} A promise that resolves with the updated workflow entity.
     *
     * @throws {Error} If the folderId, dto, or userId is missing or invalid.
     * @throws {Error} If an error occurs during the workflow change.
     *
     * @example
     * // Usage example
     * const folderId = 123;
     * const dto = {
     *   workflowName: 'New Workflow',
     *   workflowStatus: 'Active'
     * };
     * const userId = 'abc123';
     *
     * try {
     *   const result = await changeWorkflowForFolder(folderId, dto, userId);
     *   console.log(result); // The updated workflow entity
     * } catch (error) {
     *   console.error(error);
     * }
     */
    @Transactional()
    async changeWorkflowForFolder(
        folderId: number,
        dto: ChangeWorkflowFolderDto,
        userId: string,
        entityType: EntityTypeOptions
    ): Promise<Partial<WorkFlowEntity>> {
        return await super.changeWorkflow(folderId, dto, userId, entityType);
    }

    /**
     * Restores an archived folder.
     *
     * @param {number} folderId - The ID of the folder to restore.
     * @param folderTypes
     * @return {Promise<void>} - A promise that resolves when the folder has been restored.
     *
     * @throws {Error} - If the folder restoration fails.
     *
     * @example
     * // Usage example
     * try {
     *   await restoreArchivedFolder(123);
     * } catch (error) {
     *   console.error(error);
     * }
     */
    @Transactional()
    async restoreArchivedFolder(folderId: number, folderTypes: FolderTypeOptions[], user?: JwtUserInterface): Promise<void> {
        const folderActionRepository = this.repoFolder.manager.getRepository<FolderActionEntity>(FolderActionEntity);
        const repoFolder = this.repoFolder.manager.getRepository<FolderEntity>(FolderEntity);
        const restoreResult = await super.restoreArchivedFolder(folderId, folderTypes, user);
        const folderDB = await repoFolder.findOneBy({id: folderId});

        await folderActionRepository.save({
            date: new Date(),
            action: FolderActionOptions.RESTORE_ARCHIVE,
            user,
            messageId: FolderMessageId.RESTORE_ARCHIVE,
            folder: folderDB,
            Folder: folderDB,
            mentionMembers: null,
            parameters: null,
        });

        return restoreResult;
    }

    /**
     * Restores a deleted folder.
     *
     * @param {number} folderId - The ID of the folder to restore.
     * @return {Promise<void>} A promise that resolves when the folder is successfully restored.
     *
     * @throws {Error} If there was an error restoring the folder.
     */
    @Transactional()
    async restoreDeletedFolder(folderId: number): Promise<void> {
        return await super.restoreDeletedFolder(folderId);
    }

    /**
     * Binds a child folder to a parent folder.
     *
     * @param {number} folderId - The ID of the parent folder.
     * @param {FolderBindDto} dto - The folder binding data.
     * @param {JwtUserInterface} user - The user associated with the folder binding.
     * @return {Promise<void>} - A promise that resolves when the folder binding is complete.
     *
     * @throws {ForbiddenException} If the user does not have permission to perform the folder binding.
     * @throws {Error} If any of the input parameters are invalid or if there is an error during the binding process.
     *
     * @example
     *
     * // Usage example
     * const folderId = 1;
     * const dto = { insert: [2], delete: [3] };
     * const user = { id: 123, name: "John Doe" };
     *
     * bindFolderPermission(folderId, dto, user)
     *   .then(() => {
     *     console.log("Folder binding successfully completed");
     *   })
     *   .catch(error => {
     *     console.error("Folder binding failed:", error.message);
     *   });
     */
    @Transactional()
    async bindFolderPermission(folderId: number, dto: FolderBindDto, user: JwtUserInterface): Promise<void> {
        if (dto?.insert?.length) {
            for (const insertId of dto.insert) {
                const hasPermissions = await this.authorization.getUserHasPermissions(
                    user.id,
                    PermissionOptions.OWNER_FULL,
                    EntityTypeOptions.Folder,
                    insertId
                );
                if (!hasPermissions) {
                    throw new ForbiddenException(`Folder ${insertId} is forbidden for user ${user.id}`);
                }
                await super.bindFolder(insertId, folderId, user);
            }
        }

        if (dto?.delete?.length) {
            for (const deleteId of dto.delete) {
                const hasPermissions = await this.authorization.getUserHasPermissions(
                    user.id,
                    PermissionOptions.OWNER_FULL,
                    EntityTypeOptions.Folder,
                    deleteId
                );
                if (!hasPermissions) {
                    throw new ForbiddenException(`Folder ${deleteId} is forbidden for user ${user.id}`);
                }
                await super.unbindFolder(deleteId, folderId, user);
            }
        }

        return;
    }

    /**
     * Sets the views of a folder.
     *
     * @param {number} folderId - The ID of the folder.
     * @param {FolderViewDto[]} views - The array of folder views to set.
     * @param {string} _userId - The ID of the user.
     * @return {Promise<UpdateResult>} A promise that resolves to the update result.
     * @throws {Error} If an error occurs during the process.
     *
     * @transactional()
     */
    @Transactional()
    async setViewsOfFolder(folderId: number, views: FolderViewDto[], _userId: string): Promise<UpdateResult> {
        return await super.setViews(folderId, views);
    }

    /**
     * Sets custom fields for a folder.
     *
     * @param {number} folderId - The ID of the folder.
     * @param {FolderCustomFieldDto[]} dtos - The custom field data to set for the folder.
     * @param {JwtUserInterface} user - The user performing the action.
     *
     * @return {Promise<InsertResult[]>} - A promise that resolves to an array of InsertResult objects.
     *
     * @throws {Error} - If any error occurs during the operation.
     *
     * @example
     * const folderId = 123;
     * const dtos = [{ field: 'Field1', value: 'Value1' }, { field: 'Field2', value: 'Value2' }];
     * const user = { id: 'user123', name: 'John Doe' };
     *
     * try {
     *     const results = await setCustomFieldsForFolder(folderId, dtos, user);
     *     console.log(results);
     * } catch (error) {
     *     console.error(error);
     * }
     */
    @Transactional()
    async setCustomFieldsForFolder(folderId: number, dtos: FolderCustomFieldDto[], user: JwtUserInterface): Promise<InsertResult[]> {
        return await super.setCustomFields(folderId, dtos, user);
    }

    /**
     * Changes the owner of a folder.
     *
     * @param {number} folderId - The ID of the folder.
     * @param {string} newOwnerId - The ID of the new owner.
     * @param {string} oldOwnerId - The ID of the old owner.
     * @param {ChangeOwnerDto} dto - The data transfer object containing permissions information.
     * @param {string} showOn - The show on value.
     * @param {string} entityType - The entity type.
     *
     * @returns {Promise<void>} A promise that resolves when the owner change is complete.
     */
    @Transactional()
    async changeOwnerOfAFolder(
        folderId: number,
        newOwnerId: string,
        oldOwnerId: string,
        dto: ChangeOwnerDto,
        showOn: string,
        entityType: EntityTypeOptions
    ): Promise<void> {
        const folder = await super.getOne(folderId, showOn, oldOwnerId);
        const result = await super.changeOwner(folderId, newOwnerId);
        const spaceId = entityType === EntityTypeOptions.Space ? folderId : await this.spaceService.getSpaceFromFolderId(folder.id);

        /* Permissions */
        {
            await this.authorization.revokeFromUser(PermissionOptions.READ_UPDATE_DELETE, entityType, folder.ownerId, folderId);
            await this.authorization.revokeOwner(entityType, folder.ownerId, folderId);

            await this.authorization.grantToUser(PermissionOptions.READ_UPDATE_DELETE, entityType, newOwnerId, folderId);
            await this.authorization.grantOwner(entityType, newOwnerId, folderId);

            //** New permissions assigned to old user */
            if (dto.permissions !== UserPermissionOptions.NONE) {
                const permissionMapping = {
                    [UserPermissionOptions.FULL]: PermissionOptions.FULL,
                    [UserPermissionOptions.EDITOR]: PermissionOptions.EDITOR,
                    [UserPermissionOptions.READONLY]: PermissionOptions.READ,
                };

                const permissions = permissionMapping[dto.permissions];
                const updatePermissions =
                    dto.permissions === UserPermissionOptions.READONLY ? PermissionOptions.READ : PermissionOptions.READ_UPDATE;

                await this.authorization.grantToUser(permissions, entityType, folder.ownerId, folderId);
                await this.authorization.grantToUser(updatePermissions, entityType, folder.ownerId, folderId);
            }
        }
        const user = await this.repoFolder.manager.getRepository<UserEntity>(UserEntity).findOneBy({id: folder.ownerId});
        const folderEmailDto = await this.notificationService.setFolderEmailDto(folderId, user, FolderActionOptions.UPDATE_MEMBER, []);
        runOnTransactionCommit(() => {
            this.eventEmitter.emit(FolderEventNameOptions.FOLDER_SET_OWNER, {
                recipients: [newOwnerId],
                userId: folder.ownerId,
                data: {
                    event: FolderEventNameOptions.FOLDER_SET_OWNER,
                    taskId: null,
                    folderId: folderId,
                    spaceId,
                    ...folderEmailDto,
                    message: this.notificationService.setNotificationMessage({
                        entity: folder.folderType != FolderTypeOptions.SPACE ? folder.folderType : 'folder',
                        entityTitle: folder.title,
                        sender: getUserFullName(user),
                        actions: {
                            members: {owner: newOwnerId},
                        },
                    }),
                },
            } as EntityNotificationDto);
        });
        return result;
    }

    /**
     * Marks a folder as favourite for a specific user.
     *
     * @param {number} folderId - The ID of the folder to mark as favourite.
     * @param {string} userId - The ID of the user who wants to mark the folder as favourite.
     * @param {FolderTypeOptions[]} folderTypes - An array of folder types.
     * @returns {Promise<InsertResult>} A promise that resolves with the result of the operation.
     * @throws {Error} If the folderId or userId is invalid.
     *
     * @example
     * const folderId = 123;
     * const userId = 'abc123';
     * const result = await markFolderFavourite(folderId, userId, folderTypes);
     */
    @Transactional()
    async markFolderFavourite(folderId: number, userId: string, folderTypes: FolderTypeOptions[]): Promise<InsertResult> {
        return await super.markFolderFavourite(folderId, userId, folderTypes);
    }

    /**
     * Removes the favourite mark for a specific folder and user.
     *
     * @param {number} folderId - The id of the folder.
     * @param {string} userId - The id of the user.
     *
     * @return {Promise<DeleteResult>} A promise that resolves to the result of the delete operation.
     *
     * @throws {Error} If any error occurs during the delete operation.
     */
    @Transactional()
    async unmarkFavourite(folderId: number, userId: string): Promise<DeleteResult> {
        return await super.unmarkFavourite(folderId, userId);
    }

    /**
     * Follows a folder for a specified user and sets the showOn property.
     * @param {number} folderId - The ID of the folder to be followed.
     * @param {string} userId - The ID of the user following the folder.
     * @param {string} showOn - The property to be set for the folder.
     * @return {Promise<FolderFollowerEntity>} - A promise that resolves to a FolderFollowerEntity object representing the folder follower.
     * @throws {Error} - If there was an error during the process of following the folder.
     * @throws {TypeError} - If the provided arguments are of incorrect type.
     * @transactional
     */
    @Transactional()
    async followFolder(folderId: number, userId: string, showOn: string): Promise<FolderFollowerEntity> {
        return await super.follow(folderId, userId, showOn);
    }

    /**
     * Unfollows a folder for a specific user.
     *
     * @param {number} folderId - The ID of the folder to unfollow.
     * @param {string} userId - The ID of the user who wants to unfollow the folder.
     * @param {string} showOn - The type of view where the folder should not be shown anymore.
     *
     * @return {Promise<DeleteResult>} - A promise that resolves to the result of the delete operation.
     *
     * @throws {Error} - If there is any problem unfollowing the folder.
     */
    @Transactional()
    async unfollowFolder(folderId: number, userId: string, showOn: string): Promise<DeleteResult> {
        return await super.unfollow(folderId, userId, showOn);
    }

    /**
     * Retrieves the followers of a folder.
     *
     * @param {number} folderId - The ID of the folder.
     * @return {Promise<FolderFollowerEntity[]>} - A promise that resolves with the array of FolderFollowerEntity objects representing the followers of the folder.
     */
    async getFolderFollowers(folderId: number): Promise<FolderFollowerEntity[]> {
        return await super.getFollowers(folderId);
    }

    /**
     * Updates the position of a folder in the user's favourite position folder.
     *
     * @param {number} folderId - The ID of the folder to update.
     * @param {number} index - The new index position of the folder.
     * @param {string} userId - The ID of the user.
     * @return {Promise<void>} A promise that resolves when the update is complete.
     *
     * @throws {Error} If the folder update fails.
     *
     * @example
     * await updateFavouritePositionFolder(5, 2, "abc123");
     */
    @Transactional()
    async updateFavouritePositionFolder(folderId: number, index: number, userId: string): Promise<void> {
        return await super.updateFavouritePosition(folderId, index, userId);
    }

    /**
     * Retrieves the list of fav folders of a user.
     */
    async getFavouriteFolders(userId: string, showOn: string, entityTypes: FolderTypeOptions[]): Promise<FolderFavouriteDto[]> {
        return await super.getFavourites(userId, showOn, entityTypes);
    }

    /**
     * Retrieves the list of folders that the user is following.
     *
     * @param {JwtUserInterface} user - The user object containing the JWT information.
     * @param {string} showOn - The filter to show folders based on a specific condition.
     * @return {Promise<GetFollowingFolderDto[]>} - A Promise that resolves with an array of GetFollowingFolderDto objects representing the folders that the user is following.
     */
    async getFolderFollowing(user: JwtUserInterface, showOn: string): Promise<GetFollowingFolderDto[]> {
        return await super.getFollowing(user, showOn);
    }

    /**
     * Adds custom field values to a folder.
     *
     * @param {number} folderId - The ID of the folder to add custom field values to.
     * @param {CreateFolderCustomFieldValueDto[]} dto - An array of custom field value data transfer objects.
     * @param {JwtUserInterface} user - The user who is adding the custom field values.
     * @param {EntityTypeOptions} entityType - The entity type of the folder.
     *
     * @return {Promise<InsertResult>} - A promise that resolves to the result of the database insert operation.
     */
    async addFolderCustomFieldValues(
        folderId: number,
        dto: CreateFolderCustomFieldValueDto[],
        user: JwtUserInterface,
        entityType: EntityTypeOptions
    ): Promise<InsertResult> {
        // userPermission = [UserPermissionOptions.FULL, UserPermissionOptions.EDITOR, UserPermissionOptions.READONLY],
        return await super.addFolderCustomFieldValue(folderId, dto, user.id, entityType);
    }

    /**
     * Updates the tags of a folder.
     *
     * @param {number} folderId - The ID of the folder.
     * @param {UpdateFolderTagsTasksDto} dto - The data for updating the folder tags.
     * @param {EntityTypeOptions} entityType - The entity type of the folder.
     * @return {Promise<void>} A promise that resolves when the folder tags have been updated.
     * @throws {Error} If there was an error while updating the folder tags.
     */
    @Transactional()
    async updateOneFolderTags(folderId: number, dto: UpdateFolderTagsTasksDto, entityType: EntityTypeOptions): Promise<void> {
        return await super.updateFolderTags(folderId, dto, entityType);
    }

    /**
     * Retrieves the tags associated with a given folder.
     *
     * @async
     * @param {number} folderId - The ID of the folder to retrieve tags for.
     * @return {Promise<TagEntity[]>} - A promise that resolves to an array of TagEntity objects.
     */
    async getFolderTags(folderId: number): Promise<TagEntity[]> {
        return await super.getFolderTags(folderId);
    }

    /**
     * Retrieves the files in a folder identified by the given folder ID,
     * for the specified user.
     *
     * @param {number} folderId - The ID of the folder to retrieve files from.
     * @param {JwtUserInterface} user - The user associated with the files retrieval.
     * @returns {Promise<TaskAttachmentEntity[]>} - A promise that resolves with an array of TaskAttachmentEntity representing the files in the folder.
     */
    async getFolderFiles(folderId: number, user: JwtUserInterface): Promise<TaskAttachmentEntity[]> {
        const allowedIds = await this.authorization.getRecursiveIdsForUser(
            user.id,
            EntityTypeOptions.Folder,
            PermissionOptions.READ,
            folderId
        );
        const folderIds = allowedIds.map((x) => x.id);
        return await super.getFiles(folderIds);
    }

    /**
     * Imports tasks from a given folder.
     *
     * @param {Express.Multer.File} file - The file to be imported.
     * @param {ImportTasksFromExcelDto} dto - The data transfer object containing details for importing tasks.
     * @param {number} [folder_id=null] - The ID of the folder. Defaults to null if not provided.
     * @param {JwtUserInterface} user - The user who is importing the tasks.
     *
     * @returns {Promise<boolean>} Returns a Promise that resolves to a boolean indicating whether the import was successful or not.
     */
    async importFolderTasks(
        file: Express.Multer.File,
        dto: ImportTasksFromExcelDto,
        folder_id: number = null,
        user: JwtUserInterface
    ): Promise<boolean> {
        //to do add validation
        return await super.importFoldersTasks(file, dto, folder_id, user);
    }

    /**
     * Retrieves the last added files from the specified folder.
     *
     * @param {number} folderId - The ID of the folder to retrieve the files from.
     * @return {Promise<TaskAttachmentEntity[]>} A promise that resolves to an array of TaskAttachmentEntity objects representing the last added files.
     */
    async getLastAddedFiles(folderId: number): Promise<TaskAttachmentEntity[]> {
        return await super.getLastAddedFiles(folderId);
    }

    /**
     * Downloads multiple files from a folder.
     *
     * @param ids - An array of file IDs to download.
     * @param folderId - The ID of the folder containing the files.
     * @param user - The user requesting the download.
     * @returns A Promise that resolves to a Buffer containing the downloaded files.
     * @throws {Error} If there was an error while fetching the files.
     */
    async downloadMultipleFiles(ids: number[], folderId: number, user: JwtUserInterface): Promise<Buffer> {
        const allowedIds = await this.authorization.getRecursiveIdsForUser(
            user.id,
            EntityTypeOptions.Folder,
            PermissionOptions.READ,
            folderId
        );
        const folderIds = allowedIds.map((x) => x.id);
        try {
            return await super.downloadMultipleFilesService(ids, folderIds);
        } catch (e) {
            this.logger.error(`There was an error while fetching files with id ${ids}`, e);
            throw e;
        }
    }

    private async verifySpaceMembers(spaceId: number, folderMembers: GenericMemberDto[]): Promise<void> {
        if (spaceId) {
            const ret = await this.authorization.checkUsersHasPermissionsOnEntity(
                folderMembers.map((m) => m.id),
                PermissionOptions.READ,
                EntityTypeOptions.Space,
                spaceId
            );

            const membersWithNoPermissions = ret.filter((e) => e.value === false);
            if (membersWithNoPermissions.length) {
                throw new ForbiddenException(
                    `Users with the ids ${membersWithNoPermissions.map((m) => m.id).join(' ,')} don't have permissions on space`
                );
            }
        }
        return;
    }

    private async getSpaceChildrenFoldersIds(spaceId: number, userId: string): Promise<{id: number; entityType: EntityTypeOptions}[]> {
        const folderIdsToRemoveTeamsFrom: {id: number; entityType: EntityTypeOptions}[] = [];
        const params: unknown[] = [userId, 'root', 'task-management'];
        const query = `
        SELECT
            F.id,
            F.folder_type AS "folderType",
            F.user_id AS "ownerId",
            RECUR.depth,
            RECUR.fr_id,
            RECUR.is_bind AS "isBind",
            ARRAY_TO_STRING(RECUR.path, ',') AS path
        FROM (${queries.folderTree([spaceId])}) AS RECUR
        INNER JOIN "${RawDatabaseConfig.schema}".folder F ON RECUR.id = F.id
        INNER JOIN "${RawDatabaseConfig.schema}".folder_relation FR ON FR.id = RECUR.fr_id
        LEFT JOIN "${RawDatabaseConfig.schema}".folder_position FP 
            ON FP.folder_relation_id = RECUR.fr_id 
            AND FP.user_id = $1 
            AND FP.view::text = $2  
        WHERE $3 = ANY (F.show_on)
    `;

        try {
            const folders: FolderTreeDto[] = await this.repoFolder.manager.query(query, params);
            folders.forEach((folder) => {
                folderIdsToRemoveTeamsFrom.push({
                    id: folder.id,
                    entityType: folder.folderType === FolderTypeOptions.SPACE ? EntityTypeOptions.Space : EntityTypeOptions.Folder,
                });
            });

            return folderIdsToRemoveTeamsFrom;
        } catch (error) {
            this.logger.error('This error occurs while removing the permissions/members of space children');
            throw error;
        }
    }
}
