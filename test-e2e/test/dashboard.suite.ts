import {faker} from '@faker-js/faker';
import {TASK_MANAGEMENT, TokenInterface} from '@lib/base-library';
import {HttpStatus, Inject, Logger, OnModuleInit} from '@nestjs/common';
import {Test, TestSuite} from 'nestjs-jest-decorators';
import {Test as TestResponse} from 'supertest';
import {DashboardDto} from '../../src/dto/dashboard/dashboard.dto';
import {GenericMemberDto} from '../../src/dto/dashboard/generic-member.dto';
import {ChangeWorkflowFolderDto, ChangeWorkflowOptions} from '../../src/dto/folder/folder/change-workflow.dto';
import {GetFolderDto} from '../../src/dto/folder/folder/get-folder.dto';
import {DashboardTypesOptions} from '../../src/enum/dashboard-type.enum';
import {UserPermissionOptions} from '../../src/enum/dashboard-user.enum';
import {DefaultViewOptions} from '../../src/enum/folder.enum';
import {FolderEntity} from '../../src/model/folder.entity';
import {WorkFlowEntity} from '../../src/model/workflow.entity';
import {EntityTypeOptions, PermissionOptions} from '../../src/module/authorization-impl/authorization.enum';
import {DashboardFactory} from '../factory/dashboard.factory';
import {FolderFactory} from '../factory/folder.factory';
import {PermissionsType, UserFactory} from '../factory/user.factory';
import {WorkflowFactory} from '../factory/workflow.factory';
import {NewBaseTest} from './base-test';

@TestSuite('Dashboard Suite')
export class DashboardE2eSpec extends NewBaseTest implements OnModuleInit {
    private readonly logger = new Logger(DashboardE2eSpec.name);

    @Inject()
    private factory: DashboardFactory;
    @Inject()
    private userFactory: UserFactory;
    @Inject()
    private workflowFactory: WorkflowFactory;
    @Inject()
    private folderFactory: FolderFactory;

    onModuleInit(): void {
        this.setUrl('/dashboard');
    }

    /**
     * Creates a dashboard.
     * @returns {Promise<{dashboard: DashboardDto; jwtToken: TokenInterface}>} - A promise that resolves to an object containing the created dashboard and a JWT token.
     */
    @Test('createDashboard')
    async createDashboard(
        jwtToken?: TokenInterface,
        members: GenericMemberDto[] = [],
        type: DashboardTypesOptions = DashboardTypesOptions.My
    ): Promise<{dashboard: DashboardDto; jwtToken: TokenInterface}> {
        if (!jwtToken) {
            this.logger.log(`Create user`);
            const fakeUser = await this.userFactory.createUserForLogin({
                [EntityTypeOptions.Widget]: PermissionOptions.CREATE_READ_UPDATE_DELETE,
                [EntityTypeOptions.Folder]: PermissionOptions.CREATE_READ_UPDATE_DELETE,
                [EntityTypeOptions.Dashboard]: PermissionOptions.CREATE_READ_UPDATE_DELETE,
                workflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
                folderWorkflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
                purgeFoldersAndTasks: PermissionOptions.CREATE_READ_UPDATE_DELETE,
                replaceFolderOwner: PermissionOptions.CREATE_READ_UPDATE_DELETE,
                displacementGroup: PermissionOptions.CREATE_READ_UPDATE_DELETE,
                space: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            });
            this.logger.log(`do login`);
            const response = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
            jwtToken = response.body;
        }
        if (!members.length) {
            members = await this.createManyMembers();
        }

        this.logger.log('Create dashboard');
        const fakeCreateDashboard = this.factory.fakeCreateDashboard(members);
        fakeCreateDashboard.dashboardType = type;
        const {body: dashboard} = await this.post(``, fakeCreateDashboard, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(dashboard).toBeDefined();

        this.logger.log(`Check dashboard exists`);
        const response = await this.get(`${dashboard.id}`, jwtToken.accessToken);
        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body).toStrictEqual(dashboard);

        return {dashboard, jwtToken};
    }

