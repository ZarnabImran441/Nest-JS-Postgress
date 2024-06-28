import {faker} from '@faker-js/faker';
import {TASK_MANAGEMENT, TokenInterface} from '@lib/base-library';
import {HttpStatus, Inject, Logger, OnModuleInit} from '@nestjs/common';
import {Test, TestSuite} from 'nestjs-jest-decorators';
import {Test as TestResponse} from 'supertest';
import {ChangeWorkflowFolderDto, ChangeWorkflowOptions} from '../../src/dto/folder/folder/change-workflow.dto';
import {FolderTreeDto} from '../../src/dto/folder/folder/folder-tree.dto';
import {GenericMemberDto} from '../../src/dto/folder/folder/generic-member.dto';
import {GetFolderDto} from '../../src/dto/folder/folder/get-folder.dto';
import {CreateDependencyDto} from '../../src/dto/task/create-predecessor.dto';
import {MoveManyTasksDto} from '../../src/dto/task/move-many-tasks.dto';
import {CreateTaskActionDto} from '../../src/dto/task/task-action/create-task-action.dto';
import {TaskSharedDto} from '../../src/dto/task/task-shared.dto';
import {TaskAssigneesDto, UpdateManyTaskDto, UpdateTaskPositionDto} from '../../src/dto/task/update-task.dto';
import {CustomFieldDefinitionTypeOptions} from '../../src/enum/custom-field-definition.enum';
import {FolderViewOptions} from '../../src/enum/folder-position.enum';
import {RelationTypeOptions} from '../../src/enum/folder-task-predecessor.enum';
import {UserPermissionOptions} from '../../src/enum/folder-user.enum';
import {DefaultViewOptions, FolderViewTypeOptions} from '../../src/enum/folder.enum';
import {WorkFlowEntity} from '../../src/model/workflow.entity';
import {PermissionOptions} from '../../src/module/authorization-impl/authorization.enum';
import {CustomFieldFactory} from '../factory/custom-field.factory';
import {FolderFactory} from '../factory/folder.factory';
import {TagFactory} from '../factory/tag.factory';
import {TaskFactory} from '../factory/task.factory';
import {PermissionsType, UserFactory} from '../factory/user.factory';
import {WorkflowFactory} from '../factory/workflow.factory';
import {NewBaseTest} from './base-test';
import {TaskActionEntity} from '../../src/model/task-action.entity';
import {InsertResult} from 'typeorm';

@TestSuite('Task Suite')
export class TaskE2eSpec extends NewBaseTest implements OnModuleInit {
    private readonly logger = new Logger(TaskE2eSpec.name);

    @Inject()
    private factory: TaskFactory;
    @Inject()
    private userFactory: UserFactory;
    @Inject()
    private workflowFactory: WorkflowFactory;
    @Inject()
    private folderFactory: FolderFactory;
    @Inject()
    private tagFactory: TagFactory;

    private customFieldDefinitionFactory = new CustomFieldFactory();

    onModuleInit(): void {
        this.setUrl('/task');
    }

    // Todo : Test case for workflow change and custom field's
    /**
     * Performs the necessary steps to create a new task.
     * This includes creating a user and a folder, getting the user ID,
     * creating the task with the given details, and verifying its existence
     * in the folder and folder task tree.
     *
     * @returns {Promise<void>} A Promise that resolves when the task creation process is complete.
     */
    // @Test()
    // async createTask(): Promise<void> {
    //     this.logger.log('create user and folder');
    //     const {folder, jwtToken, spaceId, workflowDB} = await this.createFolder();
    //     this.logger.log('get user id', spaceId);
    //     const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
    //     this.logger.log('create task');
    //     const fakeTask = this.factory.fakeCreateTask(userId, folder.id);
    //     const {body: task} = await this.post(``, fakeTask, jwtToken.accessToken).expect(HttpStatus.CREATED);
    //     expect(task.description).toBe(fakeTask.description);
    //     expect(task.title).toBe(fakeTask.title);
    //     expect(task.startDate).toBe(fakeTask.startDate.toISOString());

    //     {
    //         this.logger.log('Create a sub folder and a task in it to check for duplicates later');
    //         const {folder: childFolder} = await this.createFolder(folder.id, jwtToken, workflowDB.id, spaceId);

    //         const fakeTask2 = this.factory.fakeCreateTask(userId, childFolder.id);
    //         await this.post(``, fakeTask2, jwtToken.accessToken).expect(HttpStatus.CREATED);
    //     }

    //     this.logger.log('get folder tree');
    //     const {body: folderTree} = await this.get(`/folder/folder-tree`, jwtToken.accessToken).expect(HttpStatus.OK);
    //     expect(folderTree[0].children[0]).toMatchObject({id: folder.id, title: folder.title});
    //     this.logger.log('get folder task tree');
    //     const {body: folderTaskTree} = await this.post(
    //         `/folder-workflow/project/${folder.id}/${folder.defaultView}`,
    //         {},
    //         jwtToken.accessToken
    //     ).expect(HttpStatus.CREATED);
    //     expect(folderTaskTree[0].columns[0].tasks[0].id).toBe(task.id);
    //     expect(folderTaskTree[0].columns[0].tasks[0].title).toBe(task.title);
    //     expect(folderTaskTree[0].columns[0].tasks[0].folderId).toBe(folder.id);

    //     this.logger.log('Check for duplicate task ids in different columns');
    //     const taskIds = new Set<string>();
    //     folderTaskTree.forEach((folder) => {
    //         folder.columns.forEach((column) => {
    //             column.tasks.forEach((taskInColumn) => {
    //                 if (taskIds.has(taskInColumn.id)) {
    //                     throw new Error(`Duplicate task id found: ${taskInColumn.id}`);
    //                 }
    //                 taskIds.add(taskInColumn.id);
    //             });
    //         });
    //     });
    // }

