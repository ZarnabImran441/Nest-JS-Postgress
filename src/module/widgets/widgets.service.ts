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
import {InjectRepository} from '@nestjs/typeorm';
import {WidgetEntity} from '../../model/widget.entity';
import {DataSource, In, Not, Repository, SelectQueryBuilder} from 'typeorm';
import {CreateWidgetCategoryDto, UpdateWidgetCategoryDto, WidgetCategoryDto} from '../../dto/widget/widget-category.dto';
import {WidgetCategoriesEntity} from '../../model/widget-category.entity';
import {WidgetTypesEntity} from '../../model/widget-types.entity';
import {CreateWidgetTypesDto, UpdateWidgetTypeDto, WidgetTypesDto} from '../../dto/widget/widget-types.dto';
import {
    CreateWidgetDto,
    GetFilteredWidgetDto,
    UpdateWidgetDto,
    WidgetDto,
    WidgetProgressCountDto,
    WidgetStatsCountDto,
} from '../../dto/widget/widget.dto';
import {DashboardEntity} from '../../model/dashboard.entity';
import {FolderEntity} from '../../model/folder.entity';
import {WorkFlowEntity} from '../../model/workflow.entity';
import {TaskRelationEntity} from '../../model/task-relation.entity';
import {WidgetsRelationEntity} from '../../model/widget-relation.entity';
import {TaskEntity} from '../../model/task.entity';
import {AuthorizationImplService} from '../authorization-impl/authorization-impl.service';
import {ABSTRACT_AUTHORIZATION_SERVICE} from '@lib/base-library';
import {EntityTypeOptions, PermissionOptions} from '../authorization-impl/authorization.enum';
import {WidgetFilterDatePartOptions, WidgetFilterTypeNameColumnOptions, WidgetFilterTypeNameOptions} from '../../enum/widget-filter.enum';
import {WidgetTaskDto} from '../../dto/widget/widget-task-dto';
import {FolderRelationEntity} from '../../model/folder-relation.entity';
import {ApprovalEntity} from '../../model/approval.entity';
import {ApprovalStatusOptions} from '../../enum/approval-status.enum';
import {UserEntity} from '../../model/user.entity';
import {WidgetCountByOptions, WidgetCustomGroupByOptions, WidgetResultCountTypeOptions} from '../../enum/widget.enum';
import {CustomFieldDefinitionEntity} from '../../model/custom-field-definition.entity';
import {CustomFieldDefinitionTypeOptions} from '../../enum/custom-field-definition.enum';
import {TaskAttachmentEntity} from '../../model/task-attachment.entity';
import {AssignedPermissionEntity} from '../../model/assigned-permission.entity';
import {FolderTypeOptions} from '../../enum/folder.enum';

const taskQueryAlias = 'task';

@Injectable()
export class WidgetsService {
    private readonly logger = new Logger(WidgetsService.name);
    constructor(
        @InjectRepository(WidgetEntity) private readonly widgetRepo: Repository<WidgetEntity>,
        @InjectRepository(WidgetCategoriesEntity) private readonly widgetCategoryRepo: Repository<WidgetCategoriesEntity>,
        @InjectRepository(WidgetTypesEntity) private readonly widgetTypesRepo: Repository<WidgetTypesEntity>,
        @InjectRepository(DashboardEntity) private readonly dashboardRepo: Repository<DashboardEntity>,
        @InjectRepository(FolderEntity) private readonly folderRepo: Repository<FolderEntity>,
        @InjectRepository(FolderRelationEntity) private readonly FolderRelationRepo: Repository<FolderRelationEntity>,
        @InjectRepository(WorkFlowEntity) private readonly workflowRepo: Repository<WorkFlowEntity>,
        @InjectRepository(TaskRelationEntity) private readonly taskRelationRepo: Repository<TaskRelationEntity>,
        @InjectRepository(TaskAttachmentEntity) private readonly taskAttachmentRepository: Repository<TaskAttachmentEntity>,
        @InjectRepository(TaskEntity) private readonly tasksRepo: Repository<TaskEntity>,
        @InjectRepository(WidgetsRelationEntity) private readonly widgetRelationRepo: Repository<WidgetsRelationEntity>,
        @InjectRepository(ApprovalEntity) private readonly approvalRepo: Repository<ApprovalEntity>,
        @InjectRepository(UserEntity) private readonly userRepository: Repository<UserEntity>,
        @InjectRepository(CustomFieldDefinitionEntity) private readonly customFieldDefinitionRepo: Repository<CustomFieldDefinitionEntity>,
        @Inject(ABSTRACT_AUTHORIZATION_SERVICE) protected readonly authorization: AuthorizationImplService,
        protected readonly dataSource: DataSource
    ) {}

    async findAllWidgetCategories(): Promise<WidgetCategoryDto[]> {
        const categories = await this.widgetCategoryRepo.find();
        const categoriesDto = [];

        categories.map((category) => {
            const widgetDto = new WidgetCategoryDto(category);
            categoriesDto.push(widgetDto);
        });

        return categoriesDto;
    }

    async findAllWidgetTypes(): Promise<WidgetTypesDto[]> {
        const types = await this.widgetTypesRepo.find();

        const typesDto = [];

        types.map((type) => {
            const widgetDto = new WidgetTypesDto(type);
            typesDto.push(widgetDto);
        });

        return typesDto;
    }

    async getTypesByCategory(categoryId: number): Promise<WidgetTypesDto[]> {
        const categoryExist = this.widgetCategoryRepo.findOne({where: {id: categoryId}});

        if (!categoryExist) {
            throw new NotFoundException(`Category ${categoryId} not found`);
        }

        const types = await this.widgetTypesRepo.find({where: {widgetCategoryId: categoryId}});

        const typesDto = [];

        types.map((type) => {
            const widgetDto = new WidgetTypesDto(type);
            typesDto.push(widgetDto);
        });

        return typesDto;
    }

    async createWidgetCategory(createCategoryDto: CreateWidgetCategoryDto): Promise<WidgetCategoryDto> {
        const existWidget = await this.widgetCategoryRepo.findOne({where: {name: createCategoryDto.name}});

        if (existWidget) {
            throw new HttpException('Widget category already exists', HttpStatus.BAD_REQUEST);
        }

        const widget = this.widgetCategoryRepo.create(createCategoryDto);
        const savedCategory = await this.widgetCategoryRepo.save(widget);

        return new WidgetCategoryDto(savedCategory);
    }

    async createWidgetType(createWidgetTypesDto: CreateWidgetTypesDto): Promise<WidgetTypesDto> {
        const {widgetCategoryId, name} = createWidgetTypesDto;

        const existWidget = await this.widgetTypesRepo.findOne({where: {name, widgetCategoryId}});

        if (existWidget) {
            throw new HttpException('Widget type already exists', HttpStatus.BAD_REQUEST);
        }

        const widgetCategory = this.widgetCategoryRepo.findOne({where: {id: widgetCategoryId}});

        if (!widgetCategory) {
            throw new HttpException('Widget category not found', HttpStatus.NOT_FOUND);
        }

        const widget = this.widgetTypesRepo.create(createWidgetTypesDto);

        const savedType = await this.widgetTypesRepo.save(widget);

        return new WidgetTypesDto(savedType);
    }

    async createWidget(createWidgetDto: CreateWidgetDto, userId: string): Promise<WidgetDto> {
        const {widgetTypeId, dashboardId, name, description, filters, folderIds, query, apiUrl} = createWidgetDto;

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

        const hasPermissionsForDashboard = await this.authorization.getUserHasPermissions(
            userId,
            PermissionOptions.OWNER_FULL_EDITOR_READ,
            EntityTypeOptions.Dashboard,
            dashboardId
        );

        if (!hasPermissionsForDashboard) {
            throw new ForbiddenException(`Dashboard ${dashboardId} is forbidden for user ${userId}`);
        }

        const dashboard = await this.dashboardRepo.findOne({where: {id: dashboardId}});

        const folders = await this.folderRepo.find({where: {id: In(folderIds)}});

        if (!folders.length && !dashboard.isSystem) {
            throw new HttpException('Folders not found', HttpStatus.NOT_FOUND);
        }

        const widgetType = await this.widgetTypesRepo.findOne({where: {id: widgetTypeId}});

        if (!widgetType) {
            throw new HttpException('Widget type not found', HttpStatus.NOT_FOUND);
        }

        if (!dashboard) {
            throw new HttpException('Dashboard not found', HttpStatus.NOT_FOUND);
        }

        const widget = this.widgetRepo.create({
            name,
            description,
            widgetTypeId,
            dashboardId,
            filters,
            query,
            apiUrl,
        });

        const savedWidget = await this.widgetRepo.save(widget);

        await Promise.all(
            folders.map(async (folder) => {
                await this.widgetRelationRepo.save({
                    widgetId: savedWidget.id,
                    folderId: folder.id,
                });
            })
        );

        return new WidgetDto(savedWidget, dashboardId, folderIds, widgetType);
    }

    async getWidgets(dashboardId: number): Promise<WidgetDto[]> {
        const dashboardExists = this.dashboardRepo.findOne({where: {id: dashboardId}});

        if (!dashboardExists) {
            throw new NotFoundException(`Dashboard ${dashboardId} not found`);
        }

        const widgetWithRelations = await this.widgetRelationRepo
            .createQueryBuilder('widgetsRelation')
            .select('widgetsRelation.widgetId')
            .addSelect('widgetsRelation.folderId')
            .leftJoinAndSelect('widgetsRelation.Widget', 'widget')
            .leftJoinAndSelect('widget.widgetType', 'widgetType')
            .where('widget.dashboardId = :dashboardId', {dashboardId})
            .getMany();

        const folderIdsByWidgetId = widgetWithRelations.reduce((acc, relation) => {
            if (!acc[relation.widgetId]) {
                acc[relation.widgetId] = new Set();
            }
            acc[relation.widgetId].add(relation.folderId);
            return acc;
        }, {});

        const widgets = await this.widgetRepo
            .createQueryBuilder('widget')
            .leftJoinAndSelect('widget.widgetType', 'widgetType')
            .where('widget.dashboardId = :dashboardId', {dashboardId})
            .orderBy('widget.id')
            .getMany();

        const widgetsWithFolderIds = widgets.map((widget) => {
            const folderIds: number[] = folderIdsByWidgetId[widget.id];
            return {
                ...widget,
                folderIds: folderIds ? Array.from(folderIds) : [],
            };
        });

        return widgetsWithFolderIds.map((widget) => new WidgetDto(widget, widget.dashboardId, widget.folderIds, widget.widgetType));
    }

