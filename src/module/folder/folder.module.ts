import {contructorLogger, S3Module} from '@lib/base-library';
import {forwardRef, Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {NotificationsApiModule} from '@plexxis/notification-api';
import {CustomFieldDefinitionEntity} from '../../model/custom-field-definition.entity';
import {FolderEntity} from '../../model/folder.entity';
import {FolderEntitySubscriber} from '../../model/subscribers/folder.event-subscriber';
import {TaskAttachmentEntity} from '../../model/task-attachment.entity';
import {TaskEntity} from '../../model/task.entity';
import {TreeViewEntity} from '../../model/tree-view.entity';
import {AuthorizationImplModule} from '../authorization-impl/authorization-impl.module';
import {CustomFieldDefinitionModule} from '../custom-field-definition/custom-field-definition.module';
import {NotificationModule} from '../notification/notification.module';
import {NotificationApiConnectorModule} from '../notifications-api-connector/notification-api-connector.module';
import {SearchModule} from '../search/search.module';
import {SpaceModule} from '../space/space.module';
import {TaskAttachmentModule} from '../task/task-attachment/task-attachment.module';
import {TaskModule} from '../task/task.module';
import {TreeViewModule} from '../tree-view/tree-view.module';
import {UserModule} from '../user/user.module';
import {WorkFlowModule} from '../workflow/workflow.module';
import {FolderWorkflowModule} from './folder-workflow/folder-workflow.module';
import {FolderController} from './folder.controller';
import {FolderService} from './folder.service';
import {FolderRelationEntitySubscriber} from '../../model/subscribers/folder-relation.event-subscriber';

@Module({
    imports: [
        TypeOrmModule.forFeature([FolderEntity, CustomFieldDefinitionEntity, TreeViewEntity, TaskEntity, TaskAttachmentEntity]),
        forwardRef(() => SpaceModule),
        TreeViewModule,
        CustomFieldDefinitionModule,
        TaskModule,
        UserModule,
        TaskAttachmentModule,
        NotificationsApiModule,
        NotificationModule.register(false),
        FolderWorkflowModule,
        WorkFlowModule,
        AuthorizationImplModule,
        NotificationApiConnectorModule,
        S3Module,
        SearchModule,
    ],
    providers: [FolderService, FolderEntitySubscriber, FolderRelationEntitySubscriber],
    exports: [FolderService],
    controllers: [FolderController],
})
export class FolderModule {
    constructor() {
        contructorLogger(this);
    }
}
