import {GenericUserLoginDto, JwtUserInterface} from '@lib/base-library';
import {HttpStatus, INestApplication, Logger, Type} from '@nestjs/common';
import {InjectDataSource} from '@nestjs/typeorm';
import {PasLoginResponseInterface, TestAttachmentInterface} from '@test-lib/test-base-library';
import * as request from 'supertest';
import {Test as TestResponse} from 'supertest';
import {DataSource} from 'typeorm';
// import './expect-extender';

export class NewBaseTest {
    public app: INestApplication;
    public url: string;
    private readonly baseLogger = new Logger(NewBaseTest.name);

    @InjectDataSource()
    dataSource: DataSource;

    public setApp(app: INestApplication): void {
        this.app = app;
    }

    public setUrl(url: string): void {
        this.url = url;
    }

    public getDataSource(): DataSource {
        return this.dataSource;
    }

    /**
     * Extracts the user ID from the given access token.
     * @param {string} accessToken - The access token string.
     * @returns {string} - The user ID extracted from the access token.
     */
    protected getUserIdFromAccessToken(accessToken: string): string {
        const [header, payload] = accessToken.split('.');

        // They're base64 encoded.
        const decodedPayload = Buffer.from(payload, 'base64').toString('utf-8');
        const decodedHeader = Buffer.from(header, 'base64').toString('utf-8');

        this.baseLogger.verbose(decodedHeader);

        // Here's what it looks like.
        this.baseLogger.verbose(decodedPayload);

        // The Payload will have a 'kid' field
        // This identifies the key we need to use to verify the signature.
        const sub = JSON.parse(decodedPayload).sub;
        this.baseLogger.verbose(sub);
        return sub;
    }

    public getService<T>(service: Type<T> | string): T {
        return this.app.get<T>(service);
    }

    /**
     * Performs a GET request to the specified URL.
     *
     * @param {string} url - The URL to send the GET request to.
     * @param {string} [jwtToken] - Optional JWT token to include in the request headers.
     *
     * @returns {TestResponse} - A TestResponse object representing the response to the GET request.
     */
    public get(url: string, jwtToken?: string): TestResponse {
        const ret = request(this.app.getHttpServer()).get(this.formatUrl(url));
        if (jwtToken) {
            void ret.set('Authorization', 'Bearer ' + jwtToken);
        }
        return ret;
    }

    /**
     * Makes an HTTP POST request with optional data and JWT token.
     *
     * @param {string} url - The URL to send the POST request to.
     * @param {object} [body] - Optional data to send with the request.
     * @param {string} [jwtToken] - Optional JWT token for authentication.
     * @param {TestAttachmentInterface[]} [attachments] - Optional array of attachments to include in the request.
     * @returns {TestResponse} - The response from the POST request.
     */
    public post(url: string, body: object = null, jwtToken: string = null, attachments: TestAttachmentInterface[] = []): TestResponse {
        const ret = request(this.app.getHttpServer()).post(this.formatUrl(url));
        if (body) {
            void ret.send(body);
        }
        if (jwtToken) {
            void ret.set('Authorization', 'Bearer ' + jwtToken);
        }
        if (attachments.length > 0) {
            for (const attachment of attachments) {
                void ret.attach(attachment.name, attachment.buffer, attachment.path);
            }
        }
        return ret;
    }

    /**
     * Sends a PUT request to the specified URL with optional data and JWT token.
     *
     * @param {string} url - The URL to send the request to.
     * @param {object} [data] - The data to send along with the request (optional).
     * @param {string} [jwtToken] - The JWT token to include in the Authorization header (optional).
     * @returns {TestResponse} - The response object received from the server.
     */
    public put(url: string, data?: object, jwtToken?: string): TestResponse {
        const ret = request(this.app.getHttpServer()).put(this.formatUrl(url));
        if (data) {
            void ret.send(data);
        }
        if (jwtToken) {
            void ret.set('Authorization', 'Bearer ' + jwtToken);
        }
        return ret;
    }

    /**
     * Sends a PATCH request to the specified URL with optional data and JWT token.
     *
     * @param {string} url - The URL to send the PATCH request to.
     * @param {object} [data] - Optional data to send with the request.
     * @param {string} [jwtToken] - Optional JWT token to include in the request header.
     * @return {TestResponse} - The response received from the server.
     */
    public patch(url: string, data?: object, jwtToken?: string): TestResponse {
        const ret = request(this.app.getHttpServer()).patch(this.formatUrl(url));
        if (data) {
            void ret.send(data);
        }
        if (jwtToken) {
            void ret.set('Authorization', 'Bearer ' + jwtToken);
        }
        return ret;
    }

    /**
     * Deletes a resource at the given URL.
     *
     * @param {string} url - The URL of the resource to be deleted.
     * @param {string} [jwtToken] - The JWT token used for authentication.
     *
     * @returns {TestResponse} - The response object of the delete request.
     */
    public delete(url: string, jwtToken?: string): TestResponse {
        const ret = request(this.app.getHttpServer()).delete(this.formatUrl(url));
        if (jwtToken) {
            void ret.set('Authorization', 'Bearer ' + jwtToken);
        }
        return ret;
    }

    private formatUrl(url: string): string {
        if (url.startsWith('/')) {
            return url;
        }
        if (url.length > 0) {
            return `${this.url}/${url}`;
        }
        return this.url;
    }

    async logUser(dto: GenericUserLoginDto): Promise<PasLoginResponseInterface> {
        const resp = await this.post(`/pas-authentication/login`, dto).expect(HttpStatus.CREATED);
        return resp.body;
    }

    protected getUserInfoFromAccessToken(accessToken: string): {name: string; id: string} {
        const [, payload] = accessToken.split('.');

        const decodedPayload = Buffer.from(payload, 'base64').toString('utf-8');

        const user: JwtUserInterface = JSON.parse(decodedPayload);
        return {
            name: `${user.firstName} ${user.lastName}`,
            id: JSON.parse(decodedPayload).sub,
        };
    }
}
