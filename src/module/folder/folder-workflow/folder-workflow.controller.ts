import {Body, Controller, Param, ParseIntPipe, Post, Query, UseGuards} from '@nestjs/common';
import {ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags} from '@nestjs/swagger';
import {FolderWorkflowService} from './folder-workflow.service';
import {
    ArrayValidationPipe,
    CheckPolicies,
    contructorLogger,
    JwtAuthGuard,
    JwtUser,
    JwtUserInterface,
    PoliciesGuard,
} from '@lib/base-library';
import {CreateFolderWorkFlowDto} from '../../../dto/folder/workflow/create-folder-workflow.dto';
import {folderPolicies, folderWorkFlowPolicies} from '../../../policy/policy-consts';
import {CreateFolderWorkflowResponseDto} from '../../../dto/folder/workflow/create-folder-workflow-response.dto';
import {ProjectWorkFlowResponseDto} from '../../../dto/folder/workflow/project-workFlow-response.dto';
import {FolderTaskFilterDto} from '../../../dto/folder/filter/folder-task-filter.dto';
import {BoardResponseDto} from '../../../dto/folder/workflow/board-response.dto';
import {FolderViewOptions} from '../../../enum/folder-position.enum';
import {ListResponseDto} from '../../../dto/folder/workflow/list-response.dto';
import {GanttResponseDto} from '../../../dto/folder/workflow/gantt-response.dto';

@ApiTags('Folder Workflow')
@Controller('folder-workflow')
@UseGuards(JwtAuthGuard, PoliciesGuard)
@ApiBearerAuth()
export class FolderWorkflowController {
    constructor(protected readonly service: FolderWorkflowService) {
        contructorLogger(this);
    }

    //** Create Permission */
    //** Anyone who have permission to create a folder(Create) can create a folder workflow */
    @Post()
    @ApiOperation({summary: 'Create a folder workflow'})
    @ApiBody({required: true, type: CreateFolderWorkFlowDto, description: 'A folder workflow'})
    @CheckPolicies(folderWorkFlowPolicies.Create(), folderPolicies.Owner('body.Folder.id'))
    async createOne(@Body() dto: CreateFolderWorkFlowDto): Promise<CreateFolderWorkflowResponseDto> {
        return await this.service.createWorkflowWithState(dto);
    }

    //This is a post call but in real we are fetching data so I have added read permission here\
    //** Owner,Members of folder and people with read permission on folder and anyone with read permission can view the workflow */
    //** Fix :  we can get the folderids from params or query param */
    @ApiOperation({summary: `Get folder's workflow and states`})
    @ApiBody({description: 'An array of folder id', required: true, type: Number, isArray: true})
    @CheckPolicies(folderWorkFlowPolicies.Read())
    @Post('project')
    async getProjectWorkflow(
        @Body(ArrayValidationPipe(Number)) folderIds: number[],
        @JwtUser() user: JwtUserInterface
    ): Promise<ProjectWorkFlowResponseDto[]> {
        return await this.service.getProjectWorkflow(folderIds, user.id);
    }

    //** Owner, Members of the folder and anyone with read permission on folder and folder workflows can view the board */
    @ApiOperation({summary: 'Get list of workflows and tasks linked with a project for the Board view'})
    @ApiParam({name: 'folder_id', required: true, type: Number, description: 'Get workflows and tasks by folder Id'})
    @ApiBody({required: false, type: FolderTaskFilterDto, description: 'Folder and task filter'})
    @ApiQuery({
        name: 'show-archived',
        required: false,
        type: Boolean,
        description: `Get Archive Folders`,
    })
    @Post('project/:folder_id/board')
    @CheckPolicies(folderWorkFlowPolicies.Read(), folderPolicies.OwnerFullEditorReadonly('params.folder_id'))
    async getProjectsFlowsAndTasksBoard(
        @Param('folder_id', ParseIntPipe) folderId: number,
        @Query('show-archived') showArchived = false,
        @Query('show-deleted') showDeleted = false,
        @Body() filter: FolderTaskFilterDto,
        @JwtUser() user: JwtUserInterface
    ): Promise<BoardResponseDto[]> {
        return await this.service.getProjectsFlowsAndTasksBoardView(
            folderId,
            user.id,
            FolderViewOptions.BOARD,
            filter,
            showArchived,
            showDeleted
        );
    }

