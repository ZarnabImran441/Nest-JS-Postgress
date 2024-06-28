import {TokenInterface} from '@lib/base-library';
import {HttpStatus, Inject, Logger, OnModuleInit} from '@nestjs/common';
import * as fs from 'fs';
import {Test, TestSuite} from 'nestjs-jest-decorators';
import {ChangeWorkflowFolderDto, ChangeWorkflowOptions} from '../../src/dto/folder/folder/change-workflow.dto';
import {ChangeOwnerDto} from '../../src/dto/folder/folder/create-folder.dto';
import {GetFolderDto} from '../../src/dto/folder/folder/get-folder.dto';
import {FolderViewOptions} from '../../src/enum/folder-position.enum';
import {UserPermissionOptions} from '../../src/enum/folder-user.enum';
import {DefaultViewOptions} from '../../src/enum/folder.enum';
import {WorkFlowEntity} from '../../src/model/workflow.entity';
import {PermissionOptions} from '../../src/module/authorization-impl/authorization.enum';
import {CustomFieldCollectionFactory} from '../factory/custom-field-collection.factory';
import {CustomFieldFactory} from '../factory/custom-field.factory';
import {FolderFactory} from '../factory/folder.factory';
import {TagFactory} from '../factory/tag.factory';
import {TeamFactory} from '../factory/team.factory';
import {UserFactory} from '../factory/user.factory';
import {WorkflowFactory} from '../factory/workflow.factory';
import {NewBaseTest} from './base-test';

/**
 * Represents a test class for Space API endpoints.
 * Extends BaseTest class.
 */

@TestSuite('Space Suite')
export class Space2eSpec extends NewBaseTest implements OnModuleInit {
    private readonly logger = new Logger(Space2eSpec.name);

    @Inject()
    private userFactory: UserFactory;
    @Inject()
    private teamFactory: TeamFactory;
    @Inject()
    private folderFactory: FolderFactory;
    @Inject()
    private workflowFactory: WorkflowFactory;
    @Inject()
    private tagFactory: TagFactory;

    private customFieldCollectionFactory: CustomFieldCollectionFactory = new CustomFieldCollectionFactory();
    private customFieldFactory: CustomFieldFactory = new CustomFieldFactory();

    onModuleInit(): void {
        this.setUrl('/space');
    }

