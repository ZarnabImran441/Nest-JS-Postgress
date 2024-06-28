import {BadRequestException, Injectable, Logger, NotFoundException} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {DeleteResult, In, Repository, UpdateResult} from 'typeorm';
import {contructorLogger, makeid} from '@lib/base-library';
import {Transactional} from 'typeorm-transactional';
import {WorkFlowEntity} from '../../model/workflow.entity';
import {WorkFlowStateEntity} from '../../model/workflow-state.entity';
import {CreateWorkFlowDto} from '../../dto/workflow/create-workflow.dto';
import {UpdateWorkflowDto} from '../../dto/workflow/update-workflow.dto';
import {TaskRelationEntity} from '../../model/task-relation.entity';
import {WorkFlowResponseDto} from '../../dto/workflow/workflow-response.dto';
import {FolderEntity} from '../../model/folder.entity';
import {WorkFlowTransitionEntity} from '../../model/workflow-transition.entity';
import {WorkFlowConstraintEntity} from '../../model/workflow-constraint.entity';

@Injectable()
export class WorkFlowService {
    protected logger: Logger;
    private readonly basicQuery: string;

    constructor(@InjectRepository(WorkFlowEntity) protected readonly repo: Repository<WorkFlowEntity>) {
        this.logger = new Logger(this.constructor.name);
        contructorLogger(this);
        this.basicQuery = `SELECT W.ID,
                                  W.COLOR,
                                  W.DESCRIPTION,
                                  W.TITLE,
                                  W.ACTIVE,
                                  W.USER_ID as "userId",
                                  W.created_at as "createdAt",
                                  W.updated_at as "updatedAt",
                                  W.created_by as "createdBy",
                                  W.updated_by as "updatedBy",
                                  (SELECT JSON_AGG(X)
                                   FROM (SELECT WS.ID,
                                                WS.TITLE,
                                                WS.COLOR,
                                                WS.CODE,
                                                WS.COMPLETED,
                                                WS.INDEX,
                                                WS.DISPLACEMENT_CODE_ID AS "displacementCodeId",
                                                WS.SYSTEM_STAGE_ID AS "systemStageId",
                                COALESCE(
                                        (SELECT JSON_AGG(WSC.CODE)
                                         FROM WORKFLOW_TRANSITION WT
                                         INNER JOIN WORKFLOW_STATE WSC ON WT.TO_STATE_ID = WSC.ID
                                         WHERE WS.ID = WT.FROM_STATE_ID),JSON_ARRAY()) AS "swimlaneConstraint",
                                COALESCE(
                                (SELECT ARRAY(SELECT DISTINCT UNNEST(WC.USER_IDS) AS USER_ID
                                        FROM WORKFLOW_CONSTRAINT WC
                                        INNER JOIN WORKFLOW_TRANSITION WT ON WT.TO_STATE_ID = WS.ID
                                        WHERE WT.ID = WC.workflow_transition_id)), ARRAY[]::CHARACTER VARYING ARRAY) AS "userConstraint"
                                         FROM WORKFLOW_STATE WS
                                         WHERE WS.WORKFLOW_ID = W.ID
                                         GROUP BY WS.ID
                                         ORDER BY WS.INDEX) AS X) AS STATES
                           FROM WORKFLOW W `;
    }

    @Transactional()
    async deleteWorkFlow(workflowId: number): Promise<DeleteResult> {
        //** Check If the user have permissions or not */
        try {
            const repoFolder = this.repo.manager.getRepository<FolderEntity>(FolderEntity),
                folderWorkflowDB = await repoFolder.findOne({where: {WorkFlow: {id: workflowId}}}),
                workflowDB = await this.repo.findOne({where: {id: workflowId}, relations: {WorkFlowStates: true}}),
                repoWorkflowState = this.repo.manager.getRepository<WorkFlowStateEntity>(WorkFlowStateEntity),
                repoWorkflowTransition = this.repo.manager.getRepository<WorkFlowTransitionEntity>(WorkFlowTransitionEntity);
            if (folderWorkflowDB) {
                throw new BadRequestException('Cannot delete a workflow. It is assigned to a folder.');
            }
            if (!workflowDB) {
                throw new NotFoundException(`Workflow ${workflowId} not found`);
            }
            for (const state of workflowDB.WorkFlowStates) {
                await repoWorkflowTransition.delete({fromStateId: state.id});
            }
            await repoWorkflowState.delete({WorkFlow: {id: workflowDB.id}});
            return await this.repo.delete({id: workflowDB.id});
        } catch (error) {
            this.logger.error(`There was an error deleting workflow ${workflowId}`, error);
            throw error;
        }
    }

