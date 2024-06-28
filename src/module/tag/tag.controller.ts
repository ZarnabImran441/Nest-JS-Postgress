import {Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards} from '@nestjs/common';
import {ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags} from '@nestjs/swagger';
import {CheckPolicies, contructorLogger, JwtAuthGuard, JwtUser, JwtUserInterface, PoliciesGuard} from '@lib/base-library';
import {DeleteResult, UpdateResult} from 'typeorm';
import {TagService} from './tag.service';
import {commonTagPolicies, userTagPolicies} from '../../policy/policy-consts';
import {CreateTagDto} from '../../dto/tag/create-tag.dto';
import {UpdateTagDto} from '../../dto/tag/update-tag.dto';
import {TagResponseDto} from '../../dto/tag/tag-response.dto';

//** Need's modifications on UI : When user tries to add usertag the route will be "[POST] /per-user" */
@ApiTags('Tags')
@Controller('/tags')
@UseGuards(JwtAuthGuard, PoliciesGuard)
@ApiBearerAuth()
export class TagController {
    constructor(protected readonly service: TagService) {
        contructorLogger(this);
    }

    @ApiOperation({summary: 'Delete a common tag'})
    @ApiParam({name: 'id', required: true, type: 'number', description: 'Tag id'})
    @Delete(':id')
    @CheckPolicies(commonTagPolicies.Delete())
    async deleteCommonTag(@Param('id', ParseIntPipe) id: number): Promise<DeleteResult> {
        return await this.service.delete(id);
    }

    @ApiOperation({summary: 'Delete a tag for the current user'})
    @ApiParam({name: 'id', required: true, type: 'number', description: 'Tag id'})
    @Delete('per-user/:id')
    @CheckPolicies(userTagPolicies.Delete())
    async deleteUserTag(@Param('id', ParseIntPipe) id: number, @JwtUser() user: JwtUserInterface): Promise<DeleteResult> {
        return await this.service.delete(id, user.id);
    }

    @ApiOperation({summary: 'Get all tags'})
    @Get()
    @CheckPolicies(commonTagPolicies.Read())
    @ApiResponse({status: 200, type: TagResponseDto, isArray: true})
    async getManyCommonTags(): Promise<TagResponseDto[]> {
        return await this.service.getMany();
    }

    @Get('per-user')
    @ApiOperation({summary: 'Get all tag for the user'})
    @CheckPolicies(userTagPolicies.Read())
    @ApiResponse({status: 200, type: TagResponseDto, isArray: true})
    async getManyUserTags(@JwtUser() user: JwtUserInterface): Promise<TagResponseDto[]> {
        return await this.service.getMany(user.id);
    }

    @ApiOperation({summary: 'create a new tag'})
    @Post()
    @CheckPolicies(commonTagPolicies.Create())
    async createCommonTag(@Body() dto: CreateTagDto, @JwtUser() user: JwtUserInterface): Promise<TagResponseDto> {
        return await this.service.create(dto, user.id, true);
    }

    //todo : For update we should have update tag dto
    @ApiParam({name: 'id', required: true, type: 'number', description: 'Tag id'})
    @ApiBody({required: true, type: UpdateTagDto, description: 'A tag'})
    @Patch(':id')
    @CheckPolicies(commonTagPolicies.Update())
    async updateCommonTag(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateTagDto,
        @JwtUser() user: JwtUserInterface
    ): Promise<UpdateResult> {
        return await this.service.update(id, dto, user.id, true);
    }

    @ApiParam({name: 'id', required: true, type: 'number', description: 'Tag id'})
    @ApiBody({required: true, type: UpdateTagDto, description: 'A tag'})
    @Patch('per-user/:id')
    @CheckPolicies(userTagPolicies.Update())
    async updateUserTag(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateTagDto,
        @JwtUser() user: JwtUserInterface
    ): Promise<UpdateResult> {
        return await this.service.update(id, dto, user.id);
    }

    @Post('per-user')
    @ApiOperation({summary: 'Create a tag only for the user'})
    @ApiBody({required: true, type: CreateTagDto, description: 'A tag'})
    @CheckPolicies(userTagPolicies.Create())
    async createUserTag(@Body() dto: CreateTagDto, @JwtUser() user: JwtUserInterface): Promise<TagResponseDto> {
        return await this.service.create(dto, user.id);
    }
}
