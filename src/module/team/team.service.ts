import {Inject, Injectable, Logger, NotFoundException} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {RoleEntity} from '../../model/role.entity';
import {DeleteResult, In, IsNull, Repository} from 'typeorm';
import {ABSTRACT_AUTHORIZATION_SERVICE, ChildrenPermissionDto, contructorLogger, PermissionDto} from '@lib/base-library';
import {UserRoleEntity} from '../../model/user-role.entity';
import {CreateTeamDto} from '../../dto/teams/create-team.dto';
import {TeamPermissionGroupEntity} from '../../model/team-permission-groups.entity';
import {PermissionManagerImplService} from '../permission-manager-impl/permission-manager-impl.service';
import {PermissionGroupEntity} from '../../model/permissions-group.entity';
import {Transactional} from 'typeorm-transactional';
import {UpdateTeamDto} from '../../dto/teams/update-team.dto';
import {AssignedPermissionEntity} from '../../model/assigned-permission.entity';
import {ResponseTeamDto} from '../../dto/teams/reponse-team.dto';
import {UserEntity} from '../../model/user.entity';
import {FolderSpaceTeamEntity} from '../../model/folder-space-team.entity';
import {AuthorizationImplService} from '../authorization-impl/authorization-impl.service';
import {EntityTypeOptions, PermissionOptions} from '../authorization-impl/authorization.enum';
import {FolderEntity} from '../../model/folder.entity';
import {FolderTypeOptions} from '../../enum/folder.enum';
import {UserPermissionOptions} from '../../enum/folder-user.enum';

@Injectable()
export class TeamService {
    private logger: Logger;
    constructor(
        @InjectRepository(RoleEntity) private readonly repoTeam: Repository<RoleEntity>,
        @InjectRepository(UserRoleEntity) private readonly repoUserTeamRepo: Repository<UserRoleEntity>,
        protected readonly repoPermissionsService: PermissionManagerImplService,
        @Inject(ABSTRACT_AUTHORIZATION_SERVICE) protected readonly authorization: AuthorizationImplService
    ) {
        this.logger = new Logger(this.constructor.name);
        contructorLogger(this);
    }

    // Create team
    @Transactional()
    async createTeam(dto: CreateTeamDto): Promise<RoleEntity> {
        try {
            const repoTeamPermissionGroups = this.repoTeam.manager.getRepository<TeamPermissionGroupEntity>(TeamPermissionGroupEntity);

            //** 1 - Team created */
            const repoTeamDB = await this.repoTeam.save({
                code: dto.title,
                description: dto.description,
                active: dto.active,
            });

            // Create users in teams
            for (const userId of dto.users) {
                await this.repoUserTeamRepo.insert({
                    userId: userId,
                    Role: {id: repoTeamDB.id},
                    banned: false,
                });
            }

            // //** Assign Permission groups to teams */
            if (dto.permissionGroups) {
                //Team permissions groups
                for (const permissionGroupId of dto.permissionGroups) {
                    await repoTeamPermissionGroups.insert({
                        Team: {id: repoTeamDB.id},
                        PermissionGroup: {id: permissionGroupId},
                    });
                }
                await this.assignPermissions(dto.permissionGroups, repoTeamDB.id);
            }

            return repoTeamDB;
        } catch (error) {
            this.logger.error(`An error occurred while creating a team`, error);
            throw error;
        }
    }

    //** Refactor this the mapping part */
    async getAllTeams(): Promise<ResponseTeamDto[]> {
        try {
            const teamsDB = await this.repoTeam
                .createQueryBuilder('team')
                .leftJoinAndSelect('team.UserRoles', 'userRoles')
                .leftJoinAndSelect('team.TeamPermissionGroups', 'teamPermissionGroups')
                .leftJoinAndSelect('teamPermissionGroups.PermissionGroup', 'permissionGroup')
                .getMany();

            const response = [];
            for (const team of teamsDB) {
                const users = await this.repoTeam.manager
                    .getRepository<UserEntity>(UserEntity)
                    .find({where: {id: In(team.UserRoles.map((u) => u.userId))}});

                const permissionGroups = team.TeamPermissionGroups.map((teamPermissions) => {
                    const {id, title, description} = teamPermissions.PermissionGroup;
                    return {id, title, description};
                });
                response.push({users, permissionGroups, active: team.active, description: team.description, title: team.code, id: team.id});
            }
            return response;
        } catch (error) {
            this.logger.error(`An error occurred while updating all teams with groups`, error);
            throw error;
        }
    }

