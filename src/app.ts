import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';

const app: Application = express();

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Visa Autofill server is healthy',
  });
});

export default app;
