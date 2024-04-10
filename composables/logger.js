const pino = require('pino')

const transport = pino.transport(
    {
        targets: [
            {
                target: 'pino-pretty',
                options: {
                    colorize: true
                }
            },
            {
                level: 'trace',
                target: 'pino/file',
                options: {
                    destination: './logs/main.log',
                },
            },
        ],
    }
);

module.exports = pino(transport)