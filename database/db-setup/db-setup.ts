import {DataSource} from 'typeorm';
import {Factory, Seeder} from 'typeorm-seeding';
import {DATABASE_SCHEMA} from '../../src/const/env.const';

export default class DbSetup implements Seeder {
    async run(factory: Factory, connection: DataSource): Promise<void> {
        await connection.query(`DROP SCHEMA IF EXISTS "${DATABASE_SCHEMA}" CASCADE`);
        await connection.query(`CREATE SCHEMA "${DATABASE_SCHEMA}"`);
        await connection.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA "${DATABASE_SCHEMA}"`);
        await connection.query(`CREATE EXTENSION IF NOT EXISTS "pg_trgm" SCHEMA "${DATABASE_SCHEMA}"`);
    }
}