    private async getFoldersByUser(userId): Promise<number[]> {
        const userFolders = await this.authorization.getRecursiveIdsForUser(
            userId,
            EntityTypeOptions.Folder,
            PermissionOptions.OWNER_FULL_EDITOR_READ
        );

        return Array.from(new Set(userFolders.map((folder) => folder.id)));
    }

    private async createQueryWithFiltersForTaskList(
        widget: WidgetEntity,
        widgetDto: GetFilteredWidgetDto,
        userId: string
    ): Promise<{
        taskQuery: SelectQueryBuilder<TaskEntity>;
        taskRelations: TaskRelationEntity[];
        tasksIds: number[];
    } | null> {
        const dashboard = await this.dashboardRepo.findOne({where: {id: widget.dashboardId}, relations: ['folders']});

        if (!dashboard) {
            return null;
        }

        if (!widget) {
            return null;
        }

        let folderIds: number[] = widget.Widget?.map((widgetRelation) => widgetRelation.folderId) || [];

        if (folderIds.length === 0) {
            folderIds = await this.getFoldersByUser(userId);
        }

        let notFolderIds: number[] = [];
        const filters = widgetDto.filters || widget.filters || [];

        if (widgetDto.globalFilters && widgetDto.globalFilters.length) {
            const filterMap = {};

            filters.forEach((item, index) => (filterMap[item.name] = index));

            widgetDto.globalFilters.forEach((filter) => {
                if (filterMap[filter.name]) {
                    if (filter.condition) {
                        filters[filterMap[filter.name]] = filter;
                    } else {
                        const originalFilter = filters[filterMap[filter.name]];

                        if (originalFilter.condition) {
                            filter.values.forEach((value: string | number) => {
                                originalFilter.values = originalFilter.values as string[];

                                const index = originalFilter.values.indexOf(value as string);

                                if (index !== -1) {
                                    originalFilter.values.splice(index, 1);
                                }
                            });
                        } else {
                            originalFilter.values = originalFilter.values as string[];
                            filter.values = filter.values as string[];

                            originalFilter.values.push(...filter.values);
                        }
                    }
                } else {
                    filters.push(filter);
                }
            });
        }

        let projectIds: number[];
        let noProjectIds: number[];

        if (!folderIds.length) {
            folderIds = dashboard.folders?.map((folder) => folder.folderId);
        }

        const taskQuery = this.tasksRepo.createQueryBuilder(taskQueryAlias);
        const taskRelationQuery = this.taskRelationRepo.createQueryBuilder('taskRelations');

        filters.forEach((filter) => {
            switch (filter.name) {
                case WidgetFilterTypeNameOptions.Folder:
                    if (filter.condition) {
                        folderIds = folderIds.length
                            ? (filter.values.filter((item) => folderIds.includes(item as number)) as number[])
                            : (filter.values as number[]) || [];
                    } else {
                        notFolderIds = (filter.values as number[]) || [];
                    }
                    break;

                case WidgetFilterTypeNameOptions.Project:
                    if (filter.condition) {
                        projectIds = folderIds.length
                            ? (filter.values.filter((item) => folderIds.includes(item as number)) as number[])
                            : (filter.values as number[]) || [];
                    } else {
                        noProjectIds = (filter.values as number[]) || [];
                    }
                    break;

                case WidgetFilterTypeNameOptions.Assignee:
                    const query = filter.condition
                        ? `"${taskQueryAlias}"."${WidgetFilterTypeNameColumnOptions.assignee}" @> ARRAY[:...assignees]`
                        : `NOT ("${taskQueryAlias}"."${WidgetFilterTypeNameColumnOptions.assignee}" @> ARRAY[:...assignees]`;

                    if (filter.values.length) {
                        taskQuery.andWhere(query, {
                            assignees: filter.values,
                        });
                    }
                    break;

                case WidgetFilterTypeNameOptions.Importance:
                    taskQuery.andWhere(
                        `"${taskQueryAlias}"."${WidgetFilterTypeNameColumnOptions.importance}" ${
                            filter.condition ? 'IN' : 'NOT IN'
                        } (:...values)`,
                        {
                            values: filter.values,
                        }
                    );
                    break;

                case WidgetFilterTypeNameOptions.Status:
                    taskRelationQuery.leftJoinAndSelect('taskRelations.WorkFlowState', WidgetFilterTypeNameColumnOptions.status);
                    taskRelationQuery.andWhere(
                        `"${WidgetFilterTypeNameColumnOptions.status}"."id" ${filter.condition ? 'IN' : 'NOT IN'} (:...values)`,
                        {
                            values: filter.values,
                        }
                    );

                    break;

                case WidgetFilterTypeNameOptions.Tags:
                    taskQuery.leftJoinAndSelect(
                        `${taskQueryAlias}.Tags`,
                        WidgetFilterTypeNameColumnOptions.tags,
                        `${WidgetFilterTypeNameColumnOptions.tags}.taskId = ${taskQueryAlias}.id`
                    );

                    taskQuery.andWhere(
                        `"${WidgetFilterTypeNameColumnOptions.tags}"."tag_id" ${filter.condition ? 'IN' : 'NOT IN'} (:...values)`,
                        {
                            values: filter.values,
                        }
                    );
                    break;

                case WidgetFilterTypeNameOptions.Approvals:
                    taskQuery.leftJoinAndSelect(
                        `${taskQueryAlias}.${WidgetFilterTypeNameOptions.Approvals}`,
                        WidgetFilterTypeNameOptions.Approvals
                    );
                    taskQuery.andWhere(
                        `${WidgetFilterTypeNameOptions.Approvals}.status ${filter.condition ? 'IN' : 'NOT IN'} (:...values)`,
                        {values: filter.values}
                    );
                    break;

                default:
                    taskQuery.andWhere(`"${taskQueryAlias}"."${filter.name}" ${filter.condition ? 'IN' : 'NOT IN'} (:values)`, {
                        values: filter.values,
                    });
                    break;
            }
        });

        if (projectIds) {
            folderIds.push(...projectIds);
        }

        if (noProjectIds) {
            notFolderIds.push(...noProjectIds);
        }

        if (folderIds.length) {
            taskRelationQuery.andWhere({folderId: In(folderIds)});
        }

        if (notFolderIds.length) {
            taskRelationQuery.andWhere({folderId: Not(In(notFolderIds))});
        }

        taskRelationQuery.leftJoinAndSelect('taskRelations.WorkFlowState', 'workflow_state');
        const taskRelations = await taskRelationQuery.getMany();

        if (!taskRelations || !taskRelations.length) {
            return null;
        }

        const tasksIds = taskRelations.map((relation) => relation.childTaskId);

        taskQuery.andWhere(`${taskQueryAlias}.id IN (:...ids)`, {ids: tasksIds});

        return {taskQuery, taskRelations, tasksIds};
    }

    private prepareTask(task: TaskEntity, taskRelations: TaskRelationEntity[]): WidgetTaskDto {
        const workflow = taskRelations.find((relation) => relation.childTaskId === task.id);

        return new WidgetTaskDto(task, workflow.WorkFlowState);
    }

    async getWidgetTasks(id: number, widgetDto: GetFilteredWidgetDto, userId: string): Promise<WidgetTaskDto[]> {
        const widget = await this.widgetRepo.findOne({where: {id}, relations: ['Widget']});

        if (!widget) {
            return [];
        }

        const taskQueryFiltered = await this.createQueryWithFiltersForTaskList(widget, widgetDto, userId);

        const taskQuery = taskQueryFiltered?.taskQuery;
        const taskRelations = taskQueryFiltered?.taskRelations;

        if (!taskQuery || !taskRelations) {
            return [];
        }

        taskQuery
            .leftJoinAndSelect(`${taskQueryAlias}.ChildrenTasks`, 'child_tasks')
            .leftJoinAndSelect('child_tasks.Folder', 'folder')
            .leftJoinAndSelect('child_tasks.WorkFlowState', 'workflow_state')
            .leftJoinAndSelect('task.Tags', 'tags', `tags.taskId = task.id`)
            .leftJoinAndSelect(`${taskQueryAlias}.Attachments`, 'attachments');

        const tasks = await taskQuery.getMany();

        return tasks.map((task) => {
            return new WidgetTaskDto(task, task.ChildrenTasks[0].WorkFlowState);
        });
    }

    async getWidgetApprovals(id: number, widgetDto: GetFilteredWidgetDto, userId: string): Promise<ApprovalEntity[]> {
        const widget = await this.widgetRepo.findOne({where: {id}, relations: ['Widget']});

        if (!widget) {
            return [];
        }

        const taskQueryFiltered = await this.createQueryWithFiltersForTaskList(widget, widgetDto, userId);

        const taskQuery = taskQueryFiltered?.taskQuery;
        const taskRelations = taskQueryFiltered?.taskRelations;

        if (!taskQuery || !taskRelations) {
            return [];
        }

        taskQuery
            .leftJoinAndSelect(`${taskQueryAlias}.ChildrenTasks`, 'child_tasks')
            .leftJoinAndSelect('child_tasks.Folder', 'folders')
            .leftJoinAndSelect(`${taskQueryAlias}.Attachments`, 'attachments');

        const tasks = await taskQuery.getMany();

        const taskIds = tasks.map((task) => task.id);

        return await this.approvalRepo.find({
            where: {task: In(taskIds)},
            relations: ['task', 'task.ChildrenTasks'],
        });
    }

