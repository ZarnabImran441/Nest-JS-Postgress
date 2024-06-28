import {Column, Entity} from 'typeorm';
import {TaskManagementBaseEntity} from './base.entity';

@Entity('widget_categories')
export class WidgetCategoriesEntity extends TaskManagementBaseEntity {
    @Column({name: 'name', unique: true, nullable: false, length: 256})
    name: string;

    @Column({name: 'icon', nullable: true, length: 32})
    icon: string;

    @Column({name: 'color', nullable: true, length: 16})
    color: string;
}
