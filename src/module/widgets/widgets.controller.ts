import {Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, ParseIntPipe, HttpStatus} from '@nestjs/common';
import {WidgetsService} from './widgets.service';
import {ApiBearerAuth, ApiBody, ApiResponse, ApiOperation, ApiParam, ApiTags} from '@nestjs/swagger';
import {CheckPolicies, JwtAuthGuard, JwtUser, JwtUserInterface, PoliciesGuard} from '@lib/base-library';
import {WidgetCategoryDto, UpdateWidgetCategoryDto, CreateWidgetCategoryDto} from '../../dto/widget/widget-category.dto';
import {WidgetTypesDto, UpdateWidgetTypeDto, CreateWidgetTypesDto} from '../../dto/widget/widget-types.dto';
import {dashboardPolicy, folderPolicies, widgetPolicy} from '../../policy/policy-consts';
import {
    CreateWidgetDto,
    GetFilteredWidgetDto,
    UpdateWidgetDto,
    WidgetDto,
    WidgetProgressCountDto,
    WidgetStatsCountDto,
} from '../../dto/widget/widget.dto';
import {WidgetTaskDto} from '../../dto/widget/widget-task-dto';
import {ApprovalEntity} from '../../model/approval.entity';
import {ApprovalEntityResponseDto} from '../../dto/approval/approval-entity-response.dto';
import {CustomFieldDefinitionEntity} from '../../model/custom-field-definition.entity';

@Controller('widgets')
@ApiTags('Widgets')
@UseGuards(JwtAuthGuard, PoliciesGuard)
@ApiBearerAuth()
export class WidgetsController {
    constructor(private readonly widgetsService: WidgetsService) {}

    @Post('/categories')
    @ApiBody({description: 'Category data', type: CreateWidgetCategoryDto})
    @CheckPolicies(widgetPolicy.Create())
    @ApiResponse({type: WidgetCategoryDto})
    async createCategory(@Body() createWidgetDto: CreateWidgetCategoryDto): Promise<WidgetCategoryDto> {
        return await this.widgetsService.createWidgetCategory(createWidgetDto);
    }

    @Post('/types')
    @ApiBody({description: 'Type data', type: CreateWidgetTypesDto})
    @CheckPolicies(widgetPolicy.Create())
    @ApiResponse({type: WidgetTypesDto})
    async createTypes(@Body() createTypesDto: CreateWidgetTypesDto): Promise<WidgetTypesDto> {
        return await this.widgetsService.createWidgetType(createTypesDto);
    }

    @Post()
    @ApiBody({description: 'Widget data', type: CreateWidgetDto})
    @CheckPolicies(widgetPolicy.Create(), folderPolicies.Read())
    @ApiResponse({type: WidgetDto})
    async createWidget(@Body() createWidgetDto: CreateWidgetDto, @JwtUser() user: JwtUserInterface): Promise<WidgetDto> {
        return await this.widgetsService.createWidget(createWidgetDto, user.id);
    }

    @Post('/:id/duplicate')
    @CheckPolicies(widgetPolicy.Create(), folderPolicies.Read())
    @ApiResponse({type: WidgetDto})
    async duplicateWidget(@Param('id', ParseIntPipe) id: number, @JwtUser() user: JwtUserInterface): Promise<WidgetDto> {
        return await this.widgetsService.duplicateWidget(id, user.id);
    }

    @Get('/dashboard/:dashboardId')
    @ApiOperation({summary: 'Get all widgets for a dashboard.'})
    @CheckPolicies(widgetPolicy.Read(), dashboardPolicy.OwnerFullEditorReadonly('params.dashboardId'))
    @ApiResponse({type: WidgetCategoryDto})
    async getWidgets(@Param('dashboardId', ParseIntPipe) dashboardId: number): Promise<WidgetDto[]> {
        return await this.widgetsService.getWidgets(dashboardId);
    }

    @Post('/widget-tasks/:id')
    @ApiOperation({summary: 'Get widget tasks.'})
    @ApiParam({name: 'id', description: 'Widget id'})
    @ApiBody({description: 'Widget filter data', type: GetFilteredWidgetDto, required: false})
    @CheckPolicies(widgetPolicy.Read(), folderPolicies.Read())
    @ApiResponse({type: WidgetTaskDto, isArray: true})
    async getWidgetTasks(
        @JwtUser() user: JwtUserInterface,
        @Param('id', ParseIntPipe) id: number,
        @Body() widgetDto: GetFilteredWidgetDto
    ): Promise<WidgetTaskDto[]> {
        return await this.widgetsService.getWidgetTasks(id, widgetDto, user.id);
    }

    @Post('/widget-approvals/:id')
    @ApiOperation({summary: 'Get widget approvals.'})
    @ApiParam({name: 'id', description: 'Widget id'})
    @ApiBody({description: 'Widget filter data', type: GetFilteredWidgetDto, required: false})
    @CheckPolicies(widgetPolicy.Read(), folderPolicies.Read())
    @ApiResponse({type: ApprovalEntity, isArray: true})
    async getWidgetApprovals(
        @JwtUser() user: JwtUserInterface,
        @Param('id', ParseIntPipe) id: number,
        @Body() widgetDto: GetFilteredWidgetDto
    ): Promise<ApprovalEntity[]> {
        return await this.widgetsService.getWidgetApprovals(id, widgetDto, user.id);
    }

