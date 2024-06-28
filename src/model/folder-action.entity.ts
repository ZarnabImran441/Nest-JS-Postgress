import {stringArrayTransformer} from '@lib/base-library';
import {Column, Entity, JoinColumn, ManyToOne} from 'typeorm';
import {FolderActionOptions} from '../enum/folder-action.enum';
import {FolderActionParameterInterface} from '../interface/folder-action-parameter.interface';
import {TaskManagementBaseEntity} from './base.entity';
import {FolderEntity} from './folder.entity';

@Entity('folder_action')
export class FolderActionEntity extends TaskManagementBaseEntity {
    @Column({enum: FolderActionOptions, type: 'enum'})
    action: FolderActionOptions;

    @Column('timestamp with time zone', {nullable: false, default: () => 'CURRENT_TIMESTAMP'})
    date: Date;

    @Column({type: 'jsonb', nullable: true})
    user: object;

    @Column({name: 'message_id', length: 128})
    messageId: string;

    @Column({name: 'mention_members', type: 'simple-array', nullable: true, array: true, transformer: stringArrayTransformer})
    mentionMembers: string[];

    @Column({type: 'jsonb', nullable: true})
    parameters: FolderActionParameterInterface;

    @Column({type: 'jsonb', nullable: true})
    folder: object;

    @ManyToOne(() => FolderEntity, (folder) => folder.Actions, {nullable: true})
    @JoinColumn({name: 'folder_id', referencedColumnName: 'id'})
    Folder: FolderEntity;
    @Column({name: 'folder_id', nullable: true})
    folderId: number;
}
