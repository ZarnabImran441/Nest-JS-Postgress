import {faker} from '@faker-js/faker';
import {TASK_MANAGEMENT, TokenInterface} from '@lib/base-library';
import {HttpStatus, Inject, Logger, OnModuleInit} from '@nestjs/common';
import {Test, TestSuite} from 'nestjs-jest-decorators';
import {ChangeWorkflowFolderDto, ChangeWorkflowOptions} from '../../src/dto/folder/folder/change-workflow.dto';
import {GetFolderDto} from '../../src/dto/folder/folder/get-folder.dto';
import {UserPermissionOptions} from '../../src/enum/folder-user.enum';
import {DefaultViewOptions} from '../../src/enum/folder.enum';
import {TreeViewEntity} from '../../src/model/tree-view.entity';
import {WorkFlowEntity} from '../../src/model/workflow.entity';
import {EntityTypeOptions, PermissionOptions} from '../../src/module/authorization-impl/authorization.enum';
import {CustomFieldCollectionFactory} from '../factory/custom-field-collection.factory';
import {CustomFieldFactory} from '../factory/custom-field.factory';
import {FolderFactory} from '../factory/folder.factory';
import {TeamFactory} from '../factory/team.factory';
import {TreeViewFolderFactory} from '../factory/tree-view-folder.factory';
import {TreeViewFactory} from '../factory/tree-view.factory';
import {UserFactory} from '../factory/user.factory';
import {WorkflowFactory} from '../factory/workflow.factory';
import {NewBaseTest} from './base-test';

@TestSuite('Tree View Suite')
export class TreeViewE2eSpec extends NewBaseTest implements OnModuleInit {
    private readonly logger = new Logger(TreeViewE2eSpec.name);

    @Inject()
    private factory: TreeViewFactory;
    @Inject()
    private userFactory: UserFactory;
    @Inject()
    private folderFactory: FolderFactory;
    @Inject()
    private workflowFactory: WorkflowFactory;
    @Inject()
    private treeViewFolderFactory: TreeViewFolderFactory;
    @Inject()
    private teamFactory: TeamFactory;

    private customFieldCollectionFactory: CustomFieldCollectionFactory = new CustomFieldCollectionFactory();
    private customFieldDefinitionFactory = new CustomFieldFactory();

    onModuleInit(): void {
        this.setUrl('/tree-views');
    }

    /**
     * Creates a tree view for a user.
     *
     * @returns {Promise<{jwtToken: TokenInterface; treeView: TreeViewEntity; folderIds: number[]}>} A promise that resolves with an object containing the JWT token, the created tree view entity, and the folder IDs.
     */
    @Test('Create tree view')
    async createTreeView(): Promise<{jwtToken: TokenInterface; treeView: TreeViewEntity; folderIds: number[]}> {
        this.logger.log(`Create user`);
        const fakeUser = await this.userFactory.createUserForLogin({
            [EntityTypeOptions.TreeView]: PermissionOptions.CREATE_READ_UPDATE_DELETE,
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
        const loggedUser = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        expect(loggedUser.status).toBe(HttpStatus.CREATED);
        const jwtToken = loggedUser.body;
        this.logger.log(`create folders`);
        const folderIds = await this.createFolders(faker.number.int({min: 1, max: 3}), jwtToken);
        this.logger.log(`create treeView`);
        const fakeTreeView = this.factory.fakeCreateTreeView(folderIds, 0),
            newTreeView = await this.post(``, fakeTreeView, jwtToken.accessToken);
        expect(newTreeView.status).toBe(HttpStatus.CREATED);
        this.logger.log(`check treeView exists`);
        const userTreeViews = await this.get(``, jwtToken.accessToken);
        expect(userTreeViews.status).toBe(HttpStatus.OK);
        expect(userTreeViews.body[0].id).toBe(newTreeView.body.id);
        return {jwtToken, treeView: newTreeView.body, folderIds};
    }

    /**
     * Updates the tree view by creating a new tree view, updating the existing tree view with the new one,
     * and checking if the new tree view exists.
     *
     * @return {Promise<void>} A promise that resolves when the tree view is updated successfully.
     */
    @Test('Update tree view')
    async updateTreeView(): Promise<void> {
        const ret = await this.createTreeView();
        this.logger.log(`update existing treeView`);
        const newTreeViewDto = this.factory.fakeCreateTreeView(faker.helpers.arrayElements(ret.folderIds), ret.treeView.index);
        let response = await this.put(`${ret.treeView.id}`, newTreeViewDto, ret.jwtToken.accessToken);
        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body.affected).toBe(1);
        this.logger.log(`check new treeView exists`);
        response = await this.get(``, ret.jwtToken.accessToken);
        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body[0]).toMatchObject(newTreeViewDto);
    }

    /**
     * Deletes the common treeView.
     *
     * @returns {Promise<void>} A promise that resolves once the treeView is deleted.
     */
    @Test('Delete tree view')
    async deleteTreeView(): Promise<void> {
        const ret = await this.createTreeView();
        this.logger.log(`delete existing common treeView`);
        let response = await this.delete(`${ret.treeView.id}`, ret.jwtToken.accessToken);
        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body.affected).toBe(1);
        this.logger.log(`check common treeView does not exists`);
        response = await this.get(``, ret.jwtToken.accessToken);
        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body).not.toContainEqual(ret.treeView);
    }

    /**
     * Activate the tree-view.
     * This method creates a tree-view, sets it as active, and verifies if it has been successfully set as active.
     *
     * @returns {Promise<void>} - A Promise that resolves when the tree-view is set as active.
     */
    @Test('Set active tree-view')
    async setActiveTreeView(): Promise<void> {
        this.logger.log('create a tree-view');
        const ret = await this.createTreeView();
        this.logger.log('set active tree-view');
        const {body: response} = await this.get(`set-active/${ret.treeView.id}`, ret.jwtToken.accessToken).expect(HttpStatus.OK);
        expect(response.affected).toEqual(1);
        const {body: data} = await this.get(``, ret.jwtToken.accessToken);
        const treeViewResponse = data.find((tr) => tr.id == ret.treeView.id);
        expect(treeViewResponse.active).toBeTruthy();
    }

    /**
     * Updates the position of a tree-view.
     *
     * @return {Promise<void>} A Promise that resolves once the position has been updated.
     */
    @Test('Update tree-view position')
    async updateTreeViewPosition(): Promise<void> {
        this.logger.log('create a tree-view');
        const ret = await this.createTreeView();
        this.logger.log('update position of tree-view');
        const {body: response} = await this.put(`position/${ret.treeView.id}`, {index: 2}, ret.jwtToken.accessToken).expect(HttpStatus.OK);
        expect(response[0].id).toEqual(ret.treeView.id);
        expect(response[0].index).toEqual(2);
    }

    /**
     * Removes the old tree views.
     *
     * This method cleans up the old tree views by deleting all the entries from the treeViewFolderFactory
     * and factory starting at index 0.
     *
     * @returns {Promise<void>} A promise that resolves once the cleanup is complete.
     */
    private async RemoveOldTreeViews(): Promise<void> {
        this.logger.log(`Clean old treeView`);
        await this.treeViewFolderFactory.deleteAllByIndex(0);
        await this.factory.deleteAllByIndex(0);
    }

    /**
     * Creates multiple folders and returns their IDs.
     *
     * @param {number} folders - The number of folders to create.
     * @param {TokenInterface} jwtToken - The JWT token.
     * @returns {Promise<number[]>} - An array of folder IDs.
     */
    private async createFolders(folders: number, jwtToken: TokenInterface): Promise<number[]> {
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);

        const ret: number[] = [],
            {body: systemStages} = await this.get(`/displacement-group/system-stage`, jwtToken.accessToken),
            fakeWorkflow = this.workflowFactory.fakeCreateWorkflow(systemStages[0]?.id),
            {body: workflow, status} = await this.post(`/workflow`, fakeWorkflow, jwtToken.accessToken);
        expect(status).toBe(HttpStatus.CREATED);
        const {body: workflowDB, status: workflowDBStatus} = await this.get(`/workflow/${workflow.id}`, jwtToken.accessToken);
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
        this.logger.log('create workflow');
        const fakeChangeWorkflow: ChangeWorkflowFolderDto = {
            commonWorkflow: workflow.id,
            type: ChangeWorkflowOptions.COMMON_TO_COMMON,
            Mapping: [],
            personaliseWorkflow: null,
        };
        const spaceResponse = await this.createSpace(userId, jwtToken.accessToken, [workflow.id]);
        this.logger.log(`create ${folders} folders`);
        for (let i = 0; i < folders; i++) {
            const fakeFolder = this.folderFactory.fakeCreateFolder(
                    fakeChangeWorkflow,
                    null,
                    DefaultViewOptions.BOARD,
                    [TASK_MANAGEMENT],
                    spaceResponse.id
                ),
                folder = await this.post(`/folder`, fakeFolder, jwtToken.accessToken);
            expect(folder.status).toBe(HttpStatus.CREATED);
            ret.push(folder.body.id);
        }
        return ret;
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
