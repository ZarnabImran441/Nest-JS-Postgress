import {stringArrayTransformer} from '@lib/base-library';
import {AfterLoad, Check, Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany} from 'typeorm';
import {ApprovalEntity} from './approval.entity';
import {TaskManagementBaseEntity} from './base.entity';
import {CustomFieldValueEntity} from './custom-field-value.entity';
import {FolderTaskPredecessorEntity} from './folder-task-predecessor.entity';
import {ImportanceEntity} from './importance.entity';
import {NotificationEntity} from './notification.entity';
import {TagTaskFolderEntity} from './tag-task-folder.entity';
import {TaskActionEntity} from './task-action.entity';
import {TaskAttachmentEntity} from './task-attachment.entity';
import {TaskFollowerEntity} from './task-follower.entity';
import {TaskRelationEntity} from './task-relation.entity';
import {UserActionEntity} from './user-action.entity';

@Entity('task')
@Check('("complete" IS NULL) OR ("complete" IS NOT NULL AND "complete" BETWEEN 0 AND 100)')
@Check('("fixed_start_date" = FALSE) OR ("fixed_start_date" = TRUE AND "start_date" IS NOT NULL)')
export class TaskEntity extends TaskManagementBaseEntity {
    @Column({length: 256})
    title: string;

    @Column({type: 'text', nullable: true})
    description: string;

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

    @Column({nullable: true, type: 'decimal', precision: 8, scale: 2})
    duration: number;

    @Column({nullable: true, type: 'decimal', precision: 8, scale: 2})
    complete: number;

    @Column({nullable: true, type: 'decimal', precision: 8, scale: 2})
    effort: number;

    @Column({name: 'fixed_start_date', default: false})
    fixedStartDate: boolean;

    @Column({name: 'user_id', type: 'uuid', nullable: false})
    userId: string;

    @ManyToOne(() => ImportanceEntity, (item) => item.Tasks, {nullable: true})
    @JoinColumn({name: 'importance_id', referencedColumnName: 'id'})
    Importance: ImportanceEntity;
    @Column({name: 'importance_id', nullable: true})
    importanceId?: number;

    @Column({length: 32, name: 'source', nullable: true})
    source: string;

    @Column({type: 'jsonb', nullable: true, name: 'extra'})
    extra: object;

    @Column({name: 'show_on', type: 'simple-array', array: true, transformer: stringArrayTransformer, nullable: true})
    showOn: string[];

    @Column({name: 'completed_at', nullable: true})
    completedAt: Date;

    @Column({name: 'completed_by', type: 'uuid', nullable: true})
    completedBy: string;

    @Column({
        name: 'assignees',
        type: 'simple-array',
        default: [],
        array: true,
        transformer: stringArrayTransformer,
    })
    assignees: string[];

    @OneToMany(() => CustomFieldValueEntity, (item) => item.Task)
    CustomFieldValues: CustomFieldValueEntity[];

    @OneToMany(() => TaskRelationEntity, (item) => item.ParentTask)
    ParentTasks: TaskRelationEntity[];

    @OneToMany(() => TaskRelationEntity, (item) => item.ChildTask)
    ChildrenTasks: TaskRelationEntity[];

    @OneToMany(() => TaskAttachmentEntity, (item) => item.Task)
    Attachments: TaskAttachmentEntity[];

    @OneToMany(() => TaskActionEntity, (item) => item.Task)
    Actions: TaskActionEntity[];

    @OneToMany(() => TagTaskFolderEntity, (item) => item.Task)
    Tags: TagTaskFolderEntity[];

    @OneToMany(() => FolderTaskPredecessorEntity, (item) => item.Predecessor)
    Predecessors: FolderTaskPredecessorEntity[];

    @OneToMany(() => FolderTaskPredecessorEntity, (item) => item.Successor)
    Successors: FolderTaskPredecessorEntity[];

    @OneToMany(() => TaskFollowerEntity, (item) => item.Task)
    Followers: TaskFollowerEntity[];

    @OneToMany(() => UserActionEntity, (item) => item.Task)
    UserActions: UserActionEntity[];

    @OneToMany(() => ApprovalEntity, (item) => item.task)
    approvals: ApprovalEntity[];
    @OneToMany(() => NotificationEntity, (item) => item.task)
    notifications: NotificationEntity[];
    @AfterLoad()
    afterLoad(): void {
        if (this.duration) {
            this.duration = Number(this.duration);
        }
        if (this.complete) this.complete = Number(this.complete);
        if (this.effort) this.effort = Number(this.effort);
    }
}
