import {HttpStatus, Inject, Logger, OnModuleInit} from '@nestjs/common';
import {Test, TestSuite} from 'nestjs-jest-decorators';
import {
    CustomFieldDefinitionTypeOptions,
    PeopleSettingsSelectionTypeOptions,
    PeopleSettingsViewTypeOptions,
} from '../../src/enum/custom-field-definition.enum';
import {PermissionOptions} from '../../src/module/authorization-impl/authorization.enum';
import {CustomFieldFactory} from '../factory/custom-field.factory';
import {UserFactory} from '../factory/user.factory';
import {NewBaseTest} from './base-test';

@TestSuite('Custom Fields Definition Suite')
export class CustomFieldDefinitionE2eSpec extends NewBaseTest implements OnModuleInit {
    private readonly logger = new Logger(CustomFieldDefinitionE2eSpec.name);

    @Inject()
    private userFactory: UserFactory;
    private customFieldDefinitionFactory = new CustomFieldFactory();

    onModuleInit(): void {
        this.setUrl('/custom-field-definition');
    }

    /*
    constructor() {
        super(
            {
                url: '/custom-field-definition',
                databaseConfig: DatabaseConfig,
                schema: RawDatabaseConfig.schema,
                pasAuthenticationConfig: PasAuthenticationConfig,
                imports: [
                    RedisCacheModule.register(CacheConfig),
                    EventEmitterModule.forRoot(EventEmitterConfig),
                    NotificationApiConnectorModule.register(NotificationApiConnectorConfig),
                    NotificationsSubscriptionModule.register(testNotificationsServiceConfig),
                    S3Module.register(S3Config),
                    AuthorizationModule.register(AuthorizationConfig),
                    UserModule,
                    WorkFlowModule,
                    TreeViewModule,
                    CustomFieldValueModule,
                    TaskModule,
                    FolderModule,
                    AutomationsCrudModule.register(AutomationsConfig),
                ],
            },
            'CustomFieldDefinitionE2eSpec'
        );
    }

    get userFactory(): UserFactory {
        if (!this._userFactory) {
            this._userFactory = new UserFactory(
                this.dataSource,
                this.getService<AuthorizationImplService>(ABSTRACT_AUTHORIZATION_SERVICE),
                this.app,
                this.getService<FakePasAuthenticationService>('PAS_AUTHENTICATION_SERVICE')
            );
        }
        return this._userFactory;
    }

    get workflowFactory(): WorkflowFactory {
        if (!this._workflowFactory) {
            this._workflowFactory = new WorkflowFactory();
        }
        return this._workflowFactory;
    }
        */

