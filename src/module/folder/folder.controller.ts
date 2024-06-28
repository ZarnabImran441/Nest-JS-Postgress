import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    Headers,
    Param,
    ParseArrayPipe,
    ParseIntPipe,
    ParseUUIDPipe,
    Patch,
    Post,
    Query,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import {ApiBearerAuth, ApiBody, ApiConsumes, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags} from '@nestjs/swagger';
import {FolderService} from './folder.service';
import {DeleteResult, InsertResult, UpdateResult} from 'typeorm';
import {
    AuthHeaderDto,
    CheckPolicies,
    contructorLogger,
    JwtAuthGuard,
    JwtPayloadInterface,
    JwtUser,
    JwtUserInterface,
    PaginationDto,
    ParseArrayIntPipe,
    ParseArrayIntPipeOptional,
    PoliciesGuard,
    TASK_MANAGEMENT,
} from '@lib/base-library';
import {FileInterceptor} from '@nestjs/platform-express';
import {folderPolicies, purgeFoldersAndTasks, replaceFolderOwner, userPolicies} from '../../policy/policy-consts';
import {GetFolderDto} from '../../dto/folder/folder/get-folder.dto';
import {FolderEntity} from '../../model/folder.entity';
import {FolderFavouriteDto, UpdateFolderDto, UpdateFolderPositionDto} from '../../dto/folder/folder/update-folder.dto';
import {FolderViewOptions} from '../../enum/folder-position.enum';
import {TaskTreeDto} from '../../dto/folder/folder/task-tree.dto';
import {CopyFolderDto} from '../../dto/folder/folder/copy-folder.dto';
import {ChangeOwnerDto, CreateFolderDto, FolderBindDto} from '../../dto/folder/folder/create-folder.dto';
import {MembersDto} from '../../dto/folder/folder/members.dto';
import {ChangeWorkflowFolderDto} from '../../dto/folder/folder/change-workflow.dto';
import {FolderCustomFieldDto} from '../../dto/folder/folder/folder-custom-field.dto';
import {FolderFollowerEntity} from '../../model/folder-follower.entity';
import {GetFollowingFolderDto} from '../../dto/folder/folder/get-following-folder.dto';
import {CreateFolderCustomFieldValueDto} from '../../dto/folder/folder/create-folder-custom-field-value.dto';
import {UpdateFolderTagsTasksDto} from '../../dto/folder-tag-task/update-tags-task-folder.dto';
import {TagEntity} from '../../model/tag.entity';
import {FileUploadDto} from '../../dto/folder/folder/file-upload.dto';
import {FolderTreeDto} from '../../dto/folder/folder/folder-tree.dto';
import {TaskAttachmentEntity} from '../../model/task-attachment.entity';
import {ImportTasksFromExcelDto} from '../../dto/task/import-tasks-from-excel.dto';
import {FolderViewDto} from '../../dto/folder/folder/folder-view.dto';
import {CustomFieldDefinitionEntity} from '../../model/custom-field-definition.entity';
import {ArchiveFolderDto} from '../../dto/folder/folder/archive-folder.dto';
import {WorkFlowEntity} from '../../model/workflow.entity';
import {ArchivedDeletedFoldersTasksResponseDto} from '../../dto/folder/folder/get-archived-deleted.dto';
import {EntityTypeOptions} from '../authorization-impl/authorization.enum';
import {FolderTypeOptions} from '../../enum/folder.enum';

@ApiTags('Folder')
@Controller('folder')
@UseGuards(JwtAuthGuard, PoliciesGuard)
@ApiBearerAuth()
export class FolderController {
    constructor(public service: FolderService) {
        contructorLogger(this);
    }

    //** Added a restriction here that this should only returns rowsw with type folder and project */
    @Get()
    @ApiOperation({description: 'Get folders'})
    @ApiQuery({
        name: 'show-on',
        required: false,
        type: String,
        description: `Filter folders by show on property. Default value: "${TASK_MANAGEMENT}"`,
    })
    @CheckPolicies(folderPolicies.Read())
    async getMany(@JwtUser() user: JwtUserInterface, @Query('shown-on') showOn: string = TASK_MANAGEMENT): Promise<GetFolderDto[]> {
        return await this.service.findAll(user.id, showOn);
    }

