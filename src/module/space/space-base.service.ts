import {
    ABSTRACT_AUTHORIZATION_SERVICE,
    base64Toimage,
    contructorLogger,
    JwtUserInterface,
    listToTree,
    modifyTree,
    PaginationDto,
    S3Service,
} from '@lib/base-library';
import {forwardRef, Inject, Injectable, Logger} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {FolderEntity} from '../../model/folder.entity';
import {CreateSpaceDto, CreateSpaceResponse} from '../../dto/space/create-space.dto';
import {
    ArchiveSpaceDto,
    CopySpaceDto,
    CreateSpaceCustomFieldValueDto,
    SpaceFavouriteDto,
    SpaceStatsDto,
    UpdateSpaceDto,
    UpdateSpacePositionDto,
    UpdateSpaceTagsDto,
    updateSpaceWorkflowsDto,
} from '../../dto/space/update-space.dto';
import {DeleteResult, InsertResult, Repository, UpdateResult} from 'typeorm';
import {FolderService} from '../folder/folder.service';
import {Transactional} from 'typeorm-transactional';
import {FolderSpaceTeamEntity} from '../../model/folder-space-team.entity';
import {FolderSpaceWorkflowEntity} from '../../model/folder-space-workflow.entity';
import {FolderSpaceCustomFieldCollectionEntity} from '../../model/folder-space-custom-field-collections.entity';
import {queries} from '../../recursive-queries';
import {MembersDto} from '../../dto/folder/folder/members.dto';
import {EntityTypeOptions} from '../authorization-impl/authorization.enum';
import {AuthorizationImplService} from '../authorization-impl/authorization-impl.service';
import {GetSpaceDto} from '../../dto/space/get-space.dto';
import {FolderSpaceTagsCollectionEntity} from '../../model/folder-space-labels-collection.entity';
import {FolderTypeOptions, FolderViewTypeOptions} from '../../enum/folder.enum';
import {RawDatabaseConfig} from '../../config/database.config';
import {FolderTreeDto} from '../../dto/folder/folder/folder-tree.dto';
import {ChangeOwnerDto} from '../../dto/folder/folder/create-folder.dto';
import {ResponseMembersDto, ResponseTeamDto} from '../../dto/teams/reponse-team.dto';
import {FolderFavouriteEntity} from '../../model/folder-favourite.entity';

/**
 * Provides methods to create and update Space entities.
 */
@Injectable()
export class SpaceBaseService {
    protected logger: Logger;
    private readonly SPACE = 'space';

    /**
     * Constructs a new instance of the class.
     *
     * @param {Repository<FolderEntity>} repo - The repository for the FolderEntity.
     * @param {FolderService} folderService - The FolderService.
     * @param {S3Service} s3Service - The S3Service.
     * @param {AuthorizationImplService} authorization - The authorization service.
     */
    constructor(
        @InjectRepository(FolderEntity) protected readonly repo: Repository<FolderEntity>,
        @Inject(forwardRef(() => FolderService))
        protected readonly folderService: FolderService,
        protected readonly s3Service: S3Service,
        @Inject(ABSTRACT_AUTHORIZATION_SERVICE) protected readonly authorization: AuthorizationImplService
    ) {
        this.logger = new Logger(this.constructor.name);
        contructorLogger(this);
    }

    private get repoFolder(): Repository<FolderEntity> {
        return this.repo.manager.getRepository<FolderEntity>(FolderEntity);
    }

    /**
     * Creates a new space with the provided data.
     *
     * @param {CreateSpaceDto} dto - The data used to create the space.
     * @param {string} userId - The ID of the user creating the space.
     * @param {string} accessToken - The access token of the user.
     * @returns {Promise<CreateSpaceResponse>} - A promise that resolves with the ID of the created space.
     * @throws {Error} - If an error occurs while creating the space.
     */
    @Transactional()
    async createOneSpace(dto: CreateSpaceDto, userId: string, accessToken: string): Promise<CreateSpaceResponse> {
        //** 1 - Create folder (tags and members will be assigned throw this function)  */
        const repoFolderSpaceWorkflows = this.repo.manager.getRepository<FolderSpaceWorkflowEntity>(FolderSpaceWorkflowEntity);

        //** Upload the profile image first and then create a relation of it with folder/space */
        const spaceDB = await this.folderService.create(
            {
                ...dto,
                folderType: FolderTypeOptions.SPACE,
                viewType: FolderViewTypeOptions.PUBLIC,
                workflow: null,
                parentFolderId: null,
            },
            userId,
            accessToken,
            EntityTypeOptions.Space
        );

        //** Upload a space profile image */
        if (dto.pictureUrl) {
            const profileImage = await this.uploadSpaceProfile(spaceDB.id, dto.pictureUrl);
            await this.repoFolder.update(spaceDB.id, {pictureUrl: profileImage, id: spaceDB.id});
        }

        //** Assign workflows to the folder if we found them in dto */
        if (dto.availableWorkflows) {
            for (const workflowId of dto.availableWorkflows) {
                await repoFolderSpaceWorkflows.insert({
                    Folder: {id: spaceDB.id},
                    Workflow: {id: workflowId},
                });
            }
        }

        return {id: spaceDB.id};
    }

