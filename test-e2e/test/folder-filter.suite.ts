import {faker} from '@faker-js/faker';
import {TokenInterface} from '@lib/base-library';
import {HttpStatus, Inject, Logger, OnModuleInit} from '@nestjs/common';
import {ChangeWorkflowFolderDto, ChangeWorkflowOptions} from '../../src/dto/folder/folder/change-workflow.dto';
import {GetFolderDto} from '../../src/dto/folder/folder/get-folder.dto';
import {FolderFilterEntity} from '../../src/model/folder-filter.entity';
import {WorkFlowEntity} from '../../src/model/workflow.entity';
import {PermissionOptions} from '../../src/module/authorization-impl/authorization.enum';
import {FolderFiltersFactory} from '../factory/folder-filters.factory';
import {FolderFactory} from '../factory/folder.factory';
import {UserFactory} from '../factory/user.factory';
import {WorkflowFactory} from '../factory/workflow.factory';
import {NewBaseTest} from './base-test';
import {TestSuite, Test} from 'nestjs-jest-decorators';

@TestSuite('Folder Filters Suite')
export class FolderFiltersE2eSpec extends NewBaseTest implements OnModuleInit {
    private readonly logger = new Logger(FolderFiltersE2eSpec.name);

    @Inject()
    private userFactory: UserFactory;
    @Inject()
    private folderFactory: FolderFactory;
    @Inject()
    private workflowFactory: WorkflowFactory;

    private folderFiltersFactory: FolderFiltersFactory = new FolderFiltersFactory();

    onModuleInit(): void {
        this.setUrl('/folder-filter');
    }

    /**
     * Folder Filter Service
     */
    @Test('Create Folder Filters')
    async createFolderFilters(): Promise<{folderFiltersDB: FolderFilterEntity[]; jwtToken: TokenInterface}> {
        this.logger.log('create user and login');

        const fakeUser = await this.userFactory.createUserForLogin({
            workflow: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            folder: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            folderFilter: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            displacementGroup: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            space: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        const {body: jwtToken} = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        const {body: systemStages} = await this.get(`/displacement-group/system-stage`, jwtToken.accessToken);
        const fakeWorkflow = this.workflowFactory.fakeCreateWorkflow(systemStages[0]?.id);
        const {body: workflow} = await this.post(`/workflow`, fakeWorkflow, jwtToken.accessToken);
        this.logger.log(`check workflow exists`);
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
        this.logger.log('create folder');
        const userId = this.getUserIdFromAccessToken(jwtToken.accessToken);
        const spaceResponse = await this.createSpace(userId, jwtToken.accessToken, [workflow.id]);

        const fakeFolder = this.folderFactory.fakeCreateFolder(fakeChangeWorkflow, spaceResponse.id);
        const {body: f1} = await this.post(`/folder`, fakeFolder, jwtToken.accessToken);

        const filtersDto = this.folderFiltersFactory.fakeCreateFolderFilterDto(jwtToken.id);
        const {body: response} = await this.post(`${f1.id}`, filtersDto, jwtToken.accessToken);
        // folderFilterService.create(folderDB.id, filtersDto);
        expect(response.identifiers.length).toBeGreaterThan(0);
        const {body: folderFiltersDB} = await this.get(`${f1.id}`, jwtToken.accessToken).expect(HttpStatus.OK);
        return {folderFiltersDB, jwtToken};
        //To do
        //     fakeFolder = this.folderFactory.fakeCreateFolder(fakeChangeWorkflow),
        //    folderDB = await folderService.createFolder(fakeFolder, fakeUser);
        // this.logger.log('create folder filter', fakeFolder);
        // const filtersDto = await this.FolderFiltersFactory.fakeCreateFolderFilterDto(fakeUser);
        // const response = await folderFilterService.create(folderDB.id, filtersDto);
        // expect(response.identifiers.length).toBeGreaterThan(0);
        // const folderFilterDb = await folderFilterService.getOneByFolderId(folderDB.id);
        // await this._validateFolderFilterResponse(filtersDto, folderDB.id);
        // return folderFilterDb;
    }

    @Test('Update Folder Filters')
    async updateFolderFilters(): Promise<void> {
        const {folderFiltersDB, jwtToken} = await this.createFolderFilters(),
            fakeUpdateFolderFilterDto = this.folderFiltersFactory.fakeUpdateFolderFilterDto(jwtToken.id, folderFiltersDB[0].Folder.id);

        this.logger.log('update folder filter', fakeUpdateFolderFilterDto);
        const {body: response} = await this.patch(
            `${folderFiltersDB[0].id}/folder/${folderFiltersDB[0].Folder.id}`,
            fakeUpdateFolderFilterDto,
            jwtToken.accessToken
        );
        expect(response.affected).toEqual(1);
    }

    @Test('Get Folder Filters by folderId')
    async getOneByFolderId(): Promise<void> {
        const {folderFiltersDB, jwtToken} = await this.createFolderFilters();

        const {body: response} = await this.get(`${folderFiltersDB[0].Folder.id}`, jwtToken.accessToken);
        expect(response).toMatchObject(folderFiltersDB);
    }

    @Test('Delete Folder Filters by folderId')
    async deleteOneFolderFilter(): Promise<void> {
        const {folderFiltersDB, jwtToken} = await this.createFolderFilters();

        const {body: response} = await this.delete(`${folderFiltersDB[0].id}/folder/${folderFiltersDB[0].Folder.id}`, jwtToken.accessToken);
        expect(response.affected).toEqual(1);

        const {body: fDB} = await this.get(`${folderFiltersDB[0].Folder.id}`, jwtToken.accessToken);
        expect(fDB).toHaveLength(0);

        this.logger.log('Result should be null because we are trying to get a delete row from db');
        await this.delete(`folder/${folderFiltersDB[0].Folder.id}/${folderFiltersDB[0].id}`, jwtToken.accessToken).expect(
            HttpStatus.NOT_FOUND
        );
    }

    async _createMultipleFolderFilters(): Promise<{fakeFolderFilters: FolderFilterEntity[]; token: TokenInterface}> {
        const fakeFolderFilters = [],
            randomNumber = faker.number.int({min: 1, max: 5});
        let token: TokenInterface;

        for (let i = 0; i < randomNumber; i++) {
            const {folderFiltersDB, jwtToken} = await this.createFolderFilters();
            fakeFolderFilters.push(folderFiltersDB);
            token = jwtToken;
        }

        return {fakeFolderFilters, token};
    }

    async createWorkflowForFolder(token: string): Promise<WorkFlowEntity> {
        const {body: systemStages} = await this.get(`/displacement-group/system-stage`, token);
        const fakeWorkflow = this.workflowFactory.fakeCreateWorkflow(systemStages[0].id);
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

    private async createSpace(userId: string, accessToken: string, workflowIds: number[]): Promise<GetFolderDto> {
        this.logger.log('create a space');
        const fakeCreateSpace = this.folderFactory.fakeCreateSpace({availableWorkflows: workflowIds});
        const {body: spaceResponse} = await this.post(`/space`, fakeCreateSpace, accessToken).expect(HttpStatus.CREATED);
        expect(spaceResponse).toBeDefined();
        return spaceResponse;
    }
}
