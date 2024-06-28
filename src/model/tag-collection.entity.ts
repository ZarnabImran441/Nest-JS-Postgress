import {Column, Entity, OneToMany, Unique} from 'typeorm';
import {TaskManagementBaseEntity} from './base.entity';
import {FolderSpaceTagsCollectionEntity} from './folder-space-labels-collection.entity';
import {TagCollectionRelationEntity} from './tag-collection-relation.entity';

@Entity('tag_collection')
@Unique(['title'])
export class TagCollectionEntity extends TaskManagementBaseEntity {
    @Column({length: 64})
    title: string;

    @Column({length: 256, nullable: true})
    description: string;

    @Column({name: 'active', default: true})
    active: boolean;

    @OneToMany(() => TagCollectionRelationEntity, (item) => item.TagCollection)
    TagCollectionRelation: TagCollectionRelationEntity[];

    @OneToMany(() => FolderSpaceTagsCollectionEntity, (item) => item.TagsCollection)
    FolderSpaceTagsCollections: FolderSpaceTagsCollectionEntity[];
}
