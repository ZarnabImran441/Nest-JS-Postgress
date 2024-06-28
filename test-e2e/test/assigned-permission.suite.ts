import {faker} from '@faker-js/faker';
import {ABSTRACT_AUTHORIZATION_SERVICE, makeid} from '@lib/base-library';
import {Inject, Logger} from '@nestjs/common';
import {Test, TestSuite} from 'nestjs-jest-decorators';
import {FolderEntity} from '../../src/model/folder.entity';
import {RoleEntity} from '../../src/model/role.entity';
import {TaskRelationEntity} from '../../src/model/task-relation.entity';
import {TaskEntity} from '../../src/model/task.entity';
import {UserEntity} from '../../src/model/user.entity';
import {WorkFlowStateEntity} from '../../src/model/workflow-state.entity';
import {WorkFlowEntity} from '../../src/model/workflow.entity';
import {AuthorizationImplService} from '../../src/module/authorization-impl/authorization-impl.service';
import {EntityTypeOptions, PermissionOptions} from '../../src/module/authorization-impl/authorization.enum';
import {FolderFactory} from '../factory/folder.factory';
import {TagFactory} from '../factory/tag.factory';
import {TaskFactory} from '../factory/task.factory';
import {UserFactory} from '../factory/user.factory';
import {WorkflowFactory} from '../factory/workflow.factory';
import {NewBaseTest} from './base-test';

