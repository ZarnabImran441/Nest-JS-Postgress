import {CheckPolicies, JwtAuthGuard, PoliciesGuard, contructorLogger} from '@lib/base-library';
import {Body, Controller, Delete, Get, Param, Patch, Post, UseGuards} from '@nestjs/common';
import {ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiTags} from '@nestjs/swagger';
import {InsertResult, UpdateResult} from 'typeorm';
import {CreateCustomFieldValueDto} from '../../dto/custom-field/create-custom-field-value.dto';
import {UpdateCustomFieldValueDto} from '../../dto/custom-field/update-custom-field-value.dto';
import {CustomFieldValueEntity} from '../../model/custom-field-value.entity';
import {customFieldValuePolicies, folderPolicies} from '../../policy/policy-consts';
import {CustomFieldValueService} from './custom-field-value.service';

@ApiTags('Custom Field Value')
@Controller('custom-field-value')
@UseGuards(JwtAuthGuard, PoliciesGuard)
@ApiBearerAuth()
export class CustomFieldValueController {
    constructor(public service: CustomFieldValueService) {
        contructorLogger(this);
    }

    @ApiOperation({summary: 'Get single custom field value by id'})
    @ApiParam({name: 'id', required: true, type: 'number', description: 'Custom field id'})
    @Get(':id')
    @CheckPolicies(customFieldValuePolicies.Read(), customFieldValuePolicies.ReadCustomFieldValue())
    async getById(@Param('id') id: number): Promise<CustomFieldValueEntity> {
        return await this.service.get(id);
    }

    @ApiOperation({summary: 'Create a custom field value'})
    @ApiBody({type: CreateCustomFieldValueDto, required: true})
    @Post()
    @CheckPolicies(customFieldValuePolicies.Create(), folderPolicies.Owner('body.folderId'))
    async createOne(@Body() dto: CreateCustomFieldValueDto): Promise<InsertResult> {
        return await this.service.create(dto);
    }

    @ApiOperation({summary: 'update a custom field value'})
    @ApiBody({type: UpdateCustomFieldValueDto, required: true})
    @ApiParam({name: 'id', required: true, type: 'number', description: 'Custom field id'})
    @Patch(':id')
    @CheckPolicies(customFieldValuePolicies.Update())
    async updateOne(@Param('id') id: number, @Body() dto: UpdateCustomFieldValueDto): Promise<UpdateResult> {
        return await this.service.update(id, dto);
    }

    @ApiOperation({summary: 'Delete a custom field value by id'})
    @ApiParam({name: 'id', required: true, type: 'number', description: 'Custom field id'})
    @Delete(':id')
    @CheckPolicies(customFieldValuePolicies.Delete())
    async deleteOne(@Param('id') id: number): Promise<CustomFieldValueEntity> {
        return await this.service.delete(id);
    }
}
