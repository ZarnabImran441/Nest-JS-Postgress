import {TokenInterface} from '@lib/base-library';
import {HttpStatus, Inject, Logger, OnModuleInit} from '@nestjs/common';
import {Test, TestSuite} from 'nestjs-jest-decorators';
import {UserPermissionOptions} from '../../src/enum/folder-user.enum';
import {WorkFlowEntity} from '../../src/model/workflow.entity';
import {EntityTypeOptions, PermissionOptions} from '../../src/module/authorization-impl/authorization.enum';
import {FolderFactory} from '../factory/folder.factory';
import {TeamFactory} from '../factory/team.factory';
import {UserFactory} from '../factory/user.factory';
import {WorkflowFactory} from '../factory/workflow.factory';
import {NewBaseTest} from './base-test';

@TestSuite('Team Suite')
export class TeamE2eSpec extends NewBaseTest implements OnModuleInit {
    private readonly logger = new Logger(TeamE2eSpec.name);

    @Inject()
    private userFactory: UserFactory;
    @Inject()
    private teamFactory: TeamFactory;
    @Inject()
    private folderFactory: FolderFactory;
    @Inject()
    private workflowFactory: WorkflowFactory;

    onModuleInit(): void {
        this.setUrl('/team');
    }

    @Test('create a team')
    async createTeam(): Promise<void> {
        this.logger.log(`Create user`);
        const fakeUser = await this.userFactory.createUserForLogin({
            [EntityTypeOptions.Teams]: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        this.logger.log(`do login`);
        const response = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        const jwtToken = response.body;
        this.logger.log('create a team');
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        const fakeCreateTeamDto = this.teamFactory.fakeCreateTeamDto([userId]);
        const {body: createResponse} = await this.post(``, fakeCreateTeamDto, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(createResponse.id).toBeDefined();
        this.logger.log('get all teams');
        const {body: allTeamsResponse} = await this.get(``, jwtToken.accessToken).expect(HttpStatus.OK);
        const createdTeam = allTeamsResponse.filter((team) => team.id === createResponse.id);
        expect(createdTeam[0].id).toBe(createResponse.id);
        expect(createdTeam[0].title).toBe(createResponse.code);
        expect(createdTeam[0].description).toBe(createResponse.description);
    }

    @Test('update a team')
    async updateTeam(): Promise<void> {
        this.logger.log(`Create user`);
        const fakeUser = await this.userFactory.createUserForLogin({
            [EntityTypeOptions.Teams]: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        this.logger.log(`do login`);
        const response = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        const jwtToken = response.body;
        this.logger.log('create a team');
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        const fakeCreateTeamDto = this.teamFactory.fakeCreateTeamDto([userId]);
        const {body: createResponse} = await this.post(``, fakeCreateTeamDto, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(createResponse.id).toBeDefined();
        this.logger.log('update a team');
        const fakeUpdateTeamDto = this.teamFactory.fakeUpdateTeamDto();
        await this.patch(`${createResponse.id}`, fakeUpdateTeamDto, jwtToken.accessToken).expect(HttpStatus.OK);
        this.logger.log('get all teams');
        const {body: allTeamsResponse} = await this.get(``, jwtToken.accessToken).expect(HttpStatus.OK);
        const updatedTeam = allTeamsResponse.filter((team) => team.id === createResponse.id);
        expect(updatedTeam[0].title).toBe(fakeUpdateTeamDto.title);
        expect(updatedTeam[0].description).toBe(fakeUpdateTeamDto.description);
    }

    @Test('delete a team')
    async deleteTeam(): Promise<void> {
        this.logger.log(`Create user`);
        const fakeUser = await this.userFactory.createUserForLogin({
            [EntityTypeOptions.Teams]: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        this.logger.log(`do login`);
        const response = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        const jwtToken = response.body;
        this.logger.log('create a team');
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        const fakeCreateTeamDto = this.teamFactory.fakeCreateTeamDto([userId]);
        const {body: createResponse} = await this.post(``, fakeCreateTeamDto, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(createResponse.id).toBeDefined();
        this.logger.log('delete a team');
        const {body: deleteResponse} = await this.delete(`${createResponse.id}`, jwtToken.accessToken).expect(HttpStatus.OK);
        expect(deleteResponse.affected).toBe(1);
        const {body: allTeamsResponse} = await this.get(``, jwtToken.accessToken).expect(HttpStatus.OK);
        const deletedTeam = allTeamsResponse.filter((team) => team.id === createResponse.id);
        expect(deletedTeam.length).toBe(0);
    }

    @Test('check access for removed user from team on space')
    async checkForRemovedUserFromTeam(): Promise<void> {
        this.logger.log('Create users');
        const {token: jwtToken1} = await this.createUserWithPermissions();
        const {token: jwtToken2} = await this.createUserWithPermissions();
        const userId1 = this.getUserIdFromAccessToken(jwtToken1.accessToken);
        const userId2 = this.getUserIdFromAccessToken(jwtToken2.accessToken);
        this.logger.log('create a team');
        const fakeCreateTeamDto = this.teamFactory.fakeCreateTeamDto([userId1, userId2]);
        this.logger.log('fakeCreateTeamDto', fakeCreateTeamDto);
        const {body: teamResponse} = await this.post(`/team`, fakeCreateTeamDto, jwtToken1.accessToken).expect(HttpStatus.CREATED);
        expect(teamResponse.id).toBeDefined();
        this.logger.log('create workflow');
        const workflow: WorkFlowEntity = await this.createWorkflowForFolder(jwtToken1.accessToken);

        this.logger.log('create a space');
        const fakeCreateSpace = this.folderFactory.fakeCreateSpace({
            availableWorkflows: [workflow.id],
            members: [{id: userId2, userPermission: UserPermissionOptions.EDITOR}],
            teams: [{id: teamResponse.id, teamPermission: UserPermissionOptions.EDITOR}],
        });
        const {body: spaceResponse} = await this.post(`/space`, fakeCreateSpace, jwtToken1.accessToken).expect(HttpStatus.CREATED);
        expect(spaceResponse.id).toBeDefined();

        this.logger.log('get space by userId2');
        const {body: createdSpace} = await this.get(`/space/${spaceResponse.id}`, jwtToken2.accessToken).expect(HttpStatus.OK);
        expect(createdSpace).toBeDefined();

        this.logger.log('remove user from team');
        await this.patch(`/team/${teamResponse.id}`, {users: {delete: [userId2]}}, jwtToken1.accessToken).expect(HttpStatus.OK);

        this.logger.log('get space by  userId2');
        await this.get(`/space/${spaceResponse.id}`, jwtToken2.accessToken).expect(HttpStatus.FORBIDDEN);
    }

    @Test(' access space from newly added user to team')
    async checkAccessForNewUser(): Promise<void> {
        this.logger.log('Create users');
        const {token: jwtToken1} = await this.createUserWithPermissions();
        const {token: jwtToken2} = await this.createUserWithPermissions();
        const userId1 = this.getUserIdFromAccessToken(jwtToken1.accessToken);
        const userId2 = this.getUserIdFromAccessToken(jwtToken2.accessToken);
        this.logger.log('create a team');
        const fakeCreateTeamDto = this.teamFactory.fakeCreateTeamDto([userId1]);
        this.logger.log('fakeCreateTeamDto', fakeCreateTeamDto);
        const {body: teamResponse} = await this.post(`/team`, fakeCreateTeamDto, jwtToken1.accessToken).expect(HttpStatus.CREATED);
        expect(teamResponse.id).toBeDefined();
        this.logger.log('create workflow');
        const workflow: WorkFlowEntity = await this.createWorkflowForFolder(jwtToken1.accessToken);

        this.logger.log('create a space');
        const fakeCreateSpace = this.folderFactory.fakeCreateSpace({
            availableWorkflows: [workflow.id],
            teams: [{id: teamResponse.id, teamPermission: UserPermissionOptions.EDITOR}],
        });
        const {body: spaceResponse} = await this.post(`/space`, fakeCreateSpace, jwtToken1.accessToken).expect(HttpStatus.CREATED);
        expect(spaceResponse.id).toBeDefined();

        this.logger.log('add user to team');
        await this.patch(`/team/${teamResponse.id}`, {users: {insert: [userId2]}}, jwtToken1.accessToken).expect(HttpStatus.OK);

        this.logger.log('get space by userId2');
        const {body: response} = await this.get(`/space/${spaceResponse.id}`, jwtToken2.accessToken);
        const user = response.teams[0].members.find((el) => el.id === userId2);
        expect(user).toBeDefined();
    }

    /**
     * Creates a workflow for a given folder.
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
}