    async getWidgetNewFoldersCount(id: number, filter: GetFilteredWidgetDto, userId: string): Promise<WidgetStatsCountDto> {
        const widget = await this.widgetRepo
            .createQueryBuilder('widget')
            .where({id})
            .leftJoinAndSelect('widget.Widget', 'widgets')
            .getOne();

        if (!widget) {
            return null;
        }

        const result = {
            current: {
                count: 0,
                folders: [],
            },
            past: {
                count: 0,
                folders: [],
            },
            prev: {
                count: 0,
                folders: [],
            },
        };

        let folderIds: number[] = widget.Widget?.map((widgetRelation) => widgetRelation.folderId) || [];
        let ids = [];

        if (folderIds.length === 0) {
            folderIds = await this.getFoldersByUser(userId);
        }

        filter.globalFilters?.forEach((filter) => {
            if (filter.name === WidgetFilterTypeNameOptions.Folder) {
                folderIds = filter.values as number[];
            }
        });

        if (folderIds.length) {
            const folderRelations = await this.FolderRelationRepo.find({select: ['childFolderId'], where: {parentFolderId: In(folderIds)}});

            ids = folderRelations.map((item) => item.childFolderId);
            folderIds.push(...ids);
        } else {
            return result;
        }

        const period = filter?.query?.period || widget?.query?.period || WidgetFilterDatePartOptions.MONTH;

        const currentQuery = this.folderRepo
            .createQueryBuilder('folder')
            .leftJoin(AssignedPermissionEntity, 'AP', 'AP.entity_id = folder.ID::text')
            .andWhere(`folder.created_at >= CURRENT_DATE - INTERVAL '1 ${period}'`)
            .andWhere('folder.folderType = :type', {
                type: FolderTypeOptions.FOLDER,
            })
            .andWhere(
                `AP.banned = false
                AND AP.entity_type = '${EntityTypeOptions.Folder}'
                AND (AP.permissions & ${PermissionOptions.OWNER}) > 0
                AND folder.archived_by IS NULL`
            );

        const prevQuery = this.folderRepo
            .createQueryBuilder('folder')
            .leftJoin(AssignedPermissionEntity, 'AP', 'AP.entity_id = folder.ID::text')
            .andWhere(
                `folder.created_at >= CURRENT_DATE - INTERVAL '2 ${period}' AND folder.created_at < CURRENT_DATE - INTERVAL '1 ${period}'`
            )
            .andWhere('folder.folderType = :type', {
                type: FolderTypeOptions.FOLDER,
            })
            .andWhere(
                `AP.banned = false
                AND AP.entity_type = '${EntityTypeOptions.Folder}'
                AND (AP.permissions & ${PermissionOptions.OWNER}) > 0
                AND folder.archived_by IS NULL`
            );

        const pastQuery = this.folderRepo
            .createQueryBuilder('folder')
            .leftJoin(AssignedPermissionEntity, 'AP', 'AP.entity_id = folder.ID::text')
            .andWhere(`folder.created_at <= CURRENT_DATE - INTERVAL '2 ${period}'`)
            .andWhere('folder.folderType = :type', {
                type: FolderTypeOptions.FOLDER,
            })
            .andWhere(
                `AP.banned = false
                AND AP.entity_type = '${EntityTypeOptions.Folder}'
                AND (AP.permissions & ${PermissionOptions.OWNER}) > 0
                AND folder.archived_by IS NULL`
            );

        if (folderIds.length) {
            currentQuery.andWhere({id: In(folderIds)});
            prevQuery.andWhere({id: In(folderIds)});
            pastQuery.andWhere({id: In(folderIds)});
        }
        result.current.folders = await currentQuery.getMany();
        result.current.count = result.current.folders.length;
        result.prev.folders = await prevQuery.getMany();
        result.prev.count = result.prev.folders.length;
        result.past.folders = await pastQuery.getMany();
        result.past.count = result.past.folders.length;

        return result;
    }

    async getWidgetAttachmentsCount(id: number, filter: GetFilteredWidgetDto, userId: string): Promise<WidgetStatsCountDto> {
        const widget = await this.widgetRepo
            .createQueryBuilder('widget')
            .where({id})
            .leftJoinAndSelect('widget.Widget', 'widgets')
            .getOne();

        if (!widget) {
            return null;
        }

        const result = {
            current: {
                count: 0,
                tasks: [],
            },
            past: {
                count: 0,
                tasks: [],
            },
            prev: {
                count: 0,
                tasks: [],
            },
        };

        const taskQueryFiltered = await this.createQueryWithFiltersForTaskList(widget, filter, userId);

        const taskQuery = taskQueryFiltered?.taskQuery;
        const taskRelations = taskQueryFiltered?.taskRelations;

        if (!taskQuery || !taskRelations) {
            return result;
        }

        const tasks = await taskQuery.getMany();

        if (!tasks.length) {
            return result;
        }

        const taskIds = tasks.map((task) => {
            return task.id;
        });

        const period = filter?.query?.period || widget?.query?.period || WidgetFilterDatePartOptions.MONTH;

        const currentIds = await this.taskAttachmentRepository
            .createQueryBuilder('TA')
            .andWhere({taskId: In(taskIds)})
            .andWhere(`TA.addedAt >= CURRENT_DATE - INTERVAL '1 ${period}'`)
            .select(['TA.taskId'])
            .getMany();

        const prevIds = await this.taskAttachmentRepository
            .createQueryBuilder('TA')
            .andWhere({taskId: In(taskIds)})
            .andWhere(`TA.addedAt >= CURRENT_DATE - INTERVAL '2 ${period}' AND TA.addedAt < CURRENT_DATE - INTERVAL '1 ${period}'`)
            .select(['TA.taskId'])
            .getMany();

        const pastIds = await this.taskAttachmentRepository
            .createQueryBuilder('TA')
            .andWhere({taskId: In(taskIds)})
            .andWhere(`TA.addedAt <= CURRENT_DATE - INTERVAL '2 ${period}'`)
            .select(['TA.taskId'])
            .getMany();

        if (prevIds.length) {
            const prevTasks = await this.tasksRepo
                .createQueryBuilder('task')
                .leftJoinAndSelect('task.ChildrenTasks', 'taskRelation')
                .leftJoinAndSelect('taskRelation.Folder', 'folder')
                .andWhere({id: In(prevIds.map((item) => item.taskId))})
                .getMany();

            result.prev.tasks = prevTasks.map((task) => this.prepareTask(task, taskRelations));
            result.prev.count = prevTasks.length;
        }

        if (pastIds.length) {
            const pastTasks = await this.tasksRepo
                .createQueryBuilder('task')
                .leftJoinAndSelect('task.ChildrenTasks', 'taskRelation')
                .leftJoinAndSelect('taskRelation.Folder', 'folder')
                .andWhere({id: In(pastIds.map((item) => item.taskId))})
                .getMany();

            result.past.tasks = pastTasks.map((task) => this.prepareTask(task, taskRelations));
            result.past.count = pastTasks.length;
        }

        if (currentIds.length) {
            const currentTasks = await this.tasksRepo
                .createQueryBuilder('task')
                .leftJoinAndSelect('task.ChildrenTasks', 'taskRelation')
                .leftJoinAndSelect('taskRelation.Folder', 'folder')
                .andWhere({id: In(currentIds.map((item) => item.taskId))})
                .getMany();

            result.current.tasks = currentTasks.map((task) => this.prepareTask(task, taskRelations));
            result.current.count = currentTasks.length;
        }

        return result;
    }

    async getWidgetNewTasksCount(id: number, filter: GetFilteredWidgetDto, userId: string): Promise<WidgetStatsCountDto> {
        const widget = await this.widgetRepo
            .createQueryBuilder('widget')
            .where({id})
            .leftJoinAndSelect('widget.Widget', 'widgets')
            .getOne();

        if (!widget) {
            return null;
        }

        const result = {
            current: {
                count: 0,
                tasks: [],
            },
            past: {
                count: 0,
                tasks: [],
            },
            prev: {
                count: 0,
                tasks: [],
            },
        };

        const taskQueryFiltered = await this.createQueryWithFiltersForTaskList(widget, filter, userId);

        const taskQuery = taskQueryFiltered?.taskQuery;
        const taskRelations = taskQueryFiltered?.taskRelations;

        if (!taskQuery || !taskRelations) {
            return result;
        }

        const taskList = await taskQuery.getMany();

        if (!taskList.length) {
            return result;
        }

        const taskIds = taskList.map((task) => {
            return task.id;
        });

        const period = filter?.query?.period || widget?.query?.period || WidgetFilterDatePartOptions.MONTH;

        const prevTasks = await this.tasksRepo
            .createQueryBuilder('task')
            .leftJoinAndSelect('task.ChildrenTasks', 'taskRelation')
            .leftJoinAndSelect('taskRelation.Folder', 'folder')
            .andWhere('task.archived_at IS NULL AND task.deleted_at IS NULL')
            .andWhere({id: In(taskIds)})
            .andWhere(
                `task.start_date >= CURRENT_DATE - INTERVAL '2 ${period}' AND task.start_date < CURRENT_DATE - INTERVAL '1 ${period}'`
            )
            .getMany();

        result.prev.tasks = prevTasks.map((task) => this.prepareTask(task, taskRelations));
        result.prev.count = prevTasks.length;

        const pastTasks = await this.tasksRepo
            .createQueryBuilder('task')
            .leftJoinAndSelect('task.ChildrenTasks', 'taskRelation')
            .leftJoinAndSelect('taskRelation.Folder', 'folder')
            .andWhere('task.archived_at IS NULL AND task.deleted_at IS NULL')
            .andWhere({id: In(taskIds)})
            .andWhere(`task.start_date <= CURRENT_DATE - INTERVAL '2 ${period}'`)
            .getMany();

        result.past.tasks = pastTasks.map((task) => this.prepareTask(task, taskRelations));
        result.past.count = pastTasks.length;

        const currentTasks = await this.tasksRepo
            .createQueryBuilder('task')
            .leftJoinAndSelect('task.ChildrenTasks', 'taskRelation')
            .leftJoinAndSelect('taskRelation.Folder', 'folder')
            .andWhere('task.archived_at IS NULL AND task.deleted_at IS NULL')
            .andWhere({id: In(taskIds)})
            .andWhere(`task.start_date >= CURRENT_DATE - INTERVAL '1 ${period}'`)
            .getMany();

        result.current.tasks = currentTasks.map((task) => this.prepareTask(task, taskRelations));
        result.current.count = currentTasks.length;

        return result;
    }

