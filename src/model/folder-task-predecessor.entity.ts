import {Column, Entity, JoinColumn, ManyToOne, Unique} from 'typeorm';
import {RelationTypeOptions} from '../enum/folder-task-predecessor.enum';
import {TaskManagementBaseEntity} from './base.entity';
import {FolderEntity} from './folder.entity';
import {TaskEntity} from './task.entity';

/**
 * Represents a Folder Task Predecessor entity.
 *
 * @class
 * @name FolderTaskPredecessorEntity
 */
@Entity('folder_task_predecessor')
@Unique(['Folder', 'Predecessor', 'Successor'])
export class FolderTaskPredecessorEntity extends TaskManagementBaseEntity {
    @ManyToOne(() => FolderEntity, (item) => item.TaskPredecessors, {nullable: false})
    @JoinColumn({name: 'folder_id', referencedColumnName: 'id'})
    Folder: FolderEntity;
    @Column({name: 'folder_id', nullable: false})
    folderId: number;

    //task B
    @ManyToOne(() => TaskEntity, (item) => item.Predecessors, {nullable: false})
    @JoinColumn({name: 'task_predecessor_id', referencedColumnName: 'id'})
    Predecessor: TaskEntity;
    @Column({name: 'task_predecessor_id', nullable: false})
    taskPredecessorId: number;

    //task A
    @ManyToOne(() => TaskEntity, (item) => item.Successors, {nullable: false})
    @JoinColumn({name: 'task_successor_id', referencedColumnName: 'id'})
    Successor: TaskEntity;
    @Column({name: 'task_successor_id', nullable: false})
    taskSuccessorId: number;

    @Column({type: 'enum', enum: RelationTypeOptions, default: RelationTypeOptions.FINISH_TO_START})
    relationType: RelationTypeOptions;
}
