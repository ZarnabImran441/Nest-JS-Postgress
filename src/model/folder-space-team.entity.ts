import {Column, Entity, JoinColumn, ManyToOne, Unique} from 'typeorm';
import {UserPermissionOptions} from '../enum/folder-user.enum';
import {TaskManagementBaseEntity} from './base.entity';
import {FolderEntity} from './folder.entity';
import {RoleEntity} from './role.entity';

@Entity('folder_space_teams')
@Unique(['Folder', 'Team'])
export class FolderSpaceTeamEntity extends TaskManagementBaseEntity {
    @ManyToOne(() => FolderEntity, (folder) => folder.FolderSpaceTeams)
    @JoinColumn({name: 'folder_id', referencedColumnName: 'id'})
    Folder: FolderEntity;
    @Column({name: 'folder_id'})
    folderId: number;

    @ManyToOne(() => RoleEntity, (role) => role.FolderSpaceTeams)
    @JoinColumn({name: 'team_id', referencedColumnName: 'id'})
    Team: RoleEntity;
    @Column({name: 'team_id'})
    teamId: number;

    @Column({name: 'team_permissions', type: 'enum', enum: UserPermissionOptions, nullable: false, default: UserPermissionOptions.READONLY})
    teamPermissions: UserPermissionOptions;
}
