import {Column, Entity, JoinColumn, ManyToOne, Unique} from 'typeorm';
import {TaskManagementBaseEntity} from './base.entity';
import {FolderEntity} from './folder.entity';
import {WorkFlowEntity} from './workflow.entity';

//** Relation for space and workflow */
@Entity('folder_space_workflow')
@Unique(['Folder', 'Workflow'])
export class FolderSpaceWorkflowEntity extends TaskManagementBaseEntity {
    @ManyToOne(() => FolderEntity, (folder) => folder.FolderSpaceTeams)
    @JoinColumn({name: 'folder_id', referencedColumnName: 'id'})
    Folder: FolderEntity;
    @Column({name: 'folder_id', nullable: true})
    folderId: number;

    @ManyToOne(() => WorkFlowEntity, (workflow) => workflow.FolderSpaceWorkflows)
    @JoinColumn({name: 'workflow_id', referencedColumnName: 'id'})
    Workflow: WorkFlowEntity;
    @Column({name: 'workflow_id', nullable: true})
    workflowId: number;
}
