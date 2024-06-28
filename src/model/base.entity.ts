import {BaseEntity} from '@lib/base-library';
import {PrimaryGeneratedColumn} from 'typeorm';

export class TaskManagementBaseEntity extends BaseEntity {
    @PrimaryGeneratedColumn()
    id: number;
}