    // TODO : Create Test Cases for user custom fields
    /**
     * Create a CustomFieldValue
     */
    @Test('Create CustomFieldValue')
    async createCustomFieldValue(): Promise<void> {
        const fakeUser = await this.userFactory.createUserForLogin({
            commonCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            userCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            CustomFieldsValue: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        const {body: jwtToken} = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);

        // const workflowDto = this.workflowFactory.fakeCreateWorkflow();
        // const {body: workflow} = await this.post('/workflow', workflowDto, jwtToken.accessToken);
        // const {body: workflowResponseDto} = await this.get(`/workflow/${workflow.id}`, jwtToken.accessToken);
        // this.workflowFactory.fakeChangeWorkflowDto(workflow, workflowResponseDto.states);
        const customFieldDefinitionDto = this.customFieldDefinitionFactory.fakeCreateCustomFieldDefinition();
        await this.post('', customFieldDefinitionDto, jwtToken.accessToken);
        await this.get('', jwtToken.accessToken);
        //todo : fix this part
        // const customFieldValueDto = this.customFieldDefinitionFactory.fakeCreateCustomValue();
        // const {body: customFieldValue1} = await this.post(`/custom-field-value`, customFieldValueDto, jwtToken.accessToken);
        // expect(customFieldValue1).toBeDefined();
        // expect(customFieldValue1.identifiers[0].id).toBeGreaterThan(0);
        // const customFieldValue2 = await this.get(`/custom-field-value/${customFieldValue1.identifiers[0].id}`, jwtToken.accessToken);
        // expect(customFieldValue2).toBeDefined();
    }

    /**
     * Update CustomFieldDefinition
     */
    @Test('Update CustomFieldDefinition')
    async updateCustomField(): Promise<void> {
        this.logger.log(`Create user`);
        const fakeUser = await this.userFactory.createUserForLogin({
            commonCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            userCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        const {body: jwtToken} = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);

        const customFieldDefinitionOptions = this.customFieldDefinitionFactory.fakeCreateCustomFieldDefinitionOptions();
        const customFieldDefinitionDto = this.customFieldDefinitionFactory.fakeCreateCustomFieldDefinition(customFieldDefinitionOptions);
        const {body: customFieldDefinition1} = await this.post(``, customFieldDefinitionDto, jwtToken.accessToken);
        expect(customFieldDefinition1).toBeDefined();
        expect(customFieldDefinition1.identifiers[0].id).toBeGreaterThan(0);
        const updateCustomFieldDefinitionOptions = this.customFieldDefinitionFactory.fakeCreateCustomFieldDefinitionOptions();
        const updateCustomFieldDto = this.customFieldDefinitionFactory.fakeUpdateCustomFieldDefinitionWithModifications();
        await this.patch(
            `${customFieldDefinition1.identifiers[0].id}`,
            {...updateCustomFieldDto, setting: {options: updateCustomFieldDefinitionOptions}},
            jwtToken.accessToken
        );
        const {body: customFieldDefinitionResponse} = await this.get(``, jwtToken.accessToken);
        const customFieldDefinition2 = customFieldDefinitionResponse.filter((el) => el.id === customFieldDefinition1.identifiers[0].id);
        expect(customFieldDefinition2[0]).toBeDefined();
        this.logger.log('customFieldDefinition2customFieldDefinition2', customFieldDefinition2);
        expect(customFieldDefinition2[0].setting.options).toEqual(updateCustomFieldDefinitionOptions);
    }

    /**
     * Update CustomFieldDefinition with an invalid id - It must fail.
     */
    @Test('Update CustomFieldDefinition with invalid id')
    async updateCustomFieldInvalidMustFail(): Promise<void> {
        const fakeUser = await this.userFactory.createUserForLogin({
            commonCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            userCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        const {body: jwtToken} = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        const updateCustomFieldDto = this.customFieldDefinitionFactory.fakeUpdateCustomFieldDefinitionWithModifications();
        const {body: res} = await this.patch(`${-1}`, updateCustomFieldDto, jwtToken.accessToken);
        expect(res.affected).toBe(0);
    }

    /**
     * Create a CustomFieldDefinition
     */
    @Test('Create CustomFieldDefinition')
    async createCustomFieldDefinition(): Promise<void> {
        const fakeUser = await this.userFactory.createUserForLogin({
            commonCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            userCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        const {body: jwtToken} = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        const customFieldDefinitionOptions = this.customFieldDefinitionFactory.fakeCreateCustomFieldDefinitionOptions();
        const customFieldDefinitionDto = this.customFieldDefinitionFactory.fakeCreateCustomFieldDefinition(customFieldDefinitionOptions);
        const {body: customFieldDefinition1} = await this.post('', customFieldDefinitionDto, jwtToken.accessToken);
        expect(customFieldDefinition1).toBeDefined();
        expect(customFieldDefinition1.identifiers[0].id).toBeGreaterThan(0);
        const {body: customFieldDefinitionResponse} = await this.get(``, jwtToken.accessToken);
        const customFieldDefinition2 = customFieldDefinitionResponse.filter((el) => el.id === customFieldDefinition1.identifiers[0].id);
        expect(customFieldDefinition2[0]).toBeDefined();
        expect(customFieldDefinition2[0].setting.options).toEqual(customFieldDefinitionOptions);
    }

    /**
     * Convert CustomFieldDefinition
     */
    @Test('Convert CustomFieldDefinition')
    async convertCustomFieldDefinition(): Promise<void> {
        const fakeUser = await this.userFactory.createUserForLogin({
            commonCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            userCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        const {body: jwtToken} = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);

        const customFieldDefinitionDto = this.customFieldDefinitionFactory.fakeCreateCustomFieldDefinition();
        const {body: customFieldDefinition1} = await this.post(``, customFieldDefinitionDto, jwtToken.accessToken);
        await this.patch(`convert-per-user/${customFieldDefinition1.identifiers[0].id}`, jwtToken.accessToken);
    }

    /**
     * Convert CustomFieldDefinition with invalid id must fail
     */
    @Test('Convert CustomFieldDefinition with invalid id must fail')
    async convertCustomFieldInvalidIdMustFail(): Promise<void> {
        const fakeUser = await this.userFactory.createUserForLogin({
            commonCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            userCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        const {body: jwtToken} = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        const customFieldDefinitionDto = this.customFieldDefinitionFactory.fakeCreateCustomFieldDefinition();
        await this.post(``, customFieldDefinitionDto, jwtToken.accessToken);
        const {body: res} = await this.patch(`convert-per-user/${-1}`, {}, jwtToken.accessToken);
        expect(res.affected).toBe(0);
    }

    /**
     * Convert CustomFieldDefinition with invalid user must fail
     */
    @Test('Convert CustomFieldDefinition with invalid user must fail')
    async convertCustomFieldInvalidUserMustFail(): Promise<void> {
        const fakeUser = await this.userFactory.createUserForLogin({
            commonCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            userCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        const {body: jwtToken} = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        const customFieldDefinitionDto = this.customFieldDefinitionFactory.fakeCreateCustomFieldDefinition();
        await this.post(``, customFieldDefinitionDto, jwtToken.accessToken);

        const {body: res} = await this.patch(`convert-per-user/${-1}`, {}, jwtToken.accessToken);
        expect(res.affected).toBe(0);
    }

    /**
     * Convert CustomFieldDefinition with different must fail
     */
    @Test('Convert CustomFieldDefinition with different user must fail')
    async convertCustomFieldDifferentUser(): Promise<void> {
        const fakeUser = await this.userFactory.createUserForLogin({
            commonCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            userCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        const {body: jwtToken} = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        const customFieldDefinitionDto = this.customFieldDefinitionFactory.fakeCreateCustomFieldDefinition();
        const {body: customFieldDefinition1} = await this.post(``, customFieldDefinitionDto, jwtToken.accessToken);
        await this.patch(`convert-common/${customFieldDefinition1.identifiers[0].id}`, {}, jwtToken.accessToken).expect(
            HttpStatus.NOT_FOUND
        );
    }

    /**
     * Create a CustomFieldDefinition with an empty Dto. It must fail.
     */
    @Test('Create CustomFieldDefinition with empty Dto must fail')
    async createCustomFieldDefinitionMustFail(): Promise<void> {
        const customFieldDefinitionDto = null;
        const fakeUser = await this.userFactory.createUserForLogin({
            commonCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            userCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        const {body: jwtToken} = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        const {body: error} = await this.post(``, customFieldDefinitionDto, jwtToken.accessToken).expect(HttpStatus.BAD_REQUEST);
        expect(error.message.length).toBe(4);
        expect(error.message[0].property).toBe('title');
        expect(error.message[1].property).toBe('type');
        expect(error.message[2].property).toBe('inheritanceType');
        expect(error.message[3].property).toBe('active');
    }

    /**
     * Get One CustomFieldDefinition
     */
    @Test('Get One CustomFieldDefinition')
    async getOne(): Promise<void> {
        const fakeUser = await this.userFactory.createUserForLogin({
            commonCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            userCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        const {body: jwtToken} = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        const customFieldDefinitionDto = this.customFieldDefinitionFactory.fakeCreateCustomFieldDefinition();
        await this.post(``, customFieldDefinitionDto, jwtToken.accessToken);
        const customFieldDefinition2 = await this.get(``, jwtToken.accessToken);
        expect(customFieldDefinition2).toBeDefined();
    }

    /**
     * Delete a CustomFieldDefinition successfully.
     */
    @Test('Delete CustomFieldDefinition successfully')
    async deleteCustomFieldDefinition(): Promise<void> {
        const customFieldDefinitionDto = this.customFieldDefinitionFactory.fakeCreateCustomFieldDefinition();
        const fakeUser = await this.userFactory.createUserForLogin({
            commonCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            userCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        const {body: jwtToken} = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        const {body: customFieldDefinition} = await this.post(``, customFieldDefinitionDto, jwtToken.accessToken);
        await this.delete(`${customFieldDefinition.identifiers[0].id}`, jwtToken.accessToken);
    }

    /**
     * Delete a CustomFieldDefinition that doesn't exist. It must fail.
     */
    @Test('Delete CustomFieldDefinition that does not exist must fail')
    async deleteCustomFieldDefinitionThatDoesntExistMustFail(): Promise<void> {
        const fakeUser = await this.userFactory.createUserForLogin({
            commonCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            userCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        const {body: jwtToken} = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        const {body: res} = await this.delete(`${-1}`, jwtToken.accessToken);
        expect(res.affected).toBe(0);
    }

    /**
     * Not Found. Ensure requesting an invalid CustomFieldDefinition returns Not Found.
     */
    @Test('Custom field must fail')
    async getCustomFieldMustFail(): Promise<void> {
        const fakeUser = await this.userFactory.createUserForLogin({
            commonCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            userCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        const {body: jwtToken} = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        await this.get("'", jwtToken.accessToken).expect(HttpStatus.NOT_FOUND);
    }

    @Test('createUserCustomFieldDefinition')
    async createUserCustomFieldDefinition(): Promise<void> {
        const fakeUser = await this.userFactory.createUserForLogin({
            commonCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            userCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        const {body: jwtToken} = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        const customFieldDefinitionDto = this.customFieldDefinitionFactory.fakeCreateCustomFieldDefinition();
        const {body: customFieldDefinition1} = await this.post('per-user', customFieldDefinitionDto, jwtToken.accessToken);
        expect(customFieldDefinition1).toBeDefined();
        expect(customFieldDefinition1.identifiers[0].id).toBeGreaterThan(0);
        const {body: response} = await this.get(`per-user?show-inactive=false`, jwtToken.accessToken);

        const customFieldDefinition2 = response.find((el) => el.id == customFieldDefinition1.identifiers[0].id);
        expect(customFieldDefinition2.id).toEqual(customFieldDefinition1.identifiers[0].id);
    }

    @Test('updateUserCustomFieldDefinition')
    async updateUserCustomFieldDefinition(): Promise<void> {
        const fakeUser = await this.userFactory.createUserForLogin({
            commonCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            userCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        const {body: jwtToken} = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);

        const customFieldDefinitionDto = this.customFieldDefinitionFactory.fakeCreateCustomFieldDefinition();
        const {body: customFieldDefinition1} = await this.post(`per-user`, customFieldDefinitionDto, jwtToken.accessToken);
        expect(customFieldDefinition1).toBeDefined();
        expect(customFieldDefinition1.identifiers[0].id).toBeGreaterThan(0);
        const updateCustomFieldDto = this.customFieldDefinitionFactory.fakeUpdateCustomFieldDefinitionWithModifications();
        const {body: response} = await this.patch(
            `per-user/${customFieldDefinition1.identifiers[0].id}`,
            updateCustomFieldDto,
            jwtToken.accessToken
        );
        expect(response.affected).toEqual(1);
        const {body: customFieldResponse} = await this.get(`per-user?show-inactive=false`, jwtToken.accessToken);
        expect(customFieldResponse[0].title).toEqual(updateCustomFieldDto.title);
    }

    @Test('deleteUserCustomFieldDefinition')
    async deleteUserCustomFieldDefinition(): Promise<void> {
        const fakeUser = await this.userFactory.createUserForLogin({
            commonCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            userCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        const {body: jwtToken} = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        const customFieldDefinitionDto = this.customFieldDefinitionFactory.fakeCreateCustomFieldDefinition();

        const {body: customFieldDefinition} = await this.post(`per-user`, customFieldDefinitionDto, jwtToken.accessToken);
        expect(customFieldDefinition).toBeDefined();
        expect(customFieldDefinition.identifiers[0].id).toBeGreaterThan(0);
        const {body: response} = await this.delete(`per-user/${customFieldDefinition.identifiers[0].id}`, jwtToken.accessToken);
        expect(response.affected).toEqual(1);
        const {body: customFieldResponse} = await this.get(`per-user?show-inactive=false`, jwtToken.accessToken);
        expect(customFieldResponse.length).toBe(0);
    }

    @Test('deleteUserCustomFieldDefinitionMustFail')
    async createCustomFieldDefinitionCurrencySign(): Promise<void> {
        const fakeUser = await this.userFactory.createUserForLogin({
            commonCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            userCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        const {body: jwtToken} = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        const customFieldDefinitionDto = this.customFieldDefinitionFactory.fakeCreateCustomFieldDefinition(
            [],
            CustomFieldDefinitionTypeOptions.CURRENCY
        );
        const {body: customFieldDefinition1} = await this.post('', customFieldDefinitionDto, jwtToken.accessToken);
        expect(customFieldDefinition1).toBeDefined();
        const {body: customFieldDefinitionResponse} = await this.get(``, jwtToken.accessToken);
        const customFieldDefinition2 = customFieldDefinitionResponse.filter((el) => el.id === customFieldDefinition1.identifiers[0].id);
        expect(customFieldDefinition2[0]).toBeDefined();
        expect(customFieldDefinition2[0].setting.currencySign).toEqual('dollar');
    }

    /**
     * Create a CustomFieldDefinition with People Settings
     */
    @Test('Create CustomFieldDefinition with People Settings')
    async createCustomFieldDefinitionWithPeopleSettings(): Promise<void> {
        const fakeUser = await this.userFactory.createUserForLogin({
            commonCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            userCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        const {body: jwtToken} = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        const customFieldDefinitionDto = this.customFieldDefinitionFactory.fakeCreateCustomFieldDefinition(
            [],
            CustomFieldDefinitionTypeOptions.USER
        );
        const {body: customFieldDefinition1} = await this.post('', customFieldDefinitionDto, jwtToken.accessToken);
        expect(customFieldDefinition1).toBeDefined();
        expect(customFieldDefinition1.identifiers[0].id).toBeGreaterThan(0);
        const {body: customFieldDefinitionResponse} = await this.get(``, jwtToken.accessToken);
        const customFieldDefinition2 = customFieldDefinitionResponse.filter((el) => el.id === customFieldDefinition1.identifiers[0].id);
        expect(customFieldDefinition2[0]).toBeDefined();
        expect(customFieldDefinition2[0].setting.peopleSettings).toEqual({
            selection: PeopleSettingsSelectionTypeOptions.MULTIPLE,
            viewType: PeopleSettingsViewTypeOptions.AVATAR_NAME,
        });
    }

    @Test('updateCustomFieldDefinitionWithPeopleSettings')
    async updateCustomFieldDefinitionWithCurrencySign(): Promise<void> {
        const fakeUser = await this.userFactory.createUserForLogin({
            commonCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
            userCustomFieldsDefinition: PermissionOptions.CREATE_READ_UPDATE_DELETE,
        });
        const {body: jwtToken} = await this.post(`/pas-authentication/login`, fakeUser).expect(HttpStatus.CREATED);
        const customFieldDefinitionDto = this.customFieldDefinitionFactory.fakeCreateCustomFieldDefinition(
            [],
            CustomFieldDefinitionTypeOptions.CURRENCY
        );
        const {body: customFieldDefinition1} = await this.post('', customFieldDefinitionDto, jwtToken.accessToken);
        expect(customFieldDefinition1).toBeDefined();
        expect(customFieldDefinition1.identifiers[0].id).toBeGreaterThan(0);
        const {body: customFieldDefinitionResponse} = await this.get(``, jwtToken.accessToken);
        const customFieldDefinition2 = customFieldDefinitionResponse.filter((el) => el.id === customFieldDefinition1.identifiers[0].id);
        expect(customFieldDefinition2[0]).toBeDefined();
        const updateCustomFieldDto = this.customFieldDefinitionFactory.fakeUpdateCustomFieldDefinitionWithModifications();
        await this.patch(
            `${customFieldDefinition1.identifiers[0].id}`,
            {...updateCustomFieldDto, setting: {currencySign: 'euro'}},
            jwtToken.accessToken
        );
        const {body: updatedCustomFieldDefinitionResponse} = await this.get(``, jwtToken.accessToken);
        const updatedCustomFieldDefinition2 = updatedCustomFieldDefinitionResponse.filter(
            (el) => el.id === customFieldDefinition1.identifiers[0].id
        );
        expect(updatedCustomFieldDefinition2[0]).toBeDefined();
        expect(customFieldDefinition2[0].id).toEqual(updatedCustomFieldDefinition2[0].id);
        expect(updatedCustomFieldDefinition2[0].setting.currencySign).toBe('euro');
    }
}
