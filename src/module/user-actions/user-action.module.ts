import {Module} from '@nestjs/common';
import {UserActionController} from './user-action.controller';
import {UserActionService} from './user-action.service';
import {TypeOrmModule} from '@nestjs/typeorm';
import {TaskEntity} from '../../model/task.entity';
import {UserActionEntity} from '../../model/user-action.entity';
import {contructorLogger} from '@lib/base-library';

@Module({
    imports: [TypeOrmModule.forFeature([TaskEntity, UserActionEntity])],
    controllers: [UserActionController],
    providers: [UserActionService],
})
export class UserActionModule {
    constructor() {
        contructorLogger(this);
    }
}
