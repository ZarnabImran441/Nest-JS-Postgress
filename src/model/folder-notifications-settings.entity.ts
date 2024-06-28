import {ChannelTypeOptions} from '@lib/base-library';
import {Column, Entity, ManyToOne} from 'typeorm';
import {FolderEventNameOptions, TaskEventNameOptions} from '../enum/notification-event.enum';
import {TaskManagementBaseEntity} from './base.entity';
import {FolderEntity} from './folder.entity';
import {UserEntity} from './user.entity';

/**
 * Represents an entity that stores folder notifications settings.
 *
 * @class
 * @name FolderNotificationsSettingsEntity
 */
@Entity('folder_notifications_settings')
export class FolderNotificationsSettingsEntity extends TaskManagementBaseEntity {
    /**
     * Represents a folder entity.
     *
     * @typedef {Object} FolderEntity
     * @property {string} id - The unique identifier of the folder.
     * @property {string} name - The name of the folder.
     * @property {string[]} permissions - The list of permissions granted to the folder.
     * @property {number} size - The size of the folder in bytes.
     */
    @ManyToOne(() => FolderEntity, (folder) => folder.notificationsSettings, {nullable: false})
    folder: FolderEntity;

    /**
     * Represents a user entity.
     *
     * @class UserEntity
     */
    @ManyToOne(() => UserEntity, (user) => user.folderNotificationsSettings, {nullable: false})
    user: UserEntity;

    /**
     * Represents an array of EventChannels.
     *
     * @typedef {EventChannel[]} eventChannels
     */
    @Column({type: 'jsonb', nullable: false})
    eventChannels: EventChannel[];
}

/**
 * Represents an event channel that can be used to subscribe to specific events.
 * @class
 */
export class EventChannel {
    /**
     * Represents an event variable that can be of type TaskEventNameOptions or FolderEventNameOptions.
     * Use this variable to handle events related to tasks or folders.
     *
     * @typedef {TaskEventNameOptions | FolderEventNameOptions} event
     */
    event: TaskEventNameOptions | FolderEventNameOptions;

    /**
     * Represents an array of channel objects, along with their checked status.
     *
     * @typedef {Object} ChannelTypeOptions - An object representing the type of channel.
     * @property {string} channel - The name or identifier of the channel.
     *
     * @typedef {Object} Channel - An object representing a channel along with its checked status.
     * @property {ChannelTypeOptions} channel - The type of channel.
     * @property {boolean} checked - The checked status of the channel.
     *
     * @typedef {Array<Channel>} Channels - An array of channel objects with their checked status.
     *
     * @constant {Channels} channels - The variable representing an array of channel objects and their checked status.
     */
    channels: {channel: ChannelTypeOptions; checked: boolean}[];
}