    /**
     * Updates a dashboard.
     *
     * @returns {Promise<void>} - A promise that resolves when the dashboard is updated successfully.
     */
    @Test('Update dashboard')
    async updateDashboard(): Promise<void> {
        const fakeUpdateDashboard = this.factory.fakeUpdateDashboard();
        this.logger.log('Create a dashboard');
        const {dashboard, jwtToken} = await this.createDashboard();

        this.logger.log('Update dashboard');
        const {body: resp} = await this.patch(`${dashboard.id}`, fakeUpdateDashboard, jwtToken.accessToken);

        expect(resp).toBeDefined();

        this.logger.log('get updated dashboard');
        const {body: updatedDashboard} = await this.get(`${dashboard.id}`, jwtToken.accessToken).expect(HttpStatus.OK);

        expect({
            dashboardName: updatedDashboard.dashboardName,
            isDefault: updatedDashboard.isDefault,
            isFavourite: updatedDashboard.isFavourite,
            dashboardType: updatedDashboard.dashboardType,
            description: updatedDashboard.description,
        }).toMatchObject({
            dashboardName: fakeUpdateDashboard.dashboardName,
            isDefault: fakeUpdateDashboard.isDefault,
            isFavourite: fakeUpdateDashboard.isFavourite,
            dashboardType: fakeUpdateDashboard.dashboardType,
            description: fakeUpdateDashboard.description,
        });
    }

    /**
     * Add Folder to a dashboard.
     * @returns {Promise<void>} - A Promise that resolves when the a folder is added to dashboard.
     */
    @Test('add folder to dashboard')
    async addFolderToDashboard(): Promise<void> {
        this.logger.log(`Create dashboard`);
        const {dashboard, jwtToken} = await this.createDashboard();

        this.logger.log(`Create folders`);
        const fakeFolder1 = await this.createFolder(jwtToken.accessToken);
        const fakeFolder2 = await this.createFolder(jwtToken.accessToken);
        expect(fakeFolder1).toBeDefined();
        expect(fakeFolder2).toBeDefined();

        this.logger.log(`add folders to dashbaord`);
        await this.patch(`${dashboard.id}/folders`, {insert: [fakeFolder1.id, fakeFolder2.id], delete: []}, jwtToken.accessToken).expect(
            HttpStatus.OK
        );

        const {body: dashboardDB} = await this.get(`${dashboard.id}`, jwtToken.accessToken);
        expect(dashboardDB).toBeDefined();
        const folder1 = dashboardDB.folders.find((f) => (f.id = fakeFolder1.id));
        const folder2 = dashboardDB.folders.find((f) => (f.id = fakeFolder2.id));
        expect(folder1).toBeDefined();
        expect(folder2).toBeDefined();

        this.logger.log(`remove folders from dashbaord`);
        await this.patch(`${dashboard.id}/folders`, {insert: [], delete: [fakeFolder1.id, fakeFolder2.id]}, jwtToken.accessToken).expect(
            HttpStatus.OK
        );

        const {body: dashboardDBUpdated} = await this.get(`${dashboard.id}`, jwtToken.accessToken);
        expect(dashboardDBUpdated).toBeDefined();
        const folder3 = dashboardDBUpdated.folders.find((f) => (f.id = fakeFolder1.id));
        const folder4 = dashboardDBUpdated.folders.find((f) => (f.id = fakeFolder2.id));
        expect(folder3).toBeUndefined();
        expect(folder4).toBeUndefined();
    }

    /**
     * Makes dashboard default
     *
     * @returns {Promise<void>} - A promise that resolves when the dashboard is updated successfully.
     */
    @Test('Default dashboard')
    async makeDashboardDefault(): Promise<void> {
        const isDefault = true;
        const fakeUpdateDashboard = this.factory.fakeUpdateDashboard(isDefault);
        this.logger.log('Create a dashboard');
        const {dashboard, jwtToken} = await this.createDashboard();

        this.logger.log('Update dashboard');
        const {body: resp} = await this.patch(`${dashboard.id}`, fakeUpdateDashboard, jwtToken.accessToken);
        expect(resp).toBeDefined();

        this.logger.log('get updated default dashboard');
        const {body: updatedDashboard} = await this.get(`${dashboard.id}`, jwtToken.accessToken).expect(HttpStatus.OK);
        expect({
            dashboardName: updatedDashboard.dashboardName,
            isDefault: updatedDashboard.isDefault,
            isFavourite: updatedDashboard.isFavourite,
            dashboardType: updatedDashboard.dashboardType,
            description: updatedDashboard.description,
        }).toMatchObject({
            dashboardName: fakeUpdateDashboard.dashboardName,
            isDefault: fakeUpdateDashboard.isDefault,
            isFavourite: fakeUpdateDashboard.isFavourite,
            dashboardType: fakeUpdateDashboard.dashboardType,
            description: fakeUpdateDashboard.description,
        });
    }

