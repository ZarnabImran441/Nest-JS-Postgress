import {
    BannedPermissionDto,
    BasePermissionDto,
    ChildrenPermissionDto,
    PermissionDto,
    PermissionGroupDto,
    PermissionOptionsDto,
    PermissionStatusOptions,
    PermissionTypeOptions,
    SchemaPermissionDto,
    SectionTypeOptions,
    SetPermisisonsGroupsDto,
    TokenInterface,
} from '@lib/base-library';
import {HttpStatus, Inject, Logger, OnModuleInit} from '@nestjs/common';
import {Test, TestSuite} from 'nestjs-jest-decorators';
import {PermissionGroupEntity} from '../../src/model/permissions-group.entity';
import {EntityTypeOptions, PermissionOptions} from '../../src/module/authorization-impl/authorization.enum';
import {PermissionManagerFactory} from '../factory/permission-manager.factory';
import {PermissionsType, UserFactory} from '../factory/user.factory';
import {NewBaseTest} from './base-test';

@TestSuite('Permission Manager Suite')
export class PermissionManagerE2eSpec extends NewBaseTest implements OnModuleInit {
    private readonly logger = new Logger(PermissionManagerE2eSpec.name);
    @Inject()
    private userFactory: UserFactory;

    private factory: PermissionManagerFactory = new PermissionManagerFactory();

    onModuleInit(): void {
        this.setUrl('/permission-manager');
    }

    @Test(`Gets Permission Schema`)
    async getSchema(): Promise<void> {
        const jwtToken = await this.createJwtToken();

        const {body: schemas}: {body: SchemaPermissionDto[]} = await this.get(`schema`, jwtToken.accessToken).expect(HttpStatus.OK);
        expect(Array.isArray(schemas)).toBe(true);

        for (const schema of schemas) {
            this.testSchemaPermissionDto(schema);
        }
    }

    @Test(`Gets Active User's Permissions`)
    async getActiveUserPermission(): Promise<void> {
        // sample permission entity types
        const entityTypes: EntityTypeOptions[] = [
            EntityTypeOptions.PermissionManager,
            EntityTypeOptions.Folder,
            EntityTypeOptions.Space,
            EntityTypeOptions.Workflow,
        ];

        const userPermissions = entityTypes.reduce<PermissionsType>(
            (result, permissionType) => ({
                ...result,
                [permissionType]: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            }),
            {}
        );

        const jwtToken = await this.createJwtToken(userPermissions);
        const {body: permissions}: {body: PermissionDto[]} = await this.get(`permission`, jwtToken.accessToken).expect(HttpStatus.OK);

        expect(Array.isArray(permissions)).toBe(true);

        for (const permission of permissions) {
            this.testPermission(permission);
        }
    }

    @Test(`Gets Permissions by User Id`)
    async getPermissionByUserId(): Promise<void> {
        const jwtToken = await this.setPermissionByUserId();

        const {body: permissions}: {body: PermissionDto[]} = await this.get(`permission/${jwtToken.id}`, jwtToken.accessToken).expect(
            HttpStatus.OK
        );
        expect(Array.isArray(permissions)).toBe(true);

        for (const permission of permissions) {
            this.testPermission(permission);
        }
    }

    @Test(`Creates Permissions by User Id`)
    async setPermissionByUserId(): Promise<TokenInterface> {
        const jwtToken = await this.createJwtToken();

        const fakeData = this.factory.fakeCreatePermissions();
        await this.post(`permission/${jwtToken.id}`, fakeData, jwtToken.accessToken).expect(HttpStatus.CREATED);

        return jwtToken;
    }

    @Test(`Gets Permission Group`)
    async getPermissionGroup(): Promise<void> {
        const jwtToken = await this.setPermissionGroup();

        const permissionGroups = await this.fetchPermissionGroups(jwtToken);
        expect(Array.isArray(permissionGroups)).toBe(true);

        for (const group of permissionGroups) {
            this.testPermissionGroup(group);
        }
    }

