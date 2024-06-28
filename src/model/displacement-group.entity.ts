import {Column, Entity, OneToMany, Unique} from 'typeorm';
import {TaskManagementBaseEntity} from './base.entity';
import {DisplacementCodeEntity} from './displacement-code.entity';

@Entity('displacement_group')
@Unique(['title'])
export class DisplacementGroupEntity extends TaskManagementBaseEntity {
    @Column({length: 64})
    title: string;

    @Column({length: 32})
    icon: string;

    @OneToMany(() => DisplacementCodeEntity, (item) => item.DisplacementGroup)
    DisplacementCodes: DisplacementCodeEntity[];
}
