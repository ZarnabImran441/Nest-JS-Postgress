import {faker} from '@faker-js/faker';
import '@jest-decorated/core/globals';
import {TASK_MANAGEMENT, TokenInterface} from '@lib/base-library';
import {HttpStatus, Inject, Logger, OnModuleInit} from '@nestjs/common';
import {TestSuite, Test} from 'nestjs-jest-decorators';
import {Test as TestResponse} from 'supertest';
import {ChangeWorkflowFolderDto, ChangeWorkflowOptions} from '../../src/dto/folder/folder/change-workflow.dto';
import {GetFolderDto} from '../../src/dto/folder/folder/get-folder.dto';
import {WidgetCategoryDto} from '../../src/dto/widget/widget-category.dto';
import {WidgetTypesDto} from '../../src/dto/widget/widget-types.dto';
import {WidgetDto} from '../../src/dto/widget/widget.dto';
import {UserPermissionOptions} from '../../src/enum/folder-user.enum';
import {DefaultViewOptions} from '../../src/enum/folder.enum';
import {WidgetFilterDatePartOptions, WidgetFilterTypeNameOptions} from '../../src/enum/widget-filter.enum';
import {WidgetCountByOptions} from '../../src/enum/widget.enum';
import {WidgetQueryInterface} from '../../src/interface/widget-query.interface';
import {FolderEntity} from '../../src/model/folder.entity';
import {WorkFlowEntity} from '../../src/model/workflow.entity';
import {EntityTypeOptions, PermissionOptions} from '../../src/module/authorization-impl/authorization.enum';
import {CustomFieldCollectionFactory} from '../factory/custom-field-collection.factory';
import {CustomFieldFactory} from '../factory/custom-field.factory';
import {DashboardFactory} from '../factory/dashboard.factory';
import {FolderFactory} from '../factory/folder.factory';
import {TeamFactory} from '../factory/team.factory';
import {PermissionsType, UserFactory} from '../factory/user.factory';
import {WidgetFactory} from '../factory/widget.factory';
import {WorkflowFactory} from '../factory/workflow.factory';
import {WidgetFilters} from './../../src/dto/widget/widget.dto';
import {NewBaseTest} from './base-test';
import {TaskFactory} from '../factory/task.factory';
import {TaskAttachmentFactory} from '../factory/task-attachment.factory';
import {TagFactory} from '../factory/tag.factory';

@TestSuite('Widget Suite')
export class WidgetE2eSpec extends NewBaseTest implements OnModuleInit {
    private readonly logger = new Logger(WidgetE2eSpec.name);

    @Inject()
    private factory: WidgetFactory;
    @Inject()
    private userFactory: UserFactory;
    @Inject()
    private workflowFactory: WorkflowFactory;
    @Inject()
    private folderFactory: FolderFactory;
    @Inject()
    private taskFactory: TaskFactory;
    @Inject()
    private taskAttachmentFactory: TaskAttachmentFactory;
    @Inject()
    private dashboardFactory: DashboardFactory;
    @Inject()
    private teamFactory: TeamFactory;
    private tagFactory: TagFactory;
    private customFieldCollectionFactory: CustomFieldCollectionFactory = new CustomFieldCollectionFactory();
    private customFieldDefinitionFactory: CustomFieldFactory = new CustomFieldFactory();

    onModuleInit(): void {
        this.setUrl('/widgets');
    }