    /**
     * Updates a space with the given information.
     *
     * @param {number} spaceId - The ID of the space to be updated.
     * @param {UpdateSpaceDto} dto - The data to update the space with.
     * @param {JwtUserInterface} user - The user performing the update operation.
     * @param {string} authorization - The authorization token.
     * @param {string} showOn - The showOn parameter.
     * @returns {Promise<UpdateResult>} - A promise that resolves to the result of the update operation.
     * @throws {*} - Any error that occurred during the update operation.
     */
    @Transactional()
    async updateOneSpace(
        spaceId: number,
        dto: UpdateSpaceDto,
        user: JwtUserInterface,
        authorization: string,
        showOn: string
    ): Promise<UpdateResult> {
        try {
            if (dto?.pictureUrl) {
                this.logger.log('Updating Space Picture');
                await this.updateOneSpacePicture(spaceId, dto.pictureUrl, user.id, showOn);
                delete dto['pictureUrl'];
            }

            if (dto?.workflows) {
                this.logger.log('Updating Space Workflows');
                await this.updateOneSpaceWorkflows(spaceId, dto.workflows);
                delete dto['workflows'];
            }

            // Basic Properties Update
            if (Object.values(dto).length > 0) {
                this.logger.log('Updating Space Basic Properties ');
                return await this.folderService.update(
                    spaceId,
                    {
                        ...dto,
                        startDate: null,
                        endDate: null,
                    },
                    user.id,
                    authorization,
                    showOn,
                    EntityTypeOptions.Space
                );
            }

            // setting "updatedAt" and "updatedBy" properties
            return this.repoFolder.update(spaceId, {updatedAt: new Date(), updatedBy: user.id, id: spaceId});
        } catch (error) {
            this.logger.error(`An error occurred while updating a space`, error);
            throw error;
        }
    }

    /**
     * Update space workflows for a given space
     * This method updates the space workflows by inserting or deleting the workflows specified in the DTO.
     *
     * @param {number} spaceId - The ID of the space to update the workflows for.
     * @param {updateSpaceWorkflowsDto} dto - The DTO containing the workflows to insert or delete.
     * @returns {Promise<void>} - A Promise that resolves when the update is complete.
     * @throws {Error} - If an error occurs while updating the teams for a space.
     *
     * @example
     * updateOneSpaceWorkflows(1, {
     *   insert: [2, 3],
     *   delete: [4, 5]
     * });
     */
    @Transactional()
    async updateOneSpaceWorkflows(spaceId: number, dto: updateSpaceWorkflowsDto): Promise<void> {
        try {
            const repoFolderSpaceWorkflows = this.repo.manager.getRepository<FolderSpaceWorkflowEntity>(FolderSpaceWorkflowEntity);

            if (dto.insert) {
                //**  */
                for (const workflowId of dto.insert) {
                    await repoFolderSpaceWorkflows.insert({
                        Folder: {id: spaceId},
                        Workflow: {id: workflowId},
                    });
                }
            }

            if (dto.delete) {
                for (const workflowId of dto.delete) {
                    await repoFolderSpaceWorkflows.delete({
                        Folder: {id: spaceId},
                        Workflow: {id: workflowId},
                    });
                }
            }
            return;
        } catch (error) {
            this.logger.error(`An error occurred while updating teams for a space : ${dto}, id: ${spaceId}`, error);
            throw error;
        }
    }

