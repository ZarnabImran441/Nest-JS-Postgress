import {Column, Entity, OneToMany, Unique} from 'typeorm';
import {TaskManagementBaseEntity} from './base.entity';
import {FolderSpaceTeamEntity} from './folder-space-team.entity';
import {TeamPermissionGroupEntity} from './team-permission-groups.entity';
import {UserRoleEntity} from './user-role.entity';

// role = team
@Entity('role')
@Unique(['code'])
export class RoleEntity extends TaskManagementBaseEntity {
    @Column({length: 32})
    code: string;

    @Column({default: true})
    active: boolean;

    @Column({length: 512, nullable: true})
    description: string;

    @OneToMany(() => UserRoleEntity, (item) => item.Role)
    UserRoles: UserRoleEntity[];

    @OneToMany(() => TeamPermissionGroupEntity, (item) => item.Team)
    TeamPermissionGroups: TeamPermissionGroupEntity[];

    //** Relation for space */
    @OneToMany(() => FolderSpaceTeamEntity, (item) => item.Team)
    FolderSpaceTeams: FolderSpaceTeamEntity[];
}
