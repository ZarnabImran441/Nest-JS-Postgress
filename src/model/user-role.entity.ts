import {Column, Entity, JoinColumn, ManyToOne, Unique} from 'typeorm';
import {TaskManagementBaseEntity} from './base.entity';
import {RoleEntity} from './role.entity';

@Entity('user_role')
@Unique(['userId', 'Role'])
export class UserRoleEntity extends TaskManagementBaseEntity {
    @Column({name: 'user_id', type: 'uuid', nullable: false})
    userId: string;

    @ManyToOne(() => RoleEntity, (item) => item.UserRoles, {nullable: false})
    @JoinColumn({name: 'role_id', referencedColumnName: 'id'})
    Role: RoleEntity;
    @Column({name: 'role_id', nullable: false})
    roleId: number;

    @Column({name: 'banned'})
    banned: boolean;
}
