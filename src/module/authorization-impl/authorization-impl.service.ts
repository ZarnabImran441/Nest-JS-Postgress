import {Inject, Injectable, Logger} from '@nestjs/common';
import {
    AbstractAuthorizationService,
    contructorLogger,
    HIERARCHY_QUERIES,
    HierarchyQueries,
    IdType,
    isNullOrUndefined,
    IsUserAuthorizedToDoType,
    JwtPayloadInterface,
    toStringSafe,
} from '@lib/base-library';
import {DataSource, DeleteResult, InsertResult, IsNull, Repository, SelectQueryBuilder, UpdateResult} from 'typeorm';
import {DefaultPermissonsOptions, EntityTypeOptions, PermissionOptions} from './authorization.enum';
import {AssignedPermissionEntity} from '../../model/assigned-permission.entity';
import {RoleEntity} from '../../model/role.entity';
import {UserRoleEntity} from '../../model/user-role.entity';
import {Transactional} from 'typeorm-transactional';
import {InjectRepository} from '@nestjs/typeorm';

/**
 * Permissions in the table assigned_permission will consist of a row with inherited=FALSE to store the permissions set intentionally
 * for a specific entity and another row with inherited=TRUE that will contain the aggregated permissions of the parent if the value
 *
 * is greater than zero/NONE.
 *
 * Banned permission: it's possible to ban a user permission or a user role permission. It'll ban the whole permission.
 * It's not possible to ban a specific permission, like "ban read permission on task".
 */
@Injectable()
export class AuthorizationImplService implements AbstractAuthorizationService {
    private logger: Logger;

    constructor(
        @InjectRepository(AssignedPermissionEntity) private readonly repoAssignedPermission: Repository<AssignedPermissionEntity>,
        @InjectRepository(RoleEntity) private readonly repoRole: Repository<RoleEntity>,
        @InjectRepository(UserRoleEntity) private readonly repoUserRole: Repository<UserRoleEntity>,
        @Inject(HIERARCHY_QUERIES) private readonly hierarchyQueries: HierarchyQueries
    ) {
        this.logger = new Logger(this.constructor.name);
        contructorLogger(this);
    }

    getUserAuthorizedPermissionFunction(user: JwtPayloadInterface): IsUserAuthorizedToDoType {
        return (async (permission: PermissionOptions, entityType: EntityTypeOptions, entityId: string | number): Promise<boolean> => {
            return await this.getUserHasPermissions(user.id, permission, entityType, entityId);
        }) as IsUserAuthorizedToDoType;
    }

    async getUserHasPermissions(
        userId: string,
        permission: PermissionOptions,
        entityType: EntityTypeOptions,
        entityId: string | number
    ): Promise<boolean> {
        const query = this.getUserAuthorizePermissionQueryBuilder(userId, permission, entityType, toStringSafe(entityId));
        const count = await query.getCount();
        const isAllowed = count > 0;
        if (!isAllowed) {
            // breakpoint here to see which endpoint rejected this access by policy
            this.logger.verbose(
                `Access Denied to user ${userId} on entityType ${entityType}, entityId ${entityId}, permission ${permission}`
            );
        }
        return isAllowed;
    }

    async checkUsersHasPermissionsOnEntity(
        userIds: string[],
        permission: PermissionOptions,
        entityType: EntityTypeOptions,
        entityId: string | number
    ): Promise<{id: string; value: boolean}[]> {
        const ret = [];
        for (const userId of userIds) {
            const query = this.getUserAuthorizePermissionQueryBuilder(userId, permission, entityType, toStringSafe(entityId));
            const count = await query.getCount();
            const isAllowed = count > 0;
            if (!isAllowed) {
                // breakpoint here to see which endpoint rejected this access by policy
                this.logger.verbose(
                    `Access Denied to user ${userId} on entityType ${entityType}, entityId ${entityId}, permission ${permission}`
                );
            }
            ret.push({value: isAllowed, id: userId});
        }
        return ret;
    }

    private getUserAuthorizePermissionQueryBuilder(
        userId: string,
        permission: PermissionOptions,
        entityType: EntityTypeOptions,
        entityId: string
    ): SelectQueryBuilder<AssignedPermissionEntity> {
        const query = this.repoAssignedPermission.createQueryBuilder('ap');
        query.where({entityType: entityType});

        if (!!entityId) {
            query.andWhere({entityId: entityId});
        } else {
            query.andWhere({entityId: IsNull()});
        }
        query
            // Do a bitwise comparison between the assigned permission in the db and the permission mask we want to check.
            .andWhere(`(ap.permissions & :permissionParam) > 0`, {permissionParam: permission})
            // Check if there are permissions for this user OR for this user's roles (user_id will be null in table and role_id won't)
            .andWhere(
                `(
                            (
                                ap.user_id IS NOT NULL  
                                AND ap.role_id IS NULL 
                                AND ap.user_id::text = :userId::text
                                AND ap.banned = FALSE
                            )  
                            OR 
                            (
                                ap.user_id IS NULL 
                                AND ap.role_id IS NOT NULL 
                                AND ap.role_id IN (${query
                                    .subQuery()
                                    .select('ur.role_id')
                                    .from(UserRoleEntity, 'ur')
                                    .where('ur.user_id::text = :userId::text')
                                    .andWhere('ur.banned = FALSE')
                                    .getQuery()}
                                )
                            )
                        )`,
                {userId: userId}
            );

        return query;
    }

    /**
     * Grant permission to a userId
     */
    @Transactional()
    async grantOwner(entityType: EntityTypeOptions, userId: string, entityId: string | number): Promise<void> {
        await this.grant(PermissionOptions.OWNER, entityType, entityId?.toString(), userId, null);
    }

