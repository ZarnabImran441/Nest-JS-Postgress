import '@jest-decorated/core/globals';
import {TASK_MANAGEMENT} from '@lib/base-library';
import {HttpStatus, Inject, Logger, OnModuleInit} from '@nestjs/common';
import {Test, TestSuite} from 'nestjs-jest-decorators';
import {ChangeWorkflowFolderDto, ChangeWorkflowOptions} from '../../src/dto/folder/folder/change-workflow.dto';
import {GetFolderDto} from '../../src/dto/folder/folder/get-folder.dto';
import {MapWorkflowStateDto, UpdateWorkflowDto} from '../../src/dto/workflow/update-workflow.dto';
import {WorkFlowResponseDto} from '../../src/dto/workflow/workflow-response.dto';
import {UserPermissionOptions} from '../../src/enum/folder-user.enum';
import {DefaultViewOptions} from '../../src/enum/folder.enum';
import {WorkFlowEntity} from '../../src/model/workflow.entity';
import {EntityTypeOptions, PermissionOptions} from '../../src/module/authorization-impl/authorization.enum';
import {FolderFactory} from '../factory/folder.factory';
import {UserFactory} from '../factory/user.factory';
import {WorkflowFactory} from '../factory/workflow.factory';
import {NewBaseTest} from './base-test';
import {CustomFieldCollectionFactory, TeamFactory} from '../factory';
import {CustomFieldFactory} from '../factory/custom-field.factory';

@TestSuite('Workflow Suite')
export class WorkflowE2eSpec extends NewBaseTest implements OnModuleInit {
    private readonly logger = new Logger(WorkflowE2eSpec.name);

    @Inject()
    private userFactory: UserFactory;
    @Inject()
    private workflowFactory: WorkflowFactory;
    @Inject()
    private folderFactory: FolderFactory;
    @Inject()
    private teamFactory: TeamFactory;

    private customFieldDefinitionFactory: CustomFieldFactory = new CustomFieldFactory();
    private customFieldCollectionFactory: CustomFieldCollectionFactory = new CustomFieldCollectionFactory();

    onModuleInit(): void {
        this.setUrl('/workflow');
    }

    @Test('Create Workflow')
    async createWorkflow(): Promise<void> {
        this.logger.log(`Create user`);
        const fakeUser = await this.userFactory.createUserForLogin({
            [EntityTypeOptions.Workflow]: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            [EntityTypeOptions.DisplacementGroup]: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });

        this.logger.log(`do login`);
        let response = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        const jwtToken = response.body;
        this.logger.log(`create workflow`);
        const {body: systemStages} = await this.get(`/displacement-group/system-stage`, jwtToken.accessToken);
        const fakeWorkflow = new WorkflowFactory().fakeCreateWorkflow(systemStages[0]?.id);
        response = await this.post(``, fakeWorkflow, jwtToken.accessToken);
        expect(response.status).toBe(HttpStatus.CREATED);
        this.logger.log(`check workflow exists`);
        response = await this.get(`${response.body.id}`, jwtToken.accessToken);
        expect(response.status).toBe(HttpStatus.OK);
        this.expectWorkflowToMatchWorkflow(response.body, fakeWorkflow as UpdateWorkflowDto);
    }

    @Test('Update Workflow')
    async updateWorkflow(): Promise<void> {
        this.logger.log(`Create user`);
        const fakeUser = await this.userFactory.createUserForLogin({
            workflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            displacementGroup: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });

        this.logger.log(`do login`);
        const {body: jwtToken} = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        this.logger.log(`create workflow`);
        const {body: systemStages} = await this.get(`/displacement-group/system-stage`, jwtToken.accessToken),
            fakeWorkflow = new WorkflowFactory().fakeCreateWorkflow(systemStages[0]?.id);
        const {body: w1} = await this.post(``, fakeWorkflow, jwtToken.accessToken).expect(HttpStatus.CREATED);
        this.logger.log(`check workflow exists`);
        const {body: wbDB} = await this.get(`${w1.id}`, jwtToken.accessToken).expect(HttpStatus.OK);
        this.expectWorkflowToMatchWorkflow(wbDB, fakeWorkflow as UpdateWorkflowDto);
        this.logger.log(`Update workflow`);
        const createdWorkflow: WorkFlowResponseDto = wbDB;
        const updatedWorkflow = new WorkflowFactory().fakeUpdateWorkflow(createdWorkflow, systemStages[0]?.id);
        const {body: wf3} = await this.patch(`${createdWorkflow.id}`, updatedWorkflow, jwtToken.accessToken).expect(HttpStatus.OK);
        expect(wf3).toBeDefined();
        this.logger.log(`check workflow exists`);
        await this.get(`${createdWorkflow.id}`, jwtToken.accessToken).expect(HttpStatus.OK);
    }

