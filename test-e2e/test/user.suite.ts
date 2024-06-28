import {faker} from '@faker-js/faker';
import '@jest-decorated/core/globals';
import {TokenInterface} from '@lib/base-library';
import {HttpStatus, Inject, OnModuleInit} from '@nestjs/common';
import {Test, TestSuite} from 'nestjs-jest-decorators';
import {UserPermissonsGroupDto} from '../../src/dto/user/user-filter.dto';
import {UserEntity} from '../../src/model/user.entity';
import {PermissionOptions} from '../../src/module/authorization-impl/authorization.enum';
import {UserFactory} from '../factory/user.factory';
import {NewBaseTest} from './base-test';

@TestSuite('Users Suite')
export class UserE2eSpec extends NewBaseTest implements OnModuleInit {
    @Inject()
    private factory: UserFactory;

    onModuleInit(): void {
        this.setUrl('/users');
    }

    @Test('Logins must fail')
    async loginsMustFail(): Promise<void> {
        const fakeUser = await this.factory.createUserForLogin({user: PermissionOptions.LOGIN | PermissionOptions.READ});
        await this.post(`/pas-authentication/login`, {
            email: fakeUser.email,
            password: faker.string.alpha(10),
        }).expect(HttpStatus.UNAUTHORIZED);
        await this.post(`/pas-authentication/login`, {
            email: faker.internet.email(),
            password: UserFactory.DEFAULT_PASSWORD,
        }).expect(HttpStatus.UNAUTHORIZED);
        await this.post(`/pas-authentication/login`, {
            email: faker.internet.email(),
            password: faker.string.alpha(10),
        }).expect(HttpStatus.UNAUTHORIZED);
    }

    @Test('Success login and get profile')
    async successLogin(): Promise<void> {
        // do login
        const fakeUser = await this.factory.createUserForLogin({user: PermissionOptions.LOGIN | PermissionOptions.READ});
        const response = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        const jwtToken: TokenInterface = response.body;
        expect(jwtToken.accessToken).toBeDefined();
        expect(jwtToken.refreshToken).toBeDefined();
        // get profile
        await this.get(`profile`).expect(HttpStatus.UNAUTHORIZED);
        await this.get(`profile`, 'fruit').expect(HttpStatus.UNAUTHORIZED);
        const response2 = await this.get(`profile`, jwtToken.accessToken).expect(HttpStatus.OK);
        const profile: UserEntity = response2.body;
        expect(profile.email).toBe(fakeUser.email);
    }