    /**
     * Grant permission to a userId
     */
    @Transactional()
    async revokeOwner(entityType: EntityTypeOptions, userId: string, entityId: string | number): Promise<void> {
        await this.revoke(PermissionOptions.OWNER, entityType, entityId?.toString(), userId, null);
    }

    /**
     * Grant permission to a userId
     */
    @Transactional()
    async grantToUser(
        permission: PermissionOptions,
        entityType: EntityTypeOptions,
        userId: string,
        entityId: string | number = null
    ): Promise<void> {
        this.logger.verbose(`grantToUser ${permission} ${entityType} ${userId} ${entityId}`);
        if (permission & PermissionOptions.OWNER) throw new Error('Permission cannot be OWNER');
        await this.grant(permission, entityType, entityId?.toString(), userId, null);
    }

    /**
     * Grant permission to a roleId
     */
    @Transactional()
    async grantToRole(permission: PermissionOptions, entityType: EntityTypeOptions, roleId: number): Promise<void> {
        if (permission & PermissionOptions.OWNER) throw new Error('Permission cannot be OWNER');
        await this.grant(permission, entityType, null, null, roleId);
    }

    /**
     * Revoke permission from a userId
     */
    @Transactional()
    async revokeFromUser(
        permission: PermissionOptions,
        entityType: EntityTypeOptions,
        userId: string,
        entityId: string | number = null
    ): Promise<void> {
        this.logger.verbose(`revokeFromUser ${permission} ${entityType} ${userId} ${entityId}`);
        if (permission & PermissionOptions.OWNER) throw new Error('Permission cannot be OWNER');
        await this.revoke(permission, entityType, entityId?.toString(), userId, null);
    }

    /**
     * Revoke permission from a roleId
     */
    @Transactional()
    async revokeFromRole(permission: PermissionOptions, entityType: EntityTypeOptions, roleId: number): Promise<void> {
        if (permission & PermissionOptions.OWNER) throw new Error('Permission cannot be OWNER');
        await this.revoke(permission, entityType, null, null, roleId);
    }

    /**
     * Grants permission for a userId or a roleId (but not both)
     */
    @Transactional()
    private async grant(
        permission: PermissionOptions,
        entityType: EntityTypeOptions,
        entityId: string | number,
        userId: string,
        roleId: number
    ): Promise<void> {
        this.logger.verbose(`grant ${permission} ${entityType} ${entityId} ${userId} ${roleId}`);
        if (!isNullOrUndefined(userId) && !isNullOrUndefined(roleId))
            throw new Error('Cannot grant permissions to a userId and a roleId simultaneously');

        if (permission == PermissionOptions.NONE) throw new Error('Permission cannot be NONE');
        // If a role is passed, check it exists and throw if it doesn't. We do this check here so we don't have to do it in every child.
        if (!isNullOrUndefined(roleId) && !(await this.roleExists(roleId)))
            throw new Error('The specified role ' + roleId + " doesn't exist.");
        // Set the permissions for the given entityType+entityId?+userId?roleIed?
        permission = await this.setGrantedPermissions(entityType, permission, entityId?.toString(), userId, roleId, false);
        //Update/create inherited permissions for this entity if it has a parent
        if (!isNullOrUndefined(userId)) await this.resetInheritedPermissions(entityType, entityId, userId);
        // Get the inherited permissions.
        const inheritedPermissions = await this.getPermission(entityType, entityId, userId, roleId, true);
        if (!isNullOrUndefined(inheritedPermissions)) {
            // combine inherited and current permissions to update children
            permission |= inheritedPermissions.permissions;
        }
        // Cascade the new inherited permission value to all children if not a role
        if (!isNullOrUndefined(roleId)) return;
        // Cascade the new inherited permission value to all children if entityId is not null
        if (isNullOrUndefined(entityId)) return;
        await this.cascadeInheritedPermissionsToChildren(entityType, permission, entityId, userId);
    }

    @Transactional()
    private async resetInheritedPermissions(entityType: EntityTypeOptions, entityId: string | number, userId: string): Promise<void> {
        this.logger.verbose(`resetInheritedPermissions  ${entityType} ${entityId} ${userId}`);
        // Get Parent Id
        const parentId = await this.getParentId(entityType, entityId);
        // If there is no parent, do nothing and return
        if (isNullOrUndefined(parentId)) return;
        // Recalculate the new inherited value for the children of this entity
        const parentExistingPermission = await this.getPermission(entityType, parentId, userId, null, false);
        const parentInheritedPermissions = await this.getPermission(entityType, entityId, userId, null, true);
        let childInheritedPermissions = 0;
        if (parentExistingPermission && parentInheritedPermissions) {
            childInheritedPermissions = parentExistingPermission.permissions | parentInheritedPermissions.permissions;
        } else if (parentExistingPermission) {
            childInheritedPermissions = parentExistingPermission.permissions;
        } else if (parentInheritedPermissions) {
            childInheritedPermissions = parentInheritedPermissions.permissions;
        }
        if (childInheritedPermissions === PermissionOptions.NONE) return;
        // childInheritedPermissions = this.unsetBitFlag(childInheritedPermissions, PermissionOptions.ASSIGNEE);
        await this.setGrantedPermissions(entityType, childInheritedPermissions, entityId, userId, null, true);
    }