    //** Owner, Members of the folder and anyone with read permission can view the board */
    @ApiOperation({summary: 'Get list of workflows and tasks linked with a project for the List view'})
    @ApiParam({name: 'folder_id', required: true, type: Number, description: 'Get workflows and tasks by folder Id'})
    @ApiBody({required: false, type: FolderTaskFilterDto, description: 'Folder and task filter'})
    @ApiQuery({
        name: 'show-archived',
        required: false,
        type: Boolean,
        description: `Get Archive Folders`,
    })
    @Post('project/:folder_id/list')
    @CheckPolicies(folderWorkFlowPolicies.Read(), folderPolicies.OwnerFullEditorReadonly('params.folder_id'))
    async getProjectsFlowsAndTasksList(
        @Param('folder_id', ParseIntPipe) folderId: number,
        @Query('show-archived') showArchived = false,
        @Query('show-deleted') showDeleted = false,
        @Body() filter: FolderTaskFilterDto,
        @JwtUser() user: JwtUserInterface
    ): Promise<ListResponseDto> {
        return await this.service.getProjectsFlowsAndTasksListView(folderId, user.id, filter, showArchived, showDeleted);
    }

    //** Owner,Members of folder and anyone with read permission can view the board */
    @ApiOperation({summary: 'Get list of workflows and tasks linked with a project for the Gantt view'})
    @ApiParam({name: 'folder_id', required: true, type: Number, description: 'Get workflows and tasks by folder Id'})
    @ApiBody({required: false, type: FolderTaskFilterDto, description: 'Folder and task filter'})
    @ApiQuery({
        name: 'show-archived',
        required: false,
        type: Boolean,
        description: `Get Archive Folders`,
    })
    @Post('project/:folder_id/gantt')
    @CheckPolicies(folderWorkFlowPolicies.Read(), folderPolicies.OwnerFullEditorReadonly('params.folder_id'))
    async getProjectsFlowsAndTasksGantt(
        @Param('folder_id', ParseIntPipe) folderId: number,
        @Body() filter: FolderTaskFilterDto,
        @Query('show-archived') showArchived = false,
        @Query('show-deleted') showDeleted = false,
        @JwtUser() user: JwtUserInterface
    ): Promise<GanttResponseDto> {
        return await this.service.getProjectsFlowsAndTasksGanttView(folderId, user.id, filter, showArchived, showDeleted);
    }

    //** Not used by Task Management UI */

    // @Get()
    // @ApiOperation({description: 'Get folder workflows'})
    // async getMany(): Promise<FolderWorkFlowResponseDto[]> {
    //     const workflows = await this.service.getMany();
    //     if (workflows) {
    //         return workFlowApiParser(workflows, 'FolderWorkflowStates') as unknown as FolderWorkFlowResponseDto[];
    //     }
    //     return [];
    // }

    // @Get('personalise-workflows')
    // @ApiOperation({description: 'Get personalise workflows'})
    // async getManyPersonaliseWorkflows(): Promise<FolderWorkFlowResponseDto[]> {
    //     const workflows = await this.service.getManyPersonaliseWorkflows();
    //     if (workflows) {
    //         return workFlowApiParser(workflows, 'FolderWorkflowStates') as unknown as FolderWorkFlowResponseDto[];
    //     }
    //     return [];
    // }

    //** not used on UI */
    //** Read permission on folder workflow */
    //Todo : This route should also have folder id
    // @Get('by-id/:folder_workflow_id')
    // @ApiOperation({description: 'Get a folder workflow by id'})
    // @ApiParam({name: 'folder_workflow_id', required: true, type: Number, description: 'A folder workflow id'})
    // @CheckPolicies(folderWorkFlowPolicies.ReadPolicy())
    // async getOne(@Param('folder_workflow_id', ParseIntPipe) workflowId: number): Promise<FolderWorkFlowResponseDto> {
    //     const workflow = await this.service.getOneFolderWorkflow(workflowId);
    //     if (workflow) {
    //         const ret = workFlowApiParser([workflow], 'FolderWorkflowStates');
    //         return ret[0] as unknown as FolderWorkFlowResponseDto;
    //     }
    //     throw new NotFoundException(`Folder workflow ${workflowId} not found`);
    // }
}
