import {EntityManager, In, Repository} from 'typeorm';
import {BadRequestException, ForbiddenException, NotFoundException} from '@nestjs/common';
import {JwtUserInterface, VALID_SOURCE_NAMES, listToTree} from '@lib/base-library';
import {FolderEntity} from '../model/folder.entity';
import {UserPermissionOptions} from '../enum/folder-user.enum';
import {FolderViewTypeOptions} from '../enum/folder.enum';
import {TaskEntity} from '../model/task.entity';
import {ImportanceEntity} from '../model/importance.entity';
import {RelationTypeOptions} from '../enum/folder-task-predecessor.enum';
import {FileTypeOptions} from '../enum/task-action.enum';
import {CustomFieldDefinitionTypeOptions} from '../enum/custom-field-definition.enum';
import {Format} from './format';
import {RawDatabaseConfig} from '../config/database.config';
import {queries} from '../recursive-queries';
import {FolderTreeDto} from '../dto/folder/folder/folder-tree.dto';

/**
 * Validate the user has permissions on folders
 * @returns true if user has permission on all folders, throw exception otherwise
 * @param repoFolder FolderEntity repository
 * @param folder_ids Folders ids
 * @param user User
 * @param userPermissions User permissions to check
 */
export async function validateUserPermissionsOnFolders(
    repoFolder: Repository<FolderEntity>,
    folder_ids: number[],
    userId: string,
    _userPermissions: UserPermissionOptions[]
): Promise<boolean> {
    const query = repoFolder
        .createQueryBuilder('Folder')
        // .leftJoinAndSelect('Folder.Owner', 'Owner')
        .leftJoinAndSelect('Folder.Members', 'Members')
        // .leftJoinAndSelect('Members.User', 'User')
        .where('Folder.archived_at IS NULL')
        .andWhere('Folder.deleted_at IS NULL')
        .andWhere({id: In(folder_ids)});
    const folderEntities = await query.getMany();

    if (!folderEntities) {
        throw new NotFoundException(`Folders ${folder_ids} not found`);
    }
    // validate quantity
    if (folderEntities.length !== folder_ids.length) {
        throw new NotFoundException(`Some folders ${folder_ids} were not found`);
    }
    // verify user permissions
    for (const folderEntity of folderEntities) {
        if (folderEntity.viewType === FolderViewTypeOptions.PRIVATE) {
            if (folderEntity.userId /*Owner.id*/ !== userId) {
                throw new ForbiddenException(`The user don't have permissions to the folder ${folderEntity.id}`);
            }
        }
    }
    return true;
}

export const validateFolderTaskPermission = async (task_id: number, user: JwtUserInterface, manager: EntityManager): Promise<boolean> => {
    // get task parents
    const sql = `WITH RECURSIVE TASKS AS
                                    (SELECT T.ID,
                                            TR.PARENT_TASK_ID,
                                            TR.CHILD_TASK_ID
                                     FROM TASK T
                                              INNER JOIN TASK_RELATION TR ON T.ID = TR.CHILD_TASK_ID
                                     WHERE T.ID = $1
                                       AND T.ARCHIVED_AT IS NULL AND T.DELETED_AT IS NULL
                                     UNION ALL
                                     SELECT T.ID,
                                            TR.PARENT_TASK_ID,
                                            TR.CHILD_TASK_ID
                                     FROM TASK T
                                              INNER JOIN TASK_RELATION TR ON T.ID = TR.CHILD_TASK_ID
                                              INNER JOIN TASKS TS ON TS.PARENT_TASK_ID = T.ID
                                     WHERE T.ARCHIVED_AT IS NULL AND T.DELETED_AT IS NULL)
                 SELECT EXISTS
                            (SELECT *
                             FROM TASKS TS
                                      INNER JOIN TASK_RELATION TR ON TS.ID = TR.CHILD_TASK_ID
                                      INNER JOIN FOLDER F
                                                 ON TR.FOLDER_ID = F.ID
                                                     AND TR.FOLDER_ID = F.ID
                                                     AND F.archived_by IS NULL
                                                     AND (F.USER_ID = $2 OR
                                                          EXISTS(SELECT 1
                                                                 FROM folder_user_ap FU
                                                                 WHERE FU.FOLDER_ID = F.ID
                                                                  AND FU.ENTITY_TYPE = 'folder'
                                                                   AND FU.USER_ID = $2
                                                                   AND FU."userPermission" = ANY ($3))))`,
        ret = await manager.query(sql, [
            task_id,
            user.id,
            [UserPermissionOptions.FULL, UserPermissionOptions.EDITOR, UserPermissionOptions.READONLY],
        ]);
    return ret[0].exists;
};