    /**
     * If inherited=false, we apply the permission flag to the row with inherited=false
     * if inherited=true, we are calling this while iterating the children, so set the permission as it comes
     * @returns The permissions value as it was stored in the database
     */
    @Transactional()
    public async resetPermissions(
        entityType: EntityTypeOptions,
        entityId: string | number,
        roleId: number,
        inherited: boolean
    ): Promise<void> {
        const ownerId = await this.getEntityOwnerUserId(EntityTypeOptions.Folder, entityId);
        const existingPermission = await this.getPermission(entityType, entityId, ownerId, roleId, inherited);
        if (isNullOrUndefined(existingPermission)) return;
        await this.deleteAllPermissionsForEntity(entityType, entityId);
        await this.grantOwner(EntityTypeOptions.Folder, ownerId, entityId);
        await this.setGrantedPermissions(entityType, existingPermission.permissions, entityId, ownerId, roleId, inherited);
    }

    /**
     * If inherited=false, we apply the permission flag to the row with inherited=false
     * if inherited=true, we are calling this while iterating the children, so set the permission as it comes
     * @returns The permissions value as it was stored in the database
     */
    @Transactional()
    private async setGrantedPermissions(
        entityType: EntityTypeOptions,
        permission: PermissionOptions,
        entityId: string | number,
        userId: string,
        roleId: number,
        inherited: boolean
    ): Promise<PermissionOptions> {
        this.logger.verbose(`setGrantedPermissions ${entityType} ${permission} ${entityId} ${userId} ${roleId} ${inherited}`);
        // Never inherit the OWNER, PRIVATE permission
        if (inherited) {
            permission = permission & ~PermissionOptions.OWNER;
            permission = permission & ~PermissionOptions.PRIVATE;

            // if this entity is PRIVATE it cannot have inherited permissions
            const isPrivate = await this.getEntityIsPrivate(entityType, entityId);
            if (!isNullOrUndefined(roleId) && isPrivate) {
                await this.deleteAllInheritedPermissionsForEntity(entityType, entityId);
                return;
            }
        }

        if (permission < 1) return permission;

        // Try get the existing permission
        const existingPermission = await this.getPermission(entityType, entityId, userId, roleId, inherited);
        // If the specified permission doesn't exist, create it
        if (isNullOrUndefined(existingPermission)) {
            await this.repoAssignedPermission.insert({
                entityType: entityType,
                entityId: entityId ? String(entityId) : null,
                userId: userId,
                roleId,
                permissions: permission,
                inherited: inherited,
                banned: false,
            });
            // return the permission as it was stored
            return permission;
        }
        // If this is not an inherited permission, we update the existing value with the new permission
        if (!inherited) {
            permission = existingPermission.permissions | permission;
        }
        await this.repoAssignedPermission.update({id: existingPermission.id}, {permissions: permission});
        // return the permission as it was stored
        return permission;
    }

    /**
     * Revokes permission for a userId or a roleId
     */
    @Transactional()
    private async revoke(
        permission: PermissionOptions,
        entityType: EntityTypeOptions,
        entityId: string | number,
        userId: string,
        roleId: number
    ): Promise<void> {
        this.logger.verbose(`revoke ${permission} ${entityType} ${entityId} ${userId} ${roleId}`);

        if (permission === PermissionOptions.NONE) throw new Error('Permission cannot be NONE');
        // If a role is passed, check it exists and throw if it doesn't. We do this check here so we don't have to do it in every child.
        if (!isNullOrUndefined(roleId) && !(await this.roleExists(roleId)))
            throw new Error('The specified role ' + roleId + " doesn't exist.");
        // If the specified permission doesn't exist, exit
        const existingPermission = await this.getPermission(entityType, entityId, userId, roleId, false);
        if (isNullOrUndefined(existingPermission)) return;
        // Update the permission mask in memory removing the specified permission flags
        permission = existingPermission.permissions & ~permission;
        // Revoke the permissions
        await this.setRevokedPermissions(entityType, permission, entityId, userId, roleId, false);
        // Obtain the inherited permissions if any
        const inheritedPermissions = await this.getPermission(entityType, entityId, userId, roleId, true);
        if (!isNullOrUndefined(inheritedPermissions)) {
            // Aggregate the permission value with inherited permissions value
            permission |= inheritedPermissions.permissions;
        }
        // Cascade the new inherited permission value to all children if not a role
        if (!isNullOrUndefined(roleId)) return;
        await this.cascadeRevokeToChildrenInherited(entityType, permission, entityId, userId);
    }

    /**
     * Propagates recursively to the children of parentEntityId the new inherited permissions
     */
    @Transactional()
    private async cascadeInheritedPermissionsToChildren(
        entityType: EntityTypeOptions,
        inheritedPermissions: PermissionOptions,
        parentEntityId: string | number,
        userId: string
    ): Promise<void> {
        this.logger.verbose(`cascadeInheritedPermissionsToChildren ${parentEntityId} ${entityType} ${inheritedPermissions} ${userId}`);
        // Don't propagate if parent is private
        const isPrivate = await this.getEntityIsPrivate(entityType, parentEntityId);
        if (isPrivate) {
            return;
        }
        inheritedPermissions = this.unsetBitFlag(inheritedPermissions, PermissionOptions.PRIVATE);
        // inheritedPermissions = this.unsetBitFlag(inheritedPermissions, PermissionOptions.ASSIGNEE);

        // Propagate the new value to the children of this entity
        const children = await this.getChildrenFirstLevelIds(entityType, parentEntityId);
        for (const child of children) {
            // Set this child's inherited permissions as they come from the parent
            await this.setGrantedPermissions(entityType, inheritedPermissions, child.id, userId, null, true);
            // Recalculate the new inherited value for the children of this entity
            const existingPermission = await this.getPermission(entityType, child.id, userId, null, false);
            const existingInheritedPermissions = await this.getPermission(entityType, child.id, userId, null, true);
            let inheritedPermissionsForChildren = 0;
            if (existingPermission && existingInheritedPermissions) {
                inheritedPermissionsForChildren = existingPermission.permissions | existingInheritedPermissions.permissions;
            } else if (existingPermission) {
                inheritedPermissionsForChildren = existingPermission.permissions;
            } else if (existingInheritedPermissions) {
                inheritedPermissionsForChildren = existingInheritedPermissions.permissions;
            }

            // Propagate the new value to the children of this entity
            const isPrivate = await this.getEntityIsPrivate(entityType, child.id);
            if (!isPrivate) {
                await this.cascadeInheritedPermissionsToChildren(entityType, inheritedPermissionsForChildren, child.id, userId);
            }
        }
    }

