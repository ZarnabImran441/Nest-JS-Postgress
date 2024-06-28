import {stringArrayTransformer} from '@lib/base-library';
import {Column, Entity, JoinColumn, ManyToOne, Unique} from 'typeorm';
import {TaskManagementBaseEntity} from './base.entity';
import {FolderEntity} from './folder.entity';

@Entity('folder_gantt_column')
@Unique(['Folder', 'userId'])
export class FolderGanttColumnEntity extends TaskManagementBaseEntity {
    @ManyToOne(() => FolderEntity, (user) => user.FolderGanttColumns, {nullable: false})
    @JoinColumn({name: 'folder_id', referencedColumnName: 'id'})
    Folder: FolderEntity;
    @Column({name: 'folder_id', nullable: false})
    folderId: number;

    @Column({name: 'user_id', type: 'uuid', nullable: false})
    userId: string;

    @Column({type: 'simple-array', array: true, transformer: stringArrayTransformer})
    columns: string[];
}
