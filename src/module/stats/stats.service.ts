import {Inject, Injectable} from '@nestjs/common';
import {ABSTRACT_AUTHORIZATION_SERVICE, contructorLogger, JwtPayloadInterface} from '@lib/base-library';
import {StatsMyCountDto} from './dto/stats-my-count.dto';
import {StatsCountDto} from './dto/stats-count.dto';
import {CommentsCountDto, StatsCommentsCountDto} from './dto/stats-comment.dto';
import {StatsApprovalsCountDto} from './dto/stats-approval.dto';
import {StatsTasksByAssigneeCountDto} from './dto/stats-tasks-by-assignee.dto';
import {StatsTasksByMonthCountDto} from './dto/stats-tasks-by-month.dto';
import {DataSource} from 'typeorm';
import * as moment from 'moment';
import {AuthorizationImplService} from '../authorization-impl/authorization-impl.service';
import {EntityTypeOptions, PermissionOptions} from '../authorization-impl/authorization.enum';
import {RawDatabaseConfig} from '../../config/database.config';
import {omit} from 'lodash';

@Injectable()
export class StatsService {
    constructor(
        protected readonly dataSource: DataSource,
        @Inject(ABSTRACT_AUTHORIZATION_SERVICE) protected readonly authorizationImplService: AuthorizationImplService
    ) {
        contructorLogger(this);
    }

    async tasksByMonth(user: JwtPayloadInterface, folders?: number[], year?: number): Promise<StatsTasksByMonthCountDto[]> {
        if (!year) {
            year = moment().year();
        }

        const startOfYear = moment().year(year).startOf('year').format('YYYY-MM-DD');
        const endOfYear = moment().year(year).endOf('year').format('YYYY-MM-DD');

        let authorizedFolders = await this.authorizationImplService.getRecursiveIdsForUser(
            user.id,
            EntityTypeOptions.Folder,
            PermissionOptions.READ
        );

        if (folders?.length > 0) {
            authorizedFolders = authorizedFolders.filter((x) => folders.find((z) => z === x.id));
        }
        const sql = `
SELECT
    CAST(COUNT(T.ID) AS INTEGER) AS NEW,
    CAST(COUNT(CASE WHEN DATE_PART('month', T.completed_at) = DATE_PART('month', M.MONTH) THEN T.ID END) AS INTEGER) AS COMPLETED
FROM GENERATE_SERIES($4, $5, interval '1 month') AS M(MONTH)
    LEFT JOIN "${RawDatabaseConfig.schema}".TASK T ON DATE_PART('month', M.MONTH) = DATE_PART('month', T.START_DATE)
        AND T.ID = ANY ($2) AND DATE_PART('year', T.START_DATE) = $3 AND T.ARCHIVED_AT IS NULL AND T.deleted_at IS NULL
    LEFT JOIN "${RawDatabaseConfig.schema}".TASK_RELATION TR ON T.ID = TR.CHILD_TASK_ID
    LEFT JOIN "${RawDatabaseConfig.schema}".FOLDER F  ON TR.FOLDER_ID = F.ID AND F.ID = ANY($1) AND F.archived_by IS NULL
GROUP BY DATE_PART('month', M.MONTH)
ORDER BY DATE_PART('month', M.MONTH)`;
        const params = [authorizedFolders.map((x) => x.id), [], year, startOfYear, endOfYear];
        return this.dataSource.query(sql, params);
    }