    @Transactional()
    async createWorkflowState(dto: CreateWorkFlowDto, userId: string, isCommon?: boolean): Promise<WorkFlowEntity> {
        try {
            const repoWorkflowState = this.repo.manager.getRepository<WorkFlowStateEntity>(WorkFlowStateEntity),
                repoWorkflowTransition = this.repo.manager.getRepository<WorkFlowTransitionEntity>(WorkFlowTransitionEntity),
                repoWorkflowConstraint = this.repo.manager.getRepository<WorkFlowConstraintEntity>(WorkFlowConstraintEntity);

            const insertResult = await this.repo.insert({
                    title: dto.title,
                    description: dto.description,
                    color: dto.color,
                    userId: isCommon ? null : userId,
                    createdBy: userId,
                    createdAt: new Date(),
                }),
                workflowDB: Partial<WorkFlowEntity> = {
                    id: insertResult.identifiers[0].id,
                    title: dto.title,
                    description: dto.description,
                    color: dto.color,
                    userId: isCommon ? null : userId,
                    createdBy: userId,
                    createdAt: new Date(),
                };

            let newIndex = 0;
            const savedStates = [];
            for (const column of dto.states) {
                const codeGenerated = makeid(8);
                const insertState = await repoWorkflowState.insert({
                        title: column.title,
                        color: column.color,
                        index: newIndex,
                        WorkFlow: {id: workflowDB.id},
                        completed: column.completed,
                        code: codeGenerated,
                        displacementCodeId: column.displacementCodeId || null,
                        systemStageId: column.systemStageId,
                    }),
                    stateDB: Partial<WorkFlowStateEntity> = {
                        id: insertState.identifiers[0].id,
                        code: column.code,
                    };

                newIndex++;
                savedStates.push({
                    ...stateDB,
                    swimlaneConstraint: column.swimlaneConstraint,
                    userConstraint: column.userConstraint,
                });
            }

            for (const state of savedStates) {
                if (state.swimlaneConstraint && state.swimlaneConstraint?.length) {
                    for (const constraint of state.swimlaneConstraint) {
                        const swimlane = savedStates.find((s) => s.code === constraint);
                        const inserted = await repoWorkflowTransition.insert({fromStateId: state.id, toStateId: swimlane.id});
                        if (swimlane.userConstraint && swimlane.userConstraint.length) {
                            await repoWorkflowConstraint.insert({
                                workflowTransitionId: inserted.identifiers[0].id,
                                userIds: swimlane.userConstraint,
                            });
                        }
                    }
                } else {
                    for (const constraint of savedStates.filter((s) => s.id !== state.id)) {
                        const inserted = await repoWorkflowTransition.insert({fromStateId: state.id, toStateId: constraint.id});
                        if (constraint.userConstraint && constraint.userConstraint.length) {
                            await repoWorkflowConstraint.insert({
                                workflowTransitionId: inserted.identifiers[0].id,
                                userIds: constraint.userConstraint,
                            });
                        }
                    }
                }
            }

            return workflowDB as WorkFlowEntity;
        } catch (error) {
            this.logger.error(`There was an error while creating a workflow ${JSON.stringify(dto)}`, error);
            throw error;
        }
    }

