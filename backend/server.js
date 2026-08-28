import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './utils/logger.js';

import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import questionRoutes from './routes/questions.js';
import attemptRoutes from './routes/attempts.js';
import profileRoutes from './routes/profile.js';
import speakingRoutes from './routes/speaking.js';
import interviewRoutes from './routes/interview.js';

dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['PORT', 'JWT_SECRET', 'DATABASE_URL'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) {
  logger.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Security middleware
app.use(helmet());
const allowedOrigins = [
  'http://localhost:3000',
  process.env.CLIENT_URL, // your Vercel URL, set once you have it
].filter(Boolean); // removes CLIENT_URL from the list if it's not set yet

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like Postman or curl) and any origin in our allowlist
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all requests
app.use(limiter);

// Stricter limiting for auth endpoints — relaxed outside production so
// local development/testing (repeated logins, hot-reload retries, etc.)
// doesn't get you rate-limited for 15 minutes at a time.
const isProd = process.env.NODE_ENV === 'production';
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProd ? 10 : 100, // 10/15min in production, 100/15min in dev
  message: 'Too many authentication attempts, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply stricter rate limiting to auth routes
app.use('/api/auth', authLimiter);

// Serve uploaded audio files so the frontend can play them back
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/attempts', attemptRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/speaking', speakingRoutes);
app.use('/api/interview', interviewRoutes);
app.use('/api/admin', adminRoutes);
app.get('/', (req, res) => {
  res.json({ status: 'Placement Prep API running' });
  logger.info('Health check endpoint accessed');
});

// Global error handling middleware
app.use((err, req, res, next) => {
  logger.error(`${err.status || 500} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);

  // If status is not set, default to 500
  const statusCode = err.status || 500;

  res.status(statusCode).json({
    error: {
      message: process.env.NODE_ENV === 'production'
        ? 'Internal Server Error'
        : err.message,
      // Only include stack in non-production
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    }
  });
});

// 404 handler
app.use((req, res) => {
  logger.warn(`404 - ${req.originalUrl} - ${req.method} - ${req.ip}`);
  res.status(404).json({ error: 'Not Found' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});