    async tasksByAssignee(
        user: JwtPayloadInterface,
        folders?: number[],
        assignees?: string[],
        from?: Date,
        to?: Date
    ): Promise<StatsTasksByAssigneeCountDto[]> {
        if (!from) {
            from = moment().startOf('month').toDate();
        }
        if (!to) {
            to = moment().endOf('month').toDate();
        }

        let authorizedFolders = await this.authorizationImplService.getRecursiveIdsForUser(
            user.id,
            EntityTypeOptions.Folder,
            PermissionOptions.READ
        );

        if (folders?.length > 0) {
            authorizedFolders = authorizedFolders.filter((x) => folders.find((z) => z === x.id));
        }
        const params: unknown[] = [authorizedFolders.map((x) => x.id), from, to];

        let sql = `
SELECT CAST(COUNT(T.id) AS INTEGER) as assigned, assignee AS "assigneeId", U.first_name AS "assigneeName", CAST(COUNT(T.completed_by) AS INTEGER) AS completed
FROM (SELECT id, created_at, deleted_at, completed_by, archived_at, unnest(assignees) AS assignee FROM "${RawDatabaseConfig.schema}".task) AS T
    LEFT JOIN "${RawDatabaseConfig.schema}".task_relation TR ON T.id = TR.child_task_id
    INNER JOIN "${RawDatabaseConfig.schema}".folder F ON TR.folder_id = F.id AND F.id = ANY($1)
    LEFT JOIN "${RawDatabaseConfig.schema}".user U on U.id::text = T.assignee
WHERE T.ARCHIVED_AT IS NULL AND T.deleted_at IS NULL AND T.created_at BETWEEN $2 AND $3`;

        if (assignees?.length) {
            // filter by assignees
            sql = sql + ` AND T.assignee = ANY($4) `;
            params.push(assignees);
        }
        sql = sql + ` GROUP BY T.assignee, U.first_name`;

        return this.dataSource.query(sql, params);
    }

    async approvals(user: JwtPayloadInterface, folders?: number[], year?: number): Promise<StatsApprovalsCountDto[]> {
        if (!year) {
            year = moment().year();
        }
        let authorizedFolders = await this.authorizationImplService.getRecursiveIdsForUser(
            user.id,
            EntityTypeOptions.Folder,
            PermissionOptions.READ
        );
        if (folders?.length > 0) {
            authorizedFolders = authorizedFolders.filter((x) => folders.find((z) => z === x.id));
        }
        const sql = `SELECT
                        CAST(EXTRACT(MONTH FROM a.CREATED_AT) AS INTEGER) AS month_index,
                        CAST(COALESCE(COUNT(a.*), 0) AS INTEGER) AS NEW,
                        CAST(COALESCE(COUNT(*) FILTER (WHERE status = 'APPROVED' AND EXISTS (
                                    SELECT 1
                                    FROM "${RawDatabaseConfig.schema}".approval ap
                                    WHERE EXTRACT(MONTH FROM ap.RESOLUTION_DATE) = EXTRACT(MONTH FROM a.CREATED_AT)
                        )), 0) AS INTEGER) AS approved,
                        CAST(COALESCE(COUNT(*) FILTER (WHERE status = 'REJECTED' AND EXISTS (
                                    SELECT 1
                                    FROM "${RawDatabaseConfig.schema}".approval ap
                                    WHERE EXTRACT(MONTH FROM ap.RESOLUTION_DATE) = EXTRACT(MONTH FROM a.CREATED_AT)
                        )), 0) AS INTEGER) AS rejected
                    FROM
                    "${RawDatabaseConfig.schema}".approval a
                    INNER JOIN "${RawDatabaseConfig.schema}".task t ON t.id = a.task_id AND t.archived_at IS NULL AND t.deleted_at IS NULL
                    INNER JOIN "${RawDatabaseConfig.schema}".task_relation tr ON tr.child_task_id = a.task_id AND tr.folder_id = ANY($1)
                    WHERE EXTRACT(YEAR FROM a.CREATED_AT) = $2
                    GROUP BY month_index
                    ORDER BY month_index;`;
        const params = [authorizedFolders.map((x) => x.id), year];
        const data = await this.dataSource.query(sql, params);
        const allMonths = Array.from({length: 12}, (_, index) => moment().month(index).format('M'));
        const existingMonths = data.map((item: {month_index: number}) => item.month_index);
        const missingMonths = allMonths.filter((month) => !existingMonths.includes(month));

        // add missing months with zero values in data
        missingMonths.forEach((month) => {
            data.push({
                month_index: month.toString(),
                new: 0,
                approved: 0,
                rejected: 0,
            });
        });

        // Sort the data based on month_index
        data.sort((a: {month_index: string}, b: {month_index: string}) => parseInt(a.month_index) - parseInt(b.month_index));

        // remove month_index finally
        return data.map((item: {month_index: string}) => omit(item, 'month_index'));
    }

