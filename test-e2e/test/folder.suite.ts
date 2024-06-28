import {faker} from '@faker-js/faker';
import {FINANCIAL_OUTLOOK, TASK_MANAGEMENT, TokenInterface} from '@lib/base-library';
import {HttpStatus, Inject, Logger, OnModuleInit} from '@nestjs/common';
import {randomEnum} from '@test-lib/test-base-library';
import {Test, TestSuite} from 'nestjs-jest-decorators';
import {Test as TestResponse} from 'supertest';
import {PAS_USER_SYNC_EMAIL, PAS_USER_SYNC_PASSWORD} from '../../src/const/env.const';
import {ChangeWorkflowFolderDto, ChangeWorkflowOptions} from '../../src/dto/folder/folder/change-workflow.dto';
import {GetFolderDto} from '../../src/dto/folder/folder/get-folder.dto';
import {UserPermissionOptions} from '../../src/enum/folder-user.enum';
import {DefaultViewOptions, FolderTypeOptions} from '../../src/enum/folder.enum';
import {FolderEntity} from '../../src/model/folder.entity';
import {WorkFlowEntity} from '../../src/model/workflow.entity';
import {PermissionOptions} from '../../src/module/authorization-impl/authorization.enum';
import {FolderFactory} from '../factory/folder.factory';
import {TagFactory} from '../factory/tag.factory';
import {TaskFactory} from '../factory/task.factory';
import {TeamFactory} from '../factory/team.factory';
import {PermissionsType, UserFactory} from '../factory/user.factory';
import {WorkflowFactory} from '../factory/workflow.factory';
import {NewBaseTest} from './base-test';

@TestSuite('Folder Suite')
export class FolderE2eSpec extends NewBaseTest implements OnModuleInit {
    private readonly logger = new Logger(FolderE2eSpec.name);

    @Inject()
    private factory: FolderFactory;
    @Inject()
    private userFactory: UserFactory;
    @Inject()
    private workflowFactory: WorkflowFactory;
    @Inject()
    private taskFactory: TaskFactory;
    @Inject()
    private tagFactory: TagFactory;
    @Inject()
    private teamFactory: TeamFactory;

    onModuleInit(): void {
        this.setUrl('/folder');
    }

    /*
    constructor() {
        super(
            {
                url: '/folder',
                databaseConfig: DatabaseConfig,
                schema: RawDatabaseConfig.schema,
                pasAuthenticationConfig: PasAuthenticationConfig,
                imports: [
                    RedisCacheModule.register(CacheConfig),
                    EventEmitterModule.forRoot(EventEmitterConfig),
                    NotificationApiConnectorModule.register(NotificationApiConnectorConfig),
                    NotificationsSubscriptionModule.register(testNotificationsServiceConfig),
                    S3Module.register(S3Config),
                    AuthorizationModule.register(AuthorizationConfig),
                    UserModule,
                    WorkFlowModule,
                    TreeViewModule,
                    CustomFieldValueModule,
                    TaskModule,
                    FolderModule,
                    NotificationModule.register(true),
                    AutomationsCrudModule.register(AutomationsConfig),
                    DisplacementGroupModule,
                    SpaceModule,
                    TeamModule,
                    CustomFieldCollectionModule,
                    StreamViewModule,
                ],
            },
            'FolderE2eSpec'
        );
    }

    get factory(): FolderFactory {
        if (!this._factory) {
            this._factory = new FolderFactory(this.dataSource);
        }
        return this._factory;
    }

    get taskFactory(): TaskFactory {
        if (!this._taskFactory) {
            this._taskFactory = new TaskFactory();
        }
        return this._taskFactory;
    }

    get userFactory(): UserFactory {
        if (!this._userFactory) {
            this._userFactory = new UserFactory(
                this.dataSource,
                this.getService<AuthorizationImplService>(ABSTRACT_AUTHORIZATION_SERVICE),
                this.app,
                this.getService<FakePasAuthenticationService>('PAS_AUTHENTICATION_SERVICE')
            );
        }
        return this._userFactory;
    }

    get workflowFactory(): WorkflowFactory {
        if (!this._workflowFactory) {
            this._workflowFactory = new WorkflowFactory();
        }
        return this._workflowFactory;
    }

    get tagFactory(): TagFactory {
        if (!this._tagFactory) {
            this._tagFactory = new TagFactory(this.dataSource);
        }
        return this._tagFactory;
    }

    get customFieldDefinitionFactory(): CustomFieldFactory {
        if (!this._customFieldDefinitionFactory) {
            this._customFieldDefinitionFactory = new CustomFieldFactory();
        }
        return this._customFieldDefinitionFactory;
    }

    get policiesGuard(): PoliciesGuard {
        if (!this._policiesGuard) {
            this._policiesGuard = this.getService<PoliciesGuard>(PoliciesGuard);
        }
        return this._policiesGuard;
    }

    get customFieldCollectionFactory(): CustomFieldCollectionFactory {
        if (!this._customFieldCollectionFactory) {
            this._customFieldCollectionFactory = new CustomFieldCollectionFactory();
        }
        return this._customFieldCollectionFactory;
    }

    get teamFactory(): TeamFactory {
        if (!this._teamFactory) {
            this._teamFactory = new TeamFactory();
        }
        return this._teamFactory;
    }
        */

    //<<----------------------------------------------- helper functions for test folders ----------------------------------------------------->>
    /**
     * Creates a workflow for a given folder.
     *
     * @param {string} token - The authentication token.
     *
     * @returns {Promise<WorkFlowEntity>} - The created workflow entity.
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

    //fix the return type
    /**
     * Creates a user with specified permissions.
     *
     * @function createUserWithPermissions
     * @param {PermissionsType} permissions - The permissions to be assigned to the user.
     * @returns {Promise<TestResponse>} - The HTTP response from the API call.
     */
    private async createUserWithPermissions(permissions: PermissionsType): Promise<TestResponse> {
        this.logger.log(`Create user`);
        const fakeUser = await this.userFactory.createUserForLogin(permissions);
        return this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
    }

    /**
     * Creates multiple fake folders.
     *
     * @param {string} accessToken - The access token for authentication.
     * @param {number} spaceId - The ID of the space where the folders will be created.
     * @returns {Promise<FolderEntity[]>} - Promise that resolves with an array of created folders.
     */
    private async createManyFakeFolders(
        accessToken: string,
        spaceId?: number
    ): Promise<{
        createdFolders: FolderEntity[];
        spaceId: number;
    }> {
        this.logger.log('get User id');
        const userId = this.getUserIdFromAccessToken(accessToken);
        const randomNumber = faker.number.int({min: 3, max: 4}),
            createdFolders = [];

        const workflow: WorkFlowEntity = await this.createWorkflowForFolder(accessToken),
            fakeChangeWorkflow: ChangeWorkflowFolderDto = {
                commonWorkflow: workflow.id,
                type: ChangeWorkflowOptions.COMMON_TO_COMMON,
                Mapping: [],
                personaliseWorkflow: null,
            };

        if (!spaceId) {
            const spaceResponse = await this.createSpace(userId, accessToken, [workflow.id]);
            spaceId = spaceResponse.id;
        }

        for (let i = 0; i < randomNumber; i++) {
            const fakeFolder = this.factory.fakeCreateFolder(fakeChangeWorkflow, null, null, [TASK_MANAGEMENT], spaceId);
            const {body: f1, status} = await this.post(``, fakeFolder, accessToken);
            expect(status).toBe(HttpStatus.CREATED);
            expect(f1).toBeDefined();
            createdFolders.push(f1);
        }
        return {createdFolders, spaceId};
    }

    private async createSpace(userId: string, accessToken: string, workflowIds: number[]): Promise<GetFolderDto> {
        this.logger.log('create workflow');
        const fakeCreateSpace = this.factory.fakeCreateSpace({
            availableWorkflows: workflowIds,
        });
        const {body: spaceResponse} = await this.post(`/space`, fakeCreateSpace, accessToken).expect(HttpStatus.CREATED);
        expect(spaceResponse).toBeDefined();
        return spaceResponse;
    }

    // <<---------------------------------------------------- helper functions ends ---------------------------------------------------------->>