    /**
     * Retrieves a list of spaces for the given user.
     *
     * @param {string} userId - The ID of the user.
     * @param {string} showOn - The condition to show spaces on.
     * @param {boolean} showDeleted - Flag indicating whether to show deleted spaces.
     * @param {boolean} showArchived - Flag indicating whether to show archived spaces.
     * @param {boolean} hasPurgePermissions - Flag indicating whether the user has purge permissions.
     * @param {PaginationDto} pagination - The pagination settings.
     * @returns {Promise<GetSpaceDto[]>} - A promise that resolves to an array of space objects.
     */
    async getSpaces(
        userId: string,
        showOn: string,
        showDeleted: boolean,
        showArchived: boolean,
        hasPurgePermissions: boolean,
        pagination: PaginationDto
    ): Promise<GetSpaceDto[]> {
        try {
            const {limit, offset} = this.createPagination(pagination);
            let query =
                queries.folder +
                ` INNER JOIN "${RawDatabaseConfig.schema}".folder_relation BFR ON BFR.child_folder_id = F.ID LEFT JOIN "${RawDatabaseConfig.schema}".folder_position BFP ON BFP.folder_relation_id = BFR.id AND BFP.user_id = $1 WHERE ($2 = ANY (F.SHOW_ON)) AND F.folder_type = 'space' `;

            if (showArchived === false) {
                query = query + `AND F.archived_at IS NULL `;
            }

            if (!(hasPurgePermissions && showDeleted)) {
                query = query + `AND F.deleted_at IS NULL `;
            }

            const sql = query + ` ORDER BY BFP.index LIMIT $3 OFFSET $4`;
            const spaces = await this.repo.query(sql, [userId, showOn, limit, offset]);

            const spaceIds = spaces.map((space) => space.id);

            const favouriteCountSql = `WITH RECURSIVE nested_folders AS (
                SELECT fr.parent_folder_id, fr.child_folder_id
                FROM "${RawDatabaseConfig.schema}".folder_relation fr
                WHERE fr.parent_folder_id = ANY($1)
                UNION ALL
                SELECT nf.parent_folder_id, fr.child_folder_id
                FROM "${RawDatabaseConfig.schema}".folder_relation fr
                JOIN nested_folders nf ON fr.parent_folder_id = nf.child_folder_id
            ), folder_counts AS (
                SELECT parent_folder_id,
                       COUNT(DISTINCT child_folder_id) AS folderCount,
                       array_agg(DISTINCT child_folder_id) AS childFolderIds
                FROM nested_folders
                GROUP BY parent_folder_id
            ), folder_favourites AS (
                SELECT fc.parent_folder_id,
                       jsonb_agg(
                           jsonb_build_object(
                               'id', FF.FOLDER_ID,
                               'title', F.title,
                               'defaultView' , F.DEFAULT_VIEW,
                               'path_ids',FR.path_ids
                           )
                       ) FILTER (WHERE FF.FOLDER_ID IS NOT NULL) AS folderFavourites
                FROM folder_counts fc
                CROSS JOIN LATERAL unnest(fc.childFolderIds) AS childFolderId
                LEFT JOIN "${RawDatabaseConfig.schema}".folder_favourite FF ON FF.FOLDER_ID = childFolderId AND FF.USER_ID = $2
                LEFT JOIN "${RawDatabaseConfig.schema}".folder F ON F.id = FF.FOLDER_ID
                LEFT JOIN "${RawDatabaseConfig.schema}".folder_relation FR ON F.id = FR.child_folder_id
                GROUP BY fc.parent_folder_id
            ), favourites AS (
                SELECT FOLDER_ID
                FROM "${RawDatabaseConfig.schema}".folder_favourite FF
                WHERE FF.FOLDER_ID = ANY(SELECT parent_folder_id FROM folder_counts) AND FF.USER_ID = $2
            ),task_counts AS (
                SELECT
                    fc.parent_folder_id,
                    COUNT(DISTINCT tr.id) AS taskCount
                FROM "${RawDatabaseConfig.schema}".task_relation tr
                JOIN folder_counts fc ON tr.folder_id = fc.parent_folder_id OR tr.folder_id = ANY(fc.childFolderIds)
                INNER JOIN "${RawDatabaseConfig.schema}".task t on t.id = tr.child_task_id AND t.archived_at is null and t.deleted_at is null
                GROUP BY fc.parent_folder_id
            )
            SELECT
                fc.parent_folder_id,
                fc.folderCount,
                fc.childFolderIds,
                COALESCE(ff.folderFavourites, '[]'::jsonb) AS folderFavourites,
                COALESCE(tc.taskCount, 0) AS taskCount
            FROM folder_counts fc
            LEFT JOIN favourites fav ON fc.parent_folder_id = fav.FOLDER_ID
            LEFT JOIN folder_favourites ff ON fc.parent_folder_id = ff.parent_folder_id
            LEFT JOIN task_counts tc ON fc.parent_folder_id = tc.parent_folder_id`;

            const favouriteResult = await this.repo.query(favouriteCountSql, [spaceIds, userId]);
            const favouriteSet = new Map(
                favouriteResult.map((item) => [
                    item.parent_folder_id.toString(),
                    {
                        folderCount: parseInt(item.foldercount),
                        favouriteFolders: item.folderfavourites,
                        taskCount: parseInt(item.taskcount),
                    },
                ])
            );

            const spaceActivity = await this.repo.query(
                `SELECT  
                (
                    SELECT JSON_AGG(X) FROM
                        (
                            SELECT (
                                FA.user->>'id')::varchar AS user_id , FA.folder_id, COUNT(*) AS visits
                                FROM "${RawDatabaseConfig.schema}".folder_action FA
                                WHERE FA.ACTION = 'visit' AND FA.DATE >= NOW() - INTERVAL '30 days' AND FA.FOLDER_ID = ANY($1)
                                GROUP BY (FA.user->>'id')::varchar, FA.FOLDER_ID
                            ) AS X
                ) AS mtd,
                (
                    SELECT JSON_AGG(X) FROM
                        (
                            SELECT (
                                FA.user->>'id')::varchar AS user_id , FA.folder_id, COUNT(*) AS visits
                                FROM "${RawDatabaseConfig.schema}".folder_action FA
                                WHERE FA.ACTION = 'visit' AND FA.DATE >= NOW() - INTERVAL '1 year' AND FA.FOLDER_ID = ANY($1)
                                GROUP BY (FA.user->>'id')::varchar, FA.FOLDER_ID
                            ) AS X
                ) AS ytd`,
                [spaceIds]
            );

            for (const space of spaces) {
                if (favouriteSet.has(space.id.toString())) {
                    const value: {
                        folderCount?: boolean;
                        favouriteFolders?: FolderTreeDto[];
                        taskCount?: number;
                    } = favouriteSet.get(space.id.toString());

                    //Construct Space Favourite Folders Tree
                    const tree: FolderTreeDto[] = listToTree<FolderTreeDto>(
                        value.favouriteFolders,
                        'path_ids',
                        (x: FolderTreeDto) => {
                            const ret = x.path_ids;
                            ret?.splice(-1);
                            return ret?.join(',');
                        },
                        'children'
                    );

                    modifyTree(
                        tree,
                        (x: FolderTreeDto) => {
                            delete x.path_ids;
                        },
                        'children'
                    );
                    space.folderCount = value.folderCount;
                    space.favouriteFolders = tree;
                    space.taskCount = value.taskCount;
                    if (spaceActivity && spaceActivity[0] && spaceActivity[0].mtd && Array.isArray(spaceActivity[0].mtd)) {
                        space.mtdCount = spaceActivity[0]?.mtd
                            .filter((f) => f.folder_id === space.id)
                            .map((m) => ({userId: m.user_id, visits: m.visits}));
                    }
                    if (spaceActivity && spaceActivity[0] && spaceActivity[0].ytd && Array.isArray(spaceActivity[0].ytd)) {
                        space.ytdCount = spaceActivity[0]?.ytd
                            .filter((f) => f.folder_id === space.id)
                            .map((m) => ({userId: m.user_id, visits: m.visits}));
                    }
                } else {
                    // Defaults if the space is not found in the favouriteSet
                    space.folderCount = 0;
                    space.favouriteFolders = [];
                    space.taskCount = 0;
                    space.mtdCount = [];
                    space.ytdCount = [];
                }
            }

            return spaces;
        } catch (error) {
            this.logger.error(`An error occurred while getting all space`, error);
            throw error;
        }
    }

