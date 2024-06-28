import {Injectable, InternalServerErrorException, Logger} from '@nestjs/common';
import {In, Repository} from 'typeorm';
import {contructorLogger, listToTree, modifyTree, PaginationDto} from '@lib/base-library';
import {InjectRepository} from '@nestjs/typeorm';
import {Transactional} from 'typeorm-transactional';
import * as moment from 'moment';
import {WorkFlowEntity} from '../../../model/workflow.entity';
import {FolderViewOptions} from '../../../enum/folder-position.enum';
import {FolderTaskFilterDto, SortDto} from '../../../dto/folder/filter/folder-task-filter.dto';
import {BoardResponseDto, BoardTaskResponseDto} from '../../../dto/folder/workflow/board-response.dto';
import {UserPermissionOptions} from '../../../enum/folder-user.enum';
import {GanttFolderQueryResponseDto, GanttResponseDto, GanttTaskQueryResponseDto} from '../../../dto/folder/workflow/gantt-response.dto';
import {
    ListFolderQueryResponseDto,
    ListResponseDto,
    ListTask,
    ListTaskQueryResponseDto,
} from '../../../dto/folder/workflow/list-response.dto';
import {ProjectWorkFlowResponseDto} from '../../../dto/folder/workflow/project-workFlow-response.dto';
import {TagTaskFolderTypeOptions} from '../../../enum/tag.enum';
import {CreateFolderWorkFlowDto} from '../../../dto/folder/workflow/create-folder-workflow.dto';
import {CreateFolderWorkflowResponseDto} from '../../../dto/folder/workflow/create-folder-workflow-response.dto';
import {WorkFlowStateEntity} from '../../../model/workflow-state.entity';
import {FolderTreeDto} from '../../../dto/folder/folder/folder-tree.dto';
import {RawDatabaseConfig} from '../../../config/database.config';

@Injectable()
export class FolderWorkflowBaseService {
    protected logger: Logger;

    constructor(@InjectRepository(WorkFlowEntity) protected readonly repo: Repository<WorkFlowEntity>) {
        this.logger = new Logger(this.constructor.name);
        contructorLogger(this);
    }

