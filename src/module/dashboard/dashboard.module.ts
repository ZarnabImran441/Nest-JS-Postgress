import {Module} from '@nestjs/common';
import {DashboardController} from './dashboard.controller';
import {DashboardService} from './dashboard.service';
import {TypeOrmModule} from '@nestjs/typeorm';
import {DashboardEntity} from '../../model/dashboard.entity';
import {FolderEntity} from '../../model/folder.entity';
import {contructorLogger} from '@lib/base-library';
import {AuthorizationImplModule} from '../authorization-impl/authorization-impl.module';
import {DashboardFolderEntity} from '../../model/dashboard-folder-entity';
import {WidgetsRelationEntity} from '../../model/widget-relation.entity';
import {WidgetEntity} from '../../model/widget.entity';
import {WidgetTypesEntity} from '../../model/widget-types.entity';
import {WidgetCategoriesEntity} from '../../model/widget-category.entity';
import {DashboardUserDefaultEntity} from '../../model/dashboard-user-default.entity';
import {DashboardUserFavouriteEntity} from '../../model/dashboard-user-favourite.entity';
import {AssignedPermissionEntity} from '../../model/assigned-permission.entity';
import {UserEntity} from '../../model/user.entity';
import {WidgetsModule} from '../widgets/widgets.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            DashboardEntity,
            FolderEntity,
            DashboardFolderEntity,
            DashboardUserDefaultEntity,
            DashboardUserFavouriteEntity,
            AssignedPermissionEntity,
            UserEntity,
            WidgetsRelationEntity,
            WidgetEntity,
            WidgetTypesEntity,
            WidgetCategoriesEntity,
        ]),
        AuthorizationImplModule,
        WidgetsModule,
    ],
    controllers: [DashboardController],
    providers: [DashboardService],
    exports: [DashboardService],
})
export class DashboardModule {
    constructor() {
        contructorLogger(this);
    }
}
