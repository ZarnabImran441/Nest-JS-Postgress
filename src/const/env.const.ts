import * as dotenv from 'dotenv-flow';
import * as getenv from 'getenv';

if (!process.env.DATABASE_URL) {
    dotenv.config();
}

export const DATABASE_URL = getenv('DATABASE_URL'),
    DATABASE_SCHEMA = getenv('DATABASE_SCHEMA'),
    DB_LOGGING = getenv('DB_LOGGING', 'true'),
    DB_MAX_QUERY_EXECUTION_TIME = getenv.int('DB_MAX_QUERY_EXECUTION_TIME', 1000)
   