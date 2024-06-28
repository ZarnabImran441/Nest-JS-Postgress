import {AuthHeaderDto, CheckPolicies, contructorLogger, JwtAuthGuard, JwtUser, JwtUserInterface, PoliciesGuard} from '@lib/base-library';
import {InitialSpaceSetupService} from './initial-space-setup.service';
import {Controller, Headers, Post, UseGuards} from '@nestjs/common';
import {ApiBearerAuth, ApiOperation, ApiTags} from '@nestjs/swagger';
import {spacePolicies} from '../../policy/policy-consts';

@ApiTags('Initial Space Setup')
@Controller('initial-space-setup')
@UseGuards(JwtAuthGuard, PoliciesGuard)
@ApiBearerAuth()
export class InitialSpaceSetupController {
    constructor(protected readonly service: InitialSpaceSetupService) {
        contructorLogger(this);
    }

    @Post('/master-space')
    @ApiOperation({summary: 'Add a master space and assign all folders to it'})
    @CheckPolicies(spacePolicies.Create())
    async addInitialSpace(@JwtUser() user: JwtUserInterface, @Headers() {authorization}: AuthHeaderDto): Promise<void> {
        const sanitizedToken = authorization.replace('Bearer ', '');
        return await this.service.addInitialSpace(user, sanitizedToken);
    }
}
