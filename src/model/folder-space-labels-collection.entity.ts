import {Column, Entity, JoinColumn, ManyToOne, Unique} from 'typeorm';
import {TaskManagementBaseEntity} from './base.entity';
import {FolderEntity} from './folder.entity';
import {TagCollectionEntity} from './tag-collection.entity';

@Entity('folder_space_tags_collection')
@Unique(['Folder', 'TagsCollection'])
export class FolderSpaceTagsCollectionEntity extends TaskManagementBaseEntity {
    @ManyToOne(() => FolderEntity, (folder) => folder.FolderSpaceTags)
    @JoinColumn({name: 'folder_id', referencedColumnName: 'id'})
    Folder: FolderEntity;
    @Column({name: 'folder_id', nullable: true})
    folderId: number;

    @ManyToOne(() => TagCollectionEntity, (item) => item.FolderSpaceTagsCollections)
    @JoinColumn({name: 'tags_collection_id', referencedColumnName: 'id'})
    TagsCollection: TagCollectionEntity;
    @Column({name: 'tags_collection_id', nullable: true})
    tagCollectionId: number;
}
