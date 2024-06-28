import {BadRequestException, ForbiddenException, Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {UserActionEntity} from '../../model/user-action.entity';
import {TaskEntity} from '../../model/task.entity';
import {Transactional} from 'typeorm-transactional';
import {contructorLogger} from '@lib/base-library';

@Injectable()
export class UserActionService {
    constructor(
        @InjectRepository(UserActionEntity)
        private readonly userActionRepository: Repository<UserActionEntity>,
        @InjectRepository(TaskEntity)
        private readonly taskRepository: Repository<TaskEntity>
    ) {
        contructorLogger(this);
    }

    @Transactional()
    async toggleCheck(id: number, checked: boolean, userId: string): Promise<UserActionEntity> {
        const userAction = await this.userActionRepository.findOneBy({id});

        if (!userAction) {
            throw new BadRequestException(`User action with id ${id} not found`);
        }
        if (userAction.userId !== userId) {
            throw new ForbiddenException(`User ${userId} is not allowed to check user action ${id}`);
        }
        userAction.checked = checked;
        userAction.checkedOn = checked ? new Date() : null;
        return await this.userActionRepository.save(userAction);
    }
    async findAllByTaskId(taskId: number): Promise<UserActionEntity[]> {
        return await this.userActionRepository.find({
            where: {
                Task: {
                    id: taskId,
                },
            },
        });
    }

    @Transactional()
    async create(taskId: number, description: string, userId: string): Promise<UserActionEntity> {
        if (!description || !description.trim()?.length) {
            throw new Error('Action name cannot be empty');
        }

        const userAction = new UserActionEntity();
        userAction.Task = await this.taskRepository.findOneBy({id: taskId});
        userAction.description = description;
        userAction.checked = false;
        userAction.userId = userId;
        userAction.checkedOn = null;

        const insertResult = await this.userActionRepository.insert(userAction);
        return {...userAction, id: insertResult.identifiers[0].id};
    }
    @Transactional()
    async update(id: number, description: string): Promise<UserActionEntity> {
        const userAction = await this.userActionRepository.findOneByOrFail({id});

        await this.userActionRepository.update({id: userAction.id}, {description: userAction.description});
        return {...userAction, description};
    }
    @Transactional()
    async delete(id: number): Promise<void> {
        await this.userActionRepository.delete(id);
    }
}