    //Todo : Test case for workflow change and custom field's
    /**
     * Creates a folder.
     * @param {number} parentFolderId - The ID of the parent folder (optional).
     * @param {string[]} showOn - An array of platforms where the folder should be shown (default: [TASK_MANAGEMENT]).
     * @returns {Promise<{folder: GetFolderDto; jwtToken: TokenInterface}>} - A promise that resolves to an object containing the created folder and a JWT token.
     */
    @Test('Create Folder')
    async createFolder(
        parentFolderId: number = null,
        showOn: string[] = [TASK_MANAGEMENT],
        spaceId?: number,
        workflowId?: number
    ): Promise<{
        folder: GetFolderDto;
        jwtToken: TokenInterface;
        spaceResponse: GetFolderDto;
        workflow: {id: number};
    }> {
        this.logger.log('create user and login');
        const {body: jwtToken} = await this.createUserWithPermissions({
            folder: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            folderWorkflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            purgeFoldersAndTasks: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            replaceFolderOwner: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            displacementGroup: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            space: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            commonCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            userCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            teams: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            customFieldCollection: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            user: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            workflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        this.logger.log('create workflow');
        if (!workflowId) {
            const workflow: WorkFlowEntity = await this.createWorkflowForFolder(jwtToken.accessToken);
            workflowId = workflow.id;
        }

        const fakeChangeWorkflow: ChangeWorkflowFolderDto = {
            commonWorkflow: workflowId,
            type: ChangeWorkflowOptions.COMMON_TO_COMMON,
            Mapping: [],
            personaliseWorkflow: null,
        };
        this.logger.log('create folder');
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        if (!spaceId) {
            const spaceResponse = await this.createSpace(userId, jwtToken.accessToken, [workflowId]);
            spaceId = spaceResponse.id;
        }

        const fakeFolder = this.factory.fakeCreateFolder(fakeChangeWorkflow, parentFolderId, DefaultViewOptions.BOARD, showOn, spaceId);

        const {body: f1} = await this.post(``, fakeFolder, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(f1).toBeDefined();
        //todo : validate and match response and dto
        const {body: f1DB} = await this.get(`${f1.id}?shown-on=${TASK_MANAGEMENT}`, jwtToken.accessToken).expect(HttpStatus.OK);
        expect(f1DB.id).toEqual(f1.id);
        expect(f1DB.showOn.includes(TASK_MANAGEMENT)).toEqual(true);
        return {folder: f1, jwtToken, spaceResponse: {id: spaceId}, workflow: {id: workflowId}};
    }

    //Todo : Test case for workflow change and custom field's
    /**
     * Creates a folder.
     * @param {number} parentFolderId - The ID of the parent folder (optional).
     * @param {string[]} showOn - An array of platforms where the folder should be shown (default: [TASK_MANAGEMENT]).
     * @returns {Promise<{folder: GetFolderDto; jwtToken: TokenInterface}>} - A promise that resolves to an object containing the created folder and a JWT token.
     */
    @Test('Create Folder with workflow not on space should fail')
    async createFolderWithWorkflowsNotOnSpaceShouldFail(
        parentFolderId: number = null,
        showOn: string[] = [TASK_MANAGEMENT]
    ): Promise<{folder: GetFolderDto; jwtToken: TokenInterface; spaceResponse: GetFolderDto}> {
        this.logger.log('create user and login');
        const {body: jwtToken} = await this.createUserWithPermissions({
            folder: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            folderWorkflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            purgeFoldersAndTasks: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            replaceFolderOwner: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            displacementGroup: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            space: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            commonCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            userCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            teams: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            customFieldCollection: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            user: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            workflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        this.logger.log('create workflow');
        const workflow: WorkFlowEntity = await this.createWorkflowForFolder(jwtToken.accessToken),
            fakeChangeWorkflow: ChangeWorkflowFolderDto = {
                commonWorkflow: workflow.id,
                type: ChangeWorkflowOptions.COMMON_TO_COMMON,
                Mapping: [],
                personaliseWorkflow: null,
            };
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        const spaceResponse = await this.createSpace(userId, jwtToken.accessToken, [workflow.id]);

        this.logger.log('create folder');
        const fakeFolder = this.factory.fakeCreateFolder(
            fakeChangeWorkflow,
            parentFolderId,
            DefaultViewOptions.BOARD,
            showOn,
            spaceResponse.id
        );
        const {body: f1} = await this.post(``, fakeFolder, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(f1).toBeDefined();
        //todo : validate and match response and dto
        const {body: f1DB} = await this.get(`${f1.id}?shown-on=${TASK_MANAGEMENT}`, jwtToken.accessToken).expect(HttpStatus.OK);
        expect(f1DB.id).toEqual(f1.id);
        expect(f1DB.showOn.includes(TASK_MANAGEMENT)).toEqual(true);
        return {folder: f1, jwtToken, spaceResponse};
    }

    /**
     * Creates a folder should fail.
     * @param {number} parentFolderId - The ID of the parent folder (optional).
     * @param {string[]} showOn - An array of platforms where the folder should be shown (default: [TASK_MANAGEMENT]).
     * @returns {Promise<{folder: GetFolderDto; jwtToken: TokenInterface}>} - A promise that resolves to an object containing the created folder and a JWT token.
     */
    @Test('Create Folder without parent folder id should fail')
    async createFolderWithoutParentFolderIdShouldFail(parentFolderId: number = null, showOn: string[] = [TASK_MANAGEMENT]): Promise<void> {
        this.logger.log('create user and login');
        const {body: jwtToken} = await this.createUserWithPermissions({
            folder: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            folderWorkflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            purgeFoldersAndTasks: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            replaceFolderOwner: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            displacementGroup: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            space: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            commonCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            userCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            teams: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            customFieldCollection: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            user: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            workflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        this.logger.log('create workflow');
        const workflow: WorkFlowEntity = await this.createWorkflowForFolder(jwtToken.accessToken),
            fakeChangeWorkflow: ChangeWorkflowFolderDto = {
                commonWorkflow: workflow.id,
                type: ChangeWorkflowOptions.COMMON_TO_COMMON,
                Mapping: [],
                personaliseWorkflow: null,
            };
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        const spaceResponse = await this.createSpace(userId, jwtToken.accessToken, [workflow.id]);

        this.logger.log('create folder should fail');
        const fakeFolder = this.factory.fakeCreateFolder(
            fakeChangeWorkflow,
            parentFolderId,
            DefaultViewOptions.BOARD,
            showOn,
            spaceResponse.id
        );
        delete fakeFolder.parentFolderId;

        await this.post(``, fakeFolder, jwtToken.accessToken).expect(HttpStatus.BAD_REQUEST);
    }

    /**
     * Creates a folder that intentionally fails.
     *
     * This method performs the following steps:
     * 1. Creates a user with specific permissions.
     * 2. Creates a workflow for the folder.
     * 3. Creates a fake change workflow DTO.
     * 4. Logs the addition of a fake parent folder ID that will cause the method to fail.
     * 5. Attempts to create the folder using the API.
     * 6. If an error occurs, logs the exception message.
     *
     * @return {Promise<void>} A Promise that resolves when the method completes.
     */
    @Test('Create Folder To Fail')
    async createFolderToFail(): Promise<void> {
        try {
            const {body: jwtToken} = await this.createUserWithPermissions({
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
            this.logger.log('get User id');
            const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
            const worklfowDB = await this.createWorkflowForFolder(jwtToken.accessToken);
            const spaceResponse = await this.createSpace(userId, jwtToken.accessToken, [worklfowDB.id]);
            const fakeChangeWorkflow: ChangeWorkflowFolderDto = {
                commonWorkflow: worklfowDB.id,
                type: ChangeWorkflowOptions.COMMON_TO_COMMON,
                Mapping: [],
                personaliseWorkflow: null,
            };
            this.logger.log('Add fake parent folder Id and it should failed');
            const fakeFolder = this.factory.fakeCreateFolder(fakeChangeWorkflow, null, null, [TASK_MANAGEMENT], spaceResponse.id);
            fakeFolder.parentFolderId = -10000000;
            await this.post(``, fakeFolder, jwtToken.accessToken);
        } catch (error: unknown) {
            const text: string = JSON.stringify(error['response']);
            this.logger.log(`Exception Message: ${text}`);
        }
    }

    // ** Favourite Folders /
    /**
     * Marks a folder as favourite.
     *
     * @returns {Promise<void>} A Promise that resolves when the folder is marked as favourite.
     */
    @Test('Mark Favourite')
    async markFolderFavourite(): Promise<void> {
        this.logger.log('Create a folder');
        const {folder: f1, jwtToken} = await this.createFolder();
        this.logger.log('Mark it Favourite');
        const {body: favouriteFolder} = await this.post(`favourite/${f1.id}`, {}, jwtToken.accessToken);
        expect(favouriteFolder.identifiers.length).toBeGreaterThan(0);

        const {body: favFoldersDB} = await this.get(`favourite?shown-on=${TASK_MANAGEMENT}`, jwtToken.accessToken);
        expect(favFoldersDB.some((f) => f.id === f1.id)).toBe(true);
    }

    /**
     * Updates a folder.
     *
     * @returns {Promise<void>} - A promise that resolves when the folder is updated successfully.
     */
    @Test('Update Folder')
    async updateFolder(): Promise<void> {
        const fakeUpdateFolder = this.factory.fakeUpdateFolder();
        this.logger.log('Create a folder');
        const {folder, jwtToken} = await this.createFolder();
        this.logger.log('Update folder');
        const {body: resp} = await this.patch(`${folder.id}`, fakeUpdateFolder, jwtToken.accessToken);
        expect(resp.affected).toEqual(1);

        const {body: f2} = await this.get(`${folder.id}?shown-on=${TASK_MANAGEMENT}`, jwtToken.accessToken).expect(HttpStatus.OK);
        delete fakeUpdateFolder.endDate;
        delete fakeUpdateFolder.startDate;
        expect({
            description: f2.description,
            color: f2.color,
            defaultView: f2.defaultView,
            title: f2.title,
            viewType: f2.viewType,
            folderType: f2.folderType,
        }).toMatchObject(fakeUpdateFolder);
    }

    /**
     * Update Folder with Wrong Data should fail.
     *
     * @returns {Promise<void>} A promise that resolves when the operation is completed.
     */
    @Test('Update Folder with Wrong Data')
    async updateFolderWithWrongDataShouldFail(): Promise<void> {
        try {
            const fakeUpdateFolderDto = this.factory.fakeUpdateFolder();
            const {body: jwtToken} = await this.createUserWithPermissions({
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
            this.logger.log('get User id');
            const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
            await this.createSpace(userId, jwtToken.accessToken, [-1]);
            fakeUpdateFolderDto['parentFolderId'] = -10000000;
            await this.patch(`${-1}`, fakeUpdateFolderDto, jwtToken.accessToken);
        } catch (error: unknown) {
            const text: string = JSON.stringify(error['response']);
            this.logger.log(`Exception Message: ${text}`);
        }
    }

    /**
     * Deletes a folder and verifies that it no longer exists.
     *
     * @returns {Promise<void>} Promise that resolves when the folder has been deleted.
     */
    @Test('Delete Folder')
    async deleteFolder(): Promise<void> {
        const {folder, jwtToken} = await this.createFolder();
        await this.post(`archive/${folder.id}`, {archiveReason: 'Archive Folder'}, jwtToken.accessToken);

        this.logger.log('Check folder exists (it should not exists)');
        await this.get(`${folder.id}?shown-on=${TASK_MANAGEMENT}`, jwtToken.accessToken).expect(HttpStatus.NOT_FOUND);
    }

    /**
     * Get all Folders.
     *
     * @returns {Promise<void>} A Promise that resolves when the operation is complete.
     */
    @Test('Get all Folders')
    async getAllFolders(): Promise<void> {
        const {body: jwtToken} = await this.createUserWithPermissions({
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
        this.logger.log('get User id');
        const {createdFolders} = await this.createManyFakeFolders(jwtToken.accessToken);
        this.logger.log('Get Many folder should get all folders where archived = false');
        const {body: foldersDB} = await this.get('', jwtToken.accessToken);
        expect(foldersDB.length).toBeGreaterThan(0);
        expect(foldersDB.map((f) => f.id)).toEqual(expect.arrayContaining(createdFolders.map((f) => f.id)));
    }

    /**
     * Archives a folder tree recursively.
     *
     * @returns {Promise<void>} A promise that resolves when the folder tree is archived successfully.
     */
    @Test('Archive all Folder Tree')
    async archiveFolderTree(): Promise<void> {
        const {folder, jwtToken, spaceResponse, workflow} = await this.createFolder();
        const fakeChangeWorkflow: ChangeWorkflowFolderDto = {
                commonWorkflow: workflow.id,
                type: ChangeWorkflowOptions.COMMON_TO_COMMON,
                Mapping: [],
                personaliseWorkflow: null,
            },
            fakeFolder = this.factory.fakeCreateFolder(
                fakeChangeWorkflow,
                folder.id,
                DefaultViewOptions.BOARD,
                [TASK_MANAGEMENT],
                spaceResponse.id
            );
        this.logger.log('Create Folder', fakeFolder);
        const {body: children} = await this.post(``, fakeFolder, jwtToken.accessToken).expect(HttpStatus.CREATED);

        //This should archive complete folder tree recursively
        const {body: resp} = await this.post(`archive/${folder.id}`, {archiveReason: 'Archive All'}, jwtToken.accessToken);

        expect(resp).toBeDefined();

        const {body: foldersDB} = await this.get('archived', jwtToken.accessToken);

        expect(foldersDB.some((f) => f.id === folder.id)).toBe(true);
        expect(foldersDB.some((f) => f.id === children.id)).toBe(true);
    }

    /**
     * Deletes the entire folder tree.
     *
     * @return {Promise<void>} Returns a Promise when the folder tree is successfully deleted.
     *
     * @test {deleteFolderTree}
     *    Delete all Folder Tree
     *    Ensures that all folders and their children are deleted correctly.
     */
    @Test('Delete all Folder Tree')
    async deleteFolderTree(): Promise<void> {
        const {folder, jwtToken, workflow, spaceResponse} = await this.createFolder();
        const fakeChangeWorkflow: ChangeWorkflowFolderDto = {
            commonWorkflow: workflow.id,
            type: ChangeWorkflowOptions.COMMON_TO_COMMON,
            Mapping: [],
            personaliseWorkflow: null,
        };

        const fakeFolder = this.factory.fakeCreateFolder(fakeChangeWorkflow, folder.id, null, [TASK_MANAGEMENT], spaceResponse.id);

        const {body: children} = await this.post(``, fakeFolder, jwtToken.accessToken).expect(HttpStatus.CREATED);

        const {body: resp} = await this.delete(`delete/${folder.id}`, jwtToken.accessToken);

        expect(resp).toBeDefined();

        const {body: f1DB} = await this.post(
            `deleted-folder-task?shown-on=${TASK_MANAGEMENT}`,
            {limit: 100, offset: 0},
            jwtToken.accessToken
        ).expect(HttpStatus.CREATED);

        expect(f1DB.data.some((f) => f.id === folder.id)).toBe(true);

        const parentFolder = f1DB.data.find((el) => el.id === folder.id);
        expect(parentFolder.children.some((f) => f.id === children.id)).toBe(true);
    }

    /**
     * Archive Children Not Parent Folder Tree
     *
     * This method is used to archive the children folders of a given parent folder, without archiving the parent folder itself.
     *
     * @returns {Promise<void>} - A promise that resolves when the children folders are archived.
     */
    @Test('Archive Children Not Parent Folder')
    async archiveChildrenNotParentFolderTree(): Promise<void> {
        const {folder, jwtToken: token, spaceResponse, workflow} = await this.createFolder();
        const {folder: childrenFolder, jwtToken} = await this.createFolder(folder.id, [TASK_MANAGEMENT], spaceResponse.id, workflow.id);
        //Creating another children
        await this.createFolder(childrenFolder.id, [TASK_MANAGEMENT], spaceResponse.id, workflow.id);
        const response = await this.post(`archive/${childrenFolder.id}`, {archiveReason: 'Parent Archive Check'}, jwtToken.accessToken);
        expect(response).toBeDefined();
        // Parent should not be archived
        const {body: parentFolder} = await this.get(`${folder.id}?shown-on=${TASK_MANAGEMENT}`, token.accessToken).expect(HttpStatus.OK);
        expect(parentFolder.archivedAt).toBe(null);
    }

    /**
     * Archives all Folder Tree with wrong id.
     *
     * @returns {Promise<void>} - A Promise that resolves when the method is finished.
     */
    @Test('Archive all Folder Tree with wrong id')
    async archiveFolderTreeWithWrongId(): Promise<void> {
        try {
            const {body: jwtToken} = await this.createUserWithPermissions({
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
            this.logger.log('get User id');
            const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
            const worklfowDB = await this.createWorkflowForFolder(jwtToken.accessToken);
            await this.createSpace(userId, jwtToken.accessToken, [worklfowDB.id]);
            await this.delete(`${-1}`, jwtToken.accessToken);
        } catch (error: unknown) {
            const text: string = JSON.stringify(error['response']);
            this.logger.log(`Exception Message: ${text}`);
        }
    }

    // ** Get all Archived folders */
    /**
     * Retrieves all archived folders from the server.
     *
     * @returns {Promise<void>} - Resolves when the operation is complete.
     */
    @Test('Get all Archived Folders')
    async getAllArchivedFolders(): Promise<void> {
        const {body: jwtToken} = await this.createUserWithPermissions({
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
        this.logger.log('get User id');
        const {createdFolders} = await this.createManyFakeFolders(jwtToken.accessToken);
        for (const folder of createdFolders) {
            await this.post(`archive/${folder.id}`, {archiveReason: 'This needs to be archive'}, jwtToken.accessToken);
        }

        this.logger.log('Get Many folder should get all folders where archived = true');
        const {body: foldersDB} = await this.get(`archived`, jwtToken.accessToken).expect(HttpStatus.OK);

        //check if array have rows
        expect(foldersDB.length).toBeGreaterThan(0);
        for (const folder of foldersDB) {
            expect(folder.archivedAt).not.toBeNull();
        }

        this.logger.log('Folderdb and CreatedFolders should match');
        expect(foldersDB.map((f) => f.id)).toEqual(expect.arrayContaining(createdFolders.map((f) => f.id)));
    }

    /**
     * Restores archived folders.
     *
     * @returns {Promise<void>} A promise that resolves when the restoration is complete.
     */
    @Test('Restore Archived Folders')
    async restoreArchivedFolders(): Promise<void> {
        const {folder: f1, jwtToken} = await this.createFolder();

        //This should archive complete folder tree recursively
        await this.post(`archive/${f1.id}`, {archiveReason: 'This needs to be archived'}, jwtToken.accessToken);
        await this.post(`archived/restore/${f1.id}`, {}, jwtToken.accessToken).expect(HttpStatus.CREATED);

        this.logger.log('folders have archived = false');
        const {body: foldersDB} = await this.get('', jwtToken.accessToken);
        expect(foldersDB.some((f) => f.id === f1.id)).toBe(true);
    }

    /**
     * Restores deleted folders.
     *
     * @returns {Promise<void>} - A promise that resolves when the deleted folders are successfully restored.
     */
    @Test('Restore Deleted Folders')
    async restoreDeletedFolders(): Promise<void> {
        const {folder: f1, jwtToken} = await this.createFolder();

        //This should archive complete folder tree recursively
        await this.delete(`delete/${f1.id}`, jwtToken.accessToken);
        await this.post(`deleted/restore/${f1.id}`, {}, jwtToken.accessToken).expect(HttpStatus.CREATED);

        this.logger.log('folders have deleted = false');
        const {body: foldersDB} = await this.get('', jwtToken.accessToken);
        expect(foldersDB.some((f) => f.id === f1.id)).toBe(true);
    }

    /**
     * Unmarks a folder as favourite.
     *
     * @returns {Promise<void>} - Promise that resolves once the folder is successfully unmarked as favourite.
     */
    @Test('UnMark Favourite')
    async unmarkFolderFavourite(): Promise<void> {
        const {folder: f1, jwtToken} = await this.createFolder();
        const {body: favouriteFolder} = await this.post(`favourite/${f1.id}`, {}, jwtToken.accessToken);
        expect(favouriteFolder.identifiers.length).toBeGreaterThan(0);

        const {body: favFoldersDB} = await this.get(`favourite`, jwtToken.accessToken);
        expect(favFoldersDB.some((f) => f.id === f1.id)).toBe(true);

        const {body: response} = await this.delete(`favourite/${f1.id}`, jwtToken.accessToken);
        expect(response.affected).toEqual(1);

        const {body: favFolders} = await this.get(`favourite`, jwtToken.accessToken).expect(HttpStatus.OK);

        expect(favFolders.some((f) => f.id === f1.id)).toBe(false);
    }

    /**
     * UnMark Favourite with wrong folder id.
     *
     * @returns {Promise<void>} - A promise that resolves when the operation is complete.
     */
    @Test('UnMark Favourite with wrong folder id')
    async unmarkFolderFavouriteWrongId(): Promise<void> {
        try {
            this.logger.log('Create Folder -> Mark Folder Favourite -> throws error');
            const {folder: f1, jwtToken} = await this.createFolder();
            await this.post(`favourite/${f1.id}`, {}, jwtToken.accessToken);
            await this.delete(`favourite/${-1}`, jwtToken.accessToken);
        } catch (error) {
            const text: string = JSON.stringify(error);
            this.logger.log(`Exception Message: ${text}`);
        }
    }

    /**
     * Sets views for a folder.
     *
     * @returns {Promise<void>} A promise that resolves when the views are set.
     */
    @Test('Set Views')
    async setViews(): Promise<void> {
        const availableType = randomEnum(DefaultViewOptions);
        const {folder, jwtToken} = await this.createFolder();

        const {body: response} = await this.post(
            `views/${folder.id}`,
            [
                {
                    name: availableType,
                    index: 1,
                },
            ],
            jwtToken.accessToken
        ).expect(HttpStatus.CREATED);
        expect(response.affected).toEqual(1);
    }

    /**
     * Drags views in a folder.
     *
     * @returns {Promise<void>} Returns a promise that resolves when the views are dragged successfully.
     */
    @Test('Drag Views')
    async dragViews(): Promise<void> {
        const availableTypeOne = randomEnum(DefaultViewOptions);
        const availableTypeTwo = randomEnum(DefaultViewOptions);
        const {folder, jwtToken} = await this.createFolder();

        const {body: response} = await this.post(
            `views/${folder.id}`,
            [
                {name: availableTypeOne, index: 1},
                {name: availableTypeTwo, index: 2},
            ],
            jwtToken.accessToken
        ).expect(HttpStatus.CREATED);
        expect(response.affected).toEqual(1);

        const {body: responseDrag} = await this.post(
            `views/${folder.id}`,
            [
                {name: availableTypeOne, index: 2},
                {name: availableTypeTwo, index: 1},
            ],
            jwtToken.accessToken
        ).expect(HttpStatus.CREATED);
        expect(responseDrag.affected).toEqual(1);
    }

    /**
     * Retrieves the folder tree for task management.
     *
     * @returns {Promise<void>} - A Promise that resolves to void.
     */
    @Test('create folder tree and validate it')
    async getFolderTree(): Promise<void> {
        this.logger.log('create user and login #1 and #2');
        const createdFolders = [];
        const createdFoldersIds = [];
        const jwtTokens = [];
        const spaceResponse = [];
        const treeIds = [];
        const usersIds = [];
        for (let i = 0; i < 2; i++) {
            const response = await this.createUserWithPermissions({
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
            jwtTokens.push(response.body);
            const user = this.getUserIdFromAccessToken(jwtTokens[i].accessToken);
            usersIds.push(user);

            const workflow: WorkFlowEntity = await this.createWorkflowForFolder(jwtTokens[i].accessToken);
            const fakeChangeWorkflowsDto = {
                commonWorkflow: workflow.id,
                type: ChangeWorkflowOptions.COMMON_TO_COMMON,
                Mapping: [],
                personaliseWorkflow: null,
            };
            expect(workflow).toBeDefined();

            if (i === 0) {
                const space = await this.createSpace(usersIds[0], jwtTokens[0].accessToken, [workflow.id]);
                spaceResponse.push(space);
            }
            if (i !== 0) {
                const updateMembersDto = {
                    insert: [{id: usersIds[1], userPermission: UserPermissionOptions.FULL}],
                    update: [],
                    delete: [],
                };
                await this.patch(`/space/${spaceResponse[0].id}/members`, updateMembersDto, jwtTokens[0].accessToken).expect(HttpStatus.OK);
                await this.patch(`/space/${spaceResponse[0].id}`, {workflows: {insert: [workflow.id]}}, jwtTokens[0].accessToken).expect(
                    HttpStatus.OK
                );
            }
            this.logger.log('create folders');
            const folderData = [
                {jwtToken: jwtTokens[i], fakeChangeWorkflowsDto: fakeChangeWorkflowsDto},
                {jwtToken: jwtTokens[i], fakeChangeWorkflowsDto: fakeChangeWorkflowsDto},
            ];

            for (const data of folderData) {
                const fakeFolder = this.factory.fakeCreateFolder(
                    data.fakeChangeWorkflowsDto,
                    null,
                    null,
                    [TASK_MANAGEMENT],
                    spaceResponse[0].id
                );
                const {body: folder} = await this.post(``, fakeFolder, data.jwtToken.accessToken).expect(HttpStatus.CREATED);
                expect(folder).toBeDefined();
                createdFolders.push(folder);
            }

            const responseTree = await this.get(`folder-tree?shown-on=${TASK_MANAGEMENT}`, jwtTokens[i].accessToken).expect(HttpStatus.OK);
            const folderTree = responseTree.body;

            const countFolders = createdFolders.filter(({userId}) => userId === usersIds[i]).map(({id}) => id);

            createdFoldersIds.push(...countFolders);

            //if tree is an folder
            if (folderTree.length > 1) {
                const treeFoldersIds = folderTree.map((e) => {
                    return e.id;
                });
                treeIds.push(...treeFoldersIds);
            }
            //if tree is an space
            if (folderTree.length === 1) {
                const childrenFoldersIds = folderTree[0].children.map((c) => {
                    return c.id;
                });
                treeIds.push(...childrenFoldersIds);
            }
        }
        treeIds.sort();
        createdFoldersIds.sort();
        expect(treeIds).toEqual(createdFoldersIds);
    }

    /**
     * ChangeFolderDates method is used to create a folder, update its dates, and check the updated values.
     *
     * @returns {Promise<void>} - A Promise that resolves when the operation is finished.
     */
    @Test('Change Folder Dates')
    async ChangeFolderDates(): Promise<void> {
        this.logger.log('Create a folder');
        const {folder, jwtToken} = await this.createFolder();
        this.logger.log('update the folder');
        const updateDto = {startDate: new Date(), endDate: faker.date.future()};
        const {body: resp} = await this.patch(`${folder.id}`, updateDto, jwtToken.accessToken);
        expect(resp.affected).toEqual(1);

        //write and wrong values of showOn
        const {body: f2} = await this.get(`${folder.id}?shown-on=${TASK_MANAGEMENT}`, jwtToken.accessToken).expect(HttpStatus.OK);
        expect({
            startDate: new Date(f2.startDate),
            endDate: new Date(f2.endDate),
        }).toMatchObject(updateDto);
    }

    //** Change folder Owner */
    /**
     * Change Folder Owner
     *
     * This method is used to change the owner of a folder. It creates a new user with the necessary permissions,
     * creates a new folder, and updates the owner of the folder to the newly created user.
     *
     * @returns {Promise<void>} - A Promise that resolves when the owner of the folder is successfully changed, or rejects with an error.
     */
    @Test('Change Folder Owner')
    async ChangeFolderOwner(): Promise<void> {
        this.logger.log('Create a new user with permission');
        const {body: fakeOwner} = await this.createUserWithPermissions({
            workflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            folder: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            displacementGroup: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        const userId = this.getUserIdFromAccessToken(fakeOwner.accessToken);

        this.logger.log('Create a folder');
        const {folder, jwtToken} = await this.createFolder();
        this.logger.log('Update folder Owner');
        await this.patch(`owner/${folder.id}/${userId}`, {permissions: UserPermissionOptions.FULL}, jwtToken.accessToken).expect(
            HttpStatus.OK
        );

        const oldOwnerId = this.getUserIdFromAccessToken(jwtToken.accessToken);

        this.logger.log('check if owner is changed');
        const {body: f1} = await this.get(`${folder.id}`, fakeOwner.accessToken).expect(HttpStatus.OK);
        expect(f1.ownerId).toBe(userId);

        this.logger.log('Check if previous owner still has owner access');
        expect(f1.ownerId).not.toEqual(oldOwnerId);
    }

    /**
     * Filters the folder tree by the 'shown-on' parameter.
     *
     * @returns {Promise<void>}
     * @throws {Error} If the folder is not found with the specified 'shown-on' value.
     */
    @Test('show on folders')
    async folderTreeFilterByShowOn(): Promise<void> {
        this.logger.log('create user');
        const {body: jwtToken1} = await this.createUserWithPermissions({
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
        this.logger.log('get User id');
        const workflow1: WorkFlowEntity = await this.createWorkflowForFolder(jwtToken1.accessToken),
            fakeChangeWorkflow1: ChangeWorkflowFolderDto = {
                commonWorkflow: workflow1.id,
                type: ChangeWorkflowOptions.COMMON_TO_COMMON,
                Mapping: [],
                personaliseWorkflow: null,
            },
            workflow2: WorkFlowEntity = await this.createWorkflowForFolder(jwtToken1.accessToken),
            fakeChangeWorkflow2: ChangeWorkflowFolderDto = {
                commonWorkflow: workflow2.id,
                type: ChangeWorkflowOptions.COMMON_TO_COMMON,
                Mapping: [],
                personaliseWorkflow: null,
            };
        const userId = this.getUserIdFromAccessToken(jwtToken1.accessToken);
        const spaceResponse = await this.createSpace(userId, jwtToken1.accessToken, [workflow1.id, workflow2.id]);

        this.logger.log('create workflow #1 and #2');

        expect(workflow1).toBeDefined();
        expect(workflow2).toBeDefined();

        this.logger.log('create folder #1 , #2 and #3');
        const fakeFolder1 = this.factory.fakeCreateFolder(
                fakeChangeWorkflow1,
                null,
                DefaultViewOptions.BOARD,
                [TASK_MANAGEMENT],
                spaceResponse.id
            ),
            {body: f1} = await this.post(``, fakeFolder1, jwtToken1.accessToken).expect(HttpStatus.CREATED),
            fakeFolder11 = this.factory.fakeCreateFolder(
                fakeChangeWorkflow1,
                null,
                DefaultViewOptions.BOARD,
                [FINANCIAL_OUTLOOK],
                spaceResponse.id
            ),
            {body: f11} = await this.post(``, fakeFolder11, jwtToken1.accessToken).expect(HttpStatus.CREATED),
            fakeFolder2 = this.factory.fakeCreateFolder(
                fakeChangeWorkflow2,
                null,
                DefaultViewOptions.BOARD,
                [TASK_MANAGEMENT, FINANCIAL_OUTLOOK],
                spaceResponse.id
            ),
            {body: f2} = await this.post(``, fakeFolder2, jwtToken1.accessToken).expect(HttpStatus.CREATED);

        expect(f1).toBeDefined();
        expect(f2).toBeDefined();
        expect(f11).toBeDefined();

        this.logger.log('Get folder where showOn = task-management');
        //todo : validate and match response and dto
        const {body: f1DB} = await this.get(`${f1.id}?shown-on=${TASK_MANAGEMENT}`, jwtToken1.accessToken).expect(HttpStatus.OK);
        expect(f1DB.id).toEqual(f1.id);

        this.logger.log('Get folder where showOn = task-management,financials-outlook');
        const {body: f2DB} = await this.get(`${f2.id}?shown-on=${TASK_MANAGEMENT}`, jwtToken1.accessToken).expect(HttpStatus.OK);
        expect(f2DB.id).toEqual(f2.id);

        this.logger.log('Get folder where showOn = financials-outlook');
        const {body: f11DB} = await this.get(`${f11.id}?shown-on=${FINANCIAL_OUTLOOK}`, jwtToken1.accessToken).expect(HttpStatus.OK);
        expect(f11DB.id).toEqual(f11.id);

        this.logger.log(`fetch f1 with show on = financials should not found error`);
        await this.get(`${f1.id}?shown-on=${FINANCIAL_OUTLOOK}`, jwtToken1.accessToken).expect(HttpStatus.NOT_FOUND);

        this.logger.log(`fetch tree we should receive f1,f2`);
        const {body: tree} = await this.get(`folder-tree?shown-on=${TASK_MANAGEMENT}`, jwtToken1.accessToken).expect(HttpStatus.OK);
        expect(tree.length).toEqual(1);
        expect(tree[0].children.length).toEqual(2);
        const f1Found = tree[0].children.find((f) => f.id === f1.id);
        expect(f1Found).toBeDefined();
        const f2Found = tree[0].children.find((f) => f.id === f2.id);
        expect(f2Found).toBeDefined();

        this.logger.log(`fetch tree we should receive f11,f2`);
        const {body: treefo} = await this.get(`folder-tree?shown-on=${FINANCIAL_OUTLOOK}`, jwtToken1.accessToken).expect(HttpStatus.OK);
        expect(treefo.length).toEqual(2);
        const f11Found = treefo.find((f) => f.id === f11.id);
        expect(f11Found).toBeDefined();
        const f22Found = treefo.find((f) => f.id === f2.id);
        expect(f22Found).toBeDefined();
    }

    /**
     * Retrieves a list of workflows and tasks linked with a project for the board view
     *
     * @return {Promise<void>} - Resolves once the list of workflows and tasks has been retrieved
     */
    @Test('list of workflows and tasks linked with a project for the board view')
    async getProjectsFlowsAndTasksList(): Promise<void> {
        this.logger.log('create folder');
        const {folder, jwtToken} = await this.createFolder();
        this.logger.log('get user id');
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        const fakeTask1 = this.taskFactory.fakeCreateTask(userId, folder.id);
        const fakeTask2 = this.taskFactory.fakeCreateTask(userId, folder.id);
        this.logger.log('create task');
        const {body: task1} = await this.post(`/task`, fakeTask1, jwtToken.accessToken).expect(HttpStatus.CREATED);
        const {body: task2} = await this.post(`/task`, fakeTask2, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(task1).toBeDefined();
        expect(task2).toBeDefined();
        this.logger.log('get project board view');
        const {body: response} = await this.post(`/folder-workflow/project/${folder.id}/board`, {}, jwtToken.accessToken).expect(
            HttpStatus.CREATED
        );
        expect(response[0].id).toBeDefined();
        expect(response[0].title).toBeDefined();
        expect(response[0].color).toBeDefined();
        expect(response[0].folderId).toBeDefined();
        expect(response[0].workflowIds).toBeDefined();
        expect(response[0].columns).toBeDefined();
        expect(response[0].columns[0].id).toBeDefined();
        expect(response[0].columns[0].title).toBeDefined();
        expect(response[0].columns[0].color).toBeDefined();
        expect(response[0].columns[0].code).toBeDefined();
        expect(response[0].columns[0].stateIds).toBeDefined();
        expect(response[0].columns[0].totalCount).toBeDefined();
        expect(response[0].columns[0].tasks[0].id).toBeDefined();
        expect(response[0].columns[0].tasks[0].title).toBeDefined();
        expect(response[0].columns[0].tasks[0].ownerId).toBeDefined();
        expect(response[0].columns[0].tasks[0].childrenCount).toBeDefined();
        expect(response[0].columns[0].tasks[0].states).toBeDefined();
    }

    /**
     * Binds two folders together.
     *
     * @returns {Promise<void>} A Promise that resolves when the binding is successful.
     */
    @Test('bind folders')
    async bindFolders(): Promise<void> {
        this.logger.log('generate user token');
        const {body: jwtToken} = await this.createUserWithPermissions({
            folder: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            folderWorkflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            purgeFoldersAndTasks: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            replaceFolderOwner: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            displacementGroup: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            space: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            commonCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            userCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            teams: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            customFieldCollection: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            user: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            workflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });

        this.logger.log('generate multiple folders');
        const {createdFolders} = await this.createManyFakeFolders(jwtToken.accessToken);
        this.logger.log('bind folders');
        await this.post(
            `bind/${createdFolders[0].id}`,
            {
                insert: [createdFolders[1].id],
                delete: [],
            },
            jwtToken.accessToken
        );

        this.logger.log('Get folder Tree');
        const {body: folderTree} = await this.get(`folder-tree?shown-on=${TASK_MANAGEMENT}`, jwtToken.accessToken);

        const parentFolder = folderTree[0].children.find((el) => el.id === createdFolders[1].id);

        const childFolder = parentFolder.children.find((el) => el.id === createdFolders[0].id);

        expect(parentFolder).toBeDefined();
        expect(childFolder).toBeDefined();
    }

    /**
     * Should fail when binding two folders together which will create a loop.
     *
     * @returns {Promise<void>} A Promise that resolves when the binding is successful.
     */
    @Test('should fail when binding folders which create loop')
    async failBindFolders(): Promise<void> {
        this.logger.log('generate user token');
        const {body: jwtToken} = await this.createUserWithPermissions({
            folder: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            folderWorkflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            purgeFoldersAndTasks: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            replaceFolderOwner: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            displacementGroup: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            space: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            commonCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            userCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            teams: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            customFieldCollection: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            user: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            workflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });

        this.logger.log('generate multiple folders');
        const {createdFolders} = await this.createManyFakeFolders(jwtToken.accessToken);
        this.logger.log('bind folder 1 to 2');
        await this.post(
            `bind/${createdFolders[0].id}`,
            {
                insert: [createdFolders[1].id],
                delete: [],
            },
            jwtToken.accessToken
        );

        this.logger.log('bind folder 2 to 3');
        await this.post(
            `bind/${createdFolders[1].id}`,
            {
                insert: [createdFolders[2].id],
                delete: [],
            },
            jwtToken.accessToken
        );

        this.logger.log('bind folder 3 to 1 should fail as loop existed');
        await this.post(
            `bind/${createdFolders[2].id}`,
            {
                insert: [createdFolders[0].id],
                delete: [],
            },
            jwtToken.accessToken
        ).expect(HttpStatus.BAD_REQUEST);
    }

    /**
     * Unbinds two folders.
     *
     * This method performs the following steps:
     * 1. Generates a user token.
     * 2. Generates multiple folders.
     * 3. Binds the two folders.
     * 4. Verifies the successful binding.
     * 5. Unbinds the folders.
     * 6. Verifies the successful unbinding.
     * 7. Retrieves the folder tree.
     * 8. Verifies the correct folder structure in the tree.
     *
     * @returns {Promise<void>} - A promise that resolves when the method completes.
     */
    @Test('unbind folders')
    async unbindFolders(): Promise<void> {
        this.logger.log('generate user token');
        const {body: jwtToken} = await this.createUserWithPermissions({
            folder: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            folderWorkflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            purgeFoldersAndTasks: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            replaceFolderOwner: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            displacementGroup: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            space: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            commonCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            userCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            teams: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            customFieldCollection: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            user: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            workflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        this.logger.log('get User id');
        this.logger.log('generate multiple folders');
        this.logger.log('generate multiple folders');
        const {createdFolders} = await this.createManyFakeFolders(jwtToken.accessToken);
        this.logger.log('bind folders');
        await this.post(
            `bind/${createdFolders[0].id}`,
            {
                insert: [createdFolders[1].id],
                delete: [],
            },
            jwtToken.accessToken
        );
        const {body: folderTree1} = await this.get(`folder-tree?shown-on=${TASK_MANAGEMENT}`, jwtToken.accessToken);

        const parentFolder1 = folderTree1[0].children.find((el) => el.id === createdFolders[1].id);

        const childFolder1 = parentFolder1.children.find((el) => el.id === createdFolders[0].id);

        expect(parentFolder1).toBeDefined();
        expect(childFolder1).toBeDefined();
        this.logger.log('unbind folders');
        await this.post(
            `bind/${createdFolders[0].id}`,
            {
                insert: [],
                delete: [createdFolders[1].id],
            },
            jwtToken.accessToken
        ).expect(HttpStatus.CREATED);

        this.logger.log('Get folder Tree');
        const {body: folderTree} = await this.get(`folder-tree?shown-on=${TASK_MANAGEMENT}`, jwtToken.accessToken);

        const parentFolder = folderTree[0].children.find((el) => el.id === createdFolders[1].id);

        const childFolder = parentFolder.children.find((el) => el.id === createdFolders[0].id);

        expect(parentFolder).toBeDefined();
        expect(childFolder).toBeUndefined();
    }

    /**
     * Retrieves the task tree by folder ID.
     *
     * @returns {Promise<void>} A Promise that resolves once the task tree has been retrieved.
     */
    @Test('get taskTree by folder Id')
    async getTaskTree(): Promise<void> {
        this.logger.log('Create a folder');
        const {folder, jwtToken} = await this.createFolder();
        this.logger.log('get user id');
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        this.logger.log('Create task');
        const fakeTask1 = this.taskFactory.fakeCreateTask(userId, folder.id);
        const fakeTask2 = this.taskFactory.fakeCreateTask(userId, folder.id);
        const {body: task1} = await this.post(`/task`, fakeTask1, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(task1.description).toBe(fakeTask1.description);
        expect(task1.title).toBe(fakeTask1.title);
        const {body: task2} = await this.post(`/task`, fakeTask2, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(task2.description).toBe(fakeTask2.description);
        expect(task2.title).toBe(fakeTask2.title);
        const {body: taskTreeResponse} = await this.get(`task-tree/${folder.id}`, jwtToken.accessToken).expect(HttpStatus.OK);
        const task1Response = taskTreeResponse.find((task) => task.id == task1.id);
        expect(task1Response.description).toBe(task1.description);
        expect(task1Response.title).toBe(task1.title);
        const task2Response = taskTreeResponse.find((task) => task.id == task2.id);
        expect(task2Response.description).toBe(task2.description);
        expect(task2Response.title).toBe(task2.title);
    }

    /**
     * Updates: creating a folder will automatically follow the folder as well, combining two checks together
     *
     * Unfollows and follows a folder.
     *
     * @returns {Promise<void>} A Promise that resolves when the folder is unfollowed.
     */
    @Test('unfollow and follow a folder')
    async unFollowFolder(): Promise<void> {
        this.logger.log('Create a folder');
        const {folder, jwtToken} = await this.createFolder();
        this.logger.log('get user id');
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);

        this.logger.log('unfollow a folder');
        const {body: deleteResponse} = await this.delete(`unfollow/${folder.id}/${userId}`, jwtToken.accessToken).expect(HttpStatus.OK);
        expect(deleteResponse.affected).toEqual(1);
        this.logger.log('get all followers from specific folder');
        const {body: followers} = await this.get(`follow/${folder.id}`, jwtToken.accessToken).expect(HttpStatus.OK);
        expect(followers.length).toEqual(0);

        this.logger.log('follow a folder');
        const {body: response} = await this.post(`follow/${folder.id}/${userId}`, {}, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(response.folderId).toEqual(folder.id);
        this.logger.log('get all followers from specific folder');
        const {body: newfollowers} = await this.get(`follow/${folder.id}`, jwtToken.accessToken).expect(HttpStatus.OK);
        expect(newfollowers[0].userId).toEqual(userId);
    }

    /**
     * getFollowingFolders() method is used to retrieve all the folders that are followed by the user.
     *
     * @returns {Promise<void>} - A promise that resolves to void.
     */
    @Test('get all the folders followed by the user')
    async getFollowingFolders(): Promise<void> {
        this.logger.log('Create a folder');
        const {jwtToken} = await this.createFolder();
        this.logger.log('get user id');
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        this.logger.log('fetch all following folders');
        const {body: followedFolders} = await this.get(`following`, jwtToken.accessToken).expect(HttpStatus.OK);
        expect(followedFolders[0].ownerId).toBe(userId);
    }

    /**
     * Copies a folder.
     *
     * @returns {Promise<void>} A promise that resolves when the folder is copied.
     */
    @Test('copy a folder')
    async copyFolder(): Promise<void> {
        this.logger.log('Create a folder');
        const {folder, jwtToken, spaceResponse} = await this.createFolder();

        this.logger.log('copy folder');
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        const fakeTask = this.taskFactory.fakeCreateTask(userId, folder.id);
        const {body: task} = await this.post(`/task`, fakeTask, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(task.description).toBe(fakeTask.description);
        expect(task.title).toBe(fakeTask.title);
        expect(task.startDate).toBe(fakeTask.startDate.toISOString());

        const fakeCopyFolderDto = this.factory.fakeCopyFolderDto(spaceResponse.id);
        const {body: response} = await this.post(`copy/${folder.id}`, fakeCopyFolderDto, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(response.title.includes(folder.title)).toBeTruthy();
        expect(response.description).toEqual(folder.description);
        expect(response.color).toEqual(folder.color);
    }

    /**
     * Deletes the archived or deleted folder.
     *
     * @returns {Promise<void>} A promise that resolves when the folder is deleted successfully.
     */
    @Test('delete archived or deleted folder')
    async deleteArchivedFolder(): Promise<void> {
        this.logger.log('Create a folder');
        const {folder, jwtToken} = await this.createFolder();
        this.logger.log('Getting a folder');
        await this.get(`${folder.id}`, jwtToken.accessToken).expect(HttpStatus.OK);
        this.logger.log('archive a folder');
        const archiveResponse = await this.post(
            `archive/${folder.id}`,
            {archiveReason: 'This needs to be archived'},
            jwtToken.accessToken
        ).expect(HttpStatus.CREATED);
        expect(archiveResponse).toBeDefined();
        this.logger.log('delete archive folder');

        await this.delete(`permanent-delete/${folder.id}`, jwtToken.accessToken).expect(HttpStatus.OK);
        this.logger.log('get deleted folder');
        const response = await this.get(`${folder.id}?shown-on=${TASK_MANAGEMENT}`, jwtToken.accessToken);
        expect(response.status).toBe(HttpStatus.FORBIDDEN);
    }

    /**
     * Updates the tags of a folder.
     *
     * @returns {Promise<void>} - A promise that resolves when the folder tags have been updated.
     */
    @Test('update folder Tags')
    async updateFolderTags(): Promise<void> {
        this.logger.log('Create a folder');
        const {folder, jwtToken, spaceResponse} = await this.createFolder();
        this.logger.log('create tags');
        const tag1 = await this.tagFactory.createTag();
        const tag2 = await this.tagFactory.createTag();
        this.logger.log('first insert tags to space');
        await this.patch(`/space/${spaceResponse.id}`, {tags: {insert: [tag1.id, tag2.id]}}, jwtToken.accessToken).expect(HttpStatus.OK);
        this.logger.log('insert tags to folder');
        await this.patch(`folder-tags/${folder.id}`, {insert: [tag1.id, tag2.id]}, jwtToken.accessToken).expect(HttpStatus.OK);
        this.logger.log('get folder tags');
        const {body: folderTags} = await this.get(`folder-tags/${folder.id}`, jwtToken.accessToken).expect(HttpStatus.OK);
        expect(folderTags[0].id).toBe(tag1.id);
        expect(folderTags[0].title).toBe(tag1.title);
        expect(folderTags[1].id).toBe(tag2.id);
        expect(folderTags[1].title).toBe(tag2.title);
    }

    /**
     * Updates the position of a folder.
     *
     * @returns {Promise<void>} Promise that resolves when the folder position is updated.
     * @throws {Error} If there is an error while updating the folder position or the assertions fail.
     */
    @Test('update folder position')
    async updateFolderPosition(): Promise<void> {
        const {body: jwtToken} = await this.createUserWithPermissions({
            folder: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            folderWorkflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            purgeFoldersAndTasks: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            replaceFolderOwner: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            displacementGroup: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            space: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            commonCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            userCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            teams: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            customFieldCollection: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            user: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            workflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        const {createdFolders, spaceId} = await this.createManyFakeFolders(jwtToken.accessToken);
        const fakeUpdateFolderPositionDto = this.factory.fakeUpdateFolderPositionDto(createdFolders[0].id, spaceId);
        await this.patch(`position/${createdFolders[1].id}`, fakeUpdateFolderPositionDto, jwtToken.accessToken).expect(HttpStatus.OK);
        const {body: space} = await this.get(
            `folder-tree?folder_id=${createdFolders[1].id}&shown-on=${TASK_MANAGEMENT}`,
            jwtToken.accessToken
        );
        expect(space[0].folderType).toBe('space');
        expect(space[0].pathIds).toHaveLength(1);
        expect(space[0].pathIds[0]).toBe(space[0].id);
        expect(space[0].children[0].pathIds[1]).toBe(createdFolders[0].id);
        expect(space[0].children[0].pathIds[2]).toBe(createdFolders[1].id);
    }

    /**
     * Updates the position of a folder should fail if loop existed.
     *
     * @returns {Promise<void>} Promise that resolves when the folder position is updated.
     * @throws {Error} If there is an error while updating the folder position or the assertions fail.
     */
    @Test('should fail if the folder positions create a loop')
    async failUpdateFolderPosition(): Promise<void> {
        const {body: jwtToken} = await this.createUserWithPermissions({
            folder: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            folderWorkflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            purgeFoldersAndTasks: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            replaceFolderOwner: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            displacementGroup: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            space: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            commonCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            userCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            teams: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            customFieldCollection: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            user: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            workflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        const {createdFolders, spaceId} = await this.createManyFakeFolders(jwtToken.accessToken);
        // bind folder 1 to 2
        await this.post(
            `bind/${createdFolders[0].id}`,
            {
                insert: [createdFolders[1].id],
                delete: [],
            },
            jwtToken.accessToken
        );

        this.logger.log('bind', createdFolders[0].id, 'to ', createdFolders[1].id);

        // bind folder 2 to 3
        await this.post(
            `bind/${createdFolders[1].id}`,
            {
                insert: [createdFolders[2].id],
                delete: [],
            },
            jwtToken.accessToken
        );

        // should fail with an error when trying to move folder 3 to folder 1 as loop existed
        const loopUpdateFolderPositionDto = {
            index: 1,
            view: 'root',
            parentFolderNewId: createdFolders[0].id,
            parentFolderOldId: spaceId,
        };
        await this.patch(`position/${createdFolders[2].id}`, loopUpdateFolderPositionDto, jwtToken.accessToken).expect(
            HttpStatus.BAD_REQUEST
        );
    }

    /**
     * Changes the workflow of a folder.
     *
     * @returns {Promise<void>} A promise that resolves when the folder's workflow has been changed.
     */
    @Test('change folder workflow')
    async changeFolderWorkflow(): Promise<void> {
        this.logger.log('Create a folder');
        const {folder, jwtToken, spaceResponse} = await this.createFolder();
        this.logger.log(' create folder workflow');
        const workflow: WorkFlowEntity = await this.createWorkflowForFolder(jwtToken.accessToken),
            fakeChangeWorkflow: ChangeWorkflowFolderDto = {
                commonWorkflow: workflow.id,
                type: ChangeWorkflowOptions.COMMON_TO_COMMON,
                Mapping: [],
                personaliseWorkflow: null,
            };
        this.logger.log('first insert workflow to space');
        await this.patch(`/space/${spaceResponse.id}`, {workflows: {insert: [workflow.id]}}, jwtToken.accessToken).expect(HttpStatus.OK);
        this.logger.log(' change folder-workflow');
        await this.patch(`change-workflow/${folder.id}`, fakeChangeWorkflow, jwtToken.accessToken).expect(HttpStatus.OK);
        const {body: folderResponse} = await this.get(`${folder.id}`, jwtToken.accessToken);
        expect(folderResponse.workflow.title).toBe(workflow.title);
        expect(folderResponse.workflow.description).toBe(workflow.description);
    }

    //** Todo : Needs to be fixed again when work on binding and sharing */
    /**
     * Binds a folder with a member.
     * @returns {Promise<void>} A promise that resolves when the operation is complete.
     */
    @Test('Check bind folder with members')
    async BindFolderWithMember(): Promise<void> {
        const {body: jwtToken1} = await this.createUserWithPermissions({
            folder: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            folderWorkflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            purgeFoldersAndTasks: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            replaceFolderOwner: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            displacementGroup: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            space: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            commonCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            userCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            teams: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            customFieldCollection: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            user: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            workflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        const userId1 = this.getUserIdFromAccessToken(jwtToken1.accessToken);
        const {body: jwtToken2} = await this.createUserWithPermissions({
            folder: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            folderWorkflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            purgeFoldersAndTasks: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            replaceFolderOwner: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            displacementGroup: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            space: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            commonCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            userCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            teams: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            customFieldCollection: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            user: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            workflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });

        const workflow: WorkFlowEntity = await this.createWorkflowForFolder(jwtToken1.accessToken),
            fakeChangeWorkflow: ChangeWorkflowFolderDto = {
                commonWorkflow: workflow.id,
                type: ChangeWorkflowOptions.COMMON_TO_COMMON,
                Mapping: [],
                personaliseWorkflow: null,
            };

        expect(workflow).toBeDefined();
        const spaceResponse = await this.createSpace(userId1, jwtToken1.accessToken, [workflow.id]);
        const userId2 = this.getUserIdFromAccessToken(jwtToken2.accessToken);
        const updateMembersDto = {
            insert: [{id: userId2, userPermission: UserPermissionOptions.FULL}],
            update: [],
            delete: [],
        };
        //** Todo : here we should user jwtToken2 but later we will fix it */
        await this.patch(`/space/${spaceResponse.id}/members`, updateMembersDto, jwtToken1.accessToken).expect(HttpStatus.OK);

        const fakeFolder1 = this.factory.fakeCreateFolder(
            fakeChangeWorkflow,
            null,
            DefaultViewOptions.BOARD,
            [TASK_MANAGEMENT],
            spaceResponse.id
        );
        const {body: f1} = await this.post(``, fakeFolder1, jwtToken1.accessToken).expect(HttpStatus.CREATED);
        const fakeFolder2 = this.factory.fakeCreateFolderWithMember(
            fakeChangeWorkflow,
            null,
            DefaultViewOptions.BOARD,
            [TASK_MANAGEMENT],
            [{id: userId1, userPermission: UserPermissionOptions.EDITOR}],
            spaceResponse.id
        );
        const {body: f2} = await this.post(``, fakeFolder2, jwtToken1.accessToken).expect(HttpStatus.CREATED);
        this.logger.log('bind folders');
        await this.post(`bind/${f1.id}`, {insert: [f2.id], delete: []}, jwtToken1.accessToken);

        const {body: folderTree} = await this.get(`folder-tree?shown-on=${TASK_MANAGEMENT}`, jwtToken1.accessToken);

        const parentFolder = folderTree[0].children.find((el) => el.id === f2.id);

        const childFolder = parentFolder.children.find((el) => el.id === f1.id);

        expect(parentFolder).toBeDefined();
        expect(childFolder).toBeDefined();
    }

    /**
     * Validates the user's custom fields.
     *
     * @returns {Promise<void>}
     */
    // ** Note : This endpoint is removed and functionality also Todo : Remove it */
    // @Test('validate user custom field')
    // async ValidateUserCustomFields(): Promise<void> {
    //     this.logger.log('generate user token');
    //     const {body: jwtToken1} = await this.createUserWithPermissions({
    //         folder: PermissionOptions.CREATE_READ_UPDATE_DELETE,
    //         folderWorkflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
    //         purgeFoldersAndTasks: PermissionOptions.CREATE_READ_UPDATE_DELETE,
    //         replaceFolderOwner: PermissionOptions.CREATE_READ_UPDATE_DELETE,
    //         displacementGroup: PermissionOptions.CREATE_READ_UPDATE_DELETE,
    //         space: PermissionOptions.CREATE_READ_UPDATE_DELETE,
    //         commonCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
    //         userCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
    //         teams: PermissionOptions.CREATE_READ_UPDATE_DELETE,
    //         customFieldCollection: PermissionOptions.CREATE_READ_UPDATE_DELETE,
    //         user: PermissionOptions.CREATE_READ_UPDATE_DELETE,
    //         workflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
    //     });
    //     //** Todo : Fix this with binding  */
    //     const {body: jwtToken2} = await this.createUserWithPermissions({
    //         folder: PermissionOptions.CREATE_READ_UPDATE_DELETE,
    //         folderWorkflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
    //         purgeFoldersAndTasks: PermissionOptions.CREATE_READ_UPDATE_DELETE,
    //         replaceFolderOwner: PermissionOptions.CREATE_READ_UPDATE_DELETE,
    //         displacementGroup: PermissionOptions.CREATE_READ_UPDATE_DELETE,
    //         space: PermissionOptions.CREATE_READ_UPDATE_DELETE,
    //         commonCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
    //         userCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
    //         teams: PermissionOptions.CREATE_READ_UPDATE_DELETE,
    //         customFieldCollection: PermissionOptions.CREATE_READ_UPDATE_DELETE,
    //         user: PermissionOptions.CREATE_READ_UPDATE_DELETE,
    //         workflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
    //     });
    //     this.logger.log('get User id');
    //     const userId2 = this.getUserIdFromAccessToken(jwtToken2.accessToken);

    //     this.logger.log('create workflow');
    //     const workflow: WorkFlowEntity = await this.createWorkflowForFolder(jwtToken1.accessToken),
    //         fakeChangeWorkflow: ChangeWorkflowFolderDto = {
    //             commonWorkflow: workflow.id,
    //             type: ChangeWorkflowOptions.COMMON_TO_COMMON,
    //             Mapping: [],
    //             personaliseWorkflow: null,
    //         };

    //     expect(workflow).toBeDefined();
    //     const spaceResponse = await this.createSpace(userId2, jwtToken1.accessToken, [workflow.id]);
    //     const updateMembersDto = {
    //         insert: [{id: userId2, userPermission: UserPermissionOptions.FULL}],
    //         update: [],
    //         delete: [],
    //     };
    //     await this.patch(`/space/${spaceResponse.id}/members`, updateMembersDto, jwtToken1.accessToken).expect(HttpStatus.OK);

    //     this.logger.log('create folder');
    //     const fakeFolder = this.factory.fakeCreateFolderWithMember(
    //         fakeChangeWorkflow,
    //         spaceResponse.id,
    //         DefaultViewOptions.BOARD,
    //         [TASK_MANAGEMENT],
    //         [{id: userId2, userPermission: UserPermissionOptions.EDITOR}]
    //     );
    //     const {body: folderResponse} = await this.post(``, fakeFolder, jwtToken1.accessToken).expect(HttpStatus.CREATED);
    //     this.logger.log('create a custom-field-definition');
    //     const customFieldDefinitionDto = this.customFieldDefinitionFactory.fakeCreateCustomFieldDefinition();
    //     const {body: response} = await this.post(`/custom-field-definition/per-user`, customFieldDefinitionDto, jwtToken1.accessToken);
    //     expect(response.identifiers[0].id).toBeDefined();

    //     this.logger.log('add custom-field-value to folder');
    //     const customFieldValueFolderDto = this.customFieldDefinitionFactory.fakeCreateFolderCustomFieldValue(response.identifiers[0].id);
    //     const {body: customFieldResponse} = await this.post(
    //         `/folder/custom-field-value/${folderResponse.id}`,
    //         [customFieldValueFolderDto],
    //         jwtToken1.accessToken
    //     ).expect(HttpStatus.CREATED);
    //     expect(customFieldResponse.identifiers[0].id).toBeDefined();
    //     this.logger.log('Get folder for both owner and member');
    //     const {body: folderOwnerResponse} = await this.get(`${folderResponse.id}`, jwtToken1.accessToken).expect(HttpStatus.OK);
    //     const {body: folderMemberResponse} = await this.get(`${folderResponse.id}`, jwtToken2.accessToken).expect(HttpStatus.OK);

    //     //** todo fix with binding and sharing concept */
    //     expect(folderMemberResponse.customFields.length).toBe(0);
    //     expect(folderOwnerResponse.customFields[0].CustomFieldDefinition.id).toBe(response.identifiers[0].id);
    // }

    /**
     * Executes a series of actions as a super user to test user permissions.
     *
     * @returns {Promise<void>} A Promise that resolves when the method is finished.
     */
    @Test('superUser')
    async superUser(): Promise<void> {
        this.logger.log('generate user token');
        const {body: jwtToken1} = await this.createUserWithPermissions({
            folder: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            folderWorkflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            purgeFoldersAndTasks: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            replaceFolderOwner: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            displacementGroup: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            space: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            commonCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            userCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            teams: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            customFieldCollection: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            user: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            workflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        this.logger.log('get User id');
        const userId = this.getUserIdFromAccessToken(jwtToken1.accessToken);
        const {body: jwtToken2} = await this.createUserWithPermissions({
            workflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            folder: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            commonCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            userCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            displacementGroup: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });

        this.logger.log('create workflow');
        const workflow: WorkFlowEntity = await this.createWorkflowForFolder(jwtToken1.accessToken),
            fakeChangeWorkflow: ChangeWorkflowFolderDto = {
                commonWorkflow: workflow.id,
                type: ChangeWorkflowOptions.COMMON_TO_COMMON,
                Mapping: [],
                personaliseWorkflow: null,
            };
        const spaceResponse = await this.createSpace(userId, jwtToken1.accessToken, [workflow.id]);
        const userId2 = this.getUserIdFromAccessToken(jwtToken2.accessToken);
        const updateMembersDto = {
            insert: [{id: userId2, userPermission: UserPermissionOptions.FULL}],
            update: [],
            delete: [],
        };
        await this.patch(`/space/${spaceResponse.id}/members`, updateMembersDto, jwtToken1.accessToken).expect(HttpStatus.OK);
        this.logger.log('create folder');
        const showOn: string[] = [TASK_MANAGEMENT];
        const fakeFolder = this.factory.fakeCreateFolder(fakeChangeWorkflow, null, DefaultViewOptions.BOARD, showOn, spaceResponse.id);
        const {body: f1} = await this.post(``, fakeFolder, jwtToken1.accessToken).expect(HttpStatus.CREATED);
        expect(f1).toBeDefined();

        const {body: f2} = await this.get(`${f1.id}?shown-on=${TASK_MANAGEMENT}`, jwtToken1.accessToken).expect(HttpStatus.OK);
        expect(f2).toBeDefined();
        const {body: f3} = await this.get(`${f1.id}?shown-on=${TASK_MANAGEMENT}`, jwtToken2.accessToken).expect(HttpStatus.FORBIDDEN);
        expect(f3.message).toBe('Forbidden resource');
        this.logger.log('log as super user ' + PAS_USER_SYNC_EMAIL);
        const superUser = await this.logUser({email: PAS_USER_SYNC_EMAIL, password: PAS_USER_SYNC_PASSWORD});
        this.logger.log('=========================Get folder as super user=====================');
        const {body: f4} = await this.get(`${f1.id}?shown-on=${TASK_MANAGEMENT}`, superUser.accessToken).expect(HttpStatus.OK);
        expect(f4).toStrictEqual(f2);
    }

    /**
     * Checks for archived folders and performs various operations related to folder management.
     *
     * @returns {Promise<void>} A promise that resolves when the operation is complete.
     */
    //*TODO: need to update folder_id filter in folder-tree to reflect new space schema
    @Test('Checks for archived folders and performs various operations related to folder management')
    async CheckForArchivedFolders(): Promise<void> {
        const {body: jwtToken} = await this.createUserWithPermissions({
            folder: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            folderWorkflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            purgeFoldersAndTasks: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            replaceFolderOwner: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            displacementGroup: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            space: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            commonCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            userCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            teams: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            customFieldCollection: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            user: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            workflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        const {createdFolders, spaceId} = await this.createManyFakeFolders(jwtToken.accessToken);
        const fakeUpdateFolderPositionDtoX = this.factory.fakeUpdateFolderPositionDto(createdFolders[0].id, spaceId);
        await this.patch(`position/${createdFolders[1].id}`, fakeUpdateFolderPositionDtoX, jwtToken.accessToken).expect(HttpStatus.OK);
        const fakeUpdateFolderPositionDtoY = this.factory.fakeUpdateFolderPositionDto(createdFolders[1].id, spaceId);
        await this.patch(`position/${createdFolders[2].id}`, fakeUpdateFolderPositionDtoY, jwtToken.accessToken).expect(HttpStatus.OK);

        for (const folder of createdFolders) {
            const folderId = folder.id;
            const folderResponse = await this.post(
                `archive/${folderId}`,
                {archiveReason: 'This needs to be archived'},
                jwtToken.accessToken
            ).expect(HttpStatus.CREATED);
            expect(folderResponse.body).toBeDefined();

            const {body: folderArchived} = await this.get(
                `${folderId}?shown-on=${TASK_MANAGEMENT}&show-archived=true`,
                jwtToken.accessToken
            ).expect(HttpStatus.OK);

            expect(folderArchived.archivedBy).not.toBeNull();
        }
        const {body: folderTree} = await this.get(
            `folder-tree?folder_id=${createdFolders[2].id}&shown-on=${TASK_MANAGEMENT}&show-archived=true`,
            jwtToken.accessToken
        ).expect(HttpStatus.OK);
        expect(folderTree[0].folderType).toBe('space');
        expect(folderTree[0].pathIds).toHaveLength(1);
        expect(folderTree[0].pathIds[0]).toBe(folderTree[0].id);
        expect(folderTree[0].children[0].pathIds[1]).toBe(createdFolders[0].id);
        expect(folderTree[0].children[0].pathIds[2]).toBe(createdFolders[1].id);
        expect(folderTree[0].children[0].pathIds[3]).toBe(createdFolders[2].id);
        expect(folderTree[0].children[0].archived_by).not.toBeNull();
        this.logger.log('get folder-tree without archived folders');
        const {body: unArchivedFolderResponse} = await this.get(`folder-tree?shown-on=${TASK_MANAGEMENT}`, jwtToken.accessToken).expect(
            HttpStatus.OK
        );
        //1st level child is archived so the length of children should be 0
        expect(unArchivedFolderResponse[0].children.length).toBe(0);
    }

    /**
     * Should send the folder back to Space if the parent folder is archived
     *
     * @returns {Promise<void>} A promise that resolves when the operation is complete.
     */
    //*TODO: need to update folder_id filter in folder-tree to reflect new space schema
    @Test('should send the folder back to Space when unarchiving a folder with an archived parent folder')
    async UnarchiveFolderWithArchivedParent(): Promise<void> {
        const {body: jwtToken} = await this.createUserWithPermissions({
            folder: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            folderWorkflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            purgeFoldersAndTasks: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            replaceFolderOwner: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            displacementGroup: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            space: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            commonCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            userCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            teams: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            customFieldCollection: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            user: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            workflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        const {createdFolders} = await this.createManyFakeFolders(jwtToken.accessToken);

        // create folder tree
        for (let i = 1; i < createdFolders.length; i++) {
            await this.post(
                `bind/${createdFolders[i - 1].id}`,
                {
                    insert: [createdFolders[i].id],
                    delete: [],
                },
                jwtToken.accessToken
            );
        }

        // archive the parent folder
        const {body: folderTree} = await this.get(
            `folder-tree?folder_id=${createdFolders[createdFolders.length - 1].id}&shown-on=${TASK_MANAGEMENT}&show-archived=true`,
            jwtToken.accessToken
        ).expect(HttpStatus.OK);

        // check if all folders in the tree are archived
        for (const folder of folderTree) {
            if (folder.folderType === FolderTypeOptions.FOLDER) {
                expect(folder.archivedAt).toBeDefined();
                expect(folder.archivedBy).toBeDefined();
            }
        }

        // unarchive the last child in the folder tree
        await this.post(`archived/restore/${createdFolders[0].id}`, {}, jwtToken.accessToken).expect(HttpStatus.CREATED);

        // the last child should be sent back to Space after unarchived
        const {body: folderTreeResponse} = await this.get(
            `folder-tree?folder_id=${createdFolders[0].id}&shown-on=${TASK_MANAGEMENT}&show-archived=true`,
            jwtToken.accessToken
        ).expect(HttpStatus.OK);

        // The unarchived folder should be the direct child of the Space
        const foundChild = folderTreeResponse[0].children.find((child) => child.id === createdFolders[0].id);
        expect(foundChild).toBeDefined();
        expect(foundChild).toEqual(expect.objectContaining({title: createdFolders[0].title}));

        // A restore_archived action should be created
        const {
            body: {data: spaceStream},
        } = await this.get(`/stream-view/folder/${foundChild.id}`, jwtToken.accessToken);
        expect(
            spaceStream[0].actions.find((action) => action.folderId === foundChild.id && action.action === 'restore_archive')
        ).toBeDefined();
    }

    /**
     * Retrieves the list of archived folders and tasks.
     *
     * @returns {Promise<void>} A promise that resolves when the operation is complete.
     */
    @Test('GetArchivedFoldersAndTasks')
    async GetArchivedFoldersAndTasks(): Promise<void> {
        this.logger.log('generate user token');
        const {body: jwtToken} = await this.createUserWithPermissions({
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
        this.logger.log('get User id');
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        this.logger.log('generate multiple folders');
        const {createdFolders} = await this.createManyFakeFolders(jwtToken.accessToken);

        const fakeTask1 = this.taskFactory.fakeCreateTask(userId, createdFolders[1].id);

        this.logger.log('create task');
        const {body: task1} = await this.post(`/task`, fakeTask1, jwtToken.accessToken).expect(HttpStatus.CREATED);

        this.logger.log('archive folder');

        const {body: deleteResponseFolder} = await this.post(
            `archive/${createdFolders[1].id}`,
            {archiveReason: 'This needs to be archived'},
            jwtToken.accessToken
        ).expect(HttpStatus.CREATED);

        this.logger.log('archive task 1');

        const {body: deleteResponseTask} = await this.post(
            `/task/archive/${task1.id}/folder/${createdFolders[1].id}`,
            {archiveReason: 'Archive this Task'},
            jwtToken.accessToken
        );

        expect(deleteResponseFolder).toBeDefined();
        expect(deleteResponseTask).toBeDefined();

        const {body: f1DB} = await this.post(
            `archived-folder-task?shown-on=${TASK_MANAGEMENT}`,
            {limit: 1000, offset: 0},
            jwtToken.accessToken
        ).expect(HttpStatus.CREATED);

        const archivedFolder = f1DB.data.find((el) => el.id === createdFolders[1].id);

        const {body: folderArchivedTasks} = await this.post(
            `/task/folder/${createdFolders[1].id}?shown-on=${TASK_MANAGEMENT}`,
            {limit: 100, offset: 0},
            jwtToken.accessToken
        ).expect(HttpStatus.CREATED);

        const archivedTask = folderArchivedTasks.data.find((el) => el.id === task1.id);

        const totalRecords = f1DB.metadata.totalRecords;
        this.logger.log('archivedFolder', archivedFolder);
        //Folder Check

        expect(archivedFolder.id).toEqual(createdFolders[1].id);
        expect(archivedFolder.title).toEqual(createdFolders[1].title);
        expect(archivedFolder.archiveReason).toEqual('This needs to be archived');
        expect(archivedFolder.archivedAt).not.toBeNull();
        expect(archivedFolder.pathStr).not.toBeNull();
        const sortedData = archivedFolder.pathStr.sort((a, b) => a.type.localeCompare(b.type));
        expect(sortedData[0].title).toEqual(archivedFolder.title);
        expect(sortedData[0].type).toEqual(archivedFolder.type);

        expect(archivedTask.id).toEqual(task1.id);
        expect(archivedTask.title).toEqual(task1.title);
        expect(archivedTask.archivedAt).not.toBeNull();
        expect(archivedTask.pathStr).not.toBeNull();
        expect(archivedTask.pathStr[0].title).toEqual(archivedTask.title);
        expect(archivedTask.pathStr[0].type).toEqual(archivedTask.type);

        //Check Total Records
        expect(totalRecords).toBeGreaterThan(1);

        // Get archived folder/task with search params
        const {
            body: {data: searchedFolder},
        } = await this.post(
            `archived-folder-task?shown-on=${TASK_MANAGEMENT}&search=${createdFolders[1].title}`,
            {limit: 100, offset: 0},
            jwtToken.accessToken
        ).expect(HttpStatus.CREATED);

        expect(searchedFolder.every((el) => el.title.includes(createdFolders[1].title))).toBe(true);

        // archiving folder 2
        await this.post(`archive/${createdFolders[2].id}`, {archiveReason: 'This needs to be archived'}, jwtToken.accessToken).expect(
            HttpStatus.CREATED
        );

        const {
            body: {data: searchedFolder2},
        } = await this.post(
            `archived-folder-task?shown-on=${TASK_MANAGEMENT}&search=${createdFolders[2].title}`,
            {limit: 100, offset: 0},
            jwtToken.accessToken
        ).expect(HttpStatus.CREATED);

        expect(searchedFolder2.every((el) => el.title.includes(createdFolders[2].title))).toBe(true);

        // search for archived task
        const {
            body: {data: searchedTasks},
        } = await this.post(
            `archived-folder-task?shown-on=${TASK_MANAGEMENT}&search=${task1.title}`,
            {limit: 100, offset: 0},
            jwtToken.accessToken
        ).expect(HttpStatus.CREATED);

        expect(searchedTasks.every((el) => el.title.includes(task1.title))).toBe(true);
    }

    /**
     * Retrieves deleted folders and tasks.
     *
     * @returns {Promise<void>} - A promise that resolves with void.
     */
    @Test('GetDeletedFoldersAndTasks')
    async GetDeletedFoldersAndTasks(): Promise<void> {
        this.logger.log('generate user token');
        const {body: jwtToken} = await this.createUserWithPermissions({
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
        this.logger.log('get User id');
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        this.logger.log('generate multiple folders');
        const {createdFolders} = await this.createManyFakeFolders(jwtToken.accessToken);

        const fakeTask1 = this.taskFactory.fakeCreateTask(userId, createdFolders[1].id);
        const fakeTask2 = this.taskFactory.fakeCreateTask(userId, createdFolders[2].id);

        this.logger.log('create task');
        const {body: task1} = await this.post(`/task`, fakeTask1, jwtToken.accessToken).expect(HttpStatus.CREATED);
        const {body: task2} = await this.post(`/task`, fakeTask2, jwtToken.accessToken).expect(HttpStatus.CREATED);

        this.logger.log('delete folder');

        const {body: deleteResponseFolder} = await this.delete(`delete/${createdFolders[1].id}`, jwtToken.accessToken).expect(
            HttpStatus.OK
        );

        const {body: deleteResponseTask} = await this.delete(
            `/task/delete/${task1.id}/folder/${createdFolders[1].id}`,
            jwtToken.accessToken
        ).expect(HttpStatus.OK);

        const {body: deleteResponseTask2} = await this.delete(
            `/task/delete/${task2.id}/folder/${createdFolders[2].id}`,
            jwtToken.accessToken
        ).expect(HttpStatus.OK);

        expect(deleteResponseFolder).toBeDefined();
        expect(deleteResponseTask).toBeDefined();
        expect(deleteResponseTask2).toBeDefined();

        const {body: f1DB} = await this.post(
            `deleted-folder-task?shown-on=${TASK_MANAGEMENT}`,
            {limit: 100, offset: 0},
            jwtToken.accessToken
        ).expect(HttpStatus.CREATED);

        const {body: folderArchivedTasks} = await this.post(
            `/task/folder/${createdFolders[1].id}?shown-on=${TASK_MANAGEMENT}`,
            {limit: 100, offset: 0},
            jwtToken.accessToken
        ).expect(HttpStatus.CREATED);

        this.logger.log('folderArchivedTasks', folderArchivedTasks);

        const archivedTask = folderArchivedTasks.data.find((el) => el.id === task1.id);

        const deletedFolder = f1DB.data.find((el) => el.id === createdFolders[1].id);

        const totalRecords = f1DB.metadata.totalRecords;
        this.logger.log('deletedFolder', deletedFolder);
        //Folder Check
        expect(deletedFolder.id).toEqual(createdFolders[1].id);
        expect(deletedFolder.title).toEqual(createdFolders[1].title);
        expect(deletedFolder.deletedAt).not.toBeNull();
        expect(deletedFolder.pathStr).not.toBeNull();
        const sortedData = deletedFolder.pathStr.sort((a, b) => a.type.localeCompare(b.type));
        expect(sortedData[0].title).toEqual(deletedFolder.title);
        expect(sortedData[0].type).toEqual(deletedFolder.type);

        expect(archivedTask.id).toEqual(task1.id);
        expect(archivedTask.title).toEqual(task1.title);
        expect(archivedTask.deletedAt).not.toBeNull();

        expect(archivedTask.pathStr).not.toBeNull();
        expect(archivedTask.pathStr[0].title).toEqual(archivedTask.title);
        expect(archivedTask.pathStr[0].type).toEqual(archivedTask.type);

        //Check Total Records
        expect(totalRecords).toBeGreaterThan(1);

        // Get deleted folder/task with search params
        const {
            body: {data: searchedFolder},
        } = await this.post(
            `deleted-folder-task?shown-on=${TASK_MANAGEMENT}&search=${createdFolders[1].title}`,
            {limit: 100, offset: 0},
            jwtToken.accessToken
        ).expect(HttpStatus.CREATED);

        expect(searchedFolder.every((el) => el.title.includes(createdFolders[1].title))).toBe(true);

        // delete folder 2
        await this.delete(`delete/${createdFolders[2].id}`, jwtToken.accessToken).expect(HttpStatus.OK);

        const {
            body: {data: searchedFolder2},
        } = await this.post(
            `deleted-folder-task?shown-on=${TASK_MANAGEMENT}&search=${createdFolders[2].title}`,
            {limit: 100, offset: 0},
            jwtToken.accessToken
        ).expect(HttpStatus.CREATED);

        expect(searchedFolder2.every((el) => el.title.includes(createdFolders[2].title))).toBe(true);

        // search for deleted task
        const {
            body: {data: searchedTasks},
        } = await this.post(
            `deleted-folder-task?shown-on=${TASK_MANAGEMENT}&search=${task1.title}`,
            {limit: 100, offset: 0},
            jwtToken.accessToken
        ).expect(HttpStatus.CREATED);

        expect(searchedTasks.every((el) => el.title.includes(task1.title))).toBe(true);
    }

    /**
     * Checks the folder path for title update.
     *
     * @returns {Promise<void>} - A promise that resolves when the check is complete.
     */
    @Test('Check Folder path with title update')
    async CheckPathForFolderTitleUpdate(): Promise<void> {
        this.logger.log('Create a folder');
        const {folder, jwtToken} = await this.createFolder();
        const updateDto = {title: faker.commerce.product()};
        const {body: response} = await this.patch(`${folder.id}`, updateDto, jwtToken.accessToken);
        expect(response.affected).toEqual(1);
        this.logger.log('get folder-tree');
        const {body: folderResponse} = await this.get(`folder-tree?shown-on=${TASK_MANAGEMENT}`, jwtToken.accessToken).expect(
            HttpStatus.OK
        );
        expect(folderResponse[0].children[0].id).toBe(folder.id);
        const sortedData = folderResponse[0].children[0].pathString.sort((a, b) => a.type.localeCompare(b.type));
        expect(sortedData[0].title).toBe(updateDto.title);
    }

    @Test('Check for removed members from space')
    async CheckForRemovedMembers(): Promise<void> {
        this.logger.log('create user and login');
        const {body: jwtToken1} = await this.createUserWithPermissions({
            folder: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            folderWorkflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            purgeFoldersAndTasks: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            replaceFolderOwner: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            displacementGroup: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            space: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            commonCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            userCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            teams: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            customFieldCollection: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            user: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            workflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        const {body: jwtToken2} = await this.createUserWithPermissions({
            folder: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            folderWorkflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            purgeFoldersAndTasks: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            replaceFolderOwner: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            displacementGroup: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            space: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            commonCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            userCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            teams: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            customFieldCollection: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            user: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            workflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });

        this.logger.log('create workflow');
        const workflow: WorkFlowEntity = await this.createWorkflowForFolder(jwtToken1.accessToken);
        const workflowId = workflow.id;

        const fakeChangeWorkflow: ChangeWorkflowFolderDto = {
            commonWorkflow: workflowId,
            type: ChangeWorkflowOptions.COMMON_TO_COMMON,
            Mapping: [],
            personaliseWorkflow: null,
        };
        this.logger.log('create folder');
        const userId2 = this.getUserIdFromAccessToken(jwtToken2.accessToken);
        const fakeCreateTeamDto = this.teamFactory.fakeCreateTeamDto([userId2]);
        const {body: teamResponse} = await this.post(`/team`, fakeCreateTeamDto, jwtToken1.accessToken).expect(HttpStatus.CREATED);
        expect(teamResponse.id).toBeDefined();

        const fakeCreateSpace = this.factory.fakeCreateSpace({
            availableWorkflows: [workflowId],
            members: [{id: userId2, userPermission: UserPermissionOptions.EDITOR}],
            teams: [{id: teamResponse.id, teamPermission: UserPermissionOptions.EDITOR}],
        });

        const {body: spaceResponse} = await this.post(`/space`, fakeCreateSpace, jwtToken1.accessToken).expect(HttpStatus.CREATED);
        expect(spaceResponse).toBeDefined();
        this.logger.log('get all spaces');
        const {body: allSpacesResponse} = await this.get(`/space?offset=0&limit=100&show-on=task-management`, jwtToken1.accessToken).expect(
            HttpStatus.OK
        );
        const createdResponse = allSpacesResponse.filter((el) => el.id === spaceResponse.id);

        const fakeFolder = this.factory.fakeCreateFolderWithMember(
            fakeChangeWorkflow,
            null,
            DefaultViewOptions.BOARD,
            [TASK_MANAGEMENT],
            [{id: userId2, userPermission: UserPermissionOptions.EDITOR}],
            spaceResponse.id
        );

        const {body: f1} = await this.post(
            ``,
            {...fakeFolder, teams: [{id: teamResponse.id, teamPermission: UserPermissionOptions.EDITOR}]},
            jwtToken1.accessToken
        ).expect(HttpStatus.CREATED);
        expect(f1).toBeDefined();
        const {body: f1DB} = await this.get(`${f1.id}?shown-on=${TASK_MANAGEMENT}`, jwtToken1.accessToken).expect(HttpStatus.OK);
        expect(f1DB.id).toEqual(f1.id);

        this.logger.log('update space team');
        await this.patch(
            `/space/${createdResponse[0].id}`,
            {
                teams: {insert: [], update: [], delete: [{id: teamResponse.id, teamPermission: UserPermissionOptions.EDITOR}]},
                members: {insert: [], update: [], delete: [{id: userId2, userPermission: UserPermissionOptions.EDITOR}]},
            },
            jwtToken1.accessToken
        ).expect(HttpStatus.OK);

        const {body: f2DB} = await this.get(`${f1.id}?shown-on=${TASK_MANAGEMENT}`, jwtToken1.accessToken).expect(HttpStatus.OK);
        expect(f2DB).toBeDefined();
        expect(f2DB.teams).toBeNull();
    }
}
