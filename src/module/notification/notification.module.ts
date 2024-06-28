import {TypeOrmModule} from '@nestjs/typeorm';
import {DynamicModule, forwardRef, Module} from '@nestjs/common';
import {NotificationService} from './notification.service';
import {NotificationController} from './notification.controller';
import {NotificationEntity} from '../../model/notification.entity';
import {contructorLogger, NotificationsSubscriptionModule} from '@lib/base-library';
import {UserEntity} from '../../model/user.entity';
import {TaskAttachmentModule} from '../task/task-attachment/task-attachment.module';
import {TaskAttachmentEntity} from '../../model/task-attachment.entity';
import {FolderEntity} from '../../model/folder.entity';
import {TaskEntity} from '../../model/task.entity';
import {FolderNotificationsSettingsEntity} from '../../model/folder-notifications-settings.entity';
import {NotificationServiceConfig, testNotificationsServiceConfig} from '../../config/notification-service.config';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            NotificationEntity,
            UserEntity,
            TaskAttachmentEntity,
            FolderEntity,
            TaskEntity,
            FolderNotificationsSettingsEntity,
        ]),
        forwardRef(() => TaskAttachmentModule),
        NotificationsSubscriptionModule.register(NotificationServiceConfig),
    ],
    providers: [NotificationService],
    exports: [NotificationService],
    controllers: [NotificationController],
})
export class NotificationModule {
    constructor() {
        contructorLogger(this);
    }
    static register(isTesting: boolean): DynamicModule {
        if (isTesting) {
            return {
                module: NotificationModule,
                imports: [
                    TypeOrmModule.forFeature([
                        NotificationEntity,
                        UserEntity,
                        TaskAttachmentEntity,
                        FolderEntity,
                        TaskEntity,
                        FolderNotificationsSettingsEntity,
                    ]),
                    forwardRef(() => TaskAttachmentModule),
                    NotificationsSubscriptionModule.register(testNotificationsServiceConfig),
                ],
                providers: [NotificationService],
                exports: [NotificationService],
                controllers: [NotificationController],
            };
        }
        return {
            module: NotificationModule,
            imports: [
                TypeOrmModule.forFeature([
                    NotificationEntity,
                    UserEntity,
                    TaskAttachmentEntity,
                    FolderEntity,
                    TaskEntity,
                    FolderNotificationsSettingsEntity,
                ]),
                forwardRef(() => TaskAttachmentModule),
                NotificationsSubscriptionModule.register(NotificationServiceConfig),
            ],
            providers: [NotificationService],
            exports: [NotificationService],
            controllers: [NotificationController],
        };
    }
}
