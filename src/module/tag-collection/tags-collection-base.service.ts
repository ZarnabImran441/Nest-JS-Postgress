import {DeleteResult, InsertResult, Repository, UpdateResult} from 'typeorm';
import {Injectable, Logger} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {contructorLogger} from '@lib/base-library';
import {TagCollectionEntity} from '../../model/tag-collection.entity';
import {TagCollectionRelationEntity} from '../../model/tag-collection-relation.entity';
import {TagEntity} from '../../model/tag.entity';
import {GetTagCollectionDto} from '../../dto/tag-collection/get-tag-collection.dto';
import {Transactional} from 'typeorm-transactional';
import {CreateTagCollectionDto} from '../../dto/tag-collection/create-tag-collection.dto';
import {UpdateTagCollectionDto} from '../../dto/tag-collection/update-tag-colleciton.dto';

@Injectable()
export class TagCollectionBaseService {
    protected logger: Logger;
    constructor(
        @InjectRepository(TagCollectionEntity) protected readonly repo: Repository<TagCollectionEntity>,
        @InjectRepository(TagCollectionRelationEntity)
        protected readonly repoRelation: Repository<TagCollectionRelationEntity>,
        @InjectRepository(TagEntity) protected readonly repoDefination: Repository<TagEntity>
    ) {
        this.logger = new Logger(this.constructor.name);
        contructorLogger(this);
    }

    @Transactional()
    async createOne(dto: CreateTagCollectionDto, userId: string): Promise<InsertResult> {
        const {title, tagIds, description, active} = dto;

        const tagCollectionDB = await this.repo.insert({title, description, active, createdAt: new Date(), createdBy: userId});

        for (const id of tagIds) {
            await this.repoRelation.insert({
                tagId: id,
                TagCollectionId: tagCollectionDB.identifiers[0].id,
            });
        }
        return tagCollectionDB;
    }

    @Transactional()
    async updateOne(dto: UpdateTagCollectionDto, userId: string, id: number): Promise<UpdateResult> {
        const {tagIds, title, description, active} = dto;

        await this.repoRelation.delete({
            TagCollectionId: id,
        });

        for (const tag of tagIds) {
            await this.repoRelation.save({
                tagId: tag,
                TagCollectionId: id,
            });
        }

        return await this.repo.update(id, {title, description, active, updatedAt: new Date(), updatedBy: userId});
    }

    async getAll(): Promise<GetTagCollectionDto[]> {
        const TagCollectionDB = await this.repo.find({
            relations: {TagCollectionRelation: {tag: true}},
            order: {createdAt: 'DESC'},
        });

        const data: GetTagCollectionDto[] = [];
        for (const collection of TagCollectionDB) {
            const tags = collection.TagCollectionRelation.map((el) => el.tag);
            data.push({
                title: collection.title,
                id: collection.id,
                description: collection.description,
                active: collection.active,
                createdAt: collection.createdAt,
                createdBy: collection.createdBy,
                updatedAt: collection.updatedAt,
                updatedBy: collection.updatedBy,
                Tags: tags,
            });
        }
        return data;
    }

    @Transactional()
    async deleteOne(id: number): Promise<DeleteResult> {
        await this.repoRelation.delete({
            TagCollectionId: id,
        });

        const deleteResult = await this.repo.delete({
            id,
        });

        return deleteResult;
    }
}
