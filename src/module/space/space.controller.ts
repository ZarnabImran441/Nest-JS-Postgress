import {FolderEntity} from '../../model/folder.entity';
import {
    AuthHeaderDto,
    CheckPolicies,
    contructorLogger,
    JwtAuthGuard,
    JwtPayloadInterface,
    JwtUser,
    JwtUserInterface,
    ParseBooleanPipeOptional,
    PoliciesGuard,
    ServiceUserCheckPolicies,
    TASK_MANAGEMENT,
} from '@lib/base-library';
import {Body, Controller, Delete, Get, Headers, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Query, UseGuards} from '@nestjs/common';
import {ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags} from '@nestjs/swagger';
import {SpaceService} from './space.service';
import {CreateSpaceDto, CreateSpaceResponse} from '../../dto/space/create-space.dto';
import {
    ArchiveSpaceDto,
    CopySpaceDto,
    CreateSpaceCustomFieldValueDto,
    SpaceFavouriteDto,
    SpaceStatsDto,
    UpdateSpaceDto,
    UpdateSpacePositionDto,
} from '../../dto/space/update-space.dto';
import {DeleteResult, InsertResult, UpdateResult} from 'typeorm';
import {spacePolicies} from '../../policy/policy-consts';
import {GetSpaceDto} from '../../dto/space/get-space.dto';
import {MembersDto} from '../../dto/folder/folder/members.dto';
import {EntityTypeOptions} from '../authorization-impl/authorization.enum';
import {ChangeOwnerDto} from '../../dto/folder/folder/create-folder.dto';

/**
 * Controller class for managing spaces.
 * @ApiTags('Space')
 * @Controller('space')
 * @UseGuards(JwtAuthGuard, PoliciesGuard)
 * @ApiBearerAuth()
 */
@ApiTags('Space')
@Controller('space')
@UseGuards(JwtAuthGuard, PoliciesGuard)
@ApiBearerAuth()
export class SpaceController {
    constructor(public service: SpaceService) {
        contructorLogger(this);
    }

    /**
     * Create a space.
     *
     * @param {CreateSpaceDto} dto - The properties to create a space.
     * @param {JwtUserInterface} user - The JWT user.
     * @param {AuthHeaderDto} headers - The authorization headers.
     * @returns {Promise<CreateSpaceResponse>} - The created space.
     */
    @Post()
    @ServiceUserCheckPolicies(spacePolicies.Create())
    @ApiOperation({summary: 'Create a Space'})
    @ApiBody({description: 'Properties to create a space', type: CreateSpaceDto, isArray: false})
    @ApiOkResponse({type: Number, isArray: false, description: 'List of space without childrens'})
    async createSpace(
        @Body() dto: CreateSpaceDto,
        @JwtUser() user: JwtUserInterface,
        @Headers() {authorization}: AuthHeaderDto
    ): Promise<CreateSpaceResponse> {
        const sanitizedToken = authorization.replace('Bearer ', '');
        return await this.service.createSpace(dto, user.id as string, sanitizedToken);
    }

    /**
     * Update a space.
     *
     * @param {number} spaceId - The ID of the space to update.
     * @param {UpdateSpaceDto} dto - The properties to update the space.
     * @param {JwtUserInterface} user - The user object containing user information.
     * @param {AuthHeaderDto} authorization - The authorization header object.
     * @param {string} showOn - The value of the 'shown-on' query parameter.
     * @returns {Promise<UpdateResult>} - The update result.
     */
    @Patch(':space_id')
    @ApiOperation({summary: 'Update a Space'})
    @ApiParam({name: 'space_id', required: true, type: Number, description: 'space id = folder id'})
    @ApiBody({description: 'Properties to Update a space', type: UpdateSpaceDto, isArray: false})
    @CheckPolicies(spacePolicies.OwnerFull('params.space_id'))
    async updateSpace(
        @Param('space_id', ParseIntPipe) spaceId: number,
        @Body() dto: UpdateSpaceDto,
        @JwtUser() user: JwtUserInterface,
        @Headers() {authorization}: AuthHeaderDto,
        @Query('shown-on') showOn: string = TASK_MANAGEMENT
    ): Promise<UpdateResult> {
        const sanitizedToken = authorization.replace('Bearer ', '');
        return await this.service.updateSpace(spaceId, dto, user, sanitizedToken, showOn);
    }

