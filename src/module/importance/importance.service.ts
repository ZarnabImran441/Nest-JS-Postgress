import {HttpException, HttpStatus, Injectable, NotFoundException} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {DeleteResult, InsertResult, Repository, UpdateResult} from 'typeorm';
import {ImportanceBaseService} from './importance-base.service';
import {ImportanceEntity} from '../../model/importance.entity';
import {CreateImportanceDto} from '../../dto/importance/create-importance.dto';
import {UpdateImportanceDto} from '../../dto/importance/update-importance.dto';
import {contructorLogger, JwtUserInterface} from '@lib/base-library';
import {UpdateImportancePositionDto} from '../../dto/importance/update-importance-position.dto';

/**
 * Service class for managing Importance entities.
 */
@Injectable()
export class ImportanceService extends ImportanceBaseService {
    /**
     * Create a new instance of the class.
     *
     * @param {Repository<ImportanceEntity>} repo - The injected repository for ImportanceEntity.
     */
    constructor(@InjectRepository(ImportanceEntity) protected readonly repo: Repository<ImportanceEntity>) {
        super(repo);
        contructorLogger(this);
    }

    /**
     * Retrieves all Importance entities.
     * @returns {Promise<ImportanceEntity[]>} - A promise that resolves to an array of Importance entities.
     * @throws {Error} - If there is an error getting Importance entities.
     */
    async getAll(): Promise<ImportanceEntity[]> {
        //** Check If the user has permissions or not */
        try {
            return await super.getAll();
        } catch (e) {
            this.logger.error(`There was an error getting Importance`);
            throw e;
        }
    }

    /**
     * Creates a new importance record based on the provided DTO and user.
     *
     * @param {CreateImportanceDto} dto - The DTO containing the data for creating the importance record.
     * @param {JwtUserInterface} user - The user performing the operation.
     *
     * @return {Promise<InsertResult>} - A promise that resolves to the result of the create operation.
     *
     * @throws {Error} - If there was an error while creating the importance record.
     */
    async createOne(dto: CreateImportanceDto, user: JwtUserInterface): Promise<InsertResult> {
        //** Check If the user has permissions or not */
        try {
            return await super.createOne(dto, user);
        } catch (e) {
            this.logger.error(`There was an error while creating Importance`);
            throw e;
        }
    }

    /**
     * Updates the importance of a task.
     *
     * @param {number} id - The ID of the task importance to update.
     * @param {UpdateImportanceDto} dto - The new data to update the task importance with.
     * @param {JwtUserInterface} user - The user making the update request.
     *
     * @returns {Promise<UpdateResult>} - A promise that resolves to the result of the update operation.
     *
     * @throws {NotFoundException} - If the task importance with the specified ID is not found.
     * @throws {Error} - If there was an error while updating the task importance.
     */
    async updateOne(id: number, dto: UpdateImportanceDto, user: JwtUserInterface): Promise<UpdateResult> {
        //** Check If the user has permissions or not */
        try {
            const importanceDB = await this.repo.findOne({where: {id}});
            if (!importanceDB) {
                throw new NotFoundException(`Task Importance with id : ${id} not found`);
            }
            return await super.updateOne(id, dto, user);
        } catch (e) {
            this.logger.error(`There was an error while updating Importance with id ${id}`);
            throw e;
        }
    }

    /**
     * Deletes a task importance from the database.
     *
     * @param {number} id - The ID of the task importance to delete.
     * @returns {Promise<DeleteResult>} A promise that resolves to the delete result.
     * @throws {NotFoundException} If the task importance with the specified ID is not found.
     * @throws {Error} If there was an error while deleting the task importance.
     */
    async deleteOne(id: number): Promise<DeleteResult> {
        //** Check If the user has permissions or not */
        try {
            const importanceDB = await this.repo.findOne({where: {id}, relations: {Tasks: true}});

            if (importanceDB?.Tasks?.length) {
                throw new HttpException(
                    `The importance setting with ID : ${id} is currently assigned to one or more tasks and cannot be deleted.`,
                    HttpStatus.BAD_REQUEST
                );
            }

            if (!importanceDB) {
                throw new NotFoundException(`Task Importance with id : ${id} not found`);
            }
            return await super.deleteOne(id);
        } catch (e) {
            this.logger.error(`There was an error while deleting a Importance with id ${id}`);
            throw e;
        }
    }

    /**
     * Updates the position of a task importance.
     *
     * @param {number} id - The ID of the task importance.
     * @param {UpdateImportancePositionDto} dto - The data transfer object containing the updated position.
     * @returns {Promise<ImportanceEntity[]>} - A promise that resolves to an array of updated task importance entities.
     * @throws {NotFoundException} - If the task importance with the given ID is not found.
     * @throws {Error} - If there was an error while updating the task importance position.
     */
    async updatePosition(id: number, dto: UpdateImportancePositionDto): Promise<ImportanceEntity[]> {
        //** Check If the user has permissions or not */
        try {
            const importanceDB = await this.repo.findOne({where: {id}});
            if (!importanceDB) {
                throw new NotFoundException(`Task Importance with id : ${id} not found`);
            }
            return await super.updateImportancePosition(dto);
        } catch (e) {
            this.logger.error(`There was an error while deleting a Importance with id ${id}`);
            throw e;
        }
    }
}
