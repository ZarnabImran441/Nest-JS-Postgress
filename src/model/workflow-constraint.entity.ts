import {Column, Entity, JoinColumn, ManyToOne} from 'typeorm';
import {TaskManagementBaseEntity} from './base.entity';
import {WorkFlowTransitionEntity} from './workflow-transition.entity';

@Entity('workflow_constraint')
export class WorkFlowConstraintEntity extends TaskManagementBaseEntity {
    @ManyToOne(() => WorkFlowTransitionEntity, (item) => item.WorkflowConstraint, {nullable: false})
    @JoinColumn({name: 'workflow_transition_id', referencedColumnName: 'id'})
    WorkflowTransition: WorkFlowTransitionEntity;
    @Column({name: 'workflow_transition_id', nullable: false})
    workflowTransitionId: number;

    @Column({name: 'user_ids', type: String, array: true, nullable: true})
    userIds: string[];
}
