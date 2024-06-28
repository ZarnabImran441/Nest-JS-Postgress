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
import {TaskAttachmentFactory} from '../factory/task-attachment.factory';
import {TaskFactory} from '../factory/task.factory';
import {TeamFactory} from '../factory/team.factory';
import {PermissionsType, UserFactory} from '../factory/user.factory';
import {WorkflowFactory} from '../factory/workflow.factory';
import {NewBaseTest} from './base-test';

@TestSuite('Task Attachment Suite')
export class TaskAttachmentE2eSpec extends NewBaseTest implements OnModuleInit {
    private readonly logger = new Logger(TaskAttachmentE2eSpec.name);

    @Inject()
    private taskAttachmentFactory: TaskAttachmentFactory;
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
        this.setUrl('/task-attachment');
    }

    @Test('upload files')
    async uploadFiles(): Promise<void> {
        this.logger.log('create user and folder');
        const {folder, jwtToken} = await this.createFolder();
        this.logger.log('get user id');
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        const fakeTask = this.taskFactory.fakeCreateTask(userId, folder.id);
        this.logger.log('create task');
        const {body: task} = await this.post(`/task`, fakeTask, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(task.description).toBe(fakeTask.description);
        expect(task.title).toBe(fakeTask.title);
        expect(task.startDate).toBe(fakeTask.startDate.toISOString());
        const {body: folderTree} = await this.get(`/folder/folder-tree`, jwtToken.accessToken).expect(HttpStatus.OK);
        expect(folderTree[0].children[0]).toMatchObject({id: folder.id, title: folder.title});
        const fakeFiles = await this.taskAttachmentFactory.fakeFiles();
        this.logger.log('create task attachement');
        const {body: taskAttachment} = await this.post(
            `upload/${task.id}/folder/${folder.id}`,
            undefined,
            jwtToken.accessToken,
            fakeFiles
        ).expect(HttpStatus.CREATED);
        expect(taskAttachment).toHaveLength(fakeFiles.length);
        expect(taskAttachment[0].originalName).toBe(fakeFiles[0].path);
        expect(taskAttachment[0].fileNameUrl).toBeDefined();
        expect(taskAttachment[0].thumbnailUrl).toBeDefined();
    }

    @Test('should throw an error if no entry was found on delete')
    async errorOnDelete(): Promise<void> {
        this.logger.log('create user and folder');
        const {folder, jwtToken} = await this.createFolder();
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        const fakeTask = this.taskFactory.fakeCreateTask(userId, folder.id);
        this.logger.log('create task');
        const {body: task} = await this.post(`/task`, fakeTask, jwtToken.accessToken);
        expect(task.id).toBeDefined();
        this.logger.log('delete task attachment by invalid id');
        const fakeTaskAttachmentId = this.taskAttachmentFactory.fakeTaskAttachementId();
        await this.delete(`folder/${folder.id}/${fakeTaskAttachmentId}/task/${task.id}`, jwtToken.accessToken).expect(HttpStatus.NOT_FOUND);
    }

    @Test('find one task attachement')
    async findOneFile(): Promise<void> {
        this.logger.log('create user and folder');
        const {folder, jwtToken} = await this.createFolder();
        this.logger.log('get user id');
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        const fakeTask = this.taskFactory.fakeCreateTask(userId, folder.id);
        this.logger.log('create task');
        const {body: task} = await this.post(`/task`, fakeTask, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(task.description).toBe(fakeTask.description);
        expect(task.title).toBe(fakeTask.title);
        expect(task.startDate).toBe(fakeTask.startDate.toISOString());
        const {body: folderTree} = await this.get(`/folder/folder-tree`, jwtToken.accessToken).expect(HttpStatus.OK);
        expect(folderTree[0].children[0]).toMatchObject({id: folder.id, title: folder.title});
        const fakeFiles = await this.taskAttachmentFactory.fakeFiles();
        this.logger.log('create task attachement');
        await this.post(`upload/${task.id}/folder/${folder.id}`, undefined, jwtToken.accessToken, fakeFiles).expect(HttpStatus.CREATED);
        this.logger.log('find one task attachement');
        const {body: response} = await this.get(`folder/${folder.id}/task/${task.id}`, jwtToken.accessToken);
        expect(response).toHaveLength(1);
        expect(response[0].originalName).toBe(fakeFiles[0].path);
        expect(response[0].fileNameUrl).toBeDefined();
        expect(response[0].thumbnailUrl).toBeDefined();
    }

    @Test('delete task attachment by id')
    async deleteTaskAttachmentById(): Promise<void> {
        this.logger.log('create user and folder');
        const {folder, jwtToken} = await this.createFolder();
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        const fakeTask = this.taskFactory.fakeCreateTask(userId, folder.id);
        this.logger.log('create task');
        const {body: task} = await this.post(`/task`, fakeTask, jwtToken.accessToken);
        expect(task.id).toBeDefined();
        const fakeFiles = await this.taskAttachmentFactory.fakeFiles();
        const {body: taskAttachment} = await this.post(
            `upload/${task.id}/folder/${folder.id}`,
            undefined,
            jwtToken.accessToken,
            fakeFiles
        ).expect(HttpStatus.CREATED);
        expect(taskAttachment).toHaveLength(fakeFiles.length);
        expect(taskAttachment[0].originalName).toBe(fakeFiles[0].path);

        this.logger.log('find one task attachement');
        const {body: foundTaskAttachment} = await this.get(`folder/${folder.id}/task/${task.id}`, jwtToken.accessToken);
        expect(foundTaskAttachment).toHaveLength(1);
        expect(foundTaskAttachment[0].originalName).toBe(fakeFiles[0].path);
        this.logger.log('delete task attachment by id');
        await this.delete(`folder/${folder.id}/${taskAttachment[0].id}/task/${task.id}`, jwtToken.accessToken).expect(HttpStatus.OK);
        const {body: response} = await this.get(`folder/${folder.id}/task/${task.id}`, jwtToken.accessToken);
        this.logger.log('find the attachement again after deletion');
        expect(response).toHaveLength(0);
    }

    async createFolder(
        parentFolderId: number = null,
        jwtTokenParam: TokenInterface = null
    ): Promise<{
        folder: GetFolderDto;
        jwtToken: TokenInterface;
        workflowDB: WorkFlowEntity;
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
            });
            jwtToken = ret.body;
        }
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        this.logger.log('create workflow');
        const workflow: WorkFlowEntity = await this.createWorkflowForFolder(jwtToken.accessToken),
            fakeChangeWorkflow: ChangeWorkflowFolderDto = {
                commonWorkflow: workflow.id,
                type: ChangeWorkflowOptions.COMMON_TO_COMMON,
                Mapping: [],
                personaliseWorkflow: null,
            };
        const spaceResponse = await this.createSpace(userId, jwtToken.accessToken, [workflow.id]);
        this.logger.log('create folder');
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
        return {folder: f1, jwtToken, workflowDB: workflow, spaceId: spaceResponse.id};
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