    @Test('Delete Workflow')
    async deleteWorkflow(): Promise<void> {
        this.logger.log(`Create user`);
        const fakeUser = await this.userFactory.createUserForLogin({
            workflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            displacementGroup: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });

        this.logger.log(`do login`);
        let response = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        const jwtToken = response.body;
        const {body: systemStages} = await this.get(`/displacement-group/system-stage`, jwtToken.accessToken),
            fakeWorkflow = new WorkflowFactory().fakeCreateWorkflow(systemStages[0]?.id);
        this.logger.log(`create workflow`);
        response = await this.post(``, fakeWorkflow, jwtToken.accessToken);
        expect(response.status).toBe(HttpStatus.CREATED);
        this.logger.log(`check workflow exists`);
        response = await this.get(`${response.body.id}`, jwtToken.accessToken);
        expect(response.status).toBe(HttpStatus.OK);
        this.expectWorkflowToMatchWorkflow(response.body, fakeWorkflow as UpdateWorkflowDto);
        this.logger.log(`delete workflow`);
        const createdWorkflow = response.body;
        response = await this.delete(`${createdWorkflow.id}`, jwtToken.accessToken);
        expect(response.status).toBe(HttpStatus.OK);
        this.logger.log(`check workflow exists`);
        response = await this.get(`${createdWorkflow.id}`, jwtToken.accessToken);
        expect(response.status).toBe(HttpStatus.NOT_FOUND);
    }

