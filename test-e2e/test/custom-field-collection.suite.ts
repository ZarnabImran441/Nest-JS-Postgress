import {TASK_MANAGEMENT} from '@lib/base-library';
import {HttpStatus, Inject, Logger, OnModuleInit} from '@nestjs/common';
import {Test, TestSuite} from 'nestjs-jest-decorators';
import {Test as TestResponse} from 'supertest';
import {ChangeWorkflowFolderDto, ChangeWorkflowOptions} from '../../src/dto/folder/folder/change-workflow.dto';
import {GetFolderDto} from '../../src/dto/folder/folder/get-folder.dto';
import {DefaultViewOptions} from '../../src/enum/folder.enum';
import {WorkFlowEntity} from '../../src/model/workflow.entity';
import {EntityTypeOptions, PermissionOptions} from '../../src/module/authorization-impl/authorization.enum';
import {CustomFieldCollectionFactory} from '../factory/custom-field-collection.factory';
import {CustomFieldFactory} from '../factory/custom-field.factory';
import {FolderFactory} from '../factory/folder.factory';
import {TaskFactory} from '../factory/task.factory';
import {PermissionsType, UserFactory} from '../factory/user.factory';
import {WorkflowFactory} from '../factory/workflow.factory';
import {NewBaseTest} from './base-test';

@TestSuite('Custom Fields Suite')
export class CustomFieldCollectionE2eSpec extends NewBaseTest implements OnModuleInit {
    private readonly logger = new Logger(CustomFieldCollectionE2eSpec.name);

    @Inject()
    private factory: CustomFieldCollectionFactory;
    @Inject()
    private userFactory: UserFactory;
    @Inject()
    private folderFactory: FolderFactory;
    @Inject()
    private workflowFactory: WorkflowFactory;
    @Inject()
    private taskFactory: TaskFactory;

    private customFieldDefinitionFactory = new CustomFieldFactory();
    private customFieldCollectionFactory = new CustomFieldCollectionFactory();

    onModuleInit(): void {
        this.setUrl('/custom-field-collection');
    }

