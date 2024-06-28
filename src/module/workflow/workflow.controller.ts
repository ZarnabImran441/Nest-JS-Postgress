import {
    CheckPolicies,
    JwtAuthGuard,
    JwtUser,
    JwtUserInterface,
    PoliciesGuard,
    ServiceUserCheckPolicies,
    contructorLogger,
} from '@lib/base-library';
import {Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards} from '@nestjs/common';
import {ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiParam, ApiResponse, ApiTags} from '@nestjs/swagger';
import {DeleteResult, UpdateResult} from 'typeorm';
import {CreateWorkFlowDto} from '../../dto/workflow/create-workflow.dto';
import {UpdateWorkflowDto} from '../../dto/workflow/update-workflow.dto';
import {WorkFlowResponseDto} from '../../dto/workflow/workflow-response.dto';
import {WorkFlowEntity} from '../../model/workflow.entity';
import {workflowPolicies} from '../../policy/policy-consts';
import {WorkFlowService} from './workflow.service';

//** TODO: Move in a separate file and import */
@ApiTags('Workflow')
@Controller('workflow')
@UseGuards(JwtAuthGuard, PoliciesGuard)
@ApiBearerAuth()
export class WorkFlowController {
    constructor(protected readonly service: WorkFlowService) {
        contructorLogger(this);
    }

    @Delete(':workflow_id')
    @ApiOperation({summary: 'Delete a Workflow and all states'})
    @ApiParam({name: 'workflow_id', required: false, type: Number, description: 'Filter results by Workflow id'})
    @CheckPolicies(workflowPolicies.Delete())
    async deleteWorkFlow(@Param('workflow_id', ParseIntPipe) workflowId: number): Promise<DeleteResult> {
        return await this.service.deleteWorkFlow(workflowId);
    }

    @Post()
    @ApiOperation({summary: 'Create a Workflow and all states'})
    @ApiBody({type: CreateWorkFlowDto, description: `A workflow and all states`, required: true})
    @ServiceUserCheckPolicies(workflowPolicies.Create())
    async createOne(@Body() dto: CreateWorkFlowDto, @JwtUser() user: JwtUserInterface): Promise<WorkFlowEntity> {
        return await this.service.createWorkflowState(dto, user.id, true);
    }

    @Post('/personal')
    @ApiOperation({summary: 'Create a Persoanl Workflow and all states'})
    @ApiBody({type: CreateWorkFlowDto, description: `A workflow and all states`, required: true})
    @ServiceUserCheckPolicies(workflowPolicies.Create())
    async createPersonalOne(@Body() dto: CreateWorkFlowDto, @JwtUser() user: JwtUserInterface): Promise<WorkFlowEntity> {
        return await this.service.createWorkflowState(dto, user.id, false);
    }

    @Get()
    @ApiOperation({summary: 'Get all workflows'})
    @ApiOkResponse({type: WorkFlowResponseDto, isArray: true})
    @CheckPolicies(workflowPolicies.Read())
    @ApiResponse({status: 200, type: WorkFlowResponseDto, isArray: true})
    async getMany(@JwtUser() user: JwtUserInterface): Promise<WorkFlowResponseDto[]> {
        return await this.service.getMany(user.id);
    }

    //check if these api are used or not
    @Patch(':workflow_id')
    @ApiOperation({summary: 'Update a workflow'})
    @ApiParam({name: 'workflow_id', required: true, type: Number, description: 'Workflow id'})
    @ApiBody({type: UpdateWorkflowDto, required: true, description: 'A workflow'})
    @CheckPolicies(workflowPolicies.Update())
    async updateOne(
        @Body() dto: UpdateWorkflowDto,
        @Param('workflow_id', ParseIntPipe) workflowId: number,
        @JwtUser() user: JwtUserInterface
    ): Promise<UpdateResult> {
        return await this.service.updateWorkflowState(workflowId, dto, user.id);
    }

    @Get(':workflow_id')
    @ApiOperation({summary: 'Get a workflow by id'})
    @ApiParam({name: 'workflow_id', required: true, type: Number, description: 'Workflow id'})
    @CheckPolicies(workflowPolicies.Read())
    @ApiResponse({status: 200, type: WorkFlowResponseDto, isArray: false})
    async getOne(@Param('workflow_id', ParseIntPipe) workflowId: number, @JwtUser() user: JwtUserInterface): Promise<WorkFlowResponseDto> {
        return await this.service.getOne(workflowId, user.id);
    }

    @ApiOperation({summary: 'Convert Personalise workflow to common workflow'})
    @ApiParam({name: 'workflow_id', required: true, type: Number, description: 'Personalise workflow Id'})
    @Post('/convert-workflow/:workflow_id')
    @ServiceUserCheckPolicies(workflowPolicies.Create())
    async createCommonWorkflowFromPersonalise(
        @Param('workflow_id', ParseIntPipe) workflowId: number,
        @JwtUser() user: JwtUserInterface
    ): Promise<WorkFlowEntity> {
        return await this.service.CreateCommonFromPersonaliseWorkflow(workflowId, user.id);
    }
}
