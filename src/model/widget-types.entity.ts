import {Column, Entity, JoinColumn, ManyToOne, Unique} from 'typeorm';
import {TaskManagementBaseEntity} from './base.entity';
import {WidgetCategoriesEntity} from './widget-category.entity';

@Entity('widget_types')
@Unique(['name', 'widgetCategoryId'])
export class WidgetTypesEntity extends TaskManagementBaseEntity {
    @Column({name: 'name', nullable: false})
    name: string;

    @Column({name: 'description', nullable: true})
    description: string;

    @ManyToOne(() => WidgetCategoriesEntity)
    @JoinColumn({name: 'widget_category_id', referencedColumnName: 'id'})
    widget_category: WidgetCategoriesEntity;
    @Column({name: 'widget_category_id', nullable: false})
    widgetCategoryId: number;

    @Column({name: 'template', default: '', type: 'varchar', length: 32})
    template: string;

    @Column({name: 'icon', nullable: true, length: 32})
    icon: string;

    @Column({name: 'color', nullable: true, length: 16})
    color: string;
}
