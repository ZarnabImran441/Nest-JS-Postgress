import {JoinColumn, ManyToOne, ViewColumn, ViewEntity} from 'typeorm';
import {UserPermissionOptions} from '../enum/folder-user.enum';
import {FolderEntity} from './folder.entity';

/**
 * Represents a view entity for folder user permissions.
 *
 * @class FolderUserViewEntity
 * @viewEntity folder_user_ap
 */
@ViewEntity('folder_user_ap', {
    expression: `SELECT assigned_permission.id, assigned_permission.user_id::uuid AS user_id, assigned_permission.id AS entity_type
                CASE
                    WHEN (assigned_permission.permissions & 16::bigint) > 0 AND (assigned_permission.permissions & 128::bigint) = 0 AND (assigned_permission.permissions & 64::bigint) = 0 THEN 'read-only'::text
                    WHEN (assigned_permission.permissions & 128::bigint) > 0 AND (assigned_permission.permissions & 64::bigint) = 0 THEN 'editor'::text
                    WHEN (assigned_permission.permissions & 64::bigint) > 0 THEN 'full'::text
                    ELSE NULL::text
                END AS user_permission,
                assigned_permission.inherited AS inherit,
                assigned_permission.entity_id::integer AS folder_id
          FROM assigned_permission
          WHERE assigned_permission.user_id IS NOT NULL`,
})
export class FolderUserViewEntity {
    @ViewColumn()
    id: number;

    /******************************************/
    @ManyToOne(() => FolderEntity, (item) => item.Members, {nullable: false})
    @JoinColumn({name: 'folder_id', referencedColumnName: 'id'})
    Folder: FolderEntity;
    /******************************************/

    @ViewColumn({name: 'folder_id'})
    folderId: number;

    @ViewColumn({name: 'user_id'})
    userId: string;

    @ViewColumn({name: 'entity_type'})
    entityType: string;

    @ViewColumn({name: 'user_permission'})
    userPermission: UserPermissionOptions;

    @ViewColumn()
    inherit: boolean;
}
