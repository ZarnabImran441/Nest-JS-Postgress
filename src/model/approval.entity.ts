import {Column, DeleteDateColumn, Entity, JoinColumn, ManyToOne, OneToMany} from 'typeorm';
import {ApprovalStatusOptions} from '../enum/approval-status.enum';
import {ApprovalActionEntity} from './approval-action.entity';
import {ApprovalAttachmentEntity} from './approval-attachment.entity';
import {TaskManagementBaseEntity} from './base.entity';
import {TaskEntity} from './task.entity';

@Entity('approval')
export class ApprovalEntity extends TaskManagementBaseEntity {
    @Column({length: 512, nullable: true})
    description: string;

    @Column({name: 'assigned_approvers', type: String, array: true, nullable: true})
    assignedApprovers: string[];

    @Column({name: 'required_approvals', type: Number, nullable: false})
    requiredApprovals: number;

    @Column({type: 'enum', nullable: false, enum: ApprovalStatusOptions, default: 'PENDING'})
    status: ApprovalStatusOptions;

    @Column({name: 'resolution_date', nullable: true})
    resolutionDate: Date;

    @DeleteDateColumn({name: 'deleted_at', nullable: true})
    deletedAt: Date;

    @Column({name: 'task_id', nullable: false})
    taskId: number;

    @ManyToOne(() => TaskEntity, (task) => task.approvals, {nullable: false})
    @JoinColumn({name: 'task_id', referencedColumnName: 'id'})
    task: TaskEntity;

    @OneToMany(() => ApprovalActionEntity, (action) => action.approval)
    actions: ApprovalActionEntity[];
    @OneToMany(() => ApprovalAttachmentEntity, (attachment) => attachment.approval)
    attachments: ApprovalAttachmentEntity[];
}
