import {Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards} from '@nestjs/common';
import {ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiTags} from '@nestjs/swagger';
import {FolderFilterService} from './folder-filter.service';
import {CheckPolicies, contructorLogger, JwtAuthGuard, PoliciesGuard} from '@lib/base-library';
import {DeleteResult, InsertResult, UpdateResult} from 'typeorm';
import {folderFilterPolicies, folderPolicies} from '../../../policy/policy-consts';
import {FolderFilterEntity} from '../../../model/folder-filter.entity';
import {CreateFolderFilterDto} from '../../../dto/folder/filter/create-folder-filter.dto';
import {UpdateFolderFilterDto} from '../../../dto/folder/filter/update-folder-filter.dto';

//** Uncomment these policies once grant and revoke implements */
@ApiTags('Folder Filter')
@Controller('folder-filter')
@UseGuards(JwtAuthGuard, PoliciesGuard)
@ApiBearerAuth()
export class FolderFilterController {
    constructor(protected readonly service: FolderFilterService) {
        contructorLogger(this);
    }

    //anyone that can access a folder can see the filters
    //PEOPLE WITH OWNER | EDITOR | FULL PERMISSIONS ON FOLDER CAN CREATE FOLDER FILTERS .
    @ApiOperation({summary: 'Get folder filters'})
    @ApiParam({name: 'folder_id', required: true, type: Number, description: 'Folder id'})
    @CheckPolicies(folderFilterPolicies.Read(), folderPolicies.OwnerFullEditorReadonly('params.folder_id'))
    @Get(':folder_id')
    async get(@Param('folder_id', ParseIntPipe) folderId: number): Promise<FolderFilterEntity[]> {
        return await this.service.getOneByFolderId(folderId);
    }

    @ApiOperation({summary: 'Create folder filters'})
    @ApiParam({name: 'folder_id', required: true, type: Number, description: 'Folder id'})
    @ApiBody({type: CreateFolderFilterDto, description: 'Filter definition'})
    @CheckPolicies(folderFilterPolicies.Create(), folderPolicies.OwnerFullEditor('params.folder_id'))
    @Post(':folder_id')
    async create(@Param('folder_id', ParseIntPipe) folderId: number, @Body() dto: CreateFolderFilterDto): Promise<InsertResult> {
        return await this.service.create(folderId, dto);
    }

    //Todo : Add folder id in body from UI
    @ApiOperation({summary: 'Update a single folder filter'})
    @ApiParam({name: 'id', required: true, type: Number, description: 'Filter id'})
    @ApiBody({type: UpdateFolderFilterDto, description: 'Filter definition'})
    @CheckPolicies(folderFilterPolicies.Update(), folderPolicies.OwnerFullEditor('params.folder_id'))
    @Patch(':id/folder/:folder_id')
    async update(
        @Param('id', ParseIntPipe) folderFilterId: number,
        @Param('folder_id', ParseIntPipe) folderId: number,
        @Body() dto: UpdateFolderFilterDto
    ): Promise<UpdateResult> {
        return await this.service.update(folderFilterId, folderId, dto);
    }

    //Todo :Update the routes from UI
    @ApiOperation({summary: 'Delete folder filter by id'})
    @ApiParam({name: 'id', required: true, type: Number, description: 'Filter id'})
    @Delete(':id/folder/:folder_id')
    @CheckPolicies(folderFilterPolicies.Delete(), folderPolicies.OwnerFullEditor('params.folder_id'))
    async delete(@Param('id', ParseIntPipe) folderFilterId: number): Promise<DeleteResult> {
        return await this.service.delete(folderFilterId);
    }
}
