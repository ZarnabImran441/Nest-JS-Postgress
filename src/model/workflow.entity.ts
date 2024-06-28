import {Column, Entity, OneToMany} from 'typeorm';
import {TaskManagementBaseEntity} from './base.entity';
import {FolderSpaceWorkflowEntity} from './folder-space-workflow.entity';
import {FolderEntity} from './folder.entity';
import {WorkFlowStateEntity} from './workflow-state.entity';

@Entity('workflow')
export class WorkFlowEntity extends TaskManagementBaseEntity {
    @Column({length: 256})
    title: string;

    @Column({length: 1024, nullable: true})
    description: string;

    @Column({length: 32})
    color: string;

    @Column({default: true})
    active: boolean;
    @OneToMany(() => FolderSpaceWorkflowEntity, (item) => item.Workflow)
    FolderSpaceWorkflows: FolderSpaceWorkflowEntity[];
    @OneToMany(() => WorkFlowStateEntity, (flow) => flow.WorkFlow)
    WorkFlowStates: WorkFlowStateEntity[];

    @OneToMany(() => FolderEntity, (item) => item.WorkFlow)
    Folders: FolderEntity[];

    @Column({name: 'user_id', type: 'uuid', nullable: true})
    userId: string;
}
