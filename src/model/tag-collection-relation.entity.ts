import {Column, Entity, JoinColumn, ManyToOne, OneToMany, Unique} from 'typeorm';
import {TaskManagementBaseEntity} from './base.entity';
import {CustomFieldCollectionEntity} from './custom-field-collection.entity';
import {FolderSpaceTagsCollectionEntity} from './folder-space-labels-collection.entity';
import {TagCollectionEntity} from './tag-collection.entity';
import {TagEntity} from './tag.entity';

@Entity('tag_collection_relation')
@Unique(['TagCollectionId', 'tagId'])
export class TagCollectionRelationEntity extends TaskManagementBaseEntity {
    @ManyToOne(() => TagCollectionEntity, (item) => item.TagCollectionRelation, {nullable: false})
    @JoinColumn({name: 'tag_collection_id', referencedColumnName: 'id'})
    TagCollection: CustomFieldCollectionEntity;
    @Column({name: 'tag_collection_id', nullable: false})
    TagCollectionId: number;

    @ManyToOne(() => TagEntity, (item) => item.TagCollectionRelation, {nullable: false})
    @JoinColumn({name: 'tag_id', referencedColumnName: 'id'})
    tag: TagEntity;
    @Column({name: 'tag_id', nullable: false})
    tagId: number;

    @OneToMany(() => FolderSpaceTagsCollectionEntity, (item) => item.TagsCollection)
    FolderSpaceTagsCollections: FolderSpaceTagsCollectionEntity[];
}
