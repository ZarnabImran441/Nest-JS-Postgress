import {Column, Entity, JoinColumn, ManyToOne, Unique} from 'typeorm';
import {TaskManagementBaseEntity} from './base.entity';
import {DashboardEntity} from './dashboard.entity';
import {UserEntity} from './user.entity';

@Entity('dashboard_user_default')
@Unique(['userId'])
export class DashboardUserDefaultEntity extends TaskManagementBaseEntity {
    @ManyToOne(() => UserEntity, {nullable: false})
    @JoinColumn({name: 'user_id', referencedColumnName: 'id'})
    User: UserEntity;
    @Column({name: 'user_id', nullable: false})
    userId: string;

    @ManyToOne(() => DashboardEntity, {nullable: true, onDelete: 'CASCADE'})
    @JoinColumn({name: 'dashboard_id', referencedColumnName: 'id'})
    Dashboard: DashboardEntity;
    @Column({name: 'dashboard_id', nullable: true})
    dashboardId: number;
}