    async comments(user: JwtPayloadInterface, folders?: number[], users?: string[], year?: number): Promise<StatsCommentsCountDto[]> {
        if (!year) {
            year = moment().year();
        }
        let authorizedFolders = await this.authorizationImplService.getRecursiveIdsForUser(
            user.id,
            EntityTypeOptions.Folder,
            PermissionOptions.READ
        );
        if (folders?.length > 0) {
            authorizedFolders = authorizedFolders.filter((x) => folders.find((z) => z === x.id));
        }
        const params: unknown[] = [authorizedFolders.map((x) => x.id), [], year];

        let sql = `SELECT AP.user_id AS "assigneeId",U.FIRST_NAME AS "assigneeName" ,CAST(COUNT(TA.ID) AS INTEGER) AS comments,CAST(DATE_PART('month', TA.DATE) AS INTEGER) as MONTH FROM "${RawDatabaseConfig.schema}".FOLDER F
                                    INNER JOIN "${RawDatabaseConfig.schema}".ASSIGNED_PERMISSION AP
                                    ON AP.ENTITY_ID = F.ID::TEXT AND F.ID = any($1)
                                    INNER JOIN "${RawDatabaseConfig.schema}".TASK_RELATION TR ON F.ID = TR.FOLDER_ID
                                    INNER JOIN "${RawDatabaseConfig.schema}".TASK_ACTION TA ON TR.CHILD_TASK_ID = TA.TASK_ID
                                    AND TR.CHILD_TASK_ID = any($2)
                                    AND DATE_PART('year', TA.DATE) = $3
                                    AND AP.USER_ID = (TA.USER->>'id')  `;

        if (users?.length) {
            sql = sql + `AND AP.USER_ID = ANY($4)`;
            params.push(users);
        }
        sql =
            sql +
            `LEFT join "${RawDatabaseConfig.schema}".USER U on U.ID::text = AP.USER_ID::text
                                WHERE AP.ENTITY_TYPE = 'folder' AND TA.ACTION = 'comment'
                                GROUP BY AP.user_id,U.FIRST_NAME,DATE_PART('month', TA.DATE) ORDER BY AP.user_id`;

        const result = await this.dataSource.query(sql, params);

        const groupedData = result.reduce((acc: {[key: number]: Array<CommentsCountDto>}, item: CommentsCountDto) => {
            const month = item.month;
            if (!acc[month]) {
                acc[month] = [];
            }
            acc[month].push(item);
            return acc;
        }, {});

        return Array.from({length: 12}, (_, index) => ({
            month: index + 1,
            data: groupedData[index + 1] || [],
        }));
    }

