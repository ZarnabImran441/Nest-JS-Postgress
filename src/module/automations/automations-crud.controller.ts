import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    UseGuards,
    UsePipes,
    ValidationPipe,
} from '@nestjs/common';
import {AutomationsCrudService} from './automations-crud.service';
import {ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiParam, ApiTags} from '@nestjs/swagger';
import {CheckPolicies, contructorLogger, JwtAuthGuard, JwtUser, JwtUserInterface, PoliciesGuard} from '@lib/base-library';
import {AutomationAvailableOptionssDto, AutomationDto, AutomationLogQueryDto} from '@lib/automations-library';
import {folderPolicies} from '../../policy/policy-consts';
import {AutomationJobLogResultsDto} from '@lib/automations-library/dto/automation-log-results.dto';

@ApiTags('Automation')
@Controller('automation')
@UseGuards(JwtAuthGuard, PoliciesGuard)
@ApiBearerAuth()
export class AutomationsCrudController {
    constructor(protected readonly service: AutomationsCrudService) {
        contructorLogger(this);
    }

    @Get('/getavailable')
    @ApiOperation({summary: 'Fetch all conditions and actions available for a given application'})
    @CheckPolicies(() => true)
    async getAvailable(@JwtUser() user: JwtUserInterface): Promise<AutomationAvailableOptionssDto> {
        return await this.service.getAvailable(user);
    }

    @Get('/getmany/folder/:folder_id')
    @ApiOperation({summary: 'Fetch all automations of a folder'})
    @ApiParam({
        name: 'folder_id',
        required: true,
        type: 'integer',
        description: 'Folder id',
    })
    @CheckPolicies(folderPolicies.OwnerFull('params.folder_id'))
    async getMany(@Param('folder_id', ParseIntPipe) folderId: number, @JwtUser() user: JwtUserInterface): Promise<unknown> {
        return await this.service.getMany(folderId, user);
    }

    @Get('/getall')
    @ApiOperation({summary: 'Fetch all automations for this application'})
    @CheckPolicies(() => true)
    async getAll(@JwtUser() user: JwtUserInterface): Promise<unknown> {
        return await this.service.getAll(user);
    }

    @Get('/getone/automation/:automation_id')
    @ApiOperation({summary: 'Fetch automation by automation id'})
    @ApiOkResponse({
        status: 200,
        description: 'Get a automation',
        type: AutomationDto,
    })
    @ApiParam({name: 'automation_id', required: true, type: Number, description: 'Automation id'})
    @CheckPolicies(() => true)
    async getOne(
        @Param('automation_id', ParseIntPipe)
        automationId: number,
        @JwtUser() user: JwtUserInterface
    ): Promise<AutomationDto> {
        return await this.service.getOne(automationId, user);
    }

    @Patch('/updateone/automation/:automation_id')
    @ApiOperation({summary: 'Update automation by automation Id'})
    @ApiParam({name: 'automation_id', required: true, type: Number, description: 'Automation id'})
    @ApiBody({type: AutomationDto})
    @CheckPolicies(() => true)
    @UsePipes(new ValidationPipe({transform: true}))
    async updateOne(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        @Body() dto: Record<string, any>,
        @Param('automation_id', ParseIntPipe) automationId: number,
        @JwtUser() user: JwtUserInterface
    ): Promise<AutomationDto> {
        const mappedDto = new AutomationDto();
        Object.assign(mappedDto, dto);
        return await this.service.updateOne(automationId, mappedDto, user);
    }

    @ApiOperation({summary: 'Deletes an automation'})
    @ApiParam({name: 'automation_id', required: true, type: Number, description: 'Automation id'})
    @Delete('deleteone/automation/:automation_id')
    @CheckPolicies(() => true)
    async deleteone(@Param('automation_id', ParseIntPipe) automationId: number, @JwtUser() user: JwtUserInterface): Promise<void> {
        await this.service.deleteOne(automationId, user);
    }

    @Post('createone')
    @ApiOperation({summary: 'Create a new automation'})
    @ApiBody({type: AutomationDto})
    @CheckPolicies(() => true)
    @UsePipes(new ValidationPipe({transform: true}))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async createOne(@Body() dto: Record<string, any>, @JwtUser() user: JwtUserInterface): Promise<AutomationDto> {
        const mappedDto = new AutomationDto();
        Object.assign(mappedDto, dto);
        return await this.service.createOne(mappedDto, user);
    }

    @Post('/getmanylogs')
    @ApiOperation({summary: 'Fetch all automation logs for this application'})
    @ApiBody({type: AutomationLogQueryDto})
    @CheckPolicies(() => true)
    @UsePipes(new ValidationPipe({transform: true}))
    @HttpCode(200)
    async getManyLogs(@JwtUser() user: JwtUserInterface, @Body() dto?: AutomationLogQueryDto): Promise<AutomationJobLogResultsDto> {
        const result = await this.service.getManyLogs(user, dto);
        return result;
    }
}
