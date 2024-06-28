import {BadRequestException, Injectable, Logger} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {DeleteResult, InsertResult, Repository, UpdateResult} from 'typeorm';
import {Transactional} from 'typeorm-transactional';
import {ImportanceEntity} from '../../model/importance.entity';
import {CreateImportanceDto} from '../../dto/importance/create-importance.dto';
import {UpdateImportanceDto} from '../../dto/importance/update-importance.dto';
import {contructorLogger, JwtUserInterface} from '@lib/base-library';
import {UpdateImportancePositionDto} from '../../dto/importance/update-importance-position.dto';

/**
 * Service class for managing ImportanceEntity objects.
 */
@Injectable()
export class ImportanceBaseService {
    protected logger: Logger;

    /**
     * Creates an instance of the constructor.
     *
     * @param {Repository<ImportanceEntity>} repo - The repository used for handling ImportanceEntity data.
     *
     * @returns {void}
     */
    constructor(@InjectRepository(ImportanceEntity) protected readonly repo: Repository<ImportanceEntity>) {
        this.logger = new Logger(this.constructor.name);
        contructorLogger(this);
    }

    /**
     * Retrieves all ImportanceEntities from the repository.
     *
     * @returns {Promise<ImportanceEntity[]>} A promise that resolves to an array of ImportanceEntity objects.
     */
    async getAll(): Promise<ImportanceEntity[]> {
        return await this.repo.find({order: {index: 'ASC'}});
    }

    /**
     * Creates a new importance entry in the database.
     *
     * @method createOne
     * @param {CreateImportanceDto} dto - The data transfer object containing the importance details.
     * @param {JwtUserInterface} user - The user performing the action.
     * @returns {Promise<InsertResult>} - A promise that resolves to an InsertResult object containing the result of the insertion.
     * @throws {BadRequestException} - Thrown if an importance with the specified properties already exists.
     * @throws {Error} - Thrown if there is an error during the insertion.
     * @transactional - Ensures that the method is executed within a transaction.
     */
    @Transactional()
    async createOne(dto: CreateImportanceDto, user: JwtUserInterface): Promise<InsertResult> {
        const defaultImportance = await this.repo.findOne({where: {default: true}});

        const indexExists = await this.repo.findOne({where: {index: dto.index}});

        if (defaultImportance && dto.default) {
            throw new BadRequestException('Importance with property default already exist');
        }

        if (indexExists) {
            throw new BadRequestException(`Importance with index ${dto.index} already exist`);
        }

        return await this.repo.insert({
            index: dto.index,
            description: dto.description,
            default: dto.default,
            icon: dto.icon,
            color: dto.color,
            createdBy: user.id,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
    }

    /**
     * Updates the importance with the given ID using the provided DTO.
     *
     * @param {number} id - The ID of the importance to update.
     * @param {UpdateImportanceDto} dto - The DTO containing the updated importance data.
     * @param {JwtUserInterface} user - The user performing the update.
     *
     * @returns {Promise<UpdateResult>} - A promise that resolves to the result of the update operation.
     *
     * @throws {BadRequestException} - If an importance with the property "default" already exists and the DTO also has the "default" property.
     *
     * @Transactional() - This method is wrapped in a transaction to ensure atomicity.
     */
    @Transactional()
    async updateOne(id: number, dto: UpdateImportanceDto, user: JwtUserInterface): Promise<UpdateResult> {
        const defaultImportance = await this.repo.findOne({where: {default: true}});

        if (defaultImportance && dto.default && defaultImportance.id !== id) {
            throw new BadRequestException('Importance with property default already exist');
        }

        return await this.repo.update(id, {...dto, updatedBy: user.id, updatedAt: new Date()});
    }

    /**
     * Deletes one record from the database.
     *
     * @param {number} id - The ID of the record to be deleted.
     * @return {Promise<DeleteResult>} A promise that resolves with the delete result.
     * @throws {Error} If an error occurs during the delete operation.
     */
    @Transactional()
    async deleteOne(id: number): Promise<DeleteResult> {
        return await this.repo.delete(id);
    }

    /**
     * Updates the position of importance based on the provided DTO.
     *
     * @param {UpdateImportancePositionDto} dto - The DTO containing the current and new indices of the importance.
     * @throws {BadRequestException} If the importance to move or replace is not found.
     * @returns {Promise<ImportanceEntity[]>} A promise that resolves with the updated importance entities.
     */
    @Transactional()
    async updateImportancePosition(dto: UpdateImportancePositionDto): Promise<ImportanceEntity[]> {
        const {currentIndex, newIndex} = dto;

        // Find the entities within the transaction
        const importanceToMove = await this.repo.findOne({where: {index: currentIndex}});
        const importanceToReplace = await this.repo.findOne({where: {index: newIndex}});

        if (!importanceToMove || !importanceToReplace) {
            throw new BadRequestException('Importance not found');
        }

        // Swap indices
        importanceToMove.index = newIndex;
        importanceToReplace.index = currentIndex;

        return await this.repo.save([importanceToMove, importanceToReplace]);
    }
}
