import {Column, Entity, JoinColumn, ManyToOne, Unique} from 'typeorm';
import {IFolderTaskFilterInterface} from '../interface/folder-task-filter.interface';
import {TaskManagementBaseEntity} from './base.entity';
import {FolderEntity} from './folder.entity';

@Entity('folder_filter')
@Unique(['Folder', 'title'])
export class FolderFilterEntity extends TaskManagementBaseEntity {
    @ManyToOne(() => FolderEntity, (item) => item.Filters, {nullable: false})
    @JoinColumn({name: 'folder_id', referencedColumnName: 'id'})
    Folder: FolderEntity;
    @Column({name: 'folder_id', nullable: false})
    folderId: number;

    @Column({length: 64})
    title: string;

    @Column({length: 256, nullable: true})
    location: string;

    @Column({type: 'jsonb'})
    filter: IFolderTaskFilterInterface;
}
