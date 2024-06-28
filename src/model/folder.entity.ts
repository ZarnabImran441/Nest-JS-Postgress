import {stringArrayTransformer} from '@lib/base-library';
import {Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany} from 'typeorm';
import {DefaultViewOptions, FolderTypeOptions, FolderViewTypeOptions} from '../enum/folder.enum';
import {TaskManagementBaseEntity} from './base.entity';
import {CustomFieldValueEntity} from './custom-field-value.entity';
import {DashboardFolderEntity} from './dashboard-folder-entity';
import {FolderActionEntity} from './folder-action.entity';
import {FolderBoardColumnEntity} from './folder-board-column.entity';
import {FolderCustomFieldEntity} from './folder-custom-field.entity';
import {FolderFavouriteEntity} from './folder-favourite.entity';
import {FolderFilterEntity} from './folder-filter.entity';
import {FolderFollowerEntity} from './folder-follower.entity';
import {FolderGanttColumnEntity} from './folder-gantt-column.entity';
import {FolderNotificationsSettingsEntity} from './folder-notifications-settings.entity';
import {FolderRelationEntity} from './folder-relation.entity';
import {FolderSpaceCustomFieldCollectionEntity} from './folder-space-custom-field-collections.entity';
import {FolderSpaceTagsCollectionEntity} from './folder-space-labels-collection.entity';
import {FolderSpaceTeamEntity} from './folder-space-team.entity';
import {FolderSpaceWorkflowEntity} from './folder-space-workflow.entity';
import {FolderTaskPredecessorEntity} from './folder-task-predecessor.entity';
import {FolderUserViewEntity} from './folder-user-view.entity';
import {NotificationEntity} from './notification.entity';
import {TagTaskFolderEntity} from './tag-task-folder.entity';
import {TaskRelationEntity} from './task-relation.entity';
import {TreeViewFolderEntity} from './tree-view-folder.entity';
import {WidgetsRelationEntity} from './widget-relation.entity';
import {WorkFlowEntity} from './workflow.entity';

@Entity('folder')
export class FolderEntity extends TaskManagementBaseEntity {
    @Column({length: 256})
    title: string;

    @Column({name: 'folder_type', type: 'enum', enum: FolderTypeOptions})
    folderType: FolderTypeOptions;

    @Column({name: 'view_type', type: 'enum', enum: FolderViewTypeOptions, nullable: true})
    viewType: FolderViewTypeOptions;

    @Column({nullable: true, length: 512})
    description: string;

    @Column({nullable: true, length: 32})
    color: string;

    @Column({name: 'start_date', nullable: true})
    startDate: Date;

    @Column({name: 'end_date', nullable: true})
    endDate: Date;

    @CreateDateColumn()
    @Column({name: 'archived_at', nullable: true})
    archivedAt: Date;

    @Column({name: 'archived_by', type: 'uuid', nullable: true})
    archivedBy: string;

    @Column({name: 'archived_why', nullable: true, length: 512})
    archivedWhy: string;

    @CreateDateColumn()
    @Column({name: 'deleted_at', nullable: true})
    deletedAt: Date;

    @Column({name: 'deleted_by', type: 'uuid', nullable: true})
    deletedBy: string;

    @Column({name: 'deleted_why', nullable: true, length: 512})
    deletedWhy: string;

    @Column({name: 'default_view', type: 'enum', enum: DefaultViewOptions, default: DefaultViewOptions.BOARD})
    defaultView: DefaultViewOptions;

    @Column({
        name: 'available_views',
        type: 'jsonb',
        default: [{name: DefaultViewOptions.BOARD, index: 1}],
    })
    availableViews: object;

    @Column({name: 'user_id', type: 'uuid', nullable: false})
    userId: string;

    @Column({length: 32, name: 'source', nullable: true})
    source: string;

    @Column({type: 'jsonb', nullable: true, name: 'extra'})
    extra: object;

    @Column({name: 'show_on', type: 'simple-array', array: true, transformer: stringArrayTransformer, nullable: true})
    showOn: string[];

    //** SPACE PROPS */
    @Column({name: 'icon', nullable: true, length: 1024})
    icon: string;

