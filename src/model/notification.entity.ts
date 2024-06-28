import {Column, Entity, JoinColumn, ManyToOne} from 'typeorm';
import {NotificationDto} from '../module/notifications-api-connector/dto/notification.dto';
import {TaskManagementBaseEntity} from './base.entity';
import {FolderEntity} from './folder.entity';
import {TaskEntity} from './task.entity';
import {UserEntity} from './user.entity';

/**
 * Represents a notification entity.
 * @class NotificationEntity
 * @Entity('notification')
 */
@Entity('notification')
export class NotificationEntity extends TaskManagementBaseEntity {
    @Column('timestamp with time zone', {nullable: false, default: () => 'CURRENT_TIMESTAMP'})
    date: Date;

    @Column({name: 'read', default: false})
    read: boolean;

    @Column({type: 'text', nullable: false})
    message: string;

    @Column({name: 'content', nullable: true, type: 'jsonb'})
    content: NotificationDto;

    @ManyToOne(() => FolderEntity, (folder) => folder.notifications)
    @JoinColumn({name: 'folder_id', referencedColumnName: 'id'})
    folder: FolderEntity;

    @ManyToOne(() => TaskEntity, (task) => task.notifications)
    @JoinColumn({name: 'task_id', referencedColumnName: 'id'})
    task: TaskEntity;

    @ManyToOne(() => FolderEntity, (folder) => folder.notifications)
    @JoinColumn({name: 'space_id', referencedColumnName: 'id'})
    space: FolderEntity;

    @Column({nullable: false, length: 128})
    event: string;

    @ManyToOne(() => UserEntity, (user) => user.notifications)
    @JoinColumn({name: 'user_id', referencedColumnName: 'id'})
    user: UserEntity;
}