    /**
     * Creates a widget category.
     * @returns {Promise<{category: WidgetCategoryDto, jwtToken: TokenInterface}>} - A promise that resolves to an object containing the created widget category and a JWT token.
     */
    @Test('Create Widget Category')
    async CreateWidgetCategory(): Promise<{category: WidgetCategoryDto; jwtToken: TokenInterface}> {
        this.logger.log(`Create user`);
        const {body: jwtToken} = await this.createUserWithPermissions({
            [EntityTypeOptions.Widget]: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            [EntityTypeOptions.Dashboard]: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            folder: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            displacementGroup: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            folderWorkflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            purgeFoldersAndTasks: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            replaceFolderOwner: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            space: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            commonCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            userCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            teams: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            customFieldCollection: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            user: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            workflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });

        this.logger.log('create widget category');
        const fakeWidgetCategory = this.factory.fakeCreateWidgetCategory();
        const {body: widgetCategory} = await this.post(`categories`, fakeWidgetCategory, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(widgetCategory).toBeDefined();

        this.logger.log(`check widget category exists`);
        const {status: responseStatus, body: categoriesDB} = await this.get(`categories`, jwtToken.accessToken);
        expect(responseStatus).toBe(HttpStatus.OK);
        expect(categoriesDB).toContainEqual(widgetCategory);

        return {category: widgetCategory, jwtToken};
    }

    /**
     * Updates widget category.
     * @returns {Promise<{category: WidgetCategoryDto, jwtToken: TokenInterface}>} - A promise that resolves to an object containing the updated widget category and a JWT token.
     */
    @Test('Update Widget Category')
    async UpdateWidgetCategory(): Promise<{category: WidgetCategoryDto; jwtToken: TokenInterface}> {
        const {category, jwtToken} = await this.CreateWidgetCategory();

        this.logger.log('create widget category');
        const fakeUpdateWidgetCategory = this.factory.fakeUpdateWidgetCategory();
        const {body: widgetCategory} = await this.patch(`categories/${category.id}`, fakeUpdateWidgetCategory, jwtToken.accessToken).expect(
            HttpStatus.OK
        );
        expect(widgetCategory).toBeDefined();

        this.logger.log(`check update widget`);
        const {status: responseStatus, body: categoriesDB} = await this.get(`categories`, jwtToken.accessToken);
        const exactCategory = categoriesDB.find((x) => x.id === category.id);
        expect(responseStatus).toBe(HttpStatus.OK);
        expect({
            name: exactCategory.name,
            icon: exactCategory.icon,
            color: exactCategory.color,
        }).toMatchObject(fakeUpdateWidgetCategory);

        return {category: exactCategory, jwtToken};
    }

    /**
     * Gets widget categories.
     * @returns {Promise<void>} - A Promise that resolves when the binding is successful.
     */
    @Test('Get All Widget Categories')
    async GetAllWidgetCategories(): Promise<void> {
        this.logger.log(`Create user`);
        const {body: jwtToken} = await this.createUserWithPermissions({
            [EntityTypeOptions.Widget]: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            [EntityTypeOptions.Folder]: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            [EntityTypeOptions.Dashboard]: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });

        this.logger.log('create widget categories');
        const createdWidgetCategories = await this.createManyFakeWidgetCategories(jwtToken.accessToken);

        const {body: widgetCategories} = await this.get(`categories`, jwtToken.accessToken).expect(HttpStatus.OK);

        expect(widgetCategories).toBeDefined();
        expect(widgetCategories.map((f) => f.id)).toEqual(expect.arrayContaining(createdWidgetCategories.map((f) => f.id)));
    }

    /**
     * Deletes a widget category.
     * @returns {Promise<void>} - A Promise that resolves when the binding is successful.
     */
    @Test('Delete Widget Category')
    async DeleteWidgetCategory(): Promise<void> {
        this.logger.log(`Create widget category`);
        const {category, jwtToken} = await this.CreateWidgetCategory();

        this.logger.log('Delete widget category');
        await this.delete(`categories/${category.id}`, jwtToken.accessToken).expect(HttpStatus.OK);

        this.logger.log('Check if category exists (it should not exists)');
        const {body: categoriesDB} = await this.get(`categories`, jwtToken.accessToken);
        expect(categoriesDB).toBeDefined();
        expect(categoriesDB).not.toContainEqual(category);
    }

    /**
     * Creates a widget type.
     * @returns {Promise<{type: WidgetTypesDto, jwtToken: TokenInterface}>} - A promise that resolves to an object containing the created widget type and a JWT token.
     */
    @Test('Create Widget Type')
    async CreateWidgetType(): Promise<{type: WidgetTypesDto; jwtToken: TokenInterface}> {
        this.logger.log(`Create user`);
        const {body: jwtToken} = await this.createUserWithPermissions({
            [EntityTypeOptions.Widget]: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            [EntityTypeOptions.Dashboard]: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            folder: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            displacementGroup: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            folderWorkflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            purgeFoldersAndTasks: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            replaceFolderOwner: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            space: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            commonCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            userCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            teams: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            customFieldCollection: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            user: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            workflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });

        this.logger.log('create widget category');
        const fakeWidgetCategory = this.factory.fakeCreateWidgetCategory();
        const {body: widgetCategory} = await this.post(`categories`, fakeWidgetCategory, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(widgetCategory).toBeDefined();

        this.logger.log('create widget types');
        const fakeWidgetType = this.factory.fakeCreateWidgetType(widgetCategory.id);
        const {body: widgetType} = await this.post(`types`, fakeWidgetType, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(widgetType).toBeDefined();

        return {type: widgetType, jwtToken};
    }

    /**
     * Updates widget type.
     * @returns {Promise<{type: WidgetTypesDto, jwtToken: TokenInterface}>} - A promise that resolves to an object containing the updated widget type and a JWT token.
     */
    @Test('Update Widget Type')
    async UpdateWidgetType(): Promise<{type: WidgetTypesDto; jwtToken: TokenInterface}> {
        const {type, jwtToken} = await this.CreateWidgetType();

        this.logger.log('create widget type');
        const fakeUpdateWidgetType = this.factory.fakeUpdateWidgetType();
        const {body: widgettype} = await this.patch(`types/${type.id}`, fakeUpdateWidgetType, jwtToken.accessToken).expect(HttpStatus.OK);
        expect(widgettype).toBeDefined();

        this.logger.log(`check update widget`);
        const {status: responseStatus, body: categoriesDB} = await this.get(`types`, jwtToken.accessToken);
        const exactType = categoriesDB.find((x) => x.id === type.id);
        expect(responseStatus).toBe(HttpStatus.OK);
        expect({
            name: exactType.name,
            icon: exactType.icon,
            color: exactType.color,
        }).toMatchObject(fakeUpdateWidgetType);

        return {type: exactType, jwtToken};
    }

    /**
     * Gets a widget types.
     * @returns {Promise<void>} - A Promise that resolves when the binding is successful.
     */
    @Test('Get All Widget Types')
    async GetAllWidgetTypes(): Promise<void> {
        this.logger.log(`Create user`);
        const {body: jwtToken} = await this.createUserWithPermissions({
            [EntityTypeOptions.Widget]: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            [EntityTypeOptions.Folder]: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            [EntityTypeOptions.Dashboard]: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });

        this.logger.log('create widget types');
        const createdWidgetTypes = await this.createManyFakeWidgetTypes(jwtToken.accessToken);
        const {body: widgetTypes} = await this.get(`types`, jwtToken.accessToken).expect(HttpStatus.OK);

        expect(widgetTypes).toBeDefined();
        expect(widgetTypes.map((f) => f.id)).toEqual(expect.arrayContaining(createdWidgetTypes.map((f) => f.id)));
    }

    /**
     * Deletes a widget type.
     * @returns {Promise<void>} - A Promise that resolves when the binding is successful.
     */
    @Test('Delete Widget Type')
    async DeleteWidgetType(): Promise<void> {
        this.logger.log(`Create widget type`);
        const {type, jwtToken} = await this.CreateWidgetType();
        this.logger.log('Delete widget type');
        await this.delete(`types/${type.id}`, jwtToken.accessToken).expect(HttpStatus.OK);

        this.logger.log('Check if type exists (it should not exists)');
        const {body: typesDB} = await this.get(`types`, jwtToken.accessToken);
        expect(typesDB).toBeDefined();
        expect(typesDB).not.toContainEqual(type);
    }

    /**
     * Creates a widget.
     * @returns {Promise<{widget: WidgetDto; jwtToken: TokenInterface}>} - A promise that resolves to an object containing the created widget and a JWT token.
     */
    @Test('Create Widget')
    async CreateWidget(
        jwtToken?: TokenInterface,
        dashboardId?: number,
        widgetTypeId?: number,
        template: string = null,
        query: WidgetQueryInterface = null,
        filters: WidgetFilters[] = null
    ): Promise<{widget: WidgetDto; jwtToken: TokenInterface}> {
        if (!jwtToken) {
            this.logger.log(`Create user`);
            const fakeUser = await this.userFactory.createUserForLogin({
                [EntityTypeOptions.Widget]: PermissionOptions.CREATE_READ_UPDATE_DELETE,
                [EntityTypeOptions.Dashboard]: PermissionOptions.CREATE_READ_UPDATE_DELETE,
                folderWorkflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
                purgeFoldersAndTasks: PermissionOptions.CREATE_READ_UPDATE_DELETE,
                replaceFolderOwner: PermissionOptions.CREATE_READ_UPDATE_DELETE,
                displacementGroup: PermissionOptions.CREATE_READ_UPDATE_DELETE,
                folder: PermissionOptions.CREATE_READ_UPDATE_DELETE,
                space: PermissionOptions.CREATE_READ_UPDATE_DELETE,
                commonCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
                userCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
                teams: PermissionOptions.CREATE_READ_UPDATE_DELETE,
                customFieldCollection: PermissionOptions.CREATE_READ_UPDATE_DELETE,
                user: PermissionOptions.CREATE_READ_UPDATE_DELETE,
                workflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            });
            this.logger.log(`do login`);
            const response = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
            jwtToken = response.body;
        }

        this.logger.log('Create folder');
        const fakeFolder = await this.createFolder(jwtToken.accessToken);
        expect(fakeFolder).toBeDefined();

        if (!dashboardId) {
            this.logger.log('Create dashboard');
            const fakeDto = this.dashboardFactory.fakeCreateDashboard();

            const {body: dashboard} = await this.post(`/dashboard`, fakeDto, jwtToken.accessToken).expect(HttpStatus.CREATED);
            expect(dashboard).toBeDefined();

            dashboardId = dashboard.id;
        }

        if (!widgetTypeId) {
            this.logger.log('create widget category');
            const fakeWidgetCategory = this.factory.fakeCreateWidgetCategory();
            const {body: widgetCategory} = await this.post(`categories`, fakeWidgetCategory, jwtToken.accessToken).expect(
                HttpStatus.CREATED
            );
            expect(widgetCategory).toBeDefined();

            this.logger.log('create widget types');
            const fakeWidgetType = this.factory.fakeCreateWidgetType(widgetCategory.id, template);
            const {body: widgetType} = await this.post(`types`, fakeWidgetType, jwtToken.accessToken).expect(HttpStatus.CREATED);
            expect(widgetType).toBeDefined();

            widgetTypeId = widgetType.id;
        }

        this.logger.log(`create widget`);
        const fakeWidget = this.factory.fakeCreateWidget([fakeFolder.id], widgetTypeId, dashboardId, filters, query);
        const res = await this.post(``, fakeWidget, jwtToken.accessToken);

        expect(res.status).toBe(HttpStatus.CREATED);
        const {body: widget} = res;
        expect(widget).toBeDefined();

        this.logger.log(`check widget exists`);
        const response = await this.get(`dashboard/${dashboardId}`, jwtToken.accessToken);
        expect(response.status).toBe(HttpStatus.OK);

        if (!query) {
            delete response.body[0].query;
        }
        expect(response.body[0]).toMatchObject(widget);

        return {widget, jwtToken};
    }

    /**
     * Creates a widget for attachments kpi.
     * @returns {Promise<{widget: WidgetDto; jwtToken: TokenInterface}>} - A promise that resolves to an object containing the created widget and a JWT token.
     */
    @Test('Create Attachments KPI Widget')
    async CreateAttachmentsKpiWidget(): Promise<{widget: WidgetDto; jwtToken: TokenInterface}> {
        const template = 'kpiAttachments';
        const query = {
            period: WidgetFilterDatePartOptions.MONTH,
        };

        this.logger.log(`create widget for attachments kpi`);
        const {widget, jwtToken} = await this.CreateWidget(null, null, null, template, query);
        expect(widget).toBeDefined();
        expect(widget.query).toEqual(query);
        expect(widget.template).toEqual(template);

        return {widget, jwtToken};
    }

    /**
     * Creates a widget for attachments kpi and check count for attachements.
     * @returns {Promise<{widget: WidgetDto; jwtToken: TokenInterface}>} - A promise that resolves to an object containing the created widget and a JWT token.
     */
    @Test('Check Attachments Count in Attachment KPI Widget')
    async CheckAttachmentsCountinAtthmentKpiWidget(): Promise<{widget: WidgetDto; jwtToken: TokenInterface}> {
        const template = 'kpiAttachments';
        const query = {
            period: WidgetFilterDatePartOptions.DAY,
        };

        this.logger.log(`create widget for attachments kpi`);
        const {widget, jwtToken} = await this.CreateWidget(null, null, null, template, query);
        expect(widget).toBeDefined();
        expect(widget.query).toEqual(query);
        expect(widget.template).toEqual(template);

        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        const folderId = widget.folderIds[0];
        const fakeTask1 = this.taskFactory.fakeCreateTask(userId, folderId);
        const {body: task} = await this.post(`/task`, fakeTask1, jwtToken.accessToken).expect(HttpStatus.CREATED);
        const fakeFiles = await this.taskAttachmentFactory.fakeFiles();
        this.logger.log('create task attachement');
        await this.post(`/task-attachment/upload/${task.id}/folder/${folderId}`, undefined, jwtToken.accessToken, fakeFiles).expect(
            HttpStatus.CREATED
        );

        const {body: widgetData} = await this.post(`attachments-count/${widget.id}`, {}, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(widgetData).toBeDefined();
        expect(widgetData.current).toBeDefined();
        expect(widgetData.current.count).toBeGreaterThanOrEqual(1);

        return {widget, jwtToken};
    }

    /**
     * Creates a widget for completed tasks kpi.
     * @returns {Promise<{widget: WidgetDto; jwtToken: TokenInterface}>} - A promise that resolves to an object containing the created widget and a JWT token.
     */
    @Test('Create Completed Tasks KPI Widget')
    async CreateCompletedTasksKpiWidget(): Promise<{widget: WidgetDto; jwtToken: TokenInterface}> {
        const template = 'kpiCompletedTasks';
        const query = {
            period: WidgetFilterDatePartOptions.MONTH,
        };

        this.logger.log(`create widget for completed tasks kpi`);
        const {widget, jwtToken} = await this.CreateWidget(null, null, null, template, query);
        expect(widget).toBeDefined();
        expect(widget.query).toEqual(query);
        expect(widget.template).toEqual(template);

        return {widget, jwtToken};
    }

    /**
     * Creates a widget for new folders kpi.
     * @returns {Promise<{widget: WidgetDto; jwtToken: TokenInterface}>} - A promise that resolves to an object containing the created widget and a JWT token.
     */
    @Test('Create New Folders KPI Widget')
    async CreateNewFoldersKpiWidget(): Promise<{widget: WidgetDto; jwtToken: TokenInterface}> {
        const template = 'kpiNewFolder';
        const query = {
            period: WidgetFilterDatePartOptions.MONTH,
        };

        this.logger.log(`create widget for new folders kpi`);
        const {widget, jwtToken} = await this.CreateWidget(null, null, null, template, query);
        expect(widget).toBeDefined();
        expect(widget.query).toEqual(query);
        expect(widget.template).toEqual(template);

        return {widget, jwtToken};
    }

    /**
     * Creates a widget for new folders kpi.
     * @returns {Promise<{widget: WidgetDto; jwtToken: TokenInterface}>} - A promise that resolves to an object containing the created widget and a JWT token.
     */
    @Test('Create New Folders KPI Widget')
    async CreateNewTasksKpiWidget(): Promise<{widget: WidgetDto; jwtToken: TokenInterface}> {
        const template = 'kpiNewTask';
        const query = {
            period: WidgetFilterDatePartOptions.MONTH,
        };

        this.logger.log(`create widget for new folders kpi`);
        const {widget, jwtToken} = await this.CreateWidget(null, null, null, template, query);
        expect(widget).toBeDefined();
        expect(widget.query).toEqual(query);
        expect(widget.template).toEqual(template);

        return {widget, jwtToken};
    }

    /**
     * Creates a widget for approved tasks kpi.
     * @returns {Promise<{widget: WidgetDto; jwtToken: TokenInterface}>} - A promise that resolves to an object containing the created widget and a JWT token.
     */
    @Test('Create Approvals KPI Widget')
    async CreateApprovalsKpiWidget(): Promise<{widget: WidgetDto; jwtToken: TokenInterface}> {
        const template = 'kpiApprovals';
        const query = {
            period: WidgetFilterDatePartOptions.MONTH,
        };

        this.logger.log(`create widget for approved tasks kpi.`);
        const {widget, jwtToken} = await this.CreateWidget(null, null, null, template, query);
        expect(widget).toBeDefined();
        expect(widget.query).toEqual(query);
        expect(widget.template).toEqual(template);

        return {widget, jwtToken};
    }

    /**
     * Creates a widget for tasks table.
     * @returns {Promise<{widget: WidgetDto; jwtToken: TokenInterface}>} - A promise that resolves to an object containing the created widget and a JWT token.
     */
    @Test('Create Tasks Table Widget')
    async CreateTasksTableWidget(): Promise<{widget: WidgetDto; jwtToken: TokenInterface}> {
        const template = 'tasksTable';

        this.logger.log(`create widget for tasks table.`);
        const {widget, jwtToken} = await this.CreateWidget(null, null, null, template);
        expect(widget).toBeDefined();

        expect(widget.template).toEqual(template);

        return {widget, jwtToken};
    }

    /**
     * Creates a widget for tasks list.
     * @returns {Promise<{widget: WidgetDto; jwtToken: TokenInterface}>} - A promise that resolves to an object containing the created widget and a JWT token.
     */
    @Test('Create Tasks List Widget')
    async CreateTasksListWidget(): Promise<{widget: WidgetDto; jwtToken: TokenInterface}> {
        const template = 'tasksList';

        this.logger.log(`create widget for tasks list.`);
        const {widget, jwtToken} = await this.CreateWidget(null, null, null, template);
        expect(widget).toBeDefined();

        expect(widget.template).toEqual(template);

        return {widget, jwtToken};
    }

    /**
     * Creates a widget for approvals list.
     * @returns {Promise<{widget: WidgetDto; jwtToken: TokenInterface}>} - A promise that resolves to an object containing the created widget and a JWT token.
     */
    @Test('Create Approvals List Widget')
    async CreateApprovalsListWidget(): Promise<{widget: WidgetDto; jwtToken: TokenInterface}> {
        const template = 'approvalsList';

        this.logger.log(`create widget for approvals list.`);
        const {widget, jwtToken} = await this.CreateWidget(null, null, null, template);
        expect(widget).toBeDefined();

        expect(widget.template).toEqual(template);

        return {widget, jwtToken};
    }

    /**
     * Creates a widget for pie chart.
     * @returns {Promise<{widget: WidgetDto; jwtToken: TokenInterface}>} - A promise that resolves to an object containing the created widget and a JWT token.
     */
    @Test('Create Pie Chart Widget')
    async CreatePieChartWidget(): Promise<{widget: WidgetDto; jwtToken: TokenInterface}> {
        const template = 'pieChartProgress';

        const query = {
            groupBy: 'folder',
        };

        this.logger.log(`create widget for pie chart.`);
        const {widget, jwtToken} = await this.CreateWidget(null, null, null, template, query);
        expect(widget).toBeDefined();
        expect(widget.query).toEqual(query);
        expect(widget.template).toEqual(template);

        return {widget, jwtToken};
    }

    /**
     * Creates a widget for bar chart.
     * @returns {Promise<{widget: WidgetDto; jwtToken: TokenInterface}>} - A promise that resolves to an object containing the created widget and a JWT token.
     */
    @Test('Create Bar Chart Widget')
    async CreateBarChartWidget(): Promise<{widget: WidgetDto; jwtToken: TokenInterface}> {
        const template = 'barChartProgress';

        const query = {
            countBy: WidgetCountByOptions.TASKS,
            groupBy: WidgetFilterTypeNameOptions.Folder,
        };

        this.logger.log(`create widget for bar chart.`);
        const {widget, jwtToken} = await this.CreateWidget(null, null, null, template, query);
        expect(widget).toBeDefined();
        expect(widget.query).toEqual(query);
        expect(widget.template).toEqual(template);

        return {widget, jwtToken};
    }

    /**
     * Deletes a widget.
     * @returns {Promise<void>} - A Promise that resolves when the binding is successful.
     */
    @Test('Update Widget')
    async updateWidget(): Promise<void> {
        this.logger.log(`Create widget`);
        const {widget, jwtToken} = await this.CreateWidget();

        const fakeWidget = this.factory.fakeUpdateWidget(widget.dashboardId);

        this.logger.log('Update widget');
        await this.patch(`${widget.id}`, fakeWidget, jwtToken.accessToken).expect(HttpStatus.OK);

        this.logger.log('Check if widget exists (it should not exists)');
        const {body: widgetDB} = await this.get(`dashboard/${widget.dashboardId}`, jwtToken.accessToken);
        expect(widgetDB).toBeDefined();
        expect(widgetDB).not.toContainEqual(widget);
    }

    /**
     * Gets widgets.
     * @returns {Promise<void>} - A Promise that resolves when the binding is successful.
     */
    @Test('Get All Widgets')
    async GetAllWidgets(): Promise<void> {
        this.logger.log(`Create init widget`);
        const {widget: initWidget, jwtToken: widgetJwtToken} = await this.CreateWidget();

        this.logger.log('create additional widgets');
        const createdWidgets = await this.createManyFakeWidgets(widgetJwtToken, initWidget.widgetTypeId, initWidget.dashboardId);
        const {body: widgets} = await this.get(`dashboard/${initWidget.dashboardId}`, widgetJwtToken.accessToken).expect(HttpStatus.OK);

        expect(widgets).toBeDefined();
        expect([...widgets, initWidget].map((f) => f.id)).toEqual(
            expect.arrayContaining([...createdWidgets.map((f) => f.id), initWidget.id])
        );
    }

    /**
     * Deletes a widget.
     * @returns {Promise<void>} - A Promise that resolves when the binding is successful.
     */
    @Test('Delete Widget')
    async DeleteWidget(): Promise<void> {
        this.logger.log(`Create widget`);
        const {widget, jwtToken} = await this.CreateWidget();
        this.logger.log('Delete widget');
        await this.delete(`${widget.id}`, jwtToken.accessToken).expect(HttpStatus.OK);

        this.logger.log('Check if widget exists (it should not exists)');
        const {body: widgetDB} = await this.get(`dashboard/${widget.dashboardId}`, jwtToken.accessToken);
        expect(widgetDB).toBeDefined();
        expect(widgetDB).not.toContainEqual(widget);
    }

    @It()
    async CheckForWidgetTasksData(): Promise<void> {
        this.logger.log(`Create user`);
        const fakeUser = await this.userFactory.createUserForLogin({
            [EntityTypeOptions.Widget]: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            [EntityTypeOptions.Dashboard]: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            folderWorkflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            purgeFoldersAndTasks: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            replaceFolderOwner: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            displacementGroup: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            folder: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            space: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            commonCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            userCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            teams: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            customFieldCollection: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            user: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            workflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        this.logger.log(`do login`);
        const response = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        const jwtToken = response.body;

        this.logger.log('Create folder');
        const fakeFolder = await this.createFolder(jwtToken.accessToken);
        expect(fakeFolder).toBeDefined();

        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        this.logger.log('create task');
        const fakeTask = this.taskFactory.fakeCreateTask(userId, fakeFolder.id);
        const {body: task} = await this.post(`/task`, fakeTask, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(task.description).toBe(fakeTask.description);
        expect(task.title).toBe(fakeTask.title);
        expect(task.startDate).toBe(fakeTask.startDate.toISOString());
        this.logger.log('create tag');
        const tag = await this.tagFactory.createTag();
        this.logger.log('add tag to task');
        await this.post(`/task/tag/${task.id}/${tag.id}/${fakeFolder.id}`, {}, jwtToken.accessToken).expect(HttpStatus.CREATED);
        const {body: taskResponse} = await this.get(`/task/${task.id}/folder/${fakeFolder.id}`, jwtToken.accessToken);
        expect(taskResponse.tags.length).toBe(1);
        expect(taskResponse.tags[0]).toBe(tag.id);

        this.logger.log('Create dashboard');
        const fakeDto = this.dashboardFactory.fakeCreateDashboard();

        const {body: dashboard} = await this.post(`/dashboard`, fakeDto, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(dashboard).toBeDefined();

        const dashboardId = dashboard.id;

        this.logger.log('create widget category');
        const fakeWidgetCategory = this.factory.fakeCreateWidgetCategory();
        const {body: widgetCategory} = await this.post(`categories`, fakeWidgetCategory, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(widgetCategory).toBeDefined();

        this.logger.log('create widget types');
        const template = 'tasksTable';
        const fakeWidgetType = this.factory.fakeCreateWidgetType(widgetCategory.id, template);
        const {body: widgetType} = await this.post(`types`, fakeWidgetType, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(widgetType).toBeDefined();

        const widgetTypeId = widgetType.id;

        this.logger.log(`create widget`);
        const fakeWidget = this.factory.fakeCreateWidget([fakeFolder.id], widgetTypeId, dashboardId, null, null);
        const res = await this.post(``, fakeWidget, jwtToken.accessToken);

        expect(res.status).toBe(HttpStatus.CREATED);
        const {body: widget} = res;
        expect(widget).toBeDefined();

        const {body: widgetTask} = await this.post(`widget-tasks/${widget.id}`, null, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(widgetTask[0].stateTitle).toBeDefined();
        expect(widgetTask[0].Tags.length).toBe(1);
    }
    /**
     * Creates multiple fake widget categories.
     *
     * @param {string} accessToken - The access token for authentication.
     * @returns {Promise<WidgetCategoryDto[]>} - Promise that resolves with an array of created widget categories.
     */
    private async createManyFakeWidgetCategories(accessToken: string): Promise<WidgetCategoryDto[]> {
        this.logger.log('Create many fake widget categories');
        const randomNumber = faker.number.int({min: 2, max: 3}),
            createdWidgetCategories = [];

        for (let i = 0; i < randomNumber; i++) {
            this.logger.log('Create widget category');
            const fakeCategory = this.factory.fakeCreateWidgetCategory();
            const {body: createdFakeCategory} = await this.post(`categories`, fakeCategory, accessToken);

            expect(createdFakeCategory).toBeDefined();
            createdWidgetCategories.push(createdFakeCategory);
        }
        return createdWidgetCategories;
    }

    /**
     * Creates multiple fake widget types.
     *
     * @param {string} accessToken - The access token for authentication.
     * @returns {Promise<WidgetTypesDto[]>} - Promise that resolves with an array of created widget types.
     */
    private async createManyFakeWidgetTypes(accessToken: string): Promise<WidgetTypesDto[]> {
        this.logger.log('Create many fake widget types');
        const randomNumber = faker.number.int({min: 2, max: 3}),
            createdWidgetTypes = [];

        for (let i = 0; i < randomNumber; i++) {
            this.logger.log('Create widget category');
            const fakeCategory = this.factory.fakeCreateWidgetCategory();
            const {body: createdFakeCategory} = await this.post(`categories`, fakeCategory, accessToken);

            this.logger.log('Create widget types');
            const fakeTypes = this.factory.fakeCreateWidgetType(createdFakeCategory.id);
            const {body: createdFakeTypes} = await this.post(`types`, fakeTypes, accessToken);

            expect(createdFakeTypes).toBeDefined();
            createdWidgetTypes.push(createdFakeTypes);
        }
        return createdWidgetTypes;
    }

    /**
     * Creates multiple fake widgets.
     *
     * @param {TokenInterface} jwtToken - The JWT token for authentication.
     * @param {number} widgetTypeId - The ID of the widget type.
     * @param {number} dashboardId - The ID of the dashboard.
     * @returns {Promise<WidgetDto[]>} - A promise that resolves to an array of created widget objects.
     */
    private async createManyFakeWidgets(jwtToken: TokenInterface, widgetTypeId: number, dashboardId: number): Promise<WidgetDto[]> {
        const randomNumber = faker.number.int({min: 1, max: 2}),
            createdWidgets = [];

        for (let i = 0; i < randomNumber; i++) {
            this.logger.log('Create folder');
            const fakeFolder = await this.createFolder(jwtToken.accessToken);
            expect(fakeFolder).toBeDefined();

            this.logger.log(`create widget`);
            const fakeWidget = this.factory.fakeCreateWidget([fakeFolder.id], widgetTypeId, dashboardId);
            const {body: widget} = await this.post(``, fakeWidget, jwtToken.accessToken).expect(HttpStatus.CREATED);
            expect(widget).toBeDefined();
        }
        return createdWidgets;
    }

    /**
     * Creates fake folder.
     *
     * @param {string} accessToken - The access token for authentication.
     * @returns {Promise<FolderEntity>} - Promise that resolves with an array of created folders.
     */
    private async createFolder(accessToken: string): Promise<FolderEntity> {
        const userId = this.getUserIdFromAccessToken(accessToken);

        const parentFolderId: number = null,
            showOn: string[] = [TASK_MANAGEMENT],
            workflow: WorkFlowEntity = await this.createWorkflowForFolder(accessToken),
            fakeChangeWorkflow: ChangeWorkflowFolderDto = {
                commonWorkflow: workflow.id,
                type: ChangeWorkflowOptions.COMMON_TO_COMMON,
                Mapping: [],
                personaliseWorkflow: null,
            };

        const spaceResponse = await this.createSpace(userId, accessToken, [workflow.id]);
        this.logger.log('Create folder');
        const fakeFolder = this.folderFactory.fakeCreateFolder(
            fakeChangeWorkflow,
            parentFolderId,
            DefaultViewOptions.BOARD,
            showOn,
            spaceResponse.id
        );
        const {body: folder} = await this.post(`/folder`, fakeFolder, accessToken).expect(HttpStatus.CREATED);
        expect(folder).toBeDefined();

        return folder;
    }

    /**
     * Creates a workflow.
     * @param {number} token - Token of the user.
     * @returns {Promise<WorkFlowEntity>} - A promise that resolves to an object containing the created folder and a JWT token.
     */
    private async createWorkflowForFolder(token: string): Promise<WorkFlowEntity> {
        this.logger.log('Get system stages');
        const {body: systemStages} = await this.get(`/displacement-group/system-stage`, token);
        expect(systemStages).toBeDefined();

        this.logger.log('Create workflow');
        const fakeWorkflow = this.workflowFactory.fakeCreateWorkflow(systemStages[0]?.id);
        const {body, status} = await this.post(`/workflow`, fakeWorkflow, token);
        expect(status).toBe(HttpStatus.CREATED);
        this.logger.log(`check workflow exists`);
        const {body: workflowDB, status: workflowDBStatus} = await this.get(`/workflow/${body.id}`, token);
        expect(workflowDBStatus).toBe(HttpStatus.OK);
        const workflowWithoutCode1 = {
            ...workflowDB,
            states: workflowDB.states.map(({code: _, swimlaneConstraint: __, ...rest}) => rest),
        };
        const workflowWithoutCode2 = {
            ...fakeWorkflow,
            states: fakeWorkflow.states.map(({code: _, swimlaneConstraint: __, ...rest}) => rest),
        };
        expect(workflowWithoutCode1).toMatchObject(workflowWithoutCode2);
        return workflowDB;
    }

    /**
     * Creates a user.
     * @param {PermissionsType} permissions - permissions of the user.
     * @returns {Promise<TestResponse>} - A promise that resolves to an object containing the created folder and a JWT token.
     */
    private async createUserWithPermissions(permissions: PermissionsType): Promise<TestResponse> {
        this.logger.log(`Create user`);
        const fakeUser = await this.userFactory.createUserForLogin(permissions);
        return this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
    }

    private async createSpace(userId: string, accessToken: string, workflowIds: number[]): Promise<GetFolderDto> {
        this.logger.log('create a team');
        const {teamId} = await this.createTeamForSpace(accessToken);
        this.logger.log('create custom field collection');
        const {cfcId} = await this.createSpaceCustomFieldCollection(accessToken);
        this.logger.log('create a space');
        const fakeCreateSpace = this.folderFactory.fakeCreateSpace({
            availableWorkflows: workflowIds,
            customFieldCollections: [cfcId],
            teams: [{id: teamId, teamPermission: UserPermissionOptions.FULL}],
        });
        const {body: spaceResponse} = await this.post(`/space`, fakeCreateSpace, accessToken).expect(HttpStatus.CREATED);
        expect(spaceResponse).toBeDefined();
        return spaceResponse;
    }

    private async createTeamForSpace(token: string): Promise<{teamId: number}> {
        const userId = this.getUserIdFromAccessToken(token);
        const fakeCreateTeamDto = this.teamFactory.fakeCreateTeamDto([userId]);
        const {body: teamResponse} = await this.post(`/team`, fakeCreateTeamDto, token).expect(HttpStatus.CREATED);
        expect(teamResponse.id).toBeDefined();
        return {teamId: teamResponse.id};
    }

    private async createSpaceCustomFieldCollection(token: string): Promise<{cfcId: number}> {
        const customFieldDefinitionOptions = this.customFieldDefinitionFactory.fakeCreateCustomFieldDefinitionOptions();
        const customFieldDefinitionDto = this.customFieldDefinitionFactory.fakeCreateCustomFieldDefinition(customFieldDefinitionOptions);
        const {body: customFieldDefinition1} = await this.post('/custom-field-definition', customFieldDefinitionDto, token);
        expect(customFieldDefinition1).toBeDefined();
        expect(customFieldDefinition1.identifiers[0].id).toBeGreaterThan(0);
        const fakeCustomFieldCollectionDto = this.customFieldCollectionFactory.fakeCreateCustomFieldCollection([
            customFieldDefinition1.identifiers[0].id,
        ]);
        this.logger.log('create custom field collection');
        const {body: response} = await this.post('/custom-field-collection', fakeCustomFieldCollectionDto, token).expect(
            HttpStatus.CREATED
        );
        expect(response).toBeDefined();
        expect(response.identifiers[0].id).toBeGreaterThan(0);
        return {cfcId: response.identifiers[0].id};
    }
}
