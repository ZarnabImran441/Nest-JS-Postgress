import {Column, Entity, JoinColumn, ManyToOne, Unique} from 'typeorm';
import {TaskManagementBaseEntity} from './base.entity';
import {CustomFieldCollectionEntity} from './custom-field-collection.entity';
import {FolderEntity} from './folder.entity';

@Entity('folder_space_custom_field_collection')
@Unique(['Folder', 'CustomFieldCollection'])
export class FolderSpaceCustomFieldCollectionEntity extends TaskManagementBaseEntity {
    @ManyToOne(() => FolderEntity, (folder) => folder.FolderSpaceCustomFields)
    @JoinColumn({name: 'folder_id', referencedColumnName: 'id'})
    Folder: FolderEntity;
    @Column({name: 'folder_id', nullable: true})
    folderId: number;

    @ManyToOne(() => CustomFieldCollectionEntity, (item) => item.FolderSpaceCustomFieldCollections)
    @JoinColumn({name: 'custom_field_collection_id', referencedColumnName: 'id'})
    CustomFieldCollection: CustomFieldCollectionEntity;
    @Column({name: 'custom_field_collection_id', nullable: true})
    customFieldCollectionId: number;
}