    @Test('Get Permissions Group')
    async getPermissionGroup(): Promise<void> {
        // do login
        const fakeUser = await this.factory.createUserForLogin({
            user: PermissionOptions.LOGIN | PermissionOptions.READ,
            'permission-manager': PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        const response = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        const jwtToken: TokenInterface = response.body;
        expect(jwtToken.accessToken).toBeDefined();
        expect(jwtToken.refreshToken).toBeDefined();

        // get permission groups
        await this.get(`permissions-groups`).expect(HttpStatus.UNAUTHORIZED);
        const response2 = await this.get(`permissions-groups`, jwtToken.accessToken).expect(HttpStatus.OK);
        const permissionGroups: UserPermissonsGroupDto[] = response2.body;
        expect(permissionGroups).toBeInstanceOf(Array);
        expect(permissionGroups.find((el) => el.email === fakeUser.email).permissionGroups).toHaveLength(0);
    }

    @Test('getFilteredUsers')
    async getFilteredUsers(): Promise<void> {
        // do login
        const fakeUser = await this.factory.createUser();
        const response = await this.post(`/pas-authentication/login`, {
            ...fakeUser,
        }).expect(HttpStatus.CREATED);
        const jwtToken: TokenInterface = response.body;
        expect(jwtToken.accessToken).toBeDefined();
        expect(jwtToken.refreshToken).toBeDefined();

        // get filtered users
        await this.get(`filters`).expect(HttpStatus.UNAUTHORIZED);
        const {body: filteredUser} = await this.get(`filters?nameSearchQuery=${fakeUser.firstName}`, jwtToken.accessToken).expect(
            HttpStatus.OK
        );
        expect(filteredUser.length).toBeGreaterThan(0);
        // TODO: added more test cases once the filter is implemented
    }

    @Test('getUserSetting')
    async getUserSetting(): Promise<void> {
        // do login
        const fakeUser = await this.factory.createUser();
        const response = await this.post(`/pas-authentication/login`, {
            ...fakeUser,
        }).expect(HttpStatus.CREATED);
        const jwtToken: TokenInterface = response.body;
        expect(jwtToken.accessToken).toBeDefined();
        expect(jwtToken.refreshToken).toBeDefined();

        // get user settings
        await this.get(`user-settings`).expect(HttpStatus.UNAUTHORIZED);
        const {body: userSetting} = await this.get(`user-settings`, jwtToken.accessToken).expect(HttpStatus.OK);
        expect(userSetting).toBeInstanceOf(Object);
        expect(userSetting.settings).toBeInstanceOf(Object);
    }

    @Test('updateUserSetting')
    async updateUserSetting(): Promise<void> {
        // do login
        const fakeUser = await this.factory.createUserForLogin({
            user: PermissionOptions.READ_UPDATE_DELETE,
        });
        const response = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        const jwtToken: TokenInterface = response.body;
        expect(jwtToken.accessToken).toBeDefined();
        expect(jwtToken.refreshToken).toBeDefined();

        // get user settings
        await this.get(`user-settings`).expect(HttpStatus.UNAUTHORIZED);
        const {body: userSetting} = await this.get(`user-settings`, jwtToken.accessToken).expect(HttpStatus.OK);
        expect(userSetting).toBeInstanceOf(Object);
        expect(userSetting.settings).toStrictEqual({});

        // update new setting to user
        const fakeSettings = this.factory.fakeUserSettings();
        await this.put(`user-settings`, {settings: fakeSettings}, jwtToken.accessToken).expect(HttpStatus.OK);

        // get updated user settings
        const {body: updatedSetting} = await this.get(`user-settings`, jwtToken.accessToken).expect(HttpStatus.OK);
        expect(updatedSetting).toBeInstanceOf(Object);
        expect(updatedSetting.settings).toStrictEqual(fakeSettings);
    }

    // @Test()
    // async createAndGetPasUser(): Promise<void> {
    //     // do login
    //     const fakeUser = await this.factory.createUserForLogin({
    //         user: PermissionOptions.READ_UPDATE_DELETE,
    //     });
    //     const response = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
    //     const jwtToken: TokenInterface = response.body;
    //     expect(jwtToken.accessToken).toBeDefined();
    //     expect(jwtToken.refreshToken).toBeDefined();
    //
    //     // shoud fail creating PAS user without all requried fields
    //     const fakePASUser = this.factory.fakeCreatePASUserDTO();
    //     // missing email
    //     await this.post(
    //         `pass-user`,
    //         {password: fakePASUser.password, firstName: fakePASUser.firstName, lastName: fakePASUser.lastName},
    //         jwtToken.accessToken
    //     ).expect(HttpStatus.BAD_REQUEST);
    //
    //     // missing password
    //     await this.post(
    //         `pass-user`,
    //         {email: fakePASUser.email, firstName: fakePASUser.firstName, lastName: fakePASUser.lastName},
    //         jwtToken.accessToken
    //     ).expect(HttpStatus.BAD_REQUEST);
    //
    //     // missing firstName
    //     await this.post(
    //         `pass-user`,
    //         {email: fakePASUser.email, password: fakePASUser.password, lastName: fakePASUser.lastName},
    //         jwtToken.accessToken
    //     ).expect(HttpStatus.BAD_REQUEST);
    //
    //     // missing lastName
    //     await this.post(
    //         `pass-user`,
    //         {email: fakePASUser.email, password: fakePASUser.password, firstName: fakePASUser.firstName},
    //         jwtToken.accessToken
    //     ).expect(HttpStatus.BAD_REQUEST);
    //
    //     // create a PAS user
    //     await this.post(`pass-user`, fakePASUser, jwtToken.accessToken).expect(HttpStatus.CREATED);
    //
    //     // find the created PAS user
    //     await this.get(`invalid-id`, jwtToken.accessToken).expect(HttpStatus.INTERNAL_SERVER_ERROR);
    //     await this.get(`invalid-id`).expect(HttpStatus.UNAUTHORIZED);
    //
    //     const {body: allUsers} = await this.get(`filters`, jwtToken.accessToken).expect(HttpStatus.OK);
    //     const foundCreatedUser = allUsers.find((el) => el.email === fakePASUser.email);
    //
    //     const {body: result} = await this.get(`${foundCreatedUser.id}`, jwtToken.accessToken).expect(HttpStatus.OK);
    //     expect(result).toEqual(
    //         expect.objectContaining({
    //             email: fakePASUser.email,
    //             firstName: fakePASUser.firstName,
    //             lastName: fakePASUser.lastName,
    //         })
    //     );
    // }
    //
    // @Test()
    // async updateUserById(): Promise<void> {
    //     // do login
    //     const fakeUser = await this.factory.createUserForLogin({
    //         user: PermissionOptions.CREATE_READ_UPDATE_DELETE,
    //     });
    //     const response = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
    //     const jwtToken: TokenInterface = response.body;
    //     expect(jwtToken.accessToken).toBeDefined();
    //     expect(jwtToken.refreshToken).toBeDefined();
    //
    //     // create a PAS user
    //     const fakePASUser = this.factory.fakeCreatePASUserDTO();
    //     await this.post(`pass-user`, fakePASUser, jwtToken.accessToken).expect(HttpStatus.CREATED);
    //
    //     //update should fail
    //     const invalidUserId = this.factory.fakeUserId();
    //     await this.patch(`pass-user/${invalidUserId}`, {}).expect(HttpStatus.UNAUTHORIZED);
    //     await this.patch(`pass-user/${invalidUserId}`, {}, jwtToken.accessToken).expect(HttpStatus.BAD_REQUEST);
    //
    //     // find the update the created PAS user
    //     const {body: allUsers} = await this.get(`filters`, jwtToken.accessToken).expect(HttpStatus.OK);
    //     const foundCreatedUser = allUsers.find((el) => el.email === fakeUser.email);
    //     this.logger.log(foundCreatedUser);
    //
    //     // TODO : The following part will alawys fail when trying to update user at the pas-api.plexxislabs.com
    //
    //     // await this.patch(`pass-user/${foundCreatedUser.id}`, {color: 'red'}, jwtToken.accessToken).expect(HttpStatus.OK);
    //
    //     // const {body: result} = await this.get(`${foundCreatedUser.id}`, jwtToken.accessToken).expect(HttpStatus.OK);
    //     // expect(result).toEqual(
    //     //     expect.objectContaining({
    //     //         email: foundCreatedUser.email,
    //     //         firstName: foundCreatedUser.firstName,
    //     //         lastName: foundCreatedUser.lastName,
    //     //         color: 'red',
    //     //     })
    //     // );
    // }
}