    @Transactional()
    async updateWorkflowState(workflowId: number, dto: UpdateWorkflowDto, userId: string): Promise<UpdateResult> {
        try {
            const repoWorkflowState = this.repo.manager.getRepository<WorkFlowStateEntity>(WorkFlowStateEntity),
                repoTaskRelation = this.repo.manager.getRepository<TaskRelationEntity>(TaskRelationEntity),
                repoWorkflowTransition = this.repo.manager.getRepository<WorkFlowTransitionEntity>(WorkFlowTransitionEntity),
                repoWorkflowConstraint = this.repo.manager.getRepository<WorkFlowConstraintEntity>(WorkFlowConstraintEntity),
                workflowFound = await this.repo.findOne({
                    select: {id: true, WorkFlowStates: true},
                    where: {id: workflowId},
                    relations: {WorkFlowStates: {FromTransition: true}},
                });
            if (!workflowFound) {
                throw new NotFoundException(`Workflow ${workflowId} not found`);
            }

            const newData = {...dto};
            delete newData['states'];
            delete newData['Mapping'];
            const updatedWorkflowResult = await this.repo.update(workflowId, {...newData, updatedAt: new Date(), updatedBy: userId});
            // update workflow states
            if (dto.states) {
                // delete swimlane constraints
                for (const state of workflowFound.WorkFlowStates) {
                    for (const fromTransition of state.FromTransition) {
                        await repoWorkflowConstraint.delete({workflowTransitionId: fromTransition.id});
                    }
                    await repoWorkflowTransition.delete({fromStateId: state.id});
                }
                // add new states
                let newIndex = 0;
                const savedStates = [];
                for (const column of dto.states) {
                    const codeGenerated = makeid(8);
                    //** in state we should only have one either system stage or custom stage */
                    const insertState = await repoWorkflowState.insert({
                            title: column.title,
                            color: column.color,
                            index: newIndex,
                            WorkFlow: {id: workflowId},
                            completed: column.completed,
                            code: codeGenerated,
                            displacementCodeId: column.displacementCodeId || null,
                            systemStageId: column.systemStageId || null,
                        }),
                        stateDB: Partial<WorkFlowStateEntity> = {
                            id: insertState.identifiers[0].id,
                            code: column.code,
                        };
                    newIndex++;
                    savedStates.push({...stateDB, swimlaneConstraint: column.swimlaneConstraint, userConstraint: column.userConstraint});
                }
                for (const state of savedStates) {
                    if (state.swimlaneConstraint && state.swimlaneConstraint.length) {
                        for (const constraint of state.swimlaneConstraint) {
                            const swimlane = savedStates.find((s) => s.code === constraint);
                            const inserted = await repoWorkflowTransition.insert({fromStateId: state.id, toStateId: swimlane.id});
                            if (swimlane.userConstraint && swimlane.userConstraint.length) {
                                await repoWorkflowConstraint.insert({
                                    workflowTransitionId: inserted.identifiers[0].id,
                                    userIds: swimlane.userConstraint,
                                });
                            }
                        }
                    } else {
                        for (const constraint of savedStates.filter((s) => s.id !== state.id)) {
                            const inserted = await repoWorkflowTransition.insert({fromStateId: state.id, toStateId: constraint.id});
                            if (constraint.userConstraint && constraint.userConstraint.length) {
                                await repoWorkflowConstraint.insert({
                                    workflowTransitionId: inserted.identifiers[0].id,
                                    userIds: constraint.userConstraint,
                                });
                            }
                        }
                    }
                }
                // if there is a mapping, add new states, map old states to the new states, delete old states
                if (dto.Mapping) {
                    // map tasks to new states
                    for (const mapWorkflowStateDto of dto.Mapping) {
                        const destinationFolderWorkflowStateDB = savedStates.find(
                                (x) => x.code === mapWorkflowStateDto.DestinationWorkflowStateCode
                            ),
                            sourceFolderWorkflowStateDB = workflowFound.WorkFlowStates.find(
                                (x) => x.code === mapWorkflowStateDto.SourceWorkflowStateCode
                            ),
                            taskRelationFound = await repoTaskRelation.find({
                                where: {WorkFlowState: {id: sourceFolderWorkflowStateDB?.id}},
                            });
                        if (taskRelationFound?.length > 0) {
                            await repoTaskRelation.update(
                                {id: In(taskRelationFound.map((x) => x.id))},
                                {
                                    WorkFlowState: {id: destinationFolderWorkflowStateDB?.id},
                                }
                            );
                        }
                    }
                }
                for (const state of workflowFound.WorkFlowStates) {
                    await repoWorkflowState.delete({id: state.id});
                }
            }
            return updatedWorkflowResult;
        } catch (error) {
            this.logger.error(`There was an error while updating a workflow ${JSON.stringify(dto)}`, error);
            throw error;
        }
    }

    async getMany(userId: string): Promise<WorkFlowResponseDto[]> {
        const sql = this.basicQuery + `WHERE W.USER_ID IS NULL OR W.USER_ID = $1 ORDER BY W.TITLE`;
        return await this.repo.query(sql, [userId]);
    }

    async getAllCommonWorkflows(): Promise<WorkFlowResponseDto[]> {
        const sql = this.basicQuery + `WHERE W.USER_ID IS NULL ORDER BY W.TITLE`;
        return await this.repo.query(sql);
    }

    async getOne(workflowId: number, userId: string): Promise<WorkFlowResponseDto> {
        //** Check If the user have permissions or not */
        try {
            const workflowFound = await this.repo.findOne({where: {id: workflowId}});
            if (!workflowFound) {
                throw new NotFoundException(`Workflow ${workflowId} not found`);
            }
            const sql = this.basicQuery + `WHERE W.ID = $1 AND (W.USER_ID IS NULL OR W.USER_ID = $2)`;
            const ret = await this.repo.query(sql, [workflowId, userId]);
            return ret[0];
        } catch (error) {
            this.logger.error(`There was an error while Fetching a workflow`, error);
            throw error;
        }
    }

    async CreateCommonFromPersonaliseWorkflow(workflowId: number, userId: string): Promise<WorkFlowEntity> {
        const folderWorkflow = await this.repo.manager.getRepository<WorkFlowEntity>(WorkFlowEntity).findOne({
            where: {id: workflowId, userId},
            relations: {WorkFlowStates: {FromTransition: true}},
        });

        if (!folderWorkflow) {
            throw new NotFoundException(`Personal Workflow ${workflowId} not found`);
        }
        for (const column of folderWorkflow.WorkFlowStates) {
            const constraints = [];
            for (const constraint of column.FromTransition) {
                const swimlane = folderWorkflow.WorkFlowStates.find((s) => s.id === constraint.toStateId);
                swimlane && constraints.push(swimlane.code);
            }
            column['swimlaneConstraint'] = constraints;
        }
        return this.createWorkflowState(
            {
                title: folderWorkflow.title,
                description: folderWorkflow.description,
                color: folderWorkflow.color,
                active: folderWorkflow.active,
                states: folderWorkflow.WorkFlowStates,
            },
            userId,
            true
        );
    }
}
