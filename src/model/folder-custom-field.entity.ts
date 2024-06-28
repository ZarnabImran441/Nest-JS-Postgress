import {Column, Entity, JoinColumn, ManyToOne, Unique} from 'typeorm';
import {TaskManagementBaseEntity} from './base.entity';
import {CustomFieldDefinitionEntity} from './custom-field-definition.entity';
import {FolderEntity} from './folder.entity';

@Entity('folder_custom_field')
@Unique(['Folder', 'CustomFieldDefinition', 'userId'])
export class FolderCustomFieldEntity extends TaskManagementBaseEntity {
    @ManyToOne(() => FolderEntity, (item) => item.FolderCustomFields, {nullable: false})
    @JoinColumn({name: 'folder_id', referencedColumnName: 'id'})
    Folder: FolderEntity;
    @Column({name: 'folder_id', nullable: false})
    folderId: number;

    @ManyToOne(() => CustomFieldDefinitionEntity, (item) => item.FolderCustomFields, {nullable: false})
    @JoinColumn({name: 'custom_field_definition_id', referencedColumnName: 'id'})
    CustomFieldDefinition: CustomFieldDefinitionEntity;
    @Column({name: 'custom_field_definition_id', nullable: false})
    customFieldDefinitionId: number;

    @Column({name: 'user_id', type: 'uuid', nullable: false})
    userId: string;

    @Column()
    mandatory: boolean;
}
