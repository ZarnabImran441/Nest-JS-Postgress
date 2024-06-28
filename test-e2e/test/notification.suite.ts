import {TASK_MANAGEMENT} from '@lib/base-library';
import {HttpStatus, Inject, Logger, OnModuleInit} from '@nestjs/common';
import {TaskAssigneesDto} from 'apps/task-management/src/dto/task/update-task.dto';
import {Test, TestSuite} from 'nestjs-jest-decorators';
import {Test as TestResponse} from 'supertest';
import {setTimeout} from 'timers/promises';
import {ChangeWorkflowFolderDto, ChangeWorkflowOptions} from '../../src/dto/folder/folder/change-workflow.dto';
import {CreateFolderDto} from '../../src/dto/folder/folder/create-folder.dto';
import {GenericMemberDto} from '../../src/dto/folder/folder/generic-member.dto';
import {GetFolderDto} from '../../src/dto/folder/folder/get-folder.dto';
import {UserPermissionOptions} from '../../src/enum/folder-user.enum';
import {DefaultViewOptions} from '../../src/enum/folder.enum';
import {WorkFlowEntity} from '../../src/model/workflow.entity';
import {PermissionOptions} from '../../src/module/authorization-impl/authorization.enum';
import {FolderFactory} from '../factory/folder.factory';
import {TaskFactory} from '../factory/task.factory';
import {PermissionsType, UserFactory} from '../factory/user.factory';
import {WorkflowFactory} from '../factory/workflow.factory';
import {NewBaseTest} from './base-test';

@TestSuite('Notification Suite')
export class NotificationE2eSpec extends NewBaseTest implements OnModuleInit {
    private readonly logger = new Logger(NotificationE2eSpec.name);

    @Inject()
    private folderFactory: FolderFactory;
    @Inject()
    private userFactory: UserFactory;
    @Inject()
    private workflowFactory: WorkflowFactory;
    @Inject()
    private taskFactory: TaskFactory;

    onModuleInit(): void {
        this.setUrl('/notification');
    }

    // <<----------------------------------------------- helper functions for test nofitication ----------------------------------------------------->>

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

