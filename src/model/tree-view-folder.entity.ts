import {Column, Entity, JoinColumn, ManyToOne, Unique} from 'typeorm';
import {TaskManagementBaseEntity} from './base.entity';
import {FolderEntity} from './folder.entity';
import {TreeViewEntity} from './tree-view.entity';

@Entity('tree_view_folder')
@Unique(['TreeView', 'Folder'])
export class TreeViewFolderEntity extends TaskManagementBaseEntity {
    @ManyToOne(() => TreeViewEntity, (flow) => flow.TreeViewFolders, {nullable: false})
    @JoinColumn({name: 'tree_view_id', referencedColumnName: 'id'})
    TreeView: TreeViewEntity;
    @Column({name: 'tree_view_id', nullable: false})
    treeViewId: number;

    @ManyToOne(() => FolderEntity, (flow) => flow.TreeViewFolders, {nullable: false})
    @JoinColumn({name: 'folder_id', referencedColumnName: 'id'})
    Folder: FolderEntity;
    @Column({name: 'folder_id', nullable: false})
    folderId: number;
}
