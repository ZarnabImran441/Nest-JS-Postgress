import {HttpStatus, Inject, Logger, OnModuleInit} from '@nestjs/common';
import {Test, TestSuite} from 'nestjs-jest-decorators';
import {Test as TestResponse} from 'supertest';
import {ChangeWorkflowFolderDto, ChangeWorkflowOptions} from '../../src/dto/folder/folder/change-workflow.dto';
import {GetFolderDto} from '../../src/dto/folder/folder/get-folder.dto';
import {DefaultViewOptions} from '../../src/enum/folder.enum';
import {WorkFlowEntity} from '../../src/model/workflow.entity';
import {PermissionOptions} from '../../src/module/authorization-impl/authorization.enum';
import {FolderFactory} from '../factory/folder.factory';
import {TaskFactory} from '../factory/task.factory';
import {PermissionsType, UserFactory} from '../factory/user.factory';
import {WorkflowFactory} from '../factory/workflow.factory';
import {NewBaseTest} from './base-test';

/**
 * Class representing a FolderE2eSpec.
 * @extends BaseTest
 */
@TestSuite('Folder Workflow Suite')
export class FolderWorkflowE2eSpec extends NewBaseTest implements OnModuleInit {
    private readonly logger = new Logger(FolderWorkflowE2eSpec.name);

    @Inject()
    private factory: FolderFactory;
    @Inject()
    private userFactory: UserFactory;
    @Inject()
    private workflowFactory: WorkflowFactory;
    @Inject()
    private taskFactory: TaskFactory;

    onModuleInit(): void {
        this.setUrl('/folder-workflow');
    }

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

    private async createSpace(userId: string, accessToken: string, workflowIds: number[]): Promise<GetFolderDto> {
        this.logger.log('create workflow');
        const fakeCreateSpace = this.factory.fakeCreateSpace({
            availableWorkflows: workflowIds,
        });
        const {body: spaceResponse} = await this.post(`/space`, fakeCreateSpace, accessToken).expect(HttpStatus.CREATED);
        expect(spaceResponse).toBeDefined();
        return spaceResponse;
    }

    /**
     * Get Projects Flows And Tasks List.
     * @returns {Promise<void>}
     */
    @Test('get Projects Flows And Tasks List')
    async getProjectsFlowsAndTasksList(): Promise<void> {
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

        const workflow: WorkFlowEntity = await this.createWorkflowForFolder(jwtToken.accessToken);
        const workflowId = workflow.id;

        const fakeChangeWorkflow: ChangeWorkflowFolderDto = {
            commonWorkflow: workflowId,
            type: ChangeWorkflowOptions.COMMON_TO_COMMON,
            Mapping: [],
            personaliseWorkflow: null,
        };
        this.logger.log('create folder');
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);

        const spaceResponse = await this.createSpace(userId, jwtToken.accessToken, [workflowId]);

        const fakeFolder = this.factory.fakeCreateFolder(fakeChangeWorkflow, null, DefaultViewOptions.BOARD, ['list'], spaceResponse.id);

        const {body: folder} = await this.post(`/folder`, fakeFolder, jwtToken.accessToken);

        this.logger.log('create task trees');
        const fakeTask = this.taskFactory.fakeCreateTask(userId, folder.id);
        const fakeTask2 = this.taskFactory.fakeCreateTask(userId, folder.id);

        const {body: parentTask1} = await this.post(`/task`, fakeTask, jwtToken.accessToken);
        const fakeSubTask1 = this.taskFactory.fakeCreateTask(userId, folder.id, parentTask1.id);
        const {body: subTask1} = await this.post(`/task`, fakeSubTask1, jwtToken.accessToken);

        const {body: parentTask2} = await this.post(`/task`, fakeTask2, jwtToken.accessToken);
        const fakeSubTask2 = this.taskFactory.fakeCreateTask(userId, folder.id, parentTask2.id);
        const {body: subTask2} = await this.post(`/task`, fakeSubTask2, jwtToken.accessToken);

        this.logger.log('get the project flows and task list');

        const {body: projectFlowAndTaskList} = await this.post(`project/${folder.id}/list`, {}, jwtToken.accessToken).expect(
            HttpStatus.CREATED
        );

        expect(projectFlowAndTaskList.totalCount).toBe(2);
        const parentTask1DB = projectFlowAndTaskList.tasks.find((el) => el.id === parentTask1.id);
        const parentTask2DB = projectFlowAndTaskList.tasks.find((el) => el.id === parentTask2.id);

        expect(parentTask1DB).toBeDefined();
        expect(parentTask2DB).toBeDefined();

        const subTask1DB = parentTask1DB.children.find((el) => el.id === subTask1.id);
        const subTask2DB = parentTask2DB.children.find((el) => el.id === subTask2.id);

        expect(subTask1DB).toBeDefined();
        expect(subTask2DB).toBeDefined();

        this.logger.log('get the project flows and task list with search params');

        const {body: projectFlowAndTaskListWithSearch} = await this.post(
            `project/${folder.id}/list`,
            {taskFilter: {search: subTask1DB.title}},
            jwtToken.accessToken
        ).expect(HttpStatus.CREATED);