    /**
     * Deletes a space and its associated data.
     *
     * @param {number} spaceId - The ID of the space to delete.
     * @param {string} userId - The ID of the user performing the deletion.
     * @return {Promise<void>} - A promise that resolves once the space is deleted.
     * @throws {Error} - If an error occurs while deleting the space.
     */
    @Transactional()
    async deleteOneSpace(spaceId: number, userId: string): Promise<void> {
        try {
            const repoFolderSpaceTeams = this.repo.manager.getRepository<FolderSpaceTeamEntity>(FolderSpaceTeamEntity),
                repoFolderSpaceWorkflows = this.repo.manager.getRepository<FolderSpaceWorkflowEntity>(FolderSpaceWorkflowEntity),
                repoFolderSpaceCustomFieldsCollections = this.repo.manager.getRepository<FolderSpaceCustomFieldCollectionEntity>(
                    FolderSpaceCustomFieldCollectionEntity
                ),
                repoFolderTagsCollections =
                    this.repo.manager.getRepository<FolderSpaceTagsCollectionEntity>(FolderSpaceTagsCollectionEntity);

            //** delete teams relation with a space */
            //** Todo : Revoke all permissions from the teams */
            await repoFolderSpaceTeams.delete({Folder: {id: spaceId}});

            //** delete workflows relation with a space */
            await repoFolderSpaceWorkflows.delete({Folder: {id: spaceId}});

            //** delete custom fields collection relation with a space */
            await repoFolderSpaceCustomFieldsCollections.delete({Folder: {id: spaceId}});

            //** delete tags relation with a space */
            await repoFolderTagsCollections.delete({Folder: {id: spaceId}});

            //** delete space from folder entity */
            return this.folderService.deleteFolder(spaceId, userId, [FolderTypeOptions.SPACE]);
        } catch (error) {
            this.logger.error(`An error occurred while deleting a space with id : ${spaceId}`, error);
            throw error;
        }
    }

    /**
     * Retrieves a space by its ID, filtered by the specified showOn and userId
     *
     * @param {number} spaceId - The ID of the space to retrieve
     * @param {string} showOn - The showOn value to filter the result by
     * @param {string} userId - The userId value to filter the result by
     * @returns {Promise<GetSpaceDto>} - The space data
     * @throws {Error} - If an error occurs while retrieving the space
     */
    async getOneSpaceById(spaceId: number, showOn: string, userId: string): Promise<GetSpaceDto> {
        try {
            const sql = queries.folder.concat(
                ` WHERE (F.ID = $2) AND ($3 = ANY (F.SHOW_ON)) AND (F.deleted_at IS NULL) AND F.folder_type = 'space'`
            );
            const result = await this.repo.query(sql, [userId, spaceId, showOn]);

            //** Test with empty list of teams and members */
            const members = this.filterMembersNotInAnyTeam(result[0].teams, result[0].members);

            if (result.length) {
                const responseData = {
                    ...result[0],
                    customFields: result[0].customFields.filter(
                        (field) => field.CustomFieldDefinition.userId === userId || field.CustomFieldDefinition.userId === null
                    ),
                    members,
                };
                if (responseData.pictureUrl) {
                    responseData['pictureUrl'] = await this.s3Service.getSignedFileUrl(responseData.pictureUrl, {expiresIn: 3600});
                }
                return responseData;
            }
            return null;
        } catch (error) {
            this.logger.error(`An error occurred while getting the space`, error);
            throw error;
        }
    }

    // async getSpaceStats(spaceId: number, showOn: string): Promise<SpaceStatsDto> {
    //     try {
    //         const folder_ids = await this.repo.query(
    //             `WITH RECURSIVE child_folders AS (
    //                 SELECT fr.child_folder_id
    //                 FROM folder_relation fr
    //                 INNER JOIN folder f ON f.id = fr.child_folder_id AND fr.is_bind = false and $2 = ANY(f.show_on)
    //                 WHERE fr.parent_folder_id = $1
    //                 UNION ALL
    //                 SELECT fr.child_folder_id
    //                 FROM folder_relation fr
    //                 INNER JOIN folder f ON f.id = fr.child_folder_id AND fr.is_bind = false and $2 = ANY(f.show_on)
    //                 INNER JOIN child_folders cf ON fr.parent_folder_id = cf.child_folder_id
    //             )
    //             SELECT child_folder_id
    //             FROM child_folders`,
    //             [spaceId, showOn]
    //         );
    //         const ids = folder_ids.map((folder) => folder.child_folder_id);
    //         const sql = `SELECT
    //                         COUNT(CASE WHEN SS.code = 'Active' THEN 1 ELSE NULL END)::integer AS "active",
    //                         COUNT(CASE WHEN SS.code = 'Completed' THEN 1 ELSE NULL END)::integer AS "completed",
    //                         COALESCE(AVG(CASE WHEN SS.code = 'Active' THEN DATE_PART('days',CURRENT_TIMESTAMP - T.CREATED_AT) ELSE NULL END)::integer,0) AS "averageActive",
    //                         COUNT(CASE WHEN A.status = 'PENDING' THEN 1 ELSE NULL END)::integer AS "pendingApprovals"
    //                         FROM FOLDER F
    //                         INNER JOIN TASK_RELATION TR ON TR.FOLDER_ID = F.ID
    //                         INNER JOIN WORKFLOW_STATE WS ON TR.WORKFLOW_STATE_ID = WS.ID
    //                         INNER JOIN TASK T ON T.ID = TR.CHILD_TASK_ID
    //                         LEFT JOIN APPROVAL A ON T.ID = A.TASK_ID
    //                         LEFT JOIN DISPLACEMENT_CODE DC ON WS.DISPLACEMENT_CODE_ID = DC.ID
    //                         INNER JOIN SYSTEM_STAGE SS ON WS.SYSTEM_STAGE_ID = SS.ID OR SS.ID = DC.SYSTEM_STAGE_ID
    //                     WHERE F.ID = ANY($1)`;
    //         const result = await this.repo.query(sql, [ids]);
    //
    //         return result;
    //     } catch (error) {
    //         this.logger.error(`An error occurred while getting the space`, error);
    //         throw error;
    //     }
    // }