    async getWidgetCompletedTasksCount(id: number, filter: GetFilteredWidgetDto, userId: string): Promise<WidgetStatsCountDto> {
        this.logger.log('Getting widget completed tasks count...');

        const widget = await this.widgetRepo
            .createQueryBuilder('widget')
            .where({id})
            .leftJoinAndSelect('widget.Widget', 'widgets')
            .getOne();

        if (!widget) {
            this.logger.warn('Widget not found.');
            return null;
        }

        const result: WidgetStatsCountDto = {
            current: {
                count: 0,
                tasks: [],
            },
            past: {
                count: 0,
                tasks: [],
            },
            prev: {
                count: 0,
                tasks: [],
            },
        };

        const taskQueryFiltered = await this.createQueryWithFiltersForTaskList(widget, filter, userId);

        const taskQuery = taskQueryFiltered?.taskQuery;
        const taskRelations = taskQueryFiltered?.taskRelations;

        if (!taskQuery || !taskRelations) {
            return result;
        }

        const taskList = await taskQuery.getMany();

        const period = filter?.query?.period || widget?.query?.period || WidgetFilterDatePartOptions.MONTH;

        if (!taskList.length) {
            this.logger.warn('No tasks found.');
            return result;
        }

        const taskIds = taskList.map((task) => {
            return task.id;
        });

        this.logger.log('Fetching previous tasks...');
        const prevTasks = await this.tasksRepo
            .createQueryBuilder('task')
            .leftJoinAndSelect('task.ChildrenTasks', 'taskRelation')
            .leftJoinAndSelect('taskRelation.Folder', 'folder')
            .andWhere('task.COMPLETED_AT IS NOT NULL AND task.archived_at IS NULL AND task.deleted_at IS NULL')
            .andWhere({id: In(taskIds)})
            .andWhere(
                `task.start_date >= CURRENT_DATE - INTERVAL '2 ${period}' AND task.start_date < CURRENT_DATE - INTERVAL '1 ${period}'`
            )
            .getMany();

        result.prev.tasks = prevTasks.map((task) => this.prepareTask(task, taskRelations));
        result.prev.count = prevTasks.length;

        this.logger.log('Fetching past tasks...');
        const pastTasks = await this.tasksRepo
            .createQueryBuilder('task')
            .leftJoinAndSelect('task.ChildrenTasks', 'taskRelation')
            .leftJoinAndSelect('taskRelation.Folder', 'folder')
            .andWhere('task.COMPLETED_AT IS NOT NULL AND task.archived_at IS NULL AND task.deleted_at IS NULL')
            .andWhere({id: In(taskIds)})
            .andWhere(`task.start_date <= CURRENT_DATE - INTERVAL '2 ${period}'`)
            .getMany();

        result.past.tasks = pastTasks.map((task) => this.prepareTask(task, taskRelations));
        result.past.count = pastTasks.length;

        this.logger.log('Fetching current tasks...');
        const currentTasks = await this.tasksRepo
            .createQueryBuilder('task')
            .leftJoinAndSelect('task.ChildrenTasks', 'taskRelation')
            .leftJoinAndSelect('taskRelation.Folder', 'folder')
            .andWhere('task.COMPLETED_AT IS NOT NULL AND task.archived_at IS NULL AND task.deleted_at IS NULL')
            .andWhere({id: In(taskIds)})
            .andWhere(`task.start_date >= CURRENT_DATE - INTERVAL '1 ${period}'`)
            .getMany();

        result.current.tasks = currentTasks.map((task) => this.prepareTask(task, taskRelations));
        result.current.count = currentTasks.length;

        this.logger.log('Completed fetching tasks.');
        return result;
    }

    async getWidgetApprovalsCount(id: number, filter: GetFilteredWidgetDto, userId: string): Promise<WidgetStatsCountDto> {
        const widget = await this.widgetRepo
            .createQueryBuilder('widget')
            .where({id})
            .leftJoinAndSelect('widget.Widget', 'widgets')
            .getOne();

        if (!widget) {
            return null;
        }

        const result = {
            current: {
                count: 0,
                tasks: [],
            },
            past: {
                count: 0,
                tasks: [],
            },
            prev: {
                count: 0,
                tasks: [],
            },
        };

        const taskQueryFiltered = await this.createQueryWithFiltersForTaskList(widget, filter, userId);

        const taskQuery = taskQueryFiltered?.taskQuery;
        const taskRelations = taskQueryFiltered?.taskRelations;

        if (!taskQuery || !taskRelations) {
            return result;
        }

        const taskList = await taskQuery.getMany();

        if (!taskList.length) {
            return result;
        }

        const taskIds = taskList.map((task) => {
            return task.id;
        });

        const period = filter?.query?.period || widget?.query?.period || WidgetFilterDatePartOptions.MONTH;

        const currentIds = await this.approvalRepo
            .createQueryBuilder('approvals')
            .andWhere({taskId: In(taskIds)})
            .andWhere(`approvals.created_at >= CURRENT_DATE - INTERVAL '1 ${period}'`)
            .getMany();

        const prevIds = await this.approvalRepo
            .createQueryBuilder('approvals')
            .andWhere({taskId: In(taskIds)})
            .andWhere(
                `approvals.created_at >= CURRENT_DATE - INTERVAL '2 ${period}' AND approvals.created_at < CURRENT_DATE - INTERVAL '1 ${period}'`
            )
            .getMany();

        const pastIds = await this.approvalRepo
            .createQueryBuilder('approvals')
            .andWhere({taskId: In(taskIds)})
            .andWhere(`approvals.created_at <= CURRENT_DATE - INTERVAL '2 ${period}'`)
            .getMany();

        if (prevIds.length) {
            const prevTasks = await this.tasksRepo
                .createQueryBuilder('task')
                .leftJoinAndSelect('task.ChildrenTasks', 'taskRelation')
                .leftJoinAndSelect(`${taskQueryAlias}.Attachments`, 'attachments')
                .leftJoinAndSelect('taskRelation.Folder', 'folder')
                .andWhere({id: In(prevIds.map((item) => item.taskId))})
                .getMany();

            result.prev.tasks = prevTasks.map((task) => this.prepareTask(task, taskRelations));
            result.prev.count = prevTasks.length;
        }

        if (pastIds.length) {
            const pastTasks = await this.tasksRepo
                .createQueryBuilder('task')
                .leftJoinAndSelect('task.ChildrenTasks', 'taskRelation')
                .leftJoinAndSelect(`${taskQueryAlias}.Attachments`, 'attachments')
                .leftJoinAndSelect('taskRelation.Folder', 'folder')
                .andWhere({id: In(pastIds.map((item) => item.taskId))})
                .getMany();

            result.past.tasks = pastTasks.map((task) => this.prepareTask(task, taskRelations));
            result.past.count = pastTasks.length;
        }

        if (currentIds.length) {
            const currentTasks = await this.tasksRepo
                .createQueryBuilder('task')
                .leftJoinAndSelect('task.ChildrenTasks', 'taskRelation')
                .leftJoinAndSelect(`${taskQueryAlias}.Attachments`, 'attachments')
                .leftJoinAndSelect('taskRelation.Folder', 'folder')
                .andWhere({id: In(currentIds.map((item) => item.taskId))})
                .getMany();

            result.current.tasks = currentTasks.map((task) => this.prepareTask(task, taskRelations));
            result.current.count = currentTasks.length;
        }

        return result;
    }

    async getWorkflowData(folderIds: number[]): Promise<WorkFlowEntity[]> {
        const queryBuilder = this.workflowRepo.createQueryBuilder('workflow');

        const workflows = await queryBuilder
            .leftJoin('workflow.Folders', 'folders')
            .where('folders.id IN (:...ids)', {ids: folderIds})
            .select([
                'workflow.id',
                'workflow.title',
                'workflow.description',
                'workflow.color',
                'workflow.createdAt',
                'workflow.updatedAt',
                'workflow.active',
            ])
            .getMany();

        return workflows;
    }

