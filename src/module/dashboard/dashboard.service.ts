import {
    BadRequestException,
    ForbiddenException,
    HttpException,
    HttpStatus,
    Inject,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import {DashboardEntity} from '../../model/dashboard.entity';
import {InjectRepository} from '@nestjs/typeorm';
import {MoreThan, Repository} from 'typeorm';
import {FolderEntity} from '../../model/folder.entity';
import {ABSTRACT_AUTHORIZATION_SERVICE, contructorLogger} from '@lib/base-library';
import {CreateDashboardDto} from '../../dto/dashboard/create-dashboard.dto';
import {AuthorizationImplService} from '../authorization-impl/authorization-impl.service';
import {EntityTypeOptions, PermissionOptions} from '../authorization-impl/authorization.enum';
import {DashboardMembersDto} from '../../dto/dashboard/members.dto';
import {DashboardTypesOptions} from '../../enum/dashboard-type.enum';
import {DashboardFolderEntity} from '../../model/dashboard-folder-entity';
import {UpdateDashboardDto} from '../../dto/dashboard/update-dashboard.dto';
import {FoldersDto} from '../../dto/dashboard/folders.dto';
import {DashboardUserDefaultEntity} from '../../model/dashboard-user-default.entity';
import {DashboardDto} from '../../dto/dashboard/dashboard.dto';
import {DashboardUserFavouriteEntity} from '../../model/dashboard-user-favourite.entity';
import {AssignedPermissionEntity} from '../../model/assigned-permission.entity';
import {UserEntity} from '../../model/user.entity';
import {MemberInfoDto} from '../../dto/dashboard/member-info.dto';
import {UserPermissionOptions} from '../../enum/dashboard-user.enum';
import {WidgetsService} from '../widgets/widgets.service';
import {UpdateDashboardLayoutDto} from '../../dto/dashboard/dashboard-layout.dto';
import {WidgetEntity} from '../../model/widget.entity';
import {WidgetsRelationEntity} from '../../model/widget-relation.entity';
import {WidgetTypesEntity} from '../../model/widget-types.entity';
import {defaultWidgets} from '../../const/default-widget-list.const';
import {WidgetFilterTypeNameOptions} from '../../enum/widget-filter.enum';

@Injectable()
export class DashboardService {
    private logger: Logger;

    constructor(
        @InjectRepository(DashboardEntity) private readonly dashboardRepo: Repository<DashboardEntity>,
        @InjectRepository(DashboardFolderEntity) private readonly dashboardFolderRepo: Repository<DashboardFolderEntity>,
        @InjectRepository(FolderEntity) private readonly folderRepo: Repository<FolderEntity>,
        @InjectRepository(DashboardUserDefaultEntity) private readonly defaultDashboardUserRepo: Repository<DashboardUserDefaultEntity>,
        @InjectRepository(DashboardUserFavouriteEntity)
        private readonly favouriteDashboardUserRepo: Repository<DashboardUserFavouriteEntity>,
        @InjectRepository(AssignedPermissionEntity) private readonly repoAssignedPermission: Repository<AssignedPermissionEntity>,
        @InjectRepository(UserEntity)
        private readonly userRepository: Repository<UserEntity>,
        @Inject(ABSTRACT_AUTHORIZATION_SERVICE) protected readonly authorization: AuthorizationImplService,
        @InjectRepository(WidgetEntity) private readonly widgetsRepo: Repository<WidgetEntity>,
        @InjectRepository(WidgetsRelationEntity) private readonly widgetRelationRepo: Repository<WidgetsRelationEntity>,
        @InjectRepository(WidgetTypesEntity) private readonly widgetTypesRepo: Repository<WidgetTypesEntity>,
        protected readonly widgetsService: WidgetsService
    ) {
        this.logger = new Logger(this.constructor.name);
        contructorLogger(this);
    }

    async getAllDashboards(userId: string): Promise<DashboardDto[]> {
        try {
            const userDashboards = await this.authorization.getRecursiveIdsForUser(
                userId,
                EntityTypeOptions.Dashboard,
                PermissionOptions.OWNER_FULL_EDITOR_READ
            );

            const dashboardIds = userDashboards.map(({id}) => id);

            if (!dashboardIds.length) {
                return [];
            }
            const dashboards = await this.dashboardRepo
                .createQueryBuilder('dashboard')
                .leftJoinAndSelect('dashboard.isFavourite', 'isFavourite')
                .leftJoinAndSelect('dashboard.isDefault', 'isDefault')
                .leftJoinAndSelect('dashboard.LastModifiedBy', 'LastModifiedBy')
                .leftJoinAndSelect('dashboard.CreatedBy', 'CreatedBy')
                .leftJoinAndSelect('dashboard.LastAccessedBy', 'LastAccessedBy')
                .where('dashboard.id IN (:...ids)', {ids: dashboardIds})
                .getMany();

            if (!dashboards.length) {
                return [];
            }

            const dashboardDtos = dashboards.map((dashboard) => {
                const dto = new DashboardDto(dashboard);
                return dto;
            });

            return dashboardDtos;
        } catch (e) {
            this.logger.error(`Error getting dashboards for user ${userId}`, e);
            throw e;
        }
    }

    async getSharedDashboards(userId: string): Promise<DashboardDto[]> {
        try {
            const userDashboards = await this.authorization.getRecursiveIdsForUser(
                userId,
                EntityTypeOptions.Dashboard,
                PermissionOptions.OWNER_FULL_EDITOR_READ
            );

            const dashboardIds = userDashboards.map(({id}) => id);

            if (!userDashboards.length) {
                return [];
            }

            const dashboards = await this.dashboardRepo
                .createQueryBuilder('dashboard')
                .leftJoinAndSelect('dashboard.isFavourite', 'isFavourite')
                .leftJoinAndSelect('dashboard.isDefault', 'isDefault')
                .leftJoinAndSelect('dashboard.CreatedBy', 'CreatedBy')
                .leftJoinAndSelect('dashboard.LastModifiedBy', 'LastModifiedBy')
                .leftJoinAndSelect('dashboard.LastAccessedBy', 'LastAccessedBy')
                .where('dashboard.id IN (:...ids)', {ids: dashboardIds})
                .andWhere('dashboard.dashboardType = :type', {type: DashboardTypesOptions.Shared})
                .getMany();

            const dashboardDtos = dashboards.map((dashboard) => {
                const dto = new DashboardDto(dashboard);

                return dto;
            });

            return dashboardDtos;
        } catch (e) {
            this.logger.error(`Error getting dashboards for user ${userId}`, e);
            throw e;
        }
    }

    async getMyDashboards(userId: string): Promise<DashboardDto[]> {
        try {
            const userDashboards = await this.authorization.getRecursiveIdsForUser(
                userId,
                EntityTypeOptions.Dashboard,
                PermissionOptions.OWNER
            );
            const dashboardIds = userDashboards.map(({id}) => id);

            if (!dashboardIds.length) {
                return [];
            }

            const dashboards = await this.dashboardRepo
                .createQueryBuilder('dashboard')
                .leftJoinAndSelect('dashboard.isDefault', 'isDefault')
                .leftJoinAndSelect('dashboard.isFavourite', 'isFavourite')
                .leftJoinAndSelect('dashboard.CreatedBy', 'CreatedBy')
                .leftJoinAndSelect('dashboard.LastModifiedBy', 'LastModifiedBy')
                .leftJoinAndSelect('dashboard.LastAccessedBy', 'LastAccessedBy')
                .where('dashboard.id IN (:...ids)', {ids: dashboardIds})
                .andWhere('dashboard.dashboardType = :type', {type: DashboardTypesOptions.My})
                .getMany();

            const dashboardDtos = dashboards.map((dashboard) => {
                const dto = new DashboardDto(dashboard);
                return dto;
            });

            return dashboardDtos;
        } catch (e) {
            this.logger.error(`Error getting dashboards for user ${userId}`, e);
            throw e;
        }
    }

    async getDefaultDashboard(userId: string): Promise<DashboardDto> {
        try {
            const defaultDashboard = await this.defaultDashboardUserRepo.findOne({
                where: {userId: userId},
                relations: {Dashboard: true},
            });

            if (!defaultDashboard) {
                return new DashboardDto();
            }

            const dashboard = await this.dashboardRepo
                .createQueryBuilder('dashboard')
                .leftJoinAndSelect('dashboard.isFavourite', 'isFavourite')
                .leftJoinAndSelect('dashboard.isDefault', 'isDefault')
                .leftJoinAndSelect('dashboard.CreatedBy', 'CreatedBy')
                .leftJoinAndSelect('dashboard.LastModifiedBy', 'LastModifiedBy')
                .leftJoinAndSelect('dashboard.LastAccessedBy', 'LastAccessedBy')
                .where('dashboard.id = :id', {id: defaultDashboard.Dashboard.id})
                .getOne();

            const dashboardMembers = await this.getDashboardMembersWithPermissions(dashboard.id);
            await this.dashboardRepo.save({...dashboard, lastLastAccessedBy: userId, lastAccessedDate: new Date()});

            const dashboardDto = new DashboardDto(dashboard);
            dashboardDto.members = dashboardMembers;

            return dashboardDto;
        } catch (e) {
            this.logger.error(`There was an error fetching dashboard for user ${userId}`, e);
            throw e;
        }
    }

    async getDashboardById(dashboardId: number, userId: string): Promise<DashboardDto> {
        try {
            const dashboard = await this.dashboardRepo
                .createQueryBuilder('dashboard')
                .leftJoinAndSelect('dashboard.isFavourite', 'isFavourite')
                .leftJoinAndSelect('dashboard.isDefault', 'isDefault')
                .leftJoinAndSelect('dashboard.CreatedBy', 'CreatedBy')
                .leftJoinAndSelect('dashboard.LastModifiedBy', 'LastModifiedBy')
                .leftJoinAndSelect('dashboard.LastAccessedBy', 'LastAccessedBy')
                .where('dashboard.id = :id', {id: dashboardId})
                .getOne();

            if (!dashboard) {
                throw new NotFoundException(`Dashboard with id ${dashboardId} not found`);
            }
            const relatedFolders = await this.dashboardFolderRepo.find({
                where: {dashboardId: dashboard.id},
                relations: {Folder: true},
            });
            const folders = relatedFolders.map((relation) => {
                return relation.Folder;
            });

            const {id} = dashboard;

            const membersByPermissions = await this.repoAssignedPermission.find({
                where: {entityId: id.toString(), entityType: EntityTypeOptions.Dashboard, permissions: MoreThan(0)},
            });

            const membersWithPermissions = await Promise.all(
                membersByPermissions.map(async (member) => {
                    const user = await this.userRepository.findOne({where: {id: member.userId}});

                    if (user) {
                        const userDto = new MemberInfoDto(user, this.convertUserPermissionsToEnum(member.permissions));
                        return userDto;
                    } else {
                        return null;
                    }
                })
            );

            const filteredMembers = membersWithPermissions.filter((member) => member !== null);
            await this.dashboardRepo.save({...dashboard, lastAccessedBy: userId, lastAccessedDate: new Date()});

            const dashboardDto = new DashboardDto(dashboard);

            dashboardDto.folders = folders;
            dashboardDto.members = filteredMembers;

            return dashboardDto;
        } catch (e) {
            this.logger.error(`There was an error fetching dashboard id ${dashboardId}`, e);
            throw e;
        }
    }

    async searchDashboardByName(searchValue: string): Promise<DashboardDto[]> {
        try {
            const dashboards = await this.dashboardRepo
                .createQueryBuilder('dashboard')
                .leftJoinAndSelect('dashboard.isFavourite', 'isFavourite')
                .leftJoinAndSelect('dashboard.isDefault', 'isDefault')
                .leftJoinAndSelect('dashboard.CreatedBy', 'CreatedBy')
                .leftJoinAndSelect('dashboard.LastModifiedBy', 'LastModifiedBy')
                .leftJoinAndSelect('dashboard.LastAccessedBy', 'LastAccessedBy')
                .where('dashboard.dashboardName ILike :searchValue', {searchValue})
                .getMany();

            if (!dashboards.length) {
                return [];
            }

            const dashboardDtos = dashboards.map((dashboard) => {
                const dto = new DashboardDto(dashboard);
                return dto;
            });

            return dashboardDtos;
        } catch (e) {
            this.logger.error(`There is no dashboard with name ${searchValue}`, e);
            throw e;
        }
    }

    async updateDashboard(
        id: number,
        {dashboardName, isFavourite, dashboardType, isDefault, description, members}: UpdateDashboardDto,
        userId: string
    ): Promise<DashboardDto> {
        try {
            const dashboardExist = await this.dashboardRepo.findOne({where: {id}});

            if (!dashboardExist) {
                throw new NotFoundException(`Resource with id ${id} not found`);
            }

            const dashboard = await this.dashboardRepo.save({
                id,
                dashboardName,
                dashboardType,
                description,
            });

            const related = await this.dashboardFolderRepo.find({
                where: {dashboardId: dashboard.id},
                relations: {Folder: true},
            });
            const folders = related.map((relation) => {
                return relation.Folder;
            });

            if (typeof isDefault === 'boolean') {
                const defaultDashboard = await this.defaultDashboardUserRepo.findOne({where: {userId}});

                if (isDefault) {
                    if (defaultDashboard) {
                        defaultDashboard.dashboardId = dashboard.id;

                        await this.defaultDashboardUserRepo.save(defaultDashboard);
                    } else {
                        await this.defaultDashboardUserRepo.save({
                            dashboardId: dashboard.id,
                            userId,
                        });
                    }
                } else {
                    if (defaultDashboard) {
                        await this.defaultDashboardUserRepo.delete({
                            dashboardId: defaultDashboard.dashboardId,
                            userId,
                        });
                    }
                }
            }

            if (typeof isFavourite === 'boolean') {
                const favouriteDashboard = await this.favouriteDashboardUserRepo.findOne({
                    where: {
                        userId,
                        dashboardId: dashboard.id,
                    },
                });

                if (isFavourite) {
                    if (!favouriteDashboard) {
                        await this.favouriteDashboardUserRepo.save({
                            userId,
                            dashboardId: dashboard.id,
                        });
                    }
                } else {
                    if (favouriteDashboard) {
                        await this.favouriteDashboardUserRepo.delete({
                            userId,
                            dashboardId: dashboard.id,
                        });
                    }
                }
            }

            if (members) {
                if (members.delete) {
                    for (const genericMemberDto of members.delete) {
                        await this.revokeAllPermissions(genericMemberDto.id, dashboard.id);
                    }
                }
                if (members.update) {
                    for (const genericMemberDto of members.update) {
                        await this.revokeAllPermissions(genericMemberDto.id, dashboard.id);
                        const memberDto = new DashboardMembersDto();
                        memberDto.id = genericMemberDto.id;
                        memberDto.userPermission = genericMemberDto.userPermission;
                        await this.addPermissions(dashboard.id, memberDto);
                    }
                }
                if (members.insert) {
                    for (const genericMemberDto of members.insert) {
                        await this.revokeAllPermissions(genericMemberDto.id, dashboard.id);
                        const memberDto = new DashboardMembersDto();
                        memberDto.id = genericMemberDto.id;
                        memberDto.userPermission = genericMemberDto.userPermission;
                        await this.addPermissions(dashboard.id, memberDto);
                    }
                }
            }
            await this.dashboardRepo.save({
                ...dashboard,
                lastModifiedBy: userId,
                lastModifiedDate: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const updatedDashboard = await this.dashboardRepo.findOne({
                where: {id: dashboard.id},
                relations: {isDefault: true, isFavourite: true, LastAccessedBy: true, LastModifiedBy: true, CreatedBy: true},
            });

            const dashboardMembers = await this.getDashboardMembersWithPermissions(updatedDashboard.id);

            const dto = new DashboardDto(updatedDashboard);
            dto.folders = folders;
            dto.members = dashboardMembers;

            return dto;
        } catch (e) {
            this.logger.error(`There was an error updating dashboard with id ${id}`, e);
            throw e;
        }
    }

    async updateDashboardFolders(id: number, folders: FoldersDto, userId: string): Promise<DashboardDto> {
        try {
            const dashboard = await this.dashboardRepo.findOne({where: {id}});
            const widgets = await this.widgetsRepo.find({where: {dashboardId: id}});

            if (!dashboard) {
                throw new NotFoundException(`Dashboard with id ${id} not found`);
            }

            const folderIds = [];
            if (folders.insert) {
                folders.insert.forEach((folder) => {
                    folderIds.push(folder);
                });
            }
            if (folders.delete) {
                folders.delete.forEach((folder) => {
                    folderIds.push(folder);
                });
            }

            await Promise.all(
                folderIds.map(async (folderId) => {
                    const hasPermissions = await this.authorization.getUserHasPermissions(
                        userId,
                        PermissionOptions.OWNER_FULL,
                        EntityTypeOptions.Folder,
                        folderId
                    );
                    if (!hasPermissions) {
                        throw new ForbiddenException(`Folder ${folderId} is forbidden for user ${userId}`);
                    }
                    return folderId;
                })
            );

            if (folders.insert) {
                await Promise.all(
                    folders.insert.map(async (folderId) => {
                        await this.dashboardFolderRepo.save({
                            folderId,
                            dashboardId: id,
                        });
                    })
                );

                await Promise.all(
                    widgets.map(async (widget) => {
                        for (const folderId of folders.insert) {
                            await this.widgetRelationRepo.save({
                                widgetId: widget.id,
                                folderId,
                            });
                        }
                    })
                );
            }

            if (folders.delete) {
                await Promise.all(
                    folders.delete.map(async (folderId) => {
                        await this.dashboardFolderRepo.delete({
                            folderId,
                            dashboardId: id,
                        });
                    })
                );

                await Promise.all(
                    widgets.map(async (widget) => {
                        for (const folderId of folders.delete) {
                            await this.widgetRelationRepo.delete({
                                widgetId: widget.id,
                                folderId,
                            });
                        }
                    })
                );
            }

            const storedDashboard = await this.dashboardRepo.save({
                ...dashboard,
                lastLastModifiedBy: userId,
                lastModifiedDate: new Date(),
            });

            const related = await this.dashboardFolderRepo.find({
                where: {dashboardId: dashboard.id},
                relations: {Folder: true},
            });
            const updatedFolders = related.map((relation) => {
                return relation.Folder;
            });

            const updatedDashboardDto = new DashboardDto(storedDashboard);
            updatedDashboardDto.folders = updatedFolders;

            const members = await this.getDashboardMembersWithPermissions(dashboard.id);
            updatedDashboardDto.members = members;

            return updatedDashboardDto;
        } catch (e) {
            this.logger.error(`There was an error updating dashboard with id ${id}`, e);
            throw e;
        }
    }

    async updateDashboardLayout(id: number, {layoutSettings}: UpdateDashboardLayoutDto): Promise<void> {
        const dashboard = await this.dashboardRepo.findOne({where: {id}});

        if (!dashboard) {
            throw new NotFoundException(`Resource with id ${id} not found`);
        }

        dashboard.layoutSettings = layoutSettings;

        await this.dashboardRepo.save(dashboard);
    }

    async deleteDashboard(id: number): Promise<void> {
        try {
            const dashboard = await this.dashboardRepo.findOne({where: {id}});

            if (dashboard.isSystem) {
                throw new BadRequestException(`Dashboard ${id} is system and can't be deleted`);
            }

            if (!dashboard) {
                throw new NotFoundException(`Dashboard with id ${id} not found`);
            }

            const relatedWidgets = await this.widgetsRepo.find({where: {dashboardId: id}});
            await Promise.all(
                relatedWidgets.map(async (widget) => {
                    await this.widgetRelationRepo.delete({widgetId: widget.id});
                    await this.widgetsRepo.delete(widget.id);
                })
            );

            await this.dashboardFolderRepo.delete({dashboardId: id});
            await this.authorization.deleteAllPermissionsForEntity(EntityTypeOptions.Dashboard, id);

            await this.dashboardRepo.delete(id);
        } catch (e) {
            this.logger.error(`There was an error deleting dashboard with id ${id}`, e);
            throw e;
        }
    }

    async createDefaultDashboardForUser(userId: string): Promise<DashboardDto> {
        const userExits = await this.userRepository.findOneBy({id: userId});

        if (!userExits) {
            throw new HttpException('User not found', HttpStatus.NOT_FOUND);
        }

        const createdDashboard = await this.createDashboard(
            {
                folderIds: [],
                dashboardName: 'My default dashboard',
                isFavourite: false,
                dashboardType: DashboardTypesOptions.My,
                isDefault: true,
                isSystem: true,
                members: [],
            },
            userId
        );

        const widgets = [];
        const widgetsToAdd = defaultWidgets(userId);

        for (const widget of widgetsToAdd) {
            const widgetType = await this.widgetTypesRepo.findOne({where: {template: widget.template}});

            //eslint-disable-next-line @typescript-eslint/no-unused-vars
            const {layout, ...rest} = widget;

            if (widgetType) {
                if (widget.filtersBy) {
                    widget.filters = widget.filtersBy.map((filter) => {
                        switch (filter) {
                            case WidgetFilterTypeNameOptions.Assignee:
                                return {
                                    name: WidgetFilterTypeNameOptions.Assignee,
                                    condition: true,
                                    values: [userId],
                                };
                        }
                    });
                }
                const dto = {...rest, dashboardId: createdDashboard.id, folderIds: [], widgetTypeId: widgetType.id};
                const createdWidget = await this.widgetsService.createWidget(dto, userId);

                widgets.push(createdWidget);
            }
        }

        const layout = [];
        for (const widget of widgets) {
            layout.push({
                h: widget.layout.h,
                i: `${widget.id}`,
                w: widget.layout.w,
                x: widget.layout.x,
                y: widget.layout.y,
                minH: widget.layout.minH,
                minW: widget.layout.minW,
                moved: false,
                static: false,
            });
        }

        const layoutDto = new UpdateDashboardLayoutDto();

        layoutDto.layoutSettings = layout;

        await this.updateDashboardLayout(createdDashboard.id, layoutDto);

        return createdDashboard;
    }

    async createDashboard(
        {folderIds, dashboardName, isFavourite, dashboardType, isDefault, description, members, isSystem}: CreateDashboardDto,
        userId: string
    ): Promise<DashboardDto> {
        try {
            folderIds = folderIds || [];
            members = members || [];

            if (members?.find((member) => member.id === userId)) {
                throw new ForbiddenException(`User ${userId} is an owner of the dashboard`);
            }

            await Promise.all(
                folderIds.map(async (folderId) => {
                    const hasPermissions = await this.authorization.getUserHasPermissions(
                        userId,
                        PermissionOptions.OWNER_FULL_EDITOR_READ,
                        EntityTypeOptions.Folder,
                        folderId
                    );
                    if (!hasPermissions) {
                        throw new ForbiddenException(`Folder ${folderId} is forbidden for user ${userId}`);
                    }
                    return folderId;
                })
            );

            const newDashboard = this.dashboardRepo.create({
                dashboardName,
                dashboardType,
                description,
                isSystem,
                createdBy: userId,
                createdDate: new Date(),
            });

            const savedDashboard = await this.dashboardRepo.save(newDashboard);

            if (isDefault) {
                const defaultDashboard = await this.defaultDashboardUserRepo.findOne({where: {userId}});

                if (defaultDashboard) {
                    defaultDashboard.dashboardId = savedDashboard.id;

                    await this.defaultDashboardUserRepo.save(defaultDashboard);
                } else {
                    await this.defaultDashboardUserRepo.save({
                        dashboardId: savedDashboard.id,
                        userId,
                    });
                }
            }

            if (typeof isFavourite === 'boolean') {
                if (isFavourite) {
                    await this.favouriteDashboardUserRepo.save({
                        dashboardId: savedDashboard.id,
                        userId,
                    });
                }
            }

            await Promise.all(
                folderIds.map(async (folderId) => {
                    await this.dashboardFolderRepo.save({
                        dashboardId: savedDashboard.id,
                        folderId: folderId,
                    });
                })
            );

            await this.authorization.grantOwner(EntityTypeOptions.Dashboard, userId, savedDashboard.id);

            if (members?.length) {
                await this.setDashboardMembersInternal(savedDashboard.id, members);
            }

            const storedDashboard = await this.dashboardRepo.findOne({
                where: {id: savedDashboard.id},
                relations: {CreatedBy: true, LastModifiedBy: true, LastAccessedBy: true, isDefault: true, isFavourite: true},
            });

            const related = await this.dashboardFolderRepo.find({
                where: {dashboardId: storedDashboard.id},
                relations: {Folder: true},
            });
            const updatedFolders = related.map((relation) => {
                return relation.Folder;
            });

            const dashboardMembers = await this.getDashboardMembersWithPermissions(storedDashboard.id);

            const storedDashboardDto = new DashboardDto(storedDashboard);
            storedDashboardDto.members = dashboardMembers;
            storedDashboardDto.folders = updatedFolders;

            return storedDashboardDto;
        } catch (error) {
            this.logger.log({level: 'error', message: `Error creating dashboard in folders with ids ${folderIds}:` + error, error});
            throw error;
        }
    }

    async duplicateDashboard(existingDashboardId: number, userId: string): Promise<DashboardDto> {
        try {
            const existingDashboard = await this.dashboardRepo
                .createQueryBuilder('dashboard')
                .leftJoinAndSelect('dashboard.folders', 'folders')
                .where('dashboard.id = :id', {id: existingDashboardId})
                .getOne();

            if (!existingDashboard) {
                throw new NotFoundException(`Dashboard with id ${existingDashboardId} not found`);
            }
            await Promise.all(
                existingDashboard.folders.map(async (folder) => {
                    const hasPermissions = await this.authorization.getUserHasPermissions(
                        userId,
                        PermissionOptions.OWNER_FULL_EDITOR_READ,
                        EntityTypeOptions.Folder,
                        folder.folderId
                    );
                    if (!hasPermissions) {
                        throw new ForbiddenException(`Folder ${folder.id} is forbidden for user ${userId}`);
                    }
                    return folder.id;
                })
            );

            const newDashboard = this.dashboardRepo.create({
                dashboardName: `${existingDashboard.dashboardName} - Copy`,
                dashboardType: existingDashboard.dashboardType,
                description: existingDashboard.description,
                createdBy: userId,
                createdDate: new Date(),
            });

            const savedDashboard = await this.dashboardRepo.save(newDashboard);

            const storedDashboard = await this.dashboardRepo.findOne({
                where: {id: savedDashboard.id},
                relations: ['CreatedBy', 'LastModifiedBy', 'LastAccessedBy', 'folders'],
            });

            await this.authorization.grantOwner(EntityTypeOptions.Dashboard, userId, storedDashboard.id);

            await Promise.all(
                existingDashboard.folders.map(async (folder) => {
                    await this.dashboardFolderRepo.save({
                        dashboardId: storedDashboard.id,
                        folderId: folder.folderId,
                    });
                })
            );

            const dashboardMembers = await this.getDashboardMembersWithPermissions(existingDashboardId);

            if (dashboardMembers?.length) {
                await this.setDashboardMembersInternal(
                    storedDashboard.id,
                    dashboardMembers.map((member) => {
                        return {
                            id: member.id,
                            userPermission: member.userPermission,
                        };
                    })
                );
            }

            const dashboardRelations = await this.dashboardFolderRepo.find({
                where: {dashboardId: storedDashboard.id},
                relations: ['Folder'],
            });
            const relatedFolders = dashboardRelations.map((relation) => relation.Folder);

            const storedDashboardDto = new DashboardDto(storedDashboard);
            storedDashboardDto.members = dashboardMembers;
            storedDashboardDto.folders = relatedFolders;

            await this.widgetsService.duplicateDashboardWidgets(existingDashboardId, storedDashboard.id);

            return storedDashboardDto;
        } catch (e) {
            this.logger.error(`Error duplicating dashboard with id ${existingDashboardId}`, e);
            throw e;
        }
    }

    private async setDashboardMembersInternal(dashboardId: number, members: DashboardMembersDto[]): Promise<void> {
        for (const member of members) {
            await this.addPermissions(dashboardId, member);
        }
    }

    private async revokeAllPermissions(userId: string, dashboardId: number): Promise<void> {
        await this.authorization.revokeFromUser(
            PermissionOptions.CREATE_READ_UPDATE_DELETE | PermissionOptions.EDITOR_FULL,
            EntityTypeOptions.Dashboard,
            userId,
            dashboardId
        );
    }

    private async addPermissions(dashboardId: number, genericMemberDto: DashboardMembersDto): Promise<void> {
        if (genericMemberDto.userPermission == UserPermissionOptions.FULL) {
            await this.authorization.grantToUser(
                PermissionOptions.READ_UPDATE_DELETE | PermissionOptions.FULL,
                EntityTypeOptions.Dashboard,
                genericMemberDto.id,
                dashboardId
            );
        } else if (genericMemberDto.userPermission == UserPermissionOptions.EDITOR) {
            await this.authorization.grantToUser(
                PermissionOptions.READ_UPDATE | PermissionOptions.EDITOR,
                EntityTypeOptions.Dashboard,
                genericMemberDto.id,
                dashboardId
            );
        } else if (genericMemberDto.userPermission == UserPermissionOptions.READONLY) {
            await this.authorization.grantToUser(PermissionOptions.READ, EntityTypeOptions.Dashboard, genericMemberDto.id, dashboardId);
        }
    }

    private convertUserPermissionsToEnum(permissions: number): UserPermissionOptions {
        if (permissions == PermissionOptions.OWNER) {
            return UserPermissionOptions.OWNER;
        } else if (permissions == (PermissionOptions.READ_UPDATE_DELETE | PermissionOptions.FULL)) {
            return UserPermissionOptions.FULL;
        } else if (permissions == (PermissionOptions.READ_UPDATE | PermissionOptions.EDITOR)) {
            return UserPermissionOptions.EDITOR;
        } else if (permissions == PermissionOptions.READ) {
            return UserPermissionOptions.READONLY;
        } else {
            return UserPermissionOptions.NONE;
        }
    }

    private async getDashboardMembersWithPermissions(dashboardId: number): Promise<MemberInfoDto[]> {
        const membersByPermissions = await this.repoAssignedPermission.find({
            where: {entityId: dashboardId.toString(), entityType: EntityTypeOptions.Dashboard, permissions: MoreThan(0)},
        });

        const membersWithPermissions = await Promise.all(
            membersByPermissions.map(async (member) => {
                const user = await this.userRepository.findOne({where: {id: member.userId}});

                if (user) {
                    const userDto = new MemberInfoDto(user, this.convertUserPermissionsToEnum(member.permissions));
                    return userDto;
                } else {
                    return null;
                }
            })
        );
        const filteredMembers = membersWithPermissions.filter((member) => member !== null);

        return filteredMembers;
    }
}
