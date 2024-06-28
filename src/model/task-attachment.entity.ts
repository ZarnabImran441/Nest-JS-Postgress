import {Column, CreateDateColumn, Entity, JoinColumn, ManyToOne} from 'typeorm';
import {FileTypeOptions} from '../enum/task-action.enum';
import {TaskManagementBaseEntity} from './base.entity';
import {TaskEntity} from './task.entity';

@Entity('task_attachment')
export class TaskAttachmentEntity extends TaskManagementBaseEntity {
    @Column({name: 'file_name', length: 1024})
    fileName: string;

    @Column({name: 'thumbnail_name', length: 1024})
    thumbnailName: string;

    @Column({name: 'original_name', length: 256})
    originalName: string;

    @Column({name: 'file_type', type: 'enum', enum: FileTypeOptions})
    fileType: FileTypeOptions;

    @Column({length: 32, name: 'file_size'})
    fileSize: string;

    @Column({name: 'added_by', type: 'uuid', nullable: false})
    addedBy: string;

    @CreateDateColumn({name: 'added_at', type: 'timestamptz', default: () => 'LOCALTIMESTAMP', nullable: false})
    addedAt: Date;

    @Column({name: 'last_seen_by', type: 'uuid', nullable: false})
    lastSeenBy: string;

    @Column({name: 'last_seen_at', type: 'timestamptz', default: () => 'LOCALTIMESTAMP'})
    lastSeenAt: Date;

    @ManyToOne(() => TaskEntity, (flow) => flow.Attachments, {nullable: false})
    @JoinColumn({name: 'task_id', referencedColumnName: 'id'})
    Task: TaskEntity;
    @Column({name: 'task_id', nullable: false})
    taskId?: number;
}
