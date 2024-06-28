import {Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards} from '@nestjs/common';
import {ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiTags} from '@nestjs/swagger';
import {CheckPolicies, contructorLogger, JwtAuthGuard, JwtUser, JwtUserInterface, PoliciesGuard} from '@lib/base-library';
import {tagsCollectionPolicies} from '../../policy/policy-consts';
import {TagCollectionService} from './tags-collection.service';
import {GetTagCollectionDto} from '../../dto/tag-collection/get-tag-collection.dto';
import {CreateTagCollectionDto} from '../../dto/tag-collection/create-tag-collection.dto';
import {DeleteResult, InsertResult, UpdateResult} from 'typeorm';
import {UpdateTagCollectionDto} from '../../dto/tag-collection/update-tag-colleciton.dto';

@ApiTags('Tag Collection')
@Controller('tag-collection')
@UseGuards(JwtAuthGuard, PoliciesGuard)
@ApiBearerAuth()
export class TagCollectionController {
    constructor(public service: TagCollectionService) {
        contructorLogger(this);
    }

    @ApiOperation({summary: 'get all tag collections'})
    @Get()
    @CheckPolicies(tagsCollectionPolicies.Read())
    async getCustomFieldCollections(): Promise<GetTagCollectionDto[]> {
        return await this.service.getAll();
    }

    @ApiOperation({summary: 'create a new tag collection group'})
    @ApiBody({required: true, type: CreateTagCollectionDto, description: 'A Tag Collection'})
    @Post()
    @CheckPolicies(tagsCollectionPolicies.Create())
    async create(@Body() dto: CreateTagCollectionDto, @JwtUser() user: JwtUserInterface): Promise<InsertResult> {
        return await this.service.createOne(dto, user.id);
    }

    @ApiOperation({summary: 'updates a new tag collection group'})
    @ApiBody({required: true, type: UpdateTagCollectionDto, description: 'A Tag Collection'})
    @ApiParam({name: 'id', required: true, type: 'number', description: 'Tag Collection id'})
    @Patch(':id')
    @CheckPolicies(tagsCollectionPolicies.Update())
    async update(
        @Body() dto: UpdateTagCollectionDto,
        @Param('id', ParseIntPipe) id: number,
        @JwtUser() user: JwtUserInterface
    ): Promise<UpdateResult> {
        return await this.service.updateOne(dto, user.id, id);
    }

    @ApiOperation({summary: 'delete a tag collection'})
    @ApiParam({name: 'id', required: true, type: 'number', description: 'Tag collection id'})
    @Delete(':id')
    @CheckPolicies(tagsCollectionPolicies.Delete())
    async delete(@Param('id', ParseIntPipe) id: number): Promise<DeleteResult> {
        return await this.service.deleteOne(id);
    }
}
