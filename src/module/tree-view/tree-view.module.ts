import {Module} from '@nestjs/common';
import {TreeViewService} from './tree-view.service';
import {TreeViewController} from './tree-view.controller';
import {TypeOrmModule} from '@nestjs/typeorm';
import {TreeViewEntity} from '../../model/tree-view.entity';
import {contructorLogger} from '@lib/base-library';

@Module({
    imports: [TypeOrmModule.forFeature([TreeViewEntity])],
    controllers: [TreeViewController],
    providers: [TreeViewService],
    exports: [TreeViewService],
})
export class TreeViewModule {
    constructor() {
        contructorLogger(this);
    }
}
