import {TypeOrmModule} from '@nestjs/typeorm';
import {Module} from '@nestjs/common';
import {contructorLogger} from '@lib/base-library';
import {CustomFieldCollectionEntity} from '../../model/custom-field-collection.entity';
import {CustomFieldDefinitionEntity} from '../../model/custom-field-definition.entity';
import {CustomFieldCollectionService} from './custom-field-collection..service';
import {CustomFieldCollectionController} from './custom-field-collection.controller';
import {CustomFieldCollectionRelationEntity} from '../../model/custom-field-collection-relation.entity';

@Module({
    imports: [TypeOrmModule.forFeature([CustomFieldCollectionEntity, CustomFieldDefinitionEntity, CustomFieldCollectionRelationEntity])],
    providers: [CustomFieldCollectionService],
    exports: [CustomFieldCollectionService],
    controllers: [CustomFieldCollectionController],
})
export class CustomFieldCollectionModule {
    constructor() {
        contructorLogger(this);
    }
}
