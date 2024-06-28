import {ApiProperty} from '@nestjs/swagger';
import {IsString, MaxLength} from 'class-validator';

/**
 * Represents a request DTO for getting an authentication token.
 *
 * @class
 */
export class GetAuthTokenRequestDto {
    /**
     * Represents a string variable.
     *
     * @type {string}
     * @description A string variable is a sequence of characters wrapped in single quotes.
     *              It can store and manipulate textual data.
     *
     * @example
     * let myString = 'Hello, World!';
     *
     * console.log(myString); // Output: Hello, World!
     * console.log(typeof myString); // Output: string
     */
    @ApiProperty({
        description: 'The unique identifier for a code',
        example: 'CODE1234',
        required: true,
        type: 'string',
        maxLength: 20,
        minLength: 3,
    })
    @IsString()
    @MaxLength(64)
    code: string;

    /**
     * Represents a code verifier.
     * @typedef {string} CodeVerifier
     */
    @ApiProperty({
        description: 'The code verifier for the user session.',
        type: 'string',
        required: true,
    })
    @IsString()
    @MaxLength(64)
    codeVerifier: string;
}

/**
 * Represents the response payload for the getAuthToken API.
 */
export class GetAuthTokenResponseDto {
    /**
     * Access Token
     *
     * @typedef {string} AccessToken
     * @description Represents an access token used for authentication and authorization.
     *
     */
    @ApiProperty({
        description: 'Represents an access token used for authentication.',
        example:
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    })
    accessToken: string;

    /**
     * Represents a refresh token for authentication.
     *
     * @typedef {string} refreshToken
     */
    @ApiProperty({
        description: 'Represents a refresh token.',
        example: 'example-refresh-token',
    })
    refreshToken: string;

    /**
     * Represents an identifier of type string.
     *
     * @typedef {string} ID
     */
    @ApiProperty({
        description: 'Represents the unique identifier for an entity.',
        example: 'example-id',
    })
    id: string;
}
