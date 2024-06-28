import {TypeOrmModule} from '@nestjs/typeorm';
import {Module} from '@nestjs/common';
import {DisplacementGroupService} from './displacement-group.service';
import {DisplacementGroupController} from './displacement-group.controller';
import {DisplacementGroupEntity} from '../../model/displacement-group.entity';
import {DisplacementCodeEntity} from '../../model/displacement-code.entity';
import {contructorLogger} from '@lib/base-library';

@Module({
    imports: [TypeOrmModule.forFeature([DisplacementGroupEntity, DisplacementCodeEntity])],
    providers: [DisplacementGroupService],
    exports: [DisplacementGroupService],
    controllers: [DisplacementGroupController],
})
export class DisplacementGroupModule {
    constructor() {
        contructorLogger(this);
    }
}