export async function checkForFolderLoop(
    repoFolder: Repository<FolderEntity>,
    parent_folder_id: number,
    child_folder_id: number
): Promise<boolean> {
    const sql = `WITH RECURSIVE FOLDERS AS
                                    (SELECT F.ID,
                                            FR.PARENT_FOLDER_ID,
                                            FR.CHILD_FOLDER_ID
                                     FROM FOLDER F
                                              INNER JOIN FOLDER_RELATION FR ON F.ID = FR.CHILD_FOLDER_ID
                                     WHERE F.ID = $1
                                       AND F.archived_by IS NULL
                                     UNION ALL
                                     SELECT F.ID,
                                            FR.PARENT_FOLDER_ID,
                                            FR.CHILD_FOLDER_ID
                                     FROM FOLDER F
                                              INNER JOIN FOLDER_RELATION FR ON F.ID = FR.CHILD_FOLDER_ID
                                              INNER JOIN FOLDERS FS ON FS.PARENT_FOLDER_ID = F.ID
                                     WHERE F.archived_by IS NULL)
                 SELECT EXISTS (
                            SELECT 1
                            FROM FOLDERS
                            WHERE PARENT_FOLDER_ID = $2) AS RESULT`,
        folderChain = await repoFolder.query(sql, [parent_folder_id, child_folder_id]);
    return folderChain[0].exists;
}

export async function checkForFolderLoopV2(
    repoFolder: Repository<FolderEntity>,
    spaceId: number,
    userId: string,
    parentFolderId: number,
    folderId: number
): Promise<boolean> {
    if (parentFolderId === folderId) return true;

    const sql = `
        SELECT
            F.id,
            F.title,
            RECUR.parent_folder_id,
            RECUR.is_bind AS "isBind",
            (SELECT JSON_AGG(json_build_object('title', F2.title, 'type', F2.folder_type,'color',F2.color)) AS pathDetails
            FROM "${RawDatabaseConfig.schema}".folder F2
            WHERE F2.id = ANY(FR.path_ids)) AS "pathString",
            ARRAY_TO_STRING(RECUR.path, ',') AS path
        FROM (${queries.folderTree([spaceId])}) AS RECUR
        INNER JOIN "${RawDatabaseConfig.schema}".folder F ON RECUR.id = F.id
        INNER JOIN "${RawDatabaseConfig.schema}".folder_relation FR ON FR.id = RECUR.fr_id
        LEFT  JOIN "${RawDatabaseConfig.schema}"."folder_position" FP ON FP.folder_relation_id = RECUR.fr_id AND FP.user_id = $1
        AND F.archived_at IS NULL 
        AND F.deleted_at IS NULL 
        AND F.id = $2
        AND (RECUR.is_bind = TRUE OR RECUR.parent_folder_id = $2) 
        AND RECUR.parent_folder_id = $3
        ORDER BY RECUR.depth, FP.index
     `;
    const folders = await repoFolder.query(sql, [userId, folderId, parentFolderId]);

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

    // make all the isBind values of sub-folders of a bind folder to true
    const fixBindFolders = (tree: FolderTreeDto): FolderTreeDto => {
        if (tree.isBind) {
            return updateBindedFolderChildren(tree);
        }
        if (tree.children?.length) {
            return {
                ...tree,
                children: tree.children.map((child) => fixBindFolders(child)),
            };
        }
        return tree;
    };

    const updateBindedFolderChildren = (tree: FolderTreeDto): FolderTreeDto => {
        const fixedTree = {
            ...tree,
            isBind: true,
        };

        if (tree.children?.length) {
            return {
                ...fixedTree,
                children: tree.children.map((child) => updateBindedFolderChildren(child)),
            };
        }
        return fixedTree;
    };

    // find if the bind folderId existed in the tree
    const findBindFolderInHierarchyWithId = (folderTree: FolderTreeDto[], id: number): FolderTreeDto | null => {
        if (!folderTree?.length) return null;
        for (const tree of folderTree) {
            if (id === tree.id && tree.isBind) {
                return tree;
            }
            if (tree.children?.length) {
                const found = findBindFolderInHierarchyWithId(tree.children, id);
                if (found !== null) {
                    return found;
                }
            }
        }
        return null;
    };

    // find if the unbind folderId existed in the tree
    const findUnBoundFolderInHierarchyWithId = (folderTree: FolderTreeDto[], id: number): FolderTreeDto | null => {
        if (!folderTree?.length) return null;
        for (const tree of folderTree) {
            if (id === tree.id && !tree.isBind) {
                return tree;
            }
            if (tree.children?.length) {
                const found = findUnBoundFolderInHierarchyWithId(tree.children, id);
                if (found !== null) {
                    return found;
                }
            }
        }
        return null;
    };

    const fixedFolderTree = fixBindFolders(folderTree[0]);
    const foundUnBoundFolder = findUnBoundFolderInHierarchyWithId(fixedFolderTree.children, folderId);
    const foundParentInUnBoundFolder =
        findUnBoundFolderInHierarchyWithId(foundUnBoundFolder.children, parentFolderId) ||
        findBindFolderInHierarchyWithId(foundUnBoundFolder.children, parentFolderId);

    // check if there is a bind copy of the parent exsited in the tree of the folder
    if (foundParentInUnBoundFolder) {
        return true;
    }

    const foundBindParent = findBindFolderInHierarchyWithId(fixedFolderTree.children, parentFolderId);

    const foundBindCopy = findBindFolderInHierarchyWithId(fixedFolderTree.children, folderId);

    // check if the folder has the same parent as it's bind copy
    if (foundBindCopy && foundBindCopy.parent_folder_id === parentFolderId) return true;

    // check if the folder contains any bind copy in the parent's tree and vice versa
    const loop =
        findBindFolderInHierarchyWithId(foundBindParent?.children, folderId) ||
        findBindFolderInHierarchyWithId(foundBindCopy?.children, parentFolderId);

    return loop ? true : false;
}