    //** Todo : Refactor this the mapping part */
    @Transactional()
    async updateTeam(teamId: number, dto: UpdateTeamDto): Promise<unknown> {
        try {
            const teamExists = await this.repoTeam.findOne({where: {id: teamId}}),
                repoTeamPermissionGroups = this.repoTeam.manager.getRepository<TeamPermissionGroupEntity>(TeamPermissionGroupEntity),
                repoFolderSpaceTeam = this.repoTeam.manager.getRepository<FolderSpaceTeamEntity>(FolderSpaceTeamEntity);

            if (!teamExists) {
                throw new NotFoundException(`Team with id : ${teamId} does not exists`);
            }

            //** test update a team that have not folder assigned */
            const folderTeams = await repoFolderSpaceTeam.find({where: {teamId}, select: {folderId: true, teamPermissions: true}});

            //** delete relation of users */
            if (dto.users) {
                if (dto.users.delete) {
                    for (const userId of dto.users.delete) {
                        //** if a user is delete from the team revoke it's all permissions from the entities */
                        const userPermissionGroup = await this.repoUserTeamRepo.findOne({
                            where: {userId, Role: {id: teamId}},
                            select: {id: true},
                        });

                        const teamsFolderSpaces = await this.repoTeam.manager.getRepository<FolderEntity>(FolderEntity).find({
                            where: {id: In(folderTeams?.map((ft) => ft.folderId))},
                            select: {id: true, folderType: true, userId: true},
                        });

                        for (const folderSpace of teamsFolderSpaces) {
                            const entityType =
                                folderSpace.folderType === FolderTypeOptions.SPACE ? EntityTypeOptions.Space : EntityTypeOptions.Folder;

                            //check if owner of a space/folder is member of the team.If yes.? we cannot remove READ permissions for the owner.
                            const permissions =
                                folderSpace.userId === userId
                                    ? PermissionOptions.CREATE_UPDATE_DELETE
                                    : PermissionOptions.CREATE_READ_UPDATE_DELETE;

                            await this.authorization.revokeFromUser(
                                permissions | PermissionOptions.EDITOR_FULL,
                                entityType,
                                userId,
                                folderSpace.id
                            );
                        }
                        if (userPermissionGroup) await this.repoUserTeamRepo.delete(userPermissionGroup.id);
                    }
                }

                if (dto.users.insert) {
                    for (const userId of dto.users.insert) {
                        await this.repoUserTeamRepo.insert({
                            userId: userId,
                            Role: {id: teamId},
                            banned: false,
                        });

                        for (const folderTeam of folderTeams) {
                            const folderOrSpaceType = await this.repoTeam.manager
                                .getRepository<FolderEntity>(FolderEntity)
                                .findOne({where: {id: folderTeam.folderId}, select: {folderType: true}});

                            const entityType =
                                folderOrSpaceType.folderType === FolderTypeOptions.SPACE
                                    ? EntityTypeOptions.Space
                                    : EntityTypeOptions.Folder;

                            const permission = this.getGeneralPermissionsByUserPermissions(folderTeam.teamPermissions);

                            await this.authorization.grantToUser(permission, entityType, userId, folderTeam.folderId);
                        }
                        //** if a user is added to the team add it's all permissions for the entities where team is assigned*/
                    }
                }

                delete dto['users'];
            }

            //** delete permissions of users */
            if (dto.permissionGroups) {
                if (dto.permissionGroups.delete) {
                    for (const permissionGroupId of dto.permissionGroups.delete) {
                        await repoTeamPermissionGroups.delete({
                            Team: {id: teamId},
                            PermissionGroup: {id: permissionGroupId},
                        });
                    }
                }

                if (dto.permissionGroups.insert) {
                    for (const permissionGroupId of dto.permissionGroups.insert) {
                        await repoTeamPermissionGroups.insert({
                            Team: {id: teamId},
                            PermissionGroup: {id: permissionGroupId},
                        });
                    }
                }

                //re fetch all permission groups assigned to
                const teamPermissionGroups = await repoTeamPermissionGroups.find({
                    where: {Team: {id: teamId}},
                    select: {permissionGroupId: true},
                });

                await this.assignPermissions(teamPermissionGroups?.map((tp) => tp.permissionGroupId) ?? [], teamId);

                delete dto['permissionGroups'];
            }
            if (Object.keys(dto).length > 0) {
                const updateData = {...dto};
                if (dto.title) {
                    updateData['code'] = dto.title;
                    delete updateData['title'];
                }
                await this.repoTeam.update({id: teamId}, updateData);
            }

            return;
        } catch (error) {
            this.logger.error(`An error occurred while updating a team with id : ${teamId} and dto: ${dto}`, error);
            throw error;
        }
    }

