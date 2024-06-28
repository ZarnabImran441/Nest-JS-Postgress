import {Inject, Injectable, Logger, NotFoundException} from '@nestjs/common';
import {
    ABSTRACT_AUTHORIZATION_SERVICE,
    AbstractUserService,
    AuthUserInterface,
    contructorLogger,
    JwtUserInterface,
    PasUserInterface,
    S3Service,
} from '@lib/base-library';
import {Repository, UpdateResult} from 'typeorm';
import {InjectRepository} from '@nestjs/typeorm';
import {
    APPLICATION,
    NOTIFICATION_ENABLED,
    NOTIFICATION_HOST,
    NOTIFICATION_PASSWORD,
    NOTIFICATION_PORT,
    SUPER_USER_ID,
} from '../../const/env.const';
import {UserEntity} from '../../model/user.entity';
import {UpdateUserSettingsDto} from '../../dto/user/update-user-settings.dto';
import {AuthorizationImplService} from '../authorization-impl/authorization-impl.service';
import {UpdatePasUserDto, UpdateUserDto} from '../../dto/user/update-user-dto';
import {UserPermissonsGroupDto} from '../../dto/user/user-filter.dto';
import {UserPermissionsGroupEntity} from '../../model/user-permission-groups.entity';
import {Transactional} from 'typeorm-transactional';
import {HttpService} from '@nestjs/axios';
import {CreatePasUserDto} from '../../dto/user/create-user-dto';
import {ClientProxyFactory, Transport} from '@nestjs/microservices';
import {EventEmitter2} from '@nestjs/event-emitter';
import {UserEventNameOptions} from '../../enum/notification-event.enum';
import {EntityNotificationDto} from '../../dto/events/entity-notification.dto';

@Injectable()
export class UserService implements AbstractUserService<AuthUserInterface> {
    private logger: Logger;

    constructor(
        @Inject(ABSTRACT_AUTHORIZATION_SERVICE) protected readonly authorizationImplService: AuthorizationImplService,
        protected readonly s3Service: S3Service,
        @InjectRepository(UserEntity) protected readonly repoUser: Repository<UserEntity>,
        private readonly httpService: HttpService,
        @Inject(EventEmitter2) protected readonly eventEmitter: EventEmitter2
    ) {
        this.logger = new Logger(this.constructor.name);
        contructorLogger(this);
    }

    @Transactional()
    async createUser(pasUser: PasUserInterface): Promise<AuthUserInterface> {
        try {
            this.logger.debug(`Saving user ${pasUser.email}`);
            //** Find and create */

            const ret = await this.repoUser.save({
                id: pasUser.id,
                email: pasUser.email,
                isActive: pasUser.active,
                firstName: pasUser.firstName,
                lastName: pasUser.lastName,
                pictureUrl: pasUser.profileImage,
                color: pasUser.color,
            });
            await this.authorizationImplService.grantDefaultPermissionsToUser(pasUser.id);

            this.eventEmitter.emit(UserEventNameOptions.USER_CREATE, {
                userId: ret.id,
            } as EntityNotificationDto);

            return ret;
        } catch (error) {
            this.logger.log({level: 'error', message: `There was an error saving user ${pasUser.email}` + error, error});
            throw error;
        }
    }