    /**
     * Creates one fake folder.
     *
     * @param {string} accessToken - The access token for authentication.
     * @param {number} spaceId - The ID of the space where the folders will be created.
     * @returns {Promise<CreateFolderDto>} - Promise that resolves with an array of created folders.
     */
    private async createOneFakeFolder(
        accessToken: string,
        spaceId?: number
    ): Promise<{
        createdFolder: CreateFolderDto;
        spaceId: number;
    }> {
        const workflow: WorkFlowEntity = await this.createWorkflowForFolder(accessToken),
            fakeChangeWorkflow: ChangeWorkflowFolderDto = {
                commonWorkflow: workflow.id,
                type: ChangeWorkflowOptions.COMMON_TO_COMMON,
                Mapping: [],
                personaliseWorkflow: null,
            };

        if (!spaceId) {
            const spaceResponse = await this.createSpace(accessToken, [workflow.id]);
            spaceId = spaceResponse.id;
        }

        const createdFolder = this.folderFactory.fakeCreateFolder(fakeChangeWorkflow, null, null, [TASK_MANAGEMENT], spaceId);
        const {body: f1, status} = await this.post(``, createdFolder, accessToken);
        expect(status).toBe(HttpStatus.CREATED);
        expect(f1).toBeDefined();

        return {createdFolder, spaceId};
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

    // <<---------------------------------------------------- helper functions ends ---------------------------------------------------------->>

    @Test('Manage Space should also create a notification (Create, archive and add/remove member) ')
    async manageSpaceWithNotification(): Promise<void> {
        this.logger.log('create users and login');
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
            notification: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        const {id: userId} = this.getUserInfoFromAccessToken(jwtToken.accessToken);
        const {body: fakeJwtToken1} = await this.createUserWithPermissions({
            workflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            folder: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            space: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        const {id: memberId} = this.getUserInfoFromAccessToken(fakeJwtToken1.accessToken);

        this.logger.log('create workflow');
        const workflow: WorkFlowEntity = await this.createWorkflowForFolder(jwtToken.accessToken);

        this.logger.log('perform actions');
        this.logger.log('create space');
        const spaceResponse = await this.createSpace(
            jwtToken.accessToken,
            [workflow.id],
            [{id: memberId, userPermission: UserPermissionOptions.FULL}]
        );

        this.logger.log('change owner');
        await this.patch(
            `/space/${spaceResponse.id}/owner/${memberId}`,
            {permissions: UserPermissionOptions.FULL},
            jwtToken.accessToken
        ).expect(HttpStatus.OK);

        await this.patch(
            `/space/${spaceResponse.id}/owner/${userId}`,
            {permissions: UserPermissionOptions.FULL},
            fakeJwtToken1.accessToken
        ).expect(HttpStatus.OK);

        this.logger.log('archive space');
        await this.post(`/space/${spaceResponse.id}/archive`, {archiveReason: 'Test for notification'}, jwtToken.accessToken).expect(
            HttpStatus.CREATED
        );

        this.logger.log('unarchive space');
        await this.post(`/space/${spaceResponse.id}/restore`, {}, jwtToken.accessToken).expect(HttpStatus.CREATED);

        this.logger.log('change owner');
        await this.patch(
            `/space/${spaceResponse.id}/owner/${memberId}`,
            {permissions: UserPermissionOptions.FULL},
            jwtToken.accessToken
        ).expect(HttpStatus.OK);

        this.logger.log('wait half second and check notification');
        await setTimeout(500);
        const {
            body: {data: notifications},
        } = await this.get('', jwtToken.accessToken).expect(HttpStatus.OK);

        const createSpaceNotification = notifications.find(
            (el) => el.space.id === spaceResponse.id && el.content.event === 'notification-folder-create'
        );
        const addMemberNotification = notifications.find(
            (el) => el.space.id === spaceResponse.id && el.content.event === 'notification-folder-add-member'
        );
        const archiveNotification = notifications.find(
            (el) => el.space.id === spaceResponse.id && el.content.event === 'notification-folder-archive'
        );
        const changeOwnerNotification = notifications.find(
            (el) => el.space.id === spaceResponse.id && el.content.event === 'notification-folder-set-owner'
        );

        expect(notifications.length).toBeGreaterThan(0);
        expect(createSpaceNotification).toBeDefined();
        expect(addMemberNotification).toBeDefined();
        expect(archiveNotification).toBeDefined();
        expect(changeOwnerNotification).toBeDefined();
    }

    @Test('Manage Folder should create a notification (Create, archive, copy, change owner and delete) ')
    async manageFolderWithNotification(): Promise<void> {
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
            notification: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        const {id: userId} = this.getUserInfoFromAccessToken(jwtToken.accessToken);
        const {body: fakeJwtToken1} = await this.createUserWithPermissions({
            workflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            folder: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            space: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        const {id: memberId} = this.getUserInfoFromAccessToken(fakeJwtToken1.accessToken);

        this.logger.log('create workflow');
        const workflow: WorkFlowEntity = await this.createWorkflowForFolder(jwtToken.accessToken);

        this.logger.log('create space');
        const spaceResponse = await this.createSpace(
            jwtToken.accessToken,
            [workflow.id],
            [{id: memberId, userPermission: UserPermissionOptions.FULL}]
        );

        this.logger.log('create folder');
        const fakeChangeWorkflow: ChangeWorkflowFolderDto = {
            commonWorkflow: workflow.id,
            type: ChangeWorkflowOptions.COMMON_TO_COMMON,
            Mapping: [],
            personaliseWorkflow: null,
        };
        const fakeFolder = this.folderFactory.fakeCreateFolder(
            fakeChangeWorkflow,
            null,
            DefaultViewOptions.BOARD,
            ['task-management'],
            spaceResponse.id
        );
        const {body: folder} = await this.post(`/folder`, fakeFolder, jwtToken.accessToken).expect(HttpStatus.CREATED);

        this.logger.log('change owner');
        await this.patch(`/folder/owner/${folder.id}/${memberId}`, {permissions: UserPermissionOptions.FULL}, jwtToken.accessToken).expect(
            HttpStatus.OK
        );

        await this.patch(
            `/folder/owner/${folder.id}/${userId}`,
            {permissions: UserPermissionOptions.FULL},
            fakeJwtToken1.accessToken
        ).expect(HttpStatus.OK);

        this.logger.log('copy folder');
        const copyFolderDto = this.folderFactory.fakeCopyFolderDto(spaceResponse.id);
        await this.post(`/folder/copy/${folder.id}`, copyFolderDto, jwtToken.accessToken).expect(HttpStatus.CREATED);

        this.logger.log('archive folder');
        await this.post(`/folder/archive/${folder.id}`, {archiveReason: 'Test for notification'}, jwtToken.accessToken).expect(
            HttpStatus.CREATED
        );

        this.logger.log('wait one second and check notification');
        await setTimeout(1000);
        const {
            body: {data: notifications},
        } = await this.get('', jwtToken.accessToken).expect(HttpStatus.OK);

        const createFolderNotification = notifications.find(
            (el) => el.folder?.id === folder.id && el.content.event === 'notification-folder-create'
        );
        const archivedNotification = notifications.find(
            (el) => el.folder?.id === folder.id && el.content.event === 'notification-folder-archive'
        );
        const setOwnerNotification = notifications.find(
            (el) => el.folder?.id === folder.id && el.content.event === 'notification-folder-set-owner'
        );
        const copyFolderNotification = notifications.find(
            (el) => el.folder?.id === folder.id && el.content.event === 'notification-folder-copy'
        );
        expect(notifications.length).toBeGreaterThan(0);
        expect(createFolderNotification).toBeDefined();
        expect(archivedNotification).toBeDefined();
        expect(setOwnerNotification).toBeDefined();
        expect(copyFolderNotification).toBeDefined();
    }

    @Test('Manage Task should create a notification (Create, update and add/remove assignees)')
    async manageTaskWithNotification(): Promise<void> {
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
            notification: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        const {id: userId} = this.getUserInfoFromAccessToken(jwtToken.accessToken);
        const {body: fakeJwtToken1} = await this.createUserWithPermissions({
            workflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            folder: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            space: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        const {name: fakeUser1Name, id: fakeUser1Id} = this.getUserInfoFromAccessToken(fakeJwtToken1.accessToken);
        const {body: fakeJwtToken2} = await this.createUserWithPermissions({
            workflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            folder: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            space: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        const {id: fakeUser2Id} = this.getUserInfoFromAccessToken(fakeJwtToken2.accessToken);

        this.logger.log('create workflow');
        const workflow = await this.createWorkflowForFolder(jwtToken.accessToken);

        this.logger.log('create space with members');
        const spaceResponse = await this.createSpace(
            jwtToken.accessToken,
            [workflow.id],
            [
                {id: fakeUser1Id, userPermission: UserPermissionOptions.FULL},
                {id: fakeUser2Id, userPermission: UserPermissionOptions.FULL},
            ]
        );

        this.logger.log('create folder');
        const fakeChangeWorkflow: ChangeWorkflowFolderDto = {
            commonWorkflow: workflow.id,
            type: ChangeWorkflowOptions.COMMON_TO_COMMON,
            Mapping: [],
            personaliseWorkflow: null,
        };
        const fakeFolder = this.folderFactory.fakeCreateFolder(
            fakeChangeWorkflow,
            null,
            DefaultViewOptions.BOARD,
            ['task-management'],
            spaceResponse.id
        );

        const {body: folder} = await this.post(`/folder`, fakeFolder, jwtToken.accessToken).expect(HttpStatus.CREATED);

        this.logger.log('create task');
        const fakeTask = this.taskFactory.fakeCreateTask(userId, folder.id);
        const {body: task} = await this.post(`/task`, fakeTask, jwtToken.accessToken).expect(HttpStatus.CREATED);
        this.logger.log('add and remove assignee');
        const addAssigneeDto: TaskAssigneesDto = {
            folderId: folder.id,
            assignees: [fakeUser1Id],
        };
        const removeAssigneeDto: TaskAssigneesDto = {
            folderId: folder.id,
            assignees: [],
        };
        await this.patch(`/task/assignees/${task.id}`, addAssigneeDto, jwtToken.accessToken).expect(HttpStatus.OK);
        await this.patch(`/task/assignees/${task.id}`, removeAssigneeDto, jwtToken.accessToken).expect(HttpStatus.OK);

        this.logger.log('wait one second and check notification');
        await setTimeout(1000);
        const {
            body: {data: notifications},
        } = await this.get('', jwtToken.accessToken).expect(HttpStatus.OK);

        const createTaskNotification = notifications.find((el) => el.task.id === task.id && el.event === 'notification-task-create');
        const addAssigneeNotification = notifications.find(
            (el) =>
                el.task?.id === task.id &&
                el.content.event === 'notification-task-assign' &&
                el.content.message === `User: ${fakeUser1Name} was assigned to Task: ${task.title}`
        );
        const removeAssigneeNotification = notifications.find(
            (el) =>
                el.task?.id === task.id &&
                el.content.event === 'notification-task-unassign' &&
                el.content.message === `User: ${fakeUser1Name} was unassigned from Task: ${task.title}`
        );

        expect(notifications.length).toBeGreaterThan(0);
        expect(createTaskNotification).toBeDefined();
        expect(addAssigneeNotification).toBeDefined();
        expect(removeAssigneeNotification).toBeDefined();
    }

    @Test('Manage Task should create a notification (Delete, Restore , Archive and Unarchive)')
    async manageTaskArchiveDeleteWithNotification(): Promise<void> {
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
            notification: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        const {id: userId} = this.getUserInfoFromAccessToken(jwtToken.accessToken);

        this.logger.log('create workflow');
        const workflow = await this.createWorkflowForFolder(jwtToken.accessToken);

        this.logger.log('create space with members');
        const spaceResponse = await this.createSpace(jwtToken.accessToken, [workflow.id]);

        this.logger.log('create folder');
        const fakeChangeWorkflow: ChangeWorkflowFolderDto = {
            commonWorkflow: workflow.id,
            type: ChangeWorkflowOptions.COMMON_TO_COMMON,
            Mapping: [],
            personaliseWorkflow: null,
        };
        const fakeFolder = this.folderFactory.fakeCreateFolder(
            fakeChangeWorkflow,
            null,
            DefaultViewOptions.BOARD,
            ['task-management'],
            spaceResponse.id
        );

        const {body: folder} = await this.post(`/folder`, fakeFolder, jwtToken.accessToken).expect(HttpStatus.CREATED);

        this.logger.log('create task');
        const fakeTask1 = this.taskFactory.fakeCreateTask(userId, folder.id);
        const fakeTask2 = this.taskFactory.fakeCreateTask(userId, folder.id);
        const {body: task1} = await this.post(`/task`, fakeTask1, jwtToken.accessToken).expect(HttpStatus.CREATED);
        const {body: task2} = await this.post(`/task`, fakeTask2, jwtToken.accessToken).expect(HttpStatus.CREATED);

        this.logger.log('archive task1');
        await this.post(`/task/archive/${task1.id}/folder/${folder.id}`, {archiveReason: 'archive'}, jwtToken.accessToken).expect(
            HttpStatus.CREATED
        );

        this.logger.log('delete task2');
        await this.delete(`/task/delete/${task2.id}/folder/${folder.id}`, jwtToken.accessToken).expect(HttpStatus.OK);

        this.logger.log('unarchive task1');
        await this.post(`/task/archive/restore/${task1.id}/folder/${folder.id}`, {archiveReason: 'archive'}, jwtToken.accessToken).expect(
            HttpStatus.CREATED
        );
        this.logger.log('restore task2');
        await this.post(`/task/delete/restore/${task2.id}/folder/${folder.id}`, {archiveReason: 'archive'}, jwtToken.accessToken).expect(
            HttpStatus.CREATED
        );

        this.logger.log('wait one second and check notification');
        await setTimeout(1000);
        const {
            body: {data: notifications},
        } = await this.get('', jwtToken.accessToken).expect(HttpStatus.OK);

        const createTask1Notification = notifications.find(
            (el) => el.task.id === task1.id && el.event === 'notification-task-create' && el.content.userId === userId
        );
        const createTask2Notification = notifications.find(
            (el) => el.task.id === task2.id && el.event === 'notification-task-create' && el.content.userId === userId
        );
        const archiveTask1Notification = notifications.find(
            (el) => el.task?.id === task1.id && el.event === 'notification-task-archive' && el.content.userId === userId
        );
        const unarchiveTask1Notification = notifications.find(
            (el) => el.task?.id === task1.id && el.event === 'notification-task-unarchive' && el.content.userId === userId
        );
        const deleteTask2Notification = notifications.find(
            (el) => el.task?.id === task2.id && el.event === 'notification-task-delete' && el.content.userId === userId
        );
        const restoreTask2Notification = notifications.find(
            (el) => el.task?.id === task2.id && el.event === 'notification-task-restore' && el.content.userId === userId
        );

        expect(notifications.length).toBeGreaterThan(0);
        expect(createTask1Notification).toBeDefined();
        expect(createTask2Notification).toBeDefined();
        expect(archiveTask1Notification).toBeDefined();
        expect(unarchiveTask1Notification).toBeDefined();
        expect(deleteTask2Notification).toBeDefined();
        expect(restoreTask2Notification).toBeDefined();
    }

    @Test('Read, readAll, unread and delete a notification')
    async manageNotification(): Promise<void> {
        this.logger.log('create users and login');
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
            notification: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        this.logger.log('create workflow');
        const workflow: WorkFlowEntity = await this.createWorkflowForFolder(jwtToken.accessToken);

        this.logger.log('create space');
        await this.createSpace(jwtToken.accessToken, [workflow.id]);

        this.logger.log('wait one second and check notification');
        await setTimeout(1000);
        const {
            body: {data: notifications},
        } = await this.get('', jwtToken.accessToken).expect(HttpStatus.OK);

        expect(notifications).toHaveLength(1);
        const targetNotification = notifications[0];
        expect(targetNotification).toBeDefined();
        expect(targetNotification.read).toBe(false);

        this.logger.log('get one notification');
        const {body: getOne} = await this.patch(`${targetNotification.id}`, {}, jwtToken.accessToken).expect(HttpStatus.OK);
        expect(getOne.id).toBe(targetNotification.id);

        this.logger.log('read notification');
        await this.patch(`read/${targetNotification.id}`, {}, jwtToken.accessToken).expect(HttpStatus.OK);

        this.logger.log('check notification');
        const {
            body: {data: afterRead},
        } = await this.get('', jwtToken.accessToken).expect(HttpStatus.OK);

        const afterReadNotification = afterRead[0];
        expect(afterRead).toHaveLength(1);
        expect(afterReadNotification.read).toBe(true);

        this.logger.log('unread notification');
        await this.patch(`unread/${targetNotification.id}`, {}, jwtToken.accessToken).expect(HttpStatus.OK);

        this.logger.log('check notification');
        const {
            body: {data: afterUnread},
        } = await this.get('', jwtToken.accessToken).expect(HttpStatus.OK);

        const afterUnreadNotification = afterUnread[0];
        expect(afterUnreadNotification.read).toBe(false);

        this.logger.log('readALL notification');
        await this.patch(`readAll`, {}, jwtToken.accessToken).expect(HttpStatus.OK);

        this.logger.log('check notification');
        const {
            body: {data: afterReadAll},
        } = await this.get('', jwtToken.accessToken).expect(HttpStatus.OK);
        expect(afterReadAll).toHaveLength(1);
        const afterReadAllNotification = afterReadAll[0];
        expect(afterReadAllNotification.read).toBe(true);

        this.logger.log('delete notification');
        await this.delete(`${targetNotification.id}`, jwtToken.accessToken).expect(HttpStatus.OK);

        this.logger.log('check notification');
        const {
            body: {data: afterDelete},
        } = await this.get('', jwtToken.accessToken).expect(HttpStatus.OK);
        expect(afterDelete).toHaveLength(1);
        expect(afterDelete[0].read).toBe(true);
    }
}
