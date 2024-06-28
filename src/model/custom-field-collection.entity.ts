import {Column, Entity, OneToMany, Unique} from 'typeorm';
import {TaskManagementBaseEntity} from './base.entity';
import {CustomFieldCollectionRelationEntity} from './custom-field-collection-relation.entity';
import {FolderSpaceCustomFieldCollectionEntity} from './folder-space-custom-field-collections.entity';

@Entity('custom_field_collection')
@Unique(['title'])
export class CustomFieldCollectionEntity extends TaskManagementBaseEntity {
    @Column({length: 64})
    title: string;

    @Column({length: 256, nullable: true})
    description: string;

    @Column({name: 'active', default: true})
    active: boolean;

    @OneToMany(() => CustomFieldCollectionRelationEntity, (item) => item.CustomFieldCollection)
    CustomFieldRelation: CustomFieldCollectionRelationEntity[];

    @OneToMany(() => FolderSpaceCustomFieldCollectionEntity, (item) => item.CustomFieldCollection)
    FolderSpaceCustomFieldCollections: FolderSpaceCustomFieldCollectionEntity[];
}
