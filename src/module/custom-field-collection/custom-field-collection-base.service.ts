import {DeleteResult, InsertResult, Repository, UpdateResult} from 'typeorm';
import {Injectable, Logger} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {contructorLogger} from '@lib/base-library';
import {Transactional} from 'typeorm-transactional';
import {CustomFieldCollectionEntity} from '../../model/custom-field-collection.entity';
import {CustomFieldDefinitionEntity} from '../../model/custom-field-definition.entity';
import {CreateCustomFieldCollectionDto} from '../../dto/custom-field-collection/create-custom-field-collection.dto';
import {CustomFieldCollectionRelationEntity} from '../../model/custom-field-collection-relation.entity';
import {GetCustomFieldCollectionDto} from '../../dto/custom-field-collection/get-custom-field-collection.dto';
import {UpdateCustomFieldCollectionDto} from '../../dto/custom-field-collection/update-custom-field-colleciton.dto';
import {RawDatabaseConfig} from '../../config/database.config';

@Injectable()
export class CustomFieldCollectionBaseService {
    protected logger: Logger;
    constructor(
        @InjectRepository(CustomFieldCollectionEntity) protected readonly repo: Repository<CustomFieldCollectionEntity>,
        @InjectRepository(CustomFieldCollectionRelationEntity)
        protected readonly repoRelation: Repository<CustomFieldCollectionRelationEntity>,
        @InjectRepository(CustomFieldDefinitionEntity) protected readonly repoDefination: Repository<CustomFieldDefinitionEntity>
    ) {
        this.logger = new Logger(this.constructor.name);
        contructorLogger(this);
    }

    @Transactional()
    async createOne(dto: CreateCustomFieldCollectionDto, userId: string): Promise<InsertResult> {
        const {title, customFieldIds, description, active} = dto;

        const customFieldCollectionDB = await this.repo.insert({title, description, active, createdAt: new Date(), createdBy: userId});

        for (const customFieldId of customFieldIds) {
            await this.repoRelation.insert({
                CustomFieldDefinationId: customFieldId,
                CustomFieldCollectionId: customFieldCollectionDB.identifiers[0].id,
            });
        }
        return customFieldCollectionDB;
    }

    @Transactional()
    async updateOne(dto: UpdateCustomFieldCollectionDto, userId: string, id: number): Promise<UpdateResult> {
        const {customFieldIds, title, description, active} = dto;

        await this.repoRelation.delete({
            CustomFieldCollectionId: id,
        });

        for (const customFieldId of customFieldIds) {
            await this.repoRelation.save({
                CustomFieldDefinationId: customFieldId,
                CustomFieldCollectionId: id,
            });
        }

        return await this.repo.update(id, {title, description, active, updatedAt: new Date(), updatedBy: userId});
    }

    async getAll(): Promise<GetCustomFieldCollectionDto[]> {
        const sql = `WITH cfd_aggregates AS (
            SELECT
                "cfd"."id" AS cfd_id,
                COUNT(DISTINCT "custom_field_value"."folder_id")::integer AS total_folders,
                COUNT(CASE WHEN "custom_field_value"."task_id" IS NOT NULL AND ("custom_field_value"."value" IS NULL OR "custom_field_value"."value" = '') THEN 1 ELSE NULL END)::integer AS un_populated_tasks,
                COUNT(CASE WHEN "custom_field_value"."task_id" IS NOT NULL AND ("custom_field_value"."value" IS NOT NULL AND "custom_field_value"."value" != '') THEN 1 ELSE NULL END)::integer AS populated_tasks
            FROM 
                "${RawDatabaseConfig.schema}"."custom_field_definition" AS "cfd"
            LEFT JOIN "${RawDatabaseConfig.schema}"."custom_field_value" ON "cfd"."id" = "${RawDatabaseConfig.schema}"."custom_field_value"."custom_field_definition_id"
            GROUP BY "cfd"."id"
        )
        SELECT 
            custom_field_collection.id,
            custom_field_collection.title,
            custom_field_collection.description,
            custom_field_collection.created_at AS "createdAt",
            custom_field_collection.created_by AS "createdBy",
            custom_field_collection.active,
            custom_field_collection.updated_at AS "updatedAt",
            custom_field_collection.updated_by AS "updatedBy",
            JSON_AGG(
                JSON_BUILD_OBJECT(
                    'id', cfd.id,
                    'title', cfd.title,
                    'type', cfd.type,
                    'inheritanceType', cfd.inheritance_type,
                    'userId', cfd.user_id,
                    'createdAt', cfd.created_at,
                    'createdBy', cfd.created_by,
                    'updatedAt', cfd.updated_at,
                    'updatedBy', cfd.updated_by,
                    'active', cfd.active,
                    'description', cfd.description,
                    'setting', cfd.setting,
                    'totalFolders', aggr.total_folders,
                    'unPopulatedTasks', aggr.un_populated_tasks,
                    'populatedTasks', aggr.populated_tasks
                )
            ) AS "customFields"
        FROM 
        "${RawDatabaseConfig.schema}"."custom_field_collection"
        LEFT JOIN "${RawDatabaseConfig.schema}"."custom_field_collection_relation" AS "cfc_cfr" ON "custom_field_collection"."id" = "cfc_cfr"."custom_field_collection_id"
        LEFT JOIN "${RawDatabaseConfig.schema}"."custom_field_definition" AS "cfd" ON "cfc_cfr"."custom_field_defination_id" = "cfd"."id"
        LEFT JOIN cfd_aggregates AS aggr ON "cfd"."id" = aggr.cfd_id
        GROUP BY 
        "${RawDatabaseConfig.schema}"."custom_field_collection"."id"`;

        return await this.repo.query(sql);
    }

    @Transactional()
    async deleteOne(id: number): Promise<DeleteResult> {
        await this.repoRelation.delete({
            CustomFieldCollectionId: id,
        });

        const deleteResult = await this.repo.delete({
            id,
        });

        return deleteResult;
    }
}
