import {Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {contructorLogger} from '@lib/base-library';
import {DeleteResult, InsertResult, Repository, UpdateResult} from 'typeorm';
import {CustomFieldCollectionBaseService} from './custom-field-collection-base.service';
import {CustomFieldCollectionEntity} from '../../model/custom-field-collection.entity';
import {CustomFieldDefinitionEntity} from '../../model/custom-field-definition.entity';
import {CreateCustomFieldCollectionDto} from '../../dto/custom-field-collection/create-custom-field-collection.dto';
import {CustomFieldCollectionRelationEntity} from '../../model/custom-field-collection-relation.entity';
import {GetCustomFieldCollectionDto} from '../../dto/custom-field-collection/get-custom-field-collection.dto';
import {UpdateCustomFieldCollectionDto} from '../../dto/custom-field-collection/update-custom-field-colleciton.dto';

@Injectable()
export class CustomFieldCollectionService extends CustomFieldCollectionBaseService {
    constructor(
        @InjectRepository(CustomFieldCollectionEntity) protected readonly repo: Repository<CustomFieldCollectionEntity>,
        @InjectRepository(CustomFieldCollectionRelationEntity)
        protected readonly repoRelation: Repository<CustomFieldCollectionRelationEntity>,
        @InjectRepository(CustomFieldDefinitionEntity) protected readonly repoDefination: Repository<CustomFieldDefinitionEntity>
    ) {
        super(repo, repoRelation, repoDefination);
        contructorLogger(this);
    }

    async createOne(dto: CreateCustomFieldCollectionDto, userId: string): Promise<InsertResult> {
        try {
            return await super.createOne(dto, userId);
        } catch (e) {
            this.logger.error(`There was an error while creating Custom Field Collection`);
            throw e;
        }
    }

    async getAll(): Promise<GetCustomFieldCollectionDto[]> {
        try {
            return await super.getAll();
        } catch (e) {
            this.logger.error(`There was an error getting Custom Field Collections`);
            throw e;
        }
    }

    async updateOne(dto: UpdateCustomFieldCollectionDto, userId: string, id: number): Promise<UpdateResult> {
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
