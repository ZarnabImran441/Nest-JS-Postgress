import {Check, Column, Entity, JoinColumn, ManyToOne, OneToMany, Unique} from 'typeorm';
import {TaskManagementBaseEntity} from './base.entity';
import {FolderPositionEntity} from './folder-position.entity';
import {FolderEntity} from './folder.entity';

/**
 * Represents a Folder Relation Entity in the application.
 */
@Entity('folder_relation')
@Unique(['ParentFolder', 'ChildFolder'])
@Check('parent_folder_id <> child_folder_id')
export class FolderRelationEntity extends TaskManagementBaseEntity {
    @ManyToOne(() => FolderEntity, (item) => item.ParentFolders, {nullable: true})
    @JoinColumn({name: 'parent_folder_id', referencedColumnName: 'id'})
    ParentFolder: FolderEntity;
    @Column({name: 'parent_folder_id', nullable: true})
    parentFolderId: number;

    @ManyToOne(() => FolderEntity, (item) => item.ChildrenFolders, {nullable: false})
    @JoinColumn({name: 'child_folder_id', referencedColumnName: 'id'})
    ChildFolder: FolderEntity;
    @Column({name: 'child_folder_id', nullable: false})
    childFolderId: number;

    @OneToMany(() => FolderPositionEntity, (item) => item.FolderRelation)
    FolderPosition: FolderPositionEntity[];

    @Column({name: 'is_bind', nullable: false, default: false})
    isBind: boolean;

    @Column({type: 'integer', array: true, nullable: false, name: 'path_ids'})
    pathIds: number[];

    @Column({type: 'text', array: true, nullable: false, name: 'path_str'})
    pathStr: string[];
}
