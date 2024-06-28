import {Injectable, NotFoundException} from '@nestjs/common';
import {DeleteResult, InsertResult, Repository, UpdateResult} from 'typeorm';
import {InjectRepository} from '@nestjs/typeorm';
import {Transactional} from 'typeorm-transactional';
import {FolderFilterBaseService} from './folder-filter-base.service';
import {FolderFilterEntity} from '../../../model/folder-filter.entity';
import {CreateFolderFilterDto} from '../../../dto/folder/filter/create-folder-filter.dto';
import {UpdateFolderFilterDto} from '../../../dto/folder/filter/update-folder-filter.dto';
import {contructorLogger} from '@lib/base-library';

@Injectable()
export class FolderFilterService extends FolderFilterBaseService {
    constructor(@InjectRepository(FolderFilterEntity) protected readonly repoFolderFilter: Repository<FolderFilterEntity>) {
        super(repoFolderFilter);
        contructorLogger(this);
    }

    async getOneByFolderId(folderId: number): Promise<FolderFilterEntity[]> {
        //** Check If the user have permissions or not */
        try {
            return await super.getOneByFolderId(folderId);
        } catch (error) {
            this.logger.error(`There was an error while fetching folder filter with folder id : ${folderId}`, error);
            throw error;
        }
    }

    async getMany(): Promise<FolderFilterEntity[]> {
        //** Check If the user have permissions or not */
        try {
            return await super.getMany();
        } catch (error) {
            this.logger.log({level: 'error', message: 'Error while getting folder-filters:' + error, error});
            throw error;
        }
    }

    @Transactional()
    async create(folderId: number, dto: CreateFolderFilterDto): Promise<InsertResult> {
        //** Check If the user have permissions or not */
        try {
            return await super.create(folderId, dto);
        } catch (error) {
            this.logger.error(`There was an error while creating folder filter with folder id : ${folderId}`, error);
            throw error;
        }
    }

    @Transactional()
    async update(folderFilterId: number, folderId: number, dto: UpdateFolderFilterDto): Promise<UpdateResult> {
        //** Check If the user have permissions or not */
        const folderFilterDB = await this.repoFolderFilter.findOne({where: {id: folderFilterId}});
        if (!folderFilterDB) {
            throw new NotFoundException(`Folder filter with id: ${folderFilterId} not found`);
        }
        return await super.update(folderFilterId, folderId, dto);
    }

    @Transactional()
    async delete(folderFilterId: number): Promise<DeleteResult> {
        //** Check If the user have permissions or not */
        const folderFilterDB = await this.repoFolderFilter.findOne({where: {id: folderFilterId}});
        if (!folderFilterDB) {
            throw new NotFoundException(`Folder filter with id: ${folderFilterId} not found`);
        }
        return await super.delete(folderFilterId);
    }
}
