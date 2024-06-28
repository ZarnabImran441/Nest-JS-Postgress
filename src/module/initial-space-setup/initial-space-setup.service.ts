import {Injectable, Logger} from '@nestjs/common';
import {contructorLogger, JwtUserInterface, TASK_MANAGEMENT} from '@lib/base-library';
import {FolderService} from '../folder/folder.service';
import {SpaceService} from '../space/space.service';
import {TagService} from '../tag/tag.service';
import {CustomFieldDefinitionService} from '../custom-field-definition/custom-field-definition.service';
import {WorkFlowService} from '../workflow/workflow.service';
import {UserService} from '../user/user.service';
import {UserPermissionOptions} from '../../enum/folder-user.enum';
import {CreateSpaceDto} from '../../dto/space/create-space.dto';
import {DefaultViewOptions} from '../../enum/folder.enum';
import {FolderViewOptions} from '../../enum/folder-position.enum';
import {InjectRepository} from '@nestjs/typeorm';
import {FolderRelationEntity} from '../../model/folder-relation.entity';
import {IsNull, Repository} from 'typeorm';
import {Transactional} from 'typeorm-transactional';
import {CustomFieldCollectionService} from '../custom-field-collection/custom-field-collection..service';
import {TagCollectionService} from '../tag-collection/tags-collection.service';

@Injectable()
export class InitialSpaceSetupService {
    protected logger: Logger;
    private readonly MASTER_SPACE = 'Insights';

    constructor(
        @InjectRepository(FolderRelationEntity) protected readonly repoFolderRelation: Repository<FolderRelationEntity>,
        protected readonly folderService: FolderService,
        protected readonly spaceService: SpaceService,
        protected readonly tagsService: TagService,
        protected readonly customFieldService: CustomFieldDefinitionService,
        protected readonly workflowService: WorkFlowService,
        protected readonly userService: UserService,
        protected readonly customFieldCollectionService: CustomFieldCollectionService,
        protected readonly tagsCollectionService: TagCollectionService
    ) {
        this.logger = new Logger(this.constructor.name);
        contructorLogger(this);
    }

    @Transactional()
    async addInitialSpace(user: JwtUserInterface, accessToken: string): Promise<void> {
        try {
            const members = [];
            const customFieldsDto = [];

            //Get all common tags from the database and assign it to the space
            const commonTags = await this.tagsService.getMany();

            //get all workflows from the database and assign it to the workflow
            const workflows = await this.workflowService.getAllCommonWorkflows();

            const users = await this.userService.getFilteredUsers();

            const customFieldCollections = await this.customFieldCollectionService.getAll();

            const tagCollections = await this.tagsCollectionService.getAll();

            const customFields = await this.customFieldService.getCustomField(true);

            for (const userInfo of users) {
                if (user.id !== userInfo.id) {
                    members.push({id: userInfo.id, userPermission: UserPermissionOptions.FULL});
                }
            }

            for (const [index, customField] of customFields.entries()) {
                customFieldsDto.push({
                    id: customField.id,
                    value: '',
                    index: index,
                });
            }

            const spaceDto: CreateSpaceDto = {
                title: this.MASTER_SPACE,
                defaultView: DefaultViewOptions.BOARD,
                tags: commonTags.map((t) => t.id),
                members: members,
                source: TASK_MANAGEMENT,
                showOn: [TASK_MANAGEMENT],
                customFieldCollections: customFieldCollections.map((c) => c.id),
                tagsCollections: tagCollections.map((t) => t.id),
                availableWorkflows: workflows.map((w) => w.id),
                customFieldValues: customFieldsDto,
            };

            const spaceResponse = await this.spaceService.createOneSpace(spaceDto, user.id, accessToken);

            const allRootFolders = await this.repoFolderRelation.manager
                .getRepository<FolderRelationEntity>(FolderRelationEntity)
                .find({where: {parentFolderId: IsNull(), isBind: false}, select: {childFolderId: true}});

            for (const [index, folder] of allRootFolders.entries()) {
                if (folder.childFolderId != spaceResponse.id) {
                    await this.folderService.updateFolderPosition(
                        folder.childFolderId,
                        {index: index, parentFolderNewId: spaceResponse.id, parentFolderOldId: null, view: FolderViewOptions.ROOT},
                        user
                    );
                }
            }

            return;
        } catch (error) {
            this.logger.error(`An error occurred while creating initial space`, error);
            throw error;
        }
    }
}
