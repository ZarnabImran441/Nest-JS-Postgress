import {faker} from '@faker-js/faker';
import {ABSTRACT_AUTHORIZATION_SERVICE, GenericUserLoginDto, makeid} from '@lib/base-library';
import {Inject, Injectable} from '@nestjs/common';
import {BaseFactory, FakePasAuthenticationService} from '@test-lib/test-base-library';
import {CreatePasUserDto} from '../../src/dto/user/create-user-dto';
import {RoleEntity} from '../../src/model/role.entity';
import {UserEntity} from '../../src/model/user.entity';
import {AuthorizationImplService} from '../../src/module/authorization-impl/authorization-impl.service';
import {EntityTypeOptions, PermissionOptions} from '../../src/module/authorization-impl/authorization.enum';
import {PAS_USER_SYNC_EMAIL, PAS_USER_SYNC_PASSWORD} from '../../src/const/env.const';

export type PermissionsType = Partial<Record<EntityTypeOptions, PermissionOptions>>;

@Injectable()
export class UserFactory extends BaseFactory<UserEntity> {
    public static DEFAULT_PASSWORD = '12345678';

    constructor(
        @Inject(ABSTRACT_AUTHORIZATION_SERVICE) protected readonly authorizationService: AuthorizationImplService,
        @Inject('PAS_AUTHENTICATION_SERVICE') private readonly fakePasAuthenticationService: FakePasAuthenticationService
    ) {
        super(UserEntity);
    }

    fakeUserId(): string {
        return faker.string.uuid();
    }

    fakeCreatePASUserDTO(): CreatePasUserDto {
        return {
            password: faker.string.alphanumeric({length: {min: 10, max: 20}}),
            firstName: faker.person.firstName(),
            lastName: faker.person.lastName(),
            email: faker.internet.email(),
        };
    }

    fakeUserSettings(): {[string: string]: boolean} {
        return {
            [faker.string.fromCharacters('settings', {min: 5, max: 10})]: faker.datatype.boolean(),
        };
    }

    static fakeUserId(): string {
        return faker.string.uuid();
    }

    fakeRole(): RoleEntity {
        const r = new RoleEntity();
        r.code = makeid(8);
        r.description = faker.string.uuid();
        return r;
    }

    async createRole(role: RoleEntity): Promise<RoleEntity> {
        const repo = this.dataSource.getRepository<RoleEntity>(RoleEntity);
        return await repo.save(role);
    }

    async createUserForLogin(permissions: PermissionsType, password: string = UserFactory.DEFAULT_PASSWORD): Promise<GenericUserLoginDto> {
        const fakeUser = this.createPasUser(password);
        // const fakeUser = this.fakeUser(password);
        const userDB = await this.repository.save(fakeUser);
        await this.authorizationService.grantToUser(
            PermissionOptions.LOGIN | PermissionOptions.READ,
            EntityTypeOptions.User,
            userDB.id,
            null
        );
        for (const key of Object.keys(permissions)) {
            await this.authorizationService.grantToUser(permissions[key], key as EntityTypeOptions, userDB.id, null);
        }
        return {
            email: userDB.email,
            password: password,
        };
    }

    async createUser(password: string = UserFactory.DEFAULT_PASSWORD): Promise<UserEntity> {
        const fakeUser = this.createPasUser(password),
            userDB = await this.repository.save(fakeUser);
        await this.authorizationService.grantToUser(
            PermissionOptions.LOGIN | PermissionOptions.READ,
            EntityTypeOptions.User,
            userDB.id,
            null
        );
        return userDB;
    }

    createPasUser(password: string): UserEntity {
        return this.fakePasAuthenticationService.createPasUser(password) as UserEntity;
    }

    getPasServiceUserLoginDto(): GenericUserLoginDto {
        return {
            email: PAS_USER_SYNC_EMAIL,
            password: PAS_USER_SYNC_PASSWORD,
        };
    }
}