    @Test(`Gets Permission Group by Id`)
    async getPermissionGroupById(): Promise<void> {
        const jwtToken = await this.setPermissionGroup();

        // grab the first permission group to test
        const [group] = await this.fetchPermissionGroups(jwtToken);

        const {body: permissionGroup}: {body: (PermissionGroupDto & Pick<PermissionGroupEntity, 'id'>)[]} = await this.get(
            `permission-group/${group.id}`,
            jwtToken.accessToken
        ).expect(HttpStatus.OK);

        expect(permissionGroup).toBeDefined();
        this.testPermissionGroup(group);
    }

    @Test(`Gets Permission Group by User Id`)
    async getPermissionGroupByUserId(): Promise<void> {
        const jwtToken = await this.setPermissionGroup();

        const {body: permissionGroupIds}: {body: number[]} = await this.get(
            `permission-group/user/${jwtToken.id}`,
            jwtToken.accessToken
        ).expect(HttpStatus.OK);

        expect(permissionGroupIds).toBeDefined();
        expect(Array.isArray(permissionGroupIds)).toBe(true);
        expect((permissionGroupIds as number[]).every((id) => typeof id === 'number')).toBe(true);
    }

    @Test(`Creates Permission Group`)
    async setPermissionGroup(): Promise<TokenInterface> {
        const jwtToken = await this.createJwtToken();

        const data = this.factory.fakeCreatePermissionGroup('Test Permission Group');
        await this.post(`permission-group`, data, jwtToken.accessToken).expect(HttpStatus.CREATED);

        return jwtToken;
    }

    @Test(`Creates Permission Group by User Id`)
    async setPermissionGroupByUserId(): Promise<TokenInterface> {
        const jwtToken = await this.setPermissionGroup();

        const permissionGroups = await this.fetchPermissionGroups(jwtToken);
        const data: SetPermisisonsGroupsDto = {
            insert: permissionGroups.map(({id}) => id),
        };

        await this.post(`permission-group/user/${jwtToken.id}`, data, jwtToken.accessToken).expect(HttpStatus.CREATED);

        return jwtToken;
    }

    @Test(`Updates Permission Group by Id`)
    async updatePermissionGroup(): Promise<void> {
        const jwtToken = await this.setPermissionGroup();
        const [{id: groupId, ...group}] = await this.fetchPermissionGroups(jwtToken);

        const groupTitle = 'Updated Permission Group';
        const permissionTitle = 'Updated Permission';
        const permissionChildTitle = 'Updated Permission Child';

        const updateDto: PermissionGroupDto = {
            ...group,
            title: groupTitle,
            permissions: group.permissions.map((permission) => ({
                ...permission,
                title: permissionTitle,
                children: permission.children?.map((child) => ({
                    ...child,
                    banned: true,
                    title: permissionChildTitle,
                })),
            })),
        };

        await this.put(`permission-group/${groupId}`, updateDto, jwtToken.accessToken).expect(HttpStatus.OK);

        const groups = await this.fetchPermissionGroups(jwtToken);
        const updatedGroup = groups.find(({id}) => id === groupId);

        expect(updatedGroup).toBeDefined();
        expect(updatedGroup.title).toBe(groupTitle);
        expect(updatedGroup.permissions.length).toBeGreaterThan(0);
        expect(updatedGroup.permissions.every(({title}) => title === permissionTitle)).toBe(true);
        expect(updatedGroup.permissions.at(0)).toBeDefined();
        expect(updatedGroup.permissions.at(0)?.children).toBeDefined();
        expect(updatedGroup.permissions.at(0)?.children.every(({banned, title}) => banned && title === permissionChildTitle)).toBe(true);
    }

    @Test(`Deletes a Permission Group by Id`)
    async deletePermissionGroup(): Promise<void> {
        const jwtToken = await this.setPermissionGroup();
        const [group] = await this.fetchPermissionGroups(jwtToken);
        await this.delete(`permission-group/${group.id}`, jwtToken.accessToken).expect(HttpStatus.OK);
    }

