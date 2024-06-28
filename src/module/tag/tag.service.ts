import {Injectable, Logger, NotFoundException} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {DeleteResult, IsNull, Repository, UpdateResult} from 'typeorm';
import {contructorLogger} from '@lib/base-library';
import {Transactional} from 'typeorm-transactional';
import {TagEntity} from '../../model/tag.entity';
import {TagTaskFolderEntity} from '../../model/tag-task-folder.entity';
import {CreateTagDto} from '../../dto/tag/create-tag.dto';
import {TagTypeOptions} from '../../enum/tag.enum';
import {UpdateTagDto} from '../../dto/tag/update-tag.dto';
import {TagResponseDto} from '../../dto/tag/tag-response.dto';

@Injectable()
export class TagService {
    protected logger: Logger;

    constructor(@InjectRepository(TagEntity) protected readonly repo: Repository<TagEntity>) {
        this.logger = new Logger(this.constructor.name);
        contructorLogger(this);
    }

    @Transactional()
    async delete(id: number, userId: string = null): Promise<DeleteResult> {
        try {
            const tag = await this.repo.findOne({where: {id: id, userId}}),
                tagTaskFolderRepo = this.repo.manager.getRepository<TagTaskFolderEntity>(TagTaskFolderEntity);
            if (!tag) throw new NotFoundException(`Tag ${id} not Found`);
            const tagFolder = await tagTaskFolderRepo.findBy({Tag: {id}});
            await tagTaskFolderRepo.remove(tagFolder);
            return await this.repo.delete(id);
            // This line was commented.? why.?
            // await this.deleteTagPermissions(tag);
        } catch (e) {
            this.logger.error(`There was an error while deleting a Tag  ${JSON.stringify(id)}`, e);
            throw e;
        }
    }

    @Transactional()
    async create(dto: CreateTagDto, userId: string, common = false): Promise<TagResponseDto> {
        // This part was commented in tags app service

        // const entityType = dto.type == TagTypeOptions.USER_TAG ? EntityTypeOptions.UserTag : EntityTypeOptions.CommonTag;
        // if (!user) throw new NotFoundException(`Invalid User: user is null`); //TODO: note: Somebody must own the commontag otherwise it cannot be updated
        return await this.repo.save({
            title: dto.title,
            color: dto.color,
            userId: common ? null : userId,
            type: dto.type ? dto.type : TagTypeOptions.COMMON_TAG,
            createdAt: new Date(),
            createdBy: userId,
        });
    }

    @Transactional()
    async update(id: number, dto: UpdateTagDto, userId: string, common = false): Promise<UpdateResult> {
        try {
            const tagDB = this.repo.findOne({
                where: {id: id, userId: common ? IsNull() : userId},
            });
            if (!tagDB) {
                throw new NotFoundException(`Tag ${id} not Found`);
            }
            return await this.repo.update(id, {...dto, updatedBy: userId, updatedAt: new Date()});
        } catch (e) {
            this.logger.error(`There was an error while updating a common Tag with id : ${id} body :${JSON.stringify(dto)}`, e);
            throw e;
        }
    }

    async getMany(userId: string = null): Promise<TagResponseDto[]> {
        const whereCondition = userId || IsNull();
        return await this.repo.find({where: {userId: whereCondition}});
    }

    async getOne(id: number, userId: string = null): Promise<TagResponseDto> {
        const whereCondition = userId || IsNull();
        return await this.repo.findOne({where: {id, userId: whereCondition}});
    }
}