    @Get('archived')
    @ApiOperation({summary: 'Retrieve multiple archived folders'})
    @ApiOkResponse({type: FolderEntity, description: 'Return all trees of the folder'})
    @ApiQuery({
        name: 'show-on',
        required: false,
        type: String,
        description: `Filter folders by show on property. Default value: "${TASK_MANAGEMENT}"`,
    })
    @CheckPolicies(folderPolicies.Read())
    async getManyArchived(@JwtUser() user: JwtUserInterface, @Query('shown-on') showOn: string = TASK_MANAGEMENT): Promise<GetFolderDto[]> {
        return await this.service.getAllArchivedFolders(user.id, true, showOn);
    }

    @Post('archived-folder-task')
    @ApiOperation({summary: 'Retrieve multiple archived  folders and tasks'})
    @ApiOkResponse({type: FolderEntity, description: 'Return all archived folders and tasks'})
    @ApiBody({description: 'limit and offset', type: PaginationDto})
    @ApiQuery({
        name: 'show-on',
        required: false,
        type: String,
        description: `Filter folders by show on property. Default value: "${TASK_MANAGEMENT}"`,
    })
    @ApiQuery({
        name: 'search',
        required: false,
        type: String,
    })
    @CheckPolicies(purgeFoldersAndTasks.Update())
    async getManyArchivedFoldersAndTasks(
        @Query('shown-on') showOn: string = TASK_MANAGEMENT,
        @Query('search') search: string,
        @Body() dto: PaginationDto,
        @JwtUser() user: JwtUserInterface,
        @Query('space-ids', ParseArrayIntPipeOptional) spaceIds: number[] = []
    ): Promise<ArchivedDeletedFoldersTasksResponseDto> {
        return await this.service.getAllArchivedDeletedFoldersTasks(dto, showOn, search, false, user.id, spaceIds);
    }

    @Post('deleted-folder-task')
    @ApiOperation({summary: 'Retrieve multiple deleted folders and tasks'})
    @ApiOkResponse({type: FolderEntity, description: 'Return all deleted folders and tasks'})
    @ApiBody({description: 'limit and offset', type: PaginationDto})
    @ApiQuery({
        name: 'show-on',
        required: false,
        type: String,
        description: `Filter folders by show on property. Default value: "${TASK_MANAGEMENT}"`,
    })
    @ApiQuery({
        name: 'search',
        required: false,
        type: String,
    })
    @CheckPolicies(purgeFoldersAndTasks.Update())
    async getManyDeletedFoldersAndTasks(
        @Query('shown-on') showOn: string = TASK_MANAGEMENT,
        @Query('search') search: string,
        @Body() dto: PaginationDto,
        @JwtUser() user: JwtUserInterface,
        @Query('space-ids', ParseArrayIntPipeOptional) spaceIds: number[] = []
    ): Promise<ArchivedDeletedFoldersTasksResponseDto> {
        return await this.service.getAllArchivedDeletedFoldersTasks(dto, showOn, search, true, user.id, spaceIds);
    }

    @Get('favourite')
    @ApiOperation({summary: 'Get favourite folders of a user'})
    @ApiQuery({
        name: 'show-on',
        required: false,
        type: String,
        description: `Filter folders by show on property. Default value: "${TASK_MANAGEMENT}"`,
    })
    @CheckPolicies(userPolicies.Read(), folderPolicies.Read())
    async getFavourites(
        @JwtUser() user: JwtUserInterface,
        @Query('shown-on') showOn: string = TASK_MANAGEMENT
    ): Promise<FolderFavouriteDto[]> {
        return await this.service.getFavouriteFolders(user.id, showOn, [FolderTypeOptions.FOLDER, FolderTypeOptions.PROJECT]);
    }

