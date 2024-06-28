import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {contructorLogger} from '@lib/base-library';
import {FolderEntity} from '../../model/folder.entity';
import {FolderModule} from '../folder/folder.module';
import {SpaceModule} from '../space/space.module';
import {CustomFieldDefinitionModule} from '../custom-field-definition/custom-field-definition.module';
import {TagModule} from '../tag/tag.module';
import {InitialSpaceSetupController} from './initial-space-setup.controller';
import {InitialSpaceSetupService} from './initial-space-setup.service';
import {WorkFlowModule} from '../workflow/workflow.module';
import {UserModule} from '../user/user.module';
import {CustomFieldCollectionModule} from '../custom-field-collection/custom-field-collection.module';
import {TagCollectionModule} from '../tag-collection/tags-collection.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([FolderEntity]),
        FolderModule,
        SpaceModule,
        TagModule,
        CustomFieldDefinitionModule,
        WorkFlowModule,
        UserModule,
        CustomFieldCollectionModule,
        TagCollectionModule,
    ],
    controllers: [InitialSpaceSetupController],
    providers: [InitialSpaceSetupService],
    exports: [InitialSpaceSetupService],
})
export class InitialSpaceSetupModule {
    constructor() {
        contructorLogger(this);
    }
}