    async getWidgetProgressCount(id: number, filter: GetFilteredWidgetDto, userId: string): Promise<WidgetProgressCountDto[]> {
        const widget = await this.widgetRepo
            .createQueryBuilder('widget')
            .where({id})
            .leftJoinAndSelect('widget.Widget', 'widgets')
            .getOne();

        if (!widget) {
            return null;
        }

        const taskQueryFiltered = await this.createQueryWithFiltersForTaskList(widget, filter, userId);

        const taskQuery = taskQueryFiltered?.taskQuery;
        const taskRelations = taskQueryFiltered?.taskRelations;

        if (!taskQuery || !taskRelations) {
            return [];
        }
        const taskCount = await taskQuery.getCount();

        if (taskCount === 0 || !widget?.query?.groupBy) {
            return [];
        }

        const taskMap = {};
        let tasks;
        let groupByFolderType;

        taskQuery.leftJoinAndSelect('task.ChildrenTasks', 'taskRelation');
        taskQuery.leftJoinAndSelect('taskRelation.Folder', 'folder');

        switch (widget.query.groupBy) {
            case WidgetFilterTypeNameOptions.Folder:
                groupByFolderType = FolderTypeOptions.FOLDER;
            case WidgetFilterTypeNameOptions.Project:
                tasks = await taskQuery.getMany();

                if (!groupByFolderType) {
                    groupByFolderType = FolderTypeOptions.PROJECT;
                }

                tasks.forEach((task) => {
                    task.ChildrenTasks.forEach((item) => {
                        const key = item.Folder.id;

                        if (groupByFolderType !== item.Folder.folderType) {
                            return;
                        }

                        taskMap[key] = taskMap[key] || {
                            tasks: [],
                            name: item.Folder.title,
                            color: item.Folder.color,
                            count: 0,
                        };

                        taskMap[key].tasks.push(this.prepareTask(task, taskRelations));
                        taskMap[key].count++;
                    });
                });
                break;

            case WidgetFilterTypeNameOptions.Status:
                taskQuery.leftJoinAndSelect(`taskRelation.WorkFlowState`, `workflowState`);

                tasks = await taskQuery.getMany();

                tasks.forEach((task) => {
                    task.ChildrenTasks.forEach((item) => {
                        const key = item.WorkFlowState.id;

                        taskMap[key] = taskMap[key] || {
                            tasks: [],
                            name: item.WorkFlowState.title,
                            color: item.WorkFlowState.color,
                            count: 0,
                        };

                        taskMap[key].tasks.push(this.prepareTask(task, taskRelations));
                        taskMap[key].count++;
                    });
                });
                break;

            case WidgetFilterTypeNameOptions.Importance:
                taskQuery.leftJoinAndSelect(`task.Importance`, `importance`);

                tasks = await taskQuery.getMany();

                tasks.forEach((task) => {
                    const key = task.Importance.id;

                    taskMap[key] = taskMap[key] || {
                        tasks: [],
                        name: task.Importance.description,
                        color: task.Importance.color,
                        count: 0,
                    };

                    taskMap[key].tasks.push(this.prepareTask(task, taskRelations));
                    taskMap[key].count++;
                });
                break;

            case WidgetFilterTypeNameOptions.Tags:
                if (!widget.filters?.some((filter) => filter.name === WidgetFilterTypeNameOptions.Tags)) {
                    taskQuery.leftJoinAndSelect('task.Tags', WidgetFilterTypeNameOptions.Tags);
                }

                taskQuery.leftJoinAndSelect(`${WidgetFilterTypeNameColumnOptions.tags}.Tag`, 'tag');

                tasks = await taskQuery.getMany();

                tasks.forEach((task) => {
                    if (task.Tags.length) {
                        task.Tags.forEach((item) => {
                            const key = item.Tag.id;

                            taskMap[key] = taskMap[key] || {
                                tasks: [],
                                name: item.Tag.title || `No tags (id: ${key})`,
                                color: item.Tag.color,
                                count: 0,
                            };

                            taskMap[key].tasks.push(this.prepareTask(task, taskRelations));
                            taskMap[key].count++;
                        });
                    } else {
                        const key = 'noTag';

                        taskMap[key] = taskMap[key] || {
                            tasks: [],
                            name: `No tags`,
                            count: 0,
                        };

                        taskMap[key].tasks.push(this.prepareTask(task, taskRelations));
                        taskMap[key].count++;
                    }
                });
                break;

            case WidgetFilterTypeNameOptions.Assignee:
                tasks = await taskQuery.getMany();
                const uniqueIds = new Set();

                tasks.forEach((task) => {
                    if (task.assignees.length) {
                        task.assignees.forEach((item) => {
                            const key = item;

                            uniqueIds.add(key);

                            taskMap[key] = taskMap[key] || {
                                tasks: [],
                                name: 'Undefined user',
                                count: 0,
                            };

                            taskMap[key].tasks.push(this.prepareTask(task, taskRelations));
                            taskMap[key].count++;
                        });
                    } else {
                        const key = 'noAssignee';

                        if (!taskMap[key]) {
                            taskMap[key] = {
                                tasks: [],
                                name: `No assignee`,
                                count: 0,
                            };
                        }
                        taskMap[key].tasks.push(this.prepareTask(task, taskRelations));
                        taskMap[key].count++;
                    }
                });

                const ids = [...uniqueIds.values()] as string[];

                const assignee = await this.userRepository.find({
                    where: {id: In(ids)},
                    select: ['firstName', 'lastName', 'id', 'color'],
                });

                assignee.forEach((item) => {
                    taskMap[item.id].name = `${item.firstName} ${item.lastName}`;
                    taskMap[item.id].color = item.color;
                });
                break;

            case WidgetFilterTypeNameOptions.Approvals:
                if (!widget.filters?.some((filter) => filter.name === WidgetFilterTypeNameOptions.Approvals)) {
                    taskQuery.leftJoinAndSelect(
                        `${taskQueryAlias}.${WidgetFilterTypeNameOptions.Approvals}`,
                        WidgetFilterTypeNameOptions.Approvals
                    );
                }

                tasks = await taskQuery.getMany();

                tasks.forEach((task) => {
                    if (task.approvals.length) {
                        task.approvals.forEach((item) => {
                            const key = item.status;

                            taskMap[key] = taskMap[key] || {
                                tasks: [],
                                name: item.status,
                                count: 0,
                            };

                            taskMap[key].tasks.push(this.prepareTask(task, taskRelations));
                            taskMap[key].count++;
                        });
                    } else {
                        const key = ApprovalStatusOptions.PENDING;

                        taskMap[key] = taskMap[key] || {
                            tasks: [],
                            name: ApprovalStatusOptions.PENDING,
                            count: 0,
                        };

                        taskMap[key].tasks.push(this.prepareTask(task, taskRelations));
                        taskMap[key].count++;
                    }
                });
                break;
        }

        const taskList = [];

        for (const key in taskMap) {
            taskList.push(taskMap[key]);
        }

        return taskList;
    }

