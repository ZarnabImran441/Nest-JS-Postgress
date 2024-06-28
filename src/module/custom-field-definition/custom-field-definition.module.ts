import {Module} from '@nestjs/common';
import {CustomFieldDefinitionController} from './custom-field-definition.controller';
import {TypeOrmModule} from '@nestjs/typeorm';
import {CustomFieldDefinitionService} from './custom-field-definition.service';
import {CustomFieldDefinitionEntity} from '../../model/custom-field-definition.entity';
import {contructorLogger} from '@lib/base-library';

@Module({
    imports: [TypeOrmModule.forFeature([CustomFieldDefinitionEntity])],
    controllers: [CustomFieldDefinitionController],
    providers: [CustomFieldDefinitionService],
    exports: [CustomFieldDefinitionService],
})
export class CustomFieldDefinitionModule {
    constructor() {
        contructorLogger(this);
    }
}