    @Test(`Deletes a Permission Group by Id and User Id`)
    async deletePermissionGroupByUserId(): Promise<void> {
        const jwtToken = await this.setPermissionGroupByUserId();
        // delete the first group
        const [group] = await this.fetchPermissionGroups(jwtToken);
        await this.delete(`permission-group/${group.id}/user/${jwtToken.id}`, jwtToken.accessToken).expect(HttpStatus.OK);
    }

    @Test(`Gets Banned Permissions by User Id`)
    async getBannedPermission(): Promise<void> {
        const jwtToken = await this.setBannedPermissionByUserId();

        const {body: bannedPermissions}: {body: BannedPermissionDto[]} = await this.get(
            `banned-permission/${jwtToken.id}`,
            jwtToken.accessToken
        );

        for (const bannedPermission of bannedPermissions) {
            this.testPermission(bannedPermission, true);
        }
    }

    @Test(`Creates Banned Permissions by User Id`)
    async setBannedPermissionByUserId(): Promise<TokenInterface> {
        // sample permission entity types
        const entityTypes: EntityTypeOptions[] = [
            EntityTypeOptions.PermissionManager,
            EntityTypeOptions.Folder,
            EntityTypeOptions.Space,
            EntityTypeOptions.Workflow,
        ];

        const userPermissions = entityTypes.reduce<PermissionsType>(
            (result, permissionType) => ({
                ...result,
                [permissionType]: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            }),
            {}
        );

        const jwtToken = await this.createJwtToken(userPermissions);

        const fakeData = this.factory.fakeCreateBannedPermissions(entityTypes);
        await this.post(`banned-permission/${jwtToken.id}`, fakeData, jwtToken.accessToken).expect(HttpStatus.CREATED);

        return jwtToken;
    }

    /* ~~~ HELPERS ~~~ */

    /**
     * Creates a user with specified permissions and returns the jwt token.
     * If not provided, "permission-manager" permission defaults to CREATE READ UPDATE DELETE
     */
    private async createJwtToken(
        permissions: PermissionsType = {
            'permission-manager': PermissionOptions.CREATE_READ_UPDATE_DELETE,
        }
    ): Promise<TokenInterface> {
        this.logger.log(`Create user`);
        const fakeUser = await this.userFactory.createUserForLogin(permissions);
        const {body: jwtToken} = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        return jwtToken;
    }

    /**
     * Retrieves permission groups
     */
    private async fetchPermissionGroups<T extends PermissionGroupDto & Pick<PermissionGroupEntity, 'id'>>(
        jwtToken: TokenInterface
    ): Promise<T[]> {
        const {body: permissionGroups}: {body: T[]} = await this.get(`permission-group`, jwtToken.accessToken).expect(HttpStatus.OK);
        expect(permissionGroups).toBeDefined();

        return permissionGroups;
    }

    /* ~~~ TEST HELPERS ~~~ */

    /**
     * Tests the provided base permission
     *
     * @param permission - The Permission base object to be tested
     */
    private testBasePermission<T extends BasePermissionDto<T>>(permission: T): void {
        expect(permission.id).toBeDefined();
        expect(permission.id.length).toBeGreaterThan(0);
        expect(permission.sectionType).toBeDefined();
        expect(Object.values(SectionTypeOptions)).toContain(permission.sectionType);
    }