    /**
     * Makes dashboard favourite
     *
     * @returns {Promise<void>} - A promise that resolves when the dashboard is updated successfully.
     */
    @Test('Default favourite')
    async makeDashboardFavourite(): Promise<void> {
        const isFavourite = true;
        const fakeUpdateDashboard = this.factory.fakeUpdateDashboard(false, isFavourite);
        this.logger.log('Create a dashboard');
        const {dashboard, jwtToken} = await this.createDashboard();

        this.logger.log('Update dashboard');
        const {body: resp} = await this.patch(`${dashboard.id}`, fakeUpdateDashboard, jwtToken.accessToken).expect(HttpStatus.OK);
        expect(resp).toBeDefined();

        this.logger.log('get updated favourite dashboard');
        const {body: updatedDashboard} = await this.get(`${dashboard.id}`, jwtToken.accessToken).expect(HttpStatus.OK);
        expect({
            dashboardName: updatedDashboard.dashboardName,
            isDefault: updatedDashboard.isDefault,
            isFavourite: updatedDashboard.isFavourite,
            dashboardType: updatedDashboard.dashboardType,
            description: updatedDashboard.description,
        }).toMatchObject({
            dashboardName: fakeUpdateDashboard.dashboardName,
            isDefault: fakeUpdateDashboard.isDefault,
            isFavourite: fakeUpdateDashboard.isFavourite,
            dashboardType: fakeUpdateDashboard.dashboardType,
            description: fakeUpdateDashboard.description,
        });
    }

    /**
     * Updates a dashboard's folders.
     *
     * @returns {Promise<void>} - A promise that resolves when the dashboard is updated successfully.
     */
    @Test('Update dashboard folders')
    async updateDashboardFolders(): Promise<void> {
        this.logger.log('Create a dashboard');
        const {dashboard, jwtToken} = await this.createDashboard();

        this.logger.log('Create folder for update');
        const folder = await this.createFolder(jwtToken.accessToken);
        const fakeUpdateDashboard = this.factory.fakeUpdateDashboardFolders([folder.id]);

        this.logger.log('Update dashboard');
        const {body: resp} = await this.patch(`${dashboard.id}/folders`, fakeUpdateDashboard, jwtToken.accessToken).expect(HttpStatus.OK);
        expect(resp).toBeDefined();

        this.logger.log('Get updated dashboard should return dashboard with new folder in it');
        const {body: updatedDashboard} = await this.get(`${dashboard.id}`, jwtToken.accessToken).expect(HttpStatus.OK);
        expect(resp).toBeDefined();

        const folderIds = updatedDashboard.folders.map((folder) => folder.id);
        expect(folderIds).toContain(folder.id);
    }

    /**
     * Deletes a dashboard and verifies that it no longer exists.
     *
     * @returns {Promise<void>} Promise that resolves when the dashboard has been deleted.
     */
    @Test('Delete Dashboard')
    async deleteDashboard(): Promise<void> {
        const {dashboard, jwtToken} = await this.createDashboard();

        this.logger.log('Check dashboard exists');
        await this.get(`${dashboard.id}`, jwtToken.accessToken).expect(HttpStatus.OK);

        await this.delete(`${dashboard.id}`, jwtToken.accessToken);

        this.logger.log('Check dashboard exists (it should not exists)');
        await this.get(`${dashboard.id}`, jwtToken.accessToken).expect(HttpStatus.FORBIDDEN);
    }

    /**
     * Get all Dashboards.
     *
     * @returns {Promise<void>} A Promise that resolves when the operation is complete.
     */
    @Test('Get all Dashboards')
    async getAllDashboards(): Promise<void> {
        this.logger.log('create user for getAllDashboards');
        const {body: jwtToken} = await this.createUserWithPermissions({
            dashboard: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            folder: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });

        this.logger.log('Create dashboards for getAllDashboards');
        const createdDashboards = await this.createManyFakeDashboards(jwtToken.accessToken);

        this.logger.log('Get Many dashboards should get all dashboards where user have permissions to read a dashboard');
        const {body: dashboardDB} = await this.get('', jwtToken.accessToken);
        expect(dashboardDB.length).toBeGreaterThan(0);
        expect(dashboardDB.map((f) => f.id)).toEqual(expect.arrayContaining(createdDashboards.map((f) => f.id)));
    }

