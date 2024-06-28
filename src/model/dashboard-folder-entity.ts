import {Column, Entity, JoinColumn, ManyToOne, Unique} from 'typeorm';
import {TaskManagementBaseEntity} from './base.entity';
import {DashboardEntity} from './dashboard.entity';
import {FolderEntity} from './folder.entity';

@Entity('dashboard_folder_relation')
@Unique(['folderId', 'dashboardId'])
export class DashboardFolderEntity extends TaskManagementBaseEntity {
    @ManyToOne(() => FolderEntity, {nullable: false})
    @JoinColumn({name: 'folder_id', referencedColumnName: 'id'})
    Folder: FolderEntity;
    @Column({name: 'folder_id', nullable: false})
    folderId: number;

    @ManyToOne(() => DashboardEntity, {nullable: true})
    @JoinColumn({name: 'dashboard_id', referencedColumnName: 'id'})
    Dashboard: DashboardEntity;
    @Column({name: 'dashboard_id', nullable: true})
    dashboardId: number;
}