@TestSuite('Assigned Permissions')
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export class IntegrationTest_AssignedPermission extends NewBaseTest {
    private readonly logger = new Logger(IntegrationTest_AssignedPermission.name);

    @Inject()
    private readonly userFactory: UserFactory;
    @Inject()
    private readonly tagFactory: TagFactory;
    @Inject()
    private readonly taskFactory: TaskFactory;
    @Inject()
    private readonly folderFactory: FolderFactory;
    @Inject()
    private readonly workflowFactory: WorkflowFactory;
    @Inject(ABSTRACT_AUTHORIZATION_SERVICE)
    protected readonly auth: AuthorizationImplService;

    @Test('crudUserRole')
    async crudUserRole(): Promise<RoleEntity> {
        // create a role
        let fakeRole = this.userFactory.fakeRole();
        let role = await this.userFactory.createRole(fakeRole);
        const banned = false;
        this.logger.log(`Created Role: `, role);

        // create a user
        const user = await this.userFactory.createUser();
        this.logger.log(`Created User: ` + user.id);

        // insert user-role
        await this.auth.insertUserRole(user.id, role.id, banned);

        // check the user-role was inserted
        let x = await this.auth.getUserRoles(user.id);
        expect(x.length).toBeGreaterThan(0);

        // insert another role
        fakeRole = this.userFactory.fakeRole();
        role = await this.userFactory.createRole(fakeRole);

        // insert another user-role
        await this.auth.insertUserRole(user.id, role.id, banned);

        // there must be 2 user-roles now
        this.logger.log(`Created Role: ` + role.id);
        x = await this.auth.getUserRoles();
        expect(x.length).toBeGreaterThan(1);

        // delete the user-role
        await this.auth.deleteUserRoleByRoleId(user.id, role.id);

        return role;
    }

    async createOneTask(user: UserEntity, folder: FolderEntity): Promise<TaskEntity> {
        const fakeTask = this.taskFactory.fakeCreateTask(user.id, folder.id);
        fakeTask['userId'] = user.id;
        const task = await this.taskFactory.createTask(fakeTask as unknown as TaskEntity);
        this.logger.log(`Created Task: ` + task.id);
        return task;
    }

    async createOneFolder(user: UserEntity): Promise<FolderEntity> {
        const fakeFolder = this.folderFactory.fakeCreateFolderEntity();
        fakeFolder.userId = user.id;
        const folder = await this.folderFactory.createFolder(fakeFolder);
        this.logger.log(`Created Folder: ` + folder.id);
        return folder;
    }

    async createOneWorkflow(): Promise<WorkFlowEntity> {
        const fakeWorkflow = this.workflowFactory.fakeCreateWorkFlowEntity();
        const workflow = await this.workflowFactory.createWorkFlow(fakeWorkflow);
        this.logger.log(`Created Workflow: ` + workflow.id);
        return workflow;
    }

    async createOneTaskRelation(user: UserEntity, parentTask: TaskEntity, childTask: TaskEntity): Promise<TaskRelationEntity> {
        const folder = await this.createOneFolder(user);
        const workflowRepo = this.dataSource.getRepository<WorkFlowEntity>(WorkFlowEntity);
        const folderWorkflow = await workflowRepo.save({
            Folder: folder,
            WorkflowStates: [],
            title: faker.string.uuid(),
            description: faker.string.uuid(),
            color: faker.color.human(),
        });
        const folderWorkflowStateRepo = this.dataSource.getRepository<WorkFlowStateEntity>(WorkFlowStateEntity);
        const folderWorkflowState2Save = new WorkFlowStateEntity();
        folderWorkflowState2Save.WorkFlow = folderWorkflow;
        folderWorkflowState2Save.code = makeid(8);
        folderWorkflowState2Save.index = 1;
        folderWorkflowState2Save.completed = false;
        folderWorkflowState2Save.color = faker.color.human();
        folderWorkflowState2Save.title = faker.commerce.productAdjective() + Date.now();
        const folderWorkflowState = await folderWorkflowStateRepo.save(folderWorkflowState2Save);
        const taskRelationRepo = this.dataSource.getRepository<TaskRelationEntity>(TaskRelationEntity);
        const taskRel2Save: TaskRelationEntity = new TaskRelationEntity();
        taskRel2Save.ParentTask = parentTask;
        taskRel2Save.ChildTask = childTask;
        taskRel2Save.index = 1;
        taskRel2Save.stateIndex = 1;
        taskRel2Save.Folder = folder;
        taskRel2Save.WorkFlowState = folderWorkflowState;
        const taskRel = await taskRelationRepo.save(taskRel2Save);
        this.logger.log('Created task relation: ', taskRel.id);
        return taskRel;
    }

    // 2024-01-09 JK: There are no inheritance of task permissions
    // @Test()
    // async InheritanceOfTaskPermission(): Promise<void> {
    //     const user = await this.userFactory.createUser();
    //     const folder = await this.createOneFolder(user);
    //     const parentTask = await this.createOneTask(user, folder);
    //     const childTask1 = await this.createOneTask(user, folder);
    //     const childTask2 = await this.createOneTask(user, folder);
    //     await this.createOneTaskRelation(user, parentTask, childTask1);
    //     await this.createOneTaskRelation(user, childTask1, childTask2);
    //
    //     // Give user access to parent and children
    //     await this.auth.grantToUser(PermissionOptions.READ, EntityTypeOptions.Folder, user.id, parentTask.id);
    //     await this.auth.grantToUser(PermissionOptions.READ, EntityTypeOptions.Folder, user.id, childTask1.id);
    //     await this.auth.grantToUser(PermissionOptions.READ, EntityTypeOptions.Folder, user.id, childTask2.id);
    //     // Grant new permissions on parent
    //     await this.auth.grantToUser(PermissionOptions.UPDATE, EntityTypeOptions.Folder, user.id, parentTask.id);
    //     // Expect new permission to be inherited on children
    //     const permissions1 = await this.auth.getPermissionsForEntity(EntityTypeOptions.Folder, childTask1.id);
    //     const hasPermission1 = permissions1.some((item) => (item.permissions & PermissionOptions.UPDATE) !== 0);
    //     expect(hasPermission1).toBe(true);
    //
    //     const permissions2 = await this.auth.getPermissionsForEntity(EntityTypeOptions.Folder, childTask1.id);
    //     const hasPermission2 = permissions2.some((item) => (item.permissions & PermissionOptions.UPDATE) !== 0);
    //     expect(hasPermission2).toBe(true);
    // }

    @Test('GrantOwner')
    async GrantOwner(): Promise<void> {
        const user = await this.userFactory.createUser();
        const tag = await this.tagFactory.createTag();
        await this.auth.grantOwner(EntityTypeOptions.CommonTag, user.id, tag.id);
        const ownerId = await this.auth.getEntityOwnerUserId(EntityTypeOptions.CommonTag, tag.id);
        expect(ownerId).toEqual(user.id);
    }

    @Test('GrantToUser')
    async GrantToUser(): Promise<void> {
        const user = await this.userFactory.createUser();
        const tag = await this.tagFactory.createTag();
        await this.auth.grantToUser(PermissionOptions.UPDATE, EntityTypeOptions.CommonTag, user.id, tag.id);
        const permissions = await this.auth.getPermissionsForEntity(EntityTypeOptions.CommonTag, tag.id);
        const hasPermission = permissions.some((item) => (item.permissions & PermissionOptions.UPDATE) !== 0);
        expect(hasPermission).toBe(true);
    }

    @Test('GrantToRole')
    async GrantToRole(): Promise<void> {
        const roleId = 1;
        await this.auth.grantToRole(PermissionOptions.UPDATE, EntityTypeOptions.CommonTag, roleId);
        const permissions = await this.auth.getPermissionsForRole(roleId, EntityTypeOptions.CommonTag);
        const hasPermission = permissions.some((item) => (item.permissions & PermissionOptions.UPDATE) !== 0);
        expect(hasPermission).toBe(true);
    }

    @Test('RevokeFromRole')
    async RevokeFromRole(): Promise<void> {
        const roleId = 1;
        // Make sure it doesn't have permissions first by revoking
        await this.auth.revokeFromRole(PermissionOptions.UPDATE, EntityTypeOptions.CommonTag, roleId);
        let permissions = await this.auth.getPermissionsForRole(roleId, EntityTypeOptions.CommonTag);
        let hasPermission = permissions.some((item) => (item.permissions & PermissionOptions.UPDATE) !== 0);
        expect(hasPermission).toBe(false);
        // Grant permission to role
        await this.auth.grantToRole(PermissionOptions.UPDATE, EntityTypeOptions.CommonTag, roleId);
        permissions = await this.auth.getPermissionsForRole(roleId, EntityTypeOptions.CommonTag);
        hasPermission = permissions.some((item) => (item.permissions & PermissionOptions.UPDATE) !== 0);
        expect(hasPermission).toBe(true);
        // Then revoke it
        await this.auth.revokeFromRole(PermissionOptions.UPDATE, EntityTypeOptions.CommonTag, roleId);
        permissions = await this.auth.getPermissionsForRole(roleId, EntityTypeOptions.CommonTag);
        hasPermission = permissions.some((item) => (item.permissions & PermissionOptions.UPDATE) !== 0);
        expect(hasPermission).toBe(false);
    }

    @Test('RevokeFromUser')
    async RevokeFromUser(): Promise<void> {
        const user = await this.userFactory.createUser();
        const tag = await this.tagFactory.createTag();
        // Grant permission first
        await this.auth.grantToUser(PermissionOptions.UPDATE, EntityTypeOptions.CommonTag, user.id, tag.id);
        let permissions = await this.auth.getPermissionsForEntity(EntityTypeOptions.CommonTag, tag.id);
        let hasPermission = permissions.some((item) => (item.permissions & PermissionOptions.UPDATE) !== 0);
        expect(hasPermission).toBe(true);
        // Then revoke it
        await this.auth.revokeFromUser(PermissionOptions.UPDATE, EntityTypeOptions.CommonTag, user.id, tag.id);
        permissions = await this.auth.getPermissionsForEntity(EntityTypeOptions.CommonTag, tag.id);
        hasPermission = permissions.some((item) => (item.permissions & PermissionOptions.UPDATE) !== 0);
        expect(hasPermission).toBe(false);
    }

    @Test('GetUserHasPermission')
    async GetUserHasPermission(): Promise<void> {
        const user = await this.userFactory.createUser();
        const tag = await this.tagFactory.createTag();
        // Grant permission first
        await this.auth.grantToUser(PermissionOptions.UPDATE, EntityTypeOptions.CommonTag, user.id, tag.id);
        const hasPermission = await this.auth.getUserHasPermissions(user.id, PermissionOptions.UPDATE, EntityTypeOptions.CommonTag, tag.id);
        expect(hasPermission).toBe(true);
    }
}
