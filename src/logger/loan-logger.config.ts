import * as winston from 'winston';
import 'winston-daily-rotate-file';

export const loanLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.DailyRotateFile({
      dirname: 'logs/loans',
      filename: 'loans-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
    }),
    new winston.transports.Console({
      silent: process.env.NODE_ENV === 'production',
    }),
  ],
});
