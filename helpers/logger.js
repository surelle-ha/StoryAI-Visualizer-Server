const pino = require('pino');

// Determine if the environment is development
const isDevelopment = process.env.SERVER_ENVN === 'development';

// Configure transport for both development and production environments
const transport = pino.transport({
    targets: isDevelopment ? [
        {
            target: 'pino-pretty',
            options: { colorize: true },
            level: 'info'
        },
        {
            level: 'trace',
            target: 'pino/file',
            options: {
                destination: './logs/main.log',
            },
        }
    ] : [
        {
            level: 'trace',
            target: 'pino/file',
            options: {
                destination: './logs/main.log',
            },
        }
    ]
});

module.exports = pino(transport);
