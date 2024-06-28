import {stringArrayTransformer} from '@lib/base-library';
import {Column, Entity, JoinColumn, ManyToOne} from 'typeorm';
import {TaskActionOptions} from '../enum/task-action.enum';
import {TaskActionParameterInterface} from '../interface/task-action-parameter.interface';
import {TaskManagementBaseEntity} from './base.entity';
import {TaskEntity} from './task.entity';

@Entity('task_action')
export class TaskActionEntity extends TaskManagementBaseEntity {
    @Column({enum: TaskActionOptions, type: 'enum'})
    action: TaskActionOptions;

    @Column('timestamp with time zone', {nullable: false, default: () => 'CURRENT_TIMESTAMP'})
    date: Date;

    @Column({type: 'jsonb', nullable: true})
    user: object;

    @Column({name: 'message_id', length: 128})
    messageId: string;

    @Column({type: 'jsonb', nullable: true})
    parameters: TaskActionParameterInterface;

    @Column({type: 'simple-array', nullable: true, array: true, transformer: stringArrayTransformer})
    mentionMembers: string[];

    @Column('int', {nullable: true, array: true})
    attachmentsIds: number[];

    @Column({type: 'jsonb', nullable: true})
    task: object;

    @ManyToOne(() => TaskEntity, (flow) => flow.Actions, {nullable: true})
    @JoinColumn({name: 'task_id', referencedColumnName: 'id'})
    Task: TaskEntity;
    @Column({name: 'task_id', nullable: true})
    taskId: number;
}
