import {Body, Controller, Delete, Get, Param, Patch, Post, UseGuards} from '@nestjs/common';
import {ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiParam, ApiTags} from '@nestjs/swagger';
import {CheckPolicies, contructorLogger, JwtAuthGuard, PoliciesGuard} from '@lib/base-library';
import {TeamService} from './team.service';
import {CreateTeamDto} from '../../dto/teams/create-team.dto';
import {teamsPolicies} from '../../policy/policy-consts';
import {RoleEntity} from '../../model/role.entity';
import {DeleteResult, UpdateResult} from 'typeorm';
import {UpdateTeamDto} from '../../dto/teams/update-team.dto';
import {ResponseTeamDto} from '../../dto/teams/reponse-team.dto';

@ApiTags('Teams')
@UseGuards(JwtAuthGuard, PoliciesGuard)
@ApiBearerAuth()
@Controller('team')
export class TeamController {
    constructor(protected readonly teamService: TeamService) {
        contructorLogger(this);
    }

    @Post()
    @CheckPolicies(teamsPolicies.Create())
    @ApiBody({isArray: false, type: CreateTeamDto, description: 'Create a team'})
    @ApiOkResponse({isArray: false, type: RoleEntity, description: 'Team'})
    @ApiOperation({description: 'Create a team'})
    async createTeam(@Body() dto: CreateTeamDto): Promise<RoleEntity> {
        return await this.teamService.createTeam(dto);
    }

    @Get()
    @CheckPolicies(teamsPolicies.Read())
    @ApiOkResponse({isArray: true, type: ResponseTeamDto, description: 'List of Teams'})
    @ApiOperation({description: 'Get teams'})
    async getAllTeams(): Promise<ResponseTeamDto[]> {
        return await this.teamService.getAllTeams();
    }

    @Patch('/:team_id')
    @CheckPolicies(teamsPolicies.Update())
    @ApiParam({name: 'team_id', required: true, type: Number, description: 'Team id'})
    @ApiBody({isArray: false, type: UpdateTeamDto, description: 'Update a team'})
    @ApiOkResponse({isArray: false, type: UpdateResult, description: ''})
    @ApiOperation({description: 'Get teams'})
    async updateTeam(@Param('team_id') teamId: number, @Body() dto: UpdateTeamDto): Promise<unknown> {
        return await this.teamService.updateTeam(teamId, dto);
    }

    @Delete('/:team_id')
    @CheckPolicies(teamsPolicies.Delete())
    @ApiParam({name: 'team_id', required: true, type: Number, description: 'Team id to delete'})
    @ApiOkResponse({isArray: false, type: DeleteResult, description: ''})
    @ApiOperation({description: 'Delete a team'})
    async deleteTeam(@Param('team_id') teamId: number): Promise<DeleteResult> {
        return await this.teamService.deleteTeam(teamId);
    }

    @Get('/:team_id')
    @CheckPolicies(teamsPolicies.Read())
    @ApiParam({name: 'team_id', required: true, type: Number, description: 'Team id'})
    @ApiOkResponse({isArray: false, type: ResponseTeamDto, description: 'Team'})
    @ApiOperation({description: 'Get teams'})
    async getOneTeam(@Param('team_id') teamId: number): Promise<ResponseTeamDto> {
        return await this.teamService.getOneTeam(teamId);
    }
}
