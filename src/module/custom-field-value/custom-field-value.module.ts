import {Module} from '@nestjs/common';
import {CustomFieldValueController} from './custom-field-value.controller';
import {TypeOrmModule} from '@nestjs/typeorm';
import {CustomFieldValueService} from './custom-field-value.service';
import {CustomFieldValueEntity} from '../../model/custom-field-value.entity';
import {CustomFieldDefinitionEntity} from '../../model/custom-field-definition.entity';
import {contructorLogger} from '@lib/base-library';

@Module({
    imports: [TypeOrmModule.forFeature([CustomFieldValueEntity, CustomFieldDefinitionEntity])],
    controllers: [CustomFieldValueController],
    providers: [CustomFieldValueService],
})
export class CustomFieldValueModule {
    constructor() {
        contructorLogger(this);
    }
}
