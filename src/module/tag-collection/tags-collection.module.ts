import {TypeOrmModule} from '@nestjs/typeorm';
import {Module} from '@nestjs/common';
import {contructorLogger} from '@lib/base-library';
import {TagCollectionService} from './tags-collection.service';
import {TagCollectionController} from './tags-collection.controller';
import {TagCollectionRelationEntity} from '../../model/tag-collection-relation.entity';
import {TagCollectionEntity} from '../../model/tag-collection.entity';
import {TagEntity} from '../../model/tag.entity';

@Module({
    imports: [TypeOrmModule.forFeature([TagCollectionEntity, TagEntity, TagCollectionRelationEntity])],
    providers: [TagCollectionService],
    exports: [TagCollectionService],
    controllers: [TagCollectionController],
})
export class TagCollectionModule {
    constructor() {
        contructorLogger(this);
    }
}
