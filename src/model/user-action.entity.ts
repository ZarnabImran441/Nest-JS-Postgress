import {Column, Entity, JoinColumn, ManyToOne} from 'typeorm';
import {TaskManagementBaseEntity} from './base.entity';
import {TaskEntity} from './task.entity';
@Entity('user_action')
export class UserActionEntity extends TaskManagementBaseEntity {
    @Column('timestamp with time zone', {nullable: true, default: null})
    checkedOn: Date;

    @Column({name: 'user_id', type: 'uuid'})
    userId: string;

    @Column({name: 'description', length: 128})
    description: string;

    @ManyToOne(() => TaskEntity, (task) => task.UserActions, {nullable: true})
    @JoinColumn({name: 'task_id', referencedColumnName: 'id'})
    Task: TaskEntity;
    @Column({name: 'task_id', nullable: true})
    taskId: number;

    @Column({name: 'checked', default: false})
    checked: boolean;
}
