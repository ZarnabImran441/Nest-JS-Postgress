import {Column, Entity, JoinColumn, ManyToOne, Unique} from 'typeorm';
import {TaskManagementBaseEntity} from './base.entity';
import {PermissionGroupEntity} from './permissions-group.entity';

@Entity('user_permissions_group')
@Unique(['userId', 'permissionsGroupId'])
export class UserPermissionsGroupEntity extends TaskManagementBaseEntity {
    @Column({name: 'user_id', type: 'uuid', nullable: false})
    userId: string;

    @ManyToOne(() => PermissionGroupEntity, (item) => item.UserPermissionsGroup, {nullable: false})
    @JoinColumn({name: 'permissions_group_id', referencedColumnName: 'id'})
    PermissionsGroup: PermissionGroupEntity;
    @Column({name: 'permissions_group_id', nullable: false})
    permissionsGroupId: number;
}