    /**
     * Retrieves space statistics based on the space ID and showOn filter.
     *
     * @param {number} spaceId - The ID of the space.
     * @param {string} showOn - The filter string to determine the showOn condition.
     * @return {Promise<SpaceStatsDto>} A promise that resolves to the space statistics.
     * @throws {Error} If an error occurs while retrieving the space statistics.
     */
    async getSpaceStats(spaceId: number, showOn: string): Promise<SpaceStatsDto> {
        try {
            const folder_ids = await this.repo.query(
                `WITH RECURSIVE child_folders AS (
                    SELECT fr.child_folder_id
                    FROM folder_relation fr
                    INNER JOIN "${RawDatabaseConfig.schema}".folder f ON f.id = fr.child_folder_id AND fr.is_bind = false and $2 = ANY(f.show_on)
                    WHERE fr.parent_folder_id = $1
                    UNION ALL
                    SELECT fr.child_folder_id
                    FROM "${RawDatabaseConfig.schema}".folder_relation fr
                    INNER JOIN "${RawDatabaseConfig.schema}".folder f ON f.id = fr.child_folder_id AND fr.is_bind = false and $2 = ANY(f.show_on)
                    INNER JOIN child_folders cf ON fr.parent_folder_id = cf.child_folder_id
                )
                SELECT child_folder_id
                FROM child_folders`,
                [spaceId, showOn]
            );
            const ids = folder_ids.map((folder) => folder.child_folder_id);
            const sql = `SELECT
                            COUNT(CASE WHEN SS.code = 'Active' AND T.ARCHIVED_AT IS NULL AND T.DELETED_AT IS NULL THEN 1 ELSE NULL END)::integer AS "active",
                            COUNT(CASE WHEN SS.code = 'Completed' AND T.ARCHIVED_AT IS NULL AND T.DELETED_AT IS NULL THEN 1 ELSE NULL END)::integer AS "completed",
                            COALESCE(AVG(CASE WHEN SS.code = 'Active' THEN DATE_PART('days',CURRENT_TIMESTAMP - T.CREATED_AT) ELSE NULL END)::integer,0) AS "averageActive",
                            COUNT(CASE WHEN A.status = 'PENDING' THEN 1 ELSE NULL END)::integer AS "pendingApprovals",
                            COUNT(CASE WHEN A.status = 'APPROVED' OR A.status = 'REJECTED' THEN 1 ELSE NULL END)::integer AS "completedApprovals",
                            (SELECT JSON_AGG(X) FROM
                            (
                                SELECT 
                                    "userId",
                                    COUNT(*) AS visits,
                                    MAX(FA.DATE) AS "lastAccess",
                                    (
                                        SELECT COUNT(id) 
                                        FROM"${RawDatabaseConfig.schema}".user_role 
                                        WHERE user_id::varchar = fa."userId"::varchar
                                    ) AS "teamsCount"
                                FROM (
                                    SELECT 
                                        (FA.user->>'id')::varchar AS "userId",
                                        FA.DATE
                                    FROM "${RawDatabaseConfig.schema}".folder_action FA
                                    WHERE FA.ACTION = 'visit' AND FA.DATE >= NOW() - INTERVAL '30 days' AND FA.FOLDER_ID = $1
                                ) AS fa
                                GROUP BY "userId"
                                ) AS X) as "lastActivity"
                            FROM  "${RawDatabaseConfig.schema}".FOLDER F
                            INNER JOIN  "${RawDatabaseConfig.schema}".TASK_RELATION TR ON TR.FOLDER_ID = F.ID
                            INNER JOIN "${RawDatabaseConfig.schema}".WORKFLOW_STATE WS ON TR.WORKFLOW_STATE_ID = WS.ID
                            INNER JOIN  "${RawDatabaseConfig.schema}".TASK T ON T.ID = TR.CHILD_TASK_ID
                            LEFT JOIN "${RawDatabaseConfig.schema}".APPROVAL A ON T.ID = A.TASK_ID
                            LEFT JOIN "${RawDatabaseConfig.schema}".DISPLACEMENT_CODE DC ON WS.DISPLACEMENT_CODE_ID = DC.ID
                            INNER JOIN  "${RawDatabaseConfig.schema}".SYSTEM_STAGE SS ON WS.SYSTEM_STAGE_ID = SS.ID OR SS.ID = DC.SYSTEM_STAGE_ID
                        WHERE F.ID = ANY($3) AND $2 = ANY(f.show_on)`;
            const result = await this.repo.query(sql, [spaceId, showOn, ids]);

            return result[0];
        } catch (error) {
            this.logger.error(`An error occurred while getting the space`, error);
            throw error;
        }
    }