    async getProjectsFlowsAndTasksBoard(
        folderId: number,
        userId: string,
        _view: FolderViewOptions,
        filter: FolderTaskFilterDto,
        showArchived: boolean,
        showDeleted: boolean,
        hasPurgePermissions: boolean
    ): Promise<BoardResponseDto[]> {
        const [folderFilterStr, folderFilterParams] = this.createFolderFilter(filter, 5),
            [taskFilterStr, taskFilterParams] = this.createTaskFilter(filter, 5),
            [taskPurge, folderPurge] = this.createArchiveDeletedPurgeQuery(showArchived, showDeleted, hasPurgePermissions),
            {offset, limit} = this.createPagination(filter.pagination);

        const childrenQuery = filter.taskFilter?.children
                ? `(SELECT JSON_AGG(X)
                             FROM (SELECT TC.ID,
                                          TC.TITLE,
                                          TC.ASSIGNEES AS CHILDASSIGNEES,
                                          -- (SELECT ARRAY
                                          --            ( $ { queries . taskAssignees }
                                          --             AND CAST(ASSIGNED_PERMISSION.ENTITY_ID as integer) = TC.ID))     AS CHILDASSIGNEES,
                                          (SELECT JSON_AGG(X)
                                           FROM (SELECT TR.WORKFLOW_STATE_ID  AS "workflowStateId",
                                                        WS.WORKFLOW_ID       AS "workflowId",
                                                        F.ID                 AS "folderId"
                                                 FROM WORKFLOW_STATE WS
                                                          INNER JOIN WORKFLOW W ON W.ID = WS.WORKFLOW_ID
                                                          INNER JOIN FOLDER F ON F.WORKFLOW_ID = W.ID
                                                 WHERE W.ID = TR.FOLDER_ID
                                                   AND TR.WORKFLOW_STATE_ID = WS.ID) AS X) AS CHILDSTATES
                                   FROM TASK TC
                                            INNER JOIN TASK_RELATION TR ON TR.CHILD_TASK_ID = TC.ID
                                   WHERE T.ID = TR.PARENT_TASK_ID
                                                   AND TR.FOLDER_ID = ANY ($1)
                                   ORDER BY TR.STATE_INDEX) AS X)               AS CHILDREN, `
                : '',
            sqlFolderTree =
                `WITH RECURSIVE FOLDERS AS
            (SELECT F.ID
                                         FROM FOLDER F
                                         WHERE F.ID = $1 ${folderPurge}
                                         AND ((F.USER_ID = $2) OR EXISTS(SELECT 1
                                            FROM folder_user_ap FU
                                            WHERE FU.FOLDER_ID = F.ID
                                            AND FU.ENTITY_TYPE = 'folder'
                                            AND (FU.USER_ID = $2 AND FU.user_permission = ANY ($3)))) ` +
                folderFilterStr +
                ` UNION ALL ` +
                `SELECT F.ID
                                            FROM FOLDER F
                                            INNER JOIN FOLDER_RELATION FR
                                            ON FR.CHILD_FOLDER_ID = F.ID
                                            INNER JOIN FOLDERS TS ON FR.PARENT_FOLDER_ID = TS.ID
                                            WHERE F.ID IS NOT NULL ${folderPurge} 
                       AND ((F.USER_ID = $2)
                         OR EXISTS(SELECT 1
                                   FROM folder_user_ap FU
                                   WHERE FU.FOLDER_ID = F.ID
                                   AND FU.ENTITY_TYPE = 'folder'
                                   AND (FU.USER_ID = $2
                                    AND FU.user_permission = ANY ($3))))
                                    ${folderFilterStr}) CYCLE ID
                                    SET IS_CYCLE USING PATH
                                    SELECT F.*
                                    FROM FOLDERS F`,
            sqlTaskTree =
                `WITH RECURSIVE TASKS AS
                                        (SELECT TR.FOLDER_ID   AS "folderId",
                                                TR.STATE_INDEX AS "stateIndex",
                                                T.ID,
                                                NULL::INTEGER                                       AS "parentTaskId",
                                                0                                                   AS DEPTH,
                                                T.TITLE,
                                                T.archived_at as "archivedAt",
                                                T.start_date AS "startDate",
                                                T.end_date AS "endDate",
                                                T.COMPLETE,
                                                T.DURATION,
                                                T.USER_ID                                           AS "ownerId",
                                                T.CREATED_AT                                        AS "createdAt",
                                                T.UPDATED_AT                                        AS "updatedAt",
                                                T.IMPORTANCE_ID                                AS "importanceId",
                                                (SELECT COUNT(1)
                                                 FROM TASK_ATTACHMENT TA
                                                 WHERE T.ID = TA.TASK_ID)                           AS "attachmentCount",
                                                 ${childrenQuery}
                                                (SELECT COUNT(1)
                                                 FROM TASK_RELATION TR2
                                                  INNER JOIN TASK TC ON TR2.CHILD_TASK_ID = TC.ID AND TC.archived_at IS NULL
                                                 WHERE T.ID = TR2.PARENT_TASK_ID
                                                   AND TR.FOLDER_ID = TR2.FOLDER_ID)                AS "childrenCount",
                                                (SELECT JSON_AGG(X)
                                                 FROM (SELECT CFV.ID,
                                                    CFV.VALUE,
                                                              CFV.INDEX,
                                                              CFV.CUSTOM_FIELD_DEFINITION_ID AS "customFieldDefinitionId"
                                                       FROM CUSTOM_FIELD_VALUE CFV
                                                                INNER JOIN CUSTOM_FIELD_DEFINITION CFD ON CFV.CUSTOM_FIELD_DEFINITION_ID = CFD.ID
                                                       WHERE CFD.USER_ID IS NULL
                                                         AND CFV.TASK_ID = T.ID) AS X)              AS "customFields",

                                                (SELECT JSON_AGG(X)
                                                 FROM (SELECT CFV.ID,
                                                              CFV.VALUE,
                                                              CFV.INDEX,
                                                              CFV.CUSTOM_FIELD_DEFINITION_ID  AS "customFieldDefinitionId"
                                                       FROM CUSTOM_FIELD_VALUE CFV
                                                       INNER JOIN CUSTOM_FIELD_DEFINITION CFD ON CFV.CUSTOM_FIELD_DEFINITION_ID = CFD.ID
                                                       WHERE CFD.USER_ID = $2
                                                         AND CFV.TASK_ID = T.ID) AS X)              AS "userCustomFields",
                                            
                                                (SELECT ARRAY
                                                         (SELECT LT.tag_id
                                                            FROM TAGS_TASK_FOLDER LT
                                                                     INNER JOIN TAGS L
                                                                                ON (L.ID = LT.TAG_ID) AND (L.USER_ID IS NULL OR L.USER_ID = $2)
                                                            WHERE LT.TASK_ID = T.ID AND LT.TYPE='taskTag'))  AS TAGS,

                                                            (SELECT LT.TAG_ID as id
                                                                FROM TAGS_TASK_FOLDER LT
                                                                         INNER JOIN TAGS L
                                                                                    ON L.ID = LT.TAG_ID
                                                                WHERE LT.TASK_ID = T.ID
                                                                  AND LT.TYPE = 'prominentTag')        AS "commonProminentTagId",

                                                               
                                                                  (SELECT LT.TAG_ID as id
                                                                    FROM TAGS_TASK_FOLDER LT
                                                                             INNER JOIN TAGS L
                                                                                        ON (L.ID = LT.TAG_ID) AND (LT.USER_ID = $2)
                                                                    WHERE LT.TASK_ID = T.ID
                                                                      AND LT.TYPE = 'userProminentTag')    AS "userProminentTagId",

                                                T.ASSIGNEES,
                                                -- (SELECT ARRAY
                                                --             ($ { queries.taskAssignees }
                                                --        AND CAST(ASSIGNED_PERMISSION.ENTITY_ID as integer) = T.ID))              AS ASSIGNEES,
                                                       
                                                (SELECT JSON_AGG(X)
                                                 FROM (SELECT PRED.ID,
                                                              PRED."relationType",
                                                              PRED.TASK_SUCCESSOR_ID AS "taskId"
                                                       FROM FOLDER_TASK_PREDECESSOR PRED
                                                       WHERE PRED.TASK_PREDECESSOR_ID = T.ID) AS X) AS PREDECESSORS,
                                                (SELECT JSON_AGG(X)
                                                 FROM (SELECT PRED.ID,
                                                              PRED."relationType",
                                                              PRED.TASK_PREDECESSOR_ID AS "taskId"
                                                       FROM FOLDER_TASK_PREDECESSOR PRED
                                                       WHERE PRED.TASK_SUCCESSOR_ID = T.ID) AS X)   AS SUCCESSORS,

                                                (SELECT JSON_AGG(X)
                                                 FROM (SELECT TR.WORKFLOW_STATE_ID  AS "workflowStateId",
                                                              WS.WORKFLOW_ID      AS "workflowId",
                                                              F.ID                AS "folderId",
                                                              WS.CODE,
                                                              F.TITLE
                                                       FROM WORKFLOW_STATE WS
                                                                INNER JOIN WORKFLOW W ON W.ID = WS.WORKFLOW_ID
                                                                INNER JOIN FOLDER F ON F.WORKFLOW_ID = W.ID
                                                                WHERE WS.ID = TR.WORKFLOW_STATE_ID
                                                                AND TR.WORKFLOW_STATE_ID = WS.ID
                                                                AND TR.FOLDER_ID = F.ID) AS X)     AS STATES
                                                                FROM TASK T
                                                                INNER JOIN TASK_RELATION TR ON T.ID = TR.CHILD_TASK_ID AND
                                                                                 TR.FOLDER_ID = ANY ($1) AND
                                                                                 TR.PARENT_TASK_ID IS NULL
                                WHERE ${taskPurge} ` +
                taskFilterStr +
                ` UNION ALL ` +
                `SELECT TR.FOLDER_ID   AS "folderId",
                            TR.STATE_INDEX  AS "stateIndex",
                            T.ID,
                            TR.PARENT_TASK_ID    AS "parentTaskId",
                            TS.DEPTH + 1                                        AS DEPTH,
                            T.TITLE,
                            T.archived_at as "archivedAt",
                            T.start_date AS "startDate",
                            T.end_date AS "endDate",
                            T.COMPLETE,
                            T.DURATION,
                            T.USER_ID                                           AS "ownerId",
                            T.CREATED_AT                            AS "createdAt",
                            T.UPDATED_AT                            AS "updatedAt",
                            T.IMPORTANCE_ID                                AS "importanceId",
                            (SELECT COUNT(1)
                            FROM TASK_ATTACHMENT TA
                            WHERE T.ID = TA.TASK_ID)                           AS "attachmentCount",
                            ${childrenQuery}
                            (SELECT COUNT(1)
                            FROM TASK_RELATION TR2
                            INNER JOIN TASK TC ON TR2.CHILD_TASK_ID = TC.ID AND TC.archived_at IS NULL
                            WHERE T.ID = TR2.PARENT_TASK_ID
                            AND TR.FOLDER_ID = TR2.FOLDER_ID)                AS "childrenCount",
                            (SELECT JSON_AGG(X)
                            FROM (SELECT CFV.ID,
                                CFV.VALUE,
                                CFV.INDEX,
                                CFV.CUSTOM_FIELD_DEFINITION_ID   AS "customFieldDefinitionId"
                                FROM CUSTOM_FIELD_VALUE CFV
                                            INNER JOIN CUSTOM_FIELD_DEFINITION CFD ON CFV.CUSTOM_FIELD_DEFINITION_ID = CFD.ID
                                            WHERE CFD.USER_ID IS NULL
                                     AND CFV.TASK_ID = T.ID) AS X)              AS "customFields",
                            (SELECT JSON_AGG(X)
                             FROM (SELECT CFV.ID,
                                          CFV.VALUE,
                                          CFV.INDEX,
                                          CFV.CUSTOM_FIELD_DEFINITION_ID  AS "customFieldDefinitionId"
                                   FROM CUSTOM_FIELD_VALUE CFV
                                            INNER JOIN CUSTOM_FIELD_DEFINITION CFD ON CFV.CUSTOM_FIELD_DEFINITION_ID = CFD.ID
                                   WHERE CFD.USER_ID = $2
                                     AND CFV.TASK_ID = T.ID) AS X)              AS "userCustomFields",

                                     (SELECT ARRAY
                                        (SELECT LT.tag_id
                                           FROM TAGS_TASK_FOLDER LT
                                                    INNER JOIN TAGS L
                                                               ON (L.ID = LT.TAG_ID) AND (L.USER_ID IS NULL OR L.USER_ID = $2)
                                           WHERE LT.TASK_ID = T.ID AND LT.TYPE='taskTag'))  AS TAGS,

                                           (SELECT LT.TAG_ID as id
                                            FROM TAGS_TASK_FOLDER LT
                                                     INNER JOIN TAGS L
                                                                ON L.ID = LT.TAG_ID
                                            WHERE LT.TASK_ID = T.ID
                                              AND LT.TYPE = 'prominentTag')        AS "commonProminentTagId",
                                                                
                                              (SELECT LT.TAG_ID as id
                                                FROM TAGS_TASK_FOLDER LT
                                                         INNER JOIN TAGS L
                                                                    ON (L.ID = LT.TAG_ID) AND (LT.USER_ID = $2)
                                                WHERE LT.TASK_ID = T.ID
                                                  AND LT.TYPE = 'userProminentTag')    AS "userProminentTagId",
                                                  
                            T.ASSIGNEES,
                            -- (SELECT ARRAY
                            --            ($ { queries.taskAssignees }
                            --                           AND CAST(ASSIGNED_PERMISSION.ENTITY_ID as integer) = T.ID))              AS ASSIGNEES,

                            (SELECT JSON_AGG(X)
                             FROM (SELECT PRED.ID,
                                          PRED."relationType",
                                          PRED.TASK_SUCCESSOR_ID AS "taskId"
                                   FROM FOLDER_TASK_PREDECESSOR PRED
                                   WHERE PRED.TASK_PREDECESSOR_ID = T.ID) AS X) AS PREDECESSORS,

                            (SELECT JSON_AGG(X)
                             FROM (SELECT PRED.ID,
                                          PRED."relationType",
                                          PRED.TASK_PREDECESSOR_ID AS "taskId"
                                   FROM FOLDER_TASK_PREDECESSOR PRED
                                   WHERE PRED.TASK_SUCCESSOR_ID = T.ID) AS X)   AS SUCCESSORS,


                              

                            (SELECT JSON_AGG(X)
                             FROM (SELECT TR.WORKFLOW_STATE_ID   AS "workflowStateId",
                                          WS.WORKFLOW_ID        AS "workflowId",
                                          F.ID                  AS "folderId",
                                          F.TITLE
                                   FROM WORKFLOW_STATE WS
                                            INNER JOIN WORKFLOW W ON W.ID = WS.WORKFLOW_ID
                                             INNER JOIN FOLDER F ON F.WORKFLOW_ID = W.ID
                                   WHERE WS.ID = TR.WORKFLOW_STATE_ID
                                     AND TR.WORKFLOW_STATE_ID = WS.ID
                                     AND TR.FOLDER_ID = F.ID) AS X)     AS STATES
                     FROM TASK T
                     INNER JOIN TASK_RELATION TR
                                         ON T.ID = TR.CHILD_TASK_ID
                              INNER JOIN TASKS TS ON TR.PARENT_TASK_ID = TS.ID AND TR.FOLDER_ID = TS."folderId"
                              WHERE 
                              ${taskPurge} ${taskFilterStr} )
                              CYCLE ID
                              SET IS_CYCLE USING PATH`,
            sqlWorkFlow = `SELECT W.ID,
                            W.TITLE,
                            W.COLOR,
                            F.ID               AS "folderId",
                            F.WORKFLOW_ID      AS "workflowId",
                            (SELECT ARRAY(
                                SELECT W.id
                                FROM WORKFLOW W
                                INNER JOIN FOLDER F ON F.WORKFLOW_ID = W.ID AND F.ID = ANY ($1))) AS "workflowIds",
                            (SELECT JSON_AGG(X)
                                 FROM (SELECT WS.ID,
                                              WS.TITLE,
                                              WS.COLOR,
                                              WS.CODE,
                                              WS.DISPLACEMENT_CODE_ID AS "displacementCodeId",
                                              (SELECT ARRAY(SELECT WS.id
                                                FROM WORKFLOW_STATE WSQ
                                                JOIN WORKFLOW WQ ON WQ.ID = WSQ.WORKFLOW_ID
                                                INNER JOIN FOLDER F ON F.WORKFLOW_ID = WQ.ID
                                                WHERE WSQ.code = WS.code
                                                AND F.ID = ANY ($1))) AS "stateIds",
                                                
                                                (SELECT COUNT(X) FROM (SELECT TR.ID
                                                    FROM TASK_RELATION TR
                                                    INNER JOIN TASK T ON T.ID = TR.CHILD_TASK_ID AND T.ARCHIVED_AT IS NULL AND T.DELETED_AT IS NULL AND TR.FOLDER_ID = ANY ($1)
                                                    WHERE TR.WORKFLOW_STATE_ID = ANY(SELECT WSQ.id
                                                FROM WORKFLOW_STATE WSQ
                                                JOIN WORKFLOW WQ ON WQ.ID = WSQ.WORKFLOW_ID
                                                INNER JOIN FOLDER F ON F.WORKFLOW_ID = WQ.ID AND F.ID = ANY ($1)
                                                WHERE WSQ.code = WS.code)
                                                
                                                    AND TR.PARENT_TASK_ID IS NULL ${taskFilterStr}) AS X) AS "totalCount",
                                                COALESCE(
                                                (SELECT JSON_AGG(WSC.CODE)
                                                FROM WORKFLOW_TRANSITION WT
                                                INNER JOIN WORKFLOW_STATE WSC ON WT.TO_STATE_ID = WSC.ID
                                                WHERE WS.ID = WT.FROM_STATE_ID),JSON_ARRAY()) AS "swimlaneConstraint",
                                                COALESCE(
                                                (SELECT ARRAY(SELECT DISTINCT UNNEST(WC.USER_IDS) AS USER_ID
                                                FROM WORKFLOW_CONSTRAINT WC
                                                INNER JOIN WORKFLOW_TRANSITION WT ON WT.TO_STATE_ID = WS.ID
                                                WHERE WT.ID = WC.workflow_transition_id)), ARRAY[]::CHARACTER VARYING ARRAY ) AS "userConstraint",

                                              (SELECT COALESCE(JSON_AGG(X),'[]')
                                                FROM (${sqlTaskTree} SELECT T.*
                                                    FROM TASKS T 
                                                    INNER JOIN TASK_RELATION TR ON TR.CHILD_TASK_ID = T.ID 
                                                    AND TR.WORKFLOW_STATE_ID = WS.ID AND TR.FOLDER_ID = F.ID
                                                    ORDER BY T."folderId", T.DEPTH, T."parentTaskId", T."stateIndex" OFFSET $3 LIMIT $4) AS X) AS TASKS
                                            FROM WORKFLOW_STATE WS
                                       WHERE WS.WORKFLOW_ID = W.ID
                                       ORDER BY WS.INDEX) AS X)     AS COLUMNS
                            FROM WORKFLOW W
                            INNER JOIN FOLDER F ON F.WORKFLOW_ID = W.ID AND F.ID = ANY ($1)
                            ORDER BY F.ID`;

        const folders: FolderTreeDto[] = await this.repo.query(sqlFolderTree, [
            //folders we have
            folderId,
            userId,
            [UserPermissionOptions.FULL, UserPermissionOptions.EDITOR, UserPermissionOptions.READONLY],
            ...folderFilterParams,
        ]);

        const workflowResult = await this.repo.query(sqlWorkFlow, [folders.map((x) => x.id), userId, offset, limit, ...taskFilterParams]);

        interface WorkflowInterface {
            id: number;
            columns: {id: number; code: string; tasks: {path: {id: string}[] | string; id: number; index: number}[]}[];
        }

        const mergedWorkflow: Record<string, WorkflowInterface> = {};
        for (const workflow of workflowResult) {
            const {id, columns, folderId} = workflow;

            if (mergedWorkflow[id]) {
                for (const column of columns) {
                    const existingColumn = mergedWorkflow[id].columns.find((existingCol) => column.stateIds.includes(existingCol.id));

                    if (existingColumn) {
                        const newTasks = column.tasks.filter(
                            (task) => !existingColumn.tasks.some((existingTask) => existingTask.id === task.id)
                        );
                        existingColumn.tasks.push(...newTasks);
                    } else {
                        mergedWorkflow[id].columns.push({...column, tasks: [...column.tasks]});
                    }
                }
                mergedWorkflow[id]['folderIds'].push(folderId);
            } else {
                mergedWorkflow[id] = {...workflow, folderIds: [folderId]};
            }
        }

        const workflows = Object.values(mergedWorkflow);

        for (let workflow of workflows) {
            const taskTrees = workflow.columns
                .flatMap((column) => column.tasks)
                .map((task) => {
                    task.path = (task.path as {id: string}[]).map((obj) => `(${obj.id})`).join(',');
                    return task;
                });

            if (!filter.groupBy) {
                // when we don't have group by's
                const taskTreesMap = listToTree(
                    taskTrees as BoardTaskResponseDto[],
                    'path',
                    (x: BoardTaskResponseDto) => {
                        const ret = x.path.split(',');
                        ret.splice(-1);
                        return ret.join(',');
                    },
                    'children'
                );

                for (const column of workflow.columns) {
                    column.tasks = [];
                    column.tasks = taskTreesMap.filter((taskTree) => {
                        const taskState = taskTree?.states?.find((x) => x.code === column.code);
                        return !!taskState;
                    });
                }
            }

            if (filter.groupBy) {
                workflow = (await this.groupByTasksBoard(workflow, filter.groupBy)) as WorkflowInterface;
            }
        }

        // fix folder path
        for (const folder of folders) {
            folder.path = folder.path.replace('{', '').replace('}', '');
        }

        return workflows as unknown as BoardResponseDto[];
    }

