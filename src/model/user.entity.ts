import {BaseEntity} from '@lib/base-library';
import {Column, Entity, OneToMany, PrimaryColumn, Unique} from 'typeorm';
import {FolderNotificationsSettingsEntity} from './folder-notifications-settings.entity';
import {NotificationEntity} from './notification.entity';

@Entity('user')
@Unique(['email'])
export class UserEntity extends BaseEntity {
    @PrimaryColumn({type: 'uuid'})
    id: string;

    @Column({name: 'is_active', default: true})
    isActive: boolean;

    @Column({length: 128})
    email: string;

    @Column({name: 'first_name', length: 128})
    firstName: string;

    @Column({name: 'last_name', length: 128, nullable: true})
    lastName: string;

    @Column({name: 'picture_url', length: 256, nullable: true})
    pictureUrl: string;

    @Column({length: 32, nullable: true})
    color: string;

    @Column('jsonb', {nullable: false, default: {}})
    settings: object;

    @OneToMany(() => NotificationEntity, (notification) => notification.user)
    notifications: NotificationEntity[];

    @OneToMany(() => FolderNotificationsSettingsEntity, (notificationSettings) => notificationSettings.user)
    folderNotificationsSettings: FolderNotificationsSettingsEntity[];
}