    //** This will only return the rows with type : space because in query we have added this condition  */
    /**
     * Retrieves all Spaces with their properties including teams, workflows, and collections.
     * @method getAllSpaces
     * @param {JwtUser} user - The user object.
     * @param {String} showOn - The filter for folders by show on property. Default value is "task-management".
     * @param {Number} limit - The limit for the number of spaces to retrieve. Default value is 10.
     * @param {Number} offset - The offset for pagination. Default value is 0.
     * @param {Boolean} showDeleted - The filter for folders by deleted property. Default value is false.
     * @param {Boolean} showArchived - The filter for folders by archived property. Default value is false.
     * @return {Promise} A promise that resolves to an array of GetSpaceDto objects.
     */
    @Get()
    @ApiOperation({summary: 'Get all Spaces with its properties like teams,workflows and collections'})
    @ApiOkResponse({type: GetSpaceDto, isArray: true, description: 'List of space without childrens'})
    @ServiceUserCheckPolicies(spacePolicies.Read())
    @ApiQuery({
        name: 'show-on',
        required: true,
        type: String,
        description: `Filter folders by show on property. Default value: "${TASK_MANAGEMENT}"`,
        example: 'task-management',
    })
    @ApiQuery({
        name: 'limit',
        required: true,
        type: Number,
        description: `limit`,
        example: 10,
    })
    @ApiQuery({
        name: 'offset',
        required: true,
        type: Number,
        description: `offset`,
        example: 0,
    })
    @ApiQuery({
        name: 'show-archived',
        required: false,
        type: Boolean,
        description: `Filter folders by archived property. Default value: "false"`,
    })
    @ApiQuery({
        name: 'show-deleted',
        required: false,
        type: Boolean,
        description: `Filter folders by deleted property. Default value: "false"`,
    })
    async getAllSpaces(
        @JwtUser() user: JwtUserInterface,
        @Query('shown-on') showOn = TASK_MANAGEMENT,
        @Query('limit') limit = 10,
        @Query('offset') offset = 0,
        @Query('show-deleted', ParseBooleanPipeOptional) showDeleted: boolean,
        @Query('show-archived', ParseBooleanPipeOptional) showArchived: boolean
    ): Promise<GetSpaceDto[]> {
        return await this.service.getAllSpaces(user.id, showOn, showDeleted, showArchived, {limit, offset});
    }

    /**
     * Get favourite space of a user.
     *
     * @param {JwtUserInterface} user - The user object containing the user's id.
     * @param {string} [showOn=TASK_MANAGEMENT] - The show on property to filter the spaces. Default value is TASK_MANAGEMENT.
     *
     * @returns {Promise<SpaceFavouriteDto[]>} - A promise that resolves to an array of SpaceFavouriteDto objects representing the user's favourite spaces.
     */
    @Get('favourite')
    @ApiOperation({summary: 'Get favourite space of a user'})
    @ApiQuery({
        name: 'show-on',
        required: false,
        type: String,
        description: `Filter spaces by show on property. Default value: "${TASK_MANAGEMENT}"`,
    })
    @CheckPolicies(spacePolicies.Read())
    async getFavourites(
        @JwtUser() user: JwtUserInterface,
        @Query('shown-on') showOn: string = TASK_MANAGEMENT
    ): Promise<SpaceFavouriteDto[]> {
        return await this.service.getFavourites(user.id, showOn);
    }

    /**
     * Delete a space with properties like teams, workflows, and collections.
     *
     * @param {number} space_id - The space id (folder id) to delete.
     * @param {JwtUserInterface} user - The user object obtained from Jwt token.
     * @returns {Promise<void>} - A promise that resolves when the space is deleted successfully.
     */
    @Delete(':space_id')
    @ApiOperation({summary: 'delete a space with properties like teams,workflows and collections'})
    @ApiParam({name: 'space_id', required: true, type: Number, description: 'space id = folder id'})
    @CheckPolicies(spacePolicies.OwnerFull('params.space_id'))
    async deleteSpace(@Param('space_id', ParseIntPipe) spaceId: number, @JwtUser() user: JwtUserInterface): Promise<void> {
        return await this.service.deleteSpace(spaceId, user.id as string);
    }

