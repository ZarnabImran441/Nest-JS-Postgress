import {ForbiddenException, Inject, Injectable, Logger} from '@nestjs/common';
import {
    ABSTRACT_AUTHORIZATION_SERVICE,
    AutomationsApplicationIdOptions,
    ConsumeEndpoint,
    contructorLogger,
    JwtUser,
    JwtUserInterface,
} from '@lib/base-library';
import {
    AutomationAvailableOptionssDto,
    AutomationDto,
    AutomationLogQueryDto,
    AUTOMATIONS_APPLICATION_ID_PARAMETER,
    AUTOMATIONS_AUTOMATION_ID_PARAMETER,
    AUTOMATIONS_LOCATION_ID_PARAMETER,
    AUTOMATIONS_LOCATION_TYPE_PARAMETER,
    AUTOMATIONS_PATH_AUTOMATION_CREATE,
    AUTOMATIONS_PATH_AUTOMATION_DELETE_ONE,
    AUTOMATIONS_PATH_AUTOMATION_GET_ALL,
    AUTOMATIONS_PATH_AUTOMATION_GET_AVAILABLE,
    AUTOMATIONS_PATH_AUTOMATION_GET_MANY,
    AUTOMATIONS_PATH_AUTOMATION_GET_MANY_LOGS,
    AUTOMATIONS_PATH_AUTOMATION_GET_ONE,
    AUTOMATIONS_PATH_AUTOMATION_UPDATE_ONE,
} from '@lib/automations-library';
import {AutomationsConfigInterface} from './automations-crud.module';
import {AuthorizationImplService} from '../authorization-impl/authorization-impl.service';
import {EntityTypeOptions, PermissionOptions} from '../authorization-impl/authorization.enum';
import {AutomationJobLogResultsDto} from '@lib/automations-library/dto/automation-log-results.dto';

@Injectable()
export class AutomationsCrudService {
    protected logger: Logger;
    protected urlCreate: string;
    protected urlGetAvailable: string;
    protected urlGetMany: string;
    protected urlGetAll: string;
    protected urlGetOne: string;
    protected urlUpdateOne: string;
    protected urlDeleteOne: string;
    protected urlGetManyLogs: string;

    constructor(
        @Inject('AUTOMATIONS-CONFIG') private readonly options: AutomationsConfigInterface,
        @Inject(ABSTRACT_AUTHORIZATION_SERVICE) protected readonly authorization: AuthorizationImplService
    ) {
        this.urlCreate = options.serviceUrl + AUTOMATIONS_PATH_AUTOMATION_CREATE;
        this.urlGetAvailable = options.serviceUrl + AUTOMATIONS_PATH_AUTOMATION_GET_AVAILABLE;
        this.urlGetMany = options.serviceUrl + AUTOMATIONS_PATH_AUTOMATION_GET_MANY;
        this.urlGetAll = options.serviceUrl + AUTOMATIONS_PATH_AUTOMATION_GET_ALL;
        this.urlGetOne = options.serviceUrl + AUTOMATIONS_PATH_AUTOMATION_GET_ONE;
        this.urlUpdateOne = options.serviceUrl + AUTOMATIONS_PATH_AUTOMATION_UPDATE_ONE;
        this.urlDeleteOne = options.serviceUrl + AUTOMATIONS_PATH_AUTOMATION_DELETE_ONE;
        this.urlGetManyLogs = options.serviceUrl + AUTOMATIONS_PATH_AUTOMATION_GET_MANY_LOGS;
        this.logger = new Logger(this.constructor.name);
        contructorLogger(this);
    }

    async getAvailable(@JwtUser() user: JwtUserInterface): Promise<AutomationAvailableOptionssDto> {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const __ = user; // TODO: Do we need user?
        let endpointUrl = this.urlGetAvailable;
        endpointUrl = endpointUrl.replace(AUTOMATIONS_APPLICATION_ID_PARAMETER, AutomationsApplicationIdOptions.TASK_MANAGEMENT);
        const response = await ConsumeEndpoint.get<AutomationAvailableOptionssDto>('token', endpointUrl);
        return response;
    }

    async getOne(automationId: number, @JwtUser() user: JwtUserInterface): Promise<AutomationDto> {
        let endpointUrl = this.urlGetOne;
        endpointUrl = endpointUrl.replace(AUTOMATIONS_APPLICATION_ID_PARAMETER, AutomationsApplicationIdOptions.TASK_MANAGEMENT);
        endpointUrl = endpointUrl.replace(AUTOMATIONS_AUTOMATION_ID_PARAMETER, automationId.toString());
        const response = await ConsumeEndpoint.get<AutomationDto>('token', endpointUrl);
        // Permissions
        {
            const allowedIds = await this.authorization.getRecursiveIdsForUser(
                user.id,
                EntityTypeOptions.Folder,
                PermissionOptions.OWNER_FULL
            );
            const allowed = allowedIds.some(
                (allowedNode) =>
                    EntityTypeOptions.Folder == response.locationType && response.locationId.includes(allowedNode.id.toString())
            );
            if (!allowed) {
                throw new ForbiddenException('You are not allowed to perform this action');
            }
        }
        return response;
    }

