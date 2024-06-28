import '@jest-decorated/core/globals';
import {TASK_MANAGEMENT, TokenInterface} from '@lib/base-library';
import {HttpStatus, Inject, Logger, OnModuleInit} from '@nestjs/common';
import {Test, TestSuite} from 'nestjs-jest-decorators';
import {Test as TestResponse} from 'supertest';
import {ChangeWorkflowFolderDto, ChangeWorkflowOptions} from '../../src/dto/folder/folder/change-workflow.dto';
import {GetFolderDto} from '../../src/dto/folder/folder/get-folder.dto';
import {UserPermissionOptions} from '../../src/enum/folder-user.enum';
import {DefaultViewOptions} from '../../src/enum/folder.enum';
import {WorkFlowEntity} from '../../src/model/workflow.entity';
import {PermissionOptions} from '../../src/module/authorization-impl/authorization.enum';
import {CustomFieldCollectionFactory} from '../factory/custom-field-collection.factory';
import {CustomFieldFactory} from '../factory/custom-field.factory';
import {FolderFactory} from '../factory/folder.factory';
import {TaskFactory} from '../factory/task.factory';
import {TeamFactory} from '../factory/team.factory';
import {UserActionFactory} from '../factory/user-action.factory';
import {PermissionsType, UserFactory} from '../factory/user.factory';
import {WorkflowFactory} from '../factory/workflow.factory';
import {NewBaseTest} from './base-test';

@TestSuite('User Action Suite')
export class UserActionE2eSpec extends NewBaseTest implements OnModuleInit {
    private readonly logger = new Logger(UserActionE2eSpec.name);

    @Inject()
    private factory: UserActionFactory;
    @Inject()
    private taskFactory: TaskFactory;
    @Inject()
    private userFactory: UserFactory;
    @Inject()
    private workflowFactory: WorkflowFactory;
    @Inject()
    private folderFactory: FolderFactory;
    @Inject()
    private teamFactory: TeamFactory;
    private customFieldDefinitionFactory = new CustomFieldFactory();
    private customFieldCollectionFactory: CustomFieldCollectionFactory = new CustomFieldCollectionFactory();

    onModuleInit(): void {
        this.setUrl('/user-actions');
    }

    @Test('Should create a user action')
    async createUserAction(): Promise<void> {
        this.logger.log('create user and folder');
        const {folder, jwtToken} = await this.createFolder();
        this.logger.log('get user id');
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        this.logger.log('create task');
        const fakeTask = this.taskFactory.fakeCreateTask(userId, folder.id);
        const {body: task} = await this.post(`/task`, fakeTask, jwtToken.accessToken).expect(HttpStatus.CREATED);

        this.logger.log('create a user action');
        const fakeActionDto = this.factory.fakeAction();
        await this.post(`folder/${folder.id}/task/${task.id}`, fakeActionDto, jwtToken.accessToken).expect(HttpStatus.CREATED);

        const {body: userActionDb} = await this.get(`folder/${folder.id}/task/${task.id}`, jwtToken.accessToken).expect(HttpStatus.OK);

        expect(userActionDb).toHaveLength(1);
        expect(userActionDb[0]).toEqual(expect.objectContaining(fakeActionDto));
    }

    @Test('Should throw an error if description is empty')
    async failCreateUserAction(): Promise<void> {
        this.logger.log('create user and folder');
        const {folder, jwtToken} = await this.createFolder();
        this.logger.log('get user id');
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        this.logger.log('create task');
        const fakeTask = this.taskFactory.fakeCreateTask(userId, folder.id);
        const {body: task} = await this.post(`/task`, fakeTask, jwtToken.accessToken).expect(HttpStatus.CREATED);

        this.logger.log('fail to create a user action with empty description');
        const {body: error1} = await this.post(`folder/${folder.id}/task/${task.id}`, {description: ''}, jwtToken.accessToken).expect(
            HttpStatus.INTERNAL_SERVER_ERROR
        );
        expect(error1.message).toBe('Action name cannot be empty');

        this.logger.log('fail to create a user action with description of empty spaces');
        const {body: error2} = await this.post(`folder/${folder.id}/task/${task.id}`, {description: '     '}, jwtToken.accessToken).expect(
            HttpStatus.INTERNAL_SERVER_ERROR
        );
        expect(error2.message).toBe('Action name cannot be empty');
    }

    // <------------------------------------------------- Helper functions ----------------------------------------------------->

    async createFolder(parentFolderId: number = null): Promise<{folder: GetFolderDto; jwtToken: TokenInterface}> {
        this.logger.log('create user and login');
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
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        this.logger.log('create workflow');
        const workflow: WorkFlowEntity = await this.createWorkflowForFolder(jwtToken.accessToken),
            fakeChangeWorkflow: ChangeWorkflowFolderDto = {
                commonWorkflow: workflow.id,
                type: ChangeWorkflowOptions.COMMON_TO_COMMON,
                Mapping: [],
                personaliseWorkflow: null,
            };
        this.logger.log('create folder');
        const spaceResponse = await this.createSpace(userId, jwtToken.accessToken, [workflow.id]);

        const fakeFolder = this.folderFactory.fakeCreateFolder(
            fakeChangeWorkflow,
            parentFolderId,
            DefaultViewOptions.BOARD,
            [TASK_MANAGEMENT],
            spaceResponse.id
        );
        const {body: f1} = await this.post(`/folder`, fakeFolder, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(f1).toBeDefined();
        //todo : validate and match response and dto
        const {body: f1DB} = await this.get(`/folder/${f1.id}`, jwtToken.accessToken).expect(HttpStatus.OK);
        expect(f1DB.id).toEqual(f1.id);
        return {folder: f1, jwtToken};
    }

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
