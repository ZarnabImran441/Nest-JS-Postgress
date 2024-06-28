import {Check, Column, Entity, JoinColumn, ManyToOne, OneToMany, Unique} from 'typeorm';
import {TaskManagementBaseEntity} from './base.entity';
import {DisplacementCodeEntity} from './displacement-code.entity';
import {SystemStageEntity} from './system-stage.entity';
import {TaskRelationEntity} from './task-relation.entity';
import {WorkFlowTransitionEntity} from './workflow-transition.entity';
import {WorkFlowEntity} from './workflow.entity';

@Entity('workflow_state')
@Unique(['title', 'WorkFlow', 'code'])
@Check('(displacement_code_id IS NOT NULL AND system_stage_id IS NULL) OR (displacement_code_id IS NULL AND system_stage_id IS NOT NULL)')
@Unique(['code'])
export class WorkFlowStateEntity extends TaskManagementBaseEntity {
    @Column({length: 128})
    title: string;

    @Column({length: 32})
    color: string;

    @Column()
    completed: boolean;

    @Column()
    index: number;

    @Column({length: 32})
    code: string;

    @ManyToOne(() => WorkFlowEntity, (item) => item.WorkFlowStates, {nullable: false})
    @JoinColumn({name: 'workflow_id', referencedColumnName: 'id'})
    WorkFlow: WorkFlowEntity;
    @Column({name: 'workflow_id', nullable: false})
    workflowId: number;

    @OneToMany(() => TaskRelationEntity, (item) => item.WorkFlowState)
    TaskRelations: TaskRelationEntity[];

    @OneToMany(() => WorkFlowTransitionEntity, (item) => item.FromState)
    FromTransition: WorkFlowTransitionEntity[];

    @OneToMany(() => WorkFlowTransitionEntity, (item) => item.ToState)
    ToTransition: WorkFlowTransitionEntity[];

    @ManyToOne(() => DisplacementCodeEntity, (item) => item.WorkFlowStates, {nullable: true})
    @JoinColumn({name: 'displacement_code_id', referencedColumnName: 'id'})
    DisplacementCode: DisplacementCodeEntity;
    @Column({name: 'displacement_code_id', nullable: true})
    displacementCodeId: number;

    @ManyToOne(() => SystemStageEntity, (item) => item.WorkFlowStates, {nullable: true})
    @JoinColumn({name: 'system_stage_id', referencedColumnName: 'id'})
    SystemStage: SystemStageEntity;
    @Column({name: 'system_stage_id'})
    systemStageId?: number;
}