    async getWidgetCustomChartCounts(
        id: number,
        widgetDto: GetFilteredWidgetDto,
        userId: string
    ): Promise<
        {
            [x: string | number]: string | number | WidgetTaskDto[] | FolderEntity[];
            tasks?: WidgetTaskDto[];
            name?: string;
            folders?: FolderEntity[];
        }[]
    > {
        const widget = await this.widgetRepo
            .createQueryBuilder('widget')
            .where({id})
            .leftJoinAndSelect('widget.Widget', 'widgets')
            .getOne();

        if (!widget) {
            return null;
        }

        const taskQueryFiltered = await this.createQueryWithFiltersForTaskList(widget, widgetDto, userId);

        const tasksIds = taskQueryFiltered?.tasksIds;
        const taskRelations = taskQueryFiltered?.taskRelations;

        if (!tasksIds || !taskRelations) {
            return null;
        }

        const {countBy, countByCustom, resultCountCustomType = WidgetResultCountTypeOptions.COUNT} = widget.query;
        const folderIds = Array.from(new Set(taskRelations.map((item) => item.folderId)));

        if (countBy === WidgetCountByOptions.BOARDS && folderIds.length === 0) {
            return null;
        }

        if (countBy === WidgetCountByOptions.TASKS && tasksIds.length === 0) {
            return null;
        }

        const taskQuery = this.tasksRepo
            .createQueryBuilder('task')
            .leftJoinAndSelect('task.ChildrenTasks', 'taskRelation')
            .leftJoinAndSelect('taskRelation.Folder', 'folders')
            .where('taskRelation.folderId IN (:...ids)', {ids: folderIds});

        const taskList = await taskQuery.getMany();

        if (!taskList.length || !widget?.query?.groupByCustom) {
            return [];
        }

        let countMethod: string = WidgetResultCountTypeOptions.COUNT;

        if (countByCustom) {
            countMethod = resultCountCustomType === WidgetResultCountTypeOptions.AVERAGE ? 'AVG' : resultCountCustomType;
        }

        if (!countByCustom && !countBy) {
            return [];
        }

        switch (widget.query.groupByCustom) {
            case WidgetCustomGroupByOptions.BOARD:
            case WidgetCustomGroupByOptions.FOLDER:
                const res1 = this.tasksRepo
                    .createQueryBuilder('task')
                    .leftJoinAndSelect(
                        'task.ChildrenTasks',
                        'taskRelation',
                        'task.id = taskRelation.childTaskId AND taskRelation.folderId IN (:...ids)',
                        {
                            ids: folderIds,
                        }
                    )
                    .leftJoin('task.CustomFieldValues', 'cfv', 'task.id = cfv.task_id')

                    .leftJoinAndSelect('taskRelation.Folder', 'folder')
                    .select([
                        'folder.title AS name',
                        'folder.id AS id',
                        'COUNT(task.id) AS tasks',
                        ...(countByCustom && countMethod
                            ? [
                                  `${countMethod}(CASE WHEN cfv.value IS NULL OR cfv.value = '' THEN 0 ELSE CAST(cfv.value AS decimal) END) AS сfcount`,
                              ]
                            : []),
                    ])
                    .where('folder.id IN (:...ids)', {ids: folderIds})
                    .groupBy('folder.id');

                if (countBy === WidgetCountByOptions.BOARDS) {
                    const childFolders = await Promise.all(
                        folderIds.map(async (item) => {
                            const folder = await this.folderRepo
                                .createQueryBuilder('folder')
                                .leftJoinAndSelect('folder.ChildrenFolders', 'childFolders')
                                .select(['folder.title as name', `COUNT(childFolders.childFolderId) as count`])
                                .where('folder.id = :id', {id: item})
                                .andWhere('folder.folderType = :type', {
                                    type: FolderTypeOptions.PROJECT,
                                })
                                .groupBy('folder.id')
                                .getRawOne();

                            const childFolders = await this.FolderRelationRepo.find({
                                where: {parentFolderId: item},
                                relations: {ChildFolder: true},
                            });

                            return {
                                [countBy || countByCustom]: childFolders.length,
                                name: folder?.name,
                                folders: childFolders.map((item) => item.ChildFolder),
                            };
                        })
                    );

                    return childFolders;
                }

                const queryResult = await res1.getRawMany();

                if (countBy === WidgetCountByOptions.TASKS) {
                    return await Promise.all(
                        queryResult.map(async (item) => {
                            const relatedTasks = await this.tasksRepo
                                .createQueryBuilder('task')
                                .leftJoinAndSelect('task.ChildrenTasks', 'taskRelation')
                                .leftJoinAndSelect('taskRelation.Folder', 'folder')
                                .where('taskRelation.folderId =:id', {id: item.id})
                                .andWhere('task.id IN (:...ids)', {ids: tasksIds})
                                .getMany();

                            return {
                                [countBy || countByCustom]: relatedTasks.length,
                                name: item.name,
                                tasks: relatedTasks.map((task) => this.prepareTask(task, taskRelations)),
                            };
                        })
                    );
                }

                if (countByCustom) {
                    res1.leftJoin('cfv.CustomFieldDefinition', 'cfd', 'cfv.customFieldDefinitionId = cfd.id AND cfd.title = :title', {
                        title: countByCustom,
                    });

                    return (await res1.getRawMany()).map((item) => ({
                        [countByCustom]: +item.сfcount,
                        name: item.name,
                    }));
                }

                return;
            case WidgetCustomGroupByOptions.STARTDATE:
                const res8 = this.tasksRepo
                    .createQueryBuilder('task')
                    .leftJoinAndSelect(
                        'task.ChildrenTasks',
                        'taskRelation',
                        'task.id = taskRelation.childTaskId AND taskRelation.folderId IN (:...ids)',
                        {
                            ids: folderIds,
                        }
                    )
                    .leftJoin('task.CustomFieldValues', 'cfv', 'task.id = cfv.task_id')
                    .leftJoinAndSelect('taskRelation.Folder', 'folder')
                    .select([
                        'task.startDate AS name',
                        ...(countByCustom && countMethod
                            ? [
                                  `${countMethod}(CASE WHEN cfv.value IS NULL OR cfv.value = '' THEN 0 ELSE CAST(cfv.value AS decimal) END) AS сfcount`,
                              ]
                            : []),
                    ])
                    .where('folder.id IN (:...ids)', {ids: folderIds})
                    .groupBy('task.startDate');

                const queryRes = await res8.getRawMany();
                if (countBy === WidgetCountByOptions.BOARDS) {
                    const childFolders = await this.FolderRelationRepo.find({
                        where: {parentFolderId: In(folderIds)},
                        relations: {ChildFolder: true},
                    });
                    const childFoldersIds = childFolders.map((item) => item.childFolderId);

                    if (!childFolders.length) {
                        return null;
                    }

                    return await Promise.all(
                        queryRes.map(async (item) => {
                            const relatedFolders = await this.folderRepo
                                .createQueryBuilder('folder')
                                .leftJoin('folder.FolderTasks', 'taskRelation', 'folder.id = taskRelation.folderId')
                                .leftJoin('taskRelation.ChildTask', 'task', 'taskRelation.childTaskId = task.id')
                                .where('task.startDate = :startDate', {startDate: item.name})
                                .andWhere('taskRelation.folderId IN (:...ids)', {ids: childFoldersIds})
                                .andWhere('folder.folderType = :type', {
                                    type: FolderTypeOptions.PROJECT,
                                })
                                .getMany();

                            return {
                                [countBy]: relatedFolders.length,
                                name: item.name,
                                folders: relatedFolders,
                            };
                        })
                    );
                }

                if (countBy === WidgetCountByOptions.TASKS) {
                    const queryRes = await res8.getRawMany();

                    const tasks = await Promise.all(
                        queryRes.map(async (item) => {
                            const relatedTasks = await this.tasksRepo
                                .createQueryBuilder('task')
                                .leftJoinAndSelect('task.ChildrenTasks', 'taskRelation')
                                .leftJoinAndSelect('taskRelation.Folder', 'folder')
                                .where('task.startDate = :startDate', {startDate: item.name})
                                .andWhere('task.id IN (:...ids)', {ids: tasksIds})
                                .getMany();

                            return {
                                [countBy || countByCustom]: relatedTasks.length,
                                name: item.name,
                                tasks: relatedTasks.map((task) => this.prepareTask(task, taskRelations)),
                            };
                        })
                    );

                    return tasks;
                }

                if (countByCustom) {
                    res8.leftJoin('cfv.CustomFieldDefinition', 'cfd', 'cfv.customFieldDefinitionId = cfd.id AND cfd.title = :title', {
                        title: countByCustom,
                    });

                    return (await res8.getRawMany()).map((item) => ({
                        [countBy || countByCustom]: +item.сfcount,
                        name: item.name,
                    }));
                }

                return;
            case WidgetCustomGroupByOptions.ENDDATE:
                const res9 = this.tasksRepo
                    .createQueryBuilder('task')
                    .leftJoinAndSelect(
                        'task.ChildrenTasks',
                        'taskRelation',
                        'task.id = taskRelation.childTaskId AND taskRelation.folderId IN (:...ids)',
                        {
                            ids: folderIds,
                        }
                    )
                    .leftJoin('task.CustomFieldValues', 'cfv', 'task.id = cfv.task_id')
                    .leftJoinAndSelect('taskRelation.Folder', 'folder')
                    .select([
                        'task.endDate AS name',
                        ...(countByCustom && countMethod
                            ? [
                                  `${countMethod}(CASE WHEN cfv.value IS NULL OR cfv.value = '' THEN 0 ELSE CAST(cfv.value AS decimal) END) AS сfcount`,
                              ]
                            : []),
                    ])
                    .where('folder.id IN (:...ids)', {ids: folderIds})
                    .andWhere('task.endDate IS NOT NULL')
                    .groupBy('task.endDate');

                if (countBy === WidgetCountByOptions.BOARDS) {
                    const queryRes = await res9.getRawMany();
                    const childFolders = await this.FolderRelationRepo.find({
                        where: {parentFolderId: In(folderIds)},
                        relations: {ChildFolder: true},
                    });

                    if (!childFolders.length) {
                        return null;
                    }

                    const childFoldersIds = childFolders.map((item) => item.childFolderId);

                    return await Promise.all(
                        queryRes.map(async (item) => {
                            const relatedFolders = await this.folderRepo
                                .createQueryBuilder('folder')
                                .leftJoin('folder.FolderTasks', 'taskRelation', 'folder.id = taskRelation.folderId')
                                .leftJoin('taskRelation.ChildTask', 'task', 'taskRelation.childTaskId = task.id')
                                .where('task.endDate = :endDate', {endDate: item.name})
                                .andWhere('taskRelation.folderId IN (:...ids)', {ids: childFoldersIds})
                                .andWhere('folder.folderType = :type', {
                                    type: FolderTypeOptions.PROJECT,
                                })
                                .getMany();

                            return {
                                [countBy]: relatedFolders.length,
                                name: item.name,
                                folders: relatedFolders,
                            };
                        })
                    );
                }

                if (countBy === WidgetCountByOptions.TASKS) {
                    const queryRes = await res9.getRawMany();
                    const tasks = await Promise.all(
                        queryRes.map(async (item) => {
                            const relatedTasks = await this.tasksRepo
                                .createQueryBuilder('task')
                                .leftJoinAndSelect('task.ChildrenTasks', 'taskRelation')
                                .leftJoinAndSelect('taskRelation.Folder', 'folder')
                                .where('task.endDate = :endDate', {endDate: item.name})
                                .andWhere('task.id IN (:...ids)', {ids: tasksIds})
                                .getMany();

                            return {
                                [countBy || countByCustom]: relatedTasks.length,
                                name: item.name,
                                tasks: relatedTasks.map((task) => this.prepareTask(task, taskRelations)),
                            };
                        })
                    );

                    return tasks;
                }

                if (countByCustom) {
                    res9.leftJoin('cfv.CustomFieldDefinition', 'cfd', 'cfv.customFieldDefinitionId = cfd.id AND cfd.title = :title', {
                        title: countByCustom,
                    });

                    return (await res9.getRawMany()).map((item) => ({
                        [countBy || countByCustom]: +item.сfcount,
                        name: item.name,
                    }));
                }

                return;
            case WidgetCustomGroupByOptions.IMPORTANCE:
                const res6 = this.tasksRepo
                    .createQueryBuilder('task')
                    .leftJoinAndSelect(
                        'task.ChildrenTasks',
                        'taskRelation',
                        'task.id = taskRelation.childTaskId AND taskRelation.folderId IN (:...ids)',
                        {
                            ids: folderIds,
                        }
                    )
                    .leftJoin('task.CustomFieldValues', 'cfv', 'task.id = cfv.task_id')
                    .leftJoinAndSelect('task.Importance', 'importance')
                    .leftJoinAndSelect('taskRelation.Folder', 'folder')
                    .select([
                        'importance.description AS name',
                        'importance.index AS index',
                        'importance.id AS id',
                        'COUNT(task.id) AS tasks',
                        ...(countByCustom && countMethod
                            ? [
                                  `${countMethod}(CASE WHEN cfv.value IS NULL OR cfv.value = '' THEN 0 ELSE CAST(cfv.value AS decimal) END) AS сfcount`,
                              ]
                            : []),
                    ])
                    .where('folder.id IN (:...ids)', {ids: folderIds})
                    .groupBy('importance.id');

                if (countBy === WidgetCountByOptions.BOARDS) {
                    const queryRes = await res6.getRawMany();

                    const childFolders = await this.FolderRelationRepo.find({
                        where: {parentFolderId: In(folderIds)},
                        relations: {ChildFolder: true},
                    });

                    if (!childFolders.length) {
                        return null;
                    }

                    const childFoldersIds = childFolders.map((item) => item.childFolderId);

                    return await Promise.all(
                        queryRes.map(async (item) => {
                            const relatedFolders = await this.folderRepo
                                .createQueryBuilder('folder')
                                .leftJoin('folder.FolderTasks', 'taskRelation', 'folder.id = taskRelation.folderId')
                                .leftJoin('taskRelation.ChildTask', 'task', 'taskRelation.childTaskId = task.id')
                                .leftJoin('task.Importance', 'importance', 'task.importanceId = importance.id')
                                .where('importance.id = :id', {id: item.id})
                                .andWhere('taskRelation.folderId IN (:...ids)', {ids: childFoldersIds})
                                .andWhere('folder.folderType = :type', {
                                    type: FolderTypeOptions.PROJECT,
                                })
                                .getMany();

                            return {
                                [countBy]: relatedFolders.length,
                                name: item.name,
                                folders: relatedFolders,
                            };
                        })
                    );
                }

                if (countBy === WidgetCountByOptions.TASKS) {
                    const queryRes = await res6.getRawMany();

                    const tasks = await Promise.all(
                        queryRes.map(async (item) => {
                            const relatedTasks = await this.tasksRepo
                                .createQueryBuilder('task')
                                .leftJoinAndSelect('task.Importance', 'importance')
                                .leftJoinAndSelect('task.ChildrenTasks', 'taskRelation')
                                .leftJoinAndSelect('taskRelation.Folder', 'folder')
                                .where('importance.id = :id', {id: item.id})
                                .andWhere('task.id IN (:...ids)', {ids: tasksIds})
                                .getMany();

                            return {
                                [countBy || countByCustom]: relatedTasks.length,
                                name: item.name,
                                tasks: relatedTasks.map((task) => this.prepareTask(task, taskRelations)),
                            };
                        })
                    );

                    return tasks;
                }

                if (countByCustom) {
                    res6.leftJoin('cfv.CustomFieldDefinition', 'cfd', 'cfv.customFieldDefinitionId = cfd.id AND cfd.title = :title', {
                        title: countByCustom,
                    });

                    return (await res6.getRawMany()).map((item) => ({
                        [countBy || countByCustom]: +item.сfcount,
                        name: item.name,
                    }));
                }

                return;
            case WidgetCustomGroupByOptions.TAGS:
                const res3 = this.tasksRepo
                    .createQueryBuilder('task')
                    .leftJoinAndSelect('task.Tags', 'TagTaskFolder', 'TagTaskFolder.taskId = task.id')
                    .leftJoin('TagTaskFolder.Tag', 'tag', 'tag.id = TagTaskFolder.tagId')
                    .leftJoinAndSelect('task.ChildrenTasks', 'taskRelation', 'task.id = taskRelation.childTaskId')
                    .leftJoin('taskRelation.Folder', 'folder')
                    .leftJoin('task.CustomFieldValues', 'cfv', 'task.id = cfv.task_id')
                    .select([
                        `tag.title AS name`,
                        `tag.id AS id`,
                        'COUNT(task.id) AS tasks',
                        ...(countByCustom && countMethod
                            ? [
                                  `${countMethod}(CASE WHEN cfv.value IS NULL OR cfv.value = '' THEN 0 ELSE CAST(cfv.value AS decimal) END) AS сfcount`,
                              ]
                            : []),
                    ])
                    .where('folder.id IN (:...ids)', {ids: folderIds})
                    .andWhere('tag.title IS NOT NULL')
                    .groupBy('tag.id');

                if (countBy === WidgetCountByOptions.BOARDS) {
                    const queryRes = await res3.getRawMany();

                    const childFolders = await this.FolderRelationRepo.find({
                        where: {parentFolderId: In(folderIds)},
                        relations: {ChildFolder: true},
                    });

                    if (!childFolders.length) {
                        return null;
                    }

                    const childFoldersIds = childFolders.map((item) => item.childFolderId);

                    return await Promise.all(
                        queryRes.map(async (item) => {
                            const relatedFolders = await this.folderRepo
                                .createQueryBuilder('folder')
                                .leftJoin('folder.FolderTasks', 'taskRelation', 'folder.id = taskRelation.folderId')
                                .leftJoin('taskRelation.ChildTask', 'task', 'taskRelation.childTaskId = task.id')
                                .leftJoin('task.Tags', 'TagTaskFolder', 'TagTaskFolder.taskId = task.id')
                                .leftJoin('TagTaskFolder.Tag', 'tag', 'tag.id = TagTaskFolder.tagId')
                                .where('tag.id = :id', {id: item.id})
                                .andWhere('taskRelation.folderId IN (:...ids)', {ids: childFoldersIds})
                                .andWhere('folder.folderType = :type', {
                                    type: FolderTypeOptions.PROJECT,
                                })
                                .getMany();

                            return {
                                [countBy]: relatedFolders.length,
                                name: item.name,
                                folders: relatedFolders,
                            };
                        })
                    );
                }

                if (countBy === WidgetCountByOptions.TASKS) {
                    const queryRes = await res3.getRawMany();

                    const tasks = await Promise.all(
                        queryRes.map(async (item) => {
                            const relatedTasks = await this.tasksRepo
                                .createQueryBuilder('task')
                                .leftJoin('task.Tags', 'TagTaskFolder', 'TagTaskFolder.taskId = task.id')
                                .leftJoin('TagTaskFolder.Tag', 'tag', 'tag.id = TagTaskFolder.tagId')
                                .leftJoinAndSelect('task.ChildrenTasks', 'taskRelation')
                                .leftJoinAndSelect('taskRelation.Folder', 'folder')
                                .where('tag.id = :id', {id: item.id})
                                .andWhere('task.id IN (:...ids)', {ids: tasksIds})
                                .getMany();

                            return {
                                [countBy || countByCustom]: relatedTasks.length,
                                name: item.name,
                                tasks: relatedTasks.map((task) => this.prepareTask(task, taskRelations)),
                            };
                        })
                    );

                    return tasks;
                }

                if (countByCustom) {
                    res3.leftJoin('cfv.CustomFieldDefinition', 'cfd', 'cfv.customFieldDefinitionId = cfd.id AND cfd.title = :title', {
                        title: countByCustom,
                    });

                    return (await res3.getRawMany()).map((item) => ({
                        [countBy || countByCustom]: +item.сfcount,
                        name: item.name,
                    }));
                }

                return;
            case WidgetCustomGroupByOptions.OWNER:
                const res2 = this.tasksRepo
                    .createQueryBuilder('task')
                    .leftJoinAndSelect('task.ChildrenTasks', 'taskRelation', 'task.id = taskRelation.childTaskId')
                    .leftJoin('task.CustomFieldValues', 'cfv', 'task.id = cfv.task_id')
                    .leftJoin('taskRelation.Folder', 'folder')
                    .leftJoin('user', 'user', 'task.userId = user.id')
                    .select([
                        'task.userId AS id',
                        `CONCAT(user.firstName, ' ', user.lastName) AS name`,
                        ...(countByCustom && countMethod
                            ? [
                                  `${countMethod}(CASE WHEN cfv.value IS NULL OR cfv.value = '' THEN 0 ELSE CAST(cfv.value AS decimal) END) AS сfcount`,
                              ]
                            : []),
                    ])
                    .where('folder.id IN (:...ids)', {ids: folderIds})
                    .groupBy('task.userId')
                    .addGroupBy('user.firstName')
                    .addGroupBy('user.lastName');

                if (countBy === WidgetCountByOptions.BOARDS) {
                    const queryRes = await res2.getRawMany();

                    const childFolders = await this.FolderRelationRepo.find({
                        where: {parentFolderId: In(folderIds)},
                        relations: {ChildFolder: true},
                    });

                    if (!childFolders.length) {
                        return null;
                    }

                    const childFoldersIds = childFolders.map((item) => item.childFolderId);

                    return await Promise.all(
                        queryRes.map(async (item) => {
                            const relatedFolders = await this.folderRepo
                                .createQueryBuilder('folder')
                                .leftJoin('folder.FolderTasks', 'taskRelation', 'folder.id = taskRelation.folderId')
                                .leftJoin('taskRelation.ChildTask', 'task', 'taskRelation.childTaskId = task.id')
                                .where('task.userId = :id', {id: item.id})
                                .andWhere('taskRelation.folderId IN (:...ids)', {ids: childFoldersIds})
                                .andWhere('folder.folderType = :type', {
                                    type: FolderTypeOptions.PROJECT,
                                })
                                .getMany();

                            const userInfo = await this.userRepository.findOneBy({id: item.name});
                            return {
                                [countBy]: relatedFolders.length,
                                name: `${userInfo?.firstName} ${userInfo?.lastName}`,
                                folders: relatedFolders,
                            };
                        })
                    );
                }

                if (countBy === WidgetCountByOptions.TASKS) {
                    const queryRes = await res2.getRawMany();

                    const tasks = await Promise.all(
                        queryRes.map(async (item) => {
                            const relatedTasks = await this.tasksRepo
                                .createQueryBuilder('task')
                                .leftJoinAndSelect('task.ChildrenTasks', 'taskRelation')
                                .leftJoinAndSelect('taskRelation.Folder', 'folder')
                                .where('task.userId = :id', {id: item.id})
                                .andWhere('task.id IN (:...ids)', {ids: tasksIds})
                                .getMany();

                            return {
                                [countBy || countByCustom]: relatedTasks.length,
                                name: item.name,
                                tasks: relatedTasks.map((task) => this.prepareTask(task, taskRelations)),
                            };
                        })
                    );

                    return tasks;
                }

                if (countByCustom) {
                    res2.leftJoin('cfv.CustomFieldDefinition', 'cfd', 'cfv.customFieldDefinitionId = cfd.id AND cfd.title = :title', {
                        title: countByCustom,
                    });

                    return (await res2.getRawMany()).map((item) => ({
                        [countByCustom]: +item.сfcount,
                        name: item.name,
                    }));
                }

                return;
            case WidgetCustomGroupByOptions.ASSIGNEE:
                const filters = widgetDto.filters || widget.filters || [];
                let assigneeIds = [];
                const skipAssigneeIds = [];

                filters.forEach((filter) => {
                    if (filter.name === WidgetFilterTypeNameOptions.Assignee) {
                        if (filter.condition) {
                            assigneeIds.push(...filter.values);
                        } else {
                            skipAssigneeIds.push(...filter.values);
                        }
                    }
                });

                if (!assigneeIds.length) {
                    assigneeIds = Array.from(new Set(taskList.map((query) => query.assignees).flat()));
                }

                if (countBy === WidgetCountByOptions.BOARDS) {
                    const childFolders = await this.FolderRelationRepo.find({
                        where: {parentFolderId: In(folderIds)},
                        relations: {ChildFolder: true},
                    });

                    if (!childFolders.length) {
                        return null;
                    }

                    const childFoldersIds = childFolders.map((item) => item.childFolderId);

                    const tasksForAssignee = await Promise.all(
                        assigneeIds.map(async (assigneeId) => {
                            const folders = await this.folderRepo
                                .createQueryBuilder('folder')
                                .leftJoin('folder.FolderTasks', 'tasks', 'folder.id = tasks.folderId')
                                .leftJoin('tasks.ChildTask', 'childTasks', 'tasks.childTaskId = childTasks.id')
                                .where('folder.id IN (:...ids)', {ids: childFoldersIds})
                                .distinctOn(['folder.id'])
                                .where(':assigneeId = ANY(childTasks.assignees)', {assigneeId})
                                .andWhere('folder.folderType = :type', {
                                    type: FolderTypeOptions.PROJECT,
                                })
                                .getMany();

                            const assignee = await this.userRepository.findOneBy({id: assigneeId});

                            const result = {
                                [countBy || countByCustom]: folders.length,
                                name: `${assignee.firstName} ${assignee.lastName}`,
                                folders,
                            };
                            return result;
                        })
                    );

                    return tasksForAssignee;
                }

                if (countBy === WidgetCountByOptions.TASKS) {
                    const taskMap = {};
                    const uniqueIds = new Set();
                    const countByName = countBy || countByCustom;

                    taskList.forEach((task) => {
                        if (task.assignees.length) {
                            task.assignees.forEach((item) => {
                                const key = item;

                                if (assigneeIds.includes(key) && !skipAssigneeIds.includes(key)) {
                                    uniqueIds.add(key);

                                    taskMap[key] = taskMap[key] || {
                                        tasks: [],
                                        name: 'Undefined user',
                                        [countByName]: 0,
                                    };

                                    taskMap[key].tasks.push(this.prepareTask(task, taskRelations));
                                    taskMap[key][countByName]++;
                                }
                            });
                        } else {
                            const key = 'noAssignee';

                            if (!taskMap[key]) {
                                taskMap[key] = {
                                    tasks: [],
                                    name: `No assignee`,
                                    [countByName]: 0,
                                };
                            }

                            taskMap[key].tasks.push(this.prepareTask(task, taskRelations));
                            taskMap[key][countByName]++;
                        }
                    });

                    const ids = [...uniqueIds.values()] as string[];

                    const assignee = await this.userRepository.find({
                        where: {id: In(ids)},
                        select: ['firstName', 'lastName', 'id', 'color'],
                    });

                    assignee.forEach((item) => {
                        taskMap[item.id].name = `${item.firstName} ${item.lastName}`;
                        taskMap[item.id].color = item.color;
                    });

                    return Object.keys(taskMap).map((key) => taskMap[key]);
                }

                if (countByCustom) {
                    res2.leftJoin('cfv.CustomFieldDefinition', 'cfd', 'cfv.customFieldDefinitionId = cfd.id AND cfd.title = :title', {
                        title: countByCustom,
                    });

                    return (await res2.getRawMany()).map((item) => ({
                        [countBy || countByCustom]: +item.сfcount,
                        name: item.name,
                    }));
                }

                return;
            default:
                return [];
        }
    }

