import {DataSource} from 'typeorm';
import {RawDatabaseConfig} from '../src/config/database.config';

export const AppDataSource = new DataSource({
    type: 'postgres',
    url: RawDatabaseConfig.databaseUrl,
    schema: RawDatabaseConfig.schema,
    entities: RawDatabaseConfig.entities,
    migrationsTableName: 'custom_migration_table',
    migrations: ['./database/migrations/*.ts'],
});
