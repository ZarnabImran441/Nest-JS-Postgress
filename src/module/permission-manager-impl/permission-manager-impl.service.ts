import {Inject, Injectable, Logger} from '@nestjs/common';
import {DataSource, In} from 'typeorm';
import {
    ABSTRACT_AUTHORIZATION_SERVICE,
    BannedPermissionDto,
    ChildrenPermissionDto,
    contructorLogger,
    PermissionDto,
    PermissionGroupDto,
    PermissionManagerServiceInterface,
    PermissionStatusOptions,
    PermissionTypeOptions,
    SchemaPermissionDto,
    SectionTypeOptions,
    SetPermisisonsGroupsDto,
} from '@lib/base-library';
import {EntityTypeOptions, PermissionOptions, PermissionsStatusOptions} from '../authorization-impl/authorization.enum';
import {PermissionGroupEntity} from '../../model/permissions-group.entity';
import {UserPermissionsGroupEntity} from '../../model/user-permission-groups.entity';
import {Transactional} from 'typeorm-transactional';
import {AuthorizationImplService} from '../authorization-impl/authorization-impl.service';

/**
 * Permissions in the table assigned_permission will consist of a row with inherited=FALSE to store the permissions set intentionally
 * for a specific entity and another row with inherited=TRUE that will contain the aggregated permissions of the parent if the value
 * is greater than zero/NONE.
 */
@Injectable()
export class PermissionManagerImplService implements PermissionManagerServiceInterface {
    protected logger: Logger;
    protected readonly baseSchema: SchemaPermissionDto;

    constructor(
        @Inject(ABSTRACT_AUTHORIZATION_SERVICE) protected readonly authorization: AuthorizationImplService,
        protected readonly dataSource: DataSource
    ) {
        this.logger = new Logger(this.constructor.name);
        contructorLogger(this);
        this.baseSchema = {
            id: 'header',
            sectionType: SectionTypeOptions.SECTION,
            title: 'Task Management - Permissions Manager',
            description: 'Task Management - Permissions Manager',
            children: [
                {
                    id: EntityTypeOptions.PermissionManager, //true
                    title: 'Permission Manager',
                    description: 'Allow the user to manage permissions for all users (this screen)',
                    sectionType: SectionTypeOptions.PERMISSION,
                    type: PermissionTypeOptions.RADIO,
                    options: PermissionsStatusOptions,
                },
                {
                    id: EntityTypeOptions.Workflow,
                    title: 'Workflow',
                    description: 'Allow the user to manage workflows',
                    sectionType: SectionTypeOptions.PERMISSION,
                    type: PermissionTypeOptions.RADIO,
                    options: PermissionsStatusOptions,
                },
                {
                    id: EntityTypeOptions.Importance,
                    title: 'Importance',
                    description: 'Allow the user to manage importance feature',
                    sectionType: SectionTypeOptions.PERMISSION,
                    type: PermissionTypeOptions.RADIO,
                    options: PermissionsStatusOptions,
                },
                {
                    id: EntityTypeOptions.CommonCustomFieldsDefinition,
                    title: 'Common Custom Fields',
                    description: 'Allow the user to manage custom fields for all users',
                    sectionType: SectionTypeOptions.PERMISSION,
                    type: PermissionTypeOptions.RADIO,
                    options: PermissionsStatusOptions,
                },
                {
                    id: EntityTypeOptions.CommonTag,
                    title: 'Common Tags',
                    description: 'Allow the user to manage tags for all users',
                    sectionType: SectionTypeOptions.PERMISSION,
                    type: PermissionTypeOptions.RADIO,
                    options: PermissionsStatusOptions,
                },
                {
                    id: EntityTypeOptions.Folder,
                    title: 'Folders',
                    description: 'Allow the user to create folders at root level',
                    sectionType: SectionTypeOptions.PERMISSION,
                    type: PermissionTypeOptions.RADIO,
                    options: PermissionsStatusOptions,
                },
                {
                    id: EntityTypeOptions.DisplacementGroup,
                    title: 'Custom Stages',
                    description: 'Allow the user to create custom stages and groups',
                    sectionType: SectionTypeOptions.PERMISSION,
                    type: PermissionTypeOptions.RADIO,
                    options: PermissionsStatusOptions,
                },
                {
                    id: EntityTypeOptions.PurgeFoldersAndTasks,
                    title: 'Purge Delete Folders and Tasks',
                    description: 'Allow the user to delete and archive folders and tasks',
                    sectionType: SectionTypeOptions.PERMISSION,
                    type: PermissionTypeOptions.RADIO,
                    options: PermissionsStatusOptions,
                },
                {
                    id: EntityTypeOptions.replaceFolderOwner,
                    title: 'Replace Owner of a Folder',
                    description: 'Allow the user to replace owner of a folder',
                    sectionType: SectionTypeOptions.PERMISSION,
                    type: PermissionTypeOptions.RADIO,
                    options: PermissionsStatusOptions,
                },
                {
                    id: EntityTypeOptions.customFieldCollection,
                    title: 'Custom Field Collection',
                    description: 'Allow the user to create custom field collection',
                    sectionType: SectionTypeOptions.PERMISSION,
                    type: PermissionTypeOptions.RADIO,
                    options: PermissionsStatusOptions,
                },
                {
                    id: EntityTypeOptions.TagsCollection,
                    title: 'Tags Collection',
                    description: 'Allow the user to create tags collection',
                    sectionType: SectionTypeOptions.PERMISSION,
                    type: PermissionTypeOptions.RADIO,
                    options: PermissionsStatusOptions,
                },

                {
                    id: EntityTypeOptions.Teams,
                    title: 'Teams',
                    description: 'Allow the user to create a team',
                    sectionType: SectionTypeOptions.PERMISSION,
                    type: PermissionTypeOptions.RADIO,
                    options: PermissionsStatusOptions,
                },
                {
                    id: EntityTypeOptions.Space,
                    title: 'Spaces',
                    description: 'Allow the user to create a space',
                    sectionType: SectionTypeOptions.PERMISSION,
                    type: PermissionTypeOptions.RADIO,
                    options: PermissionsStatusOptions,
                },
                {
                    id: EntityTypeOptions.Dashboard,
                    title: 'Dashboards',
                    description: 'Allow the user to create a dashboards',
                    sectionType: SectionTypeOptions.PERMISSION,
                    type: PermissionTypeOptions.RADIO,
                    options: PermissionsStatusOptions,
                },
            ],
        };
    }

