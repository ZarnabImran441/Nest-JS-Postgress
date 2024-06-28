import {TypeOrmModule} from '@nestjs/typeorm';
import {Module} from '@nestjs/common';
import {ImportanceService} from './importance.service';
import {ImportanceController} from './importance.controller';
import {ImportanceEntity} from '../../model/importance.entity';
import {contructorLogger} from '@lib/base-library';

/**
 * Represents a module for managing the importance of entities.
 *
 * @module ImportanceModule
 */
@Module({
    imports: [TypeOrmModule.forFeature([ImportanceEntity])],
    providers: [ImportanceService],
    exports: [ImportanceService],
    controllers: [ImportanceController],
})
export class ImportanceModule {
    /**
     * @class
     * @classdesc Represents a Constructor class.
     */
    constructor() {
        contructorLogger(this);
    }
}
