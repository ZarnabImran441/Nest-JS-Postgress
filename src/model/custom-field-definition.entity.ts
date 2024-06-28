import {Column, Entity, OneToMany, Unique} from 'typeorm';
import {CustomFieldSetting} from '../dto/custom-field/create-custom-field-definition.dto';
import {CustomFieldDefinitionTypeOptions, InheritanceTypeOptions} from '../enum/custom-field-definition.enum';
import {CustomFieldValueEntity} from './custom-field-value.entity';
import {FolderCustomFieldEntity} from './folder-custom-field.entity';

import {TaskManagementBaseEntity} from './base.entity';
import {CustomFieldCollectionRelationEntity} from './custom-field-collection-relation.entity';

@Entity('custom_field_definition')
@Unique(['title', 'userId'])
export class CustomFieldDefinitionEntity extends TaskManagementBaseEntity {
    @Column({length: 32})
    title: string;

    @Column({length: 256, nullable: true})
    description: string;

    @Column({type: 'enum', enum: CustomFieldDefinitionTypeOptions})
    type: CustomFieldDefinitionTypeOptions;

    @Column({name: 'inheritance_type', type: 'enum', enum: InheritanceTypeOptions})
    inheritanceType: InheritanceTypeOptions;

    @Column({name: 'user_id', type: 'uuid', nullable: true})
    userId: string;

    @OneToMany(() => CustomFieldValueEntity, (item) => item.CustomFieldDefinition)
    CustomFieldValues: CustomFieldValueEntity[];

    @OneToMany(() => FolderCustomFieldEntity, (item) => item.CustomFieldDefinition)
    FolderCustomFields: FolderCustomFieldEntity[];

    @Column({name: 'active', default: true})
    active: boolean;

    @OneToMany(() => CustomFieldCollectionRelationEntity, (item) => item.CustomFieldCollection)
    CustomFieldRelation: CustomFieldCollectionRelationEntity[];

    @Column({type: 'jsonb', nullable: true, name: 'setting'})
    setting: CustomFieldSetting;
}
