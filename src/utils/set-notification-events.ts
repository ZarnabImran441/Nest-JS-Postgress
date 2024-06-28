import * as fs from 'fs';
import * as path from 'path';
import {ChannelTypeOptions, TemplateAreaOptions, TemplateDto} from '@lib/base-library';
import {FolderEventNameOptions, TaskEventNameOptions} from '../enum/notification-event.enum';
import {EVENT_TEMPLATES_PATH} from '../const/env.const';
import {NotificationTypeOptions} from '../module/notifications-api-connector/notification-api-connector.service';

/**
 * Represents the structure of event templates organized by entity.
 *
 * @interface EventTemplatesByEntityInterface
 */
export interface EventTemplatesByEntityInterface {
    /**
     * Represents a folder with its header, footer, body, and actions.
     * @typedef {Object} Folder
     * @property {string | null} header - The header of the folder.
     * @property {string | null} footer - The footer of the folder.
     * @property {string | null} body - The body of the folder.
     * @property {Record<FolderEventNameOptions, string | null>} actions - The actions available for the folder.
     */
    folder: {
        header: string | null;
        footer: string | null;
        body: string | null;
        actions: Record<FolderEventNameOptions, string | null>;
    };
    /**
     * Represents a task with a header, footer, body, and actions.
     *
     * @typedef {Object} Task
     * @property {string | null} header - The header of the task.
     * @property {string | null} footer - The footer of the task.
     * @property {string | null} body - The body of the task.
     * @property {Record<TaskEventNameOptions, string | null>} actions - The actions associated with the task.
     */
    task: {
        header?: string | null;
        footer?: string | null;
        body: string | null;
        actions: Record<TaskEventNameOptions, string | null>;
    };
}

/**
 * Class for managing event templates.
 */
export class EventsTemplatesUtils {
    /**
     * Sets the default events for a given application name.
     *
     * @param {string} appName - The name of the application.
     * @return {TemplateDto[]} An array of TemplateDto objects representing the default events.
     */
    setDefaultEvents(appName: string): TemplateDto[] {
        const features: EventTemplatesByEntityInterface = {
            folder: {
                header: 'folder-header.html',
                footer: 'folder-footer.html',
                body: 'folder-body.html',
                actions: {
                    'notification-folder-update': 'folder-update.html',
                    'notification-folder-set-owner': 'folder-owner.html',
                    'notification-folder-create': null,
                    'notification-folder-delete': null,
                    'notification-folder-archive': null,
                    'notification-folder-restore-archive': null,
                    'notification-folder-add-member': 'folder-member.html',
                    'notification-folder-update-member': null,
                    'notification-folder-remove-member': null,
                    'notification-folder-copy': null,
                    'notification-folder-stream-update': null,
                } as unknown as Record<FolderEventNameOptions, string | null>,
            },
            task: {
                body: 'task-body.html',
                actions: {
                    'notification-task-create': null,
                    'notification-task-update': 'task-update.html',
                    'notification-task-delete': null,
                    'notification-task-add-attach': 'task-add-attach.html',
                    'notification-task-del-attach': null,
                    'notification-task-move': 'task-update.html',
                    'notification-task-assign': 'task-assign.html',
                    'notification-task-tag': null,
                    'notification-task-comment': 'task-comment.html',
                    'notification-task-stream-update': null,
                    'notification-task-unassign': 'task-update.html',
                    'notification-task-approval-created': null,
                    'notification-task-approval-updated': null,
                    'notification-task-approval-deleted': null,
                    'notification-task-approval-approved': null,
                    'notification-task-approval-rejected': null,
                    'notification-task-approval-rerouted': null,
                    'notification-task-approval-attachment-added': null,
                    'notification-task-approval-attachment-deleted': null,
                    'notification-task-archive': null,
                    'notification-task-unarchive': null,
                    'notification-task-restore': null,
                } as unknown as Record<TaskEventNameOptions, string | null>,
            },
        };

        const templates: TemplateDto[] = this.setEmailDefaultEvents(features, appName);
        const wsTemplates = this.setWebsocketDefaultEvents(features, appName);

        templates.push(...wsTemplates);
        // Set unread notifications event
        templates.push({
            appName,
            name: NotificationTypeOptions.UNREAD_NOTIFICATIONS,
            eventName: NotificationTypeOptions.UNREAD_NOTIFICATIONS,
            channelType: ChannelTypeOptions.WEB_SOCKET,
            templateArea: TemplateAreaOptions.BODY,
            text: NotificationTypeOptions.UNREAD_NOTIFICATIONS,
        });
        return templates;
    }

    /**
     * Retrieves the content of a file.
     *
     * @param {string} filename - The name of the file to retrieve content from.
     * @return {string} - The content of the file as a string.
     * @throws {Error} - If the filename is empty or null.
     */
    private getFileContent(filename: string): string {
        if (!filename) return null;
        const filePath = this.resolveAndValidateFilePath(filename);
        return fs.readFileSync(filePath).toString();
    }

    /**
     * Resolves and validates the file path.
     *
     * @param {string} filename - The name of the file.
     * @throws {Error} - If the file does not exist.
     *
     * @return {string} - The resolved and validated file path.
     */
    private resolveAndValidateFilePath(filename: string): string {
        const filePath = path.join(EVENT_TEMPLATES_PATH, filename);
        if (!fs.existsSync(filePath)) {
            throw new Error(`File ${filename} not found`);
        }
        return filePath;
    }

