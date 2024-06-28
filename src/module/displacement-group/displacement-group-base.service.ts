import {DeleteResult, InsertResult, Repository, UpdateResult} from 'typeorm';
import {BadRequestException, Injectable, Logger} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {contructorLogger} from '@lib/base-library';
import {Transactional} from 'typeorm-transactional';
import {DisplacementGroupEntity} from '../../model/displacement-group.entity';
import {CreateDisplacementGroupDto} from '../../dto/displacement-group/create-displacement-group.dto';
import {UpdateDisplacementGroupDto} from '../../dto/displacement-group/update-displacement-group.dto';
import {DisplacementCodeEntity} from '../../model/displacement-code.entity';
import {CreateDisplacementCodeDto} from '../../dto/displacement-group/create-displacement-code.dto';
import {UpdateDisplacementCodeDto} from '../../dto/displacement-group/update-displacement-code.dto';
import {DisplacementCodeResponseDto} from '../../dto/displacement-group/displacement-code-response.dto';
import {DisplacementGroupResponseDto} from '../../dto/displacement-group/displacement-group-response.dto';
import {SystemStageEntity} from '../../model/system-stage.entity';

@Injectable()
export class DisplacementGroupBaseService {
    protected logger: Logger;
    constructor(
        @InjectRepository(DisplacementGroupEntity) protected readonly repo: Repository<DisplacementGroupEntity>,
        @InjectRepository(DisplacementCodeEntity) protected readonly repoCode: Repository<DisplacementCodeEntity>
    ) {
        this.logger = new Logger(this.constructor.name);
        contructorLogger(this);
    }

    async getAll(): Promise<DisplacementGroupResponseDto[]> {
        return await this.repo.find({relations: {DisplacementCodes: {SystemStage: true}}, order: {createdAt: 'DESC'}});
    }

    async getOne(id: number): Promise<DisplacementGroupResponseDto> {
        return await this.repo.findOne({where: {id}, relations: {DisplacementCodes: {SystemStage: true}}});
    }

    @Transactional()
    async createOne(dto: CreateDisplacementGroupDto): Promise<InsertResult> {
        return await this.repo.insert({...dto, createdAt: new Date()});
    }

    @Transactional()
    async updateOne(id: number, dto: UpdateDisplacementGroupDto): Promise<UpdateResult> {
        return await this.repo.update(id, {...dto, updatedAt: new Date()});
    }

    @Transactional()
    async deleteOne(id: number): Promise<DeleteResult> {
        return await this.repo.delete(id);
    }

    async getOneCode(groupId: number, codeId: number): Promise<DisplacementCodeResponseDto> {
        return await this.repoCode.findOne({where: {id: codeId, displacementGroupId: groupId}, relations: {SystemStage: true}});
    }

    @Transactional()
    async createOneCode(groupId: number, dto: CreateDisplacementCodeDto): Promise<InsertResult> {
        const completedSystem = await this.repoCode.manager
            .getRepository<SystemStageEntity>(SystemStageEntity)
            .findOne({where: {code: 'Completed'}});

        //** if a state: complated already exists then it should throws erros. */
        const found = await this.repoCode.findOne({where: {systemStageId: completedSystem.id, displacementGroupId: groupId}});
        if (found && dto.systemStageId === completedSystem.id) {
            throw new BadRequestException('Completed System Stage already exists in Group');
        }

        return await this.repoCode.insert({
            ...dto,
            displacementGroupId: groupId,
            createdAt: new Date(),
            SystemStage: {id: dto.systemStageId},
        });
    }

    @Transactional()
    async updateOneCode(groupId: number, codeId: number, dto: UpdateDisplacementCodeDto): Promise<UpdateResult> {
        return await this.repoCode.update({id: codeId, displacementGroupId: groupId}, {...dto, updatedAt: new Date()});
    }

    @Transactional()
    async deleteOneCode(groupId: number, codeId: number): Promise<DeleteResult> {
        return await this.repoCode.delete({id: codeId, displacementGroupId: groupId});
    }

    async getAllSystemStage(): Promise<SystemStageEntity[]> {
        return await this.repoCode.manager.getRepository<SystemStageEntity>(SystemStageEntity).find({});
    }
}
