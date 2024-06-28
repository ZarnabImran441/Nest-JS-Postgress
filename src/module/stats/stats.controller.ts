import {Controller, Get, Query, UseGuards} from '@nestjs/common';
import {ApiBearerAuth, ApiOkResponse, ApiQuery, ApiTags} from '@nestjs/swagger';
import {
    CheckPolicies,
    contructorLogger,
    JwtAuthGuard,
    JwtPayloadInterface,
    JwtUser,
    ParseArrayIntPipeOptional,
    ParseArrayUUIDPipeOptional,
    parseDatePipeOptional,
    parseNumberPipeOptional,
    PoliciesGuard,
} from '@lib/base-library';
import {StatsService} from './stats.service';
import {StatsTasksByMonthCountDto} from './dto/stats-tasks-by-month.dto';
import {StatsTasksByAssigneeCountDto} from './dto/stats-tasks-by-assignee.dto';
import {StatsApprovalsCountDto} from './dto/stats-approval.dto';
import {StatsCommentsCountDto} from './dto/stats-comment.dto';
import {StatsCountDto} from './dto/stats-count.dto';
import {StatsMyCountDto} from './dto/stats-my-count.dto';
import {userPolicies} from '../../policy/policy-consts';
@ApiBearerAuth()
@ApiTags('Stats')
@Controller('stats')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class StatsController {
    constructor(public service: StatsService) {
        contructorLogger(this);
    }

    @Get('tasks/month')
    @ApiQuery({
        name: 'folders',
        isArray: true,
        type: Number,
        required: false,
        description: 'folders (default all folders user has access to)',
        style: 'simple',
    })
    @ApiQuery({name: 'year', type: Number, required: false, description: 'year (default current year)'})
    @ApiOkResponse({
        status: 200,
        description: 'Get tasks by month',
        type: Array<StatsTasksByMonthCountDto>,
        isArray: true,
    })
    @CheckPolicies(userPolicies.Read())
    async tasksByMonth(
        @JwtUser() user: JwtPayloadInterface,
        @Query('folders', ParseArrayIntPipeOptional) folders?: number[],
        @Query('year', parseNumberPipeOptional) year?: number
    ): Promise<StatsTasksByMonthCountDto[]> {
        return await this.service.tasksByMonth(user, folders, year);
    }

    @Get('tasks/assignee')
    @ApiQuery({
        name: 'folders',
        isArray: true,
        type: Number,
        required: false,
        description: 'folders (default all folders user has access to)',
        style: 'simple',
    })
    @ApiQuery({
        name: 'assignees',
        isArray: true,
        type: String,
        required: false,
        description: 'assignees (default all assignees)',
        style: 'simple',
    })
    @ApiQuery({name: 'year', type: Number, required: false, description: 'year (default current year)'})
    @ApiQuery({name: 'from', type: Date, required: false, description: 'From date'})
    @ApiQuery({name: 'to', type: Date, required: false, description: 'To date'})
    @ApiOkResponse({
        status: 200,
        description: 'Get tasks by assignee',
        type: Array<StatsTasksByAssigneeCountDto>,
        isArray: true,
    })
    @CheckPolicies(userPolicies.Read())
    async tasksByAssignee(
        @JwtUser() user: JwtPayloadInterface,
        @Query('folders', ParseArrayIntPipeOptional) folders?: number[],
        @Query('assignees', ParseArrayUUIDPipeOptional) assignees?: string[],
        @Query('from', parseDatePipeOptional) from?: Date,
        @Query('to', parseDatePipeOptional) to?: Date
    ): Promise<StatsTasksByAssigneeCountDto[]> {
        return await this.service.tasksByAssignee(user, folders, assignees, from, to);
    }

    @Get('approvals')
    @ApiQuery({
        name: 'folders',
        isArray: true,
        type: Number,
        required: false,
        description: 'folders (default all folders user has access to)',
        style: 'simple',
    })
    @ApiQuery({name: 'year', type: Number, required: false, description: 'year (default current year)'})
    @ApiOkResponse({
        status: 200,
        description: 'Get approvals',
        type: Array<StatsApprovalsCountDto>,
        isArray: true,
    })
    @CheckPolicies(userPolicies.Read())
    async approvals(
        @JwtUser() user: JwtPayloadInterface,
        @Query('folders', ParseArrayIntPipeOptional) folders?: number[],
        @Query('year', parseNumberPipeOptional) year?: number
    ): Promise<StatsApprovalsCountDto[]> {
        return await this.service.approvals(user, folders, year);
    }

    @Get('comments')
    @ApiQuery({
        name: 'folders',
        isArray: true,
        type: Number,
        required: false,
        description: 'folders (default all folders user has access to)',
        style: 'simple',
    })
    @ApiQuery({
        name: 'users',
        isArray: true,
        type: String,
        required: false,
        description: 'users (default all users)',
        style: 'simple',
    })
    @ApiQuery({name: 'year', type: Number, required: false, description: 'year (default current year)'})
    @ApiOkResponse({
        status: 200,
        description: 'Get comments',
        type: Array<StatsCommentsCountDto>,
        isArray: true,
    })
    @CheckPolicies(userPolicies.Read())
    async comments(
        @JwtUser() user: JwtPayloadInterface,
        @Query('folders', ParseArrayIntPipeOptional) folders?: number[],
        @Query('users', ParseArrayUUIDPipeOptional) users?: string[],
        @Query('year', parseNumberPipeOptional) year?: number
    ): Promise<StatsCommentsCountDto[]> {
        return await this.service.comments(user, folders, users, year);
    }

    @Get('counts')
    @ApiOkResponse({
        status: 200,
        description: 'Get counts',
        type: Array<StatsCountDto>,
        isArray: true,
    })
    @CheckPolicies(userPolicies.Read())
    async counts(): Promise<StatsCountDto[]> {
        return await this.service.counts();
    }

    @Get('my-counts')
    @ApiOkResponse({
        status: 200,
        description: 'Get my counts',
        type: StatsMyCountDto,
        isArray: true,
    })
    @CheckPolicies(userPolicies.Read())
    async myCounts(@JwtUser() user: JwtPayloadInterface): Promise<StatsMyCountDto> {
        return await this.service.myCounts(user);
    }
}
