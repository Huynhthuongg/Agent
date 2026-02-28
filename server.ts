import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { AIBrain } from './ai/core/Brain.ts';
import dotenv from 'dotenv';
import { ExpressAuth } from '@auth/express';
import { authConfig } from './auth/config.ts';
import { requireAuth, requireRole, AuthRequest } from './auth/middleware.ts';
import { logAudit, getAuditLogs } from './db/audit.ts';
import { getAgents, createAgent, updateAgent, deleteAgent } from './db/agents.ts';

dotenv.config();

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
    },
  });
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Initialize AI Brain
  const apiKey = process.env.GEMINI_API_KEY;
  let brain: AIBrain | null = null;
  
  if (apiKey) {
    try {
      brain = new AIBrain(apiKey);
      console.log('AI Brain initialized successfully.');
    } catch (e) {
      console.error('Failed to initialize AI Brain:', e);
    }
  } else {
    console.warn('GEMINI_API_KEY not found. AI features will be disabled.');
  }

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  // Custom OAuth URL endpoint for popup flow
  app.get('/api/auth/url', (req, res) => {
    const provider = req.query.provider as string;
    const callbackUrl = `${process.env.APP_URL}/auth/success`;
    
    if (provider === 'google' || provider === 'github') {
      res.json({ url: `/api/auth/signin/${provider}?callbackUrl=${encodeURIComponent(callbackUrl)}` });
    } else {
      res.status(400).json({ error: 'Unsupported provider' });
    }
  });

  // Auth.js route
  app.use("/api/auth/*", ExpressAuth(authConfig));

  // We need to handle the callback from Auth.js to send the message to the opener
  // Auth.js handles the callback internally via /api/auth/callback/:provider
  // But since we are in a popup, we need a way to close it and send the token.
  // Instead of using Auth.js's built-in redirect, we can intercept it or just use our custom flow.
  // Since the user explicitly requested NextAuth.js, we will use it.
  // However, Auth.js sets cookies. We can just tell the client to check session.


  app.get('/auth/success', (req, res) => {
    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. This window should close automatically.</p>
        </body>
      </html>
    `);
  });

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', ai: !!brain });
  });

  app.get('/api/user/me', requireAuth, (req: AuthRequest, res) => {
    res.json({ user: req.user });
  });

  app.get('/api/audit', requireAuth, requireRole(['admin']), (req: AuthRequest, res) => {
    const logs = getAuditLogs();
    res.json({ logs });
  });

  app.get('/api/agents', requireAuth, (req: AuthRequest, res) => {
    res.json(getAgents());
  });

  app.post('/api/agents', requireAuth, requireRole(['admin']), (req: AuthRequest, res) => {
    const agent = createAgent(req.body);
    res.json(agent);
  });

  app.put('/api/agents/:id', requireAuth, requireRole(['admin']), (req: AuthRequest, res) => {
    const agent = updateAgent(req.params.id, req.body);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    res.json(agent);
  });

  app.delete('/api/agents/:id', requireAuth, requireRole(['admin']), (req: AuthRequest, res) => {
    deleteAgent(req.params.id);
    res.json({ success: true });
  });

  app.post('/api/tasks', requireAuth, requireRole(['admin', 'developer', 'user']), async (req: AuthRequest, res) => {
    if (!brain) {
      return res.status(500).json({ error: 'AI Brain not initialized' });
    }

    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const user = req.user!;
    logAudit(user.id, 'execute_task', 'ai_brain', { prompt });

    try {
      const taskId = Math.random().toString(36).substring(7);
      
      // Emit task start
      io.emit('task_update', { taskId, status: 'started', message: `Task started: ${prompt}` });

      const result = await brain.processTask(taskId, prompt, (msg) => {
        console.log(`[Task ${taskId}] ${msg}`);
        io.emit('task_log', { taskId, message: msg, timestamp: new Date().toISOString() });
      });
      
      io.emit('task_update', { taskId, status: 'completed', result });
      res.json(result);
    } catch (error: any) {
      console.error('Task execution failed:', error);
      io.emit('task_update', { taskId: 'unknown', status: 'failed', error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