    @Get('folder-tree')
    @ApiOperation({summary: 'Get folder trees of the folder'})
    @ApiQuery({name: 'tree-view', required: false, type: Number, description: 'A tree-view id'})
    @ApiQuery({
        name: 'folder_id',
        required: false,
        type: Number,
        description: 'Filter results by parent and folder id ',
    })
    @ApiQuery({
        name: 'parent_folder_id',
        required: false,
        type: Number,
        description: 'Filter results by parent and folder id',
    })
    @ApiQuery({name: 'depth', required: false, type: Number, description: 'Tree depth limit'})
    @ApiQuery({
        name: 'show-on',
        required: false,
        type: String,
        description: `Filter folders by show on property. Default value: "${TASK_MANAGEMENT}"`,
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
    @ApiQuery({
        name: 'space-ids',
        required: false,
        description: `Filter folders by deleted property. Default value: "false"`,
        type: 'number',
        isArray: true,
        style: 'matrix',
        explode: false,
    })
    //** Julio lets check this if we can get a space or not */
    //** update this and here we should have space and folder permissions */
    @CheckPolicies(folderPolicies.Read())
    async getFolderTree(
        @JwtUser() user: JwtUserInterface,
        @Query('folder_id') folderId?: number,
        @Query('parent_folder_id') parentFolderId?: number,
        @Query('depth') depth?: number,
        @Query('tree-view') treeViewId?: number,
        @Query('shown-on') showOn: string = TASK_MANAGEMENT,
        @Query('show-archived') showArchived = false,
        @Query('show-deleted') showDeleted = false,
        @Query('space-ids', ParseArrayIntPipeOptional) spaceIds: number[] = []
    ): Promise<FolderTreeDto[]> {
        return await this.service.getFolderTree(
            isNaN(folderId) ? null : folderId,
            FolderViewOptions.ROOT,
            user,
            isNaN(depth) ? null : depth,
            isNaN(parentFolderId) ? null : parentFolderId,
            isNaN(treeViewId) ? null : treeViewId,
            showOn,
            showArchived,
            showDeleted,
            spaceIds
        );
    }

    @Get('task-tree/:folder_id')
    @ApiOperation({summary: 'Get task trees of the folder'})
    @ApiOkResponse({type: TaskTreeDto, description: 'Return all trees of the folder'})
    @ApiParam({name: 'folder_id', required: true, type: Number, description: 'Filter results by folder id'})
    @ApiQuery({
        name: 'show-on',
        required: false,
        type: String,
        description: `Filter folders by show on property. Default value: "${TASK_MANAGEMENT}"`,
    })
    @CheckPolicies(folderPolicies.OwnerFullEditorReadonly('params.folder_id'))
    async getTaskTree(
        @JwtUser() user: JwtUserInterface,
        @Param('folder_id', ParseIntPipe) folderId: number,
        @Query('shown-on') showOn: string = TASK_MANAGEMENT
    ): Promise<TaskTreeDto[]> {
        return await this.service.getTaskTreeByFolderId(folderId, user, showOn);
    }

    @Get('custom-fields/:id')
    @ApiOperation({summary: 'Fetch the custom field definitions for the folder filtered by user'})
    @ApiParam({name: 'id', required: true, type: Number, description: 'Folder id'})
    @ApiQuery({
        name: 'show-on',
        required: false,
        type: String,
        description: `Filter folders by show on property. Default value: "${TASK_MANAGEMENT}"`,
    })
    @CheckPolicies(folderPolicies.OwnerFullEditorReadonly('params.id'))
    async getCustomFields(
        @Param('id', ParseIntPipe) id: number,
        @JwtUser() user: JwtUserInterface,
        @Query('shown-on') showOn: string = TASK_MANAGEMENT
    ): Promise<CustomFieldDefinitionEntity[]> {
        return await this.service.getCustomFields(id, user.id, showOn);
    }

    @Post('copy/:folder_id')
    @ApiOperation({summary: 'Copy Folder & children to another place'})
    @ApiParam({name: 'folder_id', required: false, type: Number, description: 'Filter results by folder id'})
    @ApiBody({description: 'Folder copies', type: CopyFolderDto})
    @ApiQuery({
        name: 'show-on',
        required: false,
        type: String,
        description: `Filter folders by show on property. Default value: "${TASK_MANAGEMENT}"`,
    })
    @CheckPolicies(folderPolicies.OwnerFull('params.folder_id'), folderPolicies.Create())
    async copyFolder(
        @Param('folder_id', ParseIntPipe) folder_id: number,
        @JwtUser() user: JwtUserInterface,
        @Body() dto: CopyFolderDto,
        @Headers() {authorization}: AuthHeaderDto,
        @Query('shown-on') showOn: string = TASK_MANAGEMENT
    ): Promise<FolderEntity> {
        return await this.service.copyOneFolder(folder_id, null, dto, user, authorization, showOn, EntityTypeOptions.Folder);
    }

    @Post()
    @ApiOperation({summary: 'Create a folder'})
    @ApiBody({description: 'Folder', type: CreateFolderDto})
    @CheckPolicies(folderPolicies.Create())
    async createOne(
        @Body() dto: CreateFolderDto,
        @JwtUser() user: JwtUserInterface,
        @Headers() {authorization}: AuthHeaderDto
    ): Promise<FolderEntity> {
        const sanitizedToken = authorization.replace('Bearer ', '');
        if (dto.folderType === FolderTypeOptions.SPACE) {
            throw new BadRequestException('Folder type must be project or folder not space');
        }
        if (!dto.parentFolderId) {
            throw new BadRequestException('Missing parent folder id');
        }
        return await this.service.create(dto, user.id, sanitizedToken, EntityTypeOptions.Folder);
    }

    @Post('archive/:folder_id')
    @ApiOperation({summary: 'Archives a Folder and all children'})
    @ApiParam({name: 'folder_id', required: true, type: Number, description: 'Filter results by Folder id'})
    @ApiBody({description: 'Archive Reason ', type: ArchiveFolderDto})
    @CheckPolicies(folderPolicies.OwnerFull('params.folder_id'))
    async archiveTree(
        @Param('folder_id', ParseIntPipe) folder_id: number,
        @JwtUser() user: JwtPayloadInterface,
        @Headers() {authorization}: AuthHeaderDto,
        @Body() dto: ArchiveFolderDto
    ): Promise<void> {
        const sanitizedToken = authorization.replace('Bearer ', '');
        return await this.service.archiveFolder(
            folder_id,
            user.id,
            sanitizedToken,
            [FolderTypeOptions.FOLDER, FolderTypeOptions.PROJECT],
            dto
        );
    }

    //** CAN'T DELETE A SPACE */
    @Delete('delete/:folder_id')
    @ApiOperation({summary: 'Deletes a Folder and all children'})
    @ApiParam({name: 'folder_id', required: true, type: Number, description: 'Filter results by Folder id'})
    @ApiBody({description: 'Archive Reason ', type: ArchiveFolderDto})
    @CheckPolicies(folderPolicies.OwnerFull('params.folder_id'))
    async deleteTree(@Param('folder_id', ParseIntPipe) folder_id: number, @JwtUser() user: JwtPayloadInterface): Promise<void> {
        return await this.service.deleteFolder(folder_id, user.id, [FolderTypeOptions.FOLDER, FolderTypeOptions.PROJECT]);
    }

    @Patch(':folder_id')
    @ApiOperation({summary: 'Update a folder'})
    @ApiParam({name: 'folder_id', required: true, type: Number, description: 'Folder id'})
    @CheckPolicies(folderPolicies.OwnerFull('params.folder_id'))
    async updateFolder(
        @Body() dto: UpdateFolderDto,
        @Param('folder_id', ParseIntPipe) folderId: number,
        @JwtUser() user: JwtPayloadInterface,
        @Headers() {authorization}: AuthHeaderDto,
        @Query('shown-on') showOn: string = TASK_MANAGEMENT
    ): Promise<UpdateResult> {
        if (dto.folderType && dto?.folderType === FolderTypeOptions.SPACE) {
            throw new BadRequestException('Folder type must be project or folder not space');
        }
        const sanitizedToken = authorization.replace('Bearer ', '');
        return await this.service.update(folderId, dto, user.id, sanitizedToken, showOn, EntityTypeOptions.Folder);
    }

    @Patch('position/:folder_id')
    @ApiOperation({summary: 'Update Folder position'})
    @ApiParam({name: 'folder_id', required: true, type: Number, description: 'folder id to update position/column'})
    @ApiBody({description: 'Folder new position', type: UpdateFolderPositionDto})
    //** validate it with space */
    @CheckPolicies(folderPolicies.OwnerFull('params.folder_id'), folderPolicies.OwnerFullOnSpaceOrFolder('body.parentFolderNewId'))
    async updateFolderPosition(
        @Param('folder_id', ParseIntPipe) folder_id: number,
        @Body() data: UpdateFolderPositionDto,
        @JwtUser() user: JwtUserInterface
    ): Promise<void> {
        return await this.service.updateFolderOnePosition(folder_id, data, user, EntityTypeOptions.Folder, true);
    }

    //**  */
    @Patch('members/:folder_id')
    @ApiOperation({summary: 'Update Folder Members'})
    @ApiBody({required: true, type: MembersDto, description: 'Members of the folder'})
    @ApiParam({name: 'folder_id', required: true, type: Number, description: 'Folder id'})
    @CheckPolicies(folderPolicies.OwnerFullEditorReadonly('params.folder_id'))
    async setFolderMembers(
        @Param('folder_id', ParseIntPipe) folderId: number,
        @Body() dto: MembersDto,
        @JwtUser() user: JwtUserInterface,
        @Query('shown-on') showOn: string = TASK_MANAGEMENT
    ): Promise<void> {
        return await this.service.setFolderMembersInternal(folderId, dto, user.id, showOn, EntityTypeOptions.Folder);
    }

    @Patch('/change-workflow/:folder_id')
    @ApiOperation({summary: 'Change/Set workflow of folders'})
    @ApiBody({required: true, type: ChangeWorkflowFolderDto, description: 'Workflow of a folder'})
    @ApiParam({name: 'folder_id', required: true, type: Number, description: 'Folder id'})
    @CheckPolicies(folderPolicies.OwnerFull('params.folder_id'))
    async changeWorkflow(
        @Param('folder_id', ParseIntPipe) folderId: number,
        @Body() dto: ChangeWorkflowFolderDto,
        @JwtUser() user: JwtUserInterface
    ): Promise<Partial<WorkFlowEntity>> {
        return await this.service.changeWorkflowForFolder(folderId, dto, user.id, EntityTypeOptions.Folder);
    }

    @Post('archived/restore/:folder_id')
    @ApiOperation({summary: 'Restore archived folder'})
    @ApiParam({name: 'folder_id', required: true, type: Number, description: 'Folder id'})
    @CheckPolicies(folderPolicies.OwnerFull('params.folder_id'))
    async restoreArchived(@Param('folder_id', ParseIntPipe) folderId: number, @JwtUser() user: JwtUserInterface): Promise<void> {
        return await this.service.restoreArchivedFolder(folderId, [FolderTypeOptions.FOLDER, FolderTypeOptions.PROJECT], user);
    }

    @Post('deleted/restore/:folder_id')
    @ApiOperation({summary: 'Restore Deleted folder'})
    @ApiParam({name: 'folder_id', required: true, type: Number, description: 'Folder id'})
    @CheckPolicies(purgeFoldersAndTasks.Update())
    async restoreDeleted(@Param('folder_id', ParseIntPipe) folderId: number): Promise<void> {
        return await this.service.restoreDeletedFolder(folderId);
    }

    @Delete('permanent-delete/:folder_id')
    @ApiOperation({summary: 'Permanent Delete archived or deleted folder'})
    @ApiParam({name: 'folder_id', required: true, type: Number, description: 'Folder id'})
    @CheckPolicies(purgeFoldersAndTasks.Delete())
    async permanentDeleteFolder(
        @Param('folder_id', ParseIntPipe) folderId: number,
        @JwtUser() user: JwtPayloadInterface,
        @Headers() {authorization}: AuthHeaderDto,
        @Query('shown-on') showOn: string = TASK_MANAGEMENT
    ): Promise<FolderEntity> {
        const sanitizedToken = authorization.replace('Bearer ', '');
        return await this.service.remove(folderId, user.id, sanitizedToken, showOn);
    }

    @Post('bind/:folder_id')
    @ApiOperation({summary: 'Bind folder with another folder, in a parent/child relationship'})
    @ApiParam({name: 'folder_id', required: true, type: Number, description: 'Folder id'})
    @ApiBody({
        description: 'Ids to bind with folder',
        type: FolderBindDto,
        isArray: false,
        required: true,
    })
    @CheckPolicies(folderPolicies.OwnerFull('params.folder_id'))
    async bindFolder(
        @Param('folder_id', ParseIntPipe) folderId: number,
        @Body() dto: FolderBindDto,
        @JwtUser() user: JwtUserInterface
    ): Promise<void> {
        return await this.service.bindFolderPermission(folderId, dto, user);
    }

    // Owner of the folder creates permission on folder and updates?
    @Post('views/:folder_id')
    @ApiOperation({summary: 'Set the different views of the folder'})
    @ApiParam({name: 'folder_id', required: true, type: Number, description: 'Parent folder id'})
    @ApiBody({
        isArray: true,
        type: 'FolderViewDto',
        required: true,
        description: 'List of views to set on the folder',
        examples: {
            example: {
                summary: 'set folder views',
                value: [
                    {name: 'Gantt', index: 1},
                    {name: 'List', index: 2},
                ],
            },
        },
    })
    @CheckPolicies(folderPolicies.OwnerFull('params.folder_id'))
    async setViews(
        @Param('folder_id', ParseIntPipe) folderId: number,
        @Body() views: FolderViewDto[],
        @JwtUser() user: JwtUserInterface
    ): Promise<UpdateResult> {
        return await this.service.setViewsOfFolder(folderId, views, user.id);
    }

    @Post('custom-fields/:id')
    @ApiOperation({summary: 'Set the custom field definitions for a folder'})
    @ApiParam({name: 'id', required: true, type: Number, description: 'Folder id'})
    @ApiBody({
        description: 'An array of FolderCustomFieldDto',
        type: FolderCustomFieldDto,
        isArray: true,
        required: true,
    })
    @CheckPolicies(folderPolicies.OwnerFull('params.id'))
    async setCustomFields(
        @Param('id', ParseIntPipe) id: number,
        @Body(new ParseArrayPipe({items: FolderCustomFieldDto})) body: FolderCustomFieldDto[],
        @JwtUser() user: JwtUserInterface
    ): Promise<InsertResult[]> {
        return await this.service.setCustomFieldsForFolder(id, body, user);
    }

    @Patch('owner/:folder_id/:new_owner_id')
    @ApiOperation({summary: 'Change folder owner'})
    @ApiParam({name: 'folder_id', required: true, type: Number, description: 'Folder id'})
    @ApiParam({name: 'new_owner_id', required: true, type: String, format: 'uuid', description: 'New owner id'})
    @ApiBody({description: 'Change owner', type: ChangeOwnerDto, required: true})
    @CheckPolicies(replaceFolderOwner.SuperAdminOwner('params.folder_id'))
    async changeOwner(
        @Param('folder_id', ParseIntPipe) folderId: number,
        @Param('new_owner_id', ParseUUIDPipe) newOwnerId: string,
        @Body() dto: ChangeOwnerDto,
        @Query('shown-on') showOn: string = TASK_MANAGEMENT,
        @JwtUser() user: JwtUserInterface
    ): Promise<void> {
        return await this.service.changeOwnerOfAFolder(folderId, newOwnerId, user.id, dto, showOn, EntityTypeOptions.Folder);
    }

    //Folder Read permission
    @Post('favourite/:folder_id')
    @ApiOperation({summary: 'Mark folder as user favourite'})
    @ApiParam({name: 'folder_id', required: true, type: Number, description: 'Folder id'})
    @CheckPolicies(folderPolicies.Read('params.folder_id'))
    async markFavourite(@Param('folder_id', ParseIntPipe) folderId: number, @JwtUser() user: JwtUserInterface): Promise<InsertResult> {
        return await this.service.markFolderFavourite(folderId, user.id, [FolderTypeOptions.PROJECT, FolderTypeOptions.FOLDER]);
    }

    //Folder Read permission
    //** User validation will be done on service */
    @Delete('favourite/:folder_id')
    @ApiOperation({summary: 'Unmark folder as user favourite'})
    @ApiParam({name: 'folder_id', required: true, type: Number, description: 'Folder id'})
    @CheckPolicies(folderPolicies.Read('params.folder_id'))
    async unmarkFavourite(@Param('folder_id', ParseIntPipe) folderId: number, @JwtUser() user: JwtUserInterface): Promise<DeleteResult> {
        return await this.service.unmarkFavourite(folderId, user.id);
    }

    // Read permission
    @ApiOperation({summary: 'Subscribe to a Folder to get emails when it is updated'})
    @ApiParam({name: 'folder_id', required: true, type: Number, description: 'Folder id'})
    @ApiParam({name: 'user_id', required: true, type: String, description: 'User id'})
    @Post('follow/:folder_id/:user_id')
    @CheckPolicies(folderPolicies.Read('params.folder_id'))
    async follow(
        @Param('folder_id', ParseIntPipe) folderId: number,
        @Param('user_id', ParseUUIDPipe) userId: string,
        @Query('shown-on') showOn: string = TASK_MANAGEMENT
    ): Promise<FolderFollowerEntity> {
        return await this.service.followFolder(folderId, userId, showOn);
    }

    // Read permission
    @ApiOperation({summary: 'Remove a subscription from a specific Folder'})
    @ApiParam({name: 'user_id', required: true, type: String, description: 'User id'})
    @ApiParam({name: 'folder_id', required: true, type: Number, description: 'Folder id'})
    @Delete('unfollow/:folder_id/:user_id')
    @CheckPolicies(folderPolicies.Read('params.folder_id'))
    async unfollow(
        @Param('folder_id', ParseIntPipe) folderId: number,
        @Param('user_id', ParseUUIDPipe) userId: string,
        @Query('shown-on') showOn: string = TASK_MANAGEMENT
    ): Promise<DeleteResult> {
        return await this.service.unfollowFolder(folderId, userId, showOn);
    }

    //Owner of folder can see followers
    //ask Julio
    //** Members with full permissions on folders */
    @ApiOperation({summary: 'Fetch all followers from a specific Folder'})
    @ApiParam({name: 'folder_id', required: true, type: Number, description: 'Folder id'})
    @CheckPolicies(folderPolicies.OwnerFullEditorReadonly('params.folder_id'))
    @Get('follow/:folder_id')
    async getFollowers(@Param('folder_id', ParseIntPipe) folderId: number): Promise<FolderFollowerEntity[]> {
        return await this.service.getFolderFollowers(folderId);
    }

    //Read permission on folder
    //** User validation on Services */
    @Patch('favourite/position/:folder_id')
    @ApiOperation({summary: 'Update a Folder favourites position'})
    @ApiParam({name: 'index', type: Number, description: 'Folder new Position'})
    @ApiParam({name: 'folder_id', required: true, type: Number, description: 'folder id to update position/column'})
    @CheckPolicies(folderPolicies.OwnerFullEditorReadonly('params.folder_id'))
    async updateFavouritePosition(
        @Param('folder_id', ParseIntPipe) folderId: number,
        @Param() index: number,
        @JwtUser() user: JwtUserInterface
    ): Promise<void> {
        return await this.service.updateFavouritePositionFolder(folderId, index, user.id);
    }

    //**   Read permission  */
    @Get('following')
    @ApiOperation({summary: 'Get the folders that the current user is following'})
    @ApiQuery({
        name: 'show-on',
        required: false,
        type: String,
        description: `Filter folders by show on property. Default value: "${TASK_MANAGEMENT}"`,
    })
    @CheckPolicies(folderPolicies.Read())
    async getFollowing(
        @JwtUser() user: JwtUserInterface,
        @Query('shown-on') showOn: string = TASK_MANAGEMENT
    ): Promise<GetFollowingFolderDto[]> {
        return await this.service.getFolderFollowing(user, showOn);
    }

    // Here the user should have permission of the custom fields entity or user should be an owner of the folder
    // Read Permission on custom field value and read & update folder permission
    @Post('/custom-field-value/:folder_id')
    @ApiOperation({summary: 'add custom field values to a folder'})
    @ApiParam({name: 'folder_id', required: true, type: Number, description: 'folder id'})
    @CheckPolicies(folderPolicies.OwnerFull('params.folder_id'))
    async addFolderCustomFieldValue(
        @Param('folder_id', ParseIntPipe) folderId: number,
        @Body() dto: CreateFolderCustomFieldValueDto[],
        @JwtUser() user: JwtUserInterface
    ): Promise<InsertResult> {
        return await this.service.addFolderCustomFieldValues(folderId, dto, user, EntityTypeOptions.Folder);
    }

    // Here the user should have permission of the folderTags entity or user should be owner of the folder to get the tags
    @Patch('folder-tags/:id')
    @ApiOperation({summary: 'Update a folder tags'})
    @ApiBody({required: true, type: UpdateFolderTagsTasksDto, description: 'Tags of the folder'})
    @CheckPolicies(folderPolicies.OwnerFull('params.id'))
    async updateFolderTags(@Param('id') folderId: number, @Body() dto: UpdateFolderTagsTasksDto): Promise<void> {
        return await this.service.updateFolderTags(folderId, dto, EntityTypeOptions.Folder);
    }

    @Get('/folder-tags/:id')
    //read permission on folder read permission on common tags
    @ApiOperation({summary: 'Get a folder tags'})
    @ApiParam({name: 'id', required: true, type: Number, description: 'Folder id'})
    @CheckPolicies(folderPolicies.OwnerFullEditorReadonly('params.id'))
    async getFolderTags(@Param('id', ParseIntPipe) folderId: number): Promise<TagEntity[]> {
        return await this.service.getFolderTags(folderId);
    }

    //Read permission on folder
    @Get(':folder_id/files')
    @ApiOperation({summary: 'Get all files uploaded to a specific folder'})
    @ApiParam({name: 'folder_id', required: true, type: Number, description: 'folder id'})
    @CheckPolicies(folderPolicies.OwnerFullEditorReadonly('params.folder_id'))
    async getFolderFiles(
        @Param('folder_id', ParseIntPipe) folderId: number,
        @JwtUser() user: JwtUserInterface
    ): Promise<TaskAttachmentEntity[]> {
        return await this.service.getFolderFiles(folderId, user);
    }

    @Post('import')
    @ApiOperation({summary: 'Import folders and tasks from Wrike Excel'})
    @ApiQuery({name: 'folder_id', required: false, type: Number, description: 'Parent folder id (optional)'})
    @ApiConsumes('multipart/form-data')
    @ApiBody({description: 'Excel file with Wrike folders and tasks', type: FileUploadDto})
    @UseInterceptors(FileInterceptor('file'))
    @CheckPolicies(folderPolicies.OwnerFullEditor('query.folder_id'))
    async importTasks(
        @UploadedFile() file: Express.Multer.File,
        @Body('data') data: string,
        @Query('folder_id') folder_id: number,
        @JwtUser() user: JwtUserInterface
    ): Promise<boolean> {
        return await this.service.importFolderTasks(file, JSON.parse(data) as ImportTasksFromExcelDto, folder_id, user);
    }

    // TODO : Add return type
    @Get(':folder_id/files/last_added')
    @ApiOperation({summary: 'Get the last 5 files uploaded to a specific folder'})
    @ApiParam({name: 'folder_id', required: true, type: Number, description: 'folder id'})
    @CheckPolicies(folderPolicies.Read('params.folder_id'))
    async getLastAddedFiles(@Param('folder_id', ParseIntPipe) folder_id: number): Promise<TaskAttachmentEntity[]> {
        return await this.service.getLastAddedFiles(folder_id);
    }

    //** Todo : Add test cases */
    @Get('multi-file-download')
    @ApiOperation({summary: 'download multiple selected files at once'})
    @ApiQuery({
        required: true,
        type: Number,
        isArray: true,
        style: 'simple',
        description: 'List of files id to download',
        name: 'ids',
    })
    @ApiQuery({
        required: true,
        type: Number,
        style: 'simple',
        description: 'folder id to download files',
        name: 'folder_id',
    })
    @CheckPolicies(folderPolicies.Read('query.folderId'))
    async downloadMultipleFiles(
        @Query('ids', ParseArrayIntPipe) ids: number[],
        @Query('folderId', ParseIntPipe) folderId: number,
        @JwtUser() user: JwtUserInterface
    ): Promise<Buffer> {
        return await this.service.downloadMultipleFiles(ids, folderId, user);
    }

    @Get(':folder_id')
    @ApiOperation({description: 'Get folder by id'})
    @ApiParam({name: 'folder_id', required: true, type: Number, description: 'Folder id'})
    @ApiQuery({
        name: 'show-on',
        required: false,
        type: String,
        description: `Filter folders by show on property. Default value: "${TASK_MANAGEMENT}"`,
    })
    @ApiQuery({
        name: 'show-archived',
        required: false,
        type: Boolean,
        description: `Get Archive Folders`,
    })
    @CheckPolicies(folderPolicies.OwnerFullEditorReadonly('params.folder_id'))
    async getOne(
        @Param('folder_id', ParseIntPipe) folderId: number,
        @Query('shown-on') showOn: string = TASK_MANAGEMENT,
        @Query('show-archived') showArchived = false,
        @JwtUser() user: JwtUserInterface
    ): Promise<GetFolderDto> {
        return await this.service.findOne(folderId, showOn, user.id, showArchived);
    }
}
