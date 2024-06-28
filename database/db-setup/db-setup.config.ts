import {RawDatabaseConfig} from '../../src/config/database.config';

module.exports = {
    type: 'postgres',
    url: RawDatabaseConfig.databaseUrl,
    logging: RawDatabaseConfig.logging,
    schema: RawDatabaseConfig.schema,
    entities: RawDatabaseConfig.entities,
    seeds: ['./apps/task-management/database/db-setup/db-setup.ts'],
};
