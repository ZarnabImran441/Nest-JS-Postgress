import {Column, Entity, OneToMany, Unique} from 'typeorm';
import {TaskManagementBaseEntity} from './base.entity';
import {DisplacementCodeEntity} from './displacement-code.entity';
import {WorkFlowStateEntity} from './workflow-state.entity';

//displacement code is "custom stage"
@Entity('system_stage')
@Unique(['code'])
export class SystemStageEntity extends TaskManagementBaseEntity {
    @Column({length: 16})
    code: string;

    @OneToMany(() => DisplacementCodeEntity, (item) => item.SystemStage)
    DisplacementCodes: DisplacementCodeEntity[];

    @OneToMany(() => WorkFlowStateEntity, (item) => item.SystemStage)
    WorkFlowStates: WorkFlowStateEntity[];
}

//** One system stage can have many displacement code assigned to it */
