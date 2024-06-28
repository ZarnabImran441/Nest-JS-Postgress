import {ABSTRACT_AUTHORIZATION_SERVICE, contructorLogger, IdType, JwtUserInterface, PaginationDto, S3Service} from '@lib/base-library';
import {forwardRef, Inject, Injectable, NotFoundException} from '@nestjs/common';
import {FolderEntity} from '../../model/folder.entity';
import {InjectRepository} from '@nestjs/typeorm';
import {DeleteResult, InsertResult, Repository, UpdateResult} from 'typeorm';
import {SpaceBaseService} from './space-base.service';
import {CreateSpaceDto, CreateSpaceResponse} from '../../dto/space/create-space.dto';
import {
    ArchiveSpaceDto,
    CopySpaceDto,
    CreateSpaceCustomFieldValueDto,
    SpaceFavouriteDto,
    SpaceStatsDto,
    UpdateSpaceDto,
    UpdateSpacePositionDto,
} from '../../dto/space/update-space.dto';
import {FolderService} from '../folder/folder.service';
import {GetSpaceDto} from '../../dto/space/get-space.dto';
import {AuthorizationImplService} from '../authorization-impl/authorization-impl.service';
import {EntityTypeOptions, PermissionOptions} from '../authorization-impl/authorization.enum';
import {Transactional} from 'typeorm-transactional';
import {MembersDto} from '../../dto/folder/folder/members.dto';
import {FolderActionEntity} from '../../model/folder-action.entity';
import {FolderActionOptions} from '../../enum/folder-action.enum';
import {FolderMessageId} from '../../utils/folder-message-id';
import {ChangeOwnerDto} from '../../dto/folder/folder/create-folder.dto';

/**
 * Represents a service for managing spaces within the application.
 */
@Injectable()
export class SpaceService extends SpaceBaseService {
    /**
     * Creates a new instance of the Constructor class.
     *
     * @param {Repository<FolderEntity>} repo - The repository for FolderEntity.
     * @param {FolderService} folderService - The service for FolderService.
     * @param {S3Service} s3Service - The service for S3Service.
     * @param {AuthorizationImplService} authorization - The authorization service.
     */
    constructor(
        @InjectRepository(FolderEntity) protected readonly repo: Repository<FolderEntity>,
        @Inject(forwardRef(() => FolderService))
        protected readonly folderService: FolderService,
        protected readonly s3Service: S3Service,
        @Inject(ABSTRACT_AUTHORIZATION_SERVICE) protected readonly authorization: AuthorizationImplService
    ) {
        super(repo, folderService, s3Service, authorization);
        contructorLogger(this);
    }

    /**
     * Creates a space.
     *
     * @param {CreateSpaceDto} dto - The space data.
     * @param {string} userId - The ID of the user creating the space.
     * @param {string} sanitizedToken - The sanitized access token of the user creating the space.
     *
     * @return {Promise<CreateSpaceResponse>} - A promise that will resolve with the response indicating the success
     * of creating the space.
     */
    async createSpace(dto: CreateSpaceDto, userId: string, sanitizedToken: string): Promise<CreateSpaceResponse> {
        return await super.createOneSpace(dto, userId, sanitizedToken);
    }

    /**
     * Update space by spaceId
     *
     * @param {number} spaceId - The ID of the space to update
     * @param {UpdateSpaceDto} dto - The data to update the space with
     * @param {JwtUserInterface} user - The user who is updating the space
     * @param {string} authorization - The authorization token
     * @param {string} showOn - The show on option for the space
     * @return {Promise<UpdateResult>} - A promise that resolves to the update result
     */
    async updateSpace(
        spaceId: number,
        dto: UpdateSpaceDto,
        user: JwtUserInterface,
        authorization: string,
        showOn: string
    ): Promise<UpdateResult> {
        this.logger.log('Updating One Space');
        return await super.updateOneSpace(spaceId, dto, user, authorization, showOn);
    }

    /**
     * Retrieves all spaces based on the provided parameters.
     *
     * @param {string} userId - The ID of the user.
     * @param {string} showOn - The filter option for where to show the spaces.
     * @param {boolean} showDeleted - Flag indicating whether to include deleted spaces.
     * @param {boolean} showArchived - Flag indicating whether to include archived spaces.
     * @param {PaginationDto} pagination - The pagination options for the result.
     * @return {Promise<GetSpaceDto[]>} - A promise that resolves to an array of space objects.
     */
    async getAllSpaces(
        userId: string,
        showOn: string,
        showDeleted: boolean,
        showArchived: boolean,
        pagination: PaginationDto
    ): Promise<GetSpaceDto[]> {
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
        let spaceArray = await super.getSpaces(userId, showOn, showDeleted, showArchived, hasPurgePermissions, pagination);

        /* Permissions */
        {
            // Filter out spaces the user cannot READ
            spaceArray = await this.authorization.filterArrayNodeWithPermission(
                spaceArray as IdType[],
                userId,
                EntityTypeOptions.Space,
                PermissionOptions.READ
            );
        }
        return spaceArray;
    }

