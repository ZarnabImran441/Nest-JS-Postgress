import '@jest-decorated/core/globals';
import {TASK_MANAGEMENT, TokenInterface} from '@lib/base-library';
import {HttpStatus, Inject, Logger, OnModuleInit} from '@nestjs/common';
import {Test, TestSuite} from 'nestjs-jest-decorators';
import {ChangeWorkflowFolderDto, ChangeWorkflowOptions} from '../../src/dto/folder/folder/change-workflow.dto';
import {GetFolderDto} from '../../src/dto/folder/folder/get-folder.dto';
import {WorkFlowResponseDto} from '../../src/dto/workflow/workflow-response.dto';
import {UserPermissionOptions} from '../../src/enum/folder-user.enum';
import {DefaultViewOptions} from '../../src/enum/folder.enum';
import {WorkFlowEntity} from '../../src/model/workflow.entity';
import {PermissionOptions} from '../../src/module/authorization-impl/authorization.enum';
import {CustomFieldCollectionFactory} from '../factory/custom-field-collection.factory';
import {CustomFieldFactory} from '../factory/custom-field.factory';
import {FolderFactory} from '../factory/folder.factory';
import {TeamFactory} from '../factory/team.factory';
import {UserFactory} from '../factory/user.factory';
import {WorkflowFactory} from '../factory/workflow.factory';
import {NewBaseTest} from './base-test';

/**
 * This class represents the StreamViewE2eSpec class.
 * It is responsible for testing the functionality of the Stream View feature.
 */
@TestSuite('Stream View Suite')
export class StreamViewE2eSpec extends NewBaseTest implements OnModuleInit {
    private readonly logger = new Logger(StreamViewE2eSpec.name);

    @Inject()
    private userFactory: UserFactory;
    @Inject()
    private folderFactory: FolderFactory;
    @Inject()
    private workflowFactory: WorkflowFactory;
    @Inject()
    private teamFactory: TeamFactory;

    private customFieldCollectionFactory: CustomFieldCollectionFactory = new CustomFieldCollectionFactory();
    private customFieldDefinitionFactory = new CustomFieldFactory();

    onModuleInit(): void {
        this.setUrl('/stream-view');
    }

    /**
     * Retrieves the folder stream view for the current user.
     *
     * @returns {Promise<void>} A promise that resolves once the folder stream view is retrieved.
     */
    @Test('Get Folder Stream View')
    async getFolderStreamView(): Promise<void> {
        this.logger.log(`Create user`);
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
        this.logger.log(`do login`);
        const response = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        const jwtToken: TokenInterface = response.body;
        await this.createFolder(jwtToken);
        this.logger.log(`get folders`);
        const folders = await this.get(`/folder`, jwtToken.accessToken);
        expect(folders.status).toBe(HttpStatus.OK);
        this.logger.log(`check folders stream views`);
        for (const folder of folders.body) {
            const sw = await this.get(`folder/${folder.id}`, jwtToken.accessToken);
            this.logger.log(`checking folder´s stream view ${folder.id}`);
            expect(sw.status).toBe(HttpStatus.OK);
        }
    }

    /**
     * Creates a folder for a given user.
     *
     * @param {TokenInterface} jwtToken - The JWT token containing the user's access token.
     * @returns {Promise<void>} - A promise that resolves with no value.
     */
    private async createFolder(jwtToken: TokenInterface): Promise<void> {
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        this.logger.log(`create workflow`);
        const {body: systemStages} = await this.get(`/displacement-group/system-stage`, jwtToken.accessToken);
        const fakeWorkflow = new WorkflowFactory().fakeCreateWorkflow(systemStages[0]?.id);
        let response = await this.post(`/workflow`, fakeWorkflow, jwtToken.accessToken);
        expect(response.status).toBe(HttpStatus.CREATED);
        this.logger.log(`check workflow exists`);
        response = await this.get(`/workflow/${response.body.id}`, jwtToken.accessToken);
        expect(response.status).toBe(HttpStatus.OK);
        const workflowWithoutCode1 = {
            ...response.body,
            states: response.body.states.map(({code: _, swimlaneConstraint: __, ...rest}) => rest),
        };
        const workflowWithoutCode2 = {
            ...fakeWorkflow,
            states: fakeWorkflow.states.map(({code: _, swimlaneConstraint: __, ...rest}) => rest),
        };
        expect(workflowWithoutCode1).toMatchObject(workflowWithoutCode2);
        const workflow: WorkFlowResponseDto = response.body,
            fakeChangeWorkflow: ChangeWorkflowFolderDto = {
                commonWorkflow: workflow.id,
                type: ChangeWorkflowOptions.COMMON_TO_COMMON,
                Mapping: [],
                personaliseWorkflow: null,
            };
        const spaceResponse = await this.createSpace(userId, jwtToken.accessToken, [workflow.id]);

        // create folder
        const fakeFolder = this.folderFactory.fakeCreateFolder(
            fakeChangeWorkflow,
            null,
            DefaultViewOptions.BOARD,
            [TASK_MANAGEMENT],
            spaceResponse.id
        );
        response = await this.post(`/folder`, fakeFolder, jwtToken.accessToken);
        expect(response.status).toBe(HttpStatus.CREATED);
        // check folder exists
        const f = await this.get(`/folder/${response.body.id}`, jwtToken.accessToken);
        expect(f.status).toBe(HttpStatus.OK);
        expect(f.body.id).toBe(response.body.id);
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
}
