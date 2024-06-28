import {Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {contructorLogger} from '@lib/base-library';
import {DeleteResult, InsertResult, Repository, UpdateResult} from 'typeorm';
import {TagCollectionEntity} from '../../model/tag-collection.entity';
import {TagCollectionRelationEntity} from '../../model/tag-collection-relation.entity';
import {TagEntity} from '../../model/tag.entity';
import {TagCollectionBaseService} from './tags-collection-base.service';
import {GetTagCollectionDto} from '../../dto/tag-collection/get-tag-collection.dto';
import {CreateTagCollectionDto} from '../../dto/tag-collection/create-tag-collection.dto';
import {UpdateTagCollectionDto} from '../../dto/tag-collection/update-tag-colleciton.dto';

@Injectable()
export class TagCollectionService extends TagCollectionBaseService {
    constructor(
        @InjectRepository(TagCollectionEntity) protected readonly repo: Repository<TagCollectionEntity>,
        @InjectRepository(TagCollectionRelationEntity)
        protected readonly repoRelation: Repository<TagCollectionRelationEntity>,
        @InjectRepository(TagEntity) protected readonly repoDefination: Repository<TagEntity>
    ) {
        super(repo, repoRelation, repoDefination);
        contructorLogger(this);
    }

    async createOne(dto: CreateTagCollectionDto, userId: string): Promise<InsertResult> {
        try {
            return await super.createOne(dto, userId);
        } catch (e) {
            this.logger.error(`There was an error while creating Tag Collection`);
            throw e;
        }
    }

    async getAll(): Promise<GetTagCollectionDto[]> {
        try {
            return await super.getAll();
        } catch (e) {
            this.logger.error(`There was an error getting Custom Field Collections`);
            throw e;
        }
    }

    async updateOne(dto: UpdateTagCollectionDto, userId: string, id: number): Promise<UpdateResult> {
        try {
            return await super.updateOne(dto, userId, id);
        } catch (e) {
            this.logger.error(`There was an error while updating Custom Field Collection`);
            throw e;
        }
    }

    async deleteOne(id: number): Promise<DeleteResult> {
        try {
            return await super.deleteOne(id);
        } catch (e) {
            this.logger.error(`There was an error while deleting Custom Field Collection`);
            throw e;
        }
    }
}
