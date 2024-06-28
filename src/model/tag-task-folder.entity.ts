import {Column, Entity, JoinColumn, ManyToOne} from 'typeorm';
import {TagTaskFolderTypeOptions} from '../enum/tag.enum';
import {TaskManagementBaseEntity} from './base.entity';
import {FolderEntity} from './folder.entity';
import {TagEntity} from './tag.entity';
import {TaskEntity} from './task.entity';

/**
 * Represents a TagTaskFolderEntity which is used to associate tags with tasks or folders.
 * @class
 */
@Entity('tags_task_folder')
export class TagTaskFolderEntity extends TaskManagementBaseEntity {
    @ManyToOne(() => TagEntity, (item) => item.TagTaskFolder, {nullable: false})
    @JoinColumn({name: 'tag_id', referencedColumnName: 'id'})
    Tag: TagEntity;
    @Column({name: 'tag_id', nullable: false})
    tagId: number;

    @ManyToOne(() => TaskEntity, (item) => item.Tags, {nullable: true})
    @JoinColumn({name: 'task_id', referencedColumnName: 'id'})
    Task: TaskEntity;
    @Column({name: 'task_id', nullable: true})
    taskId: number;

    @ManyToOne(() => FolderEntity, (item) => item.Tags, {nullable: true})
    @JoinColumn({name: 'folder_id', referencedColumnName: 'id'})
    Folder: FolderEntity;
    @Column({name: 'folder_id', nullable: true})
    folderId: number;

    @Column({type: 'enum', enum: TagTaskFolderTypeOptions, default: TagTaskFolderTypeOptions.FOLDER_TAG})
    type: TagTaskFolderTypeOptions;

    @Column({name: 'user_id', type: 'uuid', nullable: true})
    userId: string;
}