    /**
     * Sets one space member for a given folder.
     *
     * @param {number} folderId - The ID of the folder.
     * @param {MembersDto} dto - The data transfer object containing the member details.
     * @param {JwtUserInterface} user - The authenticated user making the request.
     * @param {string} showOn - The display option for the member.
     * @param {EntityTypeOptions} entityType - The type of entity for the member.
     * @returns {Promise<void>} - A promise that resolves when the operation is complete.
     * @throws {Error} - If an error occurs while setting/updating the space members.
     */
    async setOneSpaceMember(
        folderId: number,
        dto: MembersDto,
        user: JwtUserInterface,
        showOn: string,
        entityType: EntityTypeOptions
    ): Promise<void> {
        try {
            return await this.folderService.setFolderMembersInternal(folderId, dto, user.id, showOn, entityType);
        } catch (error) {
            this.logger.error(`An error occurred while setting/updatin the space members`, error);
            throw error;
        }
    }

    /**
     * updates picture for a given space.
     *
     * @param {number} spaceId - The ID of the space.
     * @param {MembersDto} dto - The data transfer object containing the member details
     *  @param {number} userId - The ID of the user.
     * @param {string} showOn - The display option for the member.
     */
    async updateOneSpacePicture(spaceId: number, pictureUrl: string, userId: string, showOn: string): Promise<void> {
        this.logger.log('Updating one space by id');
        const space = await this.getOneSpaceById(spaceId, showOn, userId);
        if (space?.pictureUrl) {
            this.logger.log('Deleting file in S3');
            await this.s3Service.deleteFile(space.pictureUrl);
        }
        this.logger.log('Updating space profile');
        const profileImage = await this.uploadSpaceProfile(spaceId, pictureUrl);
        this.logger.log('Updating space url');
        await this.repoFolder.update(spaceId, {pictureUrl: profileImage, id: spaceId});
    }

    /**
     * Updates the tags of a space.
     *
     * @param {number} spaceId - The ID of the space to update the tags for.
     * @param {UpdateSpaceTagsDto} dto - The DTO containing the updated tags for the space.
     * @returns {Promise<void>} - A promise that resolves when the tags are successfully updated.
     * @throws {Error} - If an error occurs while setting/updating the space tags.
     */
    async updateOneSpaceTags(spaceId: number, dto: UpdateSpaceTagsDto, entityType: EntityTypeOptions): Promise<void> {
        try {
            return await this.folderService.updateFolderTags(spaceId, dto, entityType);
        } catch (error) {
            this.logger.error(`An error occurred while setting/updatin the space tags`, error);
            throw error;
        }
    }

    /**
     * Adds custom field values to a space.
     *
     * @param {number} spaceId - The ID of the space.
     * @param {CreateSpaceCustomFieldValueDto[]} dto - An array of custom field values to add.
     * @param {JwtUserInterface} user - The user making the request.
     * @returns {Promise<InsertResult>} - The result of the operation.
     * @throws {Error} - If an error occurs while setting/updating the space custom fields.
     */
    async addOneSpaceCustomFieldValues(
        spaceId: number,
        dto: CreateSpaceCustomFieldValueDto[],
        user: JwtUserInterface
    ): Promise<InsertResult> {
        try {
            return await this.folderService.addFolderCustomFieldValues(spaceId, dto, user, EntityTypeOptions.Space);
        } catch (error) {
            this.logger.error(`An error occurred while setting/updatin the space custom fields`, error);
            throw error;
        }
    }

    //** to do testing */
    /**
     * Archives the space tree.
     *
     * @param {number} spaceId - The ID of the space to archive.
     * @param {string} userId - The ID of the user performing the archive action.
     * @param {string} sanitizedToken - The sanitized token for user authentication.
     * @param {ArchiveSpaceDto} dto - The data transfer object containing additional parameters for the archive.
     * @returns {Promise<void>} - A promise that resolves when the space tree has been archived.
     * @throws {Error} - If an error occurs while trying to archive the space tree.
     */
    async archiveSpaceTree(spaceId: number, userId: string, sanitizedToken: string, dto: ArchiveSpaceDto): Promise<void> {
        try {
            return await this.folderService.archiveFolder(spaceId, userId, sanitizedToken, [FolderTypeOptions.SPACE], dto);
        } catch (error) {
            this.logger.error(`An error occurred while tries to archive the space with tree`, error);
            throw error;
        }
    }

    /**
     * Restores an archived space and its tree of children.
     *
     * @param {number} spaceId - The ID of the space to restore.
     * @return {Promise<void>} - A promise that resolves when the space and its tree of children are restored.
     * @throws {Error} - If an error occurs while restoring the space and its tree.
     */
    async restoreArchivedSpaceTree(spaceId: number, user: JwtUserInterface): Promise<void> {
        try {
            return await this.folderService.restoreArchivedFolder(spaceId, [FolderTypeOptions.SPACE], user);
        } catch (error) {
            this.logger.error(`An error occurred while tries to reture the space with childrens`, error);
            throw error;
        }
    }

