import {Check, Column, Entity, Index, JoinColumn, ManyToOne} from 'typeorm';
import {EntityTypeOptions} from '../module/authorization-impl/authorization.enum';
import {TaskManagementBaseEntity} from './base.entity';
import {RoleEntity} from './role.entity';

@Entity('assigned_permission')
@Index('entity_user_index', ['entityType', 'userId'])
@Check('(user_id IS NOT NULL AND role_id IS NULL) OR (user_id IS NULL AND role_id IS NOT NULL)')
@Check('permissions > 0')
export class AssignedPermissionEntity extends TaskManagementBaseEntity {
    @Column({name: 'entity_type', enum: EntityTypeOptions, type: 'enum'})
    entityType: EntityTypeOptions;

    @Column({name: 'entity_id', length: 64, nullable: true})
    entityId: string;

    @Column({name: 'user_id', length: 64, nullable: true})
    userId: string;

    @ManyToOne(() => RoleEntity, (item) => item.UserRoles, {nullable: true})
    @JoinColumn({name: 'role_id', referencedColumnName: 'id'})
    Role: RoleEntity;
    @Column({name: 'role_id', nullable: true})
    roleId: number;

    @Column({name: 'permissions', type: 'bigint'})
    permissions: number;

    @Column({name: 'inherited', nullable: true})
    inherited: boolean;

    @Column({name: 'banned'})
    banned: boolean;
}
