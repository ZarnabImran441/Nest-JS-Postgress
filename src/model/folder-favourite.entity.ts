import {Column, Entity, JoinColumn, ManyToOne, Unique} from 'typeorm';
import {TaskManagementBaseEntity} from './base.entity';
import {FolderEntity} from './folder.entity';

@Entity('folder_favourite')
@Unique(['Folder', 'userId'])
export class FolderFavouriteEntity extends TaskManagementBaseEntity {
    @ManyToOne(() => FolderEntity, (item) => item.FolderFavourites, {nullable: false})
    @JoinColumn({name: 'folder_id', referencedColumnName: 'id'})
    Folder: FolderEntity;
    @Column({name: 'folder_id', nullable: false})
    folderId: number;

    @Column({name: 'user_id', type: 'uuid', nullable: false})
    userId: string;

    @Column({nullable: false})
    index: number;
}
