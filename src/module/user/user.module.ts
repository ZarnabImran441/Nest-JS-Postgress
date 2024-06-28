import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {UserService} from './user.service';
import {UserController} from './user.controller';
import {UserEntity} from '../../model/user.entity';
import {AuthorizationImplModule} from '../authorization-impl/authorization-impl.module';
import {S3Module, contructorLogger} from '@lib/base-library';
import {HttpModule} from '@nestjs/axios';
@Module({
    imports: [TypeOrmModule.forFeature([UserEntity]), S3Module, AuthorizationImplModule, HttpModule],
    providers: [UserService],
    controllers: [UserController],
    exports: [UserService],
})
export class UserModule {
    constructor() {
        contructorLogger(this);
    }
}
