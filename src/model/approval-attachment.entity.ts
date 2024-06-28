import {Column, Entity, JoinColumn, ManyToOne} from 'typeorm';
import {FileTypeOptions} from '../enum/task-action.enum';
import {ApprovalEntity} from './approval.entity';
import {TaskManagementBaseEntity} from './base.entity';
@Entity('approval_attachment')
export class ApprovalAttachmentEntity extends TaskManagementBaseEntity {
    @ManyToOne(() => ApprovalEntity, (approval) => approval.attachments, {nullable: false})
    @JoinColumn({name: 'approval_id', referencedColumnName: 'id'})
    approval: ApprovalEntity;
    @Column({name: 'file_name', length: 1024})
    fileName: string;
    @Column({name: 'thumbnail_name', length: 1024})
    thumbnailName: string;
    @Column({name: 'original_name', length: 256})
    originalName: string;
    @Column({enum: FileTypeOptions, name: 'file_type', type: 'enum'})
    fileType: FileTypeOptions;
    @Column({name: 'file_size'})
    fileSize: string;
}
