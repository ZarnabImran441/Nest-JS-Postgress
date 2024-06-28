import {Module} from '@nestjs/common';
import {WidgetsService} from './widgets.service';
import {WidgetsController} from './widgets.controller';
import {TypeOrmModule} from '@nestjs/typeorm';
import {WidgetEntity} from '../../model/widget.entity';
import {WidgetTypesEntity} from '../../model/widget-types.entity';
import {WidgetsRelationEntity} from '../../model/widget-relation.entity';
import {WidgetCategoriesEntity} from '../../model/widget-category.entity';
import {DashboardEntity} from '../../model/dashboard.entity';
import {FolderEntity} from '../../model/folder.entity';
import {WorkFlowEntity} from '../../model/workflow.entity';
import {TaskModule} from '../task/task.module';
import {TaskRelationEntity} from '../../model/task-relation.entity';
import {TaskEntity} from '../../model/task.entity';
import {ApprovalEntity} from '../../model/approval.entity';
import {UserEntity} from '../../model/user.entity';
import {CustomFieldDefinitionEntity} from '../../model/custom-field-definition.entity';
import {TaskAttachmentEntity} from '../../model/task-attachment.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            WidgetEntity,
            WidgetTypesEntity,
            WidgetsRelationEntity,
            WidgetCategoriesEntity,
            DashboardEntity,
            FolderEntity,
            WorkFlowEntity,
            TaskAttachmentEntity,
            TaskRelationEntity,
            TaskEntity,
            ApprovalEntity,
            UserEntity,
            ApprovalEntity,
            UserEntity,
            CustomFieldDefinitionEntity,
        ]),
        TaskModule,
    ],
    controllers: [WidgetsController],
    providers: [WidgetsService],
    exports: [WidgetsService],
})
export class WidgetsModule {}
