import {TypeOrmModule} from '@nestjs/typeorm';
import {Module} from '@nestjs/common';
import {TaskController} from './task.controller';
import {TaskService} from './task.service';
import {TaskEntity} from '../../model/task.entity';
import {TaskAttachmentModule} from './task-attachment/task-attachment.module';
import {contructorLogger, S3Module} from '@lib/base-library';
import {AssignedPermissionEntity} from '../../model/assigned-permission.entity';
import {NotificationModule} from '../notification/notification.module';
import {TaskRelationEntity} from '../../model/task-relation.entity';
import {AutomationsCrudModule} from '../automations/automations-crud.module';
import {TaskEntitySubscriber} from '../../model/subscribers/task.event-subscriber';
import {SearchModule} from '../search/search.module';
import {TagTaskFolderEntitySubscriber} from '../../model/subscribers/tag-task-folder.event-subscriber';
import {TaskAttachmentEntitySubscriber} from '../../model/subscribers/task-attachment.event-subscriber';
import {TaskActionEntitySubscriber} from '../../model/subscribers/task-action.event-subscriber';
import {CustomFieldValueEntitySubscriber} from '../../model/subscribers/custom-field-value.event-subscriber';

/**
 * This module provides functionality related to tasks.
 * It includes controllers, services, and other providers needed for handling tasks.
 */
@Module({
    imports: [
        TypeOrmModule.forFeature([TaskEntity, AssignedPermissionEntity, TaskRelationEntity]),
        TaskAttachmentModule,
        NotificationModule.register(false),
        S3Module,
        AutomationsCrudModule,
        SearchModule,
    ],
    providers: [
        TaskService,
        TaskEntitySubscriber,
        TagTaskFolderEntitySubscriber,
        TaskAttachmentEntitySubscriber,
        TaskActionEntitySubscriber,
        CustomFieldValueEntitySubscriber,
    ],
    exports: [TaskService],
    controllers: [TaskController],
})
export class TaskModule {
    constructor() {
        contructorLogger(this);
    }
}