    async getMany(folderId: number, @JwtUser() user: JwtUserInterface): Promise<unknown> {
        let endpointUrl = this.urlGetMany;
        endpointUrl = endpointUrl.replace(AUTOMATIONS_APPLICATION_ID_PARAMETER, AutomationsApplicationIdOptions.TASK_MANAGEMENT);
        endpointUrl = endpointUrl.replace(AUTOMATIONS_LOCATION_TYPE_PARAMETER, this.options.entityType);
        endpointUrl = endpointUrl.replace(AUTOMATIONS_LOCATION_ID_PARAMETER, folderId.toString());
        let response = await ConsumeEndpoint.get<AutomationDto[]>('token', endpointUrl);
        // Permissions
        {
            const allowedIds = await this.authorization.getRecursiveIdsForUser(
                user.id,
                EntityTypeOptions.Folder,
                PermissionOptions.OWNER_FULL
            );
            response = response.filter((node) =>
                allowedIds.some(
                    (allowedNode) => EntityTypeOptions.Folder == node.locationType && node.locationId.includes(allowedNode.id.toString())
                )
            );
        }
        return response;
    }

    async getAll(@JwtUser() user: JwtUserInterface): Promise<unknown> {
        let endpointUrl = this.urlGetAll;
        endpointUrl = endpointUrl.replace(AUTOMATIONS_APPLICATION_ID_PARAMETER, AutomationsApplicationIdOptions.TASK_MANAGEMENT);
        let response = await ConsumeEndpoint.get<AutomationDto[]>('token', endpointUrl);
        // Permissions
        {
            const allowedIds = await this.authorization.getRecursiveIdsForUser(
                user.id,
                EntityTypeOptions.Folder,
                PermissionOptions.OWNER_FULL
            );
            response = response.filter((node) =>
                allowedIds.some(
                    (allowedNode) => EntityTypeOptions.Folder == node.locationType && node.locationId.includes(allowedNode.id.toString())
                )
            );
        }
        return response;
    }

    async getManyLogs(@JwtUser() user: JwtUserInterface, whereConditions?: AutomationLogQueryDto): Promise<AutomationJobLogResultsDto> {
        let endpointUrl = this.urlGetManyLogs;
        endpointUrl = endpointUrl.replace(AUTOMATIONS_APPLICATION_ID_PARAMETER, AutomationsApplicationIdOptions.TASK_MANAGEMENT);
        // Permissions
        {
            const allowedIds = await this.authorization.getRecursiveIdsForUser(
                user.id,
                EntityTypeOptions.Folder,
                PermissionOptions.OWNER_FULL
            );
            whereConditions.allowedLocationId = allowedIds.map((value) => value.id.toString());
        }
        const response = await ConsumeEndpoint.post<AutomationLogQueryDto, AutomationJobLogResultsDto>(
            'token',
            endpointUrl,
            whereConditions
        );
        return response;
    }

    async canCreateUpdateDelete(dto: AutomationDto, @JwtUser() user: JwtUserInterface): Promise<boolean> {
        const allowedIds = await this.authorization.getRecursiveIdsForUser(user.id, EntityTypeOptions.Folder, PermissionOptions.OWNER_FULL);
        const allowed = allowedIds.some(
            (allowedNode) => EntityTypeOptions.Folder == dto.locationType && dto.locationId.includes(allowedNode.id.toString())
        );
        if (!allowed) {
            throw new ForbiddenException('You are not allowed to perform this action');
        }
        return allowed;
    }

    async createOne(dto: AutomationDto, @JwtUser() user: JwtUserInterface): Promise<AutomationDto> {
        // Permissions
        {
            const can = await this.canCreateUpdateDelete(dto, user);
            if (!can) {
                throw new ForbiddenException('You are not allowed to perform this action');
            }
        }
        dto.creatorUserId = user.id;
        dto.creationDate = new Date();
        const endpointUrl = this.urlCreate;
        const response = await ConsumeEndpoint.post<AutomationDto, AutomationDto>('token', endpointUrl, dto);
        return response;
    }

    async updateOne(automationId: number, dto: AutomationDto, @JwtUser() user: JwtUserInterface): Promise<AutomationDto> {
        // Permissions
        {
            const autoInDB = (await this.getOne(automationId, user)) as AutomationDto;
            const can = await this.canCreateUpdateDelete(autoInDB, user);
            if (!can) {
                throw new ForbiddenException('You are not allowed to perform this action');
            }
        }
        delete dto.locationType;
        delete dto.locationId;
        let endpointUrl = this.urlUpdateOne;
        endpointUrl = endpointUrl.replace(AUTOMATIONS_APPLICATION_ID_PARAMETER, AutomationsApplicationIdOptions.TASK_MANAGEMENT);
        endpointUrl = endpointUrl.replace(AUTOMATIONS_AUTOMATION_ID_PARAMETER, automationId.toString());
        const response = await ConsumeEndpoint.patch<AutomationDto, AutomationDto>('token', endpointUrl, dto);
        return response;
    }

    async deleteOne(automationId: number, @JwtUser() user: JwtUserInterface): Promise<unknown> {
        // Permissions
        {
            const dto = (await this.getOne(automationId, user)) as AutomationDto;
            const can = await this.canCreateUpdateDelete(dto, user);
            if (!can) {
                throw new ForbiddenException('You are not allowed to perform this action');
            }
        }
        let endpointUrl = this.urlDeleteOne;
        endpointUrl = endpointUrl.replace(AUTOMATIONS_APPLICATION_ID_PARAMETER, AutomationsApplicationIdOptions.TASK_MANAGEMENT);
        endpointUrl = endpointUrl.replace(AUTOMATIONS_AUTOMATION_ID_PARAMETER, automationId.toString());
        const response = await ConsumeEndpoint.delete('token', endpointUrl);
        return response;
    }
}