    async getProjectsFlowsAndTasksGantt(
        folderId: number,
        userId: string,
        filter: FolderTaskFilterDto,
        showArchived: boolean,
        showDeleted: boolean,
        hasPurgePermissions: boolean
    ): Promise<GanttResponseDto> {
        const [folderFilterStr, folderFilterParams] = this.createFolderFilter(filter, 5),
            [taskFilterStr, taskFilterParams] = this.createTaskFilter(filter, 2),
            [taskPurge, folderPurge] = this.createArchiveDeletedPurgeQuery(showArchived, showDeleted, hasPurgePermissions),
            childrenQuery = filter.taskFilter.children
                ? `(SELECT JSON_AGG(X)
                             FROM (SELECT TC.ID,
                                          TC.TITLE,
                                          TC.ASSIGNEES AS CHILDASSIGNEES
                                          --(SELECT ARRAY
                                          --            ($ { queries . taskAssignees }
                                          --             AND CAST(ASSIGNED_PERMISSION.ENTITY_ID as integer) = TC.ID))                  AS CHILDASSIGNEES,
                                          (SELECT JSON_AGG(X)
                                           FROM (SELECT TR.WORKFLOW_STATE_ID  AS "workflowStateId",
                                                        WS.WORKFLOW_ID       AS "workflowId",
                                                        F.ID                 AS "folderId"
                                                 FROM WORKFLOW_STATE WS
                                                          INNER JOIN WORKFLOW W ON W.ID = WS.WORKFLOW_ID
                                                          INNER JOIN FOLDER F ON F.WORKFLOW_ID = W.ID
                                                 WHERE F.ID = TR.FOLDER_ID
                                                   AND TR.WORKFLOW_STATE_ID = WS.ID) AS X) AS CHILDSTATES
                                   FROM TASK TC
                                            INNER JOIN TASK_RELATION TR ON TR.CHILD_TASK_ID = TC.ID
                                   WHERE T.ID = TR.PARENT_TASK_ID
                                                   AND TR.FOLDER_ID = ANY ($1)
                                   ORDER BY TR.STATE_INDEX) AS X)               AS CHILDREN, `
                : '',
            filterChild = !Object.keys(filter.taskFilter).length ? `AND TR.PARENT_TASK_ID IS NULL` : '',
            sqlFolderTree =
                `WITH RECURSIVE FOLDERS AS
                                        (SELECT F.ID,
                                                F.TITLE,
                                                F.start_date AS "startDate",
                                                F.end_date AS "endDate",
                                                F.archived_at as "archivedAt",
                                                F.deleted_at as "deletedAt",
                                                F.user_id as "ownerId",
                                                (
                                                    SELECT
                                                        JSON_AGG(X)
                                                    FROM
                                                        (
                                                            SELECT
                                                                FU.USER_ID AS "userId",
                                                                FU.USER_PERMISSION AS "userPermission",
                                                                FU.INHERIT
                                                            FROM FOLDER_USER_AP FU
                                                            WHERE
                                                                FU.FOLDER_ID = F.ID AND (FU.ENTITY_TYPE = 'folder' OR FU.ENTITY_TYPE = 'space') 
                                                        ) AS X
                                                ) AS MEMBERS,
                                                (
                                                    SELECT
                                                        ROW_TO_JSON(X)
                                                    FROM
                                                        (
                                                            SELECT
                                                                W.ID,
                                                                W.TITLE,
                                                                W.DESCRIPTION,
                                                                W.COLOR,
                                                                W.USER_ID AS "userId",
                                                                W.CREATED_AT AS "createdAt",
                                                                W.UPDATED_AT AS "updatedAt",
                                                                W.CREATED_BY AS "createdBy",
                                                                W.UPDATED_BY AS "updatedBy",
                                                                (
                                                                    SELECT
                                                                        JSON_AGG(X)
                                                                    FROM
                                                                        (
                                                                            SELECT
                                                                                WS.ID,
                                                                                WS.TITLE,
                                                                                WS.COLOR,
                                                                                WS.COMPLETED,
                                                                                WS.INDEX,
                                                                                WS.CODE
                                                                            FROM WORKFLOW_STATE WS
                                                                            WHERE
                                                                                WS.WORKFLOW_ID = W.ID
                                                                            ORDER BY
                                                                                WS.INDEX
                                                                        ) AS X
                                                                ) AS STATES
                                                            FROM WORKFLOW W
                                                            WHERE
                                                                F.WORKFLOW_ID = W.ID
                                                        ) AS X
                                                ) AS WORKFLOW,
                                                NULL::INTEGER AS PARENT_FOLDER_ID,
                                                0             AS DEPTH,
                                                NULL::INTEGER AS "folderRelationId"
                                         FROM FOLDER F
                                         WHERE F.ID = $1 ${folderPurge}
                                           AND ((F.USER_ID = $2) OR EXISTS(SELECT 1
                                                                           FROM folder_user_ap FU
                                                                           WHERE FU.FOLDER_ID = F.ID
                                                                             AND FU.ENTITY_TYPE = 'folder'
                                                                             AND (FU.USER_ID = $2 AND FU.user_permission = ANY ($3)))) ` +
                folderFilterStr +
                ` UNION ALL ` +
                `SELECT F.ID,
                            F.TITLE,
                            F.start_date AS "startDate",
                            F.end_date AS "endDate",
                            F.archived_at as "archivedAt",
                            F.deleted_at as "deletedAt",
                            F.user_id as "ownerId",
                            (
                                SELECT
                                    JSON_AGG(X)
                                FROM
                                    (
                                        SELECT
                                            FU.USER_ID AS "userId",
                                            FU.USER_PERMISSION AS "userPermission",
                                            FU.INHERIT
                                        FROM FOLDER_USER_AP FU
                                        WHERE
                                            FU.FOLDER_ID = F.ID AND (FU.ENTITY_TYPE = 'folder' OR FU.ENTITY_TYPE = 'space') 
                                    ) AS X
                            ) AS MEMBERS,
                            (
                                SELECT
                                    ROW_TO_JSON(X)
                                FROM
                                    (
                                        SELECT
                                            W.ID,
                                            W.TITLE,
                                            W.DESCRIPTION,
                                            W.COLOR,
                                            W.USER_ID AS "userId",
                                            W.CREATED_AT AS "createdAt",
                                            W.UPDATED_AT AS "updatedAt",
                                            W.CREATED_BY AS "createdBy",
                                            W.UPDATED_BY AS "updatedBy",
                                            (
                                                SELECT
                                                    JSON_AGG(X)
                                                FROM
                                                    (
                                                        SELECT
                                                            WS.ID,
                                                            WS.TITLE,
                                                            WS.COLOR,
                                                            WS.COMPLETED,
                                                            WS.INDEX,
                                                            WS.CODE
                                                        FROM WORKFLOW_STATE WS
                                                        WHERE
                                                            WS.WORKFLOW_ID = W.ID
                                                        ORDER BY
                                                            WS.INDEX
                                                    ) AS X
                                            ) AS STATES
                                        FROM WORKFLOW W
                                        WHERE
                                            F.WORKFLOW_ID = W.ID
                                    ) AS X
                            ) AS WORKFLOW,
                            FR.PARENT_FOLDER_ID,
                            TS.DEPTH + 1 AS DEPTH,
                            FR.ID        AS "folderRelationId"
                     FROM FOLDER F
                              INNER JOIN FOLDER_RELATION FR
                                         ON FR.CHILD_FOLDER_ID = F.ID
                              INNER JOIN FOLDERS TS
                                         ON FR.PARENT_FOLDER_ID = TS.ID
                     WHERE ((F.USER_ID = $2)
                         OR EXISTS(SELECT 1
                                   FROM folder_user_ap FU
                                   WHERE FU.FOLDER_ID = F.ID
                                   AND FU.ENTITY_TYPE = 'folder'
                                   AND (FU.USER_ID = $2
                                       AND FU.user_permission = ANY ($3)))) ${folderPurge}
                         ${folderFilterStr}) CYCLE ID
                    SET IS_CYCLE USING PATH
                    SELECT F.*, FP.INDEX
                    FROM FOLDERS F
                             LEFT JOIN FOLDER_POSITION FP ON
                                FP.FOLDER_RELATION_ID = F."folderRelationId"
                            AND FP.USER_ID = $2
                            AND FP.VIEW = $4
                    ORDER BY DEPTH,
                             PARENT_FOLDER_ID,
                             INDEX
                        NULLS FIRST`,
            sqlTaskTree = `SELECT * FROM (
                            SELECT DISTINCT ON (ID,FOLDER_ID) *
                            FROM (WITH RECURSIVE TASKS AS
                                                  (SELECT T.ID,
                                                          NULL::INTEGER                                       AS PARENT_TASK_ID,
                                                          TR.INDEX,
                                                          0                                                   AS DEPTH,
                                                          TR.FOLDER_ID,
                                                          T.TITLE,
                                                          T.archived_at as "archivedAt",
                                                          T.deleted_at as "deletedAt",
                                                          T.start_date AS "startDate",
                                                          T.end_date AS "endDate",
                                                          T.created_at      AS "createdAt",
                                                          T.COMPLETE,
                                                          T.DURATION,
                                                          T.EFFORT,
                                                            ${childrenQuery}
                                                            
                                                      T.ASSIGNEES,      
                                                      --    (SELECT ARRAY
                                                      --                ( $ { queries.taskAssignees } 
                                                      --                AND CAST(ASSIGNED_PERMISSION.ENTITY_ID as integer) = T.ID))              AS ASSIGNEES,

                                                      COALESCE((SELECT JSON_AGG(X)
                                                           FROM (SELECT PRED.ID,
                                                                        PRED."relationType",
                                                                        PRED.TASK_SUCCESSOR_ID AS "taskId"
                                                                 FROM FOLDER_TASK_PREDECESSOR PRED
                                                                 WHERE PRED.TASK_PREDECESSOR_ID = T.ID) AS X),JSON_ARRAY()) AS SUCCESSORS,
                                                    COALESCE((SELECT JSON_AGG(X)
                                                           FROM (SELECT PRED.ID,
                                                                        PRED."relationType",
                                                                        PRED.TASK_PREDECESSOR_ID AS "taskId"
                                                                 FROM FOLDER_TASK_PREDECESSOR PRED
                                                                 WHERE PRED.TASK_SUCCESSOR_ID = T.ID) AS X),JSON_ARRAY())   AS PREDECESSORS,
                                                            (SELECT JSON_AGG(CF)
                                                                 FROM (SELECT CF.id,
                                                                  CF.value,
                                                                  CF.index,
                                                                  (SELECT ROW_TO_JSON(X) FROM (SELECT CFD.id, 
                                                                    CFD.title, 
                                                                    CFD.type, 
                                                                    CFD.setting, 
                                                                    CFD.inheritance_type 
                                                                    FROM CUSTOM_FIELD_DEFINITION CFD
                                                                    WHERE CFD.ID = CF.CUSTOM_FIELD_DEFINITION_ID) AS X) AS "CustomFieldDefinition"
                                                                FROM CUSTOM_FIELD_VALUE CF
                                                                WHERE CF.task_id = T.id) AS CF) AS "customFields",
                                                          (SELECT JSON_AGG(X)
                                                           FROM (SELECT TR.WORKFLOW_STATE_ID   AS "workflowStateId",
                                                                        WS.WORKFLOW_ID        AS "workflowId",
                                                                        F.ID                  AS "folderId"
                                                                 FROM WORKFLOW_STATE WS
                                                                          INNER JOIN WORKFLOW W ON W.ID = WS.WORKFLOW_ID
                                                                          INNER JOIN FOLDER F ON F.WORKFLOW_ID = W.ID
                                                                 WHERE WS.ID = TR.WORKFLOW_STATE_ID
                                                                   AND TR.FOLDER_ID = F.ID) AS X)     AS STATES
                                                   FROM TASK T
                                                            INNER JOIN TASK_RELATION TR ON T.ID = TR.CHILD_TASK_ID AND
                                                                                          TR.FOLDER_ID = ANY ($1) ${filterChild}
                                                   WHERE ${taskPurge}
                                                       ${taskFilterStr}
                                                   UNION ALL
                                                   SELECT T.ID, TR.PARENT_TASK_ID, TR.INDEX, TS.DEPTH + 1 AS DEPTH, TS.FOLDER_ID, T.TITLE, T.archived_at AS "archivedAt", T.deleted_at as "deletedAt",T.start_date AS "startDate", T.end_date AS "endDate", T.created_at AS "createdAt", T.COMPLETE, T.DURATION,T.EFFORT,${childrenQuery}

                                                    T.ASSIGNEES,
                                                    -- (SELECT ARRAY
                                                    -- ($ { queries . taskAssignees }
                                                    --   AND CAST(ASSIGNED_PERMISSION.ENTITY_ID as integer) = T.ID)) AS ASSIGNEES, 
                                                       
                                                       (SELECT JSON_AGG(X)
                                                       FROM (SELECT PRED.ID, PRED."relationType", PRED.TASK_SUCCESSOR_ID AS "taskId"
                                                       FROM FOLDER_TASK_PREDECESSOR PRED
                                                       WHERE PRED.TASK_PREDECESSOR_ID = T.ID) AS X) AS SUCCESSORS, 
                                                      (SELECT JSON_AGG(X)
                                                       FROM (SELECT PRED.ID, PRED."relationType", PRED.TASK_PREDECESSOR_ID AS "taskId"
                                                       FROM FOLDER_TASK_PREDECESSOR PRED
                                                       WHERE PRED.TASK_SUCCESSOR_ID = T.ID) AS X) AS PREDECESSORS,
                                                       (SELECT JSON_AGG(CF)
                                                                 FROM (SELECT CF.id,
                                                                  CF.value,
                                                                  CF.index,
                                                                  (SELECT ROW_TO_JSON(X) FROM (SELECT CFD.id, 
                                                                    CFD.title, 
                                                                    CFD.type, 
                                                                    CFD.setting,  
                                                                    CFD.inheritance_type 
                                                                    FROM CUSTOM_FIELD_DEFINITION CFD
                                                                    WHERE CFD.ID = CF.CUSTOM_FIELD_DEFINITION_ID) AS X) AS "CustomFieldDefinition"
                                                                FROM CUSTOM_FIELD_VALUE CF
                                                                WHERE CF.task_id = T.id) AS CF) AS "customFields",
                                                      (SELECT JSON_AGG(X)
                                                       FROM (SELECT TR.WORKFLOW_STATE_ID  AS "workflowStateId",
                                                        WS.WORKFLOW_ID   AS "workflowId",
                                                        F.ID    AS "folderId"
                                                       FROM WORKFLOW_STATE WS
                                                       INNER JOIN WORKFLOW W ON W.ID = WS.WORKFLOW_ID
                                                       INNER JOIN FOLDER F ON F.WORKFLOW_ID = W.ID
                                                       WHERE WS.ID = TR.WORKFLOW_STATE_ID
                                                       AND TR.FOLDER_ID = F.ID) AS X) AS STATES
                                                   FROM TASK T
                                                       INNER JOIN TASK_RELATION TR
                                                   ON T.ID = TR.CHILD_TASK_ID
                                                       INNER JOIN TASKS TS ON TR.PARENT_TASK_ID = TS.ID AND TR.FOLDER_ID = TS.FOLDER_ID
                                                   WHERE ${taskPurge} ${taskFilterStr}) CYCLE ID
                SET IS_CYCLE USING PATH
                SELECT * FROM TASKS) AS DISTINCTTASKS
                ORDER BY ID) AS ORDEREDTASKS
                ORDER BY DEPTH DESC, PARENT_TASK_ID, INDEX`,
            folders: GanttFolderQueryResponseDto[] = await this.repo.query(sqlFolderTree, [
                folderId,
                userId,
                [UserPermissionOptions.FULL, UserPermissionOptions.EDITOR, UserPermissionOptions.READONLY],
                FolderViewOptions.GANTT,
                ...folderFilterParams,
            ]),
            tasks: GanttTaskQueryResponseDto[] = await this.repo.query(sqlTaskTree, [folders.map((x) => x.id), ...taskFilterParams]);
        for (const task of tasks) {
            task.path = task.path.replace('{', '').replace('}', '');
            task.path = task.path
                .replace(/[{}]/g, '')
                .split(',')
                .map((el) => `(${task.folder_id}-${el.replace(/[()]/g, '')})`)
                .join(',');
        }
        const taskTrees = listToTree(
            tasks,
            'path',
            (x) => {
                const ret = x.path.split(',');
                ret.splice(-1);
                return ret.join(',');
            },
            'children'
        );
        for (const folder of folders) {
            folder['tasks'] = [];
            folder.path = folder.path.replace('{', '').replace('}', '');
        }
        for (const taskTree of taskTrees) {
            const folder = folders.find((x) => x.id === taskTree.folder_id);
            if (folder) {
                folder['tasks'].push(taskTree);
            } else {
                throw new InternalServerErrorException(`????`);
            }
        }
        const folderTrees = listToTree(
            folders,
            'path',
            (x) => {
                const ret = x['path'].split(',');
                ret.splice(-1);
                return ret.join(',');
            },
            'children'
        );
        modifyTree(
            folderTrees,
            (x) => {
                delete x.parent_folder_id;
                delete x.index;
                delete x.depth;
                delete x.is_cycle;
                delete x.path;
            },
            'children'
        );
        modifyTree(
            taskTrees,
            (x) => {
                delete x.parent_task_id;
                delete x.folder_id;
                delete x.index;
                delete x.depth;
                delete x.is_cycle;
                delete x.path;
            },
            'children'
        );
        return folderTrees[0];
    }