    //** Delete a team */
    @Transactional()
    async deleteTeam(teamId: number): Promise<DeleteResult> {
        try {
            const repoTeamPermissionGroups = this.repoTeam.manager.getRepository<TeamPermissionGroupEntity>(TeamPermissionGroupEntity),
                repoAssignedPermissions = this.repoTeam.manager.getRepository<AssignedPermissionEntity>(AssignedPermissionEntity);
            const teamExists = await this.repoTeam.findOne({where: {id: teamId}});

            if (!teamExists) {
                throw new NotFoundException(`Team with id : ${teamId} does not exists`);
            }

            //** delete all users linked with the team */
            await this.repoUserTeamRepo.delete({
                Role: {id: teamId},
                banned: false,
            });

            //** delete all permission groups */
            await repoTeamPermissionGroups.delete({
                Team: {id: teamId},
            });

            //** delete all permission records for this role from assigned permission */
            await repoAssignedPermissions.delete({Role: {id: teamId}, entityId: IsNull()});

            //** delete the team */
            return await this.repoTeam.delete({id: teamId});
        } catch (error) {
            this.logger.error(`An error occurred while deleting a team with id : ${teamId} `, error);
            throw error;
        }
    }

    async getOneTeam(teamId: number): Promise<ResponseTeamDto> {
        try {
            const {active, description, code, UserRoles, TeamPermissionGroups} = await this.repoTeam
                .createQueryBuilder('team')
                .leftJoinAndSelect('team.UserRoles', 'userRoles')
                .leftJoinAndSelect('team.TeamPermissionGroups', 'teamPermissionGroups')
                .leftJoinAndSelect('teamPermissionGroups.PermissionGroup', 'permissionGroup')
                .where('team.id = :teamId', {teamId})
                .getOne();

            const users = await this.repoTeam.manager
                .getRepository<UserEntity>(UserEntity)
                .find({where: {id: In(UserRoles.map((u) => u.userId))}});

            const permissionGroups = TeamPermissionGroups.map((teamPermissions) => {
                const {id, title, description} = teamPermissions.PermissionGroup;
                return {id, title, description};
            });

            return {id: teamId, users, permissionGroups, active, description, title: code};
        } catch (error) {
            this.logger.error(`An error occurred while updating all teams with groups`, error);
            throw error;
        }
    }

    @Transactional()
    private async assignPermissions(permissionGroupIds: number[], teamId: number): Promise<void> {
        try {
            const repoPermissionGroups = this.repoTeam.manager.getRepository<PermissionGroupEntity>(PermissionGroupEntity),
                repoAssignedPermissions = this.repoTeam.manager.getRepository<AssignedPermissionEntity>(AssignedPermissionEntity),
                mergedAllChild: ChildrenPermissionDto[] = [],
                permissionsGroups = await repoPermissionGroups.find({
                    where: {id: In(permissionGroupIds)},
                    select: ['permissions'],
                });

            // Simplify Permission Merging
            permissionsGroups.forEach((perm) => {
                const permissions = perm.permissions as PermissionDto[];
                mergedAllChild.push(...permissions.flatMap((p) => p.children));
            });

            const permissions = this.repoPermissionsService.groupPermissionsById(mergedAllChild);

            //** All pervious permissions of the role where entity id = Null so that we can re assign */
            await repoAssignedPermissions.delete({Role: {id: teamId}, entityId: IsNull()});

            await this.repoPermissionsService.setRolePermission(teamId, permissions);
            return;
        } catch (error) {
            this.logger.error(`An error occurred while assigning permissions to the teams`, error);
            throw error;
        }
    }

    //** todo : move to authorization ask julio */
    private getGeneralPermissionsByUserPermissions(teamPermissions: UserPermissionOptions): PermissionOptions {
        switch (teamPermissions) {
            case UserPermissionOptions.FULL:
                return PermissionOptions.READ_UPDATE_DELETE | PermissionOptions.FULL;

            case UserPermissionOptions.EDITOR:
                return PermissionOptions.READ_UPDATE | PermissionOptions.EDITOR;

            default:
                return PermissionOptions.READ;
        }
    }
}