    async updateWidgetCategory(id: number, updateWidgetCategoryDto: UpdateWidgetCategoryDto): Promise<WidgetCategoryDto> {
        const widgetCategory = await this.widgetCategoryRepo.findOne({where: {id}});

        if (!widgetCategory) {
            throw new NotFoundException('Widget Category not found');
        }

        const widgetCategoryByName = await this.widgetCategoryRepo.findOne({where: {name: updateWidgetCategoryDto.name, id: Not(id)}});

        if (widgetCategoryByName) {
            throw new BadRequestException(`Widget Category with name ${updateWidgetCategoryDto.name} already exists`);
        }

        for (const key in updateWidgetCategoryDto) {
            widgetCategory[key] = updateWidgetCategoryDto[key];
        }

        const updatedCategory = await this.widgetCategoryRepo.save(widgetCategory);

        return new WidgetCategoryDto(updatedCategory);
    }

    async updateWidgetType(id: number, updateWidgetTypeDto: UpdateWidgetTypeDto): Promise<WidgetTypesDto> {
        const widgetType = await this.widgetTypesRepo.findOne({where: {id}});

        if (!widgetType) {
            throw new NotFoundException('Widget type not found');
        }

        if (updateWidgetTypeDto.name) {
            const widgetByName = await this.widgetTypesRepo.findOne({
                where: {widgetCategoryId: widgetType.id, name: updateWidgetTypeDto.name, id: Not(widgetType.id)},
            });

            if (widgetByName) {
                throw new BadRequestException(`Widget type with name '${updateWidgetTypeDto.name}' already exists`);
            }
        }

        for (const key in updateWidgetTypeDto) {
            widgetType[key] = updateWidgetTypeDto[key];
        }

        const updatedWidgetType = await this.widgetTypesRepo.save(widgetType);
        return new WidgetTypesDto(updatedWidgetType);
    }