    async counts(): Promise<StatsCountDto[]> {
        const ret: StatsCountDto[] = [];

        const folderQuery = this.dataSource
            .query(
                `SELECT CAST(COUNT(CASE WHEN DATE_PART('month', F.START_DATE) = DATE_PART('month', CURRENT_DATE) THEN 1 END) AS INTEGER) AS "currentMonth",
                                    CAST(COUNT(CASE WHEN DATE_PART('month', F.START_DATE) = DATE_PART('month', CURRENT_DATE) - 1 THEN 1 END)AS INTEGER) AS "prevMonth",
                                    CAST(COUNT(CASE WHEN DATE_PART('month', F.START_DATE) < DATE_PART('month', CURRENT_DATE) - 1 THEN 1 END) AS INTEGER) AS "pastMonths"
                                FROM
                                    "${RawDatabaseConfig.schema}".folder F
                                    INNER JOIN "${RawDatabaseConfig.schema}".assigned_permission AP ON AP.entity_id = F.ID::text
                                WHERE
                                    AP.banned = false
                                    AND AP.entity_type = $1
                                    AND (AP.permissions & $2) > 0
                                    AND F.archived_by IS NULL
                                    AND DATE_PART('year', F.START_DATE) = DATE_PART('year', CURRENT_DATE)`,
                [EntityTypeOptions.Folder, PermissionOptions.OWNER]
            )
            .then((res) => ret.push({...res[0], title: 'New folders'}));

        const tasksQuery = this.dataSource
            .query(
                `SELECT CAST(COUNT(CASE WHEN DATE_PART('month', T.START_DATE) = DATE_PART('month', CURRENT_DATE) THEN 1 END) AS INTEGER) AS "currentMonth",
                            CAST(COUNT(CASE WHEN DATE_PART('month', T.START_DATE) = DATE_PART('month', CURRENT_DATE) - 1 THEN 1 END)AS INTEGER) AS "prevMonth",
                            CAST(COUNT(CASE WHEN DATE_PART('month', T.START_DATE) < DATE_PART('month', CURRENT_DATE) - 1 THEN 1 END) AS INTEGER) AS "pastMonths"
                        FROM "${RawDatabaseConfig.schema}".TASK T
                        WHERE T.archived_at IS NULL AND T.deleted_at IS NULL AND DATE_PART('year', T.START_DATE) = DATE_PART('year', CURRENT_DATE)`
            )
            .then((res) => ret.push({...res[0], title: 'New Tasks'}));

        const tasksCompletedQuery = this.dataSource
            .query(
                `SELECT CAST(COUNT(CASE WHEN DATE_PART('month', T.COMPLETED_AT) = DATE_PART('month', CURRENT_DATE) THEN 1 END) AS INTEGER) AS "currentMonth",
                                CAST(COUNT(CASE WHEN DATE_TRUNC('month', T.COMPLETED_AT) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1' MONTH) THEN 1 END) AS INTEGER) AS "lastMonth",
                                CAST(COUNT(CASE WHEN DATE_TRUNC('month', T.COMPLETED_AT) < DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1' MONTH) THEN 1 END) AS INTEGER) AS "prevMonths"
                            FROM
                                "${RawDatabaseConfig.schema}".TASK T
                            WHERE
                                T.COMPLETED_AT IS NOT NULL
                                AND T.archived_at IS NULL
                                AND T.deleted_at IS NULL
                                AND DATE_PART('year', T.COMPLETED_AT) = DATE_PART('year', CURRENT_DATE);`,
                []
            )
            .then((res) => ret.push({...res[0], title: 'Completed Tasks'}));

        const tasksAttachmentsQuery = this.dataSource
            .query(
                `SELECT CAST(COUNT(CASE WHEN DATE_PART('month', TA.ADDED_AT) = DATE_PART('month', CURRENT_DATE) THEN 1 END) AS INTEGER) AS "currentMonth",
                        CAST(COUNT(CASE WHEN DATE_TRUNC('month', TA.ADDED_AT) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1' MONTH) THEN 1 END) AS INTEGER) AS "lastMonth",
                        CAST(COUNT(CASE WHEN DATE_TRUNC('month', TA.ADDED_AT) < DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1' MONTH) THEN 1 END) AS INTEGER) AS "prevMonths"
                    FROM
                        "${RawDatabaseConfig.schema}".task_attachment TA
                    WHERE DATE_PART('year', TA.ADDED_AT) = DATE_PART('year', CURRENT_DATE);`,
                []
            )
            .then((res) => ret.push({...res[0], title: 'Attachments'}));

        const taskCommentsQuerys = this.dataSource
            .query(
                `SELECT CAST(COUNT(CASE WHEN DATE_PART('month', TA.DATE) = DATE_PART('month', CURRENT_DATE) THEN 1 END) AS INTEGER) AS "currentMonth",
                            CAST(COUNT(CASE WHEN DATE_TRUNC('month', TA.DATE) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1' MONTH) THEN 1 END) AS INTEGER) AS "lastMonth",
                            CAST(COUNT(CASE WHEN DATE_TRUNC('month', TA.DATE) < DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1' MONTH) THEN 1 END) AS INTEGER) AS "prevMonths"
                            FROM
                            "${RawDatabaseConfig.schema}".task_action TA
                        WHERE DATE_PART('year', TA.DATE) = DATE_PART('year', CURRENT_DATE) AND TA.ACTION='comment';`,
                []
            )
            .then((res) => ret.push({...res[0], title: 'Comments'}));

        const approvalsQuery = this.dataSource
            .query(
                `SELECT CAST(COUNT(CASE WHEN DATE_PART('month', A.CREATED_AT) = DATE_PART('month', CURRENT_DATE) THEN 1 END) AS INTEGER) AS "currentMonth",
                        CAST(COUNT(CASE WHEN DATE_TRUNC('month', A.CREATED_AT) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1' MONTH) THEN 1 END) AS INTEGER) AS "lastMonth",
                        CAST(COUNT(CASE WHEN DATE_TRUNC('month', A.CREATED_AT) < DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1' MONTH) THEN 1 END) AS INTEGER) AS "prevMonths"
                    FROM
                        "${RawDatabaseConfig.schema}".approval A
                    WHERE DATE_PART('year', A.CREATED_AT) = DATE_PART('year', CURRENT_DATE);`,
                []
            )
            .then((res) => ret.push({...res[0], title: 'Approvals'}));

        await Promise.all([folderQuery, tasksQuery, tasksCompletedQuery, tasksAttachmentsQuery, taskCommentsQuerys, approvalsQuery]);
        return ret;
    }

