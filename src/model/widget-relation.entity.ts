import {Column, Entity, JoinColumn, ManyToOne, Unique} from 'typeorm';
import {TaskManagementBaseEntity} from './base.entity';
import {FolderEntity} from './folder.entity';
import {WidgetEntity} from './widget.entity';
import {WorkFlowEntity} from './workflow.entity';

@Entity('widgets_relation')
@Unique(['id'])
export class WidgetsRelationEntity extends TaskManagementBaseEntity {
    @ManyToOne(() => WidgetEntity)
    @JoinColumn({name: 'widget_id', referencedColumnName: 'id'})
    Widget: WidgetEntity;
    @Column({name: 'widget_id', nullable: false})
    widgetId: number;

    @ManyToOne(() => FolderEntity)
    @JoinColumn({name: 'folder_id', referencedColumnName: 'id'})
    Folder: FolderEntity;
    @Column({name: 'folder_id', nullable: true})
    folderId: number;

    @ManyToOne(() => WorkFlowEntity)
    @JoinColumn({name: 'workflow_id', referencedColumnName: 'id'})
    Workflow: FolderEntity;
    @Column({name: 'workflow_id', nullable: true})
    workflowId: number;
}
