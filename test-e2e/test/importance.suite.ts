import {HttpStatus, Inject, Logger, OnModuleInit} from '@nestjs/common';
import {Test, TestSuite} from 'nestjs-jest-decorators';
import {ImportanceEntity} from '../../src/model/importance.entity';
import {EntityTypeOptions, PermissionOptions} from '../../src/module/authorization-impl/authorization.enum';
import {ImportanceFactory} from '../factory/importance.factory';
import {TaskFactory} from '../factory/task.factory';
import {UserFactory} from '../factory/user.factory';
import {NewBaseTest} from './base-test';

@TestSuite('Importance Suite')
export class ImportanceE2eSpec extends NewBaseTest implements OnModuleInit {
    private readonly logger = new Logger(ImportanceE2eSpec.name);

    @Inject()
    private factory: ImportanceFactory;
    @Inject()
    private userFactory: UserFactory;
    @Inject()
    private taskFactory: TaskFactory;

    onModuleInit(): void {
        this.setUrl('/importance');
    }

    @Test('createImportance')
    async createImportance(): Promise<void> {
        await this.RemoveOldImportances(99);
        this.logger.log(`Create user`);
        const fakeUser = await this.userFactory.createUserForLogin({
                [EntityTypeOptions.Importance]: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            }),
            fakeImportance = this.factory.fakeCreateImportance(99, false);
        this.logger.log(`do login`);
        let response = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        const jwtToken = response.body;
        this.logger.log(`create common importance`);
        const newImportance = await this.post(``, fakeImportance, jwtToken.accessToken);
        expect(newImportance.status).toBe(HttpStatus.CREATED);
        this.logger.log(`check importance exists`);
        response = await this.get(``, jwtToken.accessToken);
        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body).toContainObject({id: newImportance.body.identifiers[0].id});
    }

    @Test('checkMultipleDefaultImportance')
    async checkMultipleDefaultImportance(): Promise<void> {
        await this.RemoveAllImportances();
        await this.RemoveOldImportances(97);
        await this.RemoveOldImportances(98);
        const fakeUser = await this.userFactory.createUserForLogin({
                [EntityTypeOptions.Importance]: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            }),
            fakeImportance1 = this.factory.fakeCreateImportance(97, true),
            fakeImportance2 = this.factory.fakeCreateImportance(98, true);

        const response = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        const jwtToken = response.body;
        await this.post(``, fakeImportance1, jwtToken.accessToken).expect(HttpStatus.CREATED);
        await this.post(``, fakeImportance2, jwtToken.accessToken).expect(HttpStatus.BAD_REQUEST);
    }

    @Test('updateImportance')
    async updateImportance(): Promise<void> {
        await this.RemoveOldImportances(95);
        this.logger.log(`Create user`);
        const fakeUser = await this.userFactory.createUserForLogin({
                [EntityTypeOptions.Importance]: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            }),
            fakeImportance = this.factory.fakeCreateImportance(95, false);
        this.logger.log(`do login`);
        let response = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        const jwtToken = response.body;
        this.logger.log(`create common importance`);
        response = await this.post(``, fakeImportance, jwtToken.accessToken);
        expect(response.status).toBe(HttpStatus.CREATED);
        this.logger.log(`get common importance's`);
        const importances = await this.get(``, jwtToken.accessToken),
            importance: ImportanceEntity = importances.body.find((x: ImportanceEntity) => x.index === 95);
        this.logger.log(`update existing common importance`);
        const newImportanceDto = this.factory.fakeCreateImportance(95, false);
        response = await this.patch(`${importance.id}`, newImportanceDto, jwtToken.accessToken);

        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body.affected).toBe(1);
        this.logger.log(`check new common importance exists`);
        response = await this.get(``, jwtToken.accessToken);
        expect(response.status).toBe(HttpStatus.OK);

        const updatedResponse = response.body.find((el) => el.id === importance.id);

        expect(updatedResponse.description).toBe(newImportanceDto.description);
        expect(updatedResponse.color).toBe(newImportanceDto.color);
        expect(updatedResponse.index).toBe(newImportanceDto.index);
    }

    @Test('ImportanceE2eSpec')
    async deleteImportance(): Promise<void> {
        await this.RemoveOldImportances(94);
        this.logger.log(`Create user`);
        const fakeUser = await this.userFactory.createUserForLogin({
                [EntityTypeOptions.Importance]: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            }),
            fakeImportance = this.factory.fakeCreateImportance(94, false);
        this.logger.log(`do login`);
        let response = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        const jwtToken = response.body;
        this.logger.log(`create common importance`);
        await this.post(``, fakeImportance, jwtToken.accessToken);
        this.logger.log(`get common importance's`);
        const importances = await this.get(``, jwtToken.accessToken),
            importance: ImportanceEntity = importances.body.find((x: ImportanceEntity) => x.index === 99);
        expect(response.status).toBe(HttpStatus.CREATED);
        this.logger.log(`delete existing common importance`);
        response = await this.delete(`${importance.id}`, jwtToken.accessToken);
        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body.affected).toBe(1);
        this.logger.log(`check common importance does not exists`);
        response = await this.get(``, jwtToken.accessToken);
        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body).not.toContainObject(importance);
    }

    private async RemoveOldImportances(index: number): Promise<void> {
        this.logger.log(`Clean importance by index`);
        await this.taskFactory.removeImportanceByIndex(index);
        await this.factory.deleteAllByIndex(index);
    }

    private async RemoveAllImportances(): Promise<void> {
        this.logger.log(`Clean all importance`);
        await this.taskFactory.removeAllImportance();
        await this.factory.deleteAllByDefault();
    }

    private async RemoveOldDefaultImportances(): Promise<void> {
        this.logger.log(`Clean default importance`);
        await this.taskFactory.removeImportanceByDefault();
        await this.factory.deleteAllByDefault();
    }

    @Test('updateImportancePosition')
    async updateImportancePosition(): Promise<void> {
        await this.RemoveOldImportances(91);
        await this.RemoveOldImportances(92);
        this.logger.log(`Create user`);
        const fakeUser = await this.userFactory.createUserForLogin({
            [EntityTypeOptions.Importance]: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });

        this.logger.log(`do login`);
        const response = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        const jwtToken = response.body;

        this.logger.log(`create common importances`);
        const firstFakeImportance = this.factory.fakeCreateImportance(91, false);
        const secondFakeImportance = this.factory.fakeCreateImportance(92, false);

        const {body: response1} = await this.post(``, firstFakeImportance, jwtToken.accessToken).expect(HttpStatus.CREATED);
        await this.post(``, secondFakeImportance, jwtToken.accessToken).expect(HttpStatus.CREATED);

        const {body: importances} = await this.get(``, jwtToken.accessToken),
            importance: ImportanceEntity = importances.find((x: ImportanceEntity) => x.id === response1.identifiers[0].id);

        await this.patch(
            `position/${importance.id}`,
            {currentIndex: firstFakeImportance.index, newIndex: secondFakeImportance.index},
            jwtToken.accessToken
        );

        const {body: updatedImportances} = await this.get(``, jwtToken.accessToken),
            updatedImportance: ImportanceEntity = updatedImportances.find((x: ImportanceEntity) => x.id === response1.identifiers[0].id);

        expect(updatedImportance.index).toBe(secondFakeImportance.index);
        expect(updatedImportance.description).toBe(firstFakeImportance.description);
        expect(updatedImportance.icon).toBe(firstFakeImportance.icon);
        expect(updatedImportance.color).toBe(firstFakeImportance.color);
    }
}
