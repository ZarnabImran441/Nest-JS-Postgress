import {Check, Column, Entity, JoinColumn, ManyToOne, Unique} from 'typeorm';
import {TaskManagementBaseEntity} from './base.entity';
import {FolderEntity} from './folder.entity';
import {TaskEntity} from './task.entity';
import {WorkFlowStateEntity} from './workflow-state.entity';

////////////////////////////////////////////////////////////////////////////////
//
// 2023-01-17: JK
// I add this constrains through a migration (validateFolderWorkflowState1673962447004)
// because Typeorm don't allow to add function as a check constrain.
//
// @Check ('validate_workflow_state', 'validate_workflow_state(folder_id, workflow_state_id) = true')
//
// 2024-02-29: Ahmad Siddique
// I added a migration (validateWorkflowState1709199631366) for this check
////////////////////////////////////////////////////////////////////////////////

/**
 * Represents a Task Relation entity.
 *
 * @Entity('task_relation')
 * @Unique(['Folder', 'ParentTask', 'ChildTask'])
 * @Check('parent_task_id <> child_task_id')
 */
@Entity('task_relation')
@Unique(['Folder', 'ParentTask', 'ChildTask'])
@Check('parent_task_id <> child_task_id')
export class TaskRelationEntity extends TaskManagementBaseEntity {
    @ManyToOne(() => FolderEntity, (item) => item.FolderTasks, {nullable: false})
    @JoinColumn({name: 'folder_id', referencedColumnName: 'id'})
    Folder: FolderEntity;
    @Column({name: 'folder_id', nullable: false})
    folderId: number;

    @ManyToOne(() => TaskEntity, (item) => item.ParentTasks, {nullable: true})
    @JoinColumn({name: 'parent_task_id', referencedColumnName: 'id'})
    ParentTask: TaskEntity;
    @Column({name: 'parent_task_id', nullable: true})
    parentTaskId: number;

    @ManyToOne(() => TaskEntity, (item) => item.ChildrenTasks, {nullable: false})
    @JoinColumn({name: 'child_task_id', referencedColumnName: 'id'})
    ChildTask: TaskEntity;
    @Column({name: 'child_task_id', nullable: false})
    childTaskId: number;

    @Column()
    index: number;

    @Column({name: 'state_index'})
    stateIndex: number;

    @ManyToOne(() => WorkFlowStateEntity, (item) => item.TaskRelations, {nullable: false})
    @JoinColumn({name: 'workflow_state_id', referencedColumnName: 'id'})
    WorkFlowState: WorkFlowStateEntity;
    @Column({name: 'workflow_state_id', nullable: false})
    workflowStateId: number;

    @Column({type: 'integer', array: true, nullable: false, name: 'path_ids'})
    pathIds: number[];

    @Column({type: 'text', array: true, nullable: false, name: 'path_str'})
    pathStr: string[];
}