    @Column({name: 'space_picture_url', nullable: true, length: 1024})
    pictureUrl: string;

    //***************  */

    @OneToMany(() => FolderRelationEntity, (item) => item.ParentFolder)
    ParentFolders: FolderRelationEntity[];

    @OneToMany(() => FolderRelationEntity, (item) => item.ChildFolder)
    ChildrenFolders: FolderRelationEntity[];

    @OneToMany(() => TaskRelationEntity, (item) => item.Folder)
    FolderTasks: TaskRelationEntity[];

    @ManyToOne(() => WorkFlowEntity, (item) => item.Folders)
    @JoinColumn({name: 'workflow_id', referencedColumnName: 'id'})
    WorkFlow: WorkFlowEntity;
    @Column({name: 'workflow_id'})
    workFlowId?: number;

    @OneToMany(() => FolderUserViewEntity, (item) => item.Folder)
    Members: FolderUserViewEntity[];

    @OneToMany(() => FolderTaskPredecessorEntity, (item) => item.Folder)
    TaskPredecessors: FolderTaskPredecessorEntity[];

    @OneToMany(() => FolderGanttColumnEntity, (item) => item.Folder)
    FolderGanttColumns: FolderGanttColumnEntity[];

    @OneToMany(() => FolderCustomFieldEntity, (item) => item.Folder)
    FolderCustomFields: FolderCustomFieldEntity[];

    @OneToMany(() => CustomFieldValueEntity, (item) => item.Folder)
    CustomFieldValues: CustomFieldValueEntity[];

    @OneToMany(() => FolderBoardColumnEntity, (item) => item.Folder)
    FolderBoardColumns: FolderBoardColumnEntity[];

    @OneToMany(() => FolderRelationEntity, (item) => item.ParentFolder)
    ParentFolderPositions: FolderRelationEntity[];

    @OneToMany(() => FolderRelationEntity, (item) => item.ChildFolder)
    ChildrenFolderPositions: FolderRelationEntity[];

    @OneToMany(() => FolderFilterEntity, (item) => item.Folder)
    Filters: FolderFilterEntity[];

    @OneToMany(() => FolderFollowerEntity, (item) => item.Folder)
    Followers: FolderFollowerEntity[];

    @OneToMany(() => TreeViewFolderEntity, (item) => item.Folder)
    TreeViewFolders: TreeViewFolderEntity[];

    @OneToMany(() => TagTaskFolderEntity, (item) => item.Folder)
    Tags: TagTaskFolderEntity[];

    @OneToMany(() => FolderActionEntity, (item) => item.Folder, {nullable: true})
    Actions: FolderActionEntity[];

    @OneToMany(() => FolderFavouriteEntity, (item) => item.Folder)
    FolderFavourites: FolderFavouriteEntity[];

    @OneToMany(() => NotificationEntity, (item) => item.folder)
    notifications: NotificationEntity[];

    @OneToMany(() => FolderNotificationsSettingsEntity, (item) => item.folder)
    notificationsSettings: FolderNotificationsSettingsEntity[];

    @OneToMany(() => DashboardFolderEntity, (relation) => relation.Dashboard)
    dashboards: DashboardFolderEntity[];

    @OneToMany(() => WidgetsRelationEntity, (relation) => relation.Widget)
    widgets: WidgetsRelationEntity[];

    @OneToMany(() => FolderSpaceTeamEntity, (item) => item.id, {nullable: true})
    FolderSpaceTeams: FolderSpaceTeamEntity[];

    @OneToMany(() => FolderSpaceCustomFieldCollectionEntity, (item) => item.Folder, {nullable: true})
    FolderSpaceCustomFields: FolderSpaceCustomFieldCollectionEntity[];

    @OneToMany(() => FolderSpaceWorkflowEntity, (item) => item.Folder, {nullable: true})
    FolderSpaceWorkflows: FolderSpaceWorkflowEntity[];

    @OneToMany(() => FolderSpaceTagsCollectionEntity, (item) => item.Folder, {nullable: true})
    FolderSpaceTags: FolderSpaceTagsCollectionEntity[];
}
