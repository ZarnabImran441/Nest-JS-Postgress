import {HttpStatus, Logger, OnModuleInit} from '@nestjs/common';
import {Test, TestSuite} from 'nestjs-jest-decorators';
import {NewBaseTest} from './base-test';

@TestSuite('Service Version Suite')
export class ServiceVersionE2eSpec extends NewBaseTest implements OnModuleInit {
    private readonly logger = new Logger(ServiceVersionE2eSpec.name);

    onModuleInit(): void {
        this.setUrl('/service-version');
    }

    //Todo : Test case for workflow change and custom field's
    @Test('Getting service version')
    async getServiceVersion(): Promise<void> {
        this.logger.log('Getting service version');
        const {body: version} = await this.get(``).expect(HttpStatus.OK);
        expect(version.branch).toBeDefined();
        expect(version.buildNumber).toBeDefined();
        expect(version.commit).toBeDefined();
        expect(version.date).toBeDefined();
        expect(version.deploymentEnvironment).toBeDefined();
    }
}