    @Post('/new-folders-count/:id')
    @ApiOperation({summary: 'Get widget new folders count.'})
    @ApiParam({name: 'id', description: 'Widget id'})
    @ApiBody({description: 'Widget filter data', type: GetFilteredWidgetDto, required: false})
    @CheckPolicies(widgetPolicy.Read(), folderPolicies.Read())
    @ApiResponse({type: WidgetStatsCountDto})
    async getWidgetNewFoldersCount(
        @JwtUser() user: JwtUserInterface,
        @Param('id', ParseIntPipe) id: number,
        @Body() widgetDto: GetFilteredWidgetDto
    ): Promise<WidgetStatsCountDto> {
        return await this.widgetsService.getWidgetNewFoldersCount(id, widgetDto, user.id);
    }

    @Post('/widget-bar-chart/:id')
    @ApiOperation({summary: 'Get widget tasks.'})
    @ApiParam({name: 'id', description: 'Widget id'})
    @CheckPolicies(widgetPolicy.Read(), folderPolicies.Read())
    @ApiBody({description: 'Widget filter data', type: GetFilteredWidgetDto, required: false})
    @ApiResponse({type: ApprovalEntityResponseDto, isArray: true})
    async getWidgetCustomBarChart(
        @JwtUser() user: JwtUserInterface,
        @Param('id', ParseIntPipe) id: number,
        @Body() widgetDto: GetFilteredWidgetDto
    ): Promise<unknown> {
        return await this.widgetsService.getWidgetCustomChartCounts(id, widgetDto, user.id);
    }

    @Post('/new-tasks-count/:id')
    @ApiOperation({summary: 'Get widget new tasks count.'})
    @ApiParam({name: 'id', description: 'Widget id'})
    @ApiBody({description: 'Widget filter data', type: GetFilteredWidgetDto, required: false})
    @CheckPolicies(widgetPolicy.Read(), folderPolicies.Read())
    @ApiResponse({type: WidgetStatsCountDto})
    async getWidgetNewTasksCount(
        @JwtUser() user: JwtUserInterface,
        @Param('id', ParseIntPipe) id: number,
        @Body() widgetDto: GetFilteredWidgetDto
    ): Promise<WidgetStatsCountDto> {
        return await this.widgetsService.getWidgetNewTasksCount(id, widgetDto, user.id);
    }

    @Post('/completed-tasks-count/:id')
    @ApiOperation({summary: 'Get widget completed tasks count.'})
    @ApiParam({name: 'id', description: 'Widget id'})
    @ApiBody({description: 'Widget filter data', type: GetFilteredWidgetDto, required: false})
    @CheckPolicies(widgetPolicy.Read(), folderPolicies.Read())
    @ApiResponse({type: WidgetStatsCountDto})
    async getWidgetCompletedTasksCount(
        @JwtUser() user: JwtUserInterface,
        @Param('id', ParseIntPipe) id: number,
        @Body() widgetDto: GetFilteredWidgetDto
    ): Promise<WidgetStatsCountDto> {
        return await this.widgetsService.getWidgetCompletedTasksCount(id, widgetDto, user.id);
    }

    @Post('/approvals-count/:id')
    @ApiOperation({summary: 'Get widget new tasks count.'})
    @ApiParam({name: 'id', description: 'Widget id'})
    @ApiBody({description: 'Widget filter data', type: GetFilteredWidgetDto, required: false})
    @CheckPolicies(widgetPolicy.Read(), folderPolicies.Read())
    @ApiResponse({type: WidgetStatsCountDto})
    async getWidgetApprovalsCount(
        @JwtUser() user: JwtUserInterface,
        @Param('id', ParseIntPipe) id: number,
        @Body() widgetDto: GetFilteredWidgetDto
    ): Promise<WidgetStatsCountDto> {
        return await this.widgetsService.getWidgetApprovalsCount(id, widgetDto, user.id);
    }

    @Post('/progress-pie-chart/:id')
    @ApiOperation({summary: 'Get widget tasks count for pie chart.'})
    @ApiParam({name: 'id', description: 'Widget id'})
    @ApiBody({description: 'Widget filter data', type: GetFilteredWidgetDto, required: false})
    @CheckPolicies(widgetPolicy.Read(), folderPolicies.Read())
    @ApiResponse({type: WidgetProgressCountDto, isArray: true})
    async getWidgetProgressCount(
        @JwtUser() user: JwtUserInterface,
        @Param('id', ParseIntPipe) id: number,
        @Body() widgetDto: GetFilteredWidgetDto
    ): Promise<WidgetProgressCountDto[]> {
        return await this.widgetsService.getWidgetProgressCount(id, widgetDto, user.id);
    }

