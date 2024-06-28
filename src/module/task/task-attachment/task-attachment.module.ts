import {TypeOrmModule} from '@nestjs/typeorm';
import {forwardRef, Module} from '@nestjs/common';
import {TaskAttachmentService} from './task-attachment.service';
import {TaskAttachmentController} from './task-attachment.controller';
import {contructorLogger, S3Module} from '@lib/base-library';
import {TaskAttachmentEntity} from '../../../model/task-attachment.entity';
import {NotificationModule} from '../../notification/notification.module';
import {TaskAttachmentEntitySubscriber} from '../../../model/subscribers/task-attachment.event-subscriber';
import {SearchModule} from '../../search/search.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([TaskAttachmentEntity]),
        S3Module,
        forwardRef(() => NotificationModule.register(false)),
        SearchModule,
    ],
    providers: [TaskAttachmentService, TaskAttachmentEntitySubscriber],
    exports: [TaskAttachmentService],
    controllers: [TaskAttachmentController],
})
export class TaskAttachmentModule {
    constructor() {
        contructorLogger(this);
    }
}
