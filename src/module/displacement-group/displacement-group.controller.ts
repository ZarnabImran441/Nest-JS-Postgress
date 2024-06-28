import {Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards} from '@nestjs/common';
import {ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiTags} from '@nestjs/swagger';
import {DisplacementGroupService} from './displacement-group.service';
import {CheckPolicies, contructorLogger, JwtAuthGuard, PoliciesGuard} from '@lib/base-library';
import {DeleteResult, InsertResult, UpdateResult} from 'typeorm';
import {displacementGroupPolicies} from '../../policy/policy-consts';
import {CreateDisplacementGroupDto} from '../../dto/displacement-group/create-displacement-group.dto';
import {UpdateDisplacementGroupDto} from '../../dto/displacement-group/update-displacement-group.dto';
import {CreateDisplacementCodeDto} from '../../dto/displacement-group/create-displacement-code.dto';
import {UpdateDisplacementCodeDto} from '../../dto/displacement-group/update-displacement-code.dto';
import {DisplacementCodeResponseDto} from '../../dto/displacement-group/displacement-code-response.dto';
import {DisplacementGroupResponseDto} from '../../dto/displacement-group/displacement-group-response.dto';
import {SystemStageEntity} from '../../model/system-stage.entity';

@ApiTags('Displacement Group')
@Controller('displacement-group')
@UseGuards(JwtAuthGuard, PoliciesGuard)
@ApiBearerAuth()
export class DisplacementGroupController {
    constructor(public service: DisplacementGroupService) {
        contructorLogger(this);
    }

    //** Get All system stage */
    //** Discuss policies with Julio */
    @ApiOperation({summary: 'get all system stage'})
    @Get('/system-stage')
    @CheckPolicies(displacementGroupPolicies.Read())
    async getAllSystemStage(): Promise<SystemStageEntity[]> {
        return await this.service.getAllSystemStage();
    }

    @ApiOperation({summary: 'get one displacement code'})
    @Get(':group_id/code/:code_id')
    @ApiParam({name: 'group_id', required: true, type: 'number', description: 'displacement group id'})
    @ApiParam({name: 'code_id', required: true, type: 'number', description: 'displacement code id'})
    @CheckPolicies(displacementGroupPolicies.Read())
    async getDisplacementCode(
        @Param('group_id', ParseIntPipe) groupId: number,
        @Param('code_id', ParseIntPipe) codeId: number
    ): Promise<DisplacementCodeResponseDto> {
        return await this.service.getOneCode(groupId, codeId);
    }

    @ApiOperation({summary: 'create a new displacement code'})
    @ApiBody({required: true, type: CreateDisplacementCodeDto, description: 'An displacement code'})
    @Post(':group_id/code')
    @ApiParam({name: 'group_id', required: true, type: 'number', description: 'displacement group id'})
    @CheckPolicies(displacementGroupPolicies.Create())
    async createDisplacementCode(
        @Param('group_id', ParseIntPipe) groupId: number,
        @Body() dto: CreateDisplacementCodeDto
    ): Promise<InsertResult> {
        return await this.service.createOneCode(groupId, dto);
    }

    @ApiOperation({summary: 'update a displacement code'})
    @Patch(':group_id/code/:code_id')
    @ApiParam({name: 'group_id', required: true, type: 'number', description: 'displacement group id'})
    @ApiParam({name: 'code_id', required: true, type: 'number', description: 'displacement code id'})
    @ApiBody({required: true, type: UpdateDisplacementCodeDto, description: 'An displacement code'})
    @CheckPolicies(displacementGroupPolicies.Update())
    async updateDisplacementCode(
        @Param('group_id', ParseIntPipe) groupId: number,
        @Param('code_id', ParseIntPipe) codeId: number,
        @Body() dto: UpdateDisplacementCodeDto
    ): Promise<UpdateResult> {
        return await this.service.updateOneCode(groupId, codeId, dto);
    }

    @ApiOperation({summary: 'delete an displacement code'})
    @Delete(':group_id/code/:code_id')
    @ApiParam({name: 'group_id', required: true, type: 'number', description: 'displacement group id'})
    @ApiParam({name: 'code_id', required: true, type: 'number', description: 'displacement code id'})
    @CheckPolicies(displacementGroupPolicies.Delete())
    async deleteDisplacementCode(
        @Param('group_id', ParseIntPipe) groupId: number,
        @Param('code_id', ParseIntPipe) codeId: number
    ): Promise<DeleteResult> {
        return await this.service.deleteOneCode(groupId, codeId);
    }

    @ApiOperation({summary: 'get one displacement group with its codes'})
    @Get(':group_id')
    @ApiParam({name: 'group_id', required: true, type: Number, description: 'Displacement group id'})
    @CheckPolicies(displacementGroupPolicies.Read())
    async getDisplacementGroup(@Param('group_id', ParseIntPipe) id: number): Promise<DisplacementGroupResponseDto> {
        return await this.service.getOne(id);
    }

    @ApiOperation({summary: 'get all displacement groups with their codes'})
    @Get()
    @CheckPolicies(displacementGroupPolicies.Read())
    async getAllDisplacementGroup(): Promise<DisplacementGroupResponseDto[]> {
        return await this.service.getAll();
    }

    @ApiOperation({summary: 'create a new displacement group'})
    @ApiBody({required: true, type: CreateDisplacementGroupDto, description: 'An displacement group'})
    @Post()
    @CheckPolicies(displacementGroupPolicies.Create())
    async create(@Body() dto: CreateDisplacementGroupDto): Promise<InsertResult> {
        return await this.service.createOne(dto);
    }

    @ApiOperation({summary: 'update a displacement group'})
    @ApiParam({name: 'id', required: true, type: 'number', description: 'displacement group id'})
    @ApiBody({required: true, type: UpdateDisplacementGroupDto, description: 'An displacement group'})
    @Patch(':id')
    @CheckPolicies(displacementGroupPolicies.Update())
    async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDisplacementGroupDto): Promise<UpdateResult> {
        return await this.service.updateOne(id, dto);
    }

    @ApiOperation({summary: 'delete an displacement group'})
    @ApiParam({name: 'id', required: true, type: 'number', description: 'displacement group id'})
    @Delete(':id')
    @CheckPolicies(displacementGroupPolicies.Delete())
    async delete(@Param('id', ParseIntPipe) id: number): Promise<DeleteResult> {
        return await this.service.deleteOne(id);
    }
}
