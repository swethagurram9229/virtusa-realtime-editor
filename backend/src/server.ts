import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import axios from 'axios';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT || 4000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL =
  process.env.GEMINI_MODEL ?? 'gemini-1.5-flash-latest';

type DocumentState = {
  content: string;
  updatedAt: number;
};

const documents = new Map<string, DocumentState>();

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  let activeRoom: string | null = null;

  socket.on('join_room', ({ roomId }: { roomId: string }) => {
    if (!roomId) return;

    activeRoom = roomId;
    socket.join(roomId);

    if (!documents.has(roomId)) {
      documents.set(roomId, {
        content: '',
        updatedAt: Date.now(),
      });
    }

    socket.emit('initial_state', documents.get(roomId));
    socket.to(roomId).emit('peer_joined', { peerId: socket.id });
  });

  socket.on(
    'code_change',
    ({
      roomId,
      content,
    }: {
      roomId: string;
      content: string;
    }) => {
      if (!roomId || typeof content !== 'string') return;
      documents.set(roomId, {
        content,
        updatedAt: Date.now(),
      });
      socket.to(roomId).emit('code_change', { content });
    },
  );

  socket.on(
    'cursor_update',
    ({
      roomId,
      cursor,
    }: {
      roomId: string;
      cursor: { line: number; ch: number };
    }) => {
      if (!roomId) return;
      socket.to(roomId).emit('cursor_update', {
        peerId: socket.id,
        cursor,
      });
    },
  );

  socket.on('disconnect', () => {
    if (activeRoom) {
      socket.to(activeRoom).emit('peer_left', { peerId: socket.id });
    }
  });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.post('/api/completions', async (req, res) => {
  try {
    if (!GEMINI_API_KEY) {
      return res
        .status(500)
        .json({ error: 'GEMINI_API_KEY is not configured' });
    }

    const {
      code = '',
      language = 'typescript',
      cursor = 0,
      instructions,
    } = req.body ?? {};

    const systemPrompt = [
      'You are an AI pair programmer that only returns JSON.',
      'Output must be a JSON object with shape:',
      '{ "completions": [ { "insertText": string, "displayText": string } ] }',
      'Make insertText directly pasteable at the cursor, no markdown fences.',
    ].join(' ');

    const userPrompt = [
      `Language: ${language}`,
      `Cursor offset: ${cursor}`,
      instructions
        ? `Additional instructions: ${instructions}`
        : undefined,
      '---- CURRENT FILE START ----',
      code.slice(Math.max(0, cursor - 2000), cursor),
      '<CURSOR>',
      code.slice(cursor, cursor + 2000),
      '---- CURRENT FILE END ----',
    ]
      .filter(Boolean)
      .join('\n');

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            role: 'user',
            parts: [
              { text: systemPrompt },
              { text: userPrompt },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 256,
        },
      },
    );

    const textResponse =
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textResponse) {
      return res.status(500).json({
        error: 'No completion returned from Gemini',
      });
    }

    let completionsPayload;

    try {
      completionsPayload = JSON.parse(textResponse);
    } catch {
      completionsPayload = {
        completions: [
          {
            insertText: textResponse,
            displayText: 'Gemini suggestion',
          },
        ],
      };
    }

    res.json(completionsPayload);
  } catch (error: any) {
    const status = error.response?.status ?? 500;
    res.status(status).json({
      error: error?.response?.data ?? error.message ?? 'Unknown error',
    });
  }
});

httpServer.listen(PORT, () => {
  console.log(`Realtime server listening on port ${PORT}`);
});