    async getProjectsFlowsAndTasksList(
        folderId: number,
        userId: string,
        filter: FolderTaskFilterDto,
        showArchived: boolean,
        showDeleted: boolean,
        hasPurgePermissions: boolean
    ): Promise<ListResponseDto> {
        let filterPos = 5;
        const [folderFilterStr, folderFilterParamsUnk] = this.createFolderFilter(filter, 5);
        if (folderFilterParamsUnk.length > 0) ++filterPos;
        const folderFilterParams = folderFilterParamsUnk as string[];
        const {offset, limit} = this.createPagination(filter.pagination);
        const sort = this.createSort(filter.sort);
        const [taskFilterStr, taskFilterParams] = this.createTaskFilter(filter, filterPos);
        const [taskPurge, folderPurge] = this.createArchiveDeletedPurgeQuery(showArchived, showDeleted, hasPurgePermissions);

        const sqlFolderTree =
            `
                                WITH RECURSIVE FOLDERS AS
                                        (SELECT F.ID,
                                                F.TITLE,
                                                F.start_date        AS "startDate",
                                                F.end_date          AS "endDate",
                                                F.archived_at       AS "archivedAt",
                                                F.deleted_at        AS "deletedAt",
                                                NULL::INTEGER       AS PARENT_FOLDER_ID,
                                                0                   AS DEPTH,
                                                NULL::INTEGER       AS "folderRelationId",
                                                ( 
                                                    WITH RECURSIVE TASKS AS (
                                                        SELECT 
                                                            T.ID, 
                                                            TR.PATH_IDS,
                                                            TR.PARENT_TASK_ID
                                                        FROM
                                                            TASK_RELATION TR
                                                            INNER JOIN TASK T ON T.ID = TR.CHILD_TASK_ID 
                                                        WHERE
                                                            F.ID = TR.FOLDER_ID
                                                            AND ${taskPurge}
                                                            ${taskFilterStr}

                                                        UNION ALL
                                                        
                                                        SELECT 
                                                            T.ID   , 
                                                            TR.PATH_IDS,
                                                            TR.PARENT_TASK_ID
                                                        FROM
                                                            TASK_RELATION TR
                                                            INNER JOIN TASK T ON T.ID = TR.CHILD_TASK_ID
                                                            INNER JOIN TASKS TS ON TS.ID = TR.PARENT_TASK_ID
                                                        WHERE
                                                            F.ID = TR.FOLDER_ID
                                                            AND ${taskPurge}
                                                    )

                                                    SELECT JSON_AGG(PATH_IDS)
                                                    FROM TASKS

                                                ) AS "matchedTaskIds",
                                                (
                                                    WITH RECURSIVE TASKS AS (
                                                        SELECT
                                                            T.ID,
                                                            TR.PARENT_TASK_ID,
                                                            TR.CHILD_TASK_ID
                                                        FROM
                                                            TASK T
                                                            INNER JOIN TASK_RELATION TR ON T.ID = TR.CHILD_TASK_ID
                                                        WHERE
                                                            F.ID = TR.FOLDER_ID
                                                            AND ${taskPurge}
                                                            ${taskFilterStr}
                                                        
                                                        UNION ALL

                                                        SELECT
                                                            T.ID,
                                                            TR.PARENT_TASK_ID,
                                                            TR.CHILD_TASK_ID
                                                        FROM
                                                            TASK T
                                                            INNER JOIN TASK_RELATION TR ON T.ID = TR.CHILD_TASK_ID
                                                            INNER JOIN TASKS TS ON TS.PARENT_TASK_ID = T.ID
                                                        WHERE
                                                            F.ID = TR.FOLDER_ID
                                                            AND ${taskPurge}
                                                            
                                                    )

                                                    SELECT COUNT(DISTINCT ID)
                                                    FROM TASKS
                                                    WHERE TASKS.PARENT_TASK_ID IS NULL

                                                ) AS "totalCount"
                                         FROM FOLDER F
                                         WHERE F.ID = $1 ${folderPurge} AND ((F.USER_ID = $2) OR EXISTS(SELECT 1
                                            FROM folder_user_ap FU
                                            WHERE FU.FOLDER_ID = F.ID 
                                            AND FU.ENTITY_TYPE = 'folder'
                                            AND (FU.USER_ID = $2 AND FU.user_permission = ANY ($3)))) ` +
            folderFilterStr +
            ` UNION ALL ` +
            `SELECT F.ID,
                                                    F.TITLE,
                                                    F.start_date        AS "startDate",
                                                    F.end_date          AS "endDate",
                                                    F.archived_at       AS "archivedAt",
                                                    F.deleted_at        AS "deletedAt",
                                                    FR.PARENT_FOLDER_ID,
                                                    TS.DEPTH + 1        AS DEPTH,
                                                    FR.ID               AS "folderRelationId",
                                                    ( 
                                                        WITH RECURSIVE TASKS AS (
                                                            SELECT 
                                                                T.ID, 
                                                                TR.PATH_IDS,
                                                                TR.PARENT_TASK_ID
                                                            FROM
                                                                TASK_RELATION TR
                                                                INNER JOIN TASK T ON T.ID = TR.CHILD_TASK_ID 
                                                            WHERE
                                                                F.ID = TR.FOLDER_ID
                                                                AND ${taskPurge}
                                                                ${taskFilterStr}
    
                                                            UNION ALL
                                                            
                                                            SELECT 
                                                                T.ID   , 
                                                                TR.PATH_IDS,
                                                                TR.PARENT_TASK_ID
                                                            FROM
                                                                TASK_RELATION TR
                                                                INNER JOIN TASK T ON T.ID = TR.CHILD_TASK_ID
                                                                INNER JOIN TASKS TS ON TS.ID = TR.PARENT_TASK_ID
                                                            WHERE
                                                                F.ID = TR.FOLDER_ID
                                                                AND ${taskPurge}
                                                        )
    
                                                        SELECT JSON_AGG(PATH_IDS)
                                                        FROM TASKS
    
                                                    ) AS "matchedTaskIds",
                                                    (
                                                        WITH RECURSIVE TASKS AS (
                                                            SELECT
                                                                T.ID,
                                                                TR.PARENT_TASK_ID,
                                                                TR.CHILD_TASK_ID
                                                            FROM
                                                                TASK T
                                                                INNER JOIN TASK_RELATION TR ON T.ID = TR.CHILD_TASK_ID
                                                            WHERE
                                                                F.ID = TR.FOLDER_ID
                                                                AND ${taskPurge}
                                                                ${taskFilterStr}
                                                            
                                                            UNION ALL
    
                                                            SELECT
                                                                T.ID,
                                                                TR.PARENT_TASK_ID,
                                                                TR.CHILD_TASK_ID
                                                            FROM
                                                                TASK T
                                                                INNER JOIN TASK_RELATION TR ON T.ID = TR.CHILD_TASK_ID
                                                                INNER JOIN TASKS TS ON TS.PARENT_TASK_ID = T.ID
                                                            WHERE
                                                                F.ID = TR.FOLDER_ID
                                                                AND ${taskPurge}
                                                                
                                                        )
    
                                                        SELECT COUNT(DISTINCT ID)
                                                        FROM TASKS
                                                        WHERE TASKS.PARENT_TASK_ID IS NULL
    
                                                    ) AS "totalCount"
                                            FROM FOLDER F
                                                    INNER JOIN FOLDER_RELATION FR
                                                                ON FR.CHILD_FOLDER_ID = F.ID
                                                    INNER JOIN FOLDERS TS
                                                                ON FR.PARENT_FOLDER_ID = TS.ID
                                            WHERE ((F.USER_ID = $2)
                                                OR EXISTS(SELECT 1
                                                        FROM folder_user_ap FU
                                                        WHERE FU.FOLDER_ID = F.ID
                                                        AND FU.ENTITY_TYPE = 'folder'
                                                        AND (FU.USER_ID = $2
                                                        AND FU.user_permission = ANY ($3)))) ${folderPurge}
                                                ${folderFilterStr}) CYCLE ID
                                            SET IS_CYCLE USING PATH
                                            SELECT F.*, FP.INDEX
                                            FROM FOLDERS F
                                                    LEFT JOIN FOLDER_POSITION FP ON FP.FOLDER_RELATION_ID = F."folderRelationId"
                                                    AND FP.USER_ID = $2
                                                    AND FP.VIEW = $4
                                            ORDER BY DEPTH,
                                                    PARENT_FOLDER_ID,
                                                    INDEX
                                                NULLS FIRST
                                `;
        const sqlTaskParent = `
                                    SELECT T.ID,
                                        NULL::INTEGER                                   AS PARENT_TASK_ID,
                                        (SELECT ARRAY[]::INTEGER[])                     AS children,
                                        TR.INDEX,
                                        TR.FOLDER_ID                                    AS "folderId",
                                        F.title                                         AS FOLDER,
                                        T.TITLE,
                                        T.archived_at                                   AS "archivedAt",
                                        T.deleted_at                                    AS "deletedAt",
                                        T.start_date                                    AS "startDate",
                                        T.end_date                                      AS "endDate",
                                        T.CREATED_AT                                    AS "createdAt",
                                        T.USER_ID                                       AS "ownerId",
                                        T.IMPORTANCE_ID                                 AS "importanceId",

                                        (SELECT COUNT(1)
                                            FROM TASK_ATTACHMENT TA
                                            WHERE T.ID = TA.TASK_ID)                    AS "attachementCount",

                                        (SELECT ARRAY
                                            (SELECT LT.tag_id
                                                FROM TAGS_TASK_FOLDER LT
                                                    INNER JOIN TAGS L
                                                        ON (L.ID = LT.TAG_ID) AND (L.USER_ID IS NULL OR L.USER_ID = $2)
                                                WHERE LT.TASK_ID = T.ID))               AS TAGS,

                                            
                                                    (SELECT LT.TAG_ID as id
                                                        FROM TAGS_TASK_FOLDER LT
                                                                INNER JOIN TAGS L
                                                                    ON L.ID = LT.TAG_ID
                                                        WHERE LT.TASK_ID = T.ID
                                                            AND LT.TYPE = 'prominentTag')   AS "commonProminentTagId",

                                                
                                                        (SELECT LT.TAG_ID as id
                                                        FROM TAGS_TASK_FOLDER LT
                                                                INNER JOIN TAGS L
                                                                    ON (L.ID = LT.TAG_ID) AND (LT.USER_ID = $2)
                                                        WHERE LT.TASK_ID = T.ID
                                                            AND LT.TYPE = 'userProminentTag')           AS "userProminentTagId",
                                                        T.ASSIGNEES,
                                                        -- (SELECT ARRAY
                                                        --       ($ { queries . taskAssignees }
                                                        --       AND CAST(ASSIGNED_PERMISSION.ENTITY_ID as integer) = T.ID))  AS ASSIGNEES,

                                        (SELECT JSON_AGG(X)
                                            FROM (SELECT CFV.ID,
                                                        CFV.VALUE,
                                                        CFV.INDEX,
                                                        CFV.CUSTOM_FIELD_DEFINITION_ID  AS "customFieldDefinitionId"
                                                FROM CUSTOM_FIELD_VALUE CFV
                                                        INNER JOIN CUSTOM_FIELD_DEFINITION CFD ON CFV.CUSTOM_FIELD_DEFINITION_ID = CFD.ID
                                                WHERE CFD.USER_ID IS NULL
                                                    AND CFV.TASK_ID = T.ID) AS X)       AS "customFields",

                                        (SELECT JSON_AGG(X)
                                            FROM (SELECT CFV.ID,
                                                        CFV.VALUE,
                                                        CFV.INDEX,
                                                        CFV.CUSTOM_FIELD_DEFINITION_ID  AS "customFieldDefinitionId"
                                                FROM CUSTOM_FIELD_VALUE CFV
                                                        INNER JOIN CUSTOM_FIELD_DEFINITION CFD ON CFV.CUSTOM_FIELD_DEFINITION_ID = CFD.ID
                                                WHERE CFD.USER_ID = $2
                                                    AND CFV.TASK_ID = T.ID) AS X)       AS "userCustomFields",

                                        (SELECT JSON_AGG(X)
                                            FROM (SELECT TR.WORKFLOW_STATE_ID           AS "workflowStateId",
                                                        WS.WORKFLOW_ID                  AS "workflowId",
                                                        F.ID                            AS "folderId"
                                                FROM WORKFLOW_STATE WS
                                                        INNER JOIN WORKFLOW W ON W.ID = WS.WORKFLOW_ID
                                                WHERE WS.ID = TR.WORKFLOW_STATE_ID
                                                    AND TR.FOLDER_ID = F.ID) AS X)      AS STATES
                                    FROM TASK T
                                            INNER JOIN TASK_RELATION TR ON T.ID = TR.CHILD_TASK_ID 
                                            AND TR.FOLDER_ID = ANY ($1) 
                                            AND TR.PARENT_TASK_ID IS NULL
                                            INNER JOIN FOLDER F ON F.ID = TR.FOLDER_ID
                                    WHERE ${taskPurge} AND TR.CHILD_TASK_ID = ANY ($5) OR TR.PARENT_TASK_ID = ANY ($5) ${sort} OFFSET $3 LIMIT $4`;

        const sqlTaskTree = `
                                WITH RECURSIVE TASKS AS
                                        (SELECT T.ID,
                                                TR.PARENT_TASK_ID,
                                                TR.INDEX,
                                                0                                               AS DEPTH,
                                                TR.FOLDER_ID AS "folderId",
                                                T.TITLE,
                                                T.archived_at as "archivedAt",
                                                T.deleted_at as "deletedAt",
                                                T.start_date AS "startDate",
                                                T.end_date AS "endDate",
                                                T.CREATED_AT                                    AS "createdAt",
                                                T.USER_ID                                       AS "ownerId",
                                                T.IMPORTANCE_ID                                 AS "importanceId",

                                                (SELECT COUNT(1)
                                                 FROM TASK_ATTACHMENT TA
                                                 WHERE T.ID = TA.TASK_ID)                       AS "attachementCount",

                                                (SELECT ARRAY
                                                    (SELECT LT.tag_id
                                                        FROM TAGS_TASK_FOLDER LT
                                                            INNER JOIN TAGS L
                                                                ON (L.ID = LT.TAG_ID) AND (L.USER_ID IS NULL OR L.USER_ID = $2)
                                                        WHERE LT.TASK_ID = T.ID))                AS TAGS,

                                                    
                                                        (SELECT LT.TAG_ID as id
                                                            FROM TAGS_TASK_FOLDER LT
                                                                INNER JOIN TAGS L
                                                                    ON L.ID = LT.TAG_ID
                                                            WHERE LT.TASK_ID = T.ID
                                                              AND LT.TYPE = 'prominentTag')      AS "commonProminentTagId",
                           
                                                      
                                                              (SELECT LT.TAG_ID as id
                                                                FROM TAGS_TASK_FOLDER LT
                                                                    INNER JOIN TAGS L
                                                                        ON (L.ID = LT.TAG_ID) AND (LT.USER_ID = $2)
                                                                WHERE LT.TASK_ID = T.ID
                                                                  AND LT.TYPE = 'userProminentTag')    AS "userProminentTagId",
                                                T.ASSIGNEES,
                                                -- (SELECT ARRAY
                                                --       ($ { queries . taskAssignees }
                                                --       AND CAST(ASSIGNED_PERMISSION.ENTITY_ID as integer) = T.ID))          AS ASSIGNEES,

                                                (SELECT JSON_AGG(X)
                                                 FROM (SELECT CFV.ID,
                                                              CFV.VALUE,
                                                              CFV.INDEX,
                                                              CFV.CUSTOM_FIELD_DEFINITION_ID  AS "customFieldDefinitionId"
                                                       FROM CUSTOM_FIELD_VALUE CFV
                                                                INNER JOIN CUSTOM_FIELD_DEFINITION CFD ON CFV.CUSTOM_FIELD_DEFINITION_ID = CFD.ID
                                                       WHERE CFD.USER_ID IS NULL
                                                         AND CFV.TASK_ID = T.ID) AS X)        AS "customFields",

                                                (SELECT JSON_AGG(X)
                                                 FROM (SELECT CFV.ID,
                                                              CFV.VALUE,
                                                              CFV.INDEX,
                                                              CFV.CUSTOM_FIELD_DEFINITION_ID   AS "customFieldDefinitionId"
                                                       FROM CUSTOM_FIELD_VALUE CFV
                                                                INNER JOIN CUSTOM_FIELD_DEFINITION CFD ON CFV.CUSTOM_FIELD_DEFINITION_ID = CFD.ID
                                                       WHERE CFD.USER_ID = $2
                                                         AND CFV.TASK_ID = T.ID) AS X)          AS "userCustomFields",

                                                (SELECT JSON_AGG(X)
                                                 FROM (SELECT TR.WORKFLOW_STATE_ID  AS "workflowStateId",
                                                              WS.WORKFLOW_ID       AS "workflowId",
                                                              F.ID                 AS "folderId"
                                                       FROM WORKFLOW_STATE WS
                                                                INNER JOIN WORKFLOW W ON W.ID = WS.WORKFLOW_ID
                                                       WHERE WS.ID = TR.WORKFLOW_STATE_ID
                                                         AND TR.FOLDER_ID = F.ID) AS X) AS STATES
                                         FROM TASK T
                                                  INNER JOIN TASK_RELATION TR ON T.ID = TR.CHILD_TASK_ID AND
                                                                                 TR.FOLDER_ID = ANY ($1) AND
                                                                                 TR.PARENT_TASK_ID = ANY ($3)
                                                INNER JOIN FOLDER F ON F.ID = TR.FOLDER_ID
                                            WHERE ${taskPurge} 
                                            AND TR.CHILD_TASK_ID = ANY ($4) OR TR.PARENT_TASK_ID = ANY ($4)
                            UNION ALL
                            SELECT T.ID,
                            TR.PARENT_TASK_ID,
                            TR.INDEX,
                            TS.DEPTH + 1                                    AS DEPTH,
                            TS."folderId",
                            T.TITLE,
                            T.archived_at as "archivedAt",
                            T.deleted_at as "deletedAt",
                            T.start_date AS "startDate",
                            T.end_date AS "endDate",
                            T.CREATED_AT                        AS "createdAt",
                            T.USER_ID                                       AS "ownerId",
                            T.IMPORTANCE_ID                            AS "importanceId",

                            (SELECT COUNT(1)
                             FROM TASK_ATTACHMENT TA
                             WHERE T.ID = TA.TASK_ID)                       AS "attachmentCount",

                          
                             (SELECT ARRAY
                                (SELECT LT.tag_id
                                    FROM TAGS_TASK_FOLDER LT
                                             INNER JOIN TAGS L
                                                        ON (L.ID = LT.TAG_ID) AND (L.USER_ID IS NULL OR L.USER_ID = $2)
                                    WHERE LT.TASK_ID = T.ID))          AS TAGS,

                                    (SELECT LT.TAG_ID as id
                                        FROM TAGS_TASK_FOLDER LT
                                                 INNER JOIN TAGS L
                                                            ON L.ID = LT.TAG_ID
                                        WHERE LT.TASK_ID = T.ID
                                          AND LT.TYPE = 'prominentTag')        AS "commonProminentTagId",
       
                                            (SELECT LT.TAG_ID as id
                                                FROM TAGS_TASK_FOLDER LT
                                                         INNER JOIN TAGS L
                                                                    ON (L.ID = LT.TAG_ID) AND (LT.USER_ID = $2)
                                                WHERE LT.TASK_ID = T.ID
                                                  AND LT.TYPE = 'userProminentTag')    AS "userProminentTagId",
                            T.ASSIGNEES,
                            -- (SELECT ARRAY
                            --             ($ { queries . taskAssignees }
                            ---                           AND CAST(ASSIGNED_PERMISSION.ENTITY_ID as integer) = T.ID))          AS ASSIGNEES,

                            (SELECT JSON_AGG(X)
                             FROM (SELECT CFV.ID,
                                          CFV.VALUE,
                                          CFV.INDEX,
                                          CFV.CUSTOM_FIELD_DEFINITION_ID AS "customFieldDefinitionId"
                                   FROM CUSTOM_FIELD_VALUE CFV
                                            INNER JOIN CUSTOM_FIELD_DEFINITION CFD ON CFV.CUSTOM_FIELD_DEFINITION_ID = CFD.ID
                                   WHERE CFD.USER_ID IS NULL
                                     AND CFV.TASK_ID = T.ID) AS X)          AS "customFields",

                            (SELECT JSON_AGG(X)
                             FROM (SELECT CFV.ID,
                                          CFV.VALUE,
                                          CFV.INDEX,
                                          CFV.CUSTOM_FIELD_DEFINITION_ID "customFieldDefinitionId"
                                   FROM CUSTOM_FIELD_VALUE CFV
                                            INNER JOIN CUSTOM_FIELD_DEFINITION CFD ON CFV.CUSTOM_FIELD_DEFINITION_ID = CFD.ID
                                   WHERE CFD.USER_ID = $2
                                     AND CFV.TASK_ID = T.ID) AS X)          AS "userCustomFields",

                            (SELECT JSON_AGG(X)
                             FROM (SELECT TR.WORKFLOW_STATE_ID AS "workflowStateId",
                              WS.WORKFLOW_ID  AS "workflowId",
                               F.ID AS "folderId"
                                   FROM WORKFLOW_STATE WS
                                            INNER JOIN WORKFLOW W ON W.ID = WS.WORKFLOW_ID
                                   WHERE WS.ID = TR.WORKFLOW_STATE_ID
                                     AND TR.FOLDER_ID = F.ID) AS X) AS STATES

                        FROM TASK T
                                INNER JOIN TASK_RELATION TR
                                            ON T.ID = TR.CHILD_TASK_ID
                                INNER JOIN TASKS TS ON TR.PARENT_TASK_ID = TS.ID AND TR.FOLDER_ID = TS."folderId"
                                INNER JOIN FOLDER F ON F.ID = TS."folderId"
                                WHERE ${taskPurge} AND T.ID = ANY ($4))
                        CYCLE ID
                        SET IS_CYCLE USING PATH
                        SELECT *
                        FROM TASKS
                        ORDER BY DEPTH, PARENT_TASK_ID, INDEX
                    `;

        const listFolderQueryParams: unknown[] = [
            folderId,
            userId,
            [UserPermissionOptions.FULL, UserPermissionOptions.EDITOR, UserPermissionOptions.READONLY],
            FolderViewOptions.GANTT,
        ];
        if (folderFilterParams.length > 0) listFolderQueryParams.push(...folderFilterParams);
        if (taskFilterParams.length > 0) listFolderQueryParams.push(...taskFilterParams);
        const folders: ListFolderQueryResponseDto[] = await this.repo.query(sqlFolderTree, listFolderQueryParams);

        const folderRelationIds = [];

        for (const folder of folders) {
            if (folder?.matchedTaskIds?.length) {
                for (const setIds of folder.matchedTaskIds) {
                    setIds.forEach((id) => {
                        if (!folderRelationIds.includes(id)) {
                            folderRelationIds.push(id);
                        }
                    });
                }
            }
        }

        const parentTasks: ListTaskQueryResponseDto[] = await this.repo.query(sqlTaskParent, [
            folders.map((x) => x.id),
            userId,
            offset,
            limit,
            folderRelationIds,
        ]);

        const tasks: ListTaskQueryResponseDto[] = await this.repo.query(sqlTaskTree, [
            folders.map((x) => x.id),
            userId,
            parentTasks.map((x) => x.id),
            folderRelationIds,
        ]);

        for (const task of tasks) {
            task.path = task.path.replace('{', '').replace('}', '');
        }

        const taskTrees: ListTaskQueryResponseDto[] = listToTree(
            tasks,
            'path',
            (x: ListTaskQueryResponseDto) => {
                const ret = x.path.split(',');
                ret.splice(-1);
                return ret.join(',');
            },
            'children'
        );

        for (const task of tasks) {
            const parentTask = parentTasks.find((parent) => Number(parent.id) === Number(task.parent_task_id));
            if (parentTask) {
                parentTask.children.push(task);
            }
        }

        modifyTree(
            taskTrees,
            (x) => {
                delete x.parent_task_id;
                delete x.index;
                delete x.depth;
                delete x.is_cycle;
                delete x.path;
            },
            'children'
        );
        let totalCount = 0,
            tasksArray = parentTasks as ListTask[];
        for (const folder of folders) {
            totalCount += Number(folder.totalCount);
        }

        if (filter.groupBy) {
            tasksArray = this.groupByTasksList(parentTasks, filter.groupBy);
        }

        const response = {totalCount, tasks: tasksArray};
        return response;
    }