    /**
     * Get my Dashboards.
     *
     * @returns {Promise<void>} A Promise that resolves when the operation is complete.
     */
    @Test('Get my Dashboards')
    async getMyDashboards(): Promise<void> {
        this.logger.log('create user for getMyDashboards');
        const {body: jwtToken} = await this.createUserWithPermissions({
            dashboard: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            folder: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });

        this.logger.log('Create dashboards for getMyDashboards');
        const createdDashboards = await this.createManyFakeDashboardsByType(jwtToken.accessToken, DashboardTypesOptions.My);

        const dashboardIds = [...createdDashboards.map((f) => f.id)];

        this.logger.log('Get Many dashboards should get all dashboards where user have owner permissions');
        const {body: dashboardDB} = await this.get('my', jwtToken.accessToken);
        expect(dashboardDB.length).toBeGreaterThan(0);
        expect(dashboardDB.map((f) => f.id)).toEqual(expect.arrayContaining(dashboardIds));
    }

    /**
     * Get shared Dashboards.
     *
     * @returns {Promise<void>} A Promise that resolves when the operation is complete.
     */
    @Test('Get shared Dashboards')
    async getSharedDashboards(): Promise<void> {
        this.logger.log('create owner user for getSharedDashboards');
        const {body: OwnerToken} = await this.createUserWithPermissions({
            dashboard: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            folder: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });

        this.logger.log('create member for getSharedDashboards');
        const {body: memberToken} = await this.createUserWithPermissions({
            dashboard: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            folder: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });

        const member = {
            id: memberToken.id,
            userPermissions: faker.string.fromCharacters([
                UserPermissionOptions.FULL,
                UserPermissionOptions.EDITOR,
                UserPermissionOptions.READONLY,
            ]) as UserPermissionOptions,
        };

        this.logger.log('create dashboard with member for getSharedDashboards');
        const {
            dashboard: {members: createdDashboardMembers},
        } = await this.createDashboard(OwnerToken, [member], DashboardTypesOptions.Shared);
        expect(createdDashboardMembers.length).toBeGreaterThanOrEqual(2);

        this.logger.log(
            'Get Many dashboards should get all dashboards where user have permissions to read, and where dashboardType is shared'
        );
        const {body: dashboardDB} = await this.get('shared', memberToken.accessToken);
        expect(dashboardDB).toEqual(expect.arrayContaining(dashboardDB));
    }