    // Note: Commented out as this piece of code is no longer in use
    //** Why this now.? We don't need this */
    @Transactional()
    async createPasUser(_dto: CreatePasUserDto): Promise<void> {
        // try {
        //     this.logger.debug(`Create user in PAS`);
        //     const login = {
        //             email: PAS_USER_SYNC_EMAIL,
        //             password: PAS_USER_SYNC_PASSWORD,
        //             clientId: PAS_USER_SYNC_PAS_CLIENT_ID, //af76f6b855fcc5b2740e9bdab3f12365 where julio user is created
        //             grantType: 'password',
        //         },
        //         loginResponse = await fetch(`${PAS_BASE_URL}/auth/token`, {
        //             method: 'POST',
        //             headers: {'Content-Type': 'application/json'},
        //             body: JSON.stringify(login),
        //         });
        //     if (loginResponse.status === HttpStatus.UNAUTHORIZED) {
        //         throw new UnauthorizedException();
        //     }
        //     const token = (await loginResponse.json()) as unknown as TokenInterface;
        //     const userExistsInDB = await this.repoUser.findOne({where: {email: dto.email}});
        //     if (userExistsInDB) {
        //         // this.logger.debug(`User with email : ${dto.email} already exists`);
        //         throw new BadRequestException(`User with email : ${dto.email} already exists`);
        //     }
        //     const user = {
        //         id: faker.string.uuid(),
        //         email: dto.email,
        //         password: dto.password,
        //         firstName: dto.firstName,
        //         lastName: dto.lastName,
        //         companyId: PAS_COMPANY_ID,
        //         type: 'user',
        //         roleId: PAS_ROLE_ID,
        //         profileImage: null,
        //         isActive: dto.isActive,
        //     };
        //     let fileName = null;
        //     if (dto.profileImage) {
        //         const previewUrl = base64Toimage(dto.profileImage);
        //         const imageData = Buffer.from(previewUrl, 'base64');
        //         fileName = `${this.USER}/${user.id}.png`;
        //         await this.s3Service.uploadFile(imageData, fileName);
        //         user.profileImage = fileName;
        //     }
        //     const createUserResponse = await fetch(`${PAS_BASE_URL}/user`, {
        //         method: 'POST',
        //         headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token.accessToken}`},
        //         body: JSON.stringify(user),
        //     });
        //     //** Before creating a new user I need to know if user already exists in db */
        //     const userClient = {clientId: PAS_CLIENT_ID, userId: user.id},
        //         createUserClientResponse = await fetch(`${PAS_BASE_URL}/user-client`, {
        //             method: 'POST',
        //             headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token.accessToken}`},
        //             body: JSON.stringify(userClient),
        //         });
        //     if (createUserClientResponse.status === HttpStatus.CREATED && createUserResponse.status === HttpStatus.CREATED) {
        //         const userData = await createUserResponse.json();
        //         await this.createUser({
        //             id: userData.id,
        //             active: true,
        //             firstName: userData.firstName,
        //             lastName: userData.lastName,
        //             email: userData.email,
        //             profileImage: fileName,
        //             color: dto.color,
        //         });
        //     } else {
        //         const err = {
        //             createUserResponse: await createUserResponse.json(),
        //             createUserClientResponse: await createUserClientResponse.json(),
        //         };
        //         throw err;
        //     }
        //     return;
        // } catch (e) {
        //     this.logger.error(`There was an error saving user in PAS ${dto.email}`, e);
        //     throw e;
        // }
    }

    // Note: Commented out as this piece of code is no longer in use
    @Transactional()
    async updatePasUser(_dto: UpdatePasUserDto, _userId: string): Promise<void> {
        // try {
        //     this.logger.debug(`Update user in PAS`);
        //     const login = {
        //             email: PAS_USER_SYNC_EMAIL,
        //             password: PAS_USER_SYNC_PASSWORD,
        //             clientId: PAS_USER_SYNC_PAS_CLIENT_ID,
        //             grantType: 'password',
        //         },
        //         loginResponse = await fetch(`${PAS_BASE_URL}/auth/token`, {
        //             method: 'POST',
        //             headers: {'Content-Type': 'application/json'},
        //             body: JSON.stringify(login),
        //         });
        //     this.logger.debug(`Login in PAS status : ${loginResponse.status}`);
        //     if (loginResponse.status === HttpStatus.UNAUTHORIZED) {
        //         throw new UnauthorizedException();
        //     }
        //     const token = (await loginResponse.json()) as unknown as TokenInterface;
        //     const userExistsInDB = await this.repoUser.findOne({where: {id: userId}});
        //     if (!userExistsInDB) {
        //         throw new BadRequestException(`User with id : ${userId} not exists`);
        //     }
        //     this.logger.debug(`Update user with id = ${userId} and dto = ${dto}`);
        //     const updateUserResponse = await fetch(`${PAS_BASE_URL}/user/${userId}`, {
        //         method: 'PATCH',
        //         headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token.accessToken}`},
        //         body: JSON.stringify(dto),
        //     });
        //     //** Before creating a new user I need to know if user already exists in db */
        //     if (updateUserResponse.status === HttpStatus.OK) {
        //         //update user in our db also
        //         this.logger.debug(`Update user with id = ${userId} and dto = ${dto} in TM database`);
        //         await this.repoUser.update(userId, dto);
        //     } else {
        //         throw {
        //             updateUserResponse: await updateUserResponse.json(),
        //         };
        //     }
        // } catch (e) {
        //     this.logger.error(`There was an error updating user in PAS ${dto}`, e);
        //     throw e;
        // }
    }

