import {TASK_MANAGEMENT, TokenInterface} from '@lib/base-library';
import {HttpStatus, Inject, Logger, OnModuleInit} from '@nestjs/common';
import {TestAttachmentInterface} from '@test-lib/test-base-library';
import * as fs from 'fs';
import {Test, TestSuite} from 'nestjs-jest-decorators';
import {Test as TestResponse} from 'supertest';
import {ApprovalEntityResponseDto} from '../../src/dto/approval/approval-entity-response.dto';
import {ChangeWorkflowFolderDto, ChangeWorkflowOptions} from '../../src/dto/folder/folder/change-workflow.dto';
import {GenericMemberDto} from '../../src/dto/folder/folder/generic-member.dto';
import {GetFolderDto} from '../../src/dto/folder/folder/get-folder.dto';
import {ApprovalStatusOptions} from '../../src/enum/approval-status.enum';
import {UserPermissionOptions} from '../../src/enum/folder-user.enum';
import {DefaultViewOptions} from '../../src/enum/folder.enum';
import {WorkFlowEntity} from '../../src/model/workflow.entity';
import {PermissionOptions} from '../../src/module/authorization-impl/authorization.enum';
import {ApprovalFactory} from '../factory/approval.factory';
import {FolderFactory} from '../factory/folder.factory';
import {TaskFactory} from '../factory/task.factory';
import {PermissionsType, UserFactory} from '../factory/user.factory';
import {WorkflowFactory} from '../factory/workflow.factory';
import {NewBaseTest} from './base-test';

@TestSuite('Approval Test Suite')
export class ApprovalE2eSpec extends NewBaseTest implements OnModuleInit {
    private readonly logger = new Logger(ApprovalE2eSpec.name);

    @Inject()
    private readonly approvalsFactory: ApprovalFactory;

    @Inject()
    private readonly taskFactory: TaskFactory;

    @Inject()
    private readonly folderFactory: FolderFactory;

    @Inject()
    private readonly workflowFactory: WorkflowFactory;

    @Inject()
    private readonly userFactory: UserFactory;

    onModuleInit(): void {
        super.setUrl('/approvals');
    }

    /**
     * Updates the assignee list for a task.
     *
     * @return {Promise<void>} Promise that resolves once the assignee update is complete.
     */

    @Test('Create an approval')
    async createApproval(): Promise<void> {
        this.logger.log('create user and folder');
        const {folder, jwtToken} = await this.createFolder();
        this.logger.log('get user id');
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        this.logger.log('create task');
        const fakeApprovalAndTask = this.approvalsFactory.fakeCreateApproval([userId], this.taskFactory.fakeCreateTask(userId, folder.id));
        const {body: createdResponse} = await this.post(`folder/${folder.id}`, fakeApprovalAndTask, jwtToken.accessToken).expect(
            HttpStatus.CREATED
        );
        expect(createdResponse).toBeDefined();
        expect(createdResponse.assignedApprovers[0]).toBe(userId);
        expect(createdResponse.task.title).toBe(fakeApprovalAndTask.createTaskDto.title);
        expect(createdResponse.task.description).toBe(fakeApprovalAndTask.createTaskDto.description);
    }