    @Test('Create System Dashboard')
    async createSystemDashboard(): Promise<void> {
        this.logger.log(`Create user`);
        const fakeUser = await this.userFactory.createUserForLogin({
            [EntityTypeOptions.Widget]: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            [EntityTypeOptions.Folder]: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            [EntityTypeOptions.Dashboard]: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            workflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            folderWorkflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            purgeFoldersAndTasks: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            replaceFolderOwner: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            displacementGroup: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            space: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        this.logger.log(`do login`);
        const loginResponse = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        const jwtToken = loginResponse.body;
        const members = await this.createManyMembers();

        this.logger.log('Create system dashboard');
        const fakeCreateDashboard = this.factory.fakeCreateDashboard(members);
        fakeCreateDashboard.dashboardType = DashboardTypesOptions.My;
        fakeCreateDashboard.isSystem = true;
        const {body: dashboard} = await this.post(``, fakeCreateDashboard, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(dashboard).toBeDefined();

        this.logger.log(`Check dashboard exists`);
        const response = await this.get(`${dashboard.id}`, jwtToken.accessToken);
        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body).toStrictEqual(dashboard);
    }
    /**
     * Creates multiple fake dashboards.
     *
     * @param {string} accessToken - The access token for authentication.
     * @returns {Promise<DashboardDto[]>} - Promise that resolves with an array of created dashboards.
     */
    private async createManyFakeDashboards(accessToken: string): Promise<DashboardDto[]> {
        const randomNumber = faker.number.int({min: 2, max: 3}),
            createdDashboards = [];

        for (let i = 0; i < randomNumber; i++) {
            const fakeDashboard = this.factory.fakeCreateDashboard();
            const {body: f1, status} = await this.post(``, fakeDashboard, accessToken);
            expect(status).toBe(HttpStatus.CREATED);
            expect(f1).toBeDefined();
            createdDashboards.push(f1);
        }
        return createdDashboards;
    }

    /**
     * Creates multiple fake dashboards with specific dashboardType
     *
     * @param {string} accessToken - The access token for authentication.
     * @returns {Promise<DashboardDto[]>} - Promise that resolves with an array of created dashboards.
     */
    private async createManyFakeDashboardsByType(accessToken: string, type: DashboardTypesOptions): Promise<DashboardDto[]> {
        const randomNumber = faker.number.int({min: 3, max: 4}),
            createdDashboards = [];

        for (let i = 0; i < randomNumber; i++) {
            const fakeDashboard = this.factory.fakeCreateDashboard();
            fakeDashboard.dashboardType = type;

            const {body: f1, status} = await this.post(``, fakeDashboard, accessToken);
            expect(status).toBe(HttpStatus.CREATED);
            expect(f1).toBeDefined();
            createdDashboards.push(f1);
        }
        return createdDashboards;
    }

    /**
     * Creates multiple members for dashboard
     *
     * @param {string} accessToken - The access token for authentication.
     * @returns {Promise<GenericMemberDto[]>} - Promise that resolves with an array of created dashboards.
     */
    private async createManyMembers(): Promise<GenericMemberDto[]> {
        const randomNumber = faker.number.int({min: 3, max: 4}),
            createdMembers = [];

        for (let i = 0; i < randomNumber; i++) {
            this.logger.log('create a member');
            const {body: memberJwt} = await this.createUserWithPermissions({
                dashboard: PermissionOptions.CREATE_READ_UPDATE_DELETE,
                folder: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            });
            expect(memberJwt).toBeDefined();
            createdMembers.push({
                id: memberJwt.id,
                userPermissions: faker.string.fromCharacters([
                    UserPermissionOptions.FULL,
                    UserPermissionOptions.EDITOR,
                    UserPermissionOptions.READONLY,
                ]) as UserPermissionOptions,
                memberJwt,
            });
        }
        return createdMembers;
    }

    /**
     * Creates a workflow.
     * @param {number} token - Token of the user.
     * @returns {Promise<WorkFlowEntity>} - A promise that resolves to an object containing the created folder and a JWT token.
     */
    private async createWorkflowForFolder(token: string): Promise<WorkFlowEntity> {
        const {body: systemStages} = await this.get(`/displacement-group/system-stage`, token);

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
     * Creates fake folder.
     *
     * @param {string} accessToken - The access token for authentication.
     * @returns {Promise<FolderEntity>} - Promise that resolves with an array of created folders.
     */
    private async createFolder(accessToken: string): Promise<FolderEntity> {
        const parentFolderId: number = null,
            showOn: string[] = [TASK_MANAGEMENT],
            workflow: WorkFlowEntity = await this.createWorkflowForFolder(accessToken),
            fakeChangeWorkflow: ChangeWorkflowFolderDto = {
                commonWorkflow: workflow.id,
                type: ChangeWorkflowOptions.COMMON_TO_COMMON,
                Mapping: [],
                personaliseWorkflow: null,
            };

        this.logger.log('Create folder');
        const userId = this.getUserIdFromAccessToken(accessToken);
        const spaceResponse = await this.createSpace(userId, accessToken, [workflow.id]);

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
     * Creates multiple fake folders.
     *
     * @param {string} accessToken - The access token for authentication.
     * @returns {Promise<FolderEntity[]>} - Promise that resolves with an array of created folders.
     */
    private async createManyFakeFolders(accessToken: string): Promise<FolderEntity[]> {
        const randomNumber = faker.number.int({min: 3, max: 4}),
            createdFolders = [];

        for (let i = 0; i < randomNumber; i++) {
            const fakeFolder = this.createFolder(accessToken);
            const {body: f1, status} = await this.post(``, fakeFolder, accessToken);
            expect(status).toBe(HttpStatus.CREATED);
            expect(f1).toBeDefined();
            createdFolders.push(f1);
        }
        return createdFolders;
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
        this.logger.log('create a space');
        const fakeCreateSpace = this.folderFactory.fakeCreateSpace({
            availableWorkflows: workflowIds,
        });
        const {body: spaceResponse} = await this.post(`/space`, fakeCreateSpace, accessToken).expect(HttpStatus.CREATED);
        expect(spaceResponse).toBeDefined();
        return spaceResponse;
    }
}
