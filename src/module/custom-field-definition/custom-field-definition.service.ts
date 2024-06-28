import {BadRequestException, Injectable, Logger, NotFoundException} from '@nestjs/common';
import {DeleteResult, InsertResult, IsNull, Repository, UpdateResult} from 'typeorm';
import {InjectRepository} from '@nestjs/typeorm';
import {Transactional} from 'typeorm-transactional';
import {CustomFieldDefinitionEntity} from '../../model/custom-field-definition.entity';
import {CreateCustomFieldDefinitionDto} from '../../dto/custom-field/create-custom-field-definition.dto';
import {CustomFieldDefinitionDto} from '../../dto/custom-field/custom-field-definition.dto';
import {UpdateCustomFieldDefinitionDto} from '../../dto/custom-field/update-custom-field-definition.dto';
import {contructorLogger, makeid} from '@lib/base-library';
import {CustomFieldDefinitionTypeOptions} from '../../enum/custom-field-definition.enum';

@Injectable()
export class CustomFieldDefinitionService {
    private logger: Logger;

    constructor(@InjectRepository(CustomFieldDefinitionEntity) protected readonly repo: Repository<CustomFieldDefinitionEntity>) {
        this.logger = new Logger(this.constructor.name);
        contructorLogger(this);
    }

    @Transactional()
    createCustomField(dto: CreateCustomFieldDefinitionDto, userId: string, common = false): Promise<InsertResult> {
        try {
            if (dto.type === CustomFieldDefinitionTypeOptions.DROPDOWN || dto.type === CustomFieldDefinitionTypeOptions.MULTIPLE) {
                dto.setting.options =
                    dto.setting.options?.map((el) => ({
                        ...el,
                        id: makeid(8),
                    })) || [];
            }
            return this.repo.insert({
                userId: common ? null : userId,
                title: dto.title,
                description: dto.description,
                type: dto.type,
                inheritanceType: dto.inheritanceType,
                createdAt: new Date(),
                createdBy: userId,
                active: dto.active,
                setting: dto.setting,
            });
        } catch (error) {
            this.logger.error(`There was an error creating a custom field type ${dto}`, error);
            throw error;
        }
    }

    async getCustomField(showInactive: boolean, userId: string = null): Promise<CustomFieldDefinitionDto[]> {
        try {
            const ret: CustomFieldDefinitionDto[] = [],
                whereCondition = userId ? 'CustomField.user_id = :user_id' : 'CustomField.user_id IS NULL',
                queryBuilder = this.repo
                    .createQueryBuilder('CustomField')
                    .leftJoin('CustomField.CustomFieldValues', 'CustomFieldValue')
                    .select([
                        '"CustomField".*',
                        'COUNT(DISTINCT CustomFieldValue.folderId)::integer AS total_folders',
                        "COUNT(CASE WHEN CustomFieldValue.taskId IS NOT NULL AND (CustomFieldValue.value IS NULL OR CustomFieldValue.value = '') THEN 1 ELSE NULL END)::integer AS un_populated_tasks",
                        "COUNT(CASE WHEN CustomFieldValue.taskId IS NOT NULL AND (CustomFieldValue.value IS NOT NULL AND CustomFieldValue.value != '') THEN 1 ELSE NULL END)::integer AS populated_tasks",
                    ])
                    .where(whereCondition, {user_id: userId});

            if (!showInactive) {
                queryBuilder.andWhere('CustomField.active = true');
            }
            const customFieldDB = await queryBuilder.groupBy('CustomField.id').getRawMany();

            for (const res of customFieldDB) {
                const data = {
                    id: res.id,
                    type: res.type,
                    inheritanceType: res.inheritanceType,
                    title: res.title,
                    active: res.active,
                    totalFolders: res.total_folders,
                    populatedTasks: res.populated_tasks,
                    unPopulatedTasks: res.un_populated_tasks,
                    createdAt: res.created_at,
                    createdBy: res.created_by,
                    updatedAt: res.updated_at,
                    updatedBy: res.updated_by,
                    description: res.description,
                    setting: res.setting,
                };
                ret.push(data);
            }
            return ret;
        } catch (error) {
            this.logger.error(`There was an error getting a custom field type ${userId}`, error);
            throw error;
        }
    }

    async getOneCustomField(id: number): Promise<CustomFieldDefinitionEntity> {
        try {
            return await this.repo.findOne({where: {id}});
        } catch (error) {
            this.logger.error(`There was an error getting a custom field id : ${id}`, error);
            throw error;
        }
    }

    @Transactional()
    async updateCustomField(id: number, dto: UpdateCustomFieldDefinitionDto, userId: string, common = false): Promise<UpdateResult> {
        try {
            return await this.repo.update({id, userId: common ? IsNull() : userId}, {...dto, updatedAt: new Date(), updatedBy: userId});
        } catch (e) {
            this.logger.error(`There was an error updating a custom field type ${id}`, e);
            throw e;
        }
    }

    @Transactional()
    async deleteCustomField(id: number, userId: string = null): Promise<DeleteResult> {
        try {
            return await this.repo.delete({id, userId: userId || IsNull()});
        } catch (error) {
            this.logger.error(`There was an error deleting a custom field type ${id}`, error);
            throw error;
        }
    }

    @Transactional()
    async convertCommonToUserCustomField(id: number, userId: string): Promise<UpdateResult> {
        try {
            return await this.repo.update(id, {userId});
        } catch (e) {
            this.logger.error(`There was an error updating a custom field type ${id}`, e);
            throw e;
        }
    }

    @Transactional()
    async convertUserToCommonCustomField(id: number, userId: string = null): Promise<UpdateResult> {
        //** User Custom field */
        const customFieldDB = await this.repo.findOne({
            where: {id, userId},
        });

        if (!customFieldDB) {
            throw new NotFoundException(`Custom field with id ${id} not found`);
        }

        // Only User can edit their own custom fields
        if (customFieldDB.userId && customFieldDB.userId /*User.id*/ !== userId)
            throw new BadRequestException(`You do not have sufficient permissions to edit custom field ${id}`);

        return await this.repo.update(id, {userId, updatedAt: new Date(), updatedBy: userId});
    }
}
