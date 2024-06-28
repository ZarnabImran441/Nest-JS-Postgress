import {Column, Entity, JoinColumn, ManyToOne, Unique} from 'typeorm';
import {TaskManagementBaseEntity} from './base.entity';
import {TaskEntity} from './task.entity';

@Unique(['Task', 'userId'])
@Entity('task_follower')
export class TaskFollowerEntity extends TaskManagementBaseEntity {
    @ManyToOne(() => TaskEntity, (item) => item.Followers, {nullable: false})
    @JoinColumn({name: 'task_id', referencedColumnName: 'id'})
    Task: TaskEntity;
    @Column({name: 'task_id', nullable: false})
    taskId: number;

    @Column({name: 'user_id', type: 'uuid', nullable: false})
    userId: string;
}
