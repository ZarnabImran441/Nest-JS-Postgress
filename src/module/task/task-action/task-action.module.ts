import {TypeOrmModule} from '@nestjs/typeorm';
import {Global, Module} from '@nestjs/common';
import {TaskActionService} from './task-action.service';
import {TaskActionController} from './task-action.controller';
import {TaskActionEntity} from '../../../model/task-action.entity';
import {contructorLogger} from '@lib/base-library';
import {TaskAttachmentModule} from '../task-attachment/task-attachment.module';
import {NotificationModule} from '../../notification/notification.module';
import {AutomationsCrudModule} from '../../automations/automations-crud.module';
import {SearchModule} from '../../search/search.module';
import {TaskActionEntitySubscriber} from '../../../model/subscribers/task-action.event-subscriber';
import {SpaceModule} from '../../space/space.module';

@Global()
@Module({
    imports: [
        TypeOrmModule.forFeature([TaskActionEntity]),
        TaskAttachmentModule,
        NotificationModule.register(false),
        AutomationsCrudModule,
        SearchModule,
        SpaceModule,
    ],
    providers: [TaskActionService, TaskActionEntitySubscriber],
    exports: [TaskActionService],
    controllers: [TaskActionController],
})
export class TaskActionModule {
    constructor() {
        contructorLogger(this);
    }
}
