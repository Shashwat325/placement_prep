import { createLogger, format, transports } from 'winston';
const { combine, timestamp, label, printf } = format;

// Define log format
const logFormat = printf(({ level, message, label, timestamp }) => {
  return `${timestamp} [${label}] ${level}: ${message}`;
});

// Create logger instance
const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(
    label({ label: 'placement-prep-backend' }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    // File transport for all logs
    new transports.File({ filename: 'logs/error.log', level: 'error' }),
    new transports.File({ filename: 'logs/combined.log' })
  ]
});

// Add console transport with colorization in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new transports.Console({
    format: combine(
      label({ label: 'placement-prep-backend' }),
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      format.colorize(),
      format.printf(
        ({ level, message, label, timestamp }) => {
          return `${timestamp} [${label}] ${level}: ${message}`;
        }
      )
    )
  }));
}

export default logger;