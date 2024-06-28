import {Body, Controller, Get, Logger, NotFoundException, Param, Patch, Post, Put, Query, UseGuards} from '@nestjs/common';
import {ApiBearerAuth, ApiBody, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags} from '@nestjs/swagger';
import {
    CheckPolicies,
    contructorLogger,
    JwtAuthGuard,
    JwtUser,
    JwtUserInterface,
    PoliciesGuard,
    ServiceUserCheckPolicies,
} from '@lib/base-library';
import {UserService} from './user.service';
import {UserEntity} from '../../model/user.entity';
import {userPolicies} from '../../policy/policy-consts';
import {UpdateUserSettingsDto} from '../../dto/user/update-user-settings.dto';
import {UserFilterDto, UserPermissonsGroupDto} from '../../dto/user/user-filter.dto';
import {CreatePasUserDto} from '../../dto/user/create-user-dto';
import {UpdatePasUserDto} from '../../dto/user/update-user-dto';
import {HttpService} from '@nestjs/axios';
import {PAS_BASE_URL, PAS_CLIENT_ID, PAS_CLIENT_SECRET} from '../../const/env.const';
import {firstValueFrom} from 'rxjs';
import {GetAuthTokenRequestDto, GetAuthTokenResponseDto} from './dto/get-auth-token.dto';

@Controller('users')
@ApiTags('User')
export class UserController {
    private logger: Logger;

    constructor(private readonly usersService: UserService, private readonly httpService: HttpService) {
        contructorLogger(this);
        this.logger = new Logger(this.constructor.name);
    }

    @Get('profile')
    @ApiBearerAuth()
    @ApiOperation({description: 'Get profile of the logged user.'})
    @ApiOkResponse({description: 'The user profile'})
    @UseGuards(JwtAuthGuard, PoliciesGuard)
    @CheckPolicies(userPolicies.Read())
    async getProfile(@JwtUser() user: JwtUserInterface): Promise<JwtUserInterface> {
        return await this.usersService.getProfile(user);
    }

    //Todo : Test Case
    @Get('permissions-groups')
    @ApiBearerAuth()
    @ApiOperation({description: 'Get users with permissions groups'})
    @UseGuards(JwtAuthGuard, PoliciesGuard)
    @CheckPolicies(userPolicies.Read())
    async getUsersPermissionsGroups(): Promise<UserPermissonsGroupDto[]> {
        return await this.usersService.getUserAndPermissionGroups();
    }

    @Get('filters')
    @UseGuards(JwtAuthGuard, PoliciesGuard)
    @CheckPolicies(userPolicies.Read())
    @ApiOkResponse({isArray: true, type: UserEntity, description: 'An array of User Entity'})
    @ApiNotFoundResponse({type: NotFoundException, description: 'NotFoundException thrown'})
    @ApiBearerAuth()
    @ApiOperation({description: 'Get a list of filtered users.'})
    async getFilteredUsers(@Query() query: UserFilterDto): Promise<UserEntity[]> {
        return await this.usersService.getFilteredUsers(query);
    }

    @Get('/user-settings')
    @UseGuards(JwtAuthGuard, PoliciesGuard)
    @CheckPolicies(userPolicies.Read())
    @ApiBearerAuth()
    @ApiOperation({description: 'get all current user settings'})
    async getUserSettings(@JwtUser() user: JwtUserInterface): Promise<UpdateUserSettingsDto> {
        return await this.usersService.getUserSettings(user.id);
    }

    @Post('/pass-user')
    @UseGuards(JwtAuthGuard, PoliciesGuard)
    //** Todo:  User should have "Create" permissions */
    @CheckPolicies(userPolicies.Read())
    @ApiOkResponse({isArray: true, type: UserEntity, description: 'User'})
    @ApiBearerAuth()
    @ApiOperation({description: 'Get a list of filtered users.'})
    async createPasUser(@Body() dto: CreatePasUserDto): Promise<unknown> {
        return await this.usersService.createPasUser(dto);
    }

    @Get(':id')
    @ApiBearerAuth()
    @ApiOperation({description: 'Get user information by user_id.'})
    @UseGuards(JwtAuthGuard, PoliciesGuard)
    @CheckPolicies(userPolicies.Read())
    @ApiParam({name: 'id', description: 'User id', type: 'string'})
    async getUserById(@Param('id') userId: string): Promise<UserEntity> {
        return await this.usersService.getUserById(userId);
    }

    @Patch('/pass-user/:user_id')
    @UseGuards(JwtAuthGuard, PoliciesGuard)
    @CheckPolicies(userPolicies.Update())
    @ApiOkResponse({isArray: true, type: UserEntity, description: 'User'})
    @ApiBearerAuth()
    @ApiOperation({description: 'Update PAS user'})
    @ApiParam({name: 'id', description: 'User id', type: 'string'})
    async updatePasUser(@Body() dto: UpdatePasUserDto, @Param('user_id') userId: string): Promise<void> {
        return await this.usersService.updatePasUser(dto, userId);
    }

    // To do add return types
    @Put('/user-settings')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, PoliciesGuard)
    @CheckPolicies(userPolicies.Update())
    @ApiOperation({description: 'Update user settings'})
    @ApiBody({description: 'User settings', type: UpdateUserSettingsDto})
    @ApiParam({name: 'id', description: 'User id', type: 'string'})
    async updateUserSettings(@JwtUser() user: JwtUserInterface, @Body() updateSettingsDto: UpdateUserSettingsDto): Promise<unknown> {
        return await this.usersService.updateUserSettings(user.id, updateSettingsDto);
    }

    @Post('/is-token-valid')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({description: 'Endpoint used to check if token is still valid. Do not remove.'})
    @CheckPolicies(userPolicies.Read())
    @ServiceUserCheckPolicies()
    isTokenStillValid(): boolean {
        // Do not remove. This is a dummy endpoint used by automations to to check if the token is still valid
        return true;
    }

    @Post('/get-auth-token')
    @ApiOperation({description: 'Get auth token.'})
    @ApiBody({description: 'Authorization token', type: GetAuthTokenRequestDto, required: true})
    @CheckPolicies(() => true)
    @ServiceUserCheckPolicies()
    async getAuthToken(@Body() dto: GetAuthTokenRequestDto): Promise<GetAuthTokenResponseDto> {
        this.logger.debug(`getAuthToken - ${JSON.stringify(dto)}`);
        const url = `${PAS_BASE_URL}/api/auth/token`;
        this.logger.log(`Get auth token with ${JSON.stringify(dto)}`);
        const resp = await firstValueFrom(
            this.httpService.post(url, {
                ...dto,
                authClientId: PAS_CLIENT_ID,
                secret: PAS_CLIENT_SECRET,
            })
        );
        return resp.data;
    }
}
