import {Column, Entity, JoinColumn, ManyToOne, Unique} from 'typeorm';
import {TaskManagementBaseEntity} from './base.entity';
import {CustomFieldCollectionEntity} from './custom-field-collection.entity';
import {CustomFieldDefinitionEntity} from './custom-field-definition.entity';

@Entity('custom_field_collection_relation')
@Unique(['CustomFieldCollectionId', 'CustomFieldDefinationId'])
export class CustomFieldCollectionRelationEntity extends TaskManagementBaseEntity {
    @ManyToOne(() => CustomFieldCollectionEntity, (item) => item.CustomFieldRelation, {nullable: false})
    @JoinColumn({name: 'custom_field_collection_id', referencedColumnName: 'id'})
    CustomFieldCollection: CustomFieldCollectionEntity;
    @Column({name: 'custom_field_collection_id', nullable: false})
    CustomFieldCollectionId: number;

    @ManyToOne(() => CustomFieldDefinitionEntity, (item) => item.CustomFieldRelation, {nullable: false})
    @JoinColumn({name: 'custom_field_defination_id', referencedColumnName: 'id'})
    CustomFieldDefination: CustomFieldDefinitionEntity;
    @Column({name: 'custom_field_defination_id', nullable: false})
    CustomFieldDefinationId: number;
}
