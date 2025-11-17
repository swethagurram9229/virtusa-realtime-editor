~import { useEffect, useMemo, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import ReactCodeMirror from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import { javascript } from '@codemirror/lang-javascript';
import axios from 'axios';
import { create } from 'zustand';

type Completion = {
  insertText: string;
  displayText?: string;
};

type Cursor = { line: number; ch: number } | null;

type RoomState = {
  socket: Socket | null;
  roomId: string;
  code: string;
  cursor: Cursor;
  peers: Record<string, Cursor>;
  setRoom: (roomId: string) => void;
  setCode: (code: string) => void;
  setCursor: (cursor: Cursor) => void;
  setPeers: (
    updater: (prev: Record<string, Cursor>) => Record<string, Cursor>,
  ) => void;
  setSocket: (socket: Socket | null) => void;
};

const useRoomStore = create<RoomState>((set) => ({
  socket: null,
  roomId: 'demo-room',
  code: '',
  cursor: null,
  peers: {},
  setRoom: (roomId) => set({ roomId }),
  setCode: (code) => set({ code }),
  setCursor: (cursor) => set({ cursor }),
  setPeers: (updater) =>
    set((state) => ({
      peers: updater(state.peers),
    })),
  setSocket: (socket) => set({ socket }),
}));

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:4000';

function App() {
  const {
    roomId,
    code,
    peers,
    socket,
    setRoom,
    setCode,
    setPeers,
    setSocket,
  } = useRoomStore();

  const [language, setLanguage] = useState('typescript');
  const [loadingCompletion, setLoadingCompletion] = useState(false);
  const [completion, setCompletion] = useState<Completion | null>(null);

  useEffect(() => {
    const s = io(BACKEND_URL);
    setSocket(s);
    s.emit('join_room', { roomId });

    s.on('initial_state', (payload: { content: string }) => {
      setCode(payload.content);
    });

    s.on('code_change', ({ content }) => {
      setCode(content);
    });

    s.on(
      'cursor_update',
      ({ peerId, cursor }: { peerId: string; cursor: Cursor }) => {
        setPeers((prev) => ({
          ...prev,
          [peerId]: cursor,
        }));
      },
    );

    s.on('peer_left', ({ peerId }) => {
      setPeers((prev) => {
        const next = { ...prev };
        delete next[peerId];
        return next;
      });
    });

    return () => {
      s.disconnect();
    };
  }, [roomId, setCode, setPeers, setSocket]);

  const extensions = useMemo(
    () => [
      javascript({ typescript: true }),
      EditorView.theme({
        '&': {
          minHeight: '60vh',
          fontSize: '16px',
        },
      }),
    ],
    [],
  );

  const handleCodeChange = (value: string) => {
    setCode(value);
    if (socket) {
      socket.emit('code_change', { roomId, content: value });
    }
  };

  const requestCompletion = async (cursorOffset: number) => {
    try {
      setLoadingCompletion(true);
      const res = await axios.post(`${BACKEND_URL}/api/completions`, {
        code,
        language,
        cursor: cursorOffset,
      });

      const payload = res.data as { completions: Completion[] };
      setCompletion(payload.completions?.[0] ?? null);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingCompletion(false);
    }
  };

  const handleApplyCompletion = () => {
    if (!completion) return;
    const newCode = code + completion.insertText;
    handleCodeChange(newCode);
    setCompletion(null);
  };

  return (
    <div className="layout">
      <header>
        <h1>Virtusa Realtime AI Pair</h1>
        <div className="controls">
          <label>
            Room
            <input
              value={roomId}
              onChange={(e) => setRoom(e.target.value)}
            />
          </label>
          <label>
            Language
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="typescript">TypeScript</option>
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
            </select>
          </label>
          <button
            disabled={loadingCompletion}
            onClick={() => requestCompletion(code.length)}
          >
            {loadingCompletion ? 'Generating…' : 'AI Complete'}
          </button>
        </div>
      </header>

      <section className="editor-section">
        <ReactCodeMirror
          value={code}
          width="100%"
          height="70vh"
          extensions={extensions}
          onChange={handleCodeChange}
        />
        <aside>
          <h3>AI Suggestion</h3>
          {completion ? (
            <>
              <pre>{completion.insertText}</pre>
              <button onClick={handleApplyCompletion}>
                Insert suggestion
              </button>
            </>
          ) : (
            <p>Click "AI Complete" to fetch a suggestion.</p>
          )}
        </aside>
      </section>

      <footer>
        <p>Active peers: {Object.keys(peers).length}</p>
      </footer>
    </div>
  );
}

export default App;

