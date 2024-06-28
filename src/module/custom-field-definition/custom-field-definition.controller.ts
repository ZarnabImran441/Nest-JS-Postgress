import {Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards} from '@nestjs/common';
import {ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags} from '@nestjs/swagger';
import {
    CheckPolicies,
    contructorLogger,
    JwtAuthGuard,
    JwtUser,
    JwtUserInterface,
    ParseBooleanPipeOptional,
    PoliciesGuard,
    ServiceUserCheckPolicies,
} from '@lib/base-library';
import {DeleteResult, InsertResult, UpdateResult} from 'typeorm';
import {CustomFieldDefinitionService} from './custom-field-definition.service';
import {CreateCustomFieldDefinitionDto} from '../../dto/custom-field/create-custom-field-definition.dto';
import {commonCustomFieldPolicies, userCustomFieldPolicies} from '../../policy/policy-consts';
import {UpdateCustomFieldDefinitionDto} from '../../dto/custom-field/update-custom-field-definition.dto';
import {CustomFieldDefinitionDto} from '../../dto/custom-field/custom-field-definition.dto';

@ApiTags('Custom Field Definition')
@Controller('custom-field-definition')
@UseGuards(JwtAuthGuard, PoliciesGuard)
@ApiBearerAuth()
export class CustomFieldDefinitionController {
    constructor(public service: CustomFieldDefinitionService) {
        contructorLogger(this);
    }

    @ApiOperation({summary: 'Create a common custom field'})
    @ApiBody({type: CreateCustomFieldDefinitionDto, required: true})
    @Post()
    @ServiceUserCheckPolicies(commonCustomFieldPolicies.Create())
    async createCommonCustomField(@Body() dto: CreateCustomFieldDefinitionDto, @JwtUser() user: JwtUserInterface): Promise<InsertResult> {
        return await this.service.createCustomField(dto, user.id, true);
    }

    @ApiOperation({summary: 'Create a custom field for the current user'})
    @ApiBody({type: CreateCustomFieldDefinitionDto, required: true})
    @Post('per-user')
    @CheckPolicies(userCustomFieldPolicies.Create())
    async createUserCustomField(@Body() dto: CreateCustomFieldDefinitionDto, @JwtUser() user: JwtUserInterface): Promise<InsertResult> {
        return await this.service.createCustomField(dto, user.id);
    }

    @ApiOperation({summary: 'Get all common custom fields'})
    @Get()
    @ApiQuery({
        name: 'show-inactive',
        required: false,
        description: 'Show inactive custom fields',
        type: Boolean,
    })
    @CheckPolicies(commonCustomFieldPolicies.Read())
    @ApiResponse({status: 200, type: CustomFieldDefinitionDto, isArray: true})
    async getCommonCustomField(
        @Query('show-inactive', ParseBooleanPipeOptional) showInactive: boolean
    ): Promise<CustomFieldDefinitionDto[]> {
        return await this.service.getCustomField(showInactive);
    }

    @ApiOperation({summary: 'Get all custom fields for the current user'})
    @Get('per-user')
    @ApiQuery({
        name: 'show-inactive',
        required: false,
        description: 'Show inactive custom fields',
        type: Boolean,
    })
    @CheckPolicies(userCustomFieldPolicies.Read())
    @ApiResponse({status: 200, type: CustomFieldDefinitionDto, isArray: true})
    async getUserCustomField(
        @JwtUser() user: JwtUserInterface,
        @Query('show-inactive', ParseBooleanPipeOptional) showInactive: boolean
    ): Promise<CustomFieldDefinitionDto[]> {
        return await this.service.getCustomField(showInactive, user.id);
    }

    @ApiOperation({summary: 'Update a custom field for the current user'})
    @ApiBody({type: UpdateCustomFieldDefinitionDto, required: true})
    @ApiParam({name: 'id', required: true, type: 'number', description: 'Custom field id'})
    @Patch('per-user/:id')
    @CheckPolicies(userCustomFieldPolicies.Update())
    async updateUserCustomField(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateCustomFieldDefinitionDto,
        @JwtUser() user: JwtUserInterface
    ): Promise<UpdateResult> {
        return await this.service.updateCustomField(id, dto, user.id);
    }

    @ApiOperation({summary: 'Update a common custom field'})
    @ApiBody({type: UpdateCustomFieldDefinitionDto, required: true})
    @ApiParam({name: 'id', required: true, type: 'number', description: 'Custom field id'})
    @Patch(':id')
    @CheckPolicies(commonCustomFieldPolicies.Update())
    async updateCommonCustomField(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateCustomFieldDefinitionDto,
        @JwtUser() user: JwtUserInterface
    ): Promise<UpdateResult> {
        return await this.service.updateCustomField(id, dto, user.id, true);
    }

    @ApiOperation({summary: 'Delete a custom field for the current user'})
    @ApiParam({name: 'id', required: true, type: 'number', description: 'Custom field id'})
    @Delete('per-user/:id')
    @CheckPolicies(userCustomFieldPolicies.Delete())
    async deleteUserCustomField(@Param('id', ParseIntPipe) id: number, @JwtUser() user: JwtUserInterface): Promise<DeleteResult> {
        return await this.service.deleteCustomField(id, user.id);
    }

    @ApiOperation({summary: 'Delete a common custom field'})
    @ApiParam({name: 'id', required: true, type: 'number', description: 'Custom field id'})
    @Delete(':id')
    @CheckPolicies(commonCustomFieldPolicies.Delete())
    async deleteCommonCustomField(@Param('id', ParseIntPipe) id: number): Promise<DeleteResult> {
        return await this.service.deleteCustomField(id);
    }

    @Patch('convert-per-user/:id')
    @ApiOperation({summary: 'Converts a Common custom field to Personal'})
    @ApiParam({name: 'id', required: true, type: 'number', description: 'Custom field id'})
    @CheckPolicies(commonCustomFieldPolicies.Delete(), userCustomFieldPolicies.Create())
    async convertCustomFieldCommonToUser(@Param('id') id: number, @JwtUser() user: JwtUserInterface): Promise<UpdateResult> {
        return await this.service.convertCommonToUserCustomField(id, user.id);
    }

    @Patch('convert-common/:id')
    @ApiOperation({summary: 'Converts a Personal custom field to Common'})
    @ApiParam({name: 'id', required: true, type: 'number', description: 'Custom field id'})
    @CheckPolicies(commonCustomFieldPolicies.Create(), userCustomFieldPolicies.Delete())
    async convertCustomFieldUserToCommon(@Param('id') id: number, @JwtUser() user: JwtUserInterface): Promise<UpdateResult> {
        return await this.service.convertUserToCommonCustomField(id, user.id);
    }
}