    @Test('create custom field collection')
    async CreateCustomFieldCollection(): Promise<void> {
        this.logger.log(`Create user`);

        const {body: jwtToken} = await this.createUserWithPermissions({
            folder: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            displacementGroup: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            space: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            commonCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            userCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            teams: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            customFieldCollection: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            user: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            workflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            CustomFieldsValue: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        this.logger.log(`do login`);

        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        this.logger.log('userId: ', userId);

        this.logger.log('create a custom field definition');
        const customFieldDefinitionOptions = this.customFieldDefinitionFactory.fakeCreateCustomFieldDefinitionOptions();
        const customFieldDefinitionDto = this.customFieldDefinitionFactory.fakeCreateCustomFieldDefinition(customFieldDefinitionOptions);
        const {body: customFieldDefinition1} = await this.post('/custom-field-definition', customFieldDefinitionDto, jwtToken.accessToken);
        expect(customFieldDefinition1).toBeDefined();
        expect(customFieldDefinition1.identifiers[0].id).toBeGreaterThan(0);

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
            null,
            DefaultViewOptions.BOARD,
            [TASK_MANAGEMENT],
            spaceResponse.id
        );
        const {body: f1} = await this.post(`/folder`, fakeFolder, jwtToken.accessToken).expect(HttpStatus.CREATED);

        this.logger.log('create task');
        const fakeTask = this.taskFactory.fakeCreateTask(userId, f1.id);
        const {body: task} = await this.post(`/task`, fakeTask, jwtToken.accessToken).expect(HttpStatus.CREATED);

        this.logger.log('Assign Custom Field to task');
        await this.post(
            `/task/custom-field/folder/${f1.id}/task/${task.id}`,
            {insert: [customFieldDefinition1.identifiers[0].id], delte: []},
            jwtToken.accessToken
        ).expect(HttpStatus.CREATED);

        this.logger.log('create custom field collection');
        const fakeCustomFieldCollectionDto = this.factory.fakeCreateCustomFieldCollection([customFieldDefinition1.identifiers[0].id]);
        const {body: createResponse} = await this.post('', fakeCustomFieldCollectionDto, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(createResponse).toBeDefined();
        expect(createResponse.identifiers[0].id).toBeGreaterThan(0);
        this.logger.log('get all custom field collection');
        const {body: customFieldCollection} = await this.get(``, jwtToken.accessToken);
        const createdCollection = customFieldCollection.filter((el) => el.id === createResponse.identifiers[0].id);

        expect(createdCollection[0].title).toBe(fakeCustomFieldCollectionDto.title);
        expect(createdCollection[0].description).toBe(fakeCustomFieldCollectionDto.description);
        expect(createdCollection[0].active).toBe(fakeCustomFieldCollectionDto.active);
        expect(createdCollection[0].createdBy).toBe(userId);
        expect(createdCollection[0].customFields[0].id).toBe(customFieldDefinition1.identifiers[0].id);
        expect(createdCollection[0].customFields[0].unPopulatedTasks).toBe(1);
    }

    @Test('update custom field collection')
    async updateCustomFieldCollection(): Promise<void> {
        this.logger.log(`Create user`);
        const fakeUser = await this.userFactory.createUserForLogin({
            [EntityTypeOptions.CommonCustomFieldsDefinition]: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            [EntityTypeOptions.UserCustomFieldsDefinition]: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            [EntityTypeOptions.customFieldCollection]: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        this.logger.log(`do login`);
        const loggedUser = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        expect(loggedUser.status).toBe(HttpStatus.CREATED);
        const jwtToken = loggedUser.body;
        this.logger.log('create a custom field definition');
        const customFieldDefinitionOptions1 = this.customFieldDefinitionFactory.fakeCreateCustomFieldDefinitionOptions();
        const customFieldDefinitionDto1 = this.customFieldDefinitionFactory.fakeCreateCustomFieldDefinition(customFieldDefinitionOptions1);
        const {body: cfdResponse1} = await this.post('/custom-field-definition', customFieldDefinitionDto1, jwtToken.accessToken);
        expect(cfdResponse1).toBeDefined();
        expect(cfdResponse1.identifiers[0].id).toBeGreaterThan(0);
        this.logger.log('create custom field collection');
        const fakeCustomFieldCollectionDto = this.factory.fakeCreateCustomFieldCollection([cfdResponse1.identifiers[0].id]);
        const {body: createResponse} = await this.post('', fakeCustomFieldCollectionDto, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(createResponse).toBeDefined();
        expect(createResponse.identifiers[0].id).toBeGreaterThan(0);

        this.logger.log('create a custom field definition');
        const customFieldDefinitionOptions2 = this.customFieldDefinitionFactory.fakeCreateCustomFieldDefinitionOptions();
        const customFieldDefinitionDto2 = this.customFieldDefinitionFactory.fakeCreateCustomFieldDefinition(customFieldDefinitionOptions2);
        const {body: cfdResponse2} = await this.post('/custom-field-definition', customFieldDefinitionDto2, jwtToken.accessToken);
        expect(cfdResponse2).toBeDefined();
        expect(cfdResponse2.identifiers[0].id).toBeGreaterThan(0);

        this.logger.log('update a custom field collection');
        const fakeUpdateCustomFieldCollectionDto = this.factory.fakeCreateCustomFieldCollection([cfdResponse2.identifiers[0].id]);
        const {body: updatedResponse} = await this.patch(
            `${createResponse.identifiers[0].id}`,
            fakeUpdateCustomFieldCollectionDto,
            jwtToken.accessToken
        ).expect(HttpStatus.OK);
        expect(updatedResponse.affected).toBe(1);
        this.logger.log('get all custom field collection');
        const {body: customFieldCollection} = await this.get(``, jwtToken.accessToken);
        const updatedCollection = customFieldCollection.filter((el) => el.id === createResponse.identifiers[0].id);
        expect(updatedCollection[0].title).toBe(fakeUpdateCustomFieldCollectionDto.title);
        expect(updatedCollection[0].description).toBe(fakeUpdateCustomFieldCollectionDto.description);
        expect(updatedCollection[0].customFields[0].id).toBe(cfdResponse2.identifiers[0].id);
    }

    @Test('delete a custom field collection')
    async deleteCustomFieldCollection(): Promise<void> {
        this.logger.log(`Create user`);
        const fakeUser = await this.userFactory.createUserForLogin({
            [EntityTypeOptions.CommonCustomFieldsDefinition]: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            [EntityTypeOptions.UserCustomFieldsDefinition]: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            [EntityTypeOptions.customFieldCollection]: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        this.logger.log(`do login`);
        const loggedUser = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        expect(loggedUser.status).toBe(HttpStatus.CREATED);
        const jwtToken = loggedUser.body;
        this.logger.log('create a custom field definition');
        const customFieldDefinitionOptions = this.customFieldDefinitionFactory.fakeCreateCustomFieldDefinitionOptions();
        const customFieldDefinitionDto = this.customFieldDefinitionFactory.fakeCreateCustomFieldDefinition(customFieldDefinitionOptions);
        const {body: customFieldDefinition1} = await this.post('/custom-field-definition', customFieldDefinitionDto, jwtToken.accessToken);
        expect(customFieldDefinition1).toBeDefined();
        expect(customFieldDefinition1.identifiers[0].id).toBeGreaterThan(0);
        this.logger.log('create custom field collection');
        const fakeCustomFieldCollectionDto = this.factory.fakeCreateCustomFieldCollection([customFieldDefinition1.identifiers[0].id]);
        const {body: createResponse} = await this.post('', fakeCustomFieldCollectionDto, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(createResponse).toBeDefined();
        expect(createResponse.identifiers[0].id).toBeGreaterThan(0);

        this.logger.log('delete a custom field collection');
        const {body: deleteResponse} = await this.delete(`${createResponse.identifiers[0].id}`, jwtToken.accessToken).expect(HttpStatus.OK);
        expect(deleteResponse.affected).toBe(1);
        this.logger.log('get all custom field collection');
        const {body: customFieldCollection} = await this.get(``, jwtToken.accessToken);
        const deletedCollection = customFieldCollection.filter((el) => el.id === createResponse.identifiers[0].id);
        expect(deletedCollection.length).toBe(0);
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

    private async createSpace(_userId: string, accessToken: string, workflowIds: number[]): Promise<GetFolderDto> {
        this.logger.log('create custom field collection');
        const {cfcId} = await this.createSpaceCustomFieldCollection(accessToken);
        this.logger.log('create a space');
        const fakeCreateSpace = this.folderFactory.fakeCreateSpace({
            availableWorkflows: workflowIds,
            customFieldCollections: [cfcId],
        });
        const {body: spaceResponse} = await this.post(`/space`, fakeCreateSpace, accessToken).expect(HttpStatus.CREATED);
        expect(spaceResponse).toBeDefined();
        return spaceResponse;
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

    async createUserWithPermissions(permissions: PermissionsType): Promise<TestResponse> {
        this.logger.log(`Create user`);
        const fakeUser = await this.userFactory.createUserForLogin(permissions);
        return this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
    }
}
