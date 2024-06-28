import {contructorLogger} from '@lib/base-library';
import {Injectable, Logger, NotFoundException} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {InsertResult, Repository, UpdateResult} from 'typeorm';
import {Transactional} from 'typeorm-transactional';
import {CreateCustomFieldValueDto} from '../../dto/custom-field/create-custom-field-value.dto';
import {UpdateCustomFieldValueDto} from '../../dto/custom-field/update-custom-field-value.dto';
import {CustomFieldDefinitionEntity} from '../../model/custom-field-definition.entity';
import {CustomFieldValueEntity} from '../../model/custom-field-value.entity';
import {validateCustomFieldValue} from '../../utils/helpers';

@Injectable()
export class CustomFieldValueService {
    private logger: Logger;

    constructor(
        @InjectRepository(CustomFieldValueEntity) protected readonly repo: Repository<CustomFieldValueEntity>,
        @InjectRepository(CustomFieldDefinitionEntity) protected readonly repoDef: Repository<CustomFieldDefinitionEntity>
    ) {
        this.logger = new Logger(this.constructor.name);
        contructorLogger(this);
    }

    async get(id: number): Promise<CustomFieldValueEntity> {
        const customFieldValueDB = await this.repo.findOne({where: {id}});
        if (!customFieldValueDB) {
            throw new NotFoundException(`Custom field value doesn't exists ${id}`);
        }
        return customFieldValueDB;
    }

    @Transactional()
    async create(dto: CreateCustomFieldValueDto): Promise<InsertResult> {
        try {
            const customFieldDB = await this.repoDef.findOne({where: {id: dto.customFieldDefinitionId}});
            validateCustomFieldValue(customFieldDB.type, dto.value);

            return await this.repo.insert({
                value: dto.value,
                index: dto.index,
                Task: dto.taskId ? {id: dto.taskId} : null,
                Folder: dto.folderId ? {id: dto.folderId} : null,
                CustomFieldDefinition: {id: dto.customFieldDefinitionId},
            });
        } catch (e) {
            this.logger.error(`There was an error creating a custom field value ${dto}`, e);
            throw e;
        }
    }

    @Transactional()
    async update(id: number, dto: UpdateCustomFieldValueDto): Promise<UpdateResult> {
        const customFieldValueDB = await this.repo.findOne({where: {id}, relations: {CustomFieldDefinition: true}});
        if (!customFieldValueDB) {
            throw new NotFoundException(`Custom field value does't exists ${id}`);
        }
        validateCustomFieldValue(customFieldValueDB.CustomFieldDefinition.type, dto.value);

        return await this.repo.update(id, dto);
    }

    @Transactional()
    async delete(id: number): Promise<CustomFieldValueEntity> {
        const customFieldValueDB = await this.repo.findOne({where: {id}});
        if (!customFieldValueDB) {
            throw new NotFoundException(`Custom field value does't exists ${id}`);
        }
        return await this.repo.remove(customFieldValueDB);
    }
}