    /**
     * Copies a space to another folder.
     *
     * @param {number} folderId - The ID of the space to be copied.
     * @param {number} parentFolderId - The ID of the destination folder.
     * @param {CopySpaceDto} dto - The data for the copied space.
     * @param {JwtUserInterface} user - The user performing the copy.
     * @param {string} authorization - The authorization token.
     * @param {string} showOn - A string representing where the copied space should be shown.
     * @returns {Promise<FolderEntity>} - A promise that resolves to the copied space.
     * @throws {Error} - If an error occurs while copying the space.
     */
    async copyOneSpace(
        folderId: number,
        parentFolderId: number,
        dto: CopySpaceDto,
        user: JwtUserInterface,
        authorization: string,
        showOn: string
    ): Promise<FolderEntity> {
        try {
            return await this.folderService.copyOneFolder(
                folderId,
                parentFolderId,
                dto,
                user,
                authorization,
                showOn,
                EntityTypeOptions.Space
            );
        } catch (error) {
            this.logger.error(`An error occurred while tries to copy the space with childrens`, error);
            throw error;
        }
    }

    /**
     * Marks a space as favourite for a user.
     *
     * @param {number} spaceId - The ID of the space to mark as favourite.
     * @param {string} userId - The ID of the user.
     * @return {Promise<InsertResult>} A promise that resolves to the result of the operation.
     */
    @Transactional()
    async markOneSpaceFavourite(spaceId: number, userId: string): Promise<InsertResult> {
        try {
            return await this.folderService.markFolderFavourite(spaceId, userId, [FolderTypeOptions.SPACE]);
        } catch (error) {
            this.logger.error(`An error occurred while tryinh to mark the space favourite`, error);
            throw error;
        }
    }

    /**
     * Removes the favourite mark from one space for a specific user.
     *
     * @param {number} spaceId - The ID of the space to remove the favourite mark from.
     * @param {string} userId - The ID of the user to remove the favourite mark for.
     * @return {Promise<DeleteResult>} A promise that resolves to a DeleteResult object.
     * @throws {Error} If an error occurs while removing the favourite mark.
     */
    @Transactional()
    async unmarkOneSpaceFavourite(spaceId: number, userId: string): Promise<DeleteResult> {
        try {
            return await this.folderService.unmarkFavourite(spaceId, userId);
        } catch (error) {
            this.logger.error(`An error occurred while tries to copy the space with childrens`, error);
            throw error;
        }
    }

    /**
     * Retrieves the user's favorite spaces based on the given parameters.
     *
     * @param {string} userId - The ID of the user.
     * @param {string} showOn - The type of pages the spaces should be shown on.
     *
     * @returns {Promise<SpaceFavouriteDto[]>} A promise that resolves to an array of objects representing the user's favorite spaces. Each object contains the ID and title of a space.
     *
     * @throws {Error} if an error occurs while retrieving the favorite spaces.
     */
    async getFavouriteSpaces(userId: string, showOn: string): Promise<SpaceFavouriteDto[]> {
        try {
            return await this.folderService.getFavourites(userId, showOn, [FolderTypeOptions.SPACE]);
        } catch (error) {
            this.logger.error(`An error occurred while tries to copy the space with childrens`, error);
            throw error;
        }
    }

    /**
     * An asynchronous method for updating the position of a space in the system.
     *
     * @param {number} spaceId - The ID of the space to update.
     * @param {UpdateSpacePositionDto} dto - The data transfer object containing the updated position information.
     * @param {JwtUserInterface} user - The user performing the update action.
     * @returns {Promise<void>} - A Promise that resolves when the space position update is completed.
     * @throws {Error} - If there was an error moving the space.
     */
    @Transactional()
    async updateOneSpacePosition(
        spaceId: number,
        dto: UpdateSpacePositionDto,
        user: JwtUserInterface,
        entityType: EntityTypeOptions
    ): Promise<void> {
        try {
            return await this.folderService.updateFolderOnePosition(spaceId, dto, user, entityType);
        } catch (e) {
            this.logger.error(`There was an error moving a space ${spaceId} - [${JSON.stringify(dto)}]`);
            this.logger.error(e);
            throw e;
        }
    }

    /**
     * An asynchronous method for updating the position of a favourite space in the system.
     *
     * @param {number} spaceId - The ID of the space to update.
     * @param {UpdateSpacePositionDto} dto - The data transfer object containing the updated position information.
     * @param {JwtUserInterface} user - The user performing the update action.
     * @returns {Promise<void>} - A Promise that resolves when the space position update is completed.
     * @throws {Error} - If there was an error moving the space.
     */
    @Transactional()
    async updateFavouriteSpacePosition(spaceId: number, dto: UpdateSpacePositionDto, user: JwtUserInterface): Promise<void> {
        try {
            // fix index on task relation
            const repoFolderFavouriteRelation = this.repo.manager.getRepository(FolderFavouriteEntity);
            const oldRecord = await repoFolderFavouriteRelation.findOne({where: {folderId: spaceId, userId: user.id}});
            await repoFolderFavouriteRelation.update({folderId: spaceId, userId: user.id}, {index: dto.index});
            // case 1
            if (dto.index === 0) {
                const sql = `UPDATE "${RawDatabaseConfig.schema}".folder_favourite
               SET index = sub.row_num
               FROM (SELECT id, (row_number() over (order by (index))) as row_num, folder_id, index
                     FROM "${RawDatabaseConfig.schema}".folder_favourite
                     WHERE folder_id != $1
                       AND user_id = $2
                     order by index) as sub
               where "${RawDatabaseConfig.schema}".folder_favourite.id = sub.id`;
                return await repoFolderFavouriteRelation.query(sql, [spaceId, user.id]);
            }
            if (dto.index > oldRecord.index && dto.index !== 0) {
                // case 2
                const sql = `UPDATE "${RawDatabaseConfig.schema}".folder_favourite
               SET INDEX = INDEX - 1
               WHERE ID IN (SELECT ID
                            FROM "${RawDatabaseConfig.schema}".folder_favourite
                            WHERE FOLDER_ID != $1
                              AND INDEX <= $2
                              AND INDEX > $3
                              AND user_id = $4
                   )`;
                return await repoFolderFavouriteRelation.query(sql, [spaceId, dto.index, oldRecord.index, user.id]);
            }
            if (oldRecord.index > dto.index && dto.index !== 0) {
                // case 3
                const sql = `UPDATE "${RawDatabaseConfig.schema}".folder_favourite
               SET INDEX = INDEX + 1
               WHERE ID IN (SELECT ID
                            FROM "${RawDatabaseConfig.schema}".folder_favourite
                            WHERE FOLDER_ID != $1
                              AND INDEX < $2
                              AND INDEX >= $3
                              AND user_id = $4
                   )`;
                return await repoFolderFavouriteRelation.query(sql, [spaceId, dto.index, oldRecord.index, user.id]);
            }
        } catch (e) {
            this.logger.error(`There was an error moving a space ${spaceId} - [${JSON.stringify(dto)}]`);
            this.logger.error(e);
            throw e;
        }
    }