    /**
     * Propagates recursively to the children of parentEntityId the new inherited permissions
     */
    @Transactional()
    private async cascadeRevokeToChildrenInherited(
        entityType: EntityTypeOptions,
        inheritedPermissions: PermissionOptions,
        parentEntityId: string | number,
        userId: string
    ): Promise<void> {
        this.logger.verbose(`cascadeRevokeToChildrenInherited ${entityType} ${inheritedPermissions} ${parentEntityId} ${userId}`);
        const children = await this.getChildrenFirstLevelIds(entityType, parentEntityId);
        for (const child of children) {
            // Set this child's inherited permissions as they come from the parent
            await this.setRevokedPermissions(entityType, inheritedPermissions, child.id, userId, null, true);
            // Recalculate the new inherited value for the children of this entity
            const existingPermission = await this.getPermission(entityType, child.id, userId, null, false);
            const existingInheritedPermissions = await this.getPermission(entityType, child.id, userId, null, true);
            let inheritedPermissionsForChildren = 0;
            if (existingPermission && existingInheritedPermissions) {
                inheritedPermissionsForChildren = existingPermission.permissions | existingInheritedPermissions.permissions;
            } else if (existingPermission) {
                inheritedPermissionsForChildren = existingPermission.permissions;
            } else if (existingInheritedPermissions) {
                inheritedPermissionsForChildren = existingInheritedPermissions.permissions;
            }
            // Propagate the new value to the children of this entity
            await this.cascadeRevokeToChildrenInherited(entityType, inheritedPermissionsForChildren, child.id, userId);
        }
    }

    /**
     * Updates a row in the table assigned_permission with a given @permission value or deletes the row if the @permission value is zero.
     */
    @Transactional()
    private async setRevokedPermissions(
        entityType: EntityTypeOptions,
        permission: PermissionOptions,
        entityId: string | number,
        userId: string,
        roleId: number,
        inherited: boolean
    ): Promise<PermissionOptions> {
        this.logger.verbose(`setRevokedPermissions ${permission} ${entityType} ${entityId} ${userId} ${roleId} ${inherited}`);
        // If the specified permission doesn't exist, we can't update it, so exit
        const existingPermission = await this.getPermission(entityType, entityId, userId, roleId, inherited);

        if (isNullOrUndefined(existingPermission)) return;

        // If the resulting permission mask is zero we delete the record
        if (permission === (0 as PermissionOptions)) {
            //Don't delete the permissions if the banned = true
            if (existingPermission.banned === false) {
                await this.repoAssignedPermission.delete({id: existingPermission.id});
            }
        } else {
            // update the record.
            await this.repoAssignedPermission.update(
                {id: existingPermission.id},
                {
                    entityType: entityType,
                    entityId: entityId ? String(entityId) : null,
                    userId: userId,
                    roleId,
                    permissions: permission,
                    inherited: existingPermission.inherited,
                }
            );
        }
        return permission;
    }

    /**
     * Returns an array containing the first level children of a given entityId
     */
    private async getChildrenFirstLevelIds(entityType: EntityTypeOptions, entityId: string | number): Promise<IdType[]> {
        this.logger.verbose(`getChildrenFirstLevelIds ${entityType} ${entityId}`);
        const query = this.getQuerySelectChildrenFirstLevel(entityType);
        if (query.length === 0) return [];
        return await this.repoAssignedPermission.query(query, [entityId]);
    }

    /**
     * Provides the correct entity-relation query for a given entityType to obtain first level children only
     */
    private getQuerySelectChildrenFirstLevel(entityType: EntityTypeOptions): string {
        const query = this.hierarchyQueries.SelectChildrenIds[entityType];
        if (query) {
            return query;
        } else {
            return '';
        }
    }

    /**
     * Provides the correct entity-relation query for a given entityType to obtain first level children only
     */
    private getQuerySelectRecursiveIdsForUser(entityType: EntityTypeOptions): string {
        const query = this.hierarchyQueries.SelectRecursiveIdsForUser[entityType];
        if (query) {
            return query;
        } else {
            return '';
        }
    }

    /**
     * Returns an array containing the first level children of a given entityId
     */
    //** create a separate function no need for check */
    public async getRecursiveIdsForUser(
        userId: string,
        entityType: EntityTypeOptions,
        permission: PermissionOptions,
        parentEntityId: string | number | string[] | number[] = null
    ): Promise<IdType[]> {
        this.logger.verbose(`getRecursiveIdsForUser ${permission} ${entityType} ${userId} ${parentEntityId}`);
        const query = this.getQuerySelectRecursiveIdsForUser(entityType);

        if (query.length === 0) return [];
        return await this.repoAssignedPermission.query(query, [userId, permission, parentEntityId]);
    }