    getSchema(): SchemaPermissionDto[] {
        return [this.baseSchema];
    }

    async getPermission(userId: string): Promise<PermissionDto[]> {
        return await this.getUserPermissions(userId);
    }

    @Transactional()
    async setPermission(userId: string, permissions: PermissionDto[]): Promise<void> {
        // Todo : Get users all permissions and the check is banned is true for any entity if yes the skip that otherwise update
        //** If banned is true then don't remove the banned */
        //** Banned will always be false in this case*/
        for (const permission of permissions) {
            for (const perm of permission.children) {
                switch (perm.assigned) {
                    case true:
                        this.logger.verbose(`grantToUser ${JSON.stringify(perm)}`);
                        await this.authorization.grantToUser(PermissionOptions.CREATE_UPDATE_DELETE, perm.id as EntityTypeOptions, userId);
                        break;
                    case false:
                        this.logger.verbose(`revokeFromUser ${JSON.stringify(perm)}`);
                        await this.authorization.revokeFromUser(
                            PermissionOptions.CREATE_UPDATE_DELETE,
                            perm.id as EntityTypeOptions,
                            userId
                        );
                        break;
                    default:
                        break;
                }
            }
        }
    }

    //** Set roles permissions */
    @Transactional()
    async setRolePermission(roldId: number, permissions: ChildrenPermissionDto[]): Promise<void> {
        //** Todo : Create a route for this to access from UI */
        for (const perm of permissions) {
            switch (perm.assigned) {
                case true:
                    this.logger.verbose(`grantToRole ${JSON.stringify(perm)}`);
                    await this.authorization.grantToRole(PermissionOptions.CREATE_UPDATE_DELETE, perm.id as EntityTypeOptions, roldId);
                    break;
                case false:
                    this.logger.verbose(`revokeFromRole ${JSON.stringify(perm)}`);
                    await this.authorization.revokeFromRole(PermissionOptions.CREATE_UPDATE_DELETE, perm.id as EntityTypeOptions, roldId);
                    break;
                default:
                    break;
            }
        }
    }

