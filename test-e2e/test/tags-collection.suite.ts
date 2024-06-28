import {HttpStatus, Inject, Logger, OnModuleInit} from '@nestjs/common';
import {TestSuite, Test} from 'nestjs-jest-decorators';
import {TagTypeOptions} from '../../src/enum/tag.enum';
import {EntityTypeOptions, PermissionOptions} from '../../src/module/authorization-impl/authorization.enum';
import {TagFactory} from '../factory/tag.factory';
import {TagsCollectionFactory} from '../factory/tags-collection.factory';
import {UserFactory} from '../factory/user.factory';
import {NewBaseTest} from './base-test';

@TestSuite('Tag Collection Suite')
export class TagsCollectionE2eSpec extends NewBaseTest implements OnModuleInit {
    private readonly logger = new Logger(TagsCollectionE2eSpec.name);

    @Inject()
    private userFactory: UserFactory;
    @Inject()
    private tagsCollectionFactory: TagsCollectionFactory;
    @Inject()
    private tagFactory: TagFactory;

    onModuleInit(): void {
        this.setUrl('/tag-collection');
    }

    @Test('create a tags collection')
    async CreateTagsCollection(): Promise<void> {
        this.logger.log('create user');
        const fakeUser = await this.userFactory.createUserForLogin({
            [EntityTypeOptions.CommonTag]: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            [EntityTypeOptions.TagsCollection]: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        const loginResponse = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        const jwtToken = loginResponse.body;
        this.logger.log(`create common tag`);
        const fakeTag = this.tagFactory.fakeCreateTag(TagTypeOptions.COMMON_TAG);
        const {body: createdTag} = await this.post(`/tags`, fakeTag, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(createdTag).toBeDefined();

        this.logger.log('create a tag collection');
        const fakeTagCollection = this.tagsCollectionFactory.fakeCreateTagsCollection([createdTag.id]);
        const {body: createdResponse} = await this.post(``, fakeTagCollection, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(createdResponse.identifiers[0].id).toBeDefined();

        this.logger.log('get all tags collection');
        const {body: allCollectionResponse} = await this.get(``, jwtToken.accessToken).expect(HttpStatus.OK);
        const createdCollection = allCollectionResponse.filter((el) => el.id === createdResponse.identifiers[0].id);
        expect(createdCollection[0].title).toBe(fakeTagCollection.title);
        expect(createdCollection[0].description).toBe(fakeTagCollection.description);
        expect(createdCollection[0].Tags[0].id).toBe(createdTag.id);
    }

    @Test('update a tags collection')
    async updateTagsCollection(): Promise<void> {
        this.logger.log('create user');
        const fakeUser = await this.userFactory.createUserForLogin({
            [EntityTypeOptions.CommonTag]: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            [EntityTypeOptions.TagsCollection]: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        const loginResponse = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        const jwtToken = loginResponse.body;
        this.logger.log(`create common tag`);
        const fakeTag1 = this.tagFactory.fakeCreateTag(TagTypeOptions.COMMON_TAG);
        const {body: createdTag1} = await this.post(`/tags`, fakeTag1, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(createdTag1).toBeDefined();

        this.logger.log('create a tag collection');
        const fakeTagCollection = this.tagsCollectionFactory.fakeCreateTagsCollection([createdTag1.id]);
        const {body: createdResponse} = await this.post(``, fakeTagCollection, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(createdResponse.identifiers[0].id).toBeDefined();

        this.logger.log(`create common tag`);
        const fakeTag2 = this.tagFactory.fakeCreateTag(TagTypeOptions.COMMON_TAG);
        const {body: createdTag2} = await this.post(`/tags`, fakeTag2, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(createdTag2).toBeDefined();

        this.logger.log('update tag collection');
        const fakeUpdateTagCollection = this.tagsCollectionFactory.fakeCreateTagsCollection([createdTag2.id]);
        const {body: updatedResponse} = await this.patch(
            `${createdResponse.identifiers[0].id}`,
            fakeUpdateTagCollection,
            jwtToken.accessToken
        ).expect(HttpStatus.OK);
        expect(updatedResponse.affected).toBe(1);

        this.logger.log('get all tags collection');
        const {body: allCollectionResponse} = await this.get(``, jwtToken.accessToken).expect(HttpStatus.OK);
        const updatedCollection = allCollectionResponse.filter((el) => el.id === createdResponse.identifiers[0].id);
        expect(updatedCollection[0].title).toBe(fakeUpdateTagCollection.title);
        expect(updatedCollection[0].description).toBe(fakeUpdateTagCollection.description);
        expect(updatedCollection[0].Tags[0].id).toBe(createdTag2.id);
    }

    @Test('delete a tags collection')
    async deleteTagsCollection(): Promise<void> {
        this.logger.log('create user');
        const fakeUser = await this.userFactory.createUserForLogin({
            [EntityTypeOptions.CommonTag]: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            [EntityTypeOptions.TagsCollection]: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        const loginResponse = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        const jwtToken = loginResponse.body;
        this.logger.log(`create common tag`);
        const fakeTag = this.tagFactory.fakeCreateTag(TagTypeOptions.COMMON_TAG);
        const {body: createdTag} = await this.post(`/tags`, fakeTag, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(createdTag).toBeDefined();

        this.logger.log('create a tag collection');
        const fakeTagCollection = this.tagsCollectionFactory.fakeCreateTagsCollection([createdTag.id]);
        const {body: createdResponse} = await this.post(``, fakeTagCollection, jwtToken.accessToken).expect(HttpStatus.CREATED);
        expect(createdResponse.identifiers[0].id).toBeDefined();

        this.logger.log('delete tag collection');
        const {body: deletedResponse} = await this.delete(`${createdResponse.identifiers[0].id}`, jwtToken.accessToken).expect(
            HttpStatus.OK
        );
        expect(deletedResponse.affected).toBe(1);

        this.logger.log('get all tags collection');
        const {body: allCollectionResponse} = await this.get(``, jwtToken.accessToken).expect(HttpStatus.OK);
        const deletedCollection = allCollectionResponse.filter((el) => el.id === createdResponse.identifiers[0].id);
        expect(deletedCollection.length).toBe(0);
    }
}
