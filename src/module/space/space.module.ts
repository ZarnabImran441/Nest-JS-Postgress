import {S3Module, contructorLogger} from '@lib/base-library';
import {Module, forwardRef} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {FolderEntity} from '../../model/folder.entity';
import {FolderEntitySubscriber} from '../../model/subscribers/folder.event-subscriber';
import {FolderModule} from '../folder/folder.module';
import {SearchModule} from '../search/search.module';
import {SpaceController} from './space.controller';
import {SpaceService} from './space.service';

@Module({
    imports: [TypeOrmModule.forFeature([FolderEntity]), forwardRef(() => FolderModule), S3Module, SearchModule],
    controllers: [SpaceController],
    providers: [SpaceService, FolderEntitySubscriber],
    exports: [SpaceService],
})
export class SpaceModule {
    constructor() {
        contructorLogger(this);
    }
}
