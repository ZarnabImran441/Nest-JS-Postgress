import {TypeOrmModule} from '@nestjs/typeorm';
import {Module} from '@nestjs/common';
import {FolderWorkflowService} from './folder-workflow.service';
import {FolderWorkflowController} from './folder-workflow.controller';
import {TaskModule} from '../../task/task.module';
import {WorkFlowEntity} from '../../../model/workflow.entity';
import {AuthorizationImplService} from '../../authorization-impl/authorization-impl.service';
import {contructorLogger} from '@lib/base-library';

@Module({
    imports: [TypeOrmModule.forFeature([WorkFlowEntity]), TaskModule],
    providers: [FolderWorkflowService, AuthorizationImplService],
    exports: [FolderWorkflowService],
    controllers: [FolderWorkflowController],
})
export class FolderWorkflowModule {
    constructor() {
        contructorLogger(this);
    }
}
