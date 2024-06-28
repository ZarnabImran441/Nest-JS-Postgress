import {Column, Entity, JoinColumn, ManyToOne, Unique} from 'typeorm';
import {FolderViewOptions} from '../enum/folder-position.enum';
import {TaskManagementBaseEntity} from './base.entity';
import {FolderRelationEntity} from './folder-relation.entity';

/**
 * Represents a position of a folder in a user's view.
 *
 * @Entity('folder_position')
 * @Unique(['userId', 'view', 'FolderRelation'])
 */
@Entity('folder_position')
@Unique(['userId', 'view', 'FolderRelation'])
export class FolderPositionEntity extends TaskManagementBaseEntity {
    @Column({type: 'enum', enum: FolderViewOptions})
    view: FolderViewOptions;

    @Column({name: 'user_id', type: 'uuid', nullable: false})
    userId: string;

    @ManyToOne(() => FolderRelationEntity, (item) => item.FolderPosition, {nullable: false})
    @JoinColumn({name: 'folder_relation_id', referencedColumnName: 'id'})
    FolderRelation: FolderRelationEntity;
    @Column({name: 'folder_relation_id', nullable: false})
    folderRelationId: number;

    @Column()
    index: number;
}
