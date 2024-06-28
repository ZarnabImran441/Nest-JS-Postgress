import {Global, Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {AuthorizationImplService} from './authorization-impl.service';
import {RoleEntity} from '../../model/role.entity';
import {AssignedPermissionEntity} from '../../model/assigned-permission.entity';
import {UserRoleEntity} from '../../model/user-role.entity';
import {ABSTRACT_AUTHORIZATION_SERVICE, contructorLogger} from '@lib/base-library';

@Global()
@Module({
    imports: [TypeOrmModule.forFeature([AssignedPermissionEntity, RoleEntity, UserRoleEntity])],
    providers: [{provide: ABSTRACT_AUTHORIZATION_SERVICE, useClass: AuthorizationImplService}],
    exports: [{provide: ABSTRACT_AUTHORIZATION_SERVICE, useClass: AuthorizationImplService}],
})
export class AuthorizationImplModule {
    constructor() {
        contructorLogger(this);
    }
}
