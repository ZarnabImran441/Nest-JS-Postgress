import {TypeOrmModule} from '@nestjs/typeorm';
import {Module} from '@nestjs/common';
import {FolderFilterService} from './folder-filter.service';
import {FolderFilterController} from './folder-filter.controller';
import {FolderFilterEntity} from '../../../model/folder-filter.entity';
import {contructorLogger} from '@lib/base-library';

@Module({
    imports: [TypeOrmModule.forFeature([FolderFilterEntity])],
    providers: [FolderFilterService],
    exports: [FolderFilterService],
    controllers: [FolderFilterController],
})
export class FolderFilterModule {
    constructor() {
        contructorLogger(this);
    }
}
