import {MiddlewareConsumer, Module, NestModule} from '@nestjs/common';
import {ScheduleModule} from '@nestjs/schedule';
import {WinstonModule} from 'nest-winston';
import {LoggerConfig} from './config/logger.config';
import {DatabaseConfig} from './config/database.config';
import {TypeOrmModule} from '@nestjs/typeorm';
import {BullModule} from '@nestjs/bull';
import {BullConfig} from './config/bull.config';
import {MulterModule} from '@nestjs/platform-express';
import {MulterConfig} from './config/multer.config';
import {ProviderConfig} from './config/provider.config';
import {HealthConfig} from './config/health.config';
import {UserModule} from './module/user/user.module';
import {S3Config} from './config/s3.config';
import {ServeStaticModule} from '@nestjs/serve-static';
import {ServeStaticConfig} from './config/serve-static.config';
import {AuthorizationConfig} from './config/authorization.config';
import {EventEmitterModule} from '@nestjs/event-emitter';
import {FolderWorkflowModule} from './module/folder/folder-workflow/folder-workflow.module';
import {FolderModule} from './module/folder/folder.module';
import {CustomFieldDefinitionModule} from './module/custom-field-definition/custom-field-definition.module';
import {CustomFieldValueModule} from './module/custom-field-value/custom-field-value.module';
import {FolderFilterModule} from './module/folder/folder-filter/folder-filter.module';
import {NotificationModule} from './module/notification/notification.module';
import {NotificationApiConnectorModule} from './module/notifications-api-connector/notification-api-connector.module';
import {TagModule} from './module/tag/tag.module';
import {TaskModule} from './module/task/task.module';
import {TaskActionModule} from './module/task/task-action/task-action.module';
import {TaskAttachmentModule} from './module/task/task-attachment/task-attachment.module';
import {ImportanceModule} from './module/importance/importance.module';
import {TreeViewModule} from './module/tree-view/tree-view.module';
import {WorkFlowModule} from './module/workflow/workflow.module';
import {StreamViewModule} from './module/stream-view/stream-view.module';
import {NotificationApiConnectorConfig} from './config/notification-api-connector.config';
import {EventEmitterConfig} from './config/event-emitter.config';
import {UserActionModule} from './module/user-actions/user-action.module';
import {PermissionManagerPolicyConfig} from './module/permission-manager-impl/permission-manager-impl.config';
import {ApprovalsModule} from './module/approvals/approvals.module';
import {EventsHandlerModule} from './module/events-handler/events-handler.module';
import {PasAuthenticationConfig} from './config/pas-authentication.config';
import {CacheConfig} from './config/cache.config';
import {AuthorizationImplModule} from './module/authorization-impl/authorization-impl.module';
import {PermissionManagerImplService} from './module/permission-manager-impl/permission-manager-impl.service';
import {StatsModule} from './module/stats/stats.module';
import {PasUserSyncConfig} from './config/pas-user-sync.config';
import {AutomationsConfig} from './config/automations.config';
import {BullMonitorConfig} from './config/bull-monitor.config';
import {NotificationServiceConfig} from './config/notification-service.config';
import {DisplacementGroupModule} from './module/displacement-group/displacement-group.module';
import {DashboardModule} from './module/dashboard/dashboard.module';
import {
    AuthorizationModule,
    BullMonitorModule,
    HealthModule,
    MetricsModule,
    NotificationsSubscriptionModule,
    PasAuthenticationModule,
    PasUserSyncModule,
    PermissionManagerModule,
    PrometheusModule,
    RedisCacheModule,
    S3Module,
} from '@lib/base-library';
import {AutomationsCrudModule} from './module/automations/automations-crud.module';
import {SpaceModule} from './module/space/space.module';
import {CustomFieldCollectionModule} from './module/custom-field-collection/custom-field-collection.module';
import {WidgetsModule} from './module/widgets/widgets.module';
import {TagCollectionModule} from './module/tag-collection/tags-collection.module';
import {TeamModule} from './module/team/team.module';
import {InitialSpaceSetupModule} from './module/initial-space-setup/initial-space-setup.module';
import {POSTGRESQL_BACKUP_PATH} from './const/env.const';
import * as contentDisposition from 'content-disposition';
import * as serveStatic from 'serve-static';
import * as serveIndex from 'serve-index';
import {RequestContextModule} from 'nestjs-request-context';
import {ServiceVersionModule} from '@lib/base-library/module/service-version';

@Module({
    imports: [
        RequestContextModule,
        TypeOrmModule.forRootAsync(DatabaseConfig),
        BullModule.forRoot(BullConfig),
        RedisCacheModule.register(CacheConfig),
        MulterModule.register(MulterConfig),
        ScheduleModule.forRoot(),
        WinstonModule.forRoot(LoggerConfig),
        ServeStaticModule.forRoot(ServeStaticConfig),
        EventEmitterModule.forRoot(EventEmitterConfig),
        NotificationsSubscriptionModule.register(NotificationServiceConfig),
        S3Module.register(S3Config),
        HealthModule.register(HealthConfig),
        MetricsModule.register(HealthConfig),
        PasAuthenticationModule.register(PasAuthenticationConfig),
        PermissionManagerModule.register(PermissionManagerImplService, PermissionManagerPolicyConfig),
        AuthorizationModule.register(AuthorizationConfig),
        NotificationApiConnectorModule.register(NotificationApiConnectorConfig),
        PasUserSyncModule.register(PasUserSyncConfig),
        AuthorizationImplModule,
        PrometheusModule,
        FolderModule,
        CustomFieldDefinitionModule,
        CustomFieldValueModule,
        FolderFilterModule,
        FolderWorkflowModule,
        NotificationModule.register(false),
        TagModule,
        TagCollectionModule,
        TaskModule,
        TaskActionModule,
        TaskAttachmentModule,
        ImportanceModule,
        TreeViewModule,
        WorkFlowModule,
        UserModule,
        StreamViewModule,
        UserActionModule,
        EventsHandlerModule,
        ApprovalsModule,
        StatsModule,
        DisplacementGroupModule,
        SpaceModule,
        CustomFieldCollectionModule,
        ApprovalsModule,
        EventsHandlerModule,
        NotificationsSubscriptionModule.register(NotificationServiceConfig),
        AutomationsCrudModule.register(AutomationsConfig),
        BullMonitorModule.register(...BullMonitorConfig),
        DashboardModule,
        WidgetsModule,
        SpaceModule,
        InitialSpaceSetupModule,
        TeamModule,
        ServiceVersionModule,
    ],
    providers: ProviderConfig(),
    exports: [],
})
export class TaskManagementModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void {
        // if (WEB_APP_PATH.length > 0 && WEB_APP_PATH !== 'false') {
        //     consumer.apply(serveStatic(WEB_APP_PATH, {index: false})).forRoutes('/');
        // }
        if (POSTGRESQL_BACKUP_PATH.length > 0 && POSTGRESQL_BACKUP_PATH !== 'false') {
            consumer
                .apply(
                    serveStatic(POSTGRESQL_BACKUP_PATH, {
                        index: false,
                        setHeaders: setHeaders,
                    })
                )
                .forRoutes('/postgresql-backups');
            consumer
                .apply(
                    serveIndex(POSTGRESQL_BACKUP_PATH, {
                        icons: true,
                        view: 'details',
                    })
                )
                .forRoutes('/postgresql-backups');
        }
    }
}

function setHeaders(res, path): void {
    res.setHeader('Content-Disposition', contentDisposition(path));
}
