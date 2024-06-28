import {ServeStaticModuleOptions} from '@nestjs/serve-static';
import {WEB_APP_PATH} from '../const/env.const';

export const ServeStaticConfig: ServeStaticModuleOptions = {
    rootPath: WEB_APP_PATH,
    serveStaticOptions: {index: false},
};