    /**
     * Retrieves statistics for a single Space, including teams, workflows, and collections.
     *
     * @param {number} spaceId - The ID of the Space to retrieve statistics for. This should be the folder ID.
     * @param {string} [showOn='TASK_MANAGEMENT'] - The context in which to show the Space statistics.
     * @returns {Promise<SpaceStatsDto>} A Promise that resolves to an object containing the Space statistics.
     */
    @Get('/stats/:space_id')
    @ApiOperation({summary: 'Get one Space with its properties like teams,workflows and collections'})
    @ApiParam({name: 'space_id', required: true, type: Number, description: 'space id = folder id'})
    @ApiOkResponse({type: SpaceStatsDto, isArray: false, description: 'space without childrens'})
    @CheckPolicies(spacePolicies.OwnerFullEditorReadonly('params.space_id'))
    async getOneSpaceStats(
        @Param('space_id', ParseIntPipe) spaceId: number,
        @Query('shown-on') showOn: string = TASK_MANAGEMENT
    ): Promise<SpaceStatsDto> {
        return await this.service.getOneSpaceStats(spaceId, showOn);
    }

    /**
     * Retrieves information about a Space, including its teams, workflows, and collections.
     *
     * @param {number} space_id - The ID of the space (folder ID) to retrieve.
     * @param {string} [shown-on=TASK_MANAGEMENT] - The optional value to filter the space's shown-on property.
     * @param {JwtUserInterface} user - The JWT user object.
     * @returns {Promise<GetSpaceDto>} - A promise that resolves with the retrieved space data.
     */
    @Get(':space_id')
    @ApiOperation({summary: 'Get one Space with its properties like teams,workflows and collections'})
    @ApiParam({name: 'space_id', required: true, type: Number, description: 'space id = folder id'})
    @ApiOkResponse({type: GetSpaceDto, isArray: false, description: 'space without childrens'})
    @CheckPolicies(spacePolicies.OwnerFullEditorReadonly('params.space_id'))
    async getOneSpace(
        @Param('space_id', ParseIntPipe) spaceId: number,
        @Query('shown-on') showOn: string = TASK_MANAGEMENT,
        @JwtUser() user: JwtUserInterface
    ): Promise<GetSpaceDto> {
        return await this.service.getOneSpace(spaceId, user, showOn);
    }

    //** Todo : Add validation */
    /**
     * Adds custom field values to a space.
     *
     * @param {number} spaceId - The ID of the space to add custom field values to.
     * @param {CreateSpaceCustomFieldValueDto[]} dto - An array of objects representing the custom field values to add.
     * @param {JwtUserInterface} user - The user making the request.
     *
     * @returns {Promise<InsertResult>} A promise that resolves to the result of the operation.
     */
    @Post('/:space_id/custom-field-value')
    @ApiOperation({summary: 'add custom field values to a space'})
    @ApiParam({name: 'space_id', required: true, type: Number, description: 'space id'})
    @CheckPolicies(spacePolicies.OwnerFull('params.space_id'))
    async addFolderCustomFieldValue(
        @Param('space_id', ParseIntPipe) spaceId: number,
        @Body() dto: CreateSpaceCustomFieldValueDto[],
        @JwtUser() user: JwtUserInterface
    ): Promise<InsertResult> {
        return await this.service.addSpaceCustomFieldValues(spaceId, dto, user);
    }