    /** Helper function to insert permissions for each member of the parent */
    @Transactional()
    public async insertAllMembersPermissionsOfParentInChild(entityType: EntityTypeOptions, childId: string | number): Promise<void> {
        this.logger.verbose(`insertAllMembersPermissionsOfParentInChild ${entityType} ${childId}`);
        const parentId: number | null = await this.getParentId(entityType, childId);
        if (isNullOrUndefined(parentId)) return;
        await this.copyUnifiedPermissionsFromEntity(entityType, parentId, childId);
    }

    @Transactional()
    public async copyUnifiedPermissionsFromEntity(
        entityType: EntityTypeOptions,
        sourceId: string | number,
        destinationId: string | number,
        inherited = true
    ): Promise<void> {
        this.logger.verbose(`copyUnifiedPermissionsFromEntity ${entityType} ${sourceId} ${destinationId} ${inherited}`);
        const allPermissions = await this.getPermissionsForEntity(entityType, sourceId);
        const unifiedPermissionsPerUser = this.unifyPermissionsByUserAndEntity(entityType, sourceId, allPermissions);
        for (const permission of unifiedPermissionsPerUser) {
            await this.setGrantedPermissions(entityType, permission.permissions, destinationId, permission.userId, null, inherited);
            await this.cascadeInheritedPermissionsToChildren(entityType, permission.permissions, destinationId, permission.userId);
        }
    }

    @Transactional()
    public async mergeChildrenFirstLevelPermissions(entityType: EntityTypeOptions, parentId: string | number): Promise<void> {
        this.logger.verbose(`mergeChildrenFirstLevelPermissions ${entityType} ${parentId}`);
        const children = await this.getChildrenFirstLevelIds(entityType, parentId);
        for (const child of children) {
            await this.mergePermissions(entityType, child.id);
        }
    }

    @Transactional()
    public async mergePermissions(entityType: EntityTypeOptions, entityId: string | number): Promise<void> {
        this.logger.verbose(`mergePermissions ${entityType} ${entityId}`);
        const allPermissions = await this.getPermissionsForEntity(entityType, entityId);
        await this.deleteAllPermissionsForEntity(entityType, entityId);
        const unifiedPermissionsPerUser: AssignedPermissionEntity[] = this.unifyPermissionsByUserAndEntity(
            entityType,
            entityId,
            allPermissions
        );
        for (const permission of unifiedPermissionsPerUser) {
            await this.setGrantedPermissions(entityType, permission.permissions, permission.id, permission.userId, null, false);
        }
    }

    private async getParentId(entityType: EntityTypeOptions, entityId: string | number): Promise<number | null> {
        this.logger.verbose(`getParentId  ${entityType} ${entityId}`);
        const query = this.getQueryGetParent(entityType);
        if (query.length === 0) return null;
        const result = await this.repoAssignedPermission.query(query, [entityId]);
        if (result.length === 0) return null;
        return result[0].id;
    }

    private getQueryGetParent(entityType: EntityTypeOptions): string {
        const query = this.hierarchyQueries.SelectParentId[entityType];
        if (query) {
            return query;
        } else {
            return '';
        }
    }

    /**
     * DELETES all assigned_permission rows for a given entityType/entityId
     */
    @Transactional()
    async deleteAllPermissionsForEntity(entityType: EntityTypeOptions, entityId: string | number): Promise<DeleteResult> {
        this.logger.verbose(`deleteAllPermissionsForEntity ${entityType} ${entityId}`);
        return await this.repoAssignedPermission.delete({
            entityType: entityType,
            entityId: entityId ? String(entityId) : IsNull(),
        });
    }

    @Transactional()
    async deleteAllInheritedPermissionsForThisAndChildren(entityType: EntityTypeOptions, entityId: string | number): Promise<void> {
        this.logger.verbose(`deleteAllInheritedPermissionsForThisAndChildren ${entityType} ${entityId}`);
        const children = await this.getChildrenFirstLevelIds(entityType, entityId);
        for (const child of children) {
            await this.deleteAllInheritedPermissionsForThisAndChildren(entityType, child.id);
        }
        await this.deleteAllInheritedPermissionsForEntity(entityType, entityId);
    }

    /**
     * DELETES all inherited permissions of a given entityType/entityId
     */
    @Transactional()
    async deleteAllInheritedPermissionsForEntity(entityType: EntityTypeOptions, entityId: string | number): Promise<DeleteResult> {
        this.logger.verbose(`deleteAllInheritedPermissionsForEntity ${entityType} ${entityId}`);
        return await this.repoAssignedPermission.delete({
            entityType: entityType,
            entityId: entityId ? String(entityId) : IsNull(),
            inherited: true,
        });
    }

    /**
     * Returns permissions for a given userId
     */
    // async getPermissionsForUser(
    //     userId: string,
    //     entityType?: EntityTypeOptions,
    //     entityId?: string | string[] | number | number[]
    // ): Promise<AssignedPermissionEntity[]> {
    //     if (userId === null) throw new Error('userId cannot be null');
    //     const query = this.repoAssignedPermission.createQueryBuilder('ap');
    //     query.where({userId: userId});
    //     if (entityType !== null) query.andWhere({entityType: entityType});
    //     if (entityId !== null) {
    //         if (Array.isArray(entityId)) {
    //             const ids = entityId.map(String);
    //             query.andWhere('ap.entity_id IN (:...entityId)', {ids});
    //         } else {
    //             const id = entityId?.toString();
    //             query.andWhere({entityId: id});
    //         }
    //     }
    //     return await query.getMany();
    // }

