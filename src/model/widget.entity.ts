import {Column, Entity, JoinColumn, ManyToOne, OneToMany, Unique} from 'typeorm';
import {WidgetFilterInterface} from '../interface/widget-filters.interface';
import {WidgetQueryInterface} from '../interface/widget-query.interface';
import {TaskManagementBaseEntity} from './base.entity';
import {DashboardEntity} from './dashboard.entity';
import {WidgetsRelationEntity} from './widget-relation.entity';
import {WidgetTypesEntity} from './widget-types.entity';

@Entity('widgets')
@Unique(['id'])
export class WidgetEntity extends TaskManagementBaseEntity {
    @Column({name: 'name', type: 'varchar', length: 256})
    name: string;

    @ManyToOne(() => WidgetTypesEntity)
    @JoinColumn({name: 'widget_type_id', referencedColumnName: 'id'})
    widgetType: WidgetTypesEntity;

    @Column({name: 'widget_type_id', nullable: false})
    widgetTypeId: number;

    @Column({name: 'description', type: 'varchar', length: 1024, nullable: true})
    description: string;

    @Column({
        type: 'jsonb',
        array: false,
        default: () => "'[]'",
        nullable: false,
    })
    filters: Array<WidgetFilterInterface>;

    @Column({name: 'include_archived', type: 'boolean', default: false})
    includeArchived: boolean;

    @Column({name: 'include_completed', type: 'boolean', default: false})
    includeCompleted: boolean;

    @Column({name: 'task_repeat', type: 'boolean', default: false})
    taskRepeat: boolean;

    @OneToMany(() => WidgetsRelationEntity, (relation) => relation.Workflow)
    Workflow: WidgetsRelationEntity[];

    @OneToMany(() => WidgetsRelationEntity, (relation) => relation.Widget)
    Widget: WidgetsRelationEntity[];

    @OneToMany(() => WidgetsRelationEntity, (relation) => relation.Folder)
    Folder: WidgetsRelationEntity[];

    @ManyToOne(() => DashboardEntity)
    @JoinColumn({name: 'dashboard_id', referencedColumnName: 'id'})
    Dashboard: DashboardEntity;
    @Column({name: 'dashboard_id', nullable: false})
    dashboardId: number;

    @Column({
        type: 'jsonb',
        array: false,
    })
    query: WidgetQueryInterface;

    @Column({name: 'api_url', type: 'varchar', length: 512, nullable: false, default: ''})
    apiUrl: string;
}
