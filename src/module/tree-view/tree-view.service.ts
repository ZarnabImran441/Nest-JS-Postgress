import {Injectable, NotFoundException} from '@nestjs/common';
import {DeleteResult, Repository, UpdateResult} from 'typeorm';
import {Transactional} from 'typeorm-transactional';
import {InjectRepository} from '@nestjs/typeorm';
import {contructorLogger, JwtUserInterface} from '@lib/base-library';
import {TreeViewBaseService} from './tree-view-base.service';
import {TreeViewEntity} from '../../model/tree-view.entity';
import {TreeViewResponseDto} from '../../dto/tree-view/tree-view-response.dto';
import {CreateTreeViewDto} from '../../dto/tree-view/create-tree-view.dto';
import {UpdateTreeViewDto} from '../../dto/tree-view/update-tree-view.dto';

/**
 * Tree view service
 */
@Injectable()
export class TreeViewService extends TreeViewBaseService {
    constructor(@InjectRepository(TreeViewEntity) protected readonly treeViewRepo: Repository<TreeViewEntity>) {
        super(treeViewRepo);
        contructorLogger(this);
    }

    /**
     * Get all tree views for the current user filtered
     * @param userId
     */
    get(userId: string): Promise<TreeViewResponseDto[]> {
        //** Check If the user have permissions or not */
        try {
            return super.get(userId);
        } catch (error) {
            this.logger.log({level: 'error', message: 'Error while fetching tree-views:' + error, error});
            throw error;
        }
    }

    /**
     * Create a tree views for the current user
     * @param createTreeViewDto tree view definition
     * @param userId
     */
    @Transactional()
    async create(createTreeViewDto: CreateTreeViewDto, userId: string): Promise<TreeViewEntity> {
        //** Check If the user have permissions or not */
        try {
            return await super.create(createTreeViewDto, userId);
        } catch (error) {
            this.logger.log({level: 'error', message: 'Error while creating a tree-view:' + error, error});
            throw error;
        }
    }

    //TODO : Add RETURN TYPES
    /**
     * Update a tree views for the current user
     * @param treeViewId tree view id
     * @param updateTreeViewDto tree view definition
     * @param userId
     */
    @Transactional()
    async updateTreeView(treeViewId: number, updateTreeViewDto: UpdateTreeViewDto, userId: string): Promise<UpdateResult> {
        try {
            const treeViewDB = await this.treeViewRepo.findOne({
                where: {
                    id: treeViewId,
                    userId,
                },
            });
            if (!treeViewDB) {
                throw new NotFoundException(`Tree-view with id: ${treeViewId} not found`);
            }
            return await super.update(treeViewId, updateTreeViewDto, userId);
        } catch (error) {
            this.logger.error(`There was an error while updating tree-view with id: ${treeViewId}`, error);
            throw error;
        }
    }

    /**
     * Delete a tree view from the current user
     * @param treeViewId tree view id
     * @param userId
     */
    @Transactional()
    async remove(treeViewId: number, userId: string): Promise<DeleteResult> {
        try {
            return await super.remove(treeViewId, userId);
        } catch (error) {
            this.logger.error(`There was an error while deleting tree-view with id: ${treeViewId} - ${userId}`, error);
            throw error;
        }
    }

    async setActiveTree(treeViewId: number, userId: string): Promise<UpdateResult> {
        try {
            return await super.setActive(treeViewId, userId);
        } catch (error) {
            this.logger.error(`There was an error while updating tree-view state with id: ${treeViewId}`, error);
            throw error;
        }
    }

    // TODO : Update in Monorepo
    /**
     * Update a tree views position
     * @param tree_view_id tree view id
     * @param updateTreeViewDto tree view definition
     * @param user current user
     */
    async updateTreeViewPosition(treeViewId: number, dto: UpdateTreeViewDto, user: JwtUserInterface): Promise<TreeViewResponseDto[]> {
        return await super.updatePosition(treeViewId, dto, user.id);
    }
}