        expect(projectFlowAndTaskListWithSearch.totalCount).toBe(1);
        expect(projectFlowAndTaskListWithSearch.tasks.length).toBe(1);
        expect(projectFlowAndTaskListWithSearch.tasks[0].id).toBe(parentTask1.id);
    }

    /**
     * Get Project workflow.
     * @returns {Promise<void>}
     */
    @Test('get Project workflow')
    async getProjectWorkflow(): Promise<void> {
        this.logger.log('create user and login');
        const {body: jwtToken} = await this.createUserWithPermissions({
            folder: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            folderWorkflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            displacementGroup: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            space: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            teams: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            user: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            workflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        this.logger.log('create workflow');

        const workflow: WorkFlowEntity = await this.createWorkflowForFolder(jwtToken.accessToken);
        const workflowId = workflow.id;

        const fakeChangeWorkflow: ChangeWorkflowFolderDto = {
            commonWorkflow: workflowId,
            type: ChangeWorkflowOptions.COMMON_TO_COMMON,
            Mapping: [],
            personaliseWorkflow: null,
        };
        this.logger.log('create folder');
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);

        const spaceResponse = await this.createSpace(userId, jwtToken.accessToken, [workflowId]);

        const fakeFolder = this.factory.fakeCreateFolder(fakeChangeWorkflow, null, DefaultViewOptions.BOARD, ['board'], spaceResponse.id);

        const {body: folder} = await this.post(`/folder`, fakeFolder, jwtToken.accessToken).expect(HttpStatus.CREATED);

        this.logger.log('get the project workflow');

        const {body: projectWorkflow} = await this.post(`project`, [folder.id], jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(projectWorkflow[0].id).toBe(workflow.id);
        expect(projectWorkflow[0].title).toBe(workflow.title);
        expect(projectWorkflow[0].folderId).toBe(folder.id);

        const firstState = workflow['states'].find((state) => state.id === projectWorkflow[0].states[0].id);
        expect(firstState.systemStageId).toBe(projectWorkflow[0].states[0].systemStageId);
    }

    /**
     * Get Projects Flows And Tasks List with search filter.
     * @returns {Promise<void>}
     */
    @Test('match task from the search filter should include all the sub-tasks that matches')
    async getProjectsFlowsAndTasksListWithSearchFilter(): Promise<void> {
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

        const workflow: WorkFlowEntity = await this.createWorkflowForFolder(jwtToken.accessToken);
        const workflowId = workflow.id;

        const fakeChangeWorkflow: ChangeWorkflowFolderDto = {
            commonWorkflow: workflowId,
            type: ChangeWorkflowOptions.COMMON_TO_COMMON,
            Mapping: [],
            personaliseWorkflow: null,
        };
        this.logger.log('create folder');
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);

        const spaceResponse = await this.createSpace(userId, jwtToken.accessToken, [workflowId]);

        const fakeFolder = this.factory.fakeCreateFolder(fakeChangeWorkflow, null, DefaultViewOptions.BOARD, ['list'], spaceResponse.id);

        const {body: folder} = await this.post(`/folder`, fakeFolder, jwtToken.accessToken);

        this.logger.log('create task trees');
        const fakeTask = this.taskFactory.fakeCreateTask(userId, folder.id);
        const fakeTask2 = this.taskFactory.fakeCreateTask(userId, folder.id);

        const {body: parentTask1} = await this.post(`/task`, fakeTask, jwtToken.accessToken);
        const fakeSubTask1 = this.taskFactory.fakeCreateTask(userId, folder.id, parentTask1.id);
        const {body: subTask1} = await this.post(`/task`, fakeSubTask1, jwtToken.accessToken);

        const {body: parentTask2} = await this.post(`/task`, fakeTask2, jwtToken.accessToken);
        const fakeSubTask2 = this.taskFactory.fakeCreateTask(userId, folder.id, parentTask2.id);
        const {body: subTask2} = await this.post(`/task`, fakeSubTask2, jwtToken.accessToken);

        this.logger.log('get the project flows and task tree matches the title of subtask1');

        const {body: projectFlowAndTaskList} = await this.post(
            `project/${folder.id}/list`,
            {taskFilter: {search: subTask1.title}},
            jwtToken.accessToken
        );

        expect(projectFlowAndTaskList.tasks).toHaveLength(1);
        expect(projectFlowAndTaskList.tasks[0]).toEqual(expect.objectContaining({id: parentTask1.id}));

        this.logger.log('get the project flows and task tree matches the title of parentTask2');

        const {body: projectFlowAndTaskList2} = await this.post(
            `project/${folder.id}/list`,
            {taskFilter: {search: parentTask2.title}},
            jwtToken.accessToken
        );
        const parentTask2DB = projectFlowAndTaskList2.tasks.find((el) => el.id === parentTask2.id);

        expect(projectFlowAndTaskList2.tasks).toHaveLength(1);
        expect(projectFlowAndTaskList2.tasks[0]).toEqual(expect.objectContaining({id: parentTask2.id}));
        expect(parentTask2DB.children[0]).toEqual(expect.objectContaining({id: subTask2.id}));
    }
}
