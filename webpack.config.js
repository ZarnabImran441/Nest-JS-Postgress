const path = require('path');

module.exports = {
    mode: 'development',
    // optimization: {
    //     minimize: true
    // },
    devtool: 'inline-source-map',
    // useCache: true,
    // forceIsolatedModules: true,
    // transpileOnly: true,
    // optimization: {
    //     removeAvailableModules: false,
    //     removeEmptyChunks: false,
    //     splitChunks: false
    // },
    cache: {
        type: 'filesystem',
        cacheLocation: path.resolve(__dirname, '.webpack_cache')
    }
};

// module.rules = {
//     test: /\.tsx?$/,
//     use: [
//         {
//             loader: 'ts-loader',
//             options: {
//                 transpileOnly: true,
//                 experimentalWatchApi: true
//             }
//         }
//     ]
// };
