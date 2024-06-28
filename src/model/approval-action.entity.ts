import {Column, Entity, JoinColumn, ManyToOne} from 'typeorm';
import {ApprovalActionOptions} from '../enum/approval-action.enum';
import {ApprovalEntity} from './approval.entity';
import {TaskManagementBaseEntity} from './base.entity';

@Entity('approval_action')
export class ApprovalActionEntity extends TaskManagementBaseEntity {
    @Column({length: 512, nullable: true})
    comment: string;

    @Column({name: 'mentioned_users', type: String, array: true, nullable: true})
    mentionedUsers: string[];

    @Column({nullable: false, default: () => 'CURRENT_TIMESTAMP'})
    date: Date;
    //Users may change their mind and cancel their approval, but since we need to keep an audit trail of actions, we need to keep the old action in the database.
    @Column({type: Boolean, default: false})
    cancelled: boolean;

    @Column({type: 'uuid', nullable: false})
    user: string;

    @ManyToOne(() => ApprovalEntity, (approval) => approval.actions, {nullable: false})
    @JoinColumn({name: 'approval_id', referencedColumnName: 'id'})
    approval: ApprovalEntity;

    @Column({type: 'enum', nullable: false, enum: ApprovalActionOptions})
    action: ApprovalActionOptions;

    @Column({name: 'redirect_to', type: String, array: true, nullable: true})
    redirectTo: string[];
}
