import {EventsHandlerService} from './events-handler.service';
import {Module} from '@nestjs/common';
import {contructorLogger} from '@lib/base-library';
import {TypeOrmModule} from '@nestjs/typeorm';
import {UserEntity} from '../../model/user.entity';
import {NotificationModule} from '../notification/notification.module';
import {AutomationsCrudModule} from '../automations/automations-crud.module';
import {DashboardModule} from '../dashboard/dashboard.module';

@Module({
    imports: [TypeOrmModule.forFeature([UserEntity]), AutomationsCrudModule, DashboardModule, NotificationModule.register(false)],
    providers: [EventsHandlerService],
    exports: [EventsHandlerService],
})
export class EventsHandlerModule {
    constructor() {
        contructorLogger(this);
    }
}