    async getPermissionGroup(): Promise<PermissionGroupDto[]> {
        return (await this.dataSource.getRepository(PermissionGroupEntity).find({})) as PermissionGroupDto[];
    }

    async getOnePermissionGroup(permissionGroupId: number): Promise<PermissionGroupDto> {
        return (await this.dataSource.getRepository(PermissionGroupEntity).findOneBy({id: permissionGroupId})) as PermissionGroupDto;
    }

    @Transactional()
    async createPermissionGroup(permissionGroup: PermissionGroupDto): Promise<void> {
        //** "groupPermissionsById" to change the assigned key value according to the permissionsStatus */
        permissionGroup.permissions = permissionGroup.permissions.map((p) => {
            return {
                ...p,
                children: this.groupPermissionsById(p.children),
            };
        });

        await this.dataSource.getRepository(PermissionGroupEntity).insert({
            title: permissionGroup.title,
            description: permissionGroup.description,
            permissions: permissionGroup.permissions,
        });
    }

    @Transactional()
    async delPermissionGroup(permissionGroupId: number): Promise<void> {
        const repoUserPermissionsGroups = this.dataSource.getRepository<UserPermissionsGroupEntity>(UserPermissionsGroupEntity);
        const userPermissionGroupsDb = await repoUserPermissionsGroups.find({
            where: {permissionsGroupId: permissionGroupId},
            select: {userId: true},
        });

        if (userPermissionGroupsDb.length) {
            for (const {userId} of userPermissionGroupsDb) {
                await this.delPermissionGroupUser(permissionGroupId, userId);
            }
        }

        await this.dataSource.getRepository(PermissionGroupEntity).delete({id: permissionGroupId});
    }

    @Transactional()
    async updatePermissionGroup(permissionGroupId: number, permissionGroup: PermissionGroupDto): Promise<void> {
        const repoUserPermissionsGroups = this.dataSource.getRepository<UserPermissionsGroupEntity>(UserPermissionsGroupEntity);
        await this.dataSource.getRepository(PermissionGroupEntity).update(permissionGroupId, permissionGroup);
        const userPermissionGroupsDb = await repoUserPermissionsGroups.find({
            where: {permissionsGroupId: permissionGroupId},
            select: {userId: true},
        });

        if (userPermissionGroupsDb.length) {
            for (const {userId} of userPermissionGroupsDb) {
                const userPermissionGroups = await repoUserPermissionsGroups.find({
                        where: {userId},
                        select: {permissionsGroupId: true},
                    }),
                    userPermissionGroupsIds = userPermissionGroups.map((pg) => pg.permissionsGroupId);
                await this.setPermissionsUsingStatus(userPermissionGroupsIds, userId);
            }
        }
    }

    async getPermissionGroupUser(userId: string): Promise<number[]> {
        const permissionsGroupsDB = await this.dataSource
            .getRepository<UserPermissionsGroupEntity>(UserPermissionsGroupEntity)
            .find({where: {userId}, select: {permissionsGroupId: true}});
        return permissionsGroupsDB.map((pg) => pg.permissionsGroupId);
    }

    //The handler grouped data on the basis of permissionStatus and the base of priority
    // (Disallow -> allow -> unset) change the value of permissions.
    @Transactional()
    async setPermissionsUsingStatus(permissionsGroupsIds: number[], userId: string): Promise<void> {
        this.logger.verbose(`setPermissionsUsingStatus`);
        const children = await this.updateUserPermissionStatus(permissionsGroupsIds, userId);
        this.logger.verbose(`set permission to ${userId} with ${JSON.stringify(children)}`);

        return await this.setPermission(userId, [
            {
                id: this.baseSchema.id,
                sectionType: this.baseSchema.sectionType,
                title: this.baseSchema.sectionType,
                children: children.length ? children : [],
            },
        ]);
    }