    async updateWidget(id: number, updateWidgetDto: UpdateWidgetDto, userId: string): Promise<WidgetDto> {
        const {widgetTypeId, dashboardId, folderIds} = updateWidgetDto;

        const widgetToUpdate = await this.widgetRepo.findOne({where: {id}});

        if (!widgetToUpdate) {
            throw new HttpException('Widget not found', HttpStatus.NOT_FOUND);
        }

        const hasPermissionsForDashboard = await this.authorization.getUserHasPermissions(
            userId,
            PermissionOptions.OWNER_FULL_EDITOR_READ,
            EntityTypeOptions.Dashboard,
            dashboardId
        );

        if (!hasPermissionsForDashboard) {
            throw new ForbiddenException(`Dashboard ${dashboardId} is forbidden for user ${userId}`);
        }

        if (folderIds && folderIds.length) {
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
                })
            );
        }

        for (const key in updateWidgetDto) {
            widgetToUpdate[key] = updateWidgetDto[key];
        }
        const savedWidget = await this.widgetRepo.save(widgetToUpdate);

        if (folderIds && folderIds.length) {
            await Promise.all(
                folderIds.map(async (folderId) => {
                    await this.widgetRelationRepo.save({
                        widgetId: savedWidget.id,
                        folderId,
                    });
                })
            );
        }

        const folders = await this.widgetRelationRepo
            .createQueryBuilder('widgetRelation')
            .distinctOn(['widgetRelation.folderId'])
            .where('widgetRelation.widgetId = :widgetId', {widgetId: savedWidget.id})
            .getMany();

        const newFolderIds = folders.map((folder) => folder.folderId);
        const widgetDashboard = dashboardId || savedWidget.dashboardId;

        const widgetType = await this.widgetTypesRepo.findOne({where: {id: widgetTypeId || savedWidget.widgetTypeId}});

        return new WidgetDto(savedWidget, widgetDashboard, newFolderIds, widgetType);
    }

    async deleteWidgetCategory(id: number): Promise<void> {
        const existWidgetCategory = await this.widgetCategoryRepo.findOne({where: {id: id}});

        if (!existWidgetCategory) {
            throw new HttpException(`Widget category with id ${id} does not exist`, HttpStatus.NOT_FOUND);
        }

        await this.widgetCategoryRepo.delete(existWidgetCategory);

        return;
    }

    async deleteWidgetType(id: number): Promise<void> {
        const existWidgetType = await this.widgetTypesRepo.findOne({where: {id: id}});
        if (!existWidgetType) {
            throw new HttpException(`Widget category with id ${id} does not exist`, HttpStatus.NOT_FOUND);
        }

        await this.widgetTypesRepo.delete(existWidgetType);

        return;
    }

    async deleteWidget(id: number, userId: string): Promise<void> {
        const existWidget = await this.widgetRepo.findOne({where: {id: id}});
        if (!existWidget) {
            throw new HttpException(`Widget with id ${id} does not exist`, HttpStatus.NOT_FOUND);
        }

        const hasPermissions = await this.authorization.getUserHasPermissions(
            userId,
            PermissionOptions.OWNER_FULL_EDITOR,
            EntityTypeOptions.Dashboard,
            existWidget.dashboardId
        );
        if (!hasPermissions) {
            throw new ForbiddenException(`Dashboard update ${existWidget.dashboardId} is forbidden for user ${userId}`);
        }

        await this.widgetRelationRepo.delete({widgetId: id});
        await this.widgetRepo.delete(id);

        return;
    }

    async duplicateWidget(widgetId: number, userId: string): Promise<WidgetDto> {
        const existWidget = await this.widgetRepo.findOne({where: {id: widgetId}});

        const folders = await this.widgetRelationRepo
            .createQueryBuilder('widgetRelation')
            .distinctOn(['widgetRelation.folderId'])
            .where('widgetRelation.widgetId = :widgetId', {widgetId})
            .getMany();

        if (!existWidget) {
            throw new HttpException(`Widget with id ${widgetId} does not exist`, HttpStatus.NOT_FOUND);
        }

        const hasPermissions = await this.authorization.getUserHasPermissions(
            userId,
            PermissionOptions.OWNER_FULL_EDITOR,
            EntityTypeOptions.Dashboard,
            existWidget.dashboardId
        );
        if (!hasPermissions) {
            throw new ForbiddenException(`Dashboard update ${existWidget.dashboardId} is forbidden for user ${userId}`);
        }

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const {id: _, ...restWidgetInfo} = existWidget;
        const duplicatedWidget = await this.widgetRepo.save({...restWidgetInfo, name: `${existWidget.name} - Copy`});

        await Promise.all(
            folders.map(async (folder) => {
                await this.widgetRelationRepo.save({
                    folderId: folder.folderId,
                    dashboardId: existWidget.dashboardId,
                    widgetId: duplicatedWidget.id,
                });
            })
        );

        const folderIds = folders.map((folder) => folder.folderId);

        return new WidgetDto(duplicatedWidget, existWidget.dashboardId, folderIds, existWidget.widgetType);
    }

    async duplicateDashboardWidgets(dashboardId: number, duplicatedDashboardId: number): Promise<void> {
        const widgets = await this.widgetRepo.find({where: {dashboardId}});

        const folders = await this.widgetRelationRepo
            .createQueryBuilder('widgetRelation')
            .distinctOn(['widgetRelation.folderId'])
            .where('widgetRelation.widgetId IN (:...ids)', {ids: widgets.map((widget) => widget.id)})
            .getMany();

        await Promise.all(
            widgets.map(async (widget) => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const {id: _, ...restWidgetInfo} = widget;
                const duplicatedWidget = await this.widgetRepo.save({
                    ...restWidgetInfo,
                    dashboardId: duplicatedDashboardId,
                    name: `${widget.name} - Copy`,
                });

                await Promise.all(
                    folders.map(async (folder) => {
                        await this.widgetRelationRepo.save({
                            folderId: folder.folderId,
                            dashboardId: duplicatedWidget.dashboardId,
                            widgetId: duplicatedWidget.id,
                        });
                    })
                );
            })
        );
    }

    async getFoldersCustomNumericFields(folderIds: number[], userId: string): Promise<CustomFieldDefinitionEntity[]> {
        try {
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
                })
            );

            const taskCustomFields = this.tasksRepo
                .createQueryBuilder('task')
                .innerJoinAndSelect('task.CustomFieldValues', 'cfv', 'task.id = cfv.task_id')
                .innerJoinAndSelect('cfv.CustomFieldDefinition', 'cfd', 'cfv.customFieldDefinitionId = cfd.id')
                .innerJoin('task.ChildrenTasks', 'taskRelation', 'task.id = taskRelation.childTaskId')
                .where('taskRelation.folderId IN (:...ids)', {ids: folderIds})
                .andWhere('cfd.type = :type', {type: CustomFieldDefinitionTypeOptions.NUMERIC})
                .distinctOn(['cfd.id']);
            const fields = await taskCustomFields.getMany();
            return fields.map((field) => field.CustomFieldValues.map((value) => value.CustomFieldDefinition)).flat();
        } catch (e) {
            this.logger.error(`There was an error getting custom fields`, e);
            throw e;
        }
    }
}
