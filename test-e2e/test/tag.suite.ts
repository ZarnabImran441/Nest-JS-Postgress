import {HttpStatus, Inject, Logger, OnModuleInit} from '@nestjs/common';
import {Values} from '@test-lib/test-base-library';
import {Test, TestSuite} from 'nestjs-jest-decorators';
import {TagTypeOptions} from '../../src/enum/tag.enum';
import {TagEntity} from '../../src/model/tag.entity';
import {EntityTypeOptions, PermissionOptions} from '../../src/module/authorization-impl/authorization.enum';
import {TagFactory} from '../factory/tag.factory';
import {UserFactory} from '../factory/user.factory';
import {NewBaseTest} from './base-test';

@TestSuite('Tag Suite')
export class TagE2eSpec extends NewBaseTest implements OnModuleInit {
    private readonly logger = new Logger(TagE2eSpec.name);

    @Inject()
    private factory: TagFactory;
    @Inject()
    private userFactory: UserFactory;

    onModuleInit(): void {
        this.setUrl('/tags');
    }

    @Test('Create common tag')
    async createCommonTag(): Promise<void> {
        this.logger.log(`Create user`);
        const fakeUser = await this.userFactory.createUserForLogin({
                [EntityTypeOptions.CommonTag]: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            }),
            fakeTag = this.factory.fakeCreateTag(TagTypeOptions.COMMON_TAG);
        this.logger.log(`do login`);
        let response = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        const jwtToken = response.body;
        this.logger.log(`create common tag`);
        const newTag = await this.post(``, fakeTag, jwtToken.accessToken);
        expect(response.status).toBe(HttpStatus.CREATED);
        this.logger.log(`check tag exists`);
        response = await this.get(``, jwtToken.accessToken);
        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body).toContainEqual(newTag.body);
    }

    @Test('Update common tag')
    async updateCommonTag(): Promise<void> {
        this.logger.log(`Create user`);
        const fakeUser = await this.userFactory.createUserForLogin({
                [EntityTypeOptions.CommonTag]: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            }),
            fakeTag = this.factory.fakeCreateTag(TagTypeOptions.COMMON_TAG);
        this.logger.log(`do login`);
        let response = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        const jwtToken = response.body;
        this.logger.log(`create common tag`);
        await this.post(``, fakeTag, jwtToken.accessToken);
        this.logger.log(`get common tags`);
        const tags = await this.get(``, jwtToken.accessToken),
            tag: TagEntity = tags.body[Values.randomIntFromInterval(0, tags.body.length - 1)];
        expect(response.status).toBe(HttpStatus.CREATED);
        this.logger.log(`update existing common tag`);
        const newTagDto = this.factory.fakeCreateTag(tag.type);
        response = await this.patch(`${tag.id}`, newTagDto, jwtToken.accessToken);
        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body.affected).toBe(1);
        this.logger.log(`check new common tag exists`);
        response = await this.get(``, jwtToken.accessToken);
        expect(response.status).toBe(HttpStatus.OK);
        tag.color = newTagDto.color;
        tag.title = newTagDto.title;
        const tagDB = response.body.find((dbTag) => dbTag.id === tag.id);
        expect(tagDB).toBeDefined();
        expect(tagDB.title).toBe(tag.title);
        expect(tagDB.color).toBe(tag.color);
        expect(tagDB.type).toBe(tag.type);
    }

    @Test('Delete common tag')
    async deleteCommonTag(): Promise<void> {
        this.logger.log(`Create user`);
        const fakeUser = await this.userFactory.createUserForLogin({
                [EntityTypeOptions.CommonTag]: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            }),
            fakeTag = this.factory.fakeCreateTag(TagTypeOptions.COMMON_TAG);
        this.logger.log(`do login`);
        let response = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        const jwtToken = response.body;
        this.logger.log(`create common tag`);
        const {body: createResponse} = await this.post(``, fakeTag, jwtToken.accessToken);
        this.logger.log(`get common tags`);
        const tags = await this.get(``, jwtToken.accessToken),
            tag: TagEntity = tags.body.find((el) => el.id === createResponse.id);
        expect(response.status).toBe(HttpStatus.CREATED);
        this.logger.log(`delete existing common tag`);
        response = await this.delete(`${tag.id}`, jwtToken.accessToken);
        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body.affected).toBe(1);
        this.logger.log(`check common tag does not exists`);
        response = await this.get(``, jwtToken.accessToken);
        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body).not.toContainEqual(tag);
    }

    @Test('Create user tag')
    async createUserTag(): Promise<void> {
        this.logger.log(`Create user`);
        const fakeUser = await this.userFactory.createUserForLogin({
                [EntityTypeOptions.UserTag]: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            }),
            fakeTag = this.factory.fakeCreateTag(TagTypeOptions.USER_TAG);
        this.logger.log(`do login`);
        let response = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        const jwtToken = response.body;
        this.logger.log(`create user tag`);
        const newTag = await this.post(`per-user`, fakeTag, jwtToken.accessToken);
        expect(response.status).toBe(HttpStatus.CREATED);
        this.logger.log(`check tag exists`);
        response = await this.get(`per-user`, jwtToken.accessToken);
        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body).toContainEqual(newTag.body);
    }

    @Test('Update user tag')
    async updateUserTag(): Promise<void> {
        this.logger.log(`Create user`);
        const fakeUser = await this.userFactory.createUserForLogin({
                [EntityTypeOptions.UserTag]: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            }),
            fakeTag = this.factory.fakeCreateTag(TagTypeOptions.USER_TAG);
        this.logger.log(`do login`);
        let response = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        const jwtToken = response.body;
        this.logger.log(`create user tag`);
        await this.post(`per-user`, fakeTag, jwtToken.accessToken);
        this.logger.log(`get user tags`);
        const tags = await this.get(`per-user`, jwtToken.accessToken),
            tag: TagEntity = tags.body[Values.randomIntFromInterval(0, tags.body.length - 1)];
        expect(response.status).toBe(HttpStatus.CREATED);
        this.logger.log(`update existing user tag`);
        const newTagDto = this.factory.fakeCreateTag(tag.type);
        response = await this.patch(`per-user/${tag.id}`, newTagDto, jwtToken.accessToken);
        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body.affected).toBe(1);
        this.logger.log(`check new user tag exists`);
        response = await this.get(`per-user`, jwtToken.accessToken);
        expect(response.status).toBe(HttpStatus.OK);
        tag.color = newTagDto.color;
        tag.title = newTagDto.title;
        const tagDB = response.body.find((dbTag) => dbTag.id === tag.id);
        expect(tagDB).toBeDefined();
        expect(tagDB.title).toBe(tag.title);
        expect(tagDB.color).toBe(tag.color);
        expect(tagDB.type).toBe(tag.type);
    }

    @Test('Delete user tag')
    async deleteUserTag(): Promise<void> {
        this.logger.log(`Create user`);
        const fakeUser = await this.userFactory.createUserForLogin({
                [EntityTypeOptions.UserTag]: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            }),
            fakeTag = this.factory.fakeCreateTag(TagTypeOptions.USER_TAG);
        this.logger.log(`do login`);
        let response = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        const jwtToken = response.body;
        this.logger.log(`create user tag`);
        await this.post(`per-user`, fakeTag, jwtToken.accessToken);
        this.logger.log(`get user tags`);
        const tags = await this.get(`per-user`, jwtToken.accessToken),
            tag: TagEntity = tags.body[Values.randomIntFromInterval(0, tags.body.length - 1)];
        expect(response.status).toBe(HttpStatus.CREATED);
        this.logger.log(`delete existing user tag`);
        response = await this.delete(`per-user/${tag.id}`, jwtToken.accessToken);
        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body.affected).toBe(1);
        this.logger.log(`check user tag does not exists`);
        response = await this.get(`per-user`, jwtToken.accessToken);
        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body).not.toContainEqual(tag);
    }
}