    /**
     * Returns permissions for a role
     */
    async getPermissionsForRole(roleId: number, entityType?: EntityTypeOptions): Promise<AssignedPermissionEntity[]> {
        this.logger.verbose(`getPermissionsForRole ${entityType} ${roleId}`);
        if (isNullOrUndefined(roleId)) throw new Error('roleId cannot be null');
        const query = this.repoAssignedPermission.createQueryBuilder('ap');
        query.where({roleId: roleId});
        if (!isNullOrUndefined(entityType)) query.andWhere({entityType: entityType});
        return await query.getMany();
    }

    /**
     * Returns permissions for an entity
     */
    async getPermissionsForEntity(
        entityType: EntityTypeOptions,
        entityId: string | string[] | number | number[]
    ): Promise<AssignedPermissionEntity[]> {
        this.logger.verbose(`getPermissionsForEntity ${entityType} ${entityId}`);
        if (isNullOrUndefined(entityType)) throw new Error('entityType cannot be null');
        if (isNullOrUndefined(entityId)) throw new Error('entityId cannot be null');
        const query = this.repoAssignedPermission.createQueryBuilder('ap');
        query.where({entityType: entityType});
        if (Array.isArray(entityId)) {
            const ids = entityId.map(String);
            query.andWhere('ap.entity_id IN (:...entityId)', {ids});
        } else {
            query.andWhere({entityId});
        }
        return await query.orderBy('ap.entity_id').addOrderBy('ap.user_id').addOrderBy('ap.inherited').getMany();
    }

    async findUsersWithoutPermissionForEntityType(
        userIds: string[] | number[],
        entityType: EntityTypeOptions
    ): Promise<string[] | number[]> {
        this.logger.verbose(`findUsersWithoutPermissionForEntityType ${userIds.join(', ')} ${entityType}`);

        if (userIds.length === 0) {
            return [];
        }

        const query = this.repoAssignedPermission.createQueryBuilder('ap');
        const ids = userIds.map(String);

        query.where({entityType: entityType});
        query.andWhere('ap.user_id IN (:...ids)', {ids});

        const users = await query.getMany();

        return users.map((item) => item.userId);
    }

    /**
     * Utility function that takes an array of AssignedPermissionEntity and combines inherited and non-inherited permissions
     * into one AssignedPermissionEntity. Returns another array of AssignedPermissionEntity but only one permission per {entityId,userId}
     */
    unifyPermissionsByUserAndEntity(
        entityType: EntityTypeOptions,
        entityId: string | number,
        allPermissions: AssignedPermissionEntity[]
    ): AssignedPermissionEntity[] {
        // Create a new array with unique userId values
        const userPermissions = allPermissions.reduce((result, permission) => {
            const {userId} = permission;

            if (!result[userId]) {
                result[userId] = [];
            }

            result[userId].push(permission);

            return result;
        }, {});

        const mergedPermissions: AssignedPermissionEntity[] = [];
        for (const userId in userPermissions) {
            const mergedPermission: AssignedPermissionEntity = new AssignedPermissionEntity();
            mergedPermission.permissions = 0;
            const permissions = userPermissions[userId];
            permissions.forEach((permission: AssignedPermissionEntity) => {
                if (
                    mergedPermission.entityId === undefined ||
                    (mergedPermission.entityId === entityId?.toString() && mergedPermission.entityType === entityType)
                ) {
                    mergedPermission.userId = permission.userId;
                    mergedPermission.entityId = entityId?.toString();
                    mergedPermission.entityType = entityType;
                    mergedPermission.inherited = false;
                    mergedPermission.permissions |= permission.permissions;
                    if (mergedPermission.permissions != PermissionOptions.NONE) {
                        mergedPermissions.push(mergedPermission);
                    }
                }
            });
        }
        return mergedPermissions;
    }

    /**
     * Gets a row from the table assigned_permission
     */
    async getPermission(
        entityType: EntityTypeOptions,
        entityId: string | number,
        userId: string,
        roleId: number,
        inherited: boolean
    ): Promise<AssignedPermissionEntity> {
        this.logger.verbose(`getPermission ${entityType} ${entityId} ${userId} ${roleId} ${inherited}`);
        const query = this.repoAssignedPermission.createQueryBuilder('ap');
        const roleIdEx = isNullOrUndefined(roleId) ? null : roleId.toString();
        query.where({entityType: entityType});
        query.andWhere({inherited: inherited});
        if (isNullOrUndefined(entityId)) {
            query.andWhere(` (ap.entity_id IS NULL)`);
        } else {
            query.andWhere(` (ap.entity_id = :entityId)`, {entityId});
        }
        if (isNullOrUndefined(roleIdEx)) {
            query.andWhere(`(ap.user_id IS NOT NULL AND ap.role_id IS NULL AND ap.user_id::text = :userId)`, {userId: userId});
        } else {
            if (isNullOrUndefined(userId)) {
                query.andWhere(`(ap.user_id IS NULL AND ap.role_id IS NOT NULL AND ap.role_id = :roleId)`, {roleId: roleIdEx});
            } else {
                query.andWhere(
                    `(
                            (ap.user_id IS NOT NULL AND ap.role_id IS NULL AND ap.user_id::text = :userId)  
                            OR 
                            (ap.user_id IS NULL AND ap.role_id IS NOT NULL AND ap.role_id = :roleId)
                           )`,
                    {userId, roleId}
                );
            }
        }
        return await query.getOne();
    }

    /**
     * Determines if a given roleId exists in the table roles
     */
    async roleExists(roleId: number): Promise<boolean> {
        return (await this.repoRole.createQueryBuilder('r').where({id: roleId.toString()}).getCount()) > 0;
    }

