import {RawDatabaseConfig} from '../config/database.config';

export const queries = {
    folderTree: (spaceIds: number[]): string => `
WITH RECURSIVE FOLDERS AS (
    SELECT 
        F.id,
        FR.parent_folder_id,
        FR.is_bind,
        0 AS depth,
        FR.id AS fr_id
		FROM "${RawDatabaseConfig.schema}"."folder" F
		    INNER JOIN "${RawDatabaseConfig.schema}"."folder_relation" FR ON FR.child_folder_id = F.id
		WHERE F.id IN (${spaceIds.join(',')}) AND F.folder_type = 'space'
UNION ALL
    SELECT
        F.id,
		    FR.parent_folder_id,
        FR.is_bind,
        FS.depth + 1 AS depth,
        FR.id AS fr_id        
		FROM "${RawDatabaseConfig.schema}".folder F
        INNER JOIN "${RawDatabaseConfig.schema}".folder_relation FR ON FR.child_folder_id = F.id
        INNER JOIN FOLDERS FS ON FR.parent_folder_id = FS.id) 
cycle id
SET is_cycle USING path
SELECT 
    id,
    parent_folder_id,
    depth,
    fr_id,
    is_bind,
    path
FROM FOLDERS FS
`,

    taskTree: `
    WITH RECURSIVE TASKS AS
      (SELECT T.ID,
        			TR.FOLDER_ID,
        			TR.PARENT_TASK_ID,
        			TR.CHILD_TASK_ID
        FROM "${RawDatabaseConfig.schema}".task T
        INNER JOIN "${RawDatabaseConfig.schema}".task_relation TR ON TR.CHILD_TASK_ID = T.ID
        		AND TR.PARENT_TASK_ID IS NULL
		UNION ALL 
		    SELECT T.ID,
          TR.FOLDER_ID,
          TR.PARENT_TASK_ID,
          TR.CHILD_TASK_ID
        FROM "${RawDatabaseConfig.schema}".task T
        INNER JOIN "${RawDatabaseConfig.schema}".task_relation TR ON TR.CHILD_TASK_ID = T.ID
        INNER JOIN TASKS TS ON TR.PARENT_TASK_ID = TS.ID
        AND TR.FOLDER_ID = TS.FOLDER_ID) CYCLE ID
    SET IS_CYCLE USING PATH
    SELECT TASKS.ID,
      FOLDER_ID,
      PARENT_TASK_ID,
      CHILD_TASK_ID,
      ARRAY_TO_STRING(PATH,',') AS PATH
        FROM TASKS
`,
    // TODO : remove not used props
    folder: `
SELECT
	F.ID,
	F.TITLE,
	F.DESCRIPTION,
	F.COLOR,
	F.ARCHIVED_AT AS "archivedAt",
	F.ARCHIVED_BY AS "archivedBy",
	F.ARCHIVED_WHY AS "archivedWhy",
	F.DELETED_AT AS "deletedAt",
	F.DELETED_BY AS "deletedBy",
	F.CREATED_AT AS "createdAt",
	F.CREATED_BY AS "createdBy",
	F.UPDATED_AT AS "updatedAt",
	F.UPDATED_BY AS "updatedBy",
	F.START_DATE AS "startDate",
	F.END_DATE AS "endDate",
	F.DEFAULT_VIEW AS "defaultView",
	F.VIEW_TYPE AS "viewType",
	F.FOLDER_TYPE AS "folderType",
    F.icon,
	F.USER_ID AS "ownerId",
	F.AVAILABLE_VIEWS AS "availableViews",
	F.SHOW_ON AS "showOn",
	F.space_picture_url AS "pictureUrl",
	CASE
		WHEN EXISTS (
			SELECT
				FF.ID
			FROM
				"${RawDatabaseConfig.schema}".FOLDER_FAVOURITE FF
			WHERE
				FF.FOLDER_ID = F.ID
				AND FF.USER_ID = $1
		) THEN TRUE
		ELSE FALSE
	END AS "isFavourite",
	(
		SELECT
			ARRAY(
				SELECT
					FR.PARENT_FOLDER_ID
				FROM
					"${RawDatabaseConfig.schema}".FOLDER_RELATION FR
				WHERE
					FR.CHILD_FOLDER_ID = F.ID
					AND FR.PARENT_FOLDER_ID IS NOT NULL
			)
	) AS BINDS,
	(
		SELECT
			JSON_AGG(X)
		FROM
			(
				SELECT
					FU.USER_ID AS "userId",
					FU.USER_PERMISSION AS "userPermission",
					FU.INHERIT
				FROM
					"${RawDatabaseConfig.schema}".FOLDER_USER_AP FU
				WHERE
					FU.FOLDER_ID = F.ID AND (FU.ENTITY_TYPE = 'folder' OR FU.ENTITY_TYPE = 'space') 
			) AS X
	) AS MEMBERS,
	(
    SELECT
        JSON_AGG(X)
    FROM
        (
            SELECT
                R.id,
                R.code,
                R.active,
                R.description,
                FST.team_permissions as "teamPermission",
                JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'id', UR.user_id,
                        'userPermissions', FU.USER_PERMISSION
                    )
                ) as members
            FROM
                "${RawDatabaseConfig.schema}".FOLDER_SPACE_TEAMS FST
                INNER JOIN "${RawDatabaseConfig.schema}".ROLE R ON FST.TEAM_ID = R.ID
                INNER JOIN "${RawDatabaseConfig.schema}".USER_ROLE UR ON UR.ROLE_ID = R.ID
                INNER JOIN "${RawDatabaseConfig.schema}".FOLDER_USER_AP FU ON FU.USER_ID = UR.USER_ID
            WHERE
                FST.FOLDER_ID = F.ID AND FU.FOLDER_ID = F.ID AND (FU.ENTITY_TYPE = 'folder' OR FU.ENTITY_TYPE = 'space') 
            GROUP BY R.id, R.code, R.active, R.description, FST.team_permissions
        ) AS X
        ) AS TEAMS,
	(
		SELECT
			JSON_AGG(X)
		FROM
			(
				SELECT
					W.*,
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
								FROM
									"${RawDatabaseConfig.schema}".WORKFLOW_STATE WS
								WHERE
									WS.WORKFLOW_ID = W.ID
								ORDER BY
									WS.INDEX
							) AS X
					) AS STATES
				FROM
					"${RawDatabaseConfig.schema}".FOLDER_SPACE_WORKFLOW FSW
					INNER JOIN "${RawDatabaseConfig.schema}".WORKFLOW W ON FSW.WORKFLOW_ID = W.ID
				WHERE
					FSW.FOLDER_ID = F.ID
			) AS X
	) AS "availableWorkflows",
	(
		SELECT
			JSON_AGG(X)
		FROM
			(
				SELECT
					CFC.*
				FROM
					"${RawDatabaseConfig.schema}".FOLDER_SPACE_CUSTOM_FIELD_COLLECTION FSCF
					INNER JOIN "${RawDatabaseConfig.schema}".CUSTOM_FIELD_COLLECTION CFC ON FSCF.CUSTOM_FIELD_COLLECTION_ID = CFC.ID
				WHERE
					FSCF.FOLDER_ID = F.ID
			) AS X
	) AS "customFieldsCollections",
	(
		SELECT
			JSON_AGG(X)
		FROM
			(
				SELECT
					FSTF.*
				FROM
					"${RawDatabaseConfig.schema}".FOLDER_SPACE_TAGS_COLLECTION FSTF
					INNER JOIN "${RawDatabaseConfig.schema}".TAG_COLLECTION TC ON FSTF.TAGS_COLLECTION_ID = TC.ID
				WHERE
					FSTF.FOLDER_ID = F.ID
			) AS X
	) AS "tagsCollections",
	(
		SELECT
			ARRAY(
				SELECT
					LF.TAG_ID
				FROM
					"${RawDatabaseConfig.schema}".TAGS_TASK_FOLDER LF
					INNER JOIN TAGS L ON L.ID = LF.TAG_ID
				WHERE
					LF.FOLDER_ID = F.ID
			)
	) AS TAGS,
	(
		SELECT
			COALESCE(JSON_AGG(X), '[]')
		FROM
			(
				SELECT
					CF.ID,
					CF.VALUE,
					CF.INDEX,
					(
						SELECT
							ROW_TO_JSON(X)
						FROM
							(
								SELECT
									CFD.ID,
									CFD.TITLE,
									CFD.TYPE,
									CFD.SETTING,
									CFD.USER_ID AS "userId"
								FROM
									"${RawDatabaseConfig.schema}".CUSTOM_FIELD_DEFINITION CFD
								WHERE
									CF.CUSTOM_FIELD_DEFINITION_ID = CFD.ID
							) AS X
					) AS "CustomFieldDefinition"
				FROM
					"${RawDatabaseConfig.schema}".CUSTOM_FIELD_VALUE CF
				WHERE
					CF.FOLDER_ID = F.ID
			) AS X
	) AS "customFields",
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
								FROM
									"${RawDatabaseConfig.schema}".WORKFLOW_STATE WS
								WHERE
									WS.WORKFLOW_ID = W.ID
								ORDER BY
									WS.INDEX
							) AS X
					) AS STATES
				FROM
					"${RawDatabaseConfig.schema}".WORKFLOW W
				WHERE
					F.WORKFLOW_ID = W.ID
			) AS X
	) AS WORKFLOW
FROM
	"${RawDatabaseConfig.schema}".FOLDER F
`,

    getSpaceWithFolderIdSql: `
		WITH RECURSIVE FOLDERS AS
						(
							SELECT F.ID,
								FR.PARENT_FOLDER_ID,
								FR.CHILD_FOLDER_ID
							FROM "${RawDatabaseConfig.schema}".FOLDER F
							INNER JOIN "${RawDatabaseConfig.schema}".FOLDER_RELATION FR ON F.ID = FR.CHILD_FOLDER_ID
							WHERE F.ID = $1
							AND F.archived_by IS NULL and f.deleted_by IS NULL
				
							UNION ALL
				
							SELECT F.ID,
								FR.PARENT_FOLDER_ID,
								FR.CHILD_FOLDER_ID
							FROM "${RawDatabaseConfig.schema}".FOLDER F
							INNER JOIN "${RawDatabaseConfig.schema}".FOLDER_RELATION FR ON F.ID = FR.CHILD_FOLDER_ID
							INNER JOIN FOLDERS FS ON FS.PARENT_FOLDER_ID = F.ID 
							WHERE F.archived_by IS NULL and f.deleted_by IS NULL
						)
						SELECT F.ID
						FROM "${RawDatabaseConfig.schema}".FOLDER F
						INNER JOIN FOLDERS FS ON FS.CHILD_FOLDER_ID = F.ID
						WHERE FS.PARENT_FOLDER_ID IS NULL
	`,
};
