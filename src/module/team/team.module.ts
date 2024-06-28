import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {contructorLogger} from '@lib/base-library';
import {RoleEntity} from '../../model/role.entity';
import {UserRoleEntity} from '../../model/user-role.entity';
import {TeamController} from './team.controller';
import {TeamService} from './team.service';
import {TeamPermissionGroupEntity} from '../../model/team-permission-groups.entity';
import {PermissionManagerImplService} from '../permission-manager-impl/permission-manager-impl.service';

@Module({
    imports: [TypeOrmModule.forFeature([RoleEntity, UserRoleEntity, TeamPermissionGroupEntity])],
    controllers: [TeamController],
    providers: [TeamService, PermissionManagerImplService],
    exports: [],
})
export class TeamModule {
    constructor() {
        contructorLogger(this);
    }
}