    async getProjectWorkflow(folderIds: number[], userId: string): Promise<ProjectWorkFlowResponseDto[]> {
        const sql = `SELECT W.ID,
                                W.TITLE,
                                W.DESCRIPTION,
                                W.COLOR,
                                F.ID  AS "folderId",
                                (SELECT JSON_AGG(X)
                                 FROM (SELECT WS.ID,
                                              WS.TITLE,
                                              WS.COLOR,
                                              WS.COMPLETED,
                                              WS.INDEX,
                                              WS.CODE,
                                              SS.ID AS "systemStageId"
                                       FROM  "${RawDatabaseConfig.schema}".WORKFLOW_STATE WS
                                       LEFT JOIN  "${RawDatabaseConfig.schema}".DISPLACEMENT_CODE DC ON WS.DISPLACEMENT_CODE_ID = DC.ID
                                       INNER JOIN  "${RawDatabaseConfig.schema}".SYSTEM_STAGE SS ON WS.SYSTEM_STAGE_ID = SS.ID OR SS.ID = DC.SYSTEM_STAGE_ID
                                       WHERE WS.WORKFLOW_ID = W.ID
                                       ORDER BY WS.INDEX) AS X)                        AS STATES
                         FROM  "${RawDatabaseConfig.schema}".FOLDER F
                         INNER JOIN  "${RawDatabaseConfig.schema}".WORKFLOW W ON W.ID = F.WORKFLOW_ID
                         WHERE F.ID = ANY ($1)
                           AND EXISTS(SELECT 1
                                      FROM  "${RawDatabaseConfig.schema}".FOLDER F
                                               LEFT JOIN  "${RawDatabaseConfig.schema}".folder_user_ap FU ON F.ID = FU.FOLDER_ID 
                                      WHERE F.WORKFLOW_ID = W.ID
                                        AND (F.USER_ID = $2 OR FU.USER_ID = $2) AND FU.ENTITY_TYPE = 'folder')`;
        return await this.repo.query(sql, [folderIds, userId]);
    }

