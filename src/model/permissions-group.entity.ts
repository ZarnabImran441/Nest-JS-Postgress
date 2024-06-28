import {Column, Entity, OneToMany} from 'typeorm';
import {TaskManagementBaseEntity} from './base.entity';
import {TeamPermissionGroupEntity} from './team-permission-groups.entity';
import {UserPermissionsGroupEntity} from './user-permission-groups.entity';

@Entity('permissions_group')
export class PermissionGroupEntity extends TaskManagementBaseEntity {
    @Column({length: 128})
    title: string;

    @Column({length: 256, nullable: true})
    description: string;

    @Column({type: 'jsonb', nullable: false})
    permissions: object;

    @OneToMany(() => UserPermissionsGroupEntity, (item) => item.PermissionsGroup)
    UserPermissionsGroup: UserPermissionsGroupEntity[];

    @OneToMany(() => TeamPermissionGroupEntity, (item) => item.PermissionGroup)
    TeamPermissionGroups: TeamPermissionGroupEntity[];
}
