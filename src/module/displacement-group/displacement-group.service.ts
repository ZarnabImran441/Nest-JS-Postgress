import {Injectable, NotFoundException} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {contructorLogger} from '@lib/base-library';
import {DeleteResult, InsertResult, Repository, UpdateResult} from 'typeorm';
import {DisplacementGroupBaseService} from './displacement-group-base.service';
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
export class DisplacementGroupService extends DisplacementGroupBaseService {
    constructor(
        @InjectRepository(DisplacementGroupEntity) protected readonly repo: Repository<DisplacementGroupEntity>,
        @InjectRepository(DisplacementCodeEntity) protected readonly repoCode: Repository<DisplacementCodeEntity>
    ) {
        super(repo, repoCode);
        contructorLogger(this);
    }

    async getAll(): Promise<DisplacementGroupResponseDto[]> {
        try {
            return await super.getAll();
        } catch (e) {
            this.logger.error(`There was an error getting Displacement group`);
            throw e;
        }
    }

    async createOne(dto: CreateDisplacementGroupDto): Promise<InsertResult> {
        try {
            return await super.createOne(dto);
        } catch (e) {
            this.logger.error(`There was an error while creating Displacement group`);
            throw e;
        }
    }

    async updateOne(id: number, dto: UpdateDisplacementGroupDto): Promise<UpdateResult> {
        const displacementGroupDB = await this.repo.findOne({where: {id}});
        if (!displacementGroupDB) {
            throw new NotFoundException(`Displacement group with id : ${id} not found`);
        }
        return await super.updateOne(id, dto);
    }

    async deleteOne(id: number): Promise<DeleteResult> {
        const displacementGroupDB = await this.repo.findOne({where: {id}});
        if (!displacementGroupDB) {
            throw new NotFoundException(`Displacement group with id : ${id} not found`);
        }
        return await super.deleteOne(id);
    }

    async getAllSystemStage(): Promise<SystemStageEntity[]> {
        return await super.getAllSystemStage();
    }

    async getOne(id: number): Promise<DisplacementGroupResponseDto> {
        const displacementGroupDB = await this.repo.findOne({where: {id}});
        if (!displacementGroupDB) {
            throw new NotFoundException(`Displacement group with id : ${id} not found`);
        }
        return await super.getOne(id);
    }

    async createOneCode(groupId: number, dto: CreateDisplacementCodeDto): Promise<InsertResult> {
        try {
            return await super.createOneCode(groupId, dto);
        } catch (e) {
            this.logger.error(`There was an error while creating Displacement code`);
            throw e;
        }
    }

    async updateOneCode(groupId: number, codeId: number, dto: UpdateDisplacementCodeDto): Promise<UpdateResult> {
        const displacementCodeDB = await this.repoCode.findOne({where: {id: codeId, displacementGroupId: groupId}});
        if (!displacementCodeDB) {
            throw new NotFoundException(`Displacement code with id : ${codeId} not found`);
        }
        return await super.updateOneCode(groupId, codeId, dto);
    }

    async deleteOneCode(groupId: number, codeId: number): Promise<DeleteResult> {
        const displacementCodeDB = await this.repoCode.findOne({where: {id: codeId, displacementGroupId: groupId}});
        if (!displacementCodeDB) {
            throw new NotFoundException(`Displacement code with id : ${codeId} not found`);
        }
        return await super.deleteOneCode(groupId, codeId);
    }

    async getOneCode(groupId: number, codeId: number): Promise<DisplacementCodeResponseDto> {
        const displacementCodeDB = await this.repoCode.findOne({where: {id: codeId, displacementGroupId: groupId}});
        if (!displacementCodeDB) {
            throw new NotFoundException(`Displacement code with id : ${codeId} not found`);
        }
        return await super.getOneCode(groupId, codeId);
    }
}
