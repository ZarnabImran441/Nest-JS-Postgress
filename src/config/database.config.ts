import {BaseDatabaseConfig, DatabaseConfigurationInterface} from '@lib/base-library';
import {DATABASE_SCHEMA, DATABASE_URL, DB_LOGGING, DB_MAX_QUERY_EXECUTION_TIME} from '../const/env.const';
import {UserEntity} from '../model/user.entity';
import {EntitySchema} from 'typeorm';

export const entities: unknown[] = [

    UserEntity
  
];

export const RawDatabaseConfig: DatabaseConfigurationInterface = {
        type: 'postgres',
        schema: DATABASE_SCHEMA,
        logging: DB_LOGGING,
        databaseUrl: DATABASE_URL,
        maxQueryExecutionTime: DB_MAX_QUERY_EXECUTION_TIME,
        entities: entities as EntitySchema[],
        connectionName: 'default',
        retryDelay: 3000,
        retryAttempts: 99999,
    },
    DatabaseConfig = BaseDatabaseConfig(RawDatabaseConfig);
