import {Injectable, Logger} from '@nestjs/common';
import {DeleteResult, InsertResult, Repository, UpdateResult} from 'typeorm';
import {InjectRepository} from '@nestjs/typeorm';
import {Transactional} from 'typeorm-transactional';
import {FolderFilterEntity} from '../../../model/folder-filter.entity';
import {CreateFolderFilterDto} from '../../../dto/folder/filter/create-folder-filter.dto';
import {UpdateFolderFilterDto} from '../../../dto/folder/filter/update-folder-filter.dto';
import {contructorLogger} from '@lib/base-library';

@Injectable()
export class FolderFilterBaseService {
    protected logger: Logger;

    //** Add grant and revoke permissions here */
    constructor(@InjectRepository(FolderFilterEntity) protected readonly repoFolderFilter: Repository<FolderFilterEntity>) {
        this.logger = new Logger(this.constructor.name);
        contructorLogger(this);
    }

    async getOneByFolderId(folderId: number): Promise<FolderFilterEntity[]> {
        return await this.repoFolderFilter.find({
            where: {Folder: {id: folderId}},
            select: ['id', 'Folder', 'filter', 'title', 'location'],
            relations: {Folder: true},
        });
    }

    async getMany(): Promise<FolderFilterEntity[]> {
        return await this.repoFolderFilter.find();
    }

    @Transactional()
    async create(folderId: number, dto: CreateFolderFilterDto): Promise<InsertResult> {
        return await this.repoFolderFilter.insert({
            Folder: {id: folderId},
            filter: dto.filter,
            title: dto.title,
            location: dto.location,
        });
    }

    @Transactional()
    async update(id: number, folderId: number, dto: UpdateFolderFilterDto): Promise<UpdateResult> {
        return await this.repoFolderFilter.update(id, {...dto, folderId});
    }

    @Transactional()
    async delete(id: number): Promise<DeleteResult> {
        return await this.repoFolderFilter.delete(id);
    }
}
