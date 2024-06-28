import {Column, Entity, JoinColumn, ManyToOne, Unique} from 'typeorm';
import {TaskManagementBaseEntity} from './base.entity';
import {FolderEntity} from './folder.entity';

@Unique(['Folder', 'userId'])
@Entity('folder_follower')
export class FolderFollowerEntity extends TaskManagementBaseEntity {
    @ManyToOne(() => FolderEntity, (item) => item.Followers, {nullable: false})
    @JoinColumn({name: 'folder_id', referencedColumnName: 'id'})
    Folder: FolderEntity;
    @Column({name: 'folder_id', nullable: false})
    folderId: number;

    @Column({name: 'user_id', type: 'uuid', nullable: false})
    userId: string;
}
