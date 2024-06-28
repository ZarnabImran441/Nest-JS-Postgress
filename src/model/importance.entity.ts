import {Column, Entity, OneToMany, Unique} from 'typeorm';
import {TaskManagementBaseEntity} from './base.entity';
import {TaskEntity} from './task.entity';

@Entity('importance')
@Unique(['description'])
export class ImportanceEntity extends TaskManagementBaseEntity {
    @Column()
    index: number;

    @Column({length: 32})
    description: string;

    @Column({length: 32})
    icon: string;

    @Column({nullable: false, length: 32})
    color: string;

    @Column()
    default: boolean;

    @OneToMany(() => TaskEntity, (item) => item.Importance)
    Tasks: TaskEntity[];
}
