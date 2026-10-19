
import * as winston from 'winston';
import 'winston-daily-rotate-file';


export const authLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  transports: [
    // Day-by-day rotating file
    new winston.transports.DailyRotateFile({
      dirname: 'logs/auth',
      filename: 'auth-%DATE%.log',
      datePattern: 'YYYY-MM-DD', // one file per calendar day
      zippedArchive: true, // auto-zip files once the day has passed
      maxSize: '20m',
      maxFiles: '30d', // keep 30 days, then delete
    }),
    // Also print to the console in development
    new winston.transports.Console({
      silent: process.env.NODE_ENV === 'production',
    }),
  ],
});