    async checkUserNotificationsAreSet(userId: string): Promise<boolean> {
        if (NOTIFICATION_ENABLED) {
            const user = await this.repoUser.findOne({where: {id: userId}});
            try {
                const client = ClientProxyFactory.create({
                    transport: Transport.REDIS,
                    options: {
                        host: NOTIFICATION_HOST,
                        port: NOTIFICATION_PORT,
                        password: NOTIFICATION_PASSWORD,
                    },
                });
                await client.connect();

                const payload = {
                    appName: APPLICATION,
                    users: [
                        {
                            email: user.email,
                            id: user.id,
                            firstName: user.firstName,
                            lastName: user.lastName,
                        },
                    ],
                };
                client.send('set-subscriptions', payload).subscribe({
                    next: (userSubscriptionResponse) => {
                        this.logger.log('Notifications SET', JSON.stringify(userSubscriptionResponse));
                    },
                    error: (err) => {
                        this.logger.log({level: 'error', message: 'Error setting User Subscriptions (1):' + err, error: err});
                        client.close();
                    },
                    complete: () => {
                        this.logger.log('COMPLETED SETTING USER SUBSCRIPTIONS');
                        client.close();
                    },
                });
                return true;
            } catch (e) {
                this.logger.error(`There was an error sending user ${user.id}, ${user.email} to notification service`, e);
                return false;
            }
        }
    }

    async getUserById(userId: string): Promise<UserEntity> {
        try {
            this.logger.debug('Getting user by id');
            return await this.repoUser.findOne({where: {id: userId}});
        } catch (e) {
            this.logger.error(`There was an error fetching user with ${userId}`, e);
            throw e;
        }
    }

    async getUserByEmail(email: string): Promise<UserEntity> {
        try {
            this.logger.debug('Getting user by email');
            return await this.repoUser.findOne({where: {email}});
        } catch (e) {
            this.logger.error(`There was an error fetching user with ${email}`, e);
            throw e;
        }
    }

    async getProfile(user: JwtUserInterface): Promise<JwtUserInterface> {
        try {
            const found = await this.getUserById(user.id);
            if (!found) {
                throw new NotFoundException();
            }
            found['applicationId'] = APPLICATION;
            found['super_user'] = SUPER_USER_ID === found.id;
            return found as unknown as JwtUserInterface;
        } catch (e) {
            this.logger.error(`There was an error fetching profile ${JSON.stringify(user)}`, e);
            throw e;
        }
    }

    async getFilteredUsers(_query?: object): Promise<UserEntity[]> {
        this.logger.debug('Getting filtered users');
        try {
            return await this.repoUser.find({});
        } catch (e) {
            this.logger.error(`There was an error fetching all the dashboards`, e);
            throw e;
        }
    }

    async getUserSettings(id: string): Promise<UserEntity> {
        this.logger.debug('Getting user settings');
        try {
            return await this.repoUser
                .createQueryBuilder('user')
                .select(['user.settings'])
                .where('user.id = :user_id', {user_id: id})
                .getOne();
        } catch (e) {
            this.logger.error(`There was an error fetching user settings with user id ${id}`, e);
            throw e;
        }
    }

    async updateUserSettings(id: string, updateSettingsDto: UpdateUserSettingsDto): Promise<UpdateResult> {
        this.logger.debug('Updating user settings');
        try {
            const found = await this.repoUser.findOne({where: {id}});
            if (!found) {
                throw new NotFoundException();
            }
            return this.repoUser.update(id, updateSettingsDto);
        } catch (e) {
            this.logger.error(`There was an error updating user settings ${JSON.stringify(updateSettingsDto)}`, e);
            throw e;
        }
    }

    @Transactional()
    async updateUser(userId: string, dto: UpdateUserDto): Promise<UpdateResult> {
        try {
            return await this.repoUser.update(userId, dto);
        } catch (error) {
            this.logger.log({level: 'error', message: `There was an error while updating a user ${JSON.stringify(dto)}` + error, error});
            throw error;
        }
    }

    async getUserAndPermissionGroups(): Promise<UserPermissonsGroupDto[]> {
        try {
            const repoUserPermissionsGroups = this.repoUser.manager.getRepository<UserPermissionsGroupEntity>(UserPermissionsGroupEntity);
            const users = await this.repoUser.find({
                select: {id: true, firstName: true, lastName: true, pictureUrl: true, isActive: true, email: true, color: true},
            });
            const result = [];
            for (const user of users) {
                const groups = await repoUserPermissionsGroups.find({
                    where: {userId: user.id},
                    relations: ['PermissionsGroup'],
                });
                result.push({...user, permissionGroups: groups});
            }
            return result;
        } catch (error) {
            this.logger.log({level: 'error', message: `There was an error while updating a user` + error, error});
            throw error;
        }
    }
}
