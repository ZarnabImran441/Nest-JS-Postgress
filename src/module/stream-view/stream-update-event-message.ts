import {IsDate, IsEnum, IsIn, IsNotEmpty, IsNumber} from 'class-validator';
import {FolderActionOptions} from '../../enum/folder-action.enum';
import {TaskActionOptions} from '../../enum/task-action.enum';

//TODO update in monorepo
export class StreamUpdateEventMessage {
    @IsDate()
    date: Date;

    @IsNotEmpty()
    @IsEnum(FolderActionOptions || TaskActionOptions)
    action: FolderActionOptions | TaskActionOptions;

    @IsNotEmpty()
    // user: UserEntity;
    user: string;

    @IsIn(['folder', 'task'])
    @IsNotEmpty()
    entityType: string;

    @IsNumber()
    @IsNotEmpty()
    entityId: number;

    constructor(
        date: Date,
        action: FolderActionOptions | TaskActionOptions,
        user: /*UserEntity*/ string,
        entityType: string,
        entityId: number
    ) {
        this.date = date;
        this.action = action;
        this.user = user;
        this.entityType = entityType;
        this.entityId = entityId;
    }
}