    /**
     * Creates a space.
     *
     * @returns {Promise<void>} A promise that resolves once the space is created.
     */
    @Test('create a space and change owner')
    async createSpace(): Promise<void> {
        this.logger.log('create user and login');
        const {token: jwtToken} = await this.createUserWithPermissions();

        this.logger.log('create workflow');
        const workflow: WorkFlowEntity = await this.createWorkflowForFolder(jwtToken.accessToken);

        this.logger.log('create a team');
        const {teamId} = await this.createTeamForSpace(jwtToken.accessToken);

        this.logger.log('create custom field collection');
        const {cfcId} = await this.createSpaceCustomFieldCollection(jwtToken.accessToken);

        this.logger.log('create a space');
        const fakeCreateSpace = this.folderFactory.fakeCreateSpace({
            availableWorkflows: [workflow.id],
            teams: [{id: teamId, teamPermission: UserPermissionOptions.EDITOR}],
            customFieldCollections: [cfcId],
        });
        const {body: spaceResponse} = await this.post(``, fakeCreateSpace, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(spaceResponse).toBeDefined();

        this.logger.log('get all spaces');
        const {body: allSpacesResponse} = await this.get(`?offset=0&limit=100&show-on="task-management"`, jwtToken.accessToken).expect(
            HttpStatus.OK
        );
        const createdResponse = allSpacesResponse.filter((el) => el.id === spaceResponse.id);
        expect(createdResponse.length).toBeGreaterThan(0);
        expect(createdResponse[0]).toBeDefined();
        expect(createdResponse[0].title).toBe(fakeCreateSpace.title);
        expect(createdResponse[0].description).toBe(fakeCreateSpace.description);
        expect(createdResponse[0].defaultView).toBe(fakeCreateSpace.defaultView);
        expect(createdResponse[0].teams).toBeDefined();
        expect(createdResponse[0].teams[0].id).toBe(teamId);
        expect(createdResponse[0].availableWorkflows).toBeDefined();
        expect(createdResponse[0].availableWorkflows[0].id).toBe(workflow.id);
        expect(createdResponse[0].customFieldsCollections).toBeDefined();
        expect(createdResponse[0].customFieldsCollections[0].id).toBe(cfcId);
        expect(createdResponse[0].isFavourite).toBe(false);
        expect(createdResponse[0].folderCount).toBe(0);

        this.logger.log('Change space owner');
        // create a new user
        const {token: jwtToken2} = await this.createUserWithPermissions();
        // change owner
        const dto: ChangeOwnerDto = {permissions: UserPermissionOptions.NONE};
        await this.patch(`${spaceResponse.id}/owner/${jwtToken2.id}`, dto, jwtToken.accessToken).expect(HttpStatus.OK);
        await this.get(`${spaceResponse.id}`, jwtToken2.accessToken).expect(HttpStatus.OK);
        await this.get(`${spaceResponse.id}`, jwtToken.accessToken).expect(HttpStatus.FORBIDDEN);
    }

    /**
     * Get all spaces, including archived spaces.
     *
     * This method performs the following actions:
     * 1. Creates a user and logs in.
     * 2. Creates a workflow for a folder.
     * 3. Creates a team for a space.
     * 4. Creates a custom field collection.
     * 5. Creates a space using the created workflow, team, and custom field collection.
     * 6. Archives the created space.
     * 7. Retrieves all spaces and archived spaces.
     * 8. Verifies that the created space is present in the response.
     *
     * @returns {Promise<void>} A Promise that resolves when all spaces are retrieved and verified.
     */
    @Test('get all spaces')
    async getAllSpaces(): Promise<void> {
        this.logger.log('create user and login');
        const {token: jwtToken} = await this.createUserWithPermissions();

        this.logger.log('create workflow');
        const workflow: WorkFlowEntity = await this.createWorkflowForFolder(jwtToken.accessToken);

        this.logger.log('create a team');
        const {teamId} = await this.createTeamForSpace(jwtToken.accessToken);

        this.logger.log('create custom field collection');
        const {cfcId} = await this.createSpaceCustomFieldCollection(jwtToken.accessToken);

        this.logger.log('create a space');
        const fakeCreateSpace = this.folderFactory.fakeCreateSpace({
            availableWorkflows: [workflow.id],
            teams: [{id: teamId, teamPermission: UserPermissionOptions.EDITOR}],
            customFieldCollections: [cfcId],
        });
        const {body: spaceResponse} = await this.post(``, fakeCreateSpace, jwtToken.accessToken).expect(HttpStatus.CREATED);

        // archive a space
        await this.post(`${spaceResponse.id}/archive`, {archiveReason: 'some test reason'}, jwtToken.accessToken).expect(
            HttpStatus.CREATED
        );

        this.logger.log('get all and archived spaces');
        const {body: allSpacesResponse} = await this.get(
            `?offset=0&limit=100&show-on="task-management"&show-archived=true`,
            jwtToken.accessToken
        ).expect(HttpStatus.OK);
        const createdResponse = allSpacesResponse.filter((el) => el.id === spaceResponse.id);

        expect(createdResponse.length).toBeGreaterThan(0);
        expect(createdResponse[0]).toBeDefined();
        expect(createdResponse[0].title).toBe(fakeCreateSpace.title);
        expect(createdResponse[0].archivedBy).toBeDefined();
        expect(createdResponse[0].archivedAt).toBeDefined();
    }

    /**
     * Update a space.
     *
     * @returns {Promise<void>} A promise that resolves when the space is updated.
     */
    @Test('update a space')
    async updateSpace(): Promise<void> {
        const {token: jwtToken} = await this.createUserWithPermissions();
        const workflow: WorkFlowEntity = await this.createWorkflowForFolder(jwtToken.accessToken);
        this.logger.log('create a space');
        const fakeCreateSpace = this.folderFactory.fakeCreateSpace({
            availableWorkflows: [workflow.id],
        });
        const {body: spaceResponse} = await this.post(``, fakeCreateSpace, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(spaceResponse).toBeDefined();
        const {body: allSpacesResponse} = await this.get(`?offset=0&limit=100&show-on=task-management`, jwtToken.accessToken).expect(
            HttpStatus.OK
        );
        const createdResponse = allSpacesResponse.filter((el) => el.id === spaceResponse.id);
        expect(createdResponse.length).toBeGreaterThan(0);
        expect(createdResponse[0]).toBeDefined();
        expect(createdResponse[0].title).toBe(fakeCreateSpace.title);
        expect(createdResponse[0].description).toBe(fakeCreateSpace.description);
        expect(createdResponse[0].defaultView).toBe(fakeCreateSpace.defaultView);
        expect(createdResponse[0].availableWorkflows).toBeDefined();
        expect(createdResponse[0].availableWorkflows[0].id).toBe(workflow.id);

        const fakeUpdateSpaceDto = this.folderFactory.fakeUpdateSpace();
        const {body: updateResponse} = await this.patch(`${createdResponse[0].id}`, fakeUpdateSpaceDto, jwtToken.accessToken).expect(
            HttpStatus.OK
        );
        expect(updateResponse.affected).toBe(1);
        const {body: allSpaces} = await this.get(`?offset=0&limit=100&show-on=task-management`, jwtToken.accessToken).expect(HttpStatus.OK);
        const updatedResponse = allSpaces.filter((el) => el.id === createdResponse[0].id);
        expect(updatedResponse.length).toBeGreaterThan(0);
        expect(updatedResponse[0]).toBeDefined();
        expect(updatedResponse[0].title).toBe(fakeUpdateSpaceDto.title);
        expect(updatedResponse[0].description).toBe(fakeUpdateSpaceDto.description);
        expect(updatedResponse[0].defaultView).toBe(fakeUpdateSpaceDto.defaultView);
    }

    /**
     * Update a space image.
     *
     * @returns {Promise<void>} Promise that resolves when the space image is updated.
     */
    @Test('update a space image')
    async updateSpaceImage(): Promise<void> {
        this.logger.log('Create User');
        const {token: jwtToken} = await this.createUserWithPermissions();
        this.logger.log('Create Workflow For Folder');
        const workflow: WorkFlowEntity = await this.createWorkflowForFolder(jwtToken.accessToken);
        this.logger.log('Create Space');
        const fakeCreateSpace = this.folderFactory.fakeCreateSpace({
            availableWorkflows: [workflow.id],
        });
        const {body: spaceResponse} = await this.post(``, fakeCreateSpace, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(spaceResponse).toBeDefined();
        const {body: allSpacesResponse} = await this.get(`?offset=0&limit=100&show-on=task-management`, jwtToken.accessToken).expect(
            HttpStatus.OK
        );
        const createdResponse = allSpacesResponse.filter((el) => el.id === spaceResponse.id);
        expect(createdResponse.length).toBeGreaterThan(0);
        expect(createdResponse[0]).toBeDefined();
        expect(createdResponse[0].title).toBe(fakeCreateSpace.title);
        expect(createdResponse[0].description).toBe(fakeCreateSpace.description);
        expect(createdResponse[0].defaultView).toBe(fakeCreateSpace.defaultView);
        expect(createdResponse[0].availableWorkflows).toBeDefined();
        expect(createdResponse[0].availableWorkflows[0].id).toBe(workflow.id);

        const fakeUpdateSpaceDto = this.folderFactory.fakeUpdateSpace();
        fakeUpdateSpaceDto['pictureUrl'] = await fs.promises.readFile('./apps/task-management/test-e2e/files/auto2.jpg', {
            encoding: 'base64',
        });
        this.logger.log(`Uploading image to space: ${createdResponse[0].id}`);
        const {body: updateResponse} = await this.patch(`${createdResponse[0].id}`, fakeUpdateSpaceDto, jwtToken.accessToken).expect(
            HttpStatus.OK
        );
        expect(updateResponse.affected).toBe(1);
        const {body: allSpaces} = await this.get(`?offset=0&limit=100&show-on=task-management`, jwtToken.accessToken).expect(HttpStatus.OK);
        const updatedResponse = allSpaces.filter((el) => el.id === createdResponse[0].id);
        expect(updatedResponse.length).toBeGreaterThan(0);
        expect(updatedResponse[0]).toBeDefined();
        expect(updatedResponse[0].title).toBe(fakeUpdateSpaceDto.title);
        expect(updatedResponse[0].description).toBe(fakeUpdateSpaceDto.description);
        expect(updatedResponse[0].defaultView).toBe(fakeUpdateSpaceDto.defaultView);
    }

    /**
     * Update teams of a space.
     * @return Promise<void>
     */
    @Test('update teams of a space')
    async updateSpaceTeams(): Promise<void> {
        this.logger.log('create user and login');
        const {token: jwtToken} = await this.createUserWithPermissions();

        this.logger.log('create workflow');
        const workflow: WorkFlowEntity = await this.createWorkflowForFolder(jwtToken.accessToken);

        this.logger.log('create a team');
        const {teamId: teamId1} = await this.createTeamForSpace(jwtToken.accessToken);

        this.logger.log('create a space');
        const fakeCreateSpace = this.folderFactory.fakeCreateSpace({
            availableWorkflows: [workflow.id],
            teams: [{id: teamId1, teamPermission: UserPermissionOptions.EDITOR}],
        });
        const {body: spaceResponse} = await this.post(``, fakeCreateSpace, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(spaceResponse).toBeDefined();
        this.logger.log('get all spaces');
        const {body: allSpacesResponse} = await this.get(`?offset=0&limit=100&show-on=task-management`, jwtToken.accessToken).expect(
            HttpStatus.OK
        );
        const createdResponse = allSpacesResponse.filter((el) => el.id === spaceResponse.id);
        expect(createdResponse.length).toBeGreaterThan(0);
        expect(createdResponse[0]).toBeDefined();
        expect(createdResponse[0].teams).toBeDefined();
        expect(createdResponse[0].teams[0].id).toBe(teamId1);
        expect(createdResponse[0].availableWorkflows).toBeDefined();
        expect(createdResponse[0].availableWorkflows[0].id).toBe(workflow.id);

        this.logger.log('create a team');
        const {teamId: teamId2} = await this.createTeamForSpace(jwtToken.accessToken);

        this.logger.log('update space team');
        await this.patch(
            `${createdResponse[0].id}`,
            {
                teams: {insert: [{id: teamId2, teamPermission: UserPermissionOptions.EDITOR}], update: [], delete: []},
            },
            jwtToken.accessToken
        ).expect(HttpStatus.OK);

        this.logger.log('get all spaces');
        const {body: allSpaces} = await this.get(`?offset=0&limit=100&show-on=task-management`, jwtToken.accessToken).expect(HttpStatus.OK);
        const updatedResponse = allSpaces.filter((el) => el.id === createdResponse[0].id);
        expect(updatedResponse.length).toBeGreaterThan(0);
        expect(updatedResponse[0]).toBeDefined();
        expect(updatedResponse[0].teams[0].id).toBe(teamId1);
        expect(updatedResponse[0].teams[1].id).toBe(teamId2);
    }

    /**
     * Updates the custom field collection of a space.
     *
     * @return {Promise<void>} Resolves when the custom field collection is updated successfully.
     */
    @Test('update custom field collection of a space')
    async updateSpaceCustomFieldCollection(): Promise<void> {
        this.logger.log('create user and login');
        const {token: jwtToken} = await this.createUserWithPermissions();

        this.logger.log('create workflow');
        const workflow: WorkFlowEntity = await this.createWorkflowForFolder(jwtToken.accessToken);

        this.logger.log('create custom field collection');
        const {cfcId: cfcId1} = await this.createSpaceCustomFieldCollection(jwtToken.accessToken);

        this.logger.log('create a space');
        const fakeCreateSpace = this.folderFactory.fakeCreateSpace({
            availableWorkflows: [workflow.id],
            customFieldCollections: [cfcId1],
        });
        const {body: spaceResponse} = await this.post(``, fakeCreateSpace, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(spaceResponse).toBeDefined();
        this.logger.log('get all spaces');
        const {body: allSpacesResponse} = await this.get(`?offset=0&limit=100&show-on=task-management`, jwtToken.accessToken).expect(
            HttpStatus.OK
        );
        const createdResponse = allSpacesResponse.filter((el) => el.id === spaceResponse.id);
        expect(createdResponse.length).toBeGreaterThan(0);
        expect(createdResponse[0]).toBeDefined();
        expect(createdResponse[0].availableWorkflows).toBeDefined();
        expect(createdResponse[0].availableWorkflows[0].id).toBe(workflow.id);
        expect(createdResponse[0].customFieldsCollections).toBeDefined();
        expect(createdResponse[0].customFieldsCollections[0].id).toBe(cfcId1);

        this.logger.log('create custom field collection');
        const {cfcId: cfcId2} = await this.createSpaceCustomFieldCollection(jwtToken.accessToken);

        this.logger.log('update space custom field collection');
        await this.patch(
            `${createdResponse[0].id}`,
            {
                customFieldCollections: {insert: [cfcId2], delete: []},
            },
            jwtToken.accessToken
        ).expect(HttpStatus.OK);

        this.logger.log('get all spaces');
        const {body: allSpaces} = await this.get(`?offset=0&limit=100&show-on=task-management`, jwtToken.accessToken).expect(HttpStatus.OK);
        const updatedResponse = allSpaces.filter((el) => el.id === createdResponse[0].id);
        expect(updatedResponse.length).toBeGreaterThan(0);
        expect(updatedResponse[0]).toBeDefined();
        expect(updatedResponse[0].customFieldsCollections[0].id).toBe(cfcId1);
        expect(updatedResponse[0].customFieldsCollections[1].id).toBe(cfcId2);
    }

    /**
     * Update workflows of a space.
     * @returns {Promise<void>} - Promise that resolves with no value.
     */
    @Test('Update workflows of a space')
    async updateSpaceWorkflows(): Promise<void> {
        this.logger.log('create user and login');
        const {token: jwtToken} = await this.createUserWithPermissions();

        this.logger.log('get User id');
        this.logger.log('create workflow');
        const workflow: WorkFlowEntity = await this.createWorkflowForFolder(jwtToken.accessToken);

        this.logger.log('create a space');
        const fakeCreateSpace = this.folderFactory.fakeCreateSpace({
            availableWorkflows: [workflow.id],
        });
        const {body: spaceResponse} = await this.post(``, fakeCreateSpace, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(spaceResponse).toBeDefined();
        this.logger.log('get all spaces');
        const {body: allSpacesResponse} = await this.get(`?offset=0&limit=100&show-on=task-management`, jwtToken.accessToken).expect(
            HttpStatus.OK
        );
        const createdResponse = allSpacesResponse.filter((el) => el.id === spaceResponse.id);
        expect(createdResponse.length).toBeGreaterThan(0);
        expect(createdResponse[0]).toBeDefined();
        expect(createdResponse[0].availableWorkflows).toBeDefined();
        expect(createdResponse[0].availableWorkflows[0].id).toBe(workflow.id);
        this.logger.log('create workflow');
        const workflow1: WorkFlowEntity = await this.createWorkflowForFolder(jwtToken.accessToken);

        this.logger.log('update space workflows');
        await this.patch(
            `${createdResponse[0].id}`,
            {
                workflows: {insert: [workflow1.id], delete: []},
            },
            jwtToken.accessToken
        ).expect(HttpStatus.OK);

        this.logger.log('get all spaces');
        const {body: allSpaces} = await this.get(`?offset=0&limit=100&show-on=task-management`, jwtToken.accessToken).expect(HttpStatus.OK);
        const updatedResponse = allSpaces.filter((el) => el.id === createdResponse[0].id);
        expect(updatedResponse.length).toBeGreaterThan(0);
        expect(updatedResponse[0]).toBeDefined();
        const sortedWorkflows = updatedResponse[0].availableWorkflows.sort((a, b): number => {
            return a.id - b.id;
        });
        expect(sortedWorkflows[0].id).toBe(workflow.id);
        expect(sortedWorkflows[1].id).toBe(workflow1.id);
    }

    /**
     * Deletes a space.
     *
     * This method performs the following steps:
     * - Creates a user and logs in.
     * - Retrieves the user id.
     * - Creates a workflow for the folder.
     * - Creates a team for the space.
     * - Creates a custom field collection.
     * - Creates a space.
     * - Retrieves all spaces.
     * - Filters the response to find the created space.
     * - Validates the created space and its properties.
     * - Deletes the space.
     * - Retrieves all spaces again.
     * - Filters the response to check if the space is deleted.
     *
     * @returns Promise that resolves to void.
     */
    @Test('delete a space')
    async deleteSpace(): Promise<void> {
        this.logger.log('create user and login');
        const {token: jwtToken} = await this.createUserWithPermissions();

        this.logger.log('get User id');
        this.logger.log('create workflow');
        const workflow: WorkFlowEntity = await this.createWorkflowForFolder(jwtToken.accessToken);

        this.logger.log('create a team');
        const {teamId} = await this.createTeamForSpace(jwtToken.accessToken);

        this.logger.log('create custom field collection');
        const {cfcId} = await this.createSpaceCustomFieldCollection(jwtToken.accessToken);

        this.logger.log('create a space');
        const fakeCreateSpace = this.folderFactory.fakeCreateSpace({
            availableWorkflows: [workflow.id],
            teams: [{id: teamId, teamPermission: UserPermissionOptions.EDITOR}],
            customFieldCollections: [cfcId],
        });
        const {body: spaceResponse} = await this.post(``, fakeCreateSpace, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(spaceResponse).toBeDefined();
        this.logger.log('get all spaces');
        const {body: allSpacesResponse} = await this.get(`?offset=0&limit=100&show-on=task-management`, jwtToken.accessToken).expect(
            HttpStatus.OK
        );
        const createdResponse = allSpacesResponse.filter((el) => el.id === spaceResponse.id);
        expect(createdResponse.length).toBeGreaterThan(0);
        expect(createdResponse[0]).toBeDefined();
        expect(createdResponse[0].teams).toBeDefined();
        expect(createdResponse[0].teams[0].id).toBe(teamId);
        expect(createdResponse[0].availableWorkflows).toBeDefined();
        expect(createdResponse[0].availableWorkflows[0].id).toBe(workflow.id);
        expect(createdResponse[0].customFieldsCollections).toBeDefined();
        expect(createdResponse[0].customFieldsCollections[0].id).toBe(cfcId);
        this.logger.log('delete space');
        await this.delete(`${createdResponse[0].id}`, jwtToken.accessToken).expect(HttpStatus.OK);
        this.logger.log('get all spaces');
        const {body: allSpaces} = await this.get(`?offset=0&limit=100&show-on=task-management`, jwtToken.accessToken).expect(HttpStatus.OK);
        const deletedResponse = allSpaces.filter((el) => el.id === createdResponse[0].id);
        expect(deletedResponse.length).toBe(0);
    }

    /**
     * Update the tags of a space.
     *
     * @returns {Promise<void>} A promise that resolves when the space tags have been updated.
     */
    @Test('update tags of a space')
    async updateSpaceTags(): Promise<void> {
        this.logger.log('create user and login');
        const {token: jwtToken} = await this.createUserWithPermissions();

        this.logger.log('get User id');

        this.logger.log('create workflow');
        const workflow: WorkFlowEntity = await this.createWorkflowForFolder(jwtToken.accessToken);

        this.logger.log('create a space');
        const fakeCreateSpace = this.folderFactory.fakeCreateSpace({
            availableWorkflows: [workflow.id],
        });
        const {body: spaceResponse} = await this.post(``, fakeCreateSpace, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(spaceResponse.id).toBeDefined();

        this.logger.log('create common tags');
        const tag1 = await this.tagFactory.createTag();
        const tag2 = await this.tagFactory.createTag();

        this.logger.log('update space tags');
        await this.patch(`${spaceResponse.id}`, {tags: {insert: [tag1.id, tag2.id]}}, jwtToken.accessToken).expect(HttpStatus.OK);

        this.logger.log('get all spaces');
        const {body: allSpacesResponse} = await this.get(`?offset=0&limit=100&show-on=task-management`, jwtToken.accessToken).expect(
            HttpStatus.OK
        );
        const updateResponse = allSpacesResponse.filter((el) => el.id === spaceResponse.id);
        expect(updateResponse.length).toBeGreaterThan(0);
        expect(updateResponse[0].id).toBeDefined();
        expect(updateResponse[0].tags[0]).toBe(tag1.id);
        expect(updateResponse[0].tags[1]).toBe(tag2.id);
    }

    /**
     * @description Adds a custom field value to a space.
     * @returns {Promise<void>} - A promise that resolves when the custom field value has been successfully added to the space.
     */
    @Test('add custom field value to space')
    async addSpaceCustomFieldValue(): Promise<void> {
        this.logger.log('create user and login');
        const {token: jwtToken} = await this.createUserWithPermissions();
        this.logger.log('get User id');
        this.logger.log('create workflow');
        const workflow: WorkFlowEntity = await this.createWorkflowForFolder(jwtToken.accessToken);
        this.logger.log('create a space');
        const fakeCreateSpace = this.folderFactory.fakeCreateSpace({
            availableWorkflows: [workflow.id],
        });
        const {body: spaceResponse} = await this.post(``, fakeCreateSpace, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(spaceResponse.id).toBeDefined();

        this.logger.log('create a custom field definition');
        const customFieldDefinitionOptions = this.customFieldFactory.fakeCreateCustomFieldDefinitionOptions();
        const customFieldDefinitionDto = this.customFieldFactory.fakeCreateCustomFieldDefinition(customFieldDefinitionOptions);
        const {body: customFieldDefinition1} = await this.post('/custom-field-definition', customFieldDefinitionDto, jwtToken.accessToken);
        expect(customFieldDefinition1).toBeDefined();
        expect(customFieldDefinition1.identifiers[0].id).toBeGreaterThan(0);

        this.logger.log('add custom field value to space');
        const fakecustomFieldValueDto = this.customFieldFactory.fakeCreateFolderCustomFieldValue(customFieldDefinition1.identifiers[0].id);
        const {body: updateResponse} = await this.post(
            `${spaceResponse.id}/custom-field-value`,
            [fakecustomFieldValueDto],
            jwtToken.accessToken
        );
        expect(updateResponse.identifiers[0].id).toBeDefined();

        this.logger.log('get all spaces');
        const {body: allSpacesResponse} = await this.get(`?offset=0&limit=100&show-on=task-management`, jwtToken.accessToken).expect(
            HttpStatus.OK
        );
        const updatedSpace = allSpacesResponse.filter((el) => el.id === spaceResponse.id);
        expect(updatedSpace.length).toBeGreaterThan(0);
        expect(updatedSpace[0].id).toBe(spaceResponse.id);
        expect(updatedSpace[0].customFields[0].value).toBe(fakecustomFieldValueDto.value);
        expect(updatedSpace[0].customFields[0].CustomFieldDefinition.id).toBe(customFieldDefinition1.identifiers[0].id);
    }

    /**
     * @function updateSpaceIndex
     * @description Update a space index.
     * @returns {Promise<void>} A promise that resolves once the space index is updated.
     */
    @Test('update a space index')
    async updateSpaceIndex(): Promise<void> {
        const {token: jwtToken} = await this.createUserWithPermissions();
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        const spaceX = await this.createSpaceMethod(userId, jwtToken.accessToken);
        const spaceY = await this.createSpaceMethod(userId, jwtToken.accessToken);
        const spaceZ = await this.createSpaceMethod(userId, jwtToken.accessToken);
        const fakeUpdateFolderPositionDto = {index: 2, view: FolderViewOptions.ROOT};
        const response = await this.patch(`position/${spaceX.id}`, fakeUpdateFolderPositionDto, jwtToken.accessToken);
        expect(response.status).toBe(HttpStatus.OK);
        this.logger.log(spaceY, spaceZ);
    }

    @Test('update a favoruite space index')
    async updateFavouriteSpaceIndex(): Promise<void> {
        const {token: jwtToken} = await this.createUserWithPermissions();
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        const space1 = await this.createSpaceMethod(userId, jwtToken.accessToken);
        const space2 = await this.createSpaceMethod(userId, jwtToken.accessToken);
        const space3 = await this.createSpaceMethod(userId, jwtToken.accessToken);
        await this.post(`favourite/${space1.id}`, {}, jwtToken.accessToken).expect(HttpStatus.CREATED);
        await this.post(`favourite/${space2.id}`, {}, jwtToken.accessToken).expect(HttpStatus.CREATED);
        await this.post(`favourite/${space3.id}`, {}, jwtToken.accessToken).expect(HttpStatus.CREATED);
        const fakeUpdateSpacePositionDto = {index: 2, view: FolderViewOptions.ROOT};
        await this.patch(`favourite/position/${space1.id}`, fakeUpdateSpacePositionDto, jwtToken.accessToken).expect(HttpStatus.OK);
        const {body: favouriteSpaces} = await this.get(`favourite?shown-on=task-management`, jwtToken.accessToken).expect(HttpStatus.OK);
        expect(favouriteSpaces.length).toBe(3);
        expect(favouriteSpaces[2].id).toBe(space1.id);
    }

    /**
     * Unable to insert a folder in place of a space.
     */
    @Test('unable to insert a folder in place of a space')
    async unableToInsertFolderInPlaceOfSpace(): Promise<void> {
        const {token: jwtToken} = await this.createUserWithPermissions();
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        const workflow: WorkFlowEntity = await this.createWorkflowForFolder(jwtToken.accessToken),
            fakeChangeWorkflow: ChangeWorkflowFolderDto = {
                commonWorkflow: workflow.id,
                type: ChangeWorkflowOptions.COMMON_TO_COMMON,
                Mapping: [],
                personaliseWorkflow: null,
            };
        const spaceX = await this.createSpaceMethod(userId, jwtToken.accessToken, [workflow.id]);
        const spaceY = await this.createSpaceMethod(userId, jwtToken.accessToken, [workflow.id]);
        const fakeFolder = this.folderFactory.fakeCreateFolder(fakeChangeWorkflow, spaceX.id, DefaultViewOptions.BOARD, [
            'task-management',
        ]);
        const {body: f1} = await this.post(`/folder`, fakeFolder, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(f1).toBeDefined();
        const fakeUpdateFolderPositionDto = {parentFolderOldId: spaceY.id, index: 2, view: FolderViewOptions.ROOT};
        await this.patch(`/folder/position/${spaceX.id}`, fakeUpdateFolderPositionDto, jwtToken.accessToken).expect(HttpStatus.FORBIDDEN);
    }

    /**
     * Unable to insert a space inside another space.
     *
     * @returns {Promise<void>} A Promise that resolves when the operation is complete.
     */
    @Test('unable to insert a space inside another space')
    async unableToInsertSpaceInsideOfSpace(): Promise<void> {
        const {token: jwtToken} = await this.createUserWithPermissions();
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        const spaceX = await this.createSpaceMethod(userId, jwtToken.accessToken);
        const spaceY = await this.createSpaceMethod(userId, jwtToken.accessToken);
        const fakeUpdateFolderPositionDto = {
            parentFolderNewId: spaceY.id,
            index: 0,
            view: FolderViewOptions.ROOT,
        };
        await this.patch(`position/${spaceX.id}`, fakeUpdateFolderPositionDto, jwtToken.accessToken).expect(HttpStatus.BAD_REQUEST);
    }

    /**
     * Archiving a space.
     *
     * @returns {Promise<void>} A promise that resolves once the space is created.
     */
    @Test('should archive a space')
    async archiveSpace(): Promise<void> {
        this.logger.log('create user and login');
        const {token: jwtToken} = await this.createUserWithPermissions();

        this.logger.log('create workflow');
        const workflow: WorkFlowEntity = await this.createWorkflowForFolder(jwtToken.accessToken);

        this.logger.log('create a space');
        const fakeCreateSpace = this.folderFactory.fakeCreateSpace({
            availableWorkflows: [workflow.id],
        });
        const {body: spaceResponse} = await this.post(``, fakeCreateSpace, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(spaceResponse).toBeDefined();

        this.logger.log('get the created space');
        const {body: createdSpace} = await this.get(`${spaceResponse.id}`, jwtToken.accessToken).expect(HttpStatus.OK);
        expect(createdSpace).toBeDefined();

        this.logger.log('archive the space');
        await this.post(`${createdSpace.id}/archive`, {archiveReason: 'need to be archived'}, jwtToken.accessToken).expect(
            HttpStatus.CREATED
        );

        this.logger.log('The space should be archived, and an action should be created');
        const {body: archviedSpace} = await this.get(`${spaceResponse.id}`, jwtToken.accessToken).expect(HttpStatus.OK);
        expect(archviedSpace.archivedAt).toBeDefined();
        expect(archviedSpace.archivedBy).toBeDefined();
    }

    /**
     * Unarchiving a space.
     *
     * @returns {Promise<void>} A promise that resolves once the space is created.
     */
    @Test('should restore a space and create an action')
    async unarchiveSpace(): Promise<void> {
        this.logger.log('create user and login');
        const {token: jwtToken} = await this.createUserWithPermissions();

        this.logger.log('create workflow');
        const workflow: WorkFlowEntity = await this.createWorkflowForFolder(jwtToken.accessToken);

        this.logger.log('create a space');
        const fakeCreateSpace = this.folderFactory.fakeCreateSpace({
            availableWorkflows: [workflow.id],
        });
        const {body: spaceResponse} = await this.post(``, fakeCreateSpace, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(spaceResponse).toBeDefined();

        this.logger.log('get the created space');
        const {body: createdSpace} = await this.get(`${spaceResponse.id}`, jwtToken.accessToken).expect(HttpStatus.OK);
        expect(createdSpace).toBeDefined();

        this.logger.log('archive the space');
        await this.post(`${createdSpace.id}/archive`, {archiveReason: 'need to be archived'}, jwtToken.accessToken).expect(
            HttpStatus.CREATED
        );

        this.logger.log('The space should be archived');
        const {body: archviedSpace} = await this.get(`${spaceResponse.id}`, jwtToken.accessToken).expect(HttpStatus.OK);
        expect(archviedSpace.archivedAt).toBeDefined();
        expect(archviedSpace.archivedBy).toBeDefined();

        await this.post(`${createdSpace.id}/restore`, {}, jwtToken.accessToken).expect(HttpStatus.CREATED);

        this.logger.log('The space should be unarchived, and an restore_archive action should be created');
        const {body: unarchviedSpace} = await this.get(`${spaceResponse.id}`, jwtToken.accessToken).expect(HttpStatus.OK);
        expect(unarchviedSpace.archivedAt).toBe(null);
        expect(unarchviedSpace.archivedBy).toBe(null);

        const {
            body: {data: spaceStream},
        } = await this.get(`/stream-view/folder/${spaceResponse.id}`, jwtToken.accessToken);
        expect(
            spaceStream[0].actions.find((action) => action.folderId === unarchviedSpace.id && action.action === 'restore_archive')
        ).toBeDefined();
    }

    /**
     * Creates a custom field collection.
     *
     * @param {string} token - The authentication token.
     * @returns {Promise<{cfcId: number}>} A promise that resolves with an object containing the ID of the created custom field collection.
     */
    private async createSpaceCustomFieldCollection(token: string): Promise<{cfcId: number}> {
        const customFieldDefinitionOptions = this.customFieldFactory.fakeCreateCustomFieldDefinitionOptions();
        const customFieldDefinitionDto = this.customFieldFactory.fakeCreateCustomFieldDefinition(customFieldDefinitionOptions);
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
     * Creates a team for a given space.
     *
     * @param {string} token - The token used for authentication.
     * @return {Promise<{teamId: number}>} A promise that resolves with an object containing the teamId.
     */
    private async createTeamForSpace(token: string): Promise<{teamId: number}> {
        const userId = this.getUserIdFromAccessToken(token);
        const fakeCreateTeamDto = this.teamFactory.fakeCreateTeamDto([userId]);
        const {body: teamResponse} = await this.post(`/team`, fakeCreateTeamDto, token).expect(HttpStatus.CREATED);
        expect(teamResponse.id).toBeDefined();
        return {teamId: teamResponse.id};
    }

    /**
     * Creates a workflow for a given folder.
     *
     * @param {string} token - The authentication token.
     *
     * @return {Promise<WorkFlowEntity>} - A promise that resolves with the created workflow.
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
     * Creates a user with the given permissions.
     *
     * @returns {Promise<{token: TokenInterface}>} - A promise that resolves to an object containing the user's token.
     */
    private async createUserWithPermissions(): Promise<{token: TokenInterface}> {
        this.logger.log(`Create user`);
        const fakeUser = await this.userFactory.createUserForLogin({
            workflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            folder: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            folderWorkflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            commonCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            userCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            teams: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            customFieldCollection: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            displacementGroup: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            user: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            space: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        const {body: ret} = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        return {token: ret};
    }

    /**
     * Creates a space for a user with the specified ID and access token.
     *
     * @param {string} userId - The ID of the user.
     * @param {string} accessToken - The access token for authentication.
     * @param {number[]} [workflowIds] - Optional array of workflow IDs. If provided, the space will be created with the specified workflows.
     *
     * @returns {Promise<GetFolderDto>} - A promise that resolves to the created space.
     */
    private async createSpaceMethod(userId: string, accessToken: string, workflowIds?: number[]): Promise<GetFolderDto> {
        this.logger.log('create workflow');
        const workflow: WorkFlowEntity = await this.createWorkflowForFolder(accessToken);
        this.logger.log('create a team');
        const {teamId} = await this.createTeamForSpace(accessToken);
        this.logger.log('create custom field collection');
        const {cfcId} = await this.createSpaceCustomFieldCollection(accessToken);
        this.logger.log('create a space');
        const fakeCreateSpace = this.folderFactory.fakeCreateSpace({
            availableWorkflows: workflowIds ? workflowIds : [workflow.id],
            teams: [{id: teamId, teamPermission: UserPermissionOptions.FULL}],
            customFieldCollections: [cfcId],
        });
        const {body: spaceResponse} = await this.post(`/space`, fakeCreateSpace, accessToken).expect(HttpStatus.CREATED);
        expect(spaceResponse).toBeDefined();
        return spaceResponse;
    }
}
