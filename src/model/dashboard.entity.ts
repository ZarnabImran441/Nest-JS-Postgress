import {Column, Entity, JoinColumn, ManyToOne, OneToMany} from 'typeorm';
import {LayoutSettingsType} from '../dto/dashboard/dashboard-layout.dto';
import {DashboardTypesOptions} from '../enum/dashboard-type.enum';
import {TaskManagementBaseEntity} from './base.entity';
import {DashboardFolderEntity} from './dashboard-folder-entity';
import {DashboardUserDefaultEntity} from './dashboard-user-default.entity';
import {DashboardUserFavouriteEntity} from './dashboard-user-favourite.entity';
import {UserEntity} from './user.entity';
import {WidgetsRelationEntity} from './widget-relation.entity';

@Entity('dashboard')
export class DashboardEntity extends TaskManagementBaseEntity {
    @Column({length: 256, name: 'dashboard_name'})
    dashboardName: string;

    @OneToMany(() => DashboardUserFavouriteEntity, (item) => item.Dashboard)
    isFavourite: DashboardUserFavouriteEntity[];

    @OneToMany(() => DashboardUserDefaultEntity, (item) => item.Dashboard)
    isDefault: DashboardUserDefaultEntity[];

    @Column({name: 'dashboard_type', type: 'enum', enum: DashboardTypesOptions, default: DashboardTypesOptions.My})
    dashboardType: DashboardTypesOptions;

    @Column({name: 'description', type: 'varchar', nullable: true, length: 2048})
    description: string;

    @Column({name: 'created_date', nullable: true, type: 'timestamptz'})
    createdDate: Date;

    @ManyToOne(() => UserEntity, {nullable: true})
    @JoinColumn({name: 'last_modified_by', referencedColumnName: 'id'})
    LastModifiedBy: UserEntity;
    @Column({name: 'last_modified_by', nullable: true, type: 'uuid'})
    lastModifiedBy: string;

    @Column({name: 'last_modified_date', nullable: true, type: 'timestamptz'})
    lastModifiedDate: Date;

    @ManyToOne(() => UserEntity, {nullable: true})
    @JoinColumn({name: 'last_accessed_by', referencedColumnName: 'id'})
    LastAccessedBy: UserEntity;
    @Column({name: 'last_accessed_by', nullable: true, type: 'uuid'})
    lastAccessedBy: string;

    @Column({name: 'last_accessed_date', nullable: true, type: 'timestamptz'})
    lastAccessedDate: Date;

    @OneToMany(() => DashboardFolderEntity, (item) => item.Dashboard)
    folders: DashboardFolderEntity[];

    @OneToMany(() => WidgetsRelationEntity, (item) => item.Widget)
    widgets: WidgetsRelationEntity[];

    @Column({
        name: 'layout_settings',
        type: 'jsonb',
        array: false,
        default: () => "'[]'",
        nullable: false,
    })
    layoutSettings: LayoutSettingsType;

    @Column({name: 'is_system', type: 'boolean', default: false})
    isSystem: boolean;

    @ManyToOne(() => UserEntity, {nullable: true})
    @JoinColumn({name: 'created_by', referencedColumnName: 'id'})
    CreatedBy: UserEntity;
}
