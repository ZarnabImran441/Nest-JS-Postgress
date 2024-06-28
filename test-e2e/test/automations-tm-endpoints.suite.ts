import {TaskManagementActionPerformer} from '@lib/automations-library';
import {GenericUserLoginDto, TASK_MANAGEMENT} from '@lib/base-library';
import {HttpStatus, Inject, Logger, OnModuleInit} from '@nestjs/common';
import {Test, TestSuite} from 'nestjs-jest-decorators';
import {Test as TestResponse} from 'supertest';
import {ChangeWorkflowFolderDto, ChangeWorkflowOptions} from '../../src/dto/folder/folder/change-workflow.dto';
import {GetFolderDto} from '../../src/dto/folder/folder/get-folder.dto';
import {DefaultViewOptions} from '../../src/enum/folder.enum';
import {TaskEntity} from '../../src/model/task.entity';
import {WorkFlowEntity} from '../../src/model/workflow.entity';
import {PermissionOptions} from '../../src/module/authorization-impl/authorization.enum';
import {CustomFieldFactory} from '../factory/custom-field.factory';
import {FolderFactory} from '../factory/folder.factory';
import {TagFactory} from '../factory/tag.factory';
import {TaskFactory} from '../factory/task.factory';
import {PermissionsType, UserFactory} from '../factory/user.factory';
import {WorkflowFactory} from '../factory/workflow.factory';
import {NewBaseTest} from './base-test';

// TODO: improve!!!
const AUTOMATIONS_USER = process.env.AUTOMATIONS_USER ?? 'service_user@plexxis.com';
const AUTOMATIONS_PASSWORD = process.env.AUTOMATIONS_PASSWORD ?? '1234567890';
const TASK_MANAGEMENT_PATH_IS_TOKEN_VALID = `/users/is-token-valid`;

@TestSuite('Automations Suite')
export class AutomationsTmEndpointsE2eSpec extends NewBaseTest implements OnModuleInit {
    private readonly logger = new Logger(AutomationsTmEndpointsE2eSpec.name);

    @Inject()
    private taskFactory: TaskFactory;
    @Inject()
    private userFactory: UserFactory;
    @Inject()
    private workflowFactory: WorkflowFactory;
    @Inject()
    private folderFactory: FolderFactory;
    @Inject()
    private tagFactory: TagFactory;

    private customFieldDefinitionFactory: CustomFieldFactory = new CustomFieldFactory();

    onModuleInit(): void {
        super.setUrl('/task-action');
    }

    async createFolder(token: string): Promise<GetFolderDto> {
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
        const userIdEx = this.getUserIdFromAccessToken(token);

        this.logger.log('create workflow');
        const workflow: WorkFlowEntity = await this.createWorkflowForFolder(token),
            fakeChangeWorkflow: ChangeWorkflowFolderDto = {
                commonWorkflow: workflow.id,
                type: ChangeWorkflowOptions.COMMON_TO_COMMON,
                Mapping: [],
                personaliseWorkflow: null,
            };
        const spaceResponse = await this.createSpace(userIdEx, jwtToken.accessToken, [workflow.id]);
        this.logger.log('create folder');
        const fakeFolder = this.folderFactory.fakeCreateFolder(
            fakeChangeWorkflow,
            null,
            DefaultViewOptions.BOARD,
            [TASK_MANAGEMENT],
            spaceResponse.id
        );
        const {body: f1} = await this.post(`/folder`, fakeFolder, token);
        expect(f1).toBeDefined();
        const {body: f1DB} = await this.get(`/folder/${f1.id}`, token);
        expect(f1DB.id).toEqual(f1.id);
        return f1DB;
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

    async createFolderAndTask(token: string): Promise<{task: TaskEntity; folder: GetFolderDto}> {
        this.logger.log('create user and folder');
        const folder = await this.createFolder(token);
        this.logger.log('get user id');
        const userId = this.getUserIdFromAccessToken(token);
        this.logger.log('create task');
        const fakeTask = this.taskFactory.fakeCreateTask(userId, folder.id);
        const {body: task} = await this.post(`/task`, fakeTask, token);
        return {task: task, folder: folder};
    }

    async addTagToTask(token: string, folderId: string, taskId: string): Promise<string> {
        const tag = await this.tagFactory.createTag();
        this.logger.log('add tag to task');
        await this.post(`/task/tag/${taskId}/${tag.id}/${folderId}`, {}, token).expect(HttpStatus.CREATED);
        const {body: taskResponse} = await this.get(`/task/${taskId}/folder/${folderId}`, token);
        expect(taskResponse.tags.length).toBe(1);
        expect(taskResponse.tags[0]).toBe(tag.id);
        return tag.id.toString();
    }

    private async login(): Promise<string> {
        const fakeUser = new GenericUserLoginDto();
        fakeUser.email = AUTOMATIONS_USER;
        fakeUser.password = AUTOMATIONS_PASSWORD;

        const {body: jwtToken} = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);

        return jwtToken.accessToken;
    }