    private createFolderFilter(filter: FolderTaskFilterDto, startParamIndex: number): [string, unknown[]] {
        const str = [''],
            params: unknown[] = [];
        if (filter.folderFilter?.ownerId) {
            str.push(`F.user_id = ${'$' + startParamIndex++}`);
            params.push(filter.folderFilter.ownerId);
        }
        if (filter.folderFilter?.endDate) {
            str.push(`F.end_date = ${'$' + startParamIndex++}`);
            params.push(filter.folderFilter.endDate);
        }
        if (filter.folderFilter?.startDate) {
            str.push(`F.start_date = ${'$' + startParamIndex++}`);
            params.push(filter.folderFilter.startDate);
        }
        if (filter.folderFilter && filter.folderFilter.members && filter.folderFilter.members.length > 0) {
            str.push(
                `EXISTS (SELECT 1 FROM folder_user_ap FU WHERE  F.ID = FU.FOLDER_ID AND FU.ENTITY_TYPE = 'folder' AND FU.USER_ID = ANY (${
                    '$' + startParamIndex++
                }) )`
            );
            params.push(filter.folderFilter.members);
        }

        if (params.length > 0) {
            return [str.join(' AND '), params];
        } else {
            return ['', params];
        }
    }

    private createTaskFilter(filter: FolderTaskFilterDto, startParamIndex: number): [string, unknown[]] {
        const str = [''],
            params: unknown[] = [];
        if (filter.taskFilter?.ownerId) {
            str.push(`T.user_id = ${'$' + startParamIndex++}`);
            params.push(filter.taskFilter.ownerId);
        }
        if (filter.taskFilter?.endDate) {
            const endDate = filter.taskFilter.endDate;
            const endDatePlus24Hours = moment(endDate).add(24, 'hours').toDate();
            str.push(`T.end_date BETWEEN ${'$' + startParamIndex++} AND ${'$' + startParamIndex++}`);
            params.push(endDate, endDatePlus24Hours);
        }

        if (filter.taskFilter?.startDate) {
            const startDate = filter.taskFilter.startDate;
            const startDatePlus24Hours = moment(startDate).add(24, 'hours').toDate();
            str.push(`T.start_date BETWEEN ${'$' + startParamIndex++} AND ${'$' + startParamIndex++}`);
            params.push(startDate, startDatePlus24Hours);
        }

        if (filter?.taskFilter?.createdAt) {
            const createdAt = filter.taskFilter.createdAt;
            const createdAtPlus24Hours = moment(createdAt).add(24, 'hours').toDate();
            str.push(`T."created_at" BETWEEN ${'$' + startParamIndex++} AND ${'$' + startParamIndex++}`);
            params.push(createdAt, createdAtPlus24Hours);
        }

        if (filter.taskFilter && filter.taskFilter.assignees && filter.taskFilter.assignees.length > 0) {
            str.push(`T.assignees && ${'$' + startParamIndex++}`);
            params.push(filter.taskFilter.assignees);
        }
        if (filter.taskFilter?.importanceId) {
            str.push(`T.importance_id = ${'$' + startParamIndex++}`);
            params.push(filter.taskFilter.importanceId);
        }
        if (filter.taskFilter?.search) {
            str.push(`T.title ILIKE '%' || ${'$' + startParamIndex} || '%' AND similarity(T.title,${'$' + startParamIndex++}) > 0.1`);
            params.push(filter.taskFilter.search);
        }
        if (filter.taskFilter && filter.taskFilter.states && filter.taskFilter.states?.length > 0) {
            str.push(
                `EXISTS (SELECT 1 FROM TASK_RELATION TR WHERE T.ID = TR.CHILD_TASK_ID AND TR.WORKFLOW_STATE_ID = ANY (${
                    '$' + startParamIndex++
                }) )`
            );
            params.push(filter.taskFilter.states);
        }
        if (filter.taskFilter && filter.taskFilter.tagsId && filter.taskFilter.tagsId.length > 0) {
            str.push(
                `EXISTS (SELECT 1 FROM TAGS_TASK_FOLDER OTTF WHERE T.ID = OTTF.TASK_ID AND OTTF.TYPE = '${
                    TagTaskFolderTypeOptions.TASK_TAG
                }' AND OTTF.TAG_ID = ANY (${'$' + startParamIndex++}) )`
            );
            params.push(filter.taskFilter.tagsId);
        }
        if (filter.taskFilter?.prominentTagId) {
            str.push(
                `EXISTS (SELECT 1 FROM TAGS_TASK_FOLDER OTTF WHERE T.ID = OTTF.TASK_ID AND OTTF.TYPE = '${
                    TagTaskFolderTypeOptions.COMMON_PROMINENT_TAG
                }' AND OTTF.TAG_ID = ${'$' + startParamIndex++} )`
            );
            params.push(filter.taskFilter.prominentTagId);
        }
        if (params.length > 0) {
            return [str.join(' AND '), params];
        } else {
            return ['', params];
        }
    }

