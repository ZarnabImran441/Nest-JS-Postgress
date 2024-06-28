import {Injectable, Logger} from '@nestjs/common';
import {DeleteResult, Repository, UpdateResult} from 'typeorm';
import {Transactional} from 'typeorm-transactional';
import {TreeViewEntity} from '../../model/tree-view.entity';
import {TreeViewResponseDto} from '../../dto/tree-view/tree-view-response.dto';
import {CreateTreeViewDto} from '../../dto/tree-view/create-tree-view.dto';
import {TreeViewFolderEntity} from '../../model/tree-view-folder.entity';
import {FolderEntity} from '../../model/folder.entity';
import {validateUserPermissionsOnFolders} from '../../utils/helpers';
import {UserPermissionOptions} from '../../enum/folder-user.enum';
import {UpdateTreeViewDto} from '../../dto/tree-view/update-tree-view.dto';
import {RawDatabaseConfig} from '../../config/database.config';
import {contructorLogger} from '@lib/base-library';

Injectable();

export class TreeViewBaseService {
    protected logger: Logger;

    constructor(protected readonly treeViewRepo: Repository<TreeViewEntity>) {
        contructorLogger(this);
    }

    /**
     * Get all tree views for the current user filtered
     * @param userId
     */
    get(userId: string): Promise<TreeViewResponseDto[]> {
        return this.treeViewRepo.manager
            .createQueryBuilder()
            .select(['id', 'title', 'color', 'icon', 'active', 'index'])
            .addSelect(
                `(SELECT ARRAY (SELECT tvf.folder_id FROM "${RawDatabaseConfig.schema}".tree_view_folder tvf WHERE tvf.tree_view_id = tv.id))`,
                'folderIds'
            )
            .from(TreeViewEntity, 'tv')
            .where('user_id = :user_id', {user_id: userId})
            .orderBy('index', 'ASC')
            .getRawMany();
    }

    /**
     * Create a tree views for the current user
     * @param createTreeViewDto tree view definition
     * @param userId
     */
    @Transactional()
    async create(createTreeViewDto: CreateTreeViewDto, userId: string): Promise<TreeViewEntity> {
        const repoTreeViewFolder = this.treeViewRepo.manager.getRepository<TreeViewFolderEntity>(TreeViewFolderEntity),
            repoFolder = this.treeViewRepo.manager.getRepository<FolderEntity>(FolderEntity);
        // validate user has permission on folder ids
        await validateUserPermissionsOnFolders(repoFolder, createTreeViewDto.folderIds, userId, [
            UserPermissionOptions.FULL,
            UserPermissionOptions.EDITOR,
            UserPermissionOptions.READONLY,
        ]);
        // save tree view
        const treeViewDB = await this.treeViewRepo.save({
            title: createTreeViewDto.title,
            color: createTreeViewDto.color,
            icon: createTreeViewDto.icon,
            active: false,
            index: createTreeViewDto.index,
            userId,
        });
        for (const folderId of createTreeViewDto.folderIds) {
            await repoTreeViewFolder.insert({TreeView: {id: treeViewDB.id}, Folder: {id: folderId}});
        }
        return treeViewDB;
    }

    //TODO : Add RETURN TYPES
    /**
     * Update a tree views for the current user
     * @param treeViewId tree view id
     * @param updateTreeViewDto tree view definition
     * @param _userId
     */
    @Transactional()
    async update(treeViewId: number, updateTreeViewDto: UpdateTreeViewDto, _userId: string): Promise<UpdateResult> {
        const repoTreeViewFolder = this.treeViewRepo.manager.getRepository<TreeViewFolderEntity>(TreeViewFolderEntity);
        // repoFolder = this.treeViewRepo.manager.getRepository<FolderEntity>(FolderEntity);
        // validate user has permission on folder ids
        // await validateUserPermissionsOnFolders(repoFolder, updateTreeViewDto.folderIds, userId, [
        //     UserPermissionOptions.FULL,
        //     UserPermissionOptions.EDITOR,
        //     UserPermissionOptions.READONLY,
        // ]);
        // update tree view
        if (updateTreeViewDto.folderIds) {
            await repoTreeViewFolder.delete({TreeView: {id: treeViewId}});
            for (const folderId of updateTreeViewDto.folderIds) {
                await repoTreeViewFolder.insert({TreeView: {id: treeViewId}, Folder: {id: folderId}});
            }
        }
        delete updateTreeViewDto.folderIds;
        return await this.treeViewRepo.update({id: treeViewId}, {...updateTreeViewDto});
    }

    /**
     * Delete a tree view from the current user
     * @param treeViewId tree view id
     * @param _userId
     */
    @Transactional()
    async remove(treeViewId: number, _userId: string): Promise<DeleteResult> {
        const repoTreeViewFolder = this.treeViewRepo.manager.getRepository<TreeViewFolderEntity>(TreeViewFolderEntity);
        // delete tree view
        await repoTreeViewFolder.delete({TreeView: {id: treeViewId}});
        return await this.treeViewRepo.delete({id: treeViewId});
    }

    @Transactional()
    async setActive(treeViewId: number, userId: string): Promise<UpdateResult> {
        const repoTreeView = this.treeViewRepo.manager.getRepository<TreeViewEntity>(TreeViewEntity);
        // update all to not active
        await repoTreeView
            .createQueryBuilder()
            .where(`id <> :treeViewId`, {treeViewId})
            .andWhere(`user_id = :user_id`, {user_id: userId})
            .update({active: false})
            .execute();
        // update tree view to active
        return this.treeViewRepo.update({id: treeViewId}, {active: true});
    }

    //todo : test case
    @Transactional()
    async updatePosition(treeViewId: number, dto: UpdateTreeViewDto, userId: string): Promise<TreeViewResponseDto[]> {
        const manager = this.treeViewRepo.manager;
        const repoTreeView = manager.getRepository<TreeViewEntity>(TreeViewEntity);
        // get tree view with folder
        const treeViewDB = await repoTreeView.findOne({
            where: {id: treeViewId, userId: userId},
        });

        const isIncrease = dto.index > treeViewDB.index;

        const treeViews = await repoTreeView
            .createQueryBuilder('tv')
            .where('tv.index <= :upperIndex', {upperIndex: isIncrease ? dto.index : treeViewDB.index})
            .andWhere('tv.index >= :lowerIndex', {lowerIndex: isIncrease ? treeViewDB.index : dto.index})
            .andWhere(`tv.user_id = :user_id`, {user_id: userId})
            .andWhere(`tv.id != :id`, {id: treeViewId})
            .getMany();

        for (const treeView of treeViews) {
            const index = isIncrease ? (treeView.index ? treeView.index - 1 : 0) : treeView.index + 1;
            await repoTreeView.update({id: treeView.id}, {index});
        }
        // update tree view index
        await repoTreeView.update({id: treeViewId}, {index: dto.index});
        return await this.get(userId);
    }
}