    async myCounts(user: JwtPayloadInterface): Promise<StatsMyCountDto> {
        const ret = new StatsMyCountDto();
        // ** current month */
        // It starts from 0 = Jan and Dec = 11
        const currentMonth = moment().month();

        const folderQuery = this.dataSource
            .query(
                `
SELECT CAST(COUNT(F.ID) AS INTEGER) AS count FROM "${RawDatabaseConfig.schema}".folder F
INNER JOIN "${RawDatabaseConfig.schema}".assigned_permission AP
    ON AP.entity_id = F.ID::text AND AP.user_id = $1 AND AP.banned = false AND AP.entity_id = F.id::text
        AND DATE_PART('month', F.START_DATE) = $4 AND AP.entity_type = $2 AND (AP.permissions & $3) > 0 AND F.archived_by IS NULL`,
                [user.id, EntityTypeOptions.Folder, PermissionOptions.OWNER, currentMonth + 1]
            )
            .then((res) => (ret.folders = res[0].count));

        const taskQuery = this.dataSource
            .query(
                `
SELECT CAST(COUNT(T.id) AS INTEGER) AS count FROM "${RawDatabaseConfig.schema}".task T
WHERE T.user_id = $1 AND DATE_PART('month', T.start_date) = $2 AND T.archived_at IS NULL AND T.deleted_at IS NULL`,
                [user.id, currentMonth + 1]
            )
            .then((res) => (ret.tasks = res[0].count));

        const approvalQuery = this.dataSource
            .query(
                `SELECT CAST(COUNT(A.ID) AS INTEGER) AS count FROM "${RawDatabaseConfig.schema}".approval A
                INNER JOIN "${RawDatabaseConfig.schema}".task T ON T.id = A.task_id AND T.archived_at IS NULL AND T.deleted_at IS NULL
                WHERE A.CREATED_BY = $1 AND DATE_PART('month', A.CREATED_AT) = $2`,
                [user.id, currentMonth + 1]
            )
            .then((res) => (ret.approvals = res[0].count));

        const attachmentQuery = this.dataSource
            .query(
                `SELECT CAST(COUNT(TA.ID) AS INTEGER) AS count FROM "${RawDatabaseConfig.schema}".task_attachment TA
                INNER JOIN "${RawDatabaseConfig.schema}".task T ON T.id = TA.task_id AND T.archived_at IS NULL AND T.deleted_at IS NULL
                WHERE TA.added_by = $1 AND DATE_PART('month', TA.ADDED_AT) = $2`,
                [user.id, currentMonth + 1]
            )
            .then((res) => (ret.attachments = res[0].count));

        const commentsQuery = this.dataSource
            .query(
                `SELECT CAST(COUNT(TA.ID) AS INTEGER) AS count FROM "${RawDatabaseConfig.schema}".task_action TA
                    INNER JOIN "${RawDatabaseConfig.schema}".task T ON T.id = TA.task_id AND T.archived_at IS NULL AND T.deleted_at IS NULL
                    WHERE (TA.USER->>'id') = $1 AND DATE_PART('month', TA.date) = 12 AND TA.ACTION = 'comment'`,
                [user.id]
            )
            .then((res) => (ret.comments = res[0].count));

        await Promise.all([folderQuery, taskQuery, approvalQuery, attachmentQuery, commentsQuery]);
        return ret;
    }
}