    /**
     * Archives a Space and all its children.
     *
     * @param {number} space_id - The id of the Space to be archived.
     * @param {JwtPayloadInterface} user - The user object containing authenticated user information.
     * @param {AuthHeaderDto} headers - The headers object containing the authorization token.
     * @param {ArchiveSpaceDto} dto - The object containing the archive reason.
     * @returns {Promise<void>} - A promise that resolves when the Space is successfully archived.
     */
    @Post('/:space_id/archive')
    @ApiOperation({summary: 'Archives a Space and all children'})
    @ApiParam({name: 'space_id', required: true, type: Number, description: 'Filter results by Space id'})
    @ApiBody({description: 'Archive Reason ', type: ArchiveSpaceDto})
    @CheckPolicies(spacePolicies.OwnerFull('params.space_id'))
    async archiveTree(
        @Param('space_id', ParseIntPipe) space_id: number,
        @JwtUser() user: JwtPayloadInterface,
        @Headers() {authorization}: AuthHeaderDto,
        @Body() dto: ArchiveSpaceDto
    ): Promise<void> {
        const sanitizedToken = authorization.replace('Bearer ', '');
        return await this.service.archiveSpaceWithFolders(space_id, user.id, sanitizedToken, dto);
    }

    /**
     * Restores an archived space.
     *
     * @param {number} spaceId - The id of the space to restore.
     * @return {Promise<void>} - A promise that resolves with void when the space is restored.
     */
    @Post('/:space_id/restore')
    @ApiOperation({summary: 'Restore archived space'})
    @ApiParam({name: 'space_id', required: true, type: Number, description: 'space id'})
    @CheckPolicies(spacePolicies.OwnerFull('params.space_id'))
    async restoreArchived(@Param('space_id', ParseIntPipe) spaceId: number, @JwtUser() user: JwtUserInterface): Promise<void> {
        return await this.service.restoreArchivedSpace(spaceId, user);
    }

    /**
     * Copies a folder and its children to another location.
     *
     * @param {number} spaceId - The ID of the space to be copied.
     * @param {JwtUserInterface} user - The user making the request.
     * @param {CopySpaceDto} dto - The DTO containing information for the copy operation.
     * @param {AuthHeaderDto} authorization - The authorization header.
     * @param {string} showOn - The filter for the 'show-on' property. Default value is "TASK_MANAGEMENT".
     * @return {Promise<FolderEntity>} - The copied folder entity.
     */
    @Post('/:space_id/copy')
    @ApiOperation({summary: 'Copy space & children to another place'})
    @ApiParam({name: 'space_id', required: false, type: Number, description: 'Filter results by space id'})
    @ApiBody({description: 'space copies', type: CopySpaceDto})
    @ApiQuery({
        name: 'show-on',
        required: false,
        type: String,
        description: `Filter space by show on property. Default value: "${TASK_MANAGEMENT}"`,
    })
    @CheckPolicies(spacePolicies.OwnerFull('params.space_id'), spacePolicies.Create())
    async copyFolder(
        @Param('space_id', ParseIntPipe) spaceId: number,
        @JwtUser() user: JwtUserInterface,
        @Body() dto: CopySpaceDto,
        @Headers() {authorization}: AuthHeaderDto,
        @Query('shown-on') showOn: string = TASK_MANAGEMENT
    ): Promise<FolderEntity> {
        return await this.service.copyOneSpace(spaceId, null, dto, user, authorization, showOn);
    }

    //Space Read permission
    /**
     * Marks a Space as user's favorite.
     *
     * @param {number} spaceId - The id of the Space to mark as favorite.
     * @param {JwtUserInterface} user - The user making the request.
     *
     * @returns {Promise<InsertResult>} - A Promise that resolves to the InsertResult object, indicating the success of marking Space as favorite.
     */
    @Post('favourite/:space_id')
    @ApiOperation({summary: 'Mark Space as user favourite'})
    @ApiParam({name: 'space_id', required: true, type: Number, description: 'Space id'})
    @CheckPolicies(spacePolicies.Read('params.space_id'))
    async markFavourite(@Param('space_id', ParseIntPipe) spaceId: number, @JwtUser() user: JwtUserInterface): Promise<InsertResult> {
        return await this.service.markSpaceFavourite(spaceId, user.id);
    }

    //Space Read permission
    //** User validation will be done on service */
    /**
     * Unmarks a space as user favourite.
     *
     * @param {number} spaceId - The id of the space to unmark as favourite.
     * @param {JwtUserInterface} user - The user making the request.
     * @returns {Promise<DeleteResult>} - A promise that resolves to the delete result.
     */
    @Delete('favourite/:space_id')
    @ApiOperation({summary: 'Unmark Space as user favourite'})
    @ApiParam({name: 'space_id', required: true, type: Number, description: 'Space id'})
    @CheckPolicies(spacePolicies.Read('params.space_id'))
    async unmarkFavourite(@Param('space_id', ParseIntPipe) spaceId: number, @JwtUser() user: JwtUserInterface): Promise<DeleteResult> {
        return await this.service.unmarkSpaceFavourite(spaceId, user.id);
    }

