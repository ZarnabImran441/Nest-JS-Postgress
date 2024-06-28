import {TypeOrmModule} from '@nestjs/typeorm';
import {Module} from '@nestjs/common';
import {WorkFlowController} from './workflow.controller';
import {WorkFlowService} from './workflow.service';
import {WorkFlowEntity} from '../../model/workflow.entity';
import {contructorLogger} from '@lib/base-library';

@Module({
    imports: [TypeOrmModule.forFeature([WorkFlowEntity])],
    providers: [WorkFlowService],
    exports: [WorkFlowService],
    controllers: [WorkFlowController],
})
export class WorkFlowModule {
    constructor() {
        contructorLogger(this);
    }
}
