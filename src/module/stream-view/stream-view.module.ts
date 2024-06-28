import {Module} from '@nestjs/common';
import {StreamViewController} from './stream-view.controller';
import {StreamViewService} from './stream-view.service';
import {TypeOrmModule} from '@nestjs/typeorm';
import {TaskActionEntity} from '../../model/task-action.entity';
import {FolderActionEntity} from '../../model/folder-action.entity';
import {TaskRelationEntity} from '../../model/task-relation.entity';
import {FolderUserViewEntity} from '../../model/folder-user-view.entity';
import {TaskFollowerEntity} from '../../model/task-follower.entity';
import {FolderFollowerEntity} from '../../model/folder-follower.entity';
import {WorkFlowStateEntity} from '../../model/workflow-state.entity';
import {FolderEntity} from '../../model/folder.entity';
import {contructorLogger} from '@lib/base-library';
import {TaskEntity} from '../../model/task.entity';

/**
 * Module for managing stream view.
 *
 * @module StreamViewModule
 */
@Module({
    imports: [
        TypeOrmModule.forFeature([
            TaskActionEntity,
            FolderActionEntity,
            TaskRelationEntity,
            FolderUserViewEntity,
            TaskFollowerEntity,
            FolderFollowerEntity,
            WorkFlowStateEntity,
            FolderEntity,
            TaskEntity,
        ]),
    ],
    controllers: [StreamViewController],
    providers: [StreamViewService],
})
export class StreamViewModule {
    constructor() {
        contructorLogger(this);
    }
}