    /**
   /* Inserting user role
   */
    @Transactional()
    async insertUserRole(userId: string, roleId: number, banned: boolean): Promise<InsertResult> {
        return await this.repoUserRole.insert({userId: userId, roleId: roleId, banned});
    }

    /**
   /* Get Role by Role code - check if we need it or not
   //  */
    async getRoleByCode(code: string): Promise<RoleEntity> {
        return await this.repoRole.findOne({where: {code}, select: {id: true}});
    }

    /**
   /* Get Role by Role code - check if we need it or not
   //  */
    async getUserRoleByRoleUserId(roleId: number, userId: string): Promise<UserRoleEntity> {
        return await this.repoUserRole.findOne({where: {userId, roleId}});
    }

    /**
   /* Get Role by Role code - check if we need it or not
   //  */
    @Transactional()
    async updateUserRole(id: number, banned: boolean): Promise<UpdateResult> {
        return await this.repoUserRole.update(id, {banned});
    }

    /**
     * Deleting user role
     */
    @Transactional()
    async deleteUserRoleByRoleId(userId: string, roleId: number): Promise<DeleteResult> {
        return await this.repoUserRole.delete({userId: userId, roleId: roleId});
    }

    /**
     * Deleting user roles by userId
     */
    @Transactional()
    async deleteAllUserRoles(userId: string): Promise<DeleteResult> {
        return await this.repoUserRole.delete({userId: userId});
    }

    /**
     * Get user roles by userId or all
     */
    async getUserRoles(userId?: string): Promise<UserRoleEntity[]> {
        const query = this.repoUserRole.createQueryBuilder('r');
        if (!isNullOrUndefined(userId)) query.where({userId: String(userId)});
        return await query.getMany();
    }

    /** Helper function to filter entities user has permissions on */
    public async filterArrayNodeWithPermission<T extends IdType>(
        entityArray: T[],
        userId: string,
        entityType: EntityTypeOptions,
        permissions: PermissionOptions
    ): Promise<T[]> {
        /*
let result: T[] = [];
const timeTaken1 = await this.measureAsyncTimeTaken(async ()=>{
const allowedIds = await this.getRecursiveIdsForUser(userId, entityType, permissions);
const filteredNodes: T[] = entityArray.filter(node => 
allowedIds.some(allowedNode => 
    allowedNode.id === node.id
)
);
result = filteredNodes;
});

const timeTaken2 = await this.measureAsyncTimeTaken(async ()=>{        
const allowedNodes: T[] = [];
for (const node of entityArray) {
const isAllowed: boolean = await this.getUserHasPermissions(userId, permissions, entityType, node.id);
if (isAllowed) allowedNodes.push(node);
}
});
*/

        const allowedIds = await this.getRecursiveIdsForUser(userId, entityType, permissions);
        return entityArray.filter((node) => allowedIds.some((allowedNode) => allowedNode.id === node.id));
    }

    @Transactional()
    public async processEntityDeletion(entityType: EntityTypeOptions, entityId: string | number): Promise<void> {
        this.logger.log('Deleting all permissions for entity');
        await this.deleteAllPermissionsForEntity(entityType, entityId);
        this.logger.log('Merging Children first level permissions');
        await this.mergeChildrenFirstLevelPermissions(entityType, entityId);
    }

    @Transactional()
    public async updateEntityPosition(entityType: EntityTypeOptions, entityId: string | number): Promise<void> {
        // Get each user's unified permissions of the entity that is being moved
        const allPermissions = await this.getPermissionsForEntity(entityType, entityId);
        const unifiedPermissionsPerUser: AssignedPermissionEntity[] = this.unifyPermissionsByUserAndEntity(
            entityType,
            entityId,
            allPermissions.filter((permission) => !permission.inherited)
        );

        // Delete the permissions this entity had for the previous position
        await this.deleteAllPermissionsForEntity(entityType, entityId);

        // Grant the combined permissions to each user for this entity that is now at a new position (with a new parent)
        for (const permission of unifiedPermissionsPerUser) {
            if (this.isOwner(permission.permissions)) {
                await this.grantOwner(entityType, permission.userId, entityId);
            }
            await this.grantToUser(this.unsetOwner(permission.permissions), entityType, permission.userId, entityId);
        }

        // Aditionally, we add as members every member of the parent entity as well.
        await this.insertAllMembersPermissionsOfParentInChild(entityType, entityId);
    }

    public setBitFlag(permissions: PermissionOptions, bitToSet: PermissionOptions): number {
        return permissions | bitToSet;
    }

    public unsetBitFlag(permissions: PermissionOptions, bitToDisable: PermissionOptions): number {
        return permissions & ~bitToDisable;
    }

    public unsetOwner(permissions: PermissionOptions): number {
        return this.unsetBitFlag(permissions, PermissionOptions.OWNER);
    }

    public isOwner(permissions: PermissionOptions): boolean {
        return (permissions & PermissionOptions.OWNER) != PermissionOptions.NONE;
    }

    public isPrivate(permissions: PermissionOptions): boolean {
        return (permissions & PermissionOptions.PRIVATE) != PermissionOptions.NONE;
    }

    public async getEntityOwnerUserId(entityType: EntityTypeOptions, entityId: string | number): Promise<string> {
        if (isNullOrUndefined(entityType)) throw new Error('Entity Type cannot be null');
        if (isNullOrUndefined(entityId)) throw new Error('Entity Id cannot be null');
        const query = this.repoAssignedPermission.createQueryBuilder('ap');
        query.where({entityType: entityType});
        query.andWhere(` (ap.entity_id = :entityId)`, {entityId: entityId?.toString()});
        query.andWhere(`(ap.permissions & :permissionParam) > 0`, {permissionParam: PermissionOptions.OWNER});
        query.andWhere(
            `(
                ap.user_id IS NOT NULL 
                AND ap.role_id IS NULL 
            )`
        );
        const result = await query.getOne();
        if (!result) return '';
        return result.userId;
    }

