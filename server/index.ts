import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

// Import the Vercel function handler
import openaiHandler from '../api/openai.ts';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the React app build directory (if needed)
// app.use(express.static(path.join(__dirname, '../dist')));

// API route for OpenAI
app.post('/api/openai', async (req: Request, res: Response) => {
  // Create mock Vercel request and response objects
  const mockVercelReq = {
    method: req.method,
    body: req.body,
    headers: req.headers
  };

  // Mock Vercel response object with methods that call Express response methods
  const mockVercelRes = {
    setHeader: (name: string, value: string) => {
      res.setHeader(name, value);
      return mockVercelRes;
    },
    status: (code: number) => {
      res.status(code);
      return mockVercelRes;
    },
    json: (data: any) => {
      res.json(data);
      return mockVercelRes;
    },
    end: () => {
      res.end();
      return mockVercelRes;
    }
  };

  // Call the Vercel function handler
  try {
    await openaiHandler(mockVercelReq, mockVercelRes);
  } catch (error) {
    console.error('Error in OpenAI handler:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Global error handler
app.use((err: Error, req: Request, res: Response, next: Function) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// 404 handler
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

export default app;