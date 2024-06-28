import {Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, UseGuards} from '@nestjs/common';
import {ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiParam, ApiTags} from '@nestjs/swagger';
import {CheckPolicies, contructorLogger, JwtAuthGuard, JwtUser, JwtUserInterface, PoliciesGuard} from '@lib/base-library';
import {dashboardPolicy} from '../../policy/policy-consts';
import {DashboardService} from './dashboard.service';
import {DashboardDto} from '../../dto/dashboard/dashboard.dto';
import {CreateDashboardDto} from '../../dto/dashboard/create-dashboard.dto';
import {DashboardEntity} from '../../model/dashboard.entity';
import {UpdateDashboardDto} from '../../dto/dashboard/update-dashboard.dto';
import {UpdateDashboardResponseDto} from '../../dto/dashboard/dashboard-response.dto';
import {FoldersDto} from '../../dto/dashboard/folders.dto';
import {UpdateDashboardLayoutDto} from '../../dto/dashboard/dashboard-layout.dto';

// Get all available dashboards fo user
@Controller('dashboard')
@ApiTags('Dashboard')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class DashboardController {
    constructor(private dashboard: DashboardService) {
        contructorLogger(this);
    }

    @Get('')
    @ApiBearerAuth()
    @ApiOperation({summary: 'Get all dashboards.'})
    @ApiOkResponse({
        type: DashboardDto,
        isArray: true,
    })
    @CheckPolicies(dashboardPolicy.Read())
    async getAllDashboards(@JwtUser() user: JwtUserInterface): Promise<DashboardDto[]> {
        return await this.dashboard.getAllDashboards(user.id);
    }

    @Get('/shared')
    @ApiBearerAuth()
    @ApiOperation({summary: 'Get all shared dashboards.'})
    @ApiOkResponse({
        type: DashboardEntity,
        isArray: true,
    })
    @CheckPolicies(dashboardPolicy.Read())
    async getSharedDashboards(@JwtUser() user: JwtUserInterface): Promise<DashboardDto[]> {
        return await this.dashboard.getSharedDashboards(user.id);
    }

    @Get('/default')
    @ApiBearerAuth()
    @ApiOperation({summary: 'Get default dashboard.'})
    @ApiOkResponse({
        type: DashboardEntity,
    })
    @CheckPolicies(dashboardPolicy.Read())
    async getDefaultDashboard(@JwtUser() user: JwtUserInterface): Promise<DashboardDto> {
        return await this.dashboard.getDefaultDashboard(user.id);
    }

    @Get('/my')
    @ApiBearerAuth()
    @ApiOperation({summary: 'Get all my dashboards.'})
    @ApiOkResponse({
        type: DashboardEntity,
        isArray: true,
    })
    @CheckPolicies(dashboardPolicy.Read())
    async getMyDashboards(@JwtUser() user: JwtUserInterface): Promise<DashboardDto[]> {
        return await this.dashboard.getMyDashboards(user.id);
    }

    @Get(':id')
    @ApiBearerAuth()
    @ApiOperation({summary: 'Get dashboard data by id.'})
    @ApiOkResponse({
        type: DashboardDto,
    })
    @CheckPolicies(dashboardPolicy.Read(), dashboardPolicy.OwnerFullEditorReadonly('params.id'))
    async getDashboard(@Param('id', ParseIntPipe) id: number, @JwtUser() user: JwtUserInterface): Promise<DashboardDto> {
        return await this.dashboard.getDashboardById(id, user.id);
    }

    @Get('name/:searchValue')
    @ApiBearerAuth()
    @ApiOperation({summary: 'Get dashboards by search value'})
    @ApiOkResponse({
        type: DashboardEntity,
        isArray: true,
    })
    @CheckPolicies(dashboardPolicy.Read())
    async searchDashboards(@Param('searchValue') searchValue: string): Promise<DashboardDto[]> {
        return await this.dashboard.searchDashboardByName(searchValue);
    }

    @Patch(':id')
    @ApiParam({name: 'id', required: true, type: Number, description: 'Dashboard id'})
    @ApiOperation({summary: 'Update a dashboard data by id.'})
    @ApiBody({required: true, type: UpdateDashboardDto})
    @ApiOkResponse({
        type: UpdateDashboardResponseDto,
    })
    @ApiBearerAuth()
    @CheckPolicies(dashboardPolicy.OwnerFull('params.id'))
    async updateDashboard(
        @Param('id') id: number,
        @Body() dto: UpdateDashboardDto,
        @JwtUser() user: JwtUserInterface
    ): Promise<DashboardDto> {
        return await this.dashboard.updateDashboard(id, dto, user.id);
    }

    @Patch(':id/folders')
    @ApiOperation({summary: 'Update a dashboard folders by id.'})
    @ApiOkResponse({
        status: 200,
    })
    @ApiBearerAuth()
    @CheckPolicies(dashboardPolicy.OwnerFull('params.id'))
    async updateDashboardFolders(
        @Param('id') id: number,
        @Body() dto: FoldersDto,
        @JwtUser() user: JwtUserInterface
    ): Promise<DashboardDto> {
        return await this.dashboard.updateDashboardFolders(id, dto, user.id);
    }

    @Put('/layout-settings/:id')
    @ApiOperation({summary: 'Update a dashboard layout settings by id.'})
    @ApiOkResponse({
        status: 200,
    })
    @ApiBearerAuth()
    @CheckPolicies(dashboardPolicy.OwnerFull('params.id'))
    async updateDashboardLayout(@Param('id') id: number, @Body() dto: UpdateDashboardLayoutDto): Promise<void> {
        return await this.dashboard.updateDashboardLayout(id, dto);
    }

    @Post()
    @ApiOperation({summary: 'Create a dashboard'})
    @ApiOkResponse({
        type: DashboardEntity,
    })
    @ApiBody({description: 'Dashboard', type: CreateDashboardDto})
    @ApiBearerAuth()
    @CheckPolicies(dashboardPolicy.Create())
    async createDashboard(@Body() dto: CreateDashboardDto, @JwtUser() user: JwtUserInterface): Promise<DashboardDto> {
        return await this.dashboard.createDashboard(dto, user.id);
    }

    @Post(':id/duplicate')
    @ApiParam({name: 'id', required: true, type: Number, description: 'Dashboard id'})
    @ApiOperation({summary: 'Duplicate a dashboard data by id.'})
    @ApiOkResponse({
        status: 201,
        type: DashboardDto,
    })
    @ApiBearerAuth()
    @CheckPolicies(dashboardPolicy.OwnerFullEditorReadonly('params.id'))
    async duplicateDashboard(@Param('id') id: number, @JwtUser() user: JwtUserInterface): Promise<DashboardDto> {
        return await this.dashboard.duplicateDashboard(id, user.id);
    }

    @Delete(':id')
    @ApiBearerAuth()
    @ApiOperation({summary: 'Delete a dashboard data by id.'})
    @CheckPolicies(dashboardPolicy.OwnerFull('params.id'))
    async deleteDashboard(@Param('id', ParseIntPipe) id: number): Promise<void> {
        return await this.dashboard.deleteDashboard(id);
    }
}