    @Post('/custom-fields')
    @ApiOperation({summary: 'Fetch the custom field definitions for the folders filtered by user'})
    @ApiBody({description: 'Folder Ids', type: Number, isArray: true})
    @CheckPolicies(folderPolicies.Read(), widgetPolicy.Read())
    async getCustomFields(
        @Body() {folderIds}: {folderIds: number[]},
        @JwtUser() user: JwtUserInterface
    ): Promise<CustomFieldDefinitionEntity[]> {
        return await this.widgetsService.getFoldersCustomNumericFields(folderIds, user.id);
    }

    @Post('/attachments-count/:id')
    @ApiOperation({summary: 'Get widget attachments count.'})
    @ApiParam({name: 'id', description: 'Widget id'})
    @ApiBody({description: 'Widget filter data', type: GetFilteredWidgetDto, required: false})
    @CheckPolicies(widgetPolicy.Read(), folderPolicies.Read())
    @ApiResponse({type: WidgetTaskDto, isArray: true})
    async getWidgetAttachmentsCount(
        @JwtUser() user: JwtUserInterface,
        @Param('id', ParseIntPipe) id: number,
        @Body() widgetDto: GetFilteredWidgetDto
    ): Promise<WidgetStatsCountDto> {
        return await this.widgetsService.getWidgetAttachmentsCount(id, widgetDto, user.id);
    }

    @Get('/categories')
    @ApiOperation({summary: 'Get widget categories.'})
    @ApiResponse({type: WidgetCategoryDto, isArray: true})
    @CheckPolicies(widgetPolicy.Read())
    async findAllCategories(): Promise<WidgetCategoryDto[]> {
        return await this.widgetsService.findAllWidgetCategories();
    }

    @Get('/types')
    @ApiOperation({summary: 'Get widget types.'})
    @ApiResponse({type: WidgetTypesDto, isArray: true})
    @CheckPolicies(widgetPolicy.Read())
    async findAllTypes(): Promise<WidgetTypesDto[]> {
        return await this.widgetsService.findAllWidgetTypes();
    }

    @Get('/categories/:id/types')
    @ApiOperation({summary: 'Get widget types by category.'})
    @ApiResponse({type: WidgetTypesDto, isArray: true})
    @CheckPolicies(widgetPolicy.Read())
    async getTypesByCategory(@Param('id', ParseIntPipe) id: number): Promise<WidgetTypesDto[]> {
        return await this.widgetsService.getTypesByCategory(id);
    }

    @Patch('/categories/:id')
    @ApiOperation({summary: 'Update widget category.'})
    @ApiBody({type: UpdateWidgetCategoryDto})
    @ApiResponse({type: WidgetCategoryDto})
    @CheckPolicies(widgetPolicy.Read())
    async updateWidgetCategory(
        @Param('id', ParseIntPipe) id: number,
        @Body() updateWidgetCategoryDto: UpdateWidgetCategoryDto
    ): Promise<WidgetCategoryDto> {
        return await this.widgetsService.updateWidgetCategory(id, updateWidgetCategoryDto);
    }

    @Patch('/types/:id')
    @ApiOperation({summary: 'Update widget types.'})
    @ApiBody({type: UpdateWidgetTypeDto})
    @ApiResponse({type: WidgetTypesDto})
    @CheckPolicies(widgetPolicy.Read())
    async updateWidgetType(
        @Param('id', ParseIntPipe) id: number,
        @Body() updateWidgetTypeDto: UpdateWidgetTypeDto
    ): Promise<WidgetTypesDto> {
        return await this.widgetsService.updateWidgetType(id, updateWidgetTypeDto);
    }

    @Patch('/:id')
    @ApiOperation({summary: 'Update widget.'})
    @ApiBody({type: UpdateWidgetDto})
    @ApiResponse({type: WidgetDto})
    @CheckPolicies(widgetPolicy.Read())
    async updateWidget(
        @Param('id', ParseIntPipe) id: number,
        @Body() updateWidgetTypeDto: UpdateWidgetDto,
        @JwtUser() user: JwtUserInterface
    ): Promise<WidgetTypesDto> {
        return await this.widgetsService.updateWidget(id, updateWidgetTypeDto, user.id);
    }

    @Delete('/categories/:id')
    @ApiParam({name: 'id', description: 'category id', type: Number})
    @ApiResponse({status: HttpStatus.OK})
    @CheckPolicies(widgetPolicy.Read())
    async deleteCategory(@Param('id', ParseIntPipe) id: number): Promise<void> {
        return await this.widgetsService.deleteWidgetCategory(id);
    }

    @Delete('/types/:id')
    @ApiParam({name: 'id', description: 'type id', type: Number})
    @ApiResponse({status: HttpStatus.OK})
    @CheckPolicies(widgetPolicy.Read())
    async deleteType(@Param('id', ParseIntPipe) id: number): Promise<void> {
        return await this.widgetsService.deleteWidgetType(id);
    }

    @Delete('/:id')
    @ApiParam({name: 'id', description: 'Delete widget with id', type: Number})
    @ApiResponse({status: HttpStatus.OK})
    @CheckPolicies(widgetPolicy.Read())
    async deleteWidget(@Param('id', ParseIntPipe) id: number, @JwtUser() user: JwtUserInterface): Promise<void> {
        return await this.widgetsService.deleteWidget(id, user.id);
    }
}
