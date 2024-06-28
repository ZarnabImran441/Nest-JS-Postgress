import {Column, Entity, OneToMany, Unique} from 'typeorm';
import {TagTypeOptions} from '../enum/tag.enum';
import {TaskManagementBaseEntity} from './base.entity';
import {TagCollectionRelationEntity} from './tag-collection-relation.entity';
import {TagTaskFolderEntity} from './tag-task-folder.entity';

@Entity('tags')
@Unique(['title'])
export class TagEntity extends TaskManagementBaseEntity {
    @Column({length: 64})
    title: string;

    @Column({length: 32})
    color: string;

    @Column({type: 'enum', enum: TagTypeOptions, default: TagTypeOptions.COMMON_TAG})
    type: TagTypeOptions;

    @OneToMany(() => TagTaskFolderEntity, (tags) => tags.Tag)
    TagTaskFolder: TagTaskFolderEntity[];

    @Column({name: 'user_id', type: 'uuid', nullable: true})
    userId: string;

    @OneToMany(() => TagCollectionRelationEntity, (item) => item.tag)
    TagCollectionRelation: TagCollectionRelationEntity[];
}
