import {Column, Entity, JoinColumn, ManyToOne, Unique} from 'typeorm';
import {TaskManagementBaseEntity} from './base.entity';
import {CustomFieldDefinitionEntity} from './custom-field-definition.entity';
import {FolderEntity} from './folder.entity';
import {TaskEntity} from './task.entity';

@Entity('custom_field_value')
@Unique(['Task', 'CustomFieldDefinition'])
@Unique(['Folder', 'CustomFieldDefinition'])
export class CustomFieldValueEntity extends TaskManagementBaseEntity {
    @Column({nullable: true, length: 2048})
    value: string;

    @Column()
    index: number;

    @ManyToOne(() => TaskEntity, (item) => item.CustomFieldValues, {nullable: true})
    @JoinColumn({name: 'task_id', referencedColumnName: 'id'})
    Task: TaskEntity;
    @Column({name: 'task_id', nullable: true})
    taskId: number;

    @ManyToOne(() => FolderEntity, (item) => item.CustomFieldValues, {nullable: true})
    @JoinColumn({name: 'folder_id', referencedColumnName: 'id'})
    Folder: FolderEntity;
    @Column({name: 'folder_id', nullable: true})
    folderId: number;

    @ManyToOne(() => CustomFieldDefinitionEntity, (item) => item.CustomFieldValues, {nullable: false})
    @JoinColumn({name: 'custom_field_definition_id', referencedColumnName: 'id'})
    CustomFieldDefinition: CustomFieldDefinitionEntity;
    @Column({name: 'custom_field_definition_id', nullable: false})
    customFieldDefinitionId: number;
}
