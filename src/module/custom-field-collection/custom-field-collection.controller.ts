import {Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards} from '@nestjs/common';
import {ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiTags} from '@nestjs/swagger';
import {CheckPolicies, contructorLogger, JwtAuthGuard, JwtUser, JwtUserInterface, PoliciesGuard} from '@lib/base-library';
import {DeleteResult, InsertResult, UpdateResult} from 'typeorm';
import {customFieldCollection} from '../../policy/policy-consts';
import {CustomFieldCollectionService} from './custom-field-collection..service';
import {CreateCustomFieldCollectionDto} from '../../dto/custom-field-collection/create-custom-field-collection.dto';
import {GetCustomFieldCollectionDto} from '../../dto/custom-field-collection/get-custom-field-collection.dto';
import {UpdateCustomFieldCollectionDto} from '../../dto/custom-field-collection/update-custom-field-colleciton.dto';

@ApiTags('Custom Field Collection')
@Controller('custom-field-collection')
@UseGuards(JwtAuthGuard, PoliciesGuard)
@ApiBearerAuth()
export class CustomFieldCollectionController {
    constructor(public service: CustomFieldCollectionService) {
        contructorLogger(this);
    }

    @ApiOperation({summary: 'get all custom field collections'})
    @Get()
    @CheckPolicies(customFieldCollection.Read())
    async getCustomFieldCollections(): Promise<GetCustomFieldCollectionDto[]> {
        return await this.service.getAll();
    }

    @ApiOperation({summary: 'create a new custom field group'})
    @ApiBody({required: true, type: CreateCustomFieldCollectionDto, description: 'An Custom Field Collection'})
    @Post()
    @CheckPolicies(customFieldCollection.Create())
    async create(@Body() dto: CreateCustomFieldCollectionDto, @JwtUser() user: JwtUserInterface): Promise<InsertResult> {
        return await this.service.createOne(dto, user.id);
    }

    @ApiOperation({summary: 'updates a new custom field group'})
    @ApiBody({required: true, type: UpdateCustomFieldCollectionDto, description: 'An Custom Field Collection'})
    @ApiParam({name: 'id', required: true, type: 'number', description: 'Custom field collection id'})
    @Patch(':id')
    @CheckPolicies(customFieldCollection.Update())
    async update(
        @Body() dto: UpdateCustomFieldCollectionDto,
        @Param('id', ParseIntPipe) id: number,
        @JwtUser() user: JwtUserInterface
    ): Promise<UpdateResult> {
        return await this.service.updateOne(dto, user.id, id);
    }

    @ApiOperation({summary: 'delete an custom field collection group'})
    @ApiParam({name: 'id', required: true, type: 'number', description: 'Custom field collection id'})
    @Delete(':id')
    @CheckPolicies(customFieldCollection.Delete())
    async delete(@Param('id', ParseIntPipe) id: number): Promise<DeleteResult> {
        return await this.service.deleteOne(id);
    }
}
