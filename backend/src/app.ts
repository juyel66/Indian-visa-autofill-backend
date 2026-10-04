import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import authRoutes from './routes/auth.routes';
import applicationRoutes from './routes/application.routes';
import adminRoutes from './routes/admin.routes';

const app: Application = express();

const allowedOrigins = [
  'chrome-extension://idjemajdjnoefigfbnnfmcpnnfgmefme',
  'chrome-extension://idjemajdjnoefigfbnnfmcpnnfgme',
  'http://localhost:3000',
  process.env.CLIENT_ORIGIN,
].filter(Boolean) as string[];

app.use(
  helmet({
    crossOriginResourcePolicy: false,
    crossOriginOpenerPolicy: false,
  })
);

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, mobile, server-to-server)
    if (!origin) return callback(null, true);
    // Allow chrome extension origins or configured allowed origins
    if (
      origin.startsWith('chrome-extension://') ||
      allowedOrigins.includes(origin) ||
      origin.includes('localhost') ||
      process.env.NODE_ENV === 'development'
    ) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
};

app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Root endpoint
app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Visa Autofill server is running',
  });
});

// Authentication routes
app.use('/api/auth', authRoutes);

// Application routes
app.use('/api/applications', applicationRoutes);

// Admin routes (Dashboard, User & Application Management, Audit Logs, Settings)
app.use('/api/admin', adminRoutes);

export default app;