    /**
     * Deletes a space for a given spaceId and userId.
     *
     * @param {number} spaceId - The ID of the space to delete.
     * @param {string} userId - The ID of the user performing the operation.
     *
     * @return {Promise<void>} A Promise that resolves when the space is deleted.
     */
    async deleteSpace(spaceId: number, userId: string): Promise<void> {
        return await super.deleteOneSpace(spaceId, userId);
    }

    /**
     * Retrieves a single space with the given space ID, user ID, and showOn value.
     * @param {number} spaceId - The ID of the space to retrieve.
     * @param {JwtUserInterface} user - The user making the request.
     * @param {string} showOn - The date to show the space on.
     * @returns {Promise<GetSpaceDto>} A promise that resolves to the retrieved space.
     * @throws {NotFoundException} If the space with the specified ID is not found.
     */
    async getOneSpace(spaceId: number, user: JwtUserInterface, showOn: string): Promise<GetSpaceDto> {
        const response = await super.getOneSpaceById(spaceId, showOn, user.id);
        const folderActionRepository = this.repo.manager.getRepository<FolderActionEntity>(FolderActionEntity);

        if (!response) {
            throw new NotFoundException(`Space with id :${spaceId} not found`);
        }

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
        return response;
    }

    /**
     * Retrieves statistics for a specific space.
     *
     * @param {number} spaceId - The ID of the space to retrieve the statistics for.
     * @param {string} showOn - The type of statistics to retrieve (e.g. "today", "week", "month").
     * @return {Promise<SpaceStatsDto>} - A promise that resolves to the space statistics.
     * @throws {NotFoundException} - If the space with the specified ID is not found.
     */
    async getOneSpaceStats(spaceId: number, showOn: string): Promise<SpaceStatsDto> {
        const response = await super.getSpaceStats(spaceId, showOn);
        if (!response) {
            throw new NotFoundException(`Space with id :${spaceId} not found`);
        }
        return response;
    }

    /**
     * Adds custom field values to a space.
     *
     * @param {number} spaceId - The ID of the space.
     * @param {CreateSpaceCustomFieldValueDto[]} dto - The array of custom field values to be added.
     * @param {JwtUserInterface} user - The user making the request.
     * @return {Promise<InsertResult>} - A promise that resolves to an InsertResult object.
     */
    async addSpaceCustomFieldValues(spaceId: number, dto: CreateSpaceCustomFieldValueDto[], user: JwtUserInterface): Promise<InsertResult> {
        return await super.addOneSpaceCustomFieldValues(spaceId, dto, user);
    }

    /**
     * Archives a space with folders.
     *
     * @param {number} spaceId - The ID of the space to be archived.
     * @param {string} userId - The ID of the user attempting to archive the space.
     * @param {string} sanitizedToken - The sanitized token for authentication.
     * @param {ArchiveSpaceDto} dto - The data transfer object containing information about the space to be archived.
     *
     * @return {Promise<void>} - A Promise indicating the success or failure of the archive operation.
     */
    async archiveSpaceWithFolders(spaceId: number, userId: string, sanitizedToken: string, dto: ArchiveSpaceDto): Promise<void> {
        return await super.archiveSpaceTree(spaceId, userId, sanitizedToken, dto);
    }

    /**
     * Restores an archived space by its ID.
     *
     * @param {number} spaceId - The ID of the archived space to be restored.
     * @return {Promise<void>} A Promise that resolves when the space is successfully restored, or rejects with an error.
     */
    async restoreArchivedSpace(spaceId: number, user: JwtUserInterface): Promise<void> {
        return await super.restoreArchivedSpaceTree(spaceId, user);
    }

    /**
     * Retrieves the favourite spaces of a given user based on the specified conditions.
     *
     * @param {string} userId - The ID of the user.
     * @param {string} show_on - The condition to filter the favourite spaces. (e.g. 'home', 'work')
     *
     * @return {Promise<SpaceFavouriteDto[]>} - A promise that resolves to an array of SpaceFavouriteDto objects representing the favourite spaces.
     */
    async getFavourites(userId: string, show_on: string): Promise<SpaceFavouriteDto[]> {
        return await super.getFavouriteSpaces(userId, show_on);
    }

    /**
     * Marks a space as a favourite for a user.
     *
     * @param {number} spaceId - The ID of the space to mark as favourite.
     * @param {string} userId - The ID of the user who is marking the space as favourite.
     * @returns {Promise<InsertResult>} - A promise that resolves with the result of marking the space as favourite.
     */
    async markSpaceFavourite(spaceId: number, userId: string): Promise<InsertResult> {
        return await super.markOneSpaceFavourite(spaceId, userId);
    }