    public async getEntityIsPrivate(entityType: EntityTypeOptions, entityId: string | number): Promise<boolean> {
        if (isNullOrUndefined(entityType)) throw new Error('Entity Type cannot be null');
        if (isNullOrUndefined(entityId)) throw new Error('Entity Id cannot be null');
        const query = this.repoAssignedPermission.createQueryBuilder('ap');
        query.where({entityType: entityType});
        query.andWhere(` (ap.entity_id = :entityId)`, {entityId: entityId?.toString()});
        query.andWhere(`(ap.permissions & :permissionParam) > 0`, {permissionParam: PermissionOptions.OWNER});
        query.andWhere(`(ap.permissions & :permissionParam) > 0`, {permissionParam: PermissionOptions.PRIVATE});
        query.andWhere(
            `(
                ap.user_id IS NOT NULL 
                AND ap.role_id IS NULL 
            )`
        );
        const result = await query.getOne();
        return !isNullOrUndefined(result);
    }

    async getPermissionsForUserSchema(userId: string, _dataSource: DataSource): Promise<AssignedPermissionEntity[]> {
        const query = this.repoAssignedPermission.createQueryBuilder('ap');
        query.leftJoinAndSelect('ap.Role', 'role');
        query.leftJoinAndSelect('role.UserRoles', 'ur', 'ur.user_id::text = :userId', {userId});
        query.where(
            `(
                        (
                            ap.user_id IS NOT NULL
                            AND ap.role_id IS NULL
                            AND ap.user_id::text = :userId
                        )
                        OR
                        (
                            ap.user_id IS NULL
                            AND ap.role_id IS NOT NULL
                            AND ap.role_id IN (${query
                                .subQuery()
                                .select('ur.role_id')
                                .from(UserRoleEntity, 'ur')
                                .where('ur.user_id::text = :userId')
                                .getQuery()}
                            )
                        )
                    )`,
            {userId: userId}
        );
        query.andWhere('ap.entity_id IS NULL');
        return await query.getMany();
    }

    @Transactional()
    async grantDefaultPermissionsToUser(userId: string): Promise<void> {
        for (const entity of DefaultPermissonsOptions) {
            await this.grantToUser(entity.permissions, entity.role, userId);
        }
    }

    @Transactional()
    async copyPermissionsFromEntityToAnother(
        entityType: EntityTypeOptions,
        sourceEntityId: string | number,
        destinationEntityId: string | number
    ): Promise<void> {
        const permissions = await this.getPermissionsForEntity(entityType, sourceEntityId.toString());
        for (const permission of permissions) {
            if (permission.inherited) continue;
            if (permission.userId == null) continue;
            if (this.isOwner(permission.permissions)) {
                await this.grantOwner(permission.entityType, permission.userId, destinationEntityId.toString());
            }
            await this.grantToUser(
                this.unsetOwner(permission.permissions),
                permission.entityType,
                permission.userId,
                destinationEntityId.toString()
            );
        }
        const parentId = await this.getParentId(entityType, destinationEntityId);
        if (parentId != null) {
            const parentPermissions = await this.getPermissionsForEntity(entityType, parentId.toString());
            for (const parentPermission of parentPermissions) {
                await this.resetInheritedPermissions(entityType, destinationEntityId, parentPermission.userId);
            }
        }
    }

    async setBannedUserFromEntity(entityType: EntityTypeOptions, userId: string, banned: boolean): Promise<void> {
        //check if we have already splited the permissions into two halfs.?
        const permissionsDB = await this.repoAssignedPermission.findOne({
            where: {userId, entityId: IsNull(), entityType, permissions: PermissionOptions.CREATE_UPDATE_DELETE},
        });

        //If permissions already divided into two half then just update the banned
        if (permissionsDB) {
            await this.repoAssignedPermission.update(permissionsDB.id, {banned});
        } else {
            const permissionsDB = await this.repoAssignedPermission.findOne({
                where: {userId, entityId: IsNull(), entityType},
            });
            //** Update the existing permission to have CREATE_UPDATE_DELETE */
            await this.repoAssignedPermission.update(permissionsDB.id, {banned, permissions: PermissionOptions.CREATE_UPDATE_DELETE});
            //** Update the existing permission to have ASSIGN */
            await this.repoAssignedPermission.insert({
                entityType: entityType,
                entityId: null,
                userId: userId,
                permissions: PermissionOptions.READ,
                inherited: false,
                banned: false,
            });
        }
        return;
    }

    async UnBannedUserFromEntity(entityType: EntityTypeOptions, userId: string): Promise<void> {
        await this.repoAssignedPermission.delete({
            userId,
            entityId: IsNull(),
            entityType,
            permissions: PermissionOptions.CREATE_UPDATE_DELETE,
        });

        return;
    }

    async getUserPermissionsForEntity(entityType: EntityTypeOptions, userId: string): Promise<AssignedPermissionEntity> {
        return await this.repoAssignedPermission.findOne({where: {userId, entityId: IsNull(), entityType}});
    }

    async getUserBannedPermissionsForEntity(entityType: EntityTypeOptions, userId: string): Promise<AssignedPermissionEntity> {
        return await this.repoAssignedPermission.findOne({where: {userId, entityId: IsNull(), entityType, banned: true}});
    }
}
