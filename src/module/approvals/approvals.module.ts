import {Module} from '@nestjs/common';
import {TaskEntity} from '../../model/task.entity';
import {TypeOrmModule} from '@nestjs/typeorm';
import {ApprovalsController} from './approvals.controller';
import {ApprovalsService} from './approvals.service';
import {ApprovalEntity} from '../../model/approval.entity';
import {ApprovalActionEntity} from '../../model/approval-action.entity';
import {ApprovalAttachmentEntity} from '../../model/approval-attachment.entity';
import {contructorLogger, S3Module} from '@lib/base-library';
import {TaskModule} from '../task/task.module';
import {TaskAttachmentModule} from '../task/task-attachment/task-attachment.module';
import {TaskRelationEntity} from '../../model/task-relation.entity';
import {NotificationModule} from '../notification/notification.module';
import {UserEntity} from '../../model/user.entity';
import {ApprovalEntitySubscriber} from '../../model/subscribers/approval.event-subscriber';
import {SearchModule} from '../search/search.module';

/**
 * Module for managing approvals.
 * @module ApprovalsModule
 */
@Module({
    imports: [
        TypeOrmModule.forFeature([
            ApprovalEntity,
            TaskEntity,
            ApprovalActionEntity,
            ApprovalAttachmentEntity,
            TaskRelationEntity,
            UserEntity,
        ]),
        TaskModule,
        TaskAttachmentModule,
        S3Module,
        NotificationModule.register(false),
        SearchModule,
    ],
    controllers: [ApprovalsController],
    providers: [ApprovalsService, ApprovalEntitySubscriber],
    exports: [ApprovalsService],
})
export class ApprovalsModule {
    constructor() {
        contructorLogger(this);
    }
}