    async createFolderCustomFieldId(token: string, folderId: string, taskId: string): Promise<string> {
        const customFieldDefinitionDto = this.customFieldDefinitionFactory.fakeCreateCustomFieldDefinition();
        const {body: response} = await this.post(`/custom-field-definition`, customFieldDefinitionDto, token);
        this.logger.log('/custom-field-definition response:', response);
        const customFieldId = response.identifiers[0].id;
        expect(customFieldId).toBeDefined();
        await this.post(`/task/custom-field/folder/${folderId}/task/${taskId}/`, {insert: [customFieldId], delete: []}, token).expect(
            HttpStatus.CREATED
        );
        return customFieldId.toString();
    }

    @Test('consumeTaskManagementEndpoints')
    async consumeTaskManagementEndpoints(): Promise<void> {
        this.logger.log('User is logging in and creating a folder and a task.');
        const token = await this.login();
        const taskAndFolder = await this.createFolderAndTask(token);
        const folderId = taskAndFolder.folder.id.toString();
        const taskId = taskAndFolder.task.id.toString();
        const tagId = await this.addTagToTask(token, folderId, taskId);
        const userId = this.getUserIdFromAccessToken(token);
        const folder2 = await this.createFolder(token);
        const folder2Id = folder2.id.toString();
        const stateId = folder2.workflow.states[0].id.toString();
        const customFieldId = await this.createFolderCustomFieldId(token, folderId, taskId);

        this.logger.log('===============================Adding comment==============================');
        {
            const result = await TaskManagementActionPerformer.addCommentToTask(token, folderId, taskId, 'comment text');
            this.logger.log('result: ', result);
            expect(result).not.toMatch(/AxiosError/);
        }

        this.logger.log('Setting importance');
        {
            const result = await TaskManagementActionPerformer.setTaskImportance(token, folderId, taskId, '1');
            this.logger.log('result: ', result);
            expect(result).not.toMatch(/AxiosError/);
        }

        {
            const result = await TaskManagementActionPerformer.addTaskTag(token, folderId, taskId, tagId);
            this.logger.log('result: ', result);
            expect(result).not.toMatch(/AxiosError/);
        }

        {
            const result = await TaskManagementActionPerformer.updateAssignees(token, folderId, taskId, [userId]);
            this.logger.log('result: ', result);
            expect(result).not.toMatch(/AxiosError/);
        }

        {
            const result = await TaskManagementActionPerformer.moveTask(token, folderId, taskId, folder2Id, stateId);
            this.logger.log('result: ', result);
            expect(result).not.toMatch(/AxiosError/);
        }

        {
            const result = await TaskManagementActionPerformer.setCustomFieldValue(
                token,
                folderId,
                taskId,
                customFieldId.toString(),
                'New Value'
            );
            this.logger.log('result: ', result);
            expect(result).not.toMatch(/AxiosError/);
        }

        {
            let result: boolean;
            try {
                const response = await this.post(TASK_MANAGEMENT_PATH_IS_TOKEN_VALID, {}, token);
                result = response.text == 'true';
                this.logger.log(`isTokenValid:`, response);
            } catch (error) {
                this.logger.error('error: ', error);
            }
            this.logger.log(`Endpoint "/users/is-token-valid" exists: ${result}`);
            expect(result).toBe(true);
        }
    }

    async createUserWithPermissions(permissions: PermissionsType): Promise<TestResponse> {
        this.logger.log(`Create user`);
        const fakeUser = await this.userFactory.createUserForLogin(permissions);
        return this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
    }

    private async createSpace(userId: string, accessToken: string, workflowIds: number[]): Promise<GetFolderDto> {
        const fakeCreateSpace = this.folderFactory.fakeCreateSpace({availableWorkflows: workflowIds});
        const {body: spaceResponse} = await this.post(`/space`, fakeCreateSpace, accessToken).expect(HttpStatus.CREATED);
        expect(spaceResponse).toBeDefined();
        return spaceResponse;
    }
}