export async function checkForTaskLoop(repoTask: Repository<TaskEntity>, parent_task_id: number, child_task_id: number): Promise<boolean> {
    const sql = `WITH RECURSIVE TASKS AS
                                    (SELECT T.ID,
                                            TR.PARENT_TASK_ID,
                                            TR.CHILD_TASK_ID
                                     FROM TASK T
                                              INNER JOIN TASK_RELATION TR ON T.ID = TR.CHILD_TASK_ID
                                     WHERE T.ID = $1
                                       AND T.ARCHIVED_AT IS NULL AND T.DELETED_AT IS NULL
                                     UNION ALL
                                     SELECT T.ID,
                                            TR.PARENT_TASK_ID,
                                            TR.CHILD_TASK_ID
                                     FROM TASK T
                                              INNER JOIN TASK_RELATION TR ON T.ID = TR.CHILD_TASK_ID
                                              INNER JOIN TASKS TS ON TS.PARENT_TASK_ID = T.ID
                                     WHERE T.ARCHIVED_AT IS NULL AND T.DELETED_AT IS NULL)
                 SELECT EXISTS
                            (
                                SELECT *
                                FROM TASKS
                                WHERE PARENT_TASK_ID = $2) AS RESULT`,
        taskChain = await repoTask.query(sql, [parent_task_id, child_task_id]);
    return taskChain[0].exists;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const getImportance = (importancesDB: ImportanceEntity[], priority: string): ImportanceEntity => {
    let ret = importancesDB.find((x) => x.description === priority);
    if (!ret) {
        ret = importancesDB.find((x) => x.default);
    }
    return ret;
};

export const getRelationType = (str: string): RelationTypeOptions => {
    switch (str) {
        case 'SS':
            return RelationTypeOptions.START_TO_START;
        case 'SF':
            return RelationTypeOptions.START_TO_FINISH;
        case 'FS':
            return RelationTypeOptions.FINISH_TO_START;
        case 'FF':
            return RelationTypeOptions.FINISH_TO_FINISH;
        default:
            return RelationTypeOptions.FINISH_TO_START;
    }
};

export function readFileType(file: Express.Multer.File): FileTypeOptions {
    let fileType: FileTypeOptions;

    if (file.mimetype.includes('image')) fileType = FileTypeOptions.IMAGE;
    else if (file.mimetype.includes('video')) fileType = FileTypeOptions.MEDIA;
    else if (file.mimetype.includes('zip')) fileType = FileTypeOptions.ZIP;
    else if (file.mimetype.includes('document') || file.mimetype.includes('application') || file.mimetype.includes('text'))
        fileType = FileTypeOptions.DOCUMENTS;
    else fileType = FileTypeOptions.OTHER;

    return fileType;
}

export function validateSource(source: string): void {
    if (typeof source !== 'string' || source.trim() === '' || !VALID_SOURCE_NAMES.includes(source)) {
        throw new BadRequestException(
            `Source cannot be a empty string and it should one of the valid source names : ${VALID_SOURCE_NAMES}`
        );
    }
    return;
}

export function validateCustomFieldValue(type: string, value: string): void {
    switch (type) {
        case CustomFieldDefinitionTypeOptions.EMAIL: {
            if (value && !Format.isValidEmail(value)) {
                throw new BadRequestException(`Custom field value for ${type} is invalid`);
            }
            break;
        }
        case CustomFieldDefinitionTypeOptions.WEBSITE: {
            if (value && !Format.isValidWebsite(value)) {
                throw new BadRequestException(`Custom field value for ${type} is invalid`);
            }
            break;
        }
        case CustomFieldDefinitionTypeOptions.RATING:
        case CustomFieldDefinitionTypeOptions.NUMERIC:
        case CustomFieldDefinitionTypeOptions.DURATION:
        case CustomFieldDefinitionTypeOptions.PERCENTAGE:
        case CustomFieldDefinitionTypeOptions.CURRENCY: {
            if (value && !Format.isValidNumber(value)) {
                throw new BadRequestException(`Custom field value for ${type} is invalid`);
            }
            break;
        }
        default:
            break;
    }
}

export function capitalizeLowerCaseString(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
export function arrayToString(arr: string[]): string {
    return arr.join(', ');
}