    private createPagination(pagination: PaginationDto): PaginationDto {
        if (pagination) {
            return {offset: pagination.offset * pagination.limit, limit: pagination.limit};
        }
        return {offset: 0, limit: 100};
    }

    private createSort(sort: SortDto): string {
        if (sort?.key && sort?.order) {
            return `ORDER BY "${sort.key}" ${sort.order}`;
        }
        return '';
    }

    private createArchiveDeletedPurgeQuery(showArchived: boolean, showDeleted: boolean, hasPurgePermissions: boolean): [string, string] {
        let folderPurge = 'AND F.ARCHIVED_AT IS NULL AND F.DELETED_AT IS NULL';
        let taskPurge = 'T.ARCHIVED_AT IS NULL AND T.DELETED_AT IS NULL';
        if (showArchived && showDeleted && hasPurgePermissions) {
            folderPurge = '';
            taskPurge = '';
        } else if (showArchived) {
            folderPurge = 'AND F.DELETED_AT IS NULL';
            taskPurge = 'T.DELETED_AT IS NULL';
        } else if (showDeleted && hasPurgePermissions) {
            folderPurge = 'AND F.ARCHIVED_AT IS NULL';
            taskPurge = 'T.ARCHIVED_AT IS NULL';
        }
        return [taskPurge, folderPurge];
    }