    /**
     * Removes the specified space from the favorites list of a user.
     *
     * @param {number} spaceId - The ID of the space to remove from favorites.
     * @param {string} userId - The ID of the user.
     * @returns {Promise<DeleteResult>} A promise that resolves with the result of the deletion.
     */
    async unmarkSpaceFavourite(spaceId: number, userId: string): Promise<DeleteResult> {
        return await super.unmarkOneSpaceFavourite(spaceId, userId);
    }

    /**
     * Updates the position of a space.
     *
     * @param {number} spaceId - The ID of the space to update.
     * @param {UpdateSpacePositionDto} data - The data containing the new position of the space.
     * @param {JwtUserInterface} user - The user making the update.
     * @return {Promise<void>} - A Promise that resolves when the position of the space has been updated.
     */
    async updateSpacePosition(spaceId: number, data: UpdateSpacePositionDto, user: JwtUserInterface): Promise<void> {
        this.logger.log('Updating One Space Position');
        await super.updateOneSpacePosition(spaceId, data, user, EntityTypeOptions.Space);
    }

    /**
     * Updates the position of a favourite space.
     *
     * @param {number} spaceId - The ID of the space to update.
     * @param {UpdateSpacePositionDto} data - The data containing the new position of the space.
     * @param {JwtUserInterface} user - The user making the update.
     * @return {Promise<void>} - A Promise that resolves when the position of the space has been updated.
     */
    async updateFavouriteSpacePosition(spaceId: number, data: UpdateSpacePositionDto, user: JwtUserInterface): Promise<void> {
        this.logger.log('Updating Favorite Space Position');
        await super.updateFavouriteSpacePosition(spaceId, data, user);
    }

    /**
     * Asynchronously copies a space to a new folder.
     *
     * @param {number} folderId - The ID of the space to be copied.
     * @param {number} parentFolderId - The ID of the folder where the space should be copied to.
     * @param {CopySpaceDto} dto - The data transfer object containing the details of the space to be copied.
     * @param {JwtUserInterface} user - The authenticated user making the copy request.
     * @param {string} authorization - The authorization token for the request.
     * @param {string} showOn - The date on which the space should be visible.
     * @return {Promise<FolderEntity>} - A Promise that resolves with the newly created folder containing the copied space.
     */
    async copyOneSpace(
        folderId: number,
        parentFolderId: number,
        dto: CopySpaceDto,
        user: JwtUserInterface,
        authorization: string,
        showOn: string
    ): Promise<FolderEntity> {
        return await super.copyOneSpace(folderId, parentFolderId, dto, user, authorization, showOn);
    }

    /**
     * Sets the member for a space.
     *
     * @param {number} spaceId - The ID of the space.
     * @param {MembersDto} dto - The members DTO.
     * @param {JwtUserInterface} user - The user.
     * @param {string} showOn - The showOn value.
     * @param {EntityTypeOptions} entityType - The entity type.
     * @throws {Error} If an error occurs while setting the member.
     * @throws {UnauthorizedException} If the user is not authorized to set the member.
     * @throws {NotFoundException} If the space with the given ID is not found.
     * @returns {Promise<void>} A Promise that resolves once the member is set.
     */
    @Transactional()
    async setSpaceMember(
        spaceId: number,
        dto: MembersDto,
        user: JwtUserInterface,
        showOn: string,
        entityType: EntityTypeOptions
    ): Promise<void> {
        this.logger.log('Setting space member');
        return await this.folderService.setFolderMembersInternal(spaceId, dto, user.id, showOn, entityType);
    }

    /**
     * Gets the space ID from a folder ID.
     *
     * @param {number} folderId - The ID of the folder.
     * @param {boolean} includeArchivedAndDeleted - true if the query should include archived and deleted folders.
     * @returns{Promise<string>} - The ID of the space
     * */
    public async getSpaceFromFolderId(folderId: number, includeArchivedAndDeleted = false): Promise<number> {
        return await super.getSpaceFromFolderId(folderId, includeArchivedAndDeleted);
    }

    /**
     * Asynchronously changes the owner of a space.
     *
     * @param {number} spaceId - The ID of the space to change the owner.
     * @param {string} newOwnerId - The ID of the new owner.
     * @param {JwtUserInterface} user - The JWT user object.
     * @param {ChangeOwnerDto} dto - The data transfer object containing additional information for changing the owner.
     * @param {string} showOn - The string indicating where the change should be shown.
     *
     * @return {Promise<void>} - A promise that resolves when the owner is successfully changed.
     */
    async changeSpaceOwner(
        spaceId: number,
        newOwnerId: string,
        user: JwtUserInterface,
        dto: ChangeOwnerDto,
        showOn: string
    ): Promise<void> {
        this.logger.log('Changing Space owner');
        return await super.changeSpaceOwner(spaceId, newOwnerId, user, dto, showOn);
    }
}