    /**
     * Updates the position of a space.
     *
     * @param {number} space_id The ID of the space to update the position/column.
     * @param {UpdateSpacePositionDto} data The new position of the space.
     * @param {JwtUserInterface} user The user making the request.
     * @return {Promise<void>} A promise that resolves when the space position is updated.
     */
    @Patch('position/:space_id')
    @ApiOperation({summary: 'Update Space position'})
    @ApiParam({name: 'space_id', required: true, type: Number, description: 'space id to update position/column'})
    @ApiBody({description: 'Space new position', type: UpdateSpacePositionDto})
    @CheckPolicies(spacePolicies.Read('params.space_id'))
    async updateSpacePosition(
        @Param('space_id', ParseIntPipe) space_id: number,
        @Body() data: UpdateSpacePositionDto,
        @JwtUser() user: JwtUserInterface
    ): Promise<void> {
        await this.service.updateSpacePosition(space_id, data, user);
    }

    @Patch('favourite/position/:space_id')
    @ApiOperation({summary: 'Update Space position'})
    @ApiParam({name: 'space_id', required: true, type: Number, description: 'space id to update position/column'})
    @ApiBody({description: 'Space new position', type: UpdateSpacePositionDto})
    @CheckPolicies(spacePolicies.OwnerFull('params.space_id'))
    async updateFavouriteSpacePosition(
        @Param('space_id', ParseIntPipe) space_id: number,
        @Body() data: UpdateSpacePositionDto,
        @JwtUser() user: JwtUserInterface
    ): Promise<void> {
        await this.service.updateFavouriteSpacePosition(space_id, data, user);
    }

    /**
     * Updates the members of a space.
     *
     * @param {number} spaceId - The id of the space.
     * @param {MembersDto} dto - The members of the space.
     * @param {JwtUserInterface} user - The user making the request.
     * @param {string} [showOn=TASK_MANAGEMENT] - The option to show members on.
     * @returns {Promise<void>} - A promise that resolves with no value.
     */
    @Patch(':space_id/members')
    @ApiOperation({summary: 'Update Space Members'})
    @ApiBody({required: true, type: MembersDto, description: 'Members of the Space'})
    @ApiParam({name: 'space_id', required: true, type: Number, description: 'Space id'})
    @ServiceUserCheckPolicies(spacePolicies.OwnerFullEditorReadonly('params.space_id'))
    async setSpaceMembers(
        @Param('space_id', ParseIntPipe) spaceId: number,
        @Body() dto: MembersDto,
        @JwtUser() user: JwtUserInterface,
        @Query('shown-on') showOn: string = TASK_MANAGEMENT
    ): Promise<void> {
        return await this.service.setSpaceMember(spaceId, dto, user, showOn, EntityTypeOptions.Space);
    }

    @Patch(':space_id/owner/:new_owner_id')
    @ApiOperation({summary: 'Change space owner'})
    @ApiParam({name: 'space_id', required: true, type: Number, description: 'Space id'})
    @ApiParam({name: 'new_owner_id', required: true, type: String, format: 'uuid', description: 'New owner id'})
    @ApiBody({description: 'Change owner', type: ChangeOwnerDto, required: true})
    @ApiQuery({name: 'show-on', type: String, required: false, description: 'Module show on '})
    @CheckPolicies(spacePolicies.Owner('params.space_id'))
    async changeSpaceOwner(
        @Param('space_id', ParseIntPipe) spaceId: number,
        @Param('new_owner_id', ParseUUIDPipe) newOwnerId: string,
        @Body() dto: ChangeOwnerDto,
        @Query('shown-on') showOn: string = TASK_MANAGEMENT,
        @JwtUser() user: JwtUserInterface
    ): Promise<void> {
        return await this.service.changeSpaceOwner(spaceId, newOwnerId, user, dto, showOn);
    }
}
