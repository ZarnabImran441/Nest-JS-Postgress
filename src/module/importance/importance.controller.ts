import {Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards} from '@nestjs/common';
import {ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiTags} from '@nestjs/swagger';
import {ImportanceService} from './importance.service';
import {CheckPolicies, contructorLogger, JwtAuthGuard, JwtUser, JwtUserInterface, PoliciesGuard} from '@lib/base-library';
import {DeleteResult, InsertResult, UpdateResult} from 'typeorm';
import {importancePolicies} from '../../policy/policy-consts';
import {ImportanceEntity} from '../../model/importance.entity';
import {UpdateImportanceDto} from '../../dto/importance/update-importance.dto';
import {CreateImportanceDto} from '../../dto/importance/create-importance.dto';
import {UpdateImportancePositionDto} from '../../dto/importance/update-importance-position.dto';

/**
 * Controller for handling Importance-related operations.
 *
 * @class
 * @name ImportanceController
 * @apiTags Importance
 * @path importance
 */
@ApiTags('Importance')
@Controller('importance')
@UseGuards(JwtAuthGuard, PoliciesGuard)
@ApiBearerAuth()
export class ImportanceController {
    /**
     * Creates an instance of the constructor.
     * @param {ImportanceService} service - The ImportanceService instance.
     */
    constructor(public service: ImportanceService) {
        contructorLogger(this);
    }

    //** Task read and importance read */
    /**
     * Retrieves all importance entities.
     *
     * @returns {Promise<ImportanceEntity[]>} A promise that resolves to an array of ImportanceEntity.
     *
     * @throws {Error} If an error occurs while retrieving the importance entities.
     */
    @ApiOperation({summary: 'get all importance'})
    @Get()
    @CheckPolicies(importancePolicies.Read())
    async getImportance(): Promise<ImportanceEntity[]> {
        return await this.service.getAll();
    }

    //** Task read,update and  importance create */
    /**
     * Create a new importance.
     *
     * @param {CreateImportanceDto} dto - The importance object to create.
     * @param {JwtUserInterface} user - The user object containing JWT data.
     * @return {Promise<InsertResult>} The result of the create operation.
     */
    @ApiOperation({summary: 'create a new importance'})
    @ApiBody({required: true, type: UpdateImportanceDto, description: 'An importance'})
    @Post()
    @CheckPolicies(importancePolicies.Create())
    async create(@Body() dto: CreateImportanceDto, @JwtUser() user: JwtUserInterface): Promise<InsertResult> {
        return await this.service.createOne(dto, user);
    }

    //** Task read,update and importance update */s
    /**
     * Updates an importance.
     *
     * @summary Update a new importance.
     * @param {number} id - The importance id.
     * @param {UpdateImportanceDto} dto - An object containing the updated importance information.
     * @param {JwtUserInterface} user - The authenticated user.
     * @returns {Promise<UpdateResult>} - A Promise that resolves to the update result.
     */
    @ApiOperation({summary: 'update a new importance'})
    @ApiParam({name: 'id', required: true, type: 'number', description: 'importance id'})
    @ApiBody({required: true, type: UpdateImportanceDto, description: 'An importance'})
    @Patch(':id')
    @CheckPolicies(importancePolicies.Update())
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateImportanceDto,
        @JwtUser() user: JwtUserInterface
    ): Promise<UpdateResult> {
        return await this.service.updateOne(id, dto, user);
    }

    //** Task read,update and  importance delete */
    /**
     * Deletes an importance by id.
     *
     * @param {number} id - The id of the importance to be deleted.
     * @returns {Promise<DeleteResult>} - A Promise that resolves to the DeleteResult object.
     */
    @ApiOperation({summary: 'delete an importance'})
    @ApiParam({name: 'id', required: true, type: 'number', description: 'importance id'})
    @Delete(':id')
    @CheckPolicies(importancePolicies.Delete())
    async delete(@Param('id', ParseIntPipe) id: number): Promise<DeleteResult> {
        return await this.service.deleteOne(id);
    }

    //** Task read,update and importance update */s
    /**
     * Update Importance position.
     *
     * @param {number} id - Importance id to update position/column.
     * @param {UpdateImportancePositionDto} dto - Folder new position.
     *
     * @returns {Promise<ImportanceEntity[]>} - Promise that resolves to an array of ImportanceEntity objects.
     */
    @Patch('position/:id')
    @ApiOperation({summary: 'Update Importance position'})
    @ApiParam({name: 'id', required: true, type: Number, description: 'importance id to update position/column'})
    @ApiBody({description: 'Folder new position', type: UpdateImportancePositionDto})
    @CheckPolicies(importancePolicies.Update())
    async updateImportancePosition(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateImportancePositionDto
    ): Promise<ImportanceEntity[]> {
        return await this.service.updatePosition(id, dto);
    }
}
