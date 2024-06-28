module.exports = {
    verbose: true,
    moduleFileExtensions: ['js', 'json', 'ts'],
    rootDir: '..',
    testEnvironment: 'node',
    transform: {
        '^.+\\.(t|j)s$': ['ts-jest', {isolatedModules: true}],
    },
    testMatch: ['<rootDir>/test-e2e/**/*.e2e-spec.ts'],
    coverageDirectory: '../../coverage/task-management',
    roots: ['<rootDir>/../../apps/', '<rootDir>/../../libs/'],
    moduleNameMapper: {
        '^@lib/base-library(|/.*)$': '<rootDir>/../../libs/base-library/src/$1',
        '^@lib/automations-library(|/.*)$': '<rootDir>/../../libs/automations-library/src/$1',
        '^@test-lib/test-base-library(|/.*)$': '<rootDir>/../../libs/test-base-library/src/$1',
    },
    testTimeout: 60000,
    reporters: [
        [
            'default',
            {
                summaryThreshold: 1,
            },
        ],
    ],
};