    /**
     * Checks inherited permissions
     *
     * @return {Promise<void>}
     */
    @Test('Check inherited permissions')
    async checkInheritedPermissions(): Promise<void> {
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
            }),
            jwtToken = ret.body;
        const {body: fakeJwtToken1} = await this.createUserWithPermissions({
            workflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            folder: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            space: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        const fakeUser1Id = this.getUserIdFromAccessToken(fakeJwtToken1.accessToken);

        const {body: fakeJwtToken2} = await this.createUserWithPermissions({
            workflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            folder: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            space: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        const fakeUser2Id = this.getUserIdFromAccessToken(fakeJwtToken2.accessToken);

        this.logger.log('create space');
        const workflow: WorkFlowEntity = await this.createWorkflowForFolder(jwtToken.accessToken);
        const spaceResponse = await this.createSpace(
            jwtToken.accessToken,
            [workflow.id],
            [
                {id: fakeUser1Id, userPermission: UserPermissionOptions.FULL},
                {id: fakeUser2Id, userPermission: UserPermissionOptions.FULL},
            ]
        );
        this.logger.log('create user and folder');
        const {folder} = await this.createFolder(null, jwtToken, workflow.id, spaceResponse.id);

        this.logger.log('Create a sub folder of level 1');
        const {folder: subFolder} = await this.createFolder(folder.id, jwtToken, workflow.id, spaceResponse.id);
        this.logger.log('Create a sub folder of level 2', subFolder);
        const {folder: subSubFolder} = await this.createFolder(subFolder.id, jwtToken, workflow.id, spaceResponse.id);
        this.logger.log('Create a sub folder of level 3', subSubFolder);

        await this.patch(
            `/folder/members/${folder.id}`,
            {insert: [{id: fakeUser1Id, userPermission: UserPermissionOptions.FULL}], delete: [], update: []},
            jwtToken.accessToken
        ).expect(HttpStatus.OK);

        this.logger.log('get folder tree');
        let folderTree = (await this.get(`/folder/folder-tree`, jwtToken.accessToken)).body as FolderTreeDto[];

        // get inherited permissions of subfolder1 (fakeUserId should be there)
        //folder
        let hasInheritedPermission: boolean = folderTree[0].children[0].members?.some(
            (member) => member.userId === fakeUser1Id && !member.inherit
        );
        expect(hasInheritedPermission).toBe(true);

        // get inherited permissions of subfolder2 (fakeUserId should be there)
        hasInheritedPermission = folderTree[0].children[0].children[0].members?.some(
            (member) => member.userId === fakeUser1Id && member.inherit
        );
        expect(hasInheritedPermission).toBe(true);

        //last child
        hasInheritedPermission = folderTree[0].children[0].children[0].children[0].members?.some(
            (member) => member.userId === fakeUser1Id && member.inherit
        );
        expect(hasInheritedPermission).toBe(true);

        // make parent private (has the effect of clearing all inherited permissions from subfolders)
        await this.patch(`/folder/${folder.id}`, {viewType: FolderViewTypeOptions.PRIVATE}, jwtToken.accessToken).expect(HttpStatus.OK);

        this.logger.log('get folder tree');
        folderTree = (await this.get(`/folder/folder-tree?space-ids=${spaceResponse.id}`, jwtToken.accessToken)).body as FolderTreeDto[];

        // get inherited permissions of subfolder1 (fakeUserId shouldn't be there)
        hasInheritedPermission = folderTree[0].children[0].members?.some((member) => member.userId === fakeUser1Id && member.inherit);
        expect(hasInheritedPermission).toBe(false);

        // get inherited permissions of subfolder2 (fakeUserId shouldn't be there)
        hasInheritedPermission = folderTree[0].children[0].children[0].members?.some(
            (member) => member.userId === fakeUser1Id && member.inherit
        );
        expect(hasInheritedPermission).toBe(false);
    }

    /**
     * Updates the assignee list for a task.
     *
     * @return {Promise<void>} Promise that resolves once the assignee update is complete.
     */
    @Test('Update Task Assignee')
    async updateTaskAssignee(): Promise<void> {
        this.logger.log('create user and folder');
        const {folder, jwtToken} = await this.createFolder();
        this.logger.log('get user id');
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        this.logger.log('create task');
        const fakeTask = this.factory.fakeCreateTask(userId, folder.id);
        const {body: task} = await this.post(``, fakeTask, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(task.description).toBe(fakeTask.description);
        expect(task.title).toBe(fakeTask.title);
        expect(task.startDate).toBe(fakeTask.startDate.toISOString());

        //check if a user can add and removed from an assignee list for a task
        this.logger.log('add owner as assignee to task');
        let data: TaskAssigneesDto = {
            folderId: folder.id,
            assignees: [userId],
        };
        await this.patch(`assignees/${task.id}`, data, jwtToken.accessToken).expect(HttpStatus.OK);

        this.logger.log('get task with new assignees');
        const {body: taskWithAssignee} = await this.get(`/task/${task.id}/folder/${folder.id}`, jwtToken.accessToken).expect(HttpStatus.OK);
        expect(taskWithAssignee.assignees.length).toBe(1);
        expect(taskWithAssignee.assignees[0]).toBe(userId);

        this.logger.log('validate we have task action with the added assignee');
        const {body: taskActionAssigneeAdded} = await this.get(
            `/task-action/folder/${folder.id}/task/${task.id}`,
            jwtToken.accessToken
        ).expect(HttpStatus.OK);
        expect(taskActionAssigneeAdded).toContainObject({parameters: {assignees: {added: [userId], removed: []}}});

        this.logger.log('remove owner as assignee from task');
        data = {
            folderId: folder.id,
            assignees: [],
        };
        await this.patch(`assignees/${task.id}`, data, jwtToken.accessToken).expect(HttpStatus.OK);
        const {body: taskWithoutAssignee} = await this.get(`/task/${task.id}/folder/${folder.id}`, jwtToken.accessToken).expect(
            HttpStatus.OK
        );
        expect(taskWithoutAssignee.assignees.length).toBe(0);

        this.logger.log('validate we have task action with the added assignee');
        const {body: taskActionAssigneeRemoved} = await this.get(
            `/task-action/folder/${folder.id}/task/${task.id}`,
            jwtToken.accessToken
        ).expect(HttpStatus.OK);
        expect(taskActionAssigneeRemoved).toContainObject({parameters: {assignees: {added: [], removed: [userId]}}});
    }

    /**
     * Checks if the auto child task assignee is functioning correctly.
     *
     * @returns {Promise<void>} A promise that resolves when the check is complete.
     */
    @Test('Check Auto Child Task Assignee')
    async CheckAutoChildTaskAssignee(): Promise<void> {
        this.logger.log('create user and folder');
        const {folder, jwtToken} = await this.createFolder();
        this.logger.log('get user id');
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        this.logger.log('create task');
        const fakeTask = this.factory.fakeCreateTask(userId, folder.id);
        const {body: task} = await this.post(``, fakeTask, jwtToken.accessToken).expect(HttpStatus.CREATED);
        const fakeChildTask = this.factory.fakeCreateTask(userId, folder.id, task.id);
        const {body: childTask} = await this.post(``, fakeChildTask, jwtToken.accessToken).expect(HttpStatus.CREATED);
        this.logger.log('add owner as assignee to task');
        const data: TaskAssigneesDto = {
            folderId: folder.id,
            assignees: [userId],
        };
        await this.patch(`assignees/${task.id}`, data, jwtToken.accessToken).expect(HttpStatus.OK);

        const {body: taskWithAssignee} = await this.get(`/task/${task.id}/folder/${folder.id}`, jwtToken.accessToken).expect(HttpStatus.OK);
        expect(taskWithAssignee.assignees.length).toBe(1);
        expect(taskWithAssignee.assignees[0]).toBe(userId);
        const {body: childTaskResponse} = await this.get(`/task/${childTask.id}/folder/${folder.id}`, jwtToken.accessToken).expect(
            HttpStatus.OK
        );
        expect(childTaskResponse.assignees.length).toBe(0);
    }

    /**
     * Get assigned tasks for the current user.
     *
     * @returns {Promise<void>}
     */
    @Test('Get Assigned to me Tasks')
    async getAssignedTask(): Promise<void> {
        this.logger.log('create user and folder');
        const {folder, jwtToken: myJwtToken, spaceId} = await this.createFolder();
        this.logger.log('get user id');
        const myUserId = this.getUserIdFromAccessToken(myJwtToken.accessToken);
        this.logger.log('create task');
        const myFakeTask = this.factory.fakeCreateTask(myUserId, folder.id);
        const {body: task} = await this.post(``, myFakeTask, myJwtToken.accessToken).expect(HttpStatus.CREATED);
        this.logger.log('add user as assignee to task');
        // await this.auth.grantToUser(PermissionOptions.READ, EntityTypeOptions.Folder, myUserId, task.id);
        let data: TaskAssigneesDto = {
            folderId: folder.id,
            assignees: [myUserId],
        };
        await this.patch(`assignees/${task.id}`, data, myJwtToken.accessToken).expect(HttpStatus.OK);
        this.logger.log('validate my task');
        const {body: taskWithAssignee} = await this.get(`${task.id}/folder/${folder.id}`, myJwtToken.accessToken).expect(HttpStatus.OK);
        expect(taskWithAssignee.assignees.length).toBe(1);
        expect(taskWithAssignee.assignees[0]).toBe(myUserId);

        const {body: fakeJwtToken} = await this.createUserWithPermissions({
            workflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            folder: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            // task: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        const fakeUserId = this.getUserIdFromAccessToken(fakeJwtToken.accessToken);

        this.logger.log('add member to space');
        const updateMembersDto = {
            insert: [{id: fakeUserId, userPermission: UserPermissionOptions.FULL}],
            update: [],
            delete: [],
        };
        await this.patch(`/space/${spaceId}/members`, updateMembersDto, myJwtToken.accessToken).expect(HttpStatus.OK);

        this.logger.log('add member to folder');
        await this.patch(
            `/folder/members/${folder.id}`,
            {insert: [{id: fakeUserId, userPermission: UserPermissionOptions.FULL}], delete: [], update: []},
            myJwtToken.accessToken
        ).expect(HttpStatus.OK);

        this.logger.log('add another task to folder with different assignee to folder ');
        const fakeChildTaskData = this.factory.fakeCreateTask(fakeUserId, folder.id);
        const {body: fakeChildTask} = await this.post(``, fakeChildTaskData, fakeJwtToken.accessToken).expect(HttpStatus.CREATED);
        this.logger.log('add user as assignee to task');
        // await this.auth.grantToUser(PermissionOptions.READ, EntityTypeOptions.Folder, fakeUserId, fakeChildTask.id);
        data = {
            folderId: folder.id,
            assignees: [fakeUserId],
        };
        await this.patch(`assignees/${fakeChildTask.id}`, data, myJwtToken.accessToken).expect(HttpStatus.OK);

        const {body: taskAssignedToMe} = await this.post(`/task/assigned`, {}, myJwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(taskAssignedToMe.tasks.length).toBe(1);
        expect(taskAssignedToMe.tasks[0].assignees[0]).toBe(myUserId);
    }

    /**
     * Performs an automated user task of adding a comment to a task in a folder.
     *
     * @returns {Promise<void>} - A Promise that resolves when the automation is completed successfully.
     */
    @Test('Automation User Add Comment')
    async automationUserAddComment(): Promise<void> {
        this.logger.log('create user and folder');
        const {folder, jwtToken} = await this.createFolder();
        this.logger.log('get user id');
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        this.logger.log('create task');
        const fakeTask = this.factory.fakeCreateTask(userId, folder.id);
        const {body: task} = await this.post(``, fakeTask, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(task.description).toBe(fakeTask.description);
        expect(task.title).toBe(fakeTask.title);
        expect(task.startDate).toBe(fakeTask.startDate.toISOString());
        this.logger.log('get folder tree');
        const {body: folderTree} = await this.get(`/folder/folder-tree`, jwtToken.accessToken).expect(HttpStatus.OK);
        expect(folderTree[0].children[0]).toMatchObject({id: folder.id, title: folder.title});
        this.logger.log('get folder task tree');
        const {body: folderTaskTree} = await this.post(
            `/folder-workflow/project/${folder.id}/${folder.defaultView}`,
            {},
            jwtToken.accessToken
        ).expect(HttpStatus.CREATED);
        expect(folderTaskTree[0].columns[0].tasks[0].id).toBe(task.id);
        expect(folderTaskTree[0].columns[0].tasks[0].title).toBe(task.title);
        expect(folderTaskTree[0].columns[0].tasks[0].folderId).toBe(folder.id);
        const automationUser = await this.logUser(this.userFactory.getPasServiceUserLoginDto());
        const commentDto: CreateTaskActionDto = {comment: 'this is a test comment', mentionMembers: [userId]};
        const {body: respComment} = await this.post(
            `/task-action/folder/${folder.id}/task/${task.id}/comment`,
            commentDto,
            automationUser.accessToken
        ).expect(HttpStatus.CREATED);
        const {body: commentGet} = await this.get(`/task-action/folder/${folder.id}/task/${task.id}`, jwtToken.accessToken).expect(
            HttpStatus.OK
        );
        expect(commentGet as TaskActionEntity[]).toContainObject({id: (respComment as InsertResult).identifiers[0].id});
        expect(commentGet as TaskActionEntity[]).toContainObject({taskId: task.id});
    }

    // Test case for custom field value validation on a task
    /**
     * Creates a custom field on a task.
     *
     * @returns {Promise<void>} - a Promise that resolves when the custom field is created successfully
     */
    @Test('Custom Field of Task')
    async createCustomFieldOnTask(): Promise<void> {
        this.logger.log('create user and folder');
        const {folder, jwtToken} = await this.createFolder();
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        const fakeTask = this.factory.fakeCreateTask(userId, folder.id);

        this.logger.log('create task');
        const {body: task} = await this.post(``, fakeTask, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(task.description).toBe(fakeTask.description);
        expect(task.title).toBe(fakeTask.title);
        expect(task.startDate).toBe(fakeTask.startDate.toISOString());
        const customFieldDefinitionDto = this.customFieldDefinitionFactory.fakeCreateCustomFieldDefinition(
            [],
            CustomFieldDefinitionTypeOptions.WEBSITE
        );

        this.logger.log('create custom field definition');
        const {body: customField} = await this.post('/custom-field-definition', customFieldDefinitionDto, jwtToken.accessToken).expect(
            HttpStatus.CREATED
        );
        const {body: customFields} = await this.get('/custom-field-definition?show-inactive=false', jwtToken.accessToken).expect(
            HttpStatus.OK
        );
        expect(customFields.length).toBeGreaterThanOrEqual(1);
        const createdCF = customFields.find((cf: {id: number}) => cf.id === customField.identifiers[0].id);
        expect(createdCF.type).toBe(CustomFieldDefinitionTypeOptions.WEBSITE);

        this.logger.log('create custom field value');
        const customFieldValue = 'www.google.com';
        await this.post(
            `custom-field/folder/${folder.id}/task/${task.id}`,
            {insert: [customField.identifiers[0].id], delete: []},
            jwtToken.accessToken
        ).expect(HttpStatus.CREATED);
        await this.patch(
            `custom-field/${customField.identifiers[0].id}/folder/${folder.id}/task/${task.id}?value=${customFieldValue}`,
            {},
            jwtToken.accessToken
        ).expect(HttpStatus.OK);

        const {body: taskCustomFields} = await this.get(`custom-field/folder/${folder.id}/task/${task.id}`, jwtToken.accessToken).expect(
            HttpStatus.OK
        );
        const customFieldWithValue = taskCustomFields.customFields.find((cf: {value: string}) => cf.value === customFieldValue);
        expect(customFieldWithValue).toBeDefined();

        const badCustomFieldValue = 'www.google';
        await this.patch(
            `custom-field/${customField.identifiers[0].id}/folder/${folder.id}/task/${task.id}?value=${badCustomFieldValue}`,
            {},
            jwtToken.accessToken
        ).expect(HttpStatus.BAD_REQUEST);
    }

    /**
     * Retrieves the followers of a task.
     *
     * update: follow task query is no longer needed as creating a task will add the creator as follower automatically
     *
     * @returns {Promise<void>} A Promise that resolves if the operation is successful. Otherwise, it rejects with an error.
     * @throws {Error} If an error occurs during the operation.
     */
    @Test('Get Task Followers')
    async getTaskFollowers(): Promise<void> {
        this.logger.log('create user and folder');
        const {folder, jwtToken} = await this.createFolder();
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        const fakeTask = this.factory.fakeCreateTask(userId, folder.id);

        this.logger.log('create task');
        const {body: task} = await this.post(``, fakeTask, jwtToken.accessToken).expect(HttpStatus.CREATED);
        // this.logger.log('add follower to a task');
        // await this.post(`follow/${folder.id}/${task.id}/${userId}`, {}, jwtToken.accessToken).expect(HttpStatus.CREATED);
        this.logger.log('get task with the follower');
        const {body: followers} = await this.get(`follow/${task.id}/folder/${folder.id}`, jwtToken.accessToken);
        expect(followers.length).toBe(1);
        expect(followers[0].userId).toBe(userId);
    }

    /**
     * Unfollows a task by removing the user as a follower.
     *
     * update: follow task query is no longer needed as creating a task will add the creator as follower automatically
     *
     * @returns {Promise<void>} A promise that resolves when the task has been unfollowed successfully.
     */
    @Test('Unfollow Task')
    async unFollowTask(): Promise<void> {
        this.logger.log('create user and folder');
        const {folder, jwtToken} = await this.createFolder();
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        const fakeTask = this.factory.fakeCreateTask(userId, folder.id);

        this.logger.log('create task');
        const {body: task} = await this.post(``, fakeTask, jwtToken.accessToken).expect(HttpStatus.CREATED);
        // this.logger.log('add follower to task');
        // await this.post(`follow/${folder.id}/${task.id}/${userId}`, {}, jwtToken.accessToken).expect(HttpStatus.CREATED);
        this.logger.log('remove follower from task');
        await this.delete(`unfollow/${folder.id}/${task.id}/${userId}`, jwtToken.accessToken).expect(HttpStatus.OK);
        const {body: followers} = await this.get(`follow/${task.id}/folder/${folder.id}`, jwtToken.accessToken);
        expect(followers.length).toEqual(0);
    }

    /**
     * Deletes a task by its ID.
     *
     * This method follows the following steps:
     * 1. Creates a user and folder.
     * 2. Obtains the JWT token from creating the folder.
     * 3. Gets the user ID from the JWT token.
     * 4. Creates a fake task using the user ID and folder ID.
     * 5. Sends a POST request to create the task.
     * 6. Expects the task ID to be defined in the response body.
     * 7. Sends a DELETE request to delete the task by its ID.
     * 8. Expects the response status to be HttpStatus.OK (200).
     * 9. Sends a GET request to verify that the task is indeed deleted.
     * 10. Expects the response status to be HttpStatus.NOT_FOUND (404).
     *
     * @returns {Promise<void>} A Promise that resolves when the task is successfully deleted.
     */
    @Test('Delete Task by ID')
    async deleteTaskById(): Promise<void> {
        this.logger.log('create user and folder');
        const {folder, jwtToken} = await this.createFolder();
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        const fakeTask = this.factory.fakeCreateTask(userId, folder.id);
        this.logger.log('create task');
        const {body: task} = await this.post(``, fakeTask, jwtToken.accessToken);
        expect(task.id).toBeDefined();

        this.logger.log('delete task by id');
        await this.delete(`folder/${folder.id}/task/${task.id}`, jwtToken.accessToken).expect(HttpStatus.OK);
        const {body: response} = await this.get(`${task.id}/folder/${folder.id}`, jwtToken.accessToken);
        expect(response.statusCode).toBe(HttpStatus.NOT_FOUND);
    }

    /**
     * Deletes multiple tasks from a folder.
     *
     * @return {Promise<void>} A Promise that resolves when the tasks are deleted.
     */
    @Test('Delete Many Tasks')
    async deleteManyTasks(): Promise<void> {
        this.logger.log('create user and folder');
        const {folder, jwtToken} = await this.createFolder();
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        const fakeTask1 = this.factory.fakeCreateTask(userId, folder.id);
        const fakeTask2 = this.factory.fakeCreateTask(userId, folder.id);
        this.logger.log('create task');
        const {body: task1} = await this.post(``, fakeTask1, jwtToken.accessToken).expect(HttpStatus.CREATED);
        const {body: task2} = await this.post(``, fakeTask2, jwtToken.accessToken).expect(HttpStatus.CREATED);
        this.logger.log('delete tasks', [task1.id, task2.id]);
        await this.post(`folder/${folder.id}/delete-many`, {tasks: [task1.id, task2.id]}, jwtToken.accessToken).expect(HttpStatus.CREATED);
        const responseTask1 = await this.get(`${task1.id}/folder/${folder.id}`, jwtToken.accessToken);
        expect(responseTask1.statusCode).toBe(HttpStatus.NOT_FOUND);
        const responseTask2 = await this.get(`${task2.id}/folder/${folder.id}`, jwtToken.accessToken);
        expect(responseTask2.statusCode).toBe(HttpStatus.NOT_FOUND);
    }

    /**
     * Archives multiple tasks.
     *
     * This method creates a user and a folder, then creates two tasks within the folder.
     * It then archives the two tasks and verifies that they have been successfully archived.
     *
     * @returns {Promise<void>} A promise that resolves when the tasks have been archived.
     */
    @Test('Archive Many Tasks')
    async archiveManyTasks(): Promise<void> {
        this.logger.log('create user and folder');
        const {folder, jwtToken} = await this.createFolder();
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        const fakeTask1 = this.factory.fakeCreateTask(userId, folder.id);
        const fakeTask2 = this.factory.fakeCreateTask(userId, folder.id);
        this.logger.log('create task');
        const {body: task1} = await this.post(``, fakeTask1, jwtToken.accessToken).expect(HttpStatus.CREATED);
        const {body: task2} = await this.post(``, fakeTask2, jwtToken.accessToken).expect(HttpStatus.CREATED);
        this.logger.log('archive tasks', [task1.id, task2.id]);
        await this.post(`folder/${folder.id}/archive-many`, {tasks: [task1.id, task2.id]}, jwtToken.accessToken).expect(HttpStatus.CREATED);
        this.logger.log('get all archived tasks');
        const {body: response} = await this.get(`many/archive`, jwtToken.accessToken);
        expect(response.length).toBeGreaterThanOrEqual(2);
    }

    /**
     * Adds a tag to a task.
     *
     * @returns {Promise<void>} - A Promise that resolves when the tag is added to the task.
     */
    @Test('Add Tag to Task')
    async addTagToTask(): Promise<void> {
        this.logger.log('create user and folder');
        const {folder, jwtToken} = await this.createFolder();
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        const fakeTask = this.factory.fakeCreateTask(userId, folder.id);
        this.logger.log('create task');
        const {body: task} = await this.post(``, fakeTask, jwtToken.accessToken).expect(HttpStatus.CREATED);
        this.logger.log('create tag');
        const tag = await this.tagFactory.createTag();
        this.logger.log('add tag to task');
        await this.post(`tag/${task.id}/${tag.id}/${folder.id}`, {}, jwtToken.accessToken).expect(HttpStatus.CREATED);
        const {body: taskResponse} = await this.get(`${task.id}/folder/${folder.id}`, jwtToken.accessToken);
        expect(taskResponse.tags.length).toBe(1);
        expect(taskResponse.tags[0]).toBe(tag.id);
    }

    /**
     * Remove a tag from a task.
     *
     * @returns A Promise that resolves to void.
     */
    @Test('Remove Tag from Task')
    async removeTagFromTask(): Promise<void> {
        this.logger.log('create user and folder');
        const {folder, jwtToken} = await this.createFolder();
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        const fakeTask = this.factory.fakeCreateTask(userId, folder.id);
        this.logger.log('create task');
        const {body: task} = await this.post(``, fakeTask, jwtToken.accessToken).expect(HttpStatus.CREATED);
        const tag = await this.tagFactory.createTag();
        this.logger.log('add tag to task');
        await this.post(`tag/${task.id}/${tag.id}/${folder.id}`, {}, jwtToken.accessToken).expect(HttpStatus.CREATED);
        const {body: response} = await this.get(`${task.id}/folder/${folder.id}`, jwtToken.accessToken);
        expect(response.tags.length).toBe(1);
        expect(response.tags[0]).toBe(tag.id);
        this.logger.log('remove tag from task');
        await this.delete(`tag/${tag.id}/folder/${folder.id}/task/${task.id}`, jwtToken.accessToken).expect(HttpStatus.OK);
        const {body: taskResponse} = await this.get(`${task.id}/folder/${folder.id}`, jwtToken.accessToken);
        expect(taskResponse.tags.length).toEqual(0);
    }

    /**
     * Retrieves the tasks followed by the user.
     *
     * update: follow task query is no longer needed as creating a task will add the creator as follower automatically
     *
     * @returns {Promise<void>} - A promise that resolves when the operation is complete.
     */
    @Test('Get Following Tasks')
    async getFollowingTask(): Promise<void> {
        this.logger.log('create user and folder');
        const {folder, jwtToken} = await this.createFolder();
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        const fakeTask = this.factory.fakeCreateTask(userId, folder.id);
        this.logger.log('create task');
        const {body: task} = await this.post(``, fakeTask, jwtToken.accessToken).expect(HttpStatus.CREATED);
        // this.logger.log('add follower to task');
        // await this.post(`follow/${folder.id}/${task.id}/${userId}`, {}, jwtToken.accessToken).expect(HttpStatus.CREATED);
        this.logger.log('getting tasks followed by user');
        const {body: response} = await this.get(`following`, jwtToken.accessToken).expect(HttpStatus.OK);
        expect(response.length).toBe(1);
        expect(response[0].title).toBe(task.title);
    }

    /**
     * Archives a task by creating a user, folder, and task, and then archiving the task.
     *
     * @returns {Promise<void>} A Promise that resolves to undefined.
     */
    @Test('Archive Task')
    async archiveTask(): Promise<void> {
        this.logger.log('create user and folder');
        const {folder, jwtToken} = await this.createFolder();
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        const fakeTask = this.factory.fakeCreateTask(userId, folder.id);
        this.logger.log('create task');
        const {body: task} = await this.post(``, fakeTask, jwtToken.accessToken).expect(HttpStatus.CREATED);
        this.logger.log('archive task by id');
        await this.post(`archive/${task.id}/folder/${folder.id}`, {archiveReason: 'Archive this Task'}, jwtToken.accessToken).expect(
            HttpStatus.CREATED
        );
        const {body: response} = await this.get(`${task.id}/folder/${folder.id}`, jwtToken.accessToken);
        expect(response.statusCode).toBe(HttpStatus.NOT_FOUND);
    }

    /**
     * Restores an archived task.
     *
     * This method performs the following steps:
     *
     * 1. Creates a user and folder.
     * 2. Retrieves the payload containing the created folder and JWT token.
     * 3. Extracts the user ID from the JWT token.
     * 4. Generates a fake task using the user ID and folder ID.
     * 5. Sends a POST request to create the task, using the generated fake task and JWT token for authentication.
     * 6. Archives the task by sending a DELETE request with the task ID and folder ID.
     * 7. Verifies that the task is archived by sending a GET request and checking the response status code.
     * 8. Restores the archived task by sending a POST request with the task ID and folder ID.
     * 9. Retrieves the response payload, which contains the restored task.
     * 10. Verifies that the restored task's ID matches the original task's ID.
     *
     * @returns {Promise<void>} A promise that resolves once the archived task is restored.
     */
    @Test('Restore Archived Task')
    async restoreArchivedTask(): Promise<void> {
        this.logger.log('create user and folder');
        const {folder, jwtToken} = await this.createFolder();
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        const fakeTask = this.factory.fakeCreateTask(userId, folder.id);
        this.logger.log('create task');
        const {body: task} = await this.post(``, fakeTask, jwtToken.accessToken).expect(HttpStatus.CREATED);
        this.logger.log('archive task by id');
        await this.post(`archive/${task.id}/folder/${folder.id}`, {archiveReason: ''}, jwtToken.accessToken).expect(HttpStatus.CREATED);
        const {body: taskResponse} = await this.get(`${task.id}/folder/${folder.id}`, jwtToken.accessToken);
        expect(taskResponse.statusCode).toBe(HttpStatus.NOT_FOUND);
        this.logger.log('restore archived task by id');
        await this.post(`archive/restore/${task.id}/folder/${folder.id}`, {}, jwtToken.accessToken).expect(HttpStatus.CREATED);
        const {body: response} = await this.get(`${task.id}/folder/${folder.id}`, jwtToken.accessToken);
        expect(response.id).toBe(task.id);
    }

    /**
     * Restores a deleted task.
     *
     * This method performs the following steps:
     *
     * 1. Creates a user and folder.
     * 2. Retrieves the payload containing the created folder and JWT token.
     * 3. Extracts the user ID from the JWT token.
     * 4. Generates a fake task using the user ID and folder ID.
     * 5. Sends a POST request to create the task, using the generated fake task and JWT token for authentication.
     * 6. Archives the task by sending a DELETE request with the task ID and folder ID.
     * 7. Verifies that the task is archived by sending a GET request and checking the response status code.
     * 8. Restores the deleted task by sending a POST request with the task ID and folder ID.
     * 9. Retrieves the response payload, which contains the restored task.
     * 10. Verifies that the restored task's ID matches the original task's ID.
     *
     * @returns {Promise<void>} A promise that resolves once the archived task is restored.
     */
    @Test('Restore Deleted Task')
    async restoreDeletedTask(): Promise<void> {
        this.logger.log('create user and folder');
        const {folder, jwtToken} = await this.createFolder();
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        const fakeTask = this.factory.fakeCreateTask(userId, folder.id);
        this.logger.log('create task');
        const {body: task} = await this.post(``, fakeTask, jwtToken.accessToken).expect(HttpStatus.CREATED);
        this.logger.log('archive task by id');
        await this.post(`archive/${task.id}/folder/${folder.id}`, {archiveReason: ''}, jwtToken.accessToken).expect(HttpStatus.CREATED);
        const {body: taskResponse} = await this.get(`${task.id}/folder/${folder.id}`, jwtToken.accessToken);
        expect(taskResponse.statusCode).toBe(HttpStatus.NOT_FOUND);
        this.logger.log('restore archived task by id');
        await this.post(`archive/restore/${task.id}/folder/${folder.id}`, {}, jwtToken.accessToken).expect(HttpStatus.CREATED);
        const {body: response} = await this.get(`${task.id}/folder/${folder.id}`, jwtToken.accessToken);
        expect(response.id).toBe(task.id);
    }

    /**
     * Retrieves multiple archived tasks.
     *
     * @returns {Promise<void>} A promise that resolves when the operation is complete.
     */
    @Test('Get Many Archived Tasks')
    async getManyArchiveTasks(): Promise<void> {
        this.logger.log('create user and folder');
        const {folder, jwtToken} = await this.createFolder();
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        const fakeTask1 = this.factory.fakeCreateTask(userId, folder.id);
        const fakeTask2 = this.factory.fakeCreateTask(userId, folder.id);
        this.logger.log('create task');
        const {body: task1} = await this.post(``, fakeTask1, jwtToken.accessToken).expect(HttpStatus.CREATED);
        const {body: task2} = await this.post(``, fakeTask2, jwtToken.accessToken).expect(HttpStatus.CREATED);
        this.logger.log('archive tasks');
        await this.post(`archive/${task1.id}/folder/${folder.id}`, {archiveReason: 'Archive Task'}, jwtToken.accessToken).expect(
            HttpStatus.CREATED
        );
        await this.post(`archive/${task2.id}/folder/${folder.id}`, {archiveReason: 'Archive Task'}, jwtToken.accessToken).expect(
            HttpStatus.CREATED
        );
        this.logger.log('get all archived tasks');
        const {body: response} = await this.get(`many/archive`, jwtToken.accessToken);
        expect(response.length).toBeGreaterThanOrEqual(1);
    }

    /**
     * Updates a task by creating a user and folder, creating a fake task with the user and folder IDs,
     * then updating the task with fake update task data.
     *
     * @return {Promise<void>} A promise that resolves when the task has been updated successfully.
     */
    @Test('Update Task')
    async updateTask(): Promise<void> {
        this.logger.log('create user and folder');
        const {folder, jwtToken} = await this.createFolder();
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        const fakeTask = this.factory.fakeCreateTask(userId, folder.id);
        const fakeUpdateTask = this.factory.fakeUpdateTask(folder.id);
        this.logger.log('create task');
        const {body: task} = await this.post(``, fakeTask, jwtToken.accessToken).expect(HttpStatus.CREATED);
        this.logger.log('update task');
        await this.patch(`${task.id}`, fakeUpdateTask, jwtToken.accessToken).expect(HttpStatus.OK);
        this.logger.log('get updated task');
        const {body: response} = await this.get(`${task.id}/folder/${folder.id}`, jwtToken.accessToken);
        expect(response.title).toBe(fakeUpdateTask.title);
        expect(response.description).toBe(fakeUpdateTask.description);
    }

    /**
     * Updates the assignee of a task.
     *
     * This method performs the following steps:
     * 1. Creates a user and folder.
     * 2. Retrieves the user ID from the JWT token.
     * 3. Creates a fake task with the user ID and folder ID.
     * 4. Sends a POST request to create the task.
     * 5. Sends a PATCH request to update the assignee of the task.
     * 6. Retrieves the updated task and folder details.
     * 7. Asserts that the assignee of the task is updated correctly.
     *
     * @returns {Promise<void>} A Promise that resolves once the assignee is updated.
     */
    @Test('Update Task Assignee')
    async updateTaskAssigneeOne(): Promise<void> {
        this.logger.log('create user and folder');
        const {folder, jwtToken} = await this.createFolder();
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        const fakeTask = this.factory.fakeCreateTask(userId, folder.id);
        const taskAssigneeDto: TaskAssigneesDto = {assignees: [userId], folderId: folder.id};
        this.logger.log('create task');
        const {body: task} = await this.post(``, fakeTask, jwtToken.accessToken).expect(HttpStatus.CREATED);
        this.logger.log('update assignee');
        await this.patch(`assignees/${task.id}`, taskAssigneeDto, jwtToken.accessToken).expect(HttpStatus.OK);
        const {body: response} = await this.get(`${task.id}/folder/${folder.id}`, jwtToken.accessToken);
        expect(response.assignees.length).toBe(1);
        expect(response.assignees[0]).toBe(userId);
    }

    /**
     * Updates assignees of multiple tasks.
     *
     * @returns {Promise<void>} - A promise that resolves when the update is complete.
     */
    @Test('update assignees of multiple tasks')
    async updateManyTasks(): Promise<void> {
        this.logger.log('create user and folder');
        const {folder, jwtToken} = await this.createFolder();
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        const fakeTask1 = this.factory.fakeCreateTask(userId, folder.id);
        const fakeTask2 = this.factory.fakeCreateTask(userId, folder.id);
        this.logger.log('create task');
        const {body: task1} = await this.post(``, fakeTask1, jwtToken.accessToken).expect(HttpStatus.CREATED);
        const {body: task2} = await this.post(``, fakeTask2, jwtToken.accessToken).expect(HttpStatus.CREATED);
        const updateManyTaskDto: UpdateManyTaskDto = {
            tasks: [
                {
                    id: task1.id,
                    assignees: [userId],
                    folderId: folder.id,
                },
                {
                    id: task2.id,
                    assignees: [userId],
                    folderId: folder.id,
                },
            ],
            folderId: folder.id,
        };
        await this.patch(`many/update`, updateManyTaskDto, jwtToken.accessToken).expect(HttpStatus.OK);
        const {body: response1} = await this.get(`${task1.id}/folder/${folder.id}`, jwtToken.accessToken);
        const {body: response2} = await this.get(`${task2.id}/folder/${folder.id}`, jwtToken.accessToken);
        expect(response1.assignees[0]).toBe(userId);
        expect(response2.assignees[0]).toBe(userId);
    }

    /**
     * Creates a dependency between two tasks.
     *
     * This method creates a user and a folder, then creates two tasks
     * within the folder. Finally, it creates a dependency between
     * the two tasks.
     *
     * @returns {Promise<void>} A Promise that resolves when the dependency is created.
     */
    @Test('Create Task Dependency')
    async createDependency(): Promise<void> {
        this.logger.log('create user and folder');
        const {folder, jwtToken} = await this.createFolder();
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        const fakeTask1 = this.factory.fakeCreateTask(userId, folder.id);
        const fakeTask2 = this.factory.fakeCreateTask(userId, folder.id);
        this.logger.log('create task');
        const {body: task1} = await this.post(``, fakeTask1, jwtToken.accessToken).expect(HttpStatus.CREATED);
        const {body: task2} = await this.post(``, fakeTask2, jwtToken.accessToken).expect(HttpStatus.CREATED);
        const createDependencyDto: CreateDependencyDto = {
            folderId: folder.id,
            predecessorId: task1.id,
            successorId: task2.id,
            relationType: RelationTypeOptions.START_TO_FINISH,
        };
        this.logger.log('create dependency');
        const {body: response} = await this.post(`dependency/folder/${folder.id}`, createDependencyDto, jwtToken.accessToken).expect(
            HttpStatus.CREATED
        );
        expect(response.identifiers[0].id).toBeGreaterThan(0);
        const {body: taskResponse} = await this.get(`${task1.id}/folder/${folder.id}`, jwtToken.accessToken);
        expect(taskResponse.successors[0].taskId).toBe(task2.id);
    }

    /**
     * Deletes a task dependency.
     *
     * This method performs the following steps:
     * 1. Creates a user and a folder.
     * 2. Creates two fake tasks for the user and folder.
     * 3. Creates a task dependency between the two tasks.
     * 4. Deletes the task dependency.
     *
     * @returns {Promise<void>} A Promise that resolves when the task dependency is deleted.
     */
    @Test('Delete Task Dependency')
    async deleteTaskDependency(): Promise<void> {
        this.logger.log('create user and folder');
        const {folder, jwtToken} = await this.createFolder();
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        const fakeTask1 = this.factory.fakeCreateTask(userId, folder.id);
        const fakeTask2 = this.factory.fakeCreateTask(userId, folder.id);
        this.logger.log('create task');
        const {body: task1} = await this.post(``, fakeTask1, jwtToken.accessToken).expect(HttpStatus.CREATED);
        const {body: task2} = await this.post(``, fakeTask2, jwtToken.accessToken).expect(HttpStatus.CREATED);
        const createDependencyDto: CreateDependencyDto = {
            folderId: folder.id,
            predecessorId: task1.id,
            successorId: task2.id,
            relationType: RelationTypeOptions.START_TO_FINISH,
        };
        this.logger.log('create dependency');
        const {body: response} = await this.post(`dependency/folder/${folder.id}`, createDependencyDto, jwtToken.accessToken).expect(
            HttpStatus.CREATED
        );
        expect(response.identifiers[0].id).toBeGreaterThan(0);
        const {body: taskResponse} = await this.get(`${task1.id}/folder/${folder.id}`, jwtToken.accessToken);
        expect(taskResponse.successors[0].taskId).toBe(task2.id);
        this.logger.log('delete dependency');
        const {body: deleteResult} = await this.delete(
            `dependency/${response.identifiers[0].id}/predecessors/${task1.id}/successors/${task2.id}/folder/${folder.id}`,
            jwtToken.accessToken
        );
        expect(deleteResult.affected).toEqual(1);
    }

    /**
     * Moves a task to a specific position within a folder's workflow.
     *
     * Steps:
     * 1. Creates a user and a folder.
     * 2. Retrieves the folder and user IDs from the access token.
     * 3. Creates a fake task associated with the user and folder.
     * 4. Moves the task to a specific position within the folder's workflow.
     * 5. Retrieves the comments for the moved task.
     * 6. Verifies that the move action exists in the comments.
     *
     * @returns {Promise<void>} A Promise that resolves when the task has been moved.
     */
    @Test('Move Task')
    async moveTask(): Promise<void> {
        this.logger.log('create user and folder');
        const {folder, jwtToken} = await this.createFolder();
        const f2 = await this.createFolder(null, jwtToken);
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        const fakeTask = this.factory.fakeCreateTask(userId, folder.id);
        this.logger.log('create task');
        const {body: task} = await this.post(``, fakeTask, jwtToken.accessToken).expect(HttpStatus.CREATED);
        this.logger.log('move task');
        const workFlowEntity = await this.folderFactory.getFolderWorkFlow(folder.id);
        const moveTaskDto: UpdateTaskPositionDto = {
            folderId: folder.id,
            columnId: workFlowEntity.WorkFlowStates[workFlowEntity.WorkFlowStates.length - 1].id,
            index: 1,
            view: FolderViewOptions.BOARD,
        };
        await this.patch(`position/${task.id}`, moveTaskDto, jwtToken.accessToken).expect(HttpStatus.OK);
        this.logger.log('get moved task comments');
        const {body: response} = await this.get(`/task-action/folder/${folder.id}/task/${task.id}`, jwtToken.accessToken);
        const exists = response.find((x: {action: string; task: {id: number}}) => x.action === 'move' && x.task?.id === task.id);
        expect(exists.parameters?.updatePosition).toMatchObject(moveTaskDto);

        this.logger.log('move task to wrong state');
        const workFlowEntity2 = await this.folderFactory.getFolderWorkFlow(f2.folder.id);
        const moveTaskDto2: UpdateTaskPositionDto = {
            folderId: folder.id,
            columnId: workFlowEntity2.WorkFlowStates[workFlowEntity2.WorkFlowStates.length - 1].id,
            index: 1,
            view: FolderViewOptions.BOARD,
        };
        await this.patch(`position/${task.id}`, moveTaskDto2, jwtToken.accessToken).expect(HttpStatus.BAD_REQUEST);
    }

    /**
     * Share a task between two folders.
     *
     * This method performs the following steps:
     * - Creates a user and a folder.
     * - Creates another folder using the JWT token obtained from the first step.
     * - Retrieves the user ID from the JWT token.
     * - Constructs a fake task using the user ID and the ID of the first folder.
     * - Creates the task.
     * - Gets the folder workflow for the second folder.
     * - Constructs a task shared DTO using the IDs of both folders and the ID of the first state in the folder workflow.
     * - Shares the task.
     * - Retrieves the comments for the moved task.
     * - Checks if the shared action exists in the comments.
     * - Un-shares the task.
     * - Retrieves the comments for the moved task again.
     * - Checks if the unshared action exists in the comments.
     *
     * @returns {Promise<void>} A promise that resolves when the task sharing process is complete.
     */
    @Test('Share Task')
    async shareTask(): Promise<void> {
        this.logger.log('create user and folder');
        const {folder: folder1, jwtToken} = await this.createFolder();
        const {folder: folder2} = await this.createFolder(null, jwtToken);
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        const fakeTask = this.factory.fakeCreateTask(userId, folder1.id);
        this.logger.log('create task');
        const {body: task} = await this.post(``, fakeTask, jwtToken.accessToken).expect(HttpStatus.CREATED);

        this.logger.log('share task');
        const workFlowEntity = await this.folderFactory.getFolderWorkFlow(folder2.id);
        const shareTaskDto: TaskSharedDto = {
            fromFolderId: folder1.id,
            folderId: folder2.id,
            stateId: workFlowEntity.WorkFlowStates[0].id,
        };
        await this.post(`share/${task.id}`, shareTaskDto, jwtToken.accessToken).expect(HttpStatus.CREATED);
        this.logger.log('get moved task comments');
        const {body: response} = await this.get(`/task-action/folder/${folder1.id}/task/${task.id}`, jwtToken.accessToken);
        const exists = response.find((x: {action: string; task: {id: number}}) => x.action === 'task_shared' && x.task?.id === task.id);
        expect(exists.parameters?.share).toMatchObject(shareTaskDto);

        this.logger.log('un-share task');
        await this.delete(`un-share/${task.id}/${folder2.id}`, jwtToken.accessToken).expect(HttpStatus.OK);
        this.logger.log('get moved task comments');
        const {body: response2} = await this.get(`/task-action/folder/${folder1.id}/task/${task.id}`, jwtToken.accessToken);
        const exists2 = response2.find((x: {action: string; task: {id: number}}) => x.action === 'task_unshared' && x.task?.id === task.id);
        expect(exists2.parameters?.unshared).toMatchObject({folder_id: folder2.id});
    }

    @Test('Move Task Between Folders')
    async moveBetweenFolders(): Promise<void> {
        const {folder: folder1, jwtToken} = await this.createFolder();
        const {folder: folder2} = await this.createFolder(null, jwtToken);
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        const fakeTask = this.factory.fakeCreateTask(userId, folder1.id);
        const fakeTask2 = this.factory.fakeCreateTask(userId, folder1.id);
        const fakeTask3 = this.factory.fakeCreateTask(userId, folder1.id);

        // create Task tree
        const response = await this.post(``, fakeTask, jwtToken.accessToken).expect(HttpStatus.CREATED);

        const response2 = await this.post(``, {...fakeTask2, parentTaskId: response.body.id}, jwtToken.accessToken).expect(
            HttpStatus.CREATED
        );
        const response3 = await this.post(``, {...fakeTask3, parentTaskId: response2.body.id}, jwtToken.accessToken).expect(
            HttpStatus.CREATED
        );

        const folder1WorkFlowEntity = await this.folderFactory.getFolderWorkFlow(folder1.id);

        const folder2WorkFlowEntity = await this.folderFactory.getFolderWorkFlow(folder2.id);

        const mapWorkflowStates = [];
        for (let i = 0; i < folder1WorkFlowEntity.WorkFlowStates.length; i++) {
            mapWorkflowStates.push({
                SourceWorkflowStateCode: folder1WorkFlowEntity.WorkFlowStates[i].code,
                DestinationWorkflowStateCode:
                    folder2WorkFlowEntity.WorkFlowStates[i]?.code ?? folder2WorkFlowEntity.WorkFlowStates[0]?.code,
            });
        }
        const moveTaskDto: MoveManyTasksDto = {
            sourceFolderId: folder1.id,
            destinationFolderId: folder2.id,
            taskIds: [response.body.id],
            mapWorkflowStates,
        };

        const {body: folderTaskTree} = await this.post(
            `/folder-workflow/project/${folder1.id}/${folder1.defaultView}`,
            {},
            jwtToken.accessToken
        ).expect(HttpStatus.CREATED);
        expect(folderTaskTree[0].columns[0].tasks[0].id).toBe(response.body.id);

        const moveResponse = await this.put(`move-many`, moveTaskDto, jwtToken.accessToken);

        expect(moveResponse.statusCode).toBe(HttpStatus.OK);

        await this.get(`task/${response.body.id}/folder/${folder1.id}`, jwtToken.accessToken).expect(HttpStatus.NOT_FOUND);

        const {body: folderTaskTree2} = await this.post(
            `/folder-workflow/project/${folder2.id}/${folder2.defaultView}`,
            {},
            jwtToken.accessToken
        ).expect(HttpStatus.CREATED);

        const parentTask = folderTaskTree2[0].columns.find((column) => column.tasks.find((task) => task.id === response.body.id));

        // check if the task tree strusture persist in new folder
        expect(parentTask).toBeDefined();

        expect(parentTask.tasks).toHaveLength(1);
        expect(parentTask.tasks[0]).toBeDefined();
        expect(parentTask.tasks[0].id).toBe(response.body.id);

        expect(parentTask.tasks[0].children).toHaveLength(1);
        expect(parentTask.tasks[0].children[0]).toBeDefined();
        expect(parentTask.tasks[0].children[0].id).toBe(response2.body.id);

        expect(parentTask.tasks[0].children[0].children).toHaveLength(1);
        expect(parentTask.tasks[0].children[0].children[0]).toBeDefined();
        expect(parentTask.tasks[0].children[0].children[0].id).toBe(response3.body.id);
    }

    @Test('CheckTaskUpdatePathTitle')
    async CheckTaskUpdatePathTitle(): Promise<void> {
        this.logger.log('create user and folder');
        const {folder, jwtToken} = await this.createFolder();
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        const fakeTask = this.factory.fakeCreateTask(userId, folder.id);
        this.logger.log('create task');
        const {body: task} = await this.post(``, fakeTask, jwtToken.accessToken).expect(HttpStatus.CREATED);
        const fakeUpdateTaskDto = {folderId: folder.id, title: faker.commerce.product()};
        this.logger.log('update task');
        await this.patch(`${task.id}`, fakeUpdateTaskDto, jwtToken.accessToken).expect(HttpStatus.OK);
        const {body: taskTreeResponse} = await this.get(`/folder/task-tree/${folder.id}`, jwtToken.accessToken).expect(HttpStatus.OK);
        expect(taskTreeResponse[0].id).toBe(task.id);
        expect(taskTreeResponse[0].pathString[0]).toBe(fakeUpdateTaskDto.title);
    }

    /**
     * Moves a task inside another task within a folder's workflow.
     *
     * Steps:
     * 1. Creates a user and a folder.
     * 2. Retrieves the folder and user IDs from the access token.
     * 3. Creates two fake tasks associated with the user and folder.
     * 4. Moves the task to a specific task within the folder's workflow.
     *
     * @returns {Promise<void>} A Promise that resolves when the task has been moved.
     */
    @Test('Move Task Inside Another Task')
    async moveTaskPosition(): Promise<void> {
        this.logger.log('create user and folder');
        const {folder, jwtToken} = await this.createFolder();
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        const fakeTask1 = this.factory.fakeCreateTask(userId, folder.id);
        const fakeTask2 = this.factory.fakeCreateTask(userId, folder.id);
        this.logger.log('create task');
        const {body: task1} = await this.post(``, fakeTask1, jwtToken.accessToken).expect(HttpStatus.CREATED);
        const {body: task2} = await this.post(``, fakeTask2, jwtToken.accessToken).expect(HttpStatus.CREATED);
        this.logger.log('move task');
        const workFlowEntity = await this.folderFactory.getFolderWorkFlow(folder.id);
        const moveTaskDto: UpdateTaskPositionDto = {
            parentTaskNewId: task1.id,
            folderId: folder.id,
            columnId: workFlowEntity.WorkFlowStates[workFlowEntity.WorkFlowStates.length - 1].id,
            index: 1,
            view: FolderViewOptions.BOARD,
        };
        await this.patch(`position/${task2.id}`, moveTaskDto, jwtToken.accessToken).expect(HttpStatus.OK);
        const {body: parentTask} = await this.get(`${task1.id}/folder/${folder.id}`, jwtToken.accessToken).expect(HttpStatus.OK);
        expect(parentTask.id).toBe(task1.id);
        const foundChild = parentTask.children.find((child) => child.id === task2.id);
        expect(foundChild).toBeDefined();
    }

    /**
     * Creates a folder asynchronously.
     *
     * @param {number} [parentFolderId] - The ID of the parent folder. If not provided, the folder will be created in the root folder.
     * @param {TokenInterface} [jwtTokenParam] - The JWT token used to authenticate the user. If not provided, a new user will be created and logged in.
     *
     * @returns {Promise} A Promise that resolves to an object containing the created folder, the JWT token, and the workflow database entry.
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
    private async createUserWithPermissions(permissions: PermissionsType): Promise<TestResponse> {
        this.logger.log(`Create user`);
        const fakeUser = await this.userFactory.createUserForLogin(permissions);
        return this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
    }

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
