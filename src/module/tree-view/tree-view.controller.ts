import {Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, UseGuards} from '@nestjs/common';
import {TreeViewService} from './tree-view.service';
import {ApiBearerAuth, ApiOperation, ApiParam, ApiTags} from '@nestjs/swagger';
import {CheckPolicies, contructorLogger, JwtAuthGuard, JwtUser, JwtUserInterface, PoliciesGuard} from '@lib/base-library';
import {DeleteResult, UpdateResult} from 'typeorm';
import {treeViewPolicies} from '../../policy/policy-consts';
import {TreeViewResponseDto} from '../../dto/tree-view/tree-view-response.dto';
import {CreateTreeViewDto} from '../../dto/tree-view/create-tree-view.dto';
import {UpdateTreeViewDto} from '../../dto/tree-view/update-tree-view.dto';
import {TreeViewEntity} from '../../model/tree-view.entity';

//** TODO: Move in a separate file and import */
@ApiTags('Tree Views')
@UseGuards(JwtAuthGuard, PoliciesGuard)
@ApiBearerAuth()
@Controller('tree-views')
export class TreeViewController {
    constructor(protected readonly treeViewsService: TreeViewService) {
        contructorLogger(this);
    }

    @ApiOperation({summary: `Get current user's tree views`})
    @Get()
    @CheckPolicies(treeViewPolicies.Read())
    async get(@JwtUser() user: JwtUserInterface): Promise<TreeViewResponseDto[]> {
        return await this.treeViewsService.get(user.id);
    }

    @ApiOperation({summary: `Create a tree view for the current user. Returns tree view id`})
    @Post()
    @CheckPolicies(treeViewPolicies.Create())
    async create(@Body() createTreeViewDto: CreateTreeViewDto, @JwtUser() user: JwtUserInterface): Promise<TreeViewEntity> {
        return await this.treeViewsService.create(createTreeViewDto, user.id);
    }

    @ApiOperation({summary: `Update a tree view for the current user`})
    @ApiParam({name: 'tree_view_id', required: true, type: Number, description: 'Tree view id'})
    @Put(':tree_view_id')
    @CheckPolicies(treeViewPolicies.Update())
    async update(
        @Param('tree_view_id', ParseIntPipe) treeViewId: number,
        @Body() updateTreeViewDto: UpdateTreeViewDto,
        @JwtUser() user: JwtUserInterface
    ): Promise<UpdateResult> {
        return await this.treeViewsService.updateTreeView(treeViewId, updateTreeViewDto, user.id);
    }

    //todo : add return types
    //Level 2 : User that created the tree view can delete it
    @ApiOperation({summary: 'Delete a tree view from the current user'})
    @ApiParam({name: 'tree_view_id', required: true, type: Number, description: 'Tree view id'})
    @Delete(':tree_view_id')
    @CheckPolicies(treeViewPolicies.Delete())
    async remove(@Param('tree_view_id', ParseIntPipe) treeViewId: number, @JwtUser() user: JwtUserInterface): Promise<DeleteResult> {
        return await this.treeViewsService.remove(treeViewId, user.id);
    }

    //Todo : change the Get -> Patch
    @ApiOperation({summary: `Create a tree view for the current user. Returns tree view id`})
    @ApiParam({name: 'tree_view_id', required: true, type: Number, description: 'Tree view id'})
    @Get('set-active/:tree_view_id')
    @CheckPolicies(treeViewPolicies.Update())
    async setActive(@Param('tree_view_id', ParseIntPipe) treeViewId: number, @JwtUser() user: JwtUserInterface): Promise<UpdateResult> {
        return await this.treeViewsService.setActive(treeViewId, user.id);
    }

    //todo : test cases
    @ApiOperation({summary: `Update the position of tree view`})
    @ApiParam({name: 'tree_view_id', required: true, type: Number, description: 'Tree view id'})
    @Put('position/:tree_view_id')
    @CheckPolicies(treeViewPolicies.Update())
    async updatePosition(
        @Param('tree_view_id', ParseIntPipe) treeViewId: number,
        @Body() body: UpdateTreeViewDto,
        @JwtUser() user: JwtUserInterface
    ): Promise<TreeViewResponseDto[]> {
        return await this.treeViewsService.updateTreeViewPosition(treeViewId, body, user);
    }
}
