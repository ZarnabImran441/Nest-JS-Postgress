import {Module} from '@nestjs/common';
import {StatsController} from './stats.controller';
import {StatsService} from './stats.service';
import {contructorLogger} from '@lib/base-library';
import {AuthorizationImplModule} from '../authorization-impl/authorization-impl.module';

@Module({
    imports: [AuthorizationImplModule],
    controllers: [StatsController],
    providers: [StatsService],
    exports: [StatsService],
})
export class StatsModule {
    constructor() {
        contructorLogger(this);
    }
}