    @Transactional()
    async setPermissionGroupUser(dto: SetPermisisonsGroupsDto, userId: string): Promise<void> {
        const repoUserPermissionsGroups = this.dataSource.getRepository<UserPermissionsGroupEntity>(UserPermissionsGroupEntity);
        const userPermissionGroups = await repoUserPermissionsGroups.find({
            where: {userId},
            select: {permissionsGroupId: true},
        });
        let permissionGroupsIds = userPermissionGroups.map((g) => g.permissionsGroupId);

        /* Permissions */
        {
            if (dto.delete?.length) {
                //Remove the dto.delete from permissionGroupsIds
                permissionGroupsIds = permissionGroupsIds.filter((id) => !dto.delete.includes(id));
                for (const permissionGroupId of dto.delete) {
                    this.logger.verbose(`Delete into UserPermissionsGroups`);
                    await repoUserPermissionsGroups.delete({
                        userId,
                        permissionsGroupId: permissionGroupId,
                    });
                }
            }

            if (dto.insert?.length) {
                for (const permissionGroupId of dto.insert) {
                    permissionGroupsIds.push(permissionGroupId);
                    this.logger.verbose(`Insert into UserPermissionsGroups`);
                    await repoUserPermissionsGroups.insert({
                        userId,
                        permissionsGroupId: permissionGroupId,
                    });
                }
            }
        }

        await this.setPermissionsUsingStatus(permissionGroupsIds, userId);
        return;
    }

    //Todo : If banned is true for the user persist the banned state.
    @Transactional()
    async delPermissionGroupUser(permissionGroupId: number, userId: string): Promise<void> {
        const repoUserPermissionsGroups = this.dataSource.getRepository<UserPermissionsGroupEntity>(UserPermissionsGroupEntity);
        const userPermissionGroups = await repoUserPermissionsGroups.find({
            where: {userId},
            select: {permissionsGroupId: true},
        });

        //** Removed permissionGroupId from userPermissionGroupsIds */
        const userPermissionGroupsIds = userPermissionGroups
            .filter((pg) => pg.permissionsGroupId != permissionGroupId) // 1,2
            .map((g) => g.permissionsGroupId);

        //If received empty userPermissionGroupsIds revert user permissions to default permissions
        await this.setPermissionsUsingStatus(userPermissionGroupsIds, userId);

        await this.dataSource.getRepository(UserPermissionsGroupEntity).delete({
            permissionsGroupId: permissionGroupId,
            userId: userId,
        });
    }

    //Todo : Instead of banned permissionsDto we should use permissiongroupdto create one
    async getBannedPermission(userId: string): Promise<BannedPermissionDto[]> {
        //banned = true
        return await this.getUserPermissions(userId, true);
    }

    //Todo
    //If banned is true then isAssigned is false
    //get all pg's and update the values
    //when we un banned the user we have to re assign the permissions to that user again.?how we gonna do it.?
    @Transactional()
    async setBannedPermission(userId: string, permissions: BannedPermissionDto[]): Promise<void> {
        const repoUserPermissionsGroups = this.dataSource.getRepository<UserPermissionsGroupEntity>(UserPermissionsGroupEntity);
        for (const permission of permissions) {
            for (const perm of permission.children) {
                if (perm.banned) {
                    await this.authorization.setBannedUserFromEntity(perm.id as EntityTypeOptions, userId, perm.banned);
                } else {
                    const userPermissions = await this.authorization.getUserBannedPermissionsForEntity(
                        perm.id as EntityTypeOptions,
                        userId
                    );

                    if (userPermissions) {
                        await this.authorization.UnBannedUserFromEntity(perm.id as EntityTypeOptions, userId);
                        const userPermissionGroups = await repoUserPermissionsGroups.find({
                            where: {userId},
                            select: {permissionsGroupId: true},
                        });
                        const userPermissionGroupsIds = userPermissionGroups.map((pg) => pg.permissionsGroupId);
                        await this.setPermissionsUsingStatus(userPermissionGroupsIds, userId);
                    }
                }
            }
        }
    }

    //todo : test
    @Transactional()
    async delBannedPermission(_userId: string): Promise<void> {
        //Todo
        //We should get one for param here banned : true otherwise it will also delete permission where banned is false
    }

    @Transactional()
    async grantDefaultPermissions(userId: string): Promise<void> {
        await this.authorization.grantDefaultPermissionsToUser(userId);
    }

    //** Helper function

