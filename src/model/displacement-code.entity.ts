import {Column, Entity, JoinColumn, ManyToOne, OneToMany, Unique} from 'typeorm';
import {TaskManagementBaseEntity} from './base.entity';
import {DisplacementGroupEntity} from './displacement-group.entity';
import {SystemStageEntity} from './system-stage.entity';
import {WorkFlowStateEntity} from './workflow-state.entity';

//displacement code is "custom stage"
@Entity('displacement_code')
@Unique(['code', 'displacementGroupId'])
export class DisplacementCodeEntity extends TaskManagementBaseEntity {
    @Column({length: 16})
    code: string;

    @Column({length: 512, nullable: true})
    description: string;

    @ManyToOne(() => DisplacementGroupEntity, (item) => item.DisplacementCodes)
    @JoinColumn({name: 'displacement_group_id', referencedColumnName: 'id'})
    DisplacementGroup: DisplacementGroupEntity;
    @Column({name: 'displacement_group_id'})
    displacementGroupId?: number;

    @OneToMany(() => WorkFlowStateEntity, (item) => item.DisplacementCode)
    WorkFlowStates: WorkFlowStateEntity[];

    @ManyToOne(() => SystemStageEntity, (item) => item.DisplacementCodes)
    @JoinColumn({name: 'system_stage_id', referencedColumnName: 'id'})
    SystemStage: SystemStageEntity;
    @Column({name: 'system_stage_id'})
    systemStageId?: number;
}