    /**
     * Uploads a space profile image to the server.
     *
     * @param {number} spaceId - The ID of the space where the profile image will be uploaded.
     * @param {string} file - The base64 encoded string of the profile image.
     * @returns {Promise<string>} - The uploaded file name.
     * @throws {Error} - If there was an error uploading the file.
     */
    private async uploadSpaceProfile(spaceId: number, file: string): Promise<string> {
        try {
            let fileName = null;
            const previewUrl = base64Toimage(file);
            const imageData = Buffer.from(previewUrl, 'base64');
            fileName = `${this.SPACE}/${spaceId}/profile.png`;
            await this.s3Service.uploadFile(imageData, fileName);
            return fileName;
        } catch (e) {
            this.logger.error(`There was an error uploading file of a space`, JSON.stringify(e));
            throw e;
        }
    }

    /**
     * Creates pagination object based on the given pagination parameters.
     *
     * @param {PaginationDto} pagination - The pagination parameters to create the pagination object.
     * @return {PaginationDto} - The created pagination object.
     */
    private createPagination(pagination: PaginationDto): PaginationDto {
        if (pagination) {
            return {offset: pagination.offset * pagination.limit, limit: pagination.limit};
        }
        return {offset: 0, limit: 100};
    }

    /**
     * Get an space from a folder ID
     *
     *@param {parent_folder_id, child_folder_id}
     *@return {FolderEntity} - string
     */
    protected async getSpaceFromFolderId(folder_id: number, includeArchivedAndDeleted: boolean): Promise<number> {
        if (!folder_id) return null;

        let sql = `--sql
        WITH RECURSIVE FOLDERS AS
        (
            SELECT F.ID,
                FR.PARENT_FOLDER_ID,
                FR.CHILD_FOLDER_ID
            FROM "${RawDatabaseConfig.schema}".FOLDER F
            INNER JOIN "${RawDatabaseConfig.schema}".FOLDER_RELATION FR ON F.ID = FR.CHILD_FOLDER_ID
            WHERE F.ID = $1
            AND F.archived_by IS NULL and f.deleted_by IS NULL

            UNION ALL

            SELECT F.ID,
                FR.PARENT_FOLDER_ID,
                FR.CHILD_FOLDER_ID
            FROM "${RawDatabaseConfig.schema}".FOLDER F
            INNER JOIN "${RawDatabaseConfig.schema}".FOLDER_RELATION FR ON F.ID = FR.CHILD_FOLDER_ID
            INNER JOIN FOLDERS FS ON FS.PARENT_FOLDER_ID = F.ID `;

        if (!includeArchivedAndDeleted) {
            sql += `WHERE F.archived_by IS NULL and f.deleted_by IS NULL`;
        }

        sql += `)
        SELECT F.id
        FROM "${RawDatabaseConfig.schema}".FOLDER F
        INNER JOIN FOLDERS FS ON FS.CHILD_FOLDER_ID = F.ID
        WHERE FS.PARENT_FOLDER_ID IS NULL
    `;

        const spaceID = await this.repo.query(sql, [folder_id]);
        return spaceID[0]?.id ?? null;
    }

    filterMembersNotInAnyTeam(teams: ResponseTeamDto[], members: ResponseMembersDto[]): ResponseMembersDto[] {
        const teamMemberIds = new Set();

        if (teams?.length && members?.length) {
            teams?.forEach((team) => {
                team.members.forEach((member) => {
                    teamMemberIds.add(member.id);
                });
            });

            // Filter members who are not in the set
            return members?.filter((member) => !teamMemberIds.has(member.userId));
        }
        return members;
    }

    /**
     * Changes the owner of a space.
     *
     * @param {number} spaceId - The ID of the space to change the owner of.
     * @param {string} newOwnerId - The ID of the new owner.
     * @param {JwtUserInterface} user - The user initiating the change.
     * @param {ChangeOwnerDto} dto - The data transfer object containing additional information.
     * @param {string} showOn - The show-on type for the space.
     * @returns {Promise<void>} A promise that resolves when the owner is changed successfully.
     */
    async changeSpaceOwner(
        spaceId: number,
        newOwnerId: string,
        user: JwtUserInterface,
        dto: ChangeOwnerDto,
        showOn: string
    ): Promise<void> {
        return await this.folderService.changeOwnerOfAFolder(spaceId, newOwnerId, user.id, dto, showOn, EntityTypeOptions.Space);
    }
}