    @Transactional()
    async updateUserPermissionStatus(permissionsGroupsIds: number[], userId: string): Promise<ChildrenPermissionDto[]> {
        const repoPermissionGroups = this.dataSource.getRepository<PermissionGroupEntity>(PermissionGroupEntity);
        const repoUserPermissionsGroups = this.dataSource.getRepository<UserPermissionsGroupEntity>(UserPermissionsGroupEntity);
        const mergedAllChild: ChildrenPermissionDto[] = [];

        if (permissionsGroupsIds.length) {
            // Fetch permissions in parallel
            const permissionsGroups = await repoPermissionGroups.find({
                where: {id: In(permissionsGroupsIds)}, //1.2
                select: ['permissions'],
            });

            // Simplify Permission Merging
            permissionsGroups.forEach((perm) => {
                const permissions = perm.permissions as PermissionDto[];
                mergedAllChild.push(...permissions.flatMap((p) => p.children));
            });
        } else {
            // We removed the last permissions group which is assigned to the user reset the permissions to default
            const userPermissionsGroup = await repoUserPermissionsGroups.findOne({
                where: {userId},
                relations: ['PermissionsGroup'],
            });

            //check if the user has banned permissions

            const permissions = userPermissionsGroup?.PermissionsGroup?.permissions as PermissionDto[];
            for (const permission of permissions) {
                for (const perm of permission.children) {
                    this.logger.verbose(`Revoke users permission`);
                    if (perm.assigned) {
                        await this.authorization.revokeFromUser(
                            PermissionOptions.CREATE_UPDATE_DELETE,
                            perm.id as EntityTypeOptions,
                            userId
                        );
                    }
                }
            }
        }
        return this.groupPermissionsById(mergedAllChild);
    }

    private async getUserPermissions(userId: string, banned?: boolean): Promise<PermissionDto[]> {
        const userAssignedPermissions = await this.authorization.getPermissionsForUserSchema(userId, this.dataSource);

        const relevantPermissions = userAssignedPermissions?.filter((perm) =>
            this.baseSchema.children.some((schema) => schema.id === perm.entityType)
        );

        let children = relevantPermissions.map((perm) => {
            const baseSchema = this.baseSchema.children.find((schema) => schema.id === perm.entityType);

            // Are permissions are greater than "16" and equal to "30" this means it's "CREATE|UPDATE|DELETE|READ"
            const isAssigned = Boolean(
                Number(perm.permissions) === PermissionOptions.CREATE_READ_UPDATE_DELETE ||
                    (Number(perm.permissions) === PermissionOptions.CREATE_UPDATE_DELETE &&
                        Number(perm.permissions) > PermissionOptions.READ)
            );

            return {
                id: perm.entityType,
                sectionType: baseSchema.sectionType,
                type: baseSchema.type,
                assigned: perm.banned ? false : isAssigned,
                banned: perm.banned,
                title: baseSchema.title,
            };
        });

        children = children.reduce((acc, item) => {
            const existingItemIndex = acc.findIndex((el) => el.id === item.id);
            if (existingItemIndex >= 0) {
                // If the existing item is banned, keep it; otherwise, replace it with the current item if it's banned
                if (!acc[existingItemIndex].banned && item.banned) {
                    acc[existingItemIndex] = item;
                } else if (!acc[existingItemIndex].banned && !item.banned && !acc[existingItemIndex].assigned && item.assigned) {
                    // Replace with new item because it's assigned and neither are banned
                    acc[existingItemIndex] = item;
                }
            } else {
                acc.push(item);
            }

            return acc;
        }, []);

        if (banned) {
            children = children.filter((cp) => cp.banned === true);
        }

        return [
            {
                id: this.baseSchema.id,
                sectionType: this.baseSchema.sectionType,
                title: this.baseSchema.sectionType,
                children,
            },
        ];
    }

    groupPermissionsById = (permissions: ChildrenPermissionDto[]): ChildrenPermissionDto[] => {
        const groupedPermissions: Record<string, ChildrenPermissionDto[]> = {};
        const children = [];

        permissions?.forEach((permission) => {
            if (!groupedPermissions[permission.id]) {
                groupedPermissions[permission.id] = [];
            }
            groupedPermissions[permission.id].push(permission);
        });

        Object.keys(groupedPermissions)?.map((key) => {
            const status = groupedPermissions[key].map((gd) => gd.permissionStatus);
            const lastElement = groupedPermissions[key][groupedPermissions[key].length - 1];
            const baseObj = {...lastElement};
            const isNotAllowed = status.includes(PermissionStatusOptions.DISALLOW);
            const isAllowed = status.includes(PermissionStatusOptions.ALLOW);

            //if or switch case
            children.push({
                ...baseObj,
                assigned: isNotAllowed ? false : isAllowed ? true : null,
            });
        });

        return children;
    };
}
