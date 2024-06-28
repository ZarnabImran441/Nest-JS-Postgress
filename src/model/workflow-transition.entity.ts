import {Check, Column, Entity, JoinColumn, ManyToOne, OneToMany, Unique} from 'typeorm';
import {TaskManagementBaseEntity} from './base.entity';
import {WorkFlowConstraintEntity} from './workflow-constraint.entity';
import {WorkFlowStateEntity} from './workflow-state.entity';

@Entity('workflow_transition')
@Unique(['fromStateId', 'toStateId'])
@Check('from_state_id <> to_state_id')
export class WorkFlowTransitionEntity extends TaskManagementBaseEntity {
    @ManyToOne(() => WorkFlowStateEntity, (item) => item.FromTransition, {nullable: false})
    @JoinColumn({name: 'from_state_id', referencedColumnName: 'id'})
    FromState: WorkFlowStateEntity;
    @Column({name: 'from_state_id', nullable: false})
    fromStateId: number;

    @ManyToOne(() => WorkFlowStateEntity, (item) => item.ToTransition, {nullable: false})
    @JoinColumn({name: 'to_state_id', referencedColumnName: 'id'})
    ToState: WorkFlowStateEntity;
    @Column({name: 'to_state_id', nullable: false})
    toStateId: number;

    @OneToMany(() => WorkFlowConstraintEntity, (item) => item.WorkflowTransition)
    WorkflowConstraint: WorkFlowConstraintEntity[];
}
