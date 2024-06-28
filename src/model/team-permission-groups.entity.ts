import {Column, Entity, JoinColumn, ManyToOne, Unique} from 'typeorm';
import {TaskManagementBaseEntity} from './base.entity';
import {PermissionGroupEntity} from './permissions-group.entity';
import {RoleEntity} from './role.entity';

//** Role entity = team entity */
@Entity('team_permission_groups')
@Unique(['Team', 'PermissionGroup'])
export class TeamPermissionGroupEntity extends TaskManagementBaseEntity {
    @ManyToOne(() => RoleEntity, (flow) => flow.TeamPermissionGroups, {nullable: false})
    @JoinColumn({name: 'team_id', referencedColumnName: 'id'})
    Team: RoleEntity;
    @Column({name: 'team_id', nullable: false})
    teamId: number;

    @ManyToOne(() => PermissionGroupEntity, (item) => item.UserPermissionsGroup, {nullable: false})
    @JoinColumn({name: 'permission_group_id', referencedColumnName: 'id'})
    PermissionGroup: PermissionGroupEntity;
    @Column({name: 'permission_group_id', nullable: false})
    permissionGroupId: number;
}
