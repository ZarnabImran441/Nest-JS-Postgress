import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {TagController} from './tag.controller';
import {TagService} from './tag.service';
import {TagEntity} from '../../model/tag.entity';
import {contructorLogger} from '@lib/base-library';

@Module({
    imports: [TypeOrmModule.forFeature([TagEntity])],
    controllers: [TagController],
    providers: [TagService],
    exports: [TagService],
})
export class TagModule {
    constructor() {
        contructorLogger(this);
    }
}