    //todo : add type of workflow (dto)
    private async groupByTasksBoard(workflow: unknown, groupBy: string): Promise<unknown> {
        for (const column of workflow['columns']) {
            const groupedTasks = {};
            column.tasks.forEach((task) => {
                let groupByValues = [];
                switch (groupBy) {
                    case 'assignees':
                    case 'tags':
                    case 'custom_fields':
                        groupByValues = (task[groupBy].length > 0 && task[groupBy]) || ['others'];
                        break;
                    case 'startDate':
                        groupByValues.push(moment(task[groupBy]).format('YYYY-MM-DD'));
                        break;
                    default:
                        groupByValues.push(task[groupBy]);
                        break;
                }

                groupByValues.forEach((value) => {
                    const groupedValue = groupBy === 'custom_fields' ? value.custom_field_definition_id : value;
                    if (!groupedTasks[groupedValue]) {
                        groupedTasks[groupedValue] = [];
                    }
                    groupedTasks[groupedValue].push(task);
                });
            });

            column.tasks = groupedTasks;
        }

        return await workflow;
    }

    private groupByTasksList(tasks: ListTask[], groupBy: string): ListTask[] {
        const groupedTasks = {};
        for (const task of tasks) {
            let groupByValues = [];
            switch (groupBy) {
                case 'assignees':
                case 'tags':
                case 'custom_fields':
                    groupByValues = (task[groupBy].length > 0 && task[groupBy]) || ['others'];
                    break;
                case 'endDate':
                case 'startDate':
                    if (task[groupBy] !== null) {
                        groupByValues.push(moment(task[groupBy]).format('YYYY-MM-DD'));
                    } else {
                        groupByValues.push('others');
                    }
                    break;
                case 'status':
                    groupByValues.push(task.states[0].workflowStateId);
                    break;
                default:
                    groupByValues.push(task[groupBy]);
                    break;
            }

            for (const value of groupByValues) {
                const groupedValue = groupBy === 'custom_fields' ? value.custom_field_definition_id : value;
                if (!groupedTasks[groupedValue]) {
                    groupedTasks[groupedValue] = [];
                }
                groupedTasks[groupedValue].push(task);
            }
        }
        return groupedTasks as ListTask[];
    }

    async getMany(): Promise<WorkFlowEntity[]> {
        return await this.repo.find({
            relations: {
                Folders: true,
                WorkFlowStates: true,
            },
        });
    }

    async getOne(id: number): Promise<WorkFlowEntity> {
        return await this.repo.findOne({
            where: {id},
            relations: {
                Folders: true,
                WorkFlowStates: true,
            },
        });
    }

    async getOneByFolderId(folderId: number): Promise<WorkFlowEntity> {
        return await this.repo.findOne({
            where: {Folders: {id: In([folderId])}},
            relations: {
                Folders: true,
                WorkFlowStates: true,
            },
        });
    }

    /**
     * Create a new instance of a workflow on a folder.
     * @Returns new folder workflow id
     * @param dto Workflow definition
     */
    @Transactional()
    async createWorkflowWithState(dto: CreateFolderWorkFlowDto): Promise<CreateFolderWorkflowResponseDto> {
        const manager = this.repo.manager;
        const repoWorkflowState = manager.getRepository<WorkFlowStateEntity>(WorkFlowStateEntity);
        // save workflow
        const workflowCreated = await this.repo.save({
            title: dto.title,
            description: dto.description,
            color: dto.color,
        });

        const states: WorkFlowStateEntity[] = [];
        for (const column of dto.states) {
            states.push(
                await repoWorkflowState.save({
                    title: column.title,
                    color: column.color,
                    index: column.index,
                    WorkFlow: {id: workflowCreated.id},
                    code: column.code,
                    completed: column.completed,
                })
            );
            workflowCreated['WorkFlowStates'] = states;
        }
        return workflowCreated as unknown as CreateFolderWorkflowResponseDto;
    }
}