    @Test('create and get approval for a task')
    async createApprovalForTask(): Promise<{
        folderId: number;
        taskId: number;
        approval: ApprovalEntityResponseDto;
        userId: string;
        jwtToken: TokenInterface;
    }> {
        this.logger.log('create user and folder');
        const {folder, jwtToken} = await this.createFolder();
        this.logger.log('get user id');
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        this.logger.log('create task');
        const fakeTask = this.taskFactory.fakeCreateTask(userId, folder.id);
        const {body: task} = await this.post(`/task`, fakeTask, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(task.description).toBe(fakeTask.description);
        expect(task.title).toBe(fakeTask.title);
        const addApprovalToTaskDto = this.approvalsFactory.fakeCreateAddApprovalToTaskDto([userId]);
        const {body: createdApproval} = await this.post(
            `task/${task.id}/folder/${folder.id}`,
            addApprovalToTaskDto,
            jwtToken.accessToken
        ).expect(HttpStatus.CREATED);
        expect(createdApproval.taskId).toBe(task.id);
        expect(createdApproval.assignedApprovers[0]).toBe(userId);
        this.logger.log('Get approvals by task id');
        const {body: approvalsResponse} = await this.get(`folder/${folder.id}/task/${task.id}`, jwtToken.accessToken);
        const createdApprovalResponse = approvalsResponse.find((el) => el.id === createdApproval.id);
        expect(createdApprovalResponse).toBeDefined();

        return {folderId: folder.id, taskId: task.id, approval: createdApproval, userId, jwtToken};
    }

    @Test('Get approvals created by user')
    async getLoggedInUserApprovals(): Promise<void> {
        const {jwtToken, approval, userId} = await this.createApprovalForTask();

        this.logger.log('get approvals for current user');
        const {body: userApprovals} = await this.get('user', jwtToken.accessToken).expect(HttpStatus.OK);
        expect(userApprovals.length).toBeGreaterThan(0);
        expect(approval.id).toBe(userApprovals[0].id);
        expect(userApprovals[0].createdBy).toBe(userId);
    }

    @Test('Get approvals assigned to the logged user')
    async getAssignedApprovals(): Promise<void> {
        const {jwtToken, approval, userId} = await this.createApprovalForTask();

        this.logger.log('get assigned approvals');
        const {body: assignedApprovals} = await this.get(`assigned`, jwtToken.accessToken).expect(HttpStatus.OK);
        expect(assignedApprovals.length).toBeGreaterThan(0);
        expect(approval.id).toBe(assignedApprovals[0].id);
        expect(assignedApprovals[0].assignedApprovers[0]).toBe(userId);
    }

    @Test('Approves an approval')
    async approveApprovals(): Promise<void> {
        const {jwtToken, approval} = await this.createApprovalForTask();
        this.logger.log('approve an approval');
        const fakeCommentApprovalDto = this.approvalsFactory.fakeCommentApprovalDto();
        const {body: approvedResponse} = await this.post(`approve/${approval.id}`, fakeCommentApprovalDto, jwtToken.accessToken);
        expect(approvedResponse.status).toBe(ApprovalStatusOptions.APPROVED);
    }

    @Test('Reject an approval')
    async rejectApprovals(): Promise<void> {
        const {jwtToken, approval} = await this.createApprovalForTask();

        this.logger.log('reject an approval');
        const fakeCommentApprovalDto = this.approvalsFactory.fakeCommentApprovalDto();
        const {body: rejectedResponse} = await this.post(`reject/${approval.id}`, fakeCommentApprovalDto, jwtToken.accessToken);
        expect(rejectedResponse.status).toBe(ApprovalStatusOptions.REJECTED);
    }

    @Test('Retrieves the approval history for a given approval ID')
    async getApprovalHistory(): Promise<void> {
        const {jwtToken, approval} = await this.createApprovalForTask();

        this.logger.log('approve an approval');
        const fakeCommentApprovalDto = this.approvalsFactory.fakeCommentApprovalDto();
        const {body: approvedResponse} = await this.post(`approve/${approval.id}`, fakeCommentApprovalDto, jwtToken.accessToken);
        expect(approvedResponse.status).toBe(ApprovalStatusOptions.APPROVED);

        this.logger.log('retrives approval history');
        const {body: historyResponse} = await this.get(`history/${approval.id}`, jwtToken.accessToken);
        expect(historyResponse[0].approval.status).toBe(ApprovalStatusOptions.APPROVED);
        expect(historyResponse[0].approval.id).toBe(approval.id);
    }

    @Test('Delete an  approval')
    async DeleteApproval(): Promise<void> {
        const {jwtToken, approval, folderId, taskId} = await this.createApprovalForTask();

        this.logger.log('delete approval');
        await this.delete(`${approval.id}`, jwtToken.accessToken).expect(HttpStatus.OK);

        this.logger.log('Get approvals by task id');
        const {body: approvalsResponse} = await this.get(`folder/${folderId}/task/${taskId}`, jwtToken.accessToken);
        expect(approvalsResponse.length).toBe(0);
    }

    @Test('upload attachement to approval')
    async uploadAttachment(): Promise<void> {
        const {jwtToken, approval} = await this.createApprovalForTask();

        const buffer = await fs.promises.readFile('./apps/task-management/test-e2e/factory/testFile/test.gif');
        const files: TestAttachmentInterface[] = [{name: 'files', buffer: buffer, path: 'test.gif'}];

        this.logger.log('upload attachement in approval');
        const {body: uploadResponse} = await this.post(`upload/${approval.id}`, undefined, jwtToken.accessToken, files).expect(
            HttpStatus.CREATED
        );
        expect(uploadResponse[0].originalName).toBe(files[0].path);
    }

    @Test('update an approval')
    async updateApproval(): Promise<void> {
        const {approval, jwtToken} = await this.createApprovalForTask();

        this.logger.log('update an approval');
        const fakeUpdateApprovalDto = this.approvalsFactory.fakeUpdateApprovalDto();
        const {body: updatedResponse} = await this.put(`${approval.id}`, fakeUpdateApprovalDto, jwtToken.accessToken).expect(HttpStatus.OK);
        expect(updatedResponse).toBeDefined();
        expect(updatedResponse.description).toBe(fakeUpdateApprovalDto.description);
    }

    @Test('Route approval to other user')
    async RouteApprovalToUser(): Promise<void> {
        this.logger.log('create users');
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
            approval: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        const {body: jwtToken2} = await this.createUserWithPermissions({
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
            approval: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        this.logger.log('get user id');
        const userId1 = this.getUserIdFromAccessToken(jwtToken1.accessToken);
        const userId2 = this.getUserIdFromAccessToken(jwtToken2.accessToken);

        this.logger.log('create workflow');
        const workflow: WorkFlowEntity = await this.createWorkflowForFolder(jwtToken1.accessToken);

        const fakeChangeWorkflow: ChangeWorkflowFolderDto = {
            commonWorkflow: workflow.id,
            type: ChangeWorkflowOptions.COMMON_TO_COMMON,
            Mapping: [],
            personaliseWorkflow: null,
        };
        this.logger.log('create space');
        const spaceResponse = await this.createSpace(
            jwtToken1.accessToken,
            [workflow.id],
            [{id: userId2, userPermission: UserPermissionOptions.EDITOR}]
        );
        this.logger.log('create Folder');
        const fakeFolder = this.folderFactory.fakeCreateFolderWithMember(
            fakeChangeWorkflow,
            null,
            DefaultViewOptions.BOARD,
            [TASK_MANAGEMENT],
            [{id: userId2, userPermission: UserPermissionOptions.EDITOR}],
            spaceResponse.id
        );

        const {body: f1} = await this.post(`/folder`, fakeFolder, jwtToken1.accessToken).expect(HttpStatus.CREATED);
        expect(f1).toBeDefined();

        this.logger.log('create task');
        const fakeTask = this.taskFactory.fakeCreateTask(userId1, f1.id);
        const {body: task} = await this.post(`/task`, fakeTask, jwtToken1.accessToken).expect(HttpStatus.CREATED);
        expect(task.description).toBe(fakeTask.description);
        expect(task.title).toBe(fakeTask.title);

        this.logger.log('create approvals');
        const addApprovalToTaskDto = this.approvalsFactory.fakeCreateAddApprovalToTaskDto([userId1]);
        const {body: createdApproval} = await this.post(
            `task/${task.id}/folder/${f1.id}`,
            addApprovalToTaskDto,
            jwtToken1.accessToken
        ).expect(HttpStatus.CREATED);
        expect(createdApproval.taskId).toBe(task.id);
        expect(createdApproval.assignedApprovers[0]).toBe(userId1);

        this.logger.log('route approval to other user');
        const fakeRouteToUsersDto = this.approvalsFactory.fakeRouteToUsersDto([userId2]);
        const {body: updatedResponse} = await this.post(
            `redirect/${createdApproval.id}`,
            fakeRouteToUsersDto,
            jwtToken1.accessToken
        ).expect(HttpStatus.CREATED);
        expect(updatedResponse.assignedApprovers[0]).toBe(userId1);
        expect(updatedResponse.assignedApprovers[1]).toBe(userId2);

        this.logger.log('cancel an approval');
        const {body: response} = await this.put(`cancel/${createdApproval.id}`, {}, jwtToken1.accessToken).expect(HttpStatus.OK);
        expect(response.status).toBe(ApprovalStatusOptions.PENDING);
    }

    /**
     * Creates a folder asynchronously.
     *
     * @param {number} [parentFolderId] - The ID of the parent folder. If not provided, the folder will be created in the root folder.
     * @param {TokenInterface} [jwtTokenParam] - The JWT token used to authenticate the user. If not provided, a new user will be created and logged in.
     * @param {number} [workflowId] - The ID of the workflow for the folder. If not provided, a new workflow will be created.
     * @param {number} [spaceId] - The ID of the space for the folder. If not provided, a new space will be created.
     *
     * @returns {Promise} A Promise that resolves to an object containing the created folder, the JWT token, the workflow ID, and the space ID.
     */
    async createFolder(
        parentFolderId: number = null,
        jwtTokenParam: TokenInterface = null,
        workflowId: number = null,
        spaceId: number = null
    ): Promise<{
        folder: GetFolderDto;
        jwtToken: TokenInterface;
        workflowDB: {id: number};
        spaceId: number;
    }> {
        let jwtToken = jwtTokenParam;

        if (jwtToken === null) {
            this.logger.log('create user and login');
            const ret = await this.createUserWithPermissions({
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
                approval: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            });
            jwtToken = ret.body;
        }
        this.logger.log('create workflow');
        if (workflowId === null) {
            const workflow: WorkFlowEntity = await this.createWorkflowForFolder(jwtToken.accessToken);
            workflowId = workflow.id;
        }

        const fakeChangeWorkflow: ChangeWorkflowFolderDto = {
            commonWorkflow: workflowId,
            type: ChangeWorkflowOptions.COMMON_TO_COMMON,
            Mapping: [],
            personaliseWorkflow: null,
        };
        if (spaceId === null) {
            const spaceResponse = await this.createSpace(jwtToken.accessToken, [workflowId]);
            spaceId = spaceResponse.id;
        }

        this.logger.log('create folder');
        const fakeFolder = this.folderFactory.fakeCreateFolder(
            fakeChangeWorkflow,
            parentFolderId,
            DefaultViewOptions.BOARD,
            [TASK_MANAGEMENT],
            spaceId
        );

        const {body: f1} = await this.post(`/folder`, fakeFolder, jwtToken.accessToken).expect(HttpStatus.CREATED);

        expect(f1).toBeDefined();
        //todo : validate and match response and dto
        const {body: f1DB} = await this.get(`/folder/${f1.id}`, jwtToken.accessToken).expect(HttpStatus.OK);

        // .expect(HttpStatus.OK);
        expect(f1DB.id).toEqual(f1.id);
        return {folder: f1, jwtToken, workflowDB: {id: workflowId}, spaceId};
    }

    // /**
    //  * Creates a workflow for a given folder.
    //  *
    //  * @param {string} token - The token used for authentication.
    //  *
    //  * @returns {Promise<WorkFlowEntity>} - A promise that resolves with the created workflow entity.
    //  */
    /**
     * Creates a workflow for a given folder.
     *
     * @param {string} token - The access token for authentication.
     * @return {Promise<WorkFlowEntity>} - The created workflow entity.
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

    // /**
    //  * Creates a user with the given permissions.
    //  *
    //  * @param {PermissionsType} permissions - The permissions for the new user.
    //  * @return {Promise<TestResponse>} A Promise that resolves to the response from the API call.
    //  */
    /**
     * Creates a user with the given permissions.
     * @param {PermissionsType} permissions - The permissions assigned to the user.
     * @returns {Promise<TestResponse>} - The response object containing the result of the operation.
     */

    private async createUserWithPermissions(permissions: PermissionsType): Promise<TestResponse> {
        this.logger.log(`Create user`);
        const fakeUser = await this.userFactory.createUserForLogin(permissions);
        return this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
    }

    /**
     * Creates a new space with the given parameters.
     *
     * @param {string} accessToken - The access token for authentication.
     * @param {number[]} workflowIds - An array of workflow IDs available for the space.
     * @param {GenericMemberDto[]} [members] - An optional array of member objects for the space. Default is undefined.
     *
     * @return {Promise<GetFolderDto>} - A Promise that resolves with the newly created space response object.
     */
    private async createSpace(accessToken: string, workflowIds: number[], members?: GenericMemberDto[]): Promise<GetFolderDto> {
        const fakeCreateSpace = this.folderFactory.fakeCreateSpace({
            availableWorkflows: workflowIds,
            members,
        });
        const {body: spaceResponse} = await this.post(`/space`, fakeCreateSpace, accessToken).expect(HttpStatus.CREATED);
        expect(spaceResponse).toBeDefined();
        return spaceResponse;
    }
}