    /**
     * Sets the default websocket events for a given set of features and an application name.
     *
     * @param {EventTemplatesByEntityInterface} features - The features with their corresponding actions.
     * @param {string} appName - The name of the application.
     *
     * @return {TemplateDto[]} - An array of TemplateDto objects representing the default websocket events.
     */
    private setWebsocketDefaultEvents(features: EventTemplatesByEntityInterface, appName: string): TemplateDto[] {
        const templates: TemplateDto[] = [];
        for (const [featureKey, featureProps] of Object.entries(features)) {
            const actions = featureProps['actions'];

            for (const actionKey of Object.keys(actions)) {
                const eventName = this.getEnumMemberByName(featureKey as 'folder' | 'task', actionKey);
                if (eventName !== null) {
                    templates.push(this.setWebsocketTemplateDto(appName, eventName, TemplateAreaOptions.BODY));
                }
            }
        }
        return templates;
    }

    /**
     * Sets default email templates for a given set of features and application name.
     * @param {EventTemplatesByEntityInterface} features - The object containing the event templates for each feature.
     * @param {string} appName - The name of the application.
     * @return {TemplateDto[]} - The array of template DTOs that have been set.
     */
    private setEmailDefaultEvents(features: EventTemplatesByEntityInterface, appName: string): TemplateDto[] {
        const templates: TemplateDto[] = [];

        for (const [featureKey, featureProps] of Object.entries(features)) {
            const headerHtml = this.getFileContent(featureProps['header'] as string);
            const footerHtml = this.getFileContent(featureProps['footer'] as string);
            const bodyHtml = this.getFileContent(featureProps['body'] as string);

            // Set email templates for each action
            const actions = featureProps['actions'];

            for (const actionKey of Object.keys(actions)) {
                const actionValue = actions[actionKey]; // This is the HTML content or null
                const actionHTML = this.getFileContent(actionValue);

                // Determine the event name from the action key
                const eventName = this.getEnumMemberByName(featureKey as 'folder' | 'task', actionKey);

                if (eventName !== null && actionHTML) {
                    // Create templates dtos for emails and send them to the notification service, there they'll be saved in the db
                    templates.push(this.setEmailTemplateDto(appName, eventName, bodyHtml, actionHTML, TemplateAreaOptions.BODY));

                    if (headerHtml) {
                        const headerTemplate = this.setEmailTemplateDto(
                            appName,
                            eventName,
                            headerHtml,
                            actionHTML,
                            TemplateAreaOptions.HEADER
                        );
                        templates.push(headerTemplate);
                    }

                    if (footerHtml) {
                        const footerTemplate = this.setEmailTemplateDto(
                            appName,
                            eventName,
                            footerHtml,
                            actionHTML,
                            TemplateAreaOptions.FOOTER
                        );
                        templates.push(footerTemplate);
                    }
                }
            }
        }
        return templates;
    }

    /**
     * Sets the Email Template DTO.
     *
     * @param {string} appName - The name of the application.
     * @param {TaskEventNameOptions | FolderEventNameOptions} eventName - The event name options for the template.
     * @param {string} html - The HTML content of the template.
     * @param {string} actionHTML - The action HTML content of the template.
     * @param {TemplateAreaOptions} templateAreaOption - The template area options.
     * @returns {TemplateDto} - The created Template DTO.
     */
    private setEmailTemplateDto(
        appName: string,
        eventName: TaskEventNameOptions | FolderEventNameOptions,
        html: string,
        actionHTML: string,
        templateAreaOption: TemplateAreaOptions
    ): TemplateDto {
        return new TemplateDto(appName, eventName, ChannelTypeOptions.EMAIL, templateAreaOption, html.replace('actionHTML', actionHTML));
    }

    /**
     * Sets the WebSocket template DTO for a given application name, event name, and template area option.
     *
     * @param {string} appName - The name of the application.
     * @param {TaskEventNameOptions | FolderEventNameOptions} eventName - The event name, can be either TaskEventNameOptions or FolderEventNameOptions.
     * @param {TemplateAreaOptions} templateAreaOption - The template area option.
     * @return {TemplateDto} - The WebSocket template DTO.
     */
    private setWebsocketTemplateDto(
        appName: string,
        eventName: TaskEventNameOptions | FolderEventNameOptions,
        templateAreaOption: TemplateAreaOptions
    ): TemplateDto {
        return new TemplateDto(appName, eventName, ChannelTypeOptions.WEB_SOCKET, templateAreaOption, eventName);
    }

    /**
     * Retrieves an enum member by its name.
     *
     * @param {("folder" | "task")} feature - The feature to search in ('folder' or 'task').
     * @param {string} actionName - The name of the enum member to retrieve.
     * @returns {TaskEventNameOptions | FolderEventNameOptions | null} - The enum member corresponding to the given name, or null if not found.
     */
    private getEnumMemberByName(feature: 'folder' | 'task', actionName: string): TaskEventNameOptions | FolderEventNameOptions | null {
        if (feature === 'folder') {
            for (const [key, value] of Object.entries(FolderEventNameOptions)) {
                if (value === actionName) {
                    return FolderEventNameOptions[key];
                }
            }
        } else if (feature === 'task') {
            for (const [key, value] of Object.entries(TaskEventNameOptions)) {
                if (value === actionName) {
                    return TaskEventNameOptions[key];
                }
            }
        }

        return null;
    }
}