    /**
     * Tests the provided schema permission
     *
     * @param {SchemaPermissionDto} schema - The Schema Permission to be tested
     */
    private testSchemaPermissionDto(schema: SchemaPermissionDto): void {
        this.testBasePermission(schema);

        expect(schema.title).toBeDefined();
        expect(schema.title.length).toBeGreaterThan(0);
        expect(schema.title.length).not.toBeGreaterThan(128);

        if (schema.description != null) {
            expect(schema.description.length).toBeGreaterThan(0);
            expect(schema.description.length).not.toBeGreaterThan(512);
        }

        this.testPermissionType(schema.type);
        this.testPermissionStatus(schema.permissionStatus);
        this.testPermissionOptions(schema.options);

        if (schema.children != null) {
            expect(Array.isArray(schema.children)).toBe(true);
            for (const child of schema.children) {
                this.testSchemaPermissionDto(child);
            }
        }
    }

    /**
     * Tests the provided permission
     *
     * @param {PermissionDto} permission - The Permission to be tested
     */
    private testPermission(permission: PermissionDto, banned = false): void {
        this.testBasePermission(permission);

        if (permission.title != null) {
            expect(permission.title.length).toBeGreaterThan(0);
        }

        if (permission.children != null) {
            expect(Array.isArray(permission.children)).toBe(true);

            for (const child of permission.children) {
                this.testChildPermission(child, banned);
            }
        }
    }

    /**
     * Tests the provided child permission
     *
     * @param {ChildrenPermissionDto} childPermission - The child Permission to be tested
     */
    private testChildPermission(childPermission: ChildrenPermissionDto, banned = false): void {
        expect(childPermission.banned).toBeDefined();
        expect(typeof childPermission.banned).toBe('boolean');

        if (childPermission.assigned != null) {
            expect(typeof childPermission.assigned).toBe('boolean');
        }

        if (banned) {
            expect(childPermission.banned).toBe(true);
        }

        this.testPermissionStatus(childPermission.permissionStatus);
        this.testPermissionOptions(childPermission.options);

        // testing permission dto inside child permission dto
        // because child permission dto extends PermissionDto
        this.testPermission(childPermission);
    }

    /**
     * Tests the provided permission status
     *
     * @param {PermissionStatusOptions} permissionStatus - The Permission Status to be tested
     */
    private testPermissionStatus(permissionStatus?: PermissionStatusOptions): void {
        if (permissionStatus != null) {
            expect(Object.values(PermissionStatusOptions)).toContain(permissionStatus);
        }
    }

    /**
     * Tests the provided permission type
     *
     * @param {PermissionTypeOptions} permissionType - The Permission Type to be tested
     */
    private testPermissionType(permissionType?: PermissionTypeOptions): void {
        if (permissionType != null) {
            expect(Object.values(PermissionTypeOptions)).toContain(permissionType);
        }
    }

    /**
     * Tests the provided permission options
     *
     * @param {PermissionOptionsDto[]} options - The Permission Option array to be tested
     */
    private testPermissionOptions(options?: PermissionOptionsDto[]): void {
        if (options != null) {
            expect(Array.isArray(options)).toBe(true);
            for (const option of options) {
                expect(option.value).toBeDefined();
                expect(option.value.length).toBeGreaterThan(0);
                expect(option.value.length).not.toBeGreaterThan(128);

                expect(option.label).toBeDefined();
                expect(option.label.length).toBeGreaterThan(0);
                expect(option.label.length).not.toBeGreaterThan(512);
            }
        }
    }

    /**
     * Tests the provided permission group
     *
     * @param {PermissionGroupDto} permissionGroup - The Permission to be tested
     */
    private testPermissionGroup<T extends PermissionGroupDto>(permissionGroup: T): void {
        expect(permissionGroup.title).toBeDefined();
        expect(permissionGroup.title.length).toBeGreaterThan(0);
        expect(permissionGroup.title.length).not.toBeGreaterThan(300);

        expect(permissionGroup.permissions).toBeDefined();
        expect(Array.isArray(permissionGroup.permissions)).toBe(true);

        for (const permission of permissionGroup.permissions) {
            this.testPermission(permission);
        }

        if (permissionGroup.description != null) {
            expect(permissionGroup.description.length).toBeGreaterThan(0);
            expect(permissionGroup.description.length).not.toBeGreaterThan(256);
        }
    }
}
