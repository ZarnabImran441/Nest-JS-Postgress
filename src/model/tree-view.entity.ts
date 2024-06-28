import {Column, Entity, OneToMany, Unique} from 'typeorm';
import {TaskManagementBaseEntity} from './base.entity';
import {TreeViewFolderEntity} from './tree-view-folder.entity';

@Entity('tree_view')
@Unique(['userId', 'title'])
export class TreeViewEntity extends TaskManagementBaseEntity {
    @Column({length: 256})
    title: string;

    @Column({length: 32})
    color: string;

    @Column({length: 32, nullable: true})
    icon: string;

    @Column()
    active: boolean;

    @Column({name: 'user_id', type: 'uuid', nullable: false})
    userId: string;

    @OneToMany(() => TreeViewFolderEntity, (item) => item.TreeView)
    TreeViewFolders: TreeViewFolderEntity[];

    @Column({default: 0})
    index: number;
}