    @Test('Get Workflows')
    async getWorkflows(): Promise<void> {
        this.logger.log(`Create user`);
        const fakeUser = await this.userFactory.createUserForLogin({
            workflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            displacementGroup: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        this.logger.log(`do login`);
        let response = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        const jwtToken = response.body;
        const {body: systemStages} = await this.get(`/displacement-group/system-stage`, jwtToken.accessToken),
            fakeWorkflow = new WorkflowFactory().fakeCreateWorkflow(systemStages[0]?.id);
        this.logger.log(`create workflow`);
        const response1 = await this.post(``, fakeWorkflow, jwtToken.accessToken);
        expect(response1.status).toBe(HttpStatus.CREATED);
        const workflowResponse = await this.get(`${response1.body.id}`, jwtToken.accessToken);
        expect(workflowResponse.status).toBe(HttpStatus.OK);
        this.expectWorkflowToMatchWorkflow(workflowResponse.body, fakeWorkflow as UpdateWorkflowDto);
        this.logger.log(`check workflow exists`);
        response = await this.get(``, jwtToken.accessToken);
        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body.length).toBeGreaterThan(0);
    }

    /**
     * Update Workflow with copies
     */
    @Test('Update Workflow With Copies')
    async updateWorkflowWithCopies(): Promise<void> {
        const fakeUser = await this.userFactory.createUserForLogin({
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
        const {body: jwtToken} = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        this.logger.log('create workflow');
        const {body: systemStages} = await this.get(`/displacement-group/system-stage`, jwtToken.accessToken),
            fakeWorkflow = new WorkflowFactory().fakeCreateWorkflow(systemStages[0]?.id);
        const {body: workflowDB} = await this.post(`/workflow`, fakeWorkflow, jwtToken.accessToken).expect(HttpStatus.CREATED),
            fakeChangeWorkflow: ChangeWorkflowFolderDto = {
                commonWorkflow: workflowDB.id,
                type: ChangeWorkflowOptions.COMMON_TO_COMMON,
                Mapping: [],
                personaliseWorkflow: null,
            };
        this.logger.log(`check workflow exists`);
        const response1 = await this.get(`${workflowDB.id}`, jwtToken.accessToken);
        expect(response1.status).toBe(HttpStatus.OK);
        this.expectWorkflowToMatchWorkflow(response1.body, fakeWorkflow as UpdateWorkflowDto);
        this.logger.log('create a space');
        const spaceResponse = await this.createSpace(userId, jwtToken.accessToken, [workflowDB.id]);
        this.logger.log('create folder');
        const fakeFolder = this.folderFactory.fakeCreateFolder(
            fakeChangeWorkflow,
            null,
            DefaultViewOptions.BOARD,
            [TASK_MANAGEMENT],
            spaceResponse.id
        );
        const {body: f1} = await this.post(`/folder`, fakeFolder, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(f1).toBeDefined();
        const {body: workflowResponseDto} = await this.get(`${workflowDB.id}`, jwtToken.accessToken).expect(HttpStatus.OK);

        //4 - update template workflow
        const updateWorkflowDto = this.workflowFactory.fakeUpdateWorkflowWithModifications(workflowDB, systemStages[0]?.id);
        updateWorkflowDto.Mapping = [new MapWorkflowStateDto()];
        updateWorkflowDto.Mapping[0].DestinationWorkflowStateCode = workflowResponseDto.states[0].code;
        updateWorkflowDto.Mapping[0].SourceWorkflowStateCode = workflowResponseDto.states[0].code;
        this.logger.log('updateWorkflowDto', updateWorkflowDto);
        // const {body: ret} = await this.patch(`${workflowDB.id}`, updateWorkflowDto, jwtToken.accessToken).expect(HttpStatus.OK);
        const ret2 = await this.patch(`${workflowDB.id}`, updateWorkflowDto, jwtToken.accessToken);
        expect(ret2.status).toBe(HttpStatus.OK);
        const {body: ret} = ret2;
        expect(ret.affected).toEqual(1);

        // 5 - Test that with template workflow folder workflows are also updates
        // 5.1: Template workflow is updated
        const {body: workflowCopy} = await this.get(`${workflowDB.id}`, jwtToken.accessToken).expect(HttpStatus.OK);
        expect({id: workflowCopy.id, title: workflowDB.title}).toEqual({
            id: workflowDB.id,
            title: updateWorkflowDto.title,
        });

        //5.2
        //Test that the folder workflow is also updated or not
        const {body: folderWorkflowDB} = await this.post('/folder-workflow/project', [f1.id], jwtToken.accessToken);

        expect(folderWorkflowDB.length).toBeGreaterThan(0);
        expect(folderWorkflowDB[0].id).toEqual(workflowDB.id);
    }

    /**
     * Delete Workflow Assigned To a Folder - It must fail.
     */
    @Test('Delete Workflow Assigned To a Folder - It must fail')
    async deleteWorkflowAssignedToFolderMustFail(): Promise<void> {
        const fakeUser = await this.userFactory.createUserForLogin({
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
        const {body: jwtToken} = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        this.logger.log('create workflow');
        const {body: systemStages} = await this.get(`/displacement-group/system-stage`, jwtToken.accessToken),
            fakeWorkflow = new WorkflowFactory().fakeCreateWorkflow(systemStages[0]?.id);
        const {body: workflowDB} = await this.post(`/workflow`, fakeWorkflow, jwtToken.accessToken),
            fakeChangeWorkflow: ChangeWorkflowFolderDto = {
                commonWorkflow: workflowDB.id,
                type: ChangeWorkflowOptions.COMMON_TO_COMMON,
                Mapping: [],
                personaliseWorkflow: null,
            };
        this.logger.log(`check workflow exists`);
        const response1 = await this.get(`${workflowDB.id}`, jwtToken.accessToken);
        expect(response1.status).toBe(HttpStatus.OK);
        this.expectWorkflowToMatchWorkflow(response1.body, fakeWorkflow as UpdateWorkflowDto);
        this.logger.log('create a space');
        const spaceResponse = await this.createSpace(userId, jwtToken.accessToken, [workflowDB.id]);

        this.logger.log('create folder');
        const fakeFolder = this.folderFactory.fakeCreateFolder(
            fakeChangeWorkflow,
            null,
            DefaultViewOptions.BOARD,
            [TASK_MANAGEMENT],
            spaceResponse.id
        );
        const {body: f1} = await this.post(`/folder`, fakeFolder, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(f1).toBeDefined();
        //throw error
        await this.delete(`${workflowDB.id}`, jwtToken.accessToken).expect(HttpStatus.BAD_REQUEST);
    }

    /**
     * Update Workflow without Mappings
     */
    @Test('Update Workflow Without Mappings')
    async updateWorkflowWithoutMappings(): Promise<void> {
        const fakeUser = await this.userFactory.createUserForLogin({
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
        const {body: jwtToken} = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        //create a workflow
        const {body: systemStages} = await this.get(`/displacement-group/system-stage`, jwtToken.accessToken),
            workflowDto = new WorkflowFactory().fakeCreateWorkflow(systemStages[0]?.id);
        const {body: workflow} = await this.post(``, workflowDto, jwtToken.accessToken);
        this.logger.log(`check workflow exists`);
        const response1 = await this.get(`${workflow.id}`, jwtToken.accessToken);
        expect(response1.status).toBe(HttpStatus.OK);
        this.expectWorkflowToMatchWorkflow(response1.body, workflowDto as UpdateWorkflowDto);
        const changeWorkflowFolderDto: ChangeWorkflowFolderDto = this.workflowFactory.fakeChangeWorkflowDto(workflow, []);
        changeWorkflowFolderDto.Mapping = null;

        const spaceResponse = await this.createSpace(userId, jwtToken.accessToken, [workflow.id]);

        //assigned the workflow to a folder and create a folder
        const folderDto1 = this.folderFactory.fakeCreateFolder(
            changeWorkflowFolderDto,
            null,
            DefaultViewOptions.BOARD,
            [TASK_MANAGEMENT],
            spaceResponse.id
        );
        await this.post(`/folder`, folderDto1, jwtToken.accessToken);

        const updateWorkflowDto = this.workflowFactory.fakeUpdateWorkflowWithModifications(workflow, systemStages[0]?.id);
        updateWorkflowDto.Mapping = null;
        await this.patch(`${workflow.id}`, updateWorkflowDto, jwtToken.accessToken);
    }

    /**
     * Update Workflow with an invalid id - It must fail.
     */
    @Test('Update Workflow With Invalid Id - It must fail')
    async updateWorkflowInvalidMustFail(): Promise<void> {
        try {
            const fakeUser = await this.userFactory.createUserForLogin({
                workflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            });
            const {body: jwtToken} = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
            const updateWorkflowDto = this.workflowFactory.fakeUpdateWorkflowWithModifications(new WorkFlowEntity());
            await this.patch(`-1`, updateWorkflowDto, jwtToken.accessToken).expect(HttpStatus.NOT_FOUND);
        } catch (e: unknown) {
            this.logger.error('updateWorkflowInvalidMustFail', e);
        }
    }

    /**
     * Create a Workflow with an empty Dto. It must fail.
     */
    @Test('Create Workflow With Empty Dto - It must fail')
    async createWorkflowToFail(): Promise<void> {
        try {
            const fakeUser = await this.userFactory.createUserForLogin({
                workflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            });
            const {body: jwtToken} = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
            const {body: systemStages} = await this.get(`/displacement-group/system-stage`, jwtToken.accessToken),
                workflowDto = new WorkflowFactory().fakeCreateWorkflow(systemStages[0]?.id);
            expect(await this.post(``, workflowDto, jwtToken.accessToken));
        } catch (error: unknown) {
            this.logger.error(error);
        }
    }

    @Test('Create Common Workflow From Personalise')
    async createCommonWorkflowFromPersonalise(): Promise<void> {
        // Create a workflow and get its details
        const fakeUser = await this.userFactory.createUserForLogin({
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
        const {body: jwtToken} = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        const {body: systemStages} = await this.get(`/displacement-group/system-stage`, jwtToken.accessToken),
            workflowDto = new WorkflowFactory().fakeCreateWorkflow(systemStages[0]?.id);
        const {body: createdWorkflow} = await this.post(`personal`, workflowDto, jwtToken.accessToken).expect(HttpStatus.CREATED);
        const {body: workflowDB} = await this.get(`${createdWorkflow.id}`, jwtToken.accessToken).expect(HttpStatus.OK);
        this.expectWorkflowToMatchWorkflow(workflowDB, workflowDto as UpdateWorkflowDto);
        expect(workflowDB).toBeDefined();
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        const spaceResponse = await this.createSpace(userId, jwtToken.accessToken, [workflowDB.id]);

        // Prepare fake data for changing workflow
        const fakeChangeWorkflow: ChangeWorkflowFolderDto = {
            commonWorkflow: null,
            type: ChangeWorkflowOptions.COMMON_TO_PERSONALISE,
            Mapping: [],
            personaliseWorkflow: workflowDB.id,
        };

        // Create a folder with the fake data
        const fakeFolder = this.folderFactory.fakeCreateFolder(
            fakeChangeWorkflow,
            null,
            DefaultViewOptions.BOARD,
            [TASK_MANAGEMENT],
            spaceResponse.id
        );
        const {body: folderDB} = await this.post('/folder', fakeFolder, jwtToken.accessToken);
        expect(folderDB).toBeDefined();

        // Check if a Workflow is assigned to the folder or not
        const {body: folderWorkflowDB} = await this.post('/folder-workflow/project', [folderDB.id], jwtToken.accessToken);
        expect(folderWorkflowDB).toBeDefined();
        expect(folderWorkflowDB.length).toBeGreaterThanOrEqual(1);

        // Convert the personalize workflow to commonWorkflow and validate the properties
        const {body: commonWorkflow} = await this.post(`/convert-workflow/${folderWorkflowDB[0].id}`, jwtToken.accessToken);

        // Check if the new common workflow exists in the database and matches the main properties
        const {body: commonWorkflowDB} = await this.get(`${commonWorkflow.id}`, jwtToken.accessToken);
        expect(commonWorkflow.id).toEqual(commonWorkflowDB.id);
    }

    /**
     * Get One Workflow
     */
    @Test('Get One Workflow')
    async getOne(): Promise<void> {
        const fakeUser = await this.userFactory.createUserForLogin({
            workflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            folder: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            displacementGroup: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        const {body: jwtToken} = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        const {body: systemStages} = await this.get(`/displacement-group/system-stage`, jwtToken.accessToken),
            workflowDto = new WorkflowFactory().fakeCreateWorkflow(systemStages[0]?.id);
        const {body: workflow1} = await this.post(``, workflowDto, jwtToken.accessToken);
        const {body: workflow2} = await this.get(`${workflow1.id}`, jwtToken.accessToken);
        expect(workflow2).toBeDefined();
        this.expectWorkflowToMatchWorkflow(workflow2, workflowDto as UpdateWorkflowDto);
    }

    /**
     * Get Many Workflows
     */
    @Test('Get Many Workflows')
    async getMany(): Promise<void> {
        const fakeUser = await this.userFactory.createUserForLogin({
            workflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            folder: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            displacementGroup: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        const {body: jwtToken} = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        const {body: systemStages} = await this.get(`/displacement-group/system-stage`, jwtToken.accessToken);
        const commonWorkflowDto = this.workflowFactory.fakeCreateWorkflow(systemStages[0]?.id);
        const personalWorkflowDto = this.workflowFactory.fakeCreateWorkflow(systemStages[0]?.id);
        const {body: commonWorkflow} = await this.post(``, commonWorkflowDto, jwtToken.accessToken);
        expect(commonWorkflow.title).toBe(commonWorkflowDto.title);
        const {body: personalWorkflow} = await this.post(`personal`, personalWorkflowDto, jwtToken.accessToken);
        expect(personalWorkflow.title).toBe(personalWorkflow.title);
        expect(personalWorkflow.userId).toBeDefined();
        this.logger.log(`check workflow exists`);
        const response1 = await this.get(`${commonWorkflow.id}`, jwtToken.accessToken);
        expect(response1.status).toBe(HttpStatus.OK);
        this.expectWorkflowToMatchWorkflow(response1.body, commonWorkflowDto as UpdateWorkflowDto);
        const {body: manyWorkflows} = await this.get(``, jwtToken.accessToken);
        expect(manyWorkflows.length).toBeGreaterThanOrEqual(2);

        const workflow1 = manyWorkflows.find((w) => w.id === commonWorkflow.id);
        expect(workflow1.title).toBe(commonWorkflow.title);
        const workflow2 = manyWorkflows.find((w) => w.id === personalWorkflow.id);
        expect(workflow2.title).toBe(personalWorkflow.title);
        expect(workflow2.userId).toBe(personalWorkflow.userId);
    }

    @Test('Check For System Stages')
    async CheckForSystemStages(): Promise<void> {
        const fakeUser = await this.userFactory.createUserForLogin({
            workflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            folder: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            displacementGroup: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        const {body: jwtToken} = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        const {body: systemStages} = await this.get(`/displacement-group/system-stage`, jwtToken.accessToken).expect(HttpStatus.OK);
        expect(systemStages).toBeDefined();
        const expectedStagesCodes = ['Active', 'Completed', 'Canceled', 'Deferred'];
        const stageCodes = systemStages.map((stage) => stage.code);
        expect(stageCodes).toEqual(expectedStagesCodes);
    }

    expectWorkflowToMatchWorkflow(workflowResponseDto: WorkFlowResponseDto, updateWorkflowDto: UpdateWorkflowDto): void {
        const workflowWithoutCode1 = {
            ...workflowResponseDto,
            states: workflowResponseDto.states.map(({code: _, swimlaneConstraint: __, ...rest}) => rest),
        };
        const workflowWithoutCode2 = {
            ...updateWorkflowDto,
            states: updateWorkflowDto.states.map(({code: _, swimlaneConstraint: __, ...rest}) => rest),
        };
        expect(workflowWithoutCode1).toMatchObject(workflowWithoutCode2);
    }

    /**
     * Creates a space for a specific user.
     *
     * @param {string} userId - The ID of the user.
     * @param {string} accessToken - The access token for authentication.
     * @return {Promise<GetFolderDto>} - A Promise that resolves with the created space object.
     */
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

    /**
     * Creates a team for a given space.
     *
     * @param {string} token - The user token.
     * @return {Promise<{teamId: number}>} - The team ID.
     */
    private async createTeamForSpace(token: string): Promise<{teamId: number}> {
        const userId = this.getUserIdFromAccessToken(token);
        const fakeCreateTeamDto = this.teamFactory.fakeCreateTeamDto([userId]);
        const {body: teamResponse} = await this.post(`/team`, fakeCreateTeamDto, token).expect(HttpStatus.CREATED);
        expect(teamResponse.id).toBeDefined();
        return {teamId: teamResponse.id};
    }

    /**
     * Creates a space custom field collection.
     *
     * @param {string} token - The access token for authentication.
     * @return {Promise<{cfcId: number}>} - A Promise that resolves with an object containing the custom field collection ID.
     */
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

    /**
     * Creates a workflow for a given folder.
     *
     * @param {string} token - The token used for authentication.
     *
     * @returns {Promise<WorkFlowEntity>} - A promise that resolves with the created workflow entity.
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

    // /* Not used anymore */
    // // async getOneAndLog(workflowService: WorkFlowService, id: number): Promise<WorkFlowResponseDto> {
    // //     return await workflowService.getOne(id);
    // // }
    //
    // // async getAllAndLog(workflowService: WorkFlowService): Promise<WorkFlowResponseDto[]> {
    // //     return await workflowService.getMany();
    // // }
    //
    // // async getOneAndReturnErrorOrNull(workflowService: WorkFlowService, id: number): Promise<unknown> {
    // //     let error: unknown = null;
    // //     try {
    // //         await this.getOneAndLog(workflowService, id);
    // //     } catch (e) {
    // //         error = e;
    // //     }
    // //     return error;
    // // }
    //
    // async tryDeleteWorkFlowAndReturnErrorOrNull(id: number, token: string): Promise<unknown> {
    //     let error = null;
    //     try {
    //         await this.delete(`${id}`, token);
    //     } catch (e) {
    //         error = e;
    //     }
    //     return error;
    // }
    //
    // async tryUpdateWorkFlowAndReturnErrorOrNull(token: string, id: number, updateWorkflowDto: UpdateWorkflowDto): Promise<unknown> {
    //     let error = null;
    //     try {
    //         await this.patch(`${id}`, updateWorkflowDto, token);
    //     } catch (e) {
    //         error = e;
    //     }
    //     return error;
    // }
}
