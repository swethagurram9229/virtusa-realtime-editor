## Virtusa Realtime AI Code Collaborator

Fast prototype that demonstrates a cloud-ready collaborative editor with Gemini-powered completions. It includes a Socket.IO/Express backend, a Vite + React frontend built around CodeMirror, and clear guidance for setup, demos, and follow-up work.

---

### ✨ Key Capabilities
- Low-latency collaborative editing rooms with cursor/presence updates.
- Gemini API proxy with prompt-engineering guardrails and JSON parsing.
- CodeMirror 6 editor with AI suggestion sidebar and room/language controls.
- Minimal state management (Zustand) and ergonomics for customer demos.

---

### 📁 Repo Layout
```
backend/   # Express + Socket.IO + Gemini proxy (TypeScript)
frontend/  # Vite React app with CodeMirror + Socket.IO client
docs/      # Room for diagrams / meeting notes (empty placeholder)
```

---

### ⚙️ Prerequisites
- Node.js 20+
- Gemini API key with access to `gemini-1.5-flash`
- Two terminal windows (one for backend, one for frontend)

---

### 🔐 Environment Variables
Create `backend/.env`:
```
PORT=4000
GEMINI_API_KEY=your_google_generative_ai_key
GEMINI_MODEL=gemini-1.5-flash-latest
```

Frontend optionally reads `VITE_BACKEND_URL`. For local dev it defaults to `http://localhost:4000`.

---

### 🚀 Local Development
#### Backend
```
cd backend
npm install
npm run dev
```
Endpoints:
- `GET /health` – service status
- `POST /api/completions` – Gemini completion proxy (expects `{ code, language, cursor }`)

#### Frontend
```
cd frontend
npm install
npm run dev
```
Vite defaults to `http://localhost:5173`. Update `VITE_BACKEND_URL` if backend runs elsewhere.

---

### 🧠 Prompt Engineering & Completion Flow
Backend builds a structured prompt:
1. **System rail** forces JSON output: `{ "completions": [{ "insertText": string, "displayText": string }] }`.
2. **User context** includes language, cursor offset, optional instructions, and a code window (±2k chars).
3. Gemini response is parsed. If parsing fails, we wrap the raw text into a default completion so the UI still shows something.
4. Frontend displays the top suggestion in a side panel and applies it inline when requested.

---

### 🧩 Architecture Overview
- **Frontend**: React + CodeMirror for editing, Zustand store, Socket.IO client for collaboration, Axios for AI calls.
- **Backend**: Express REST endpoints + Socket.IO server, in-memory room store, Axios call to Gemini.
- **Realtime Sync**: Simple room map storing the latest doc snapshot. Socket events `join_room`, `code_change`, `cursor_update`, `peer_left`.
- **AI Loop**: Frontend calls `/api/completions`; backend performs prompt shaping, Gemini request, JSON coercion, returns completions.

Potential evolution: persist rooms in Redis/Postgres, swap to CRDT (Yjs) for conflict-free merges, add auth, integrate Monaco editor, streaming completions, etc.

---

### ✅ Manual Testing Checklist
1. **Backend health** – `curl http://localhost:4000/health`.
2. **Frontend load** – `npm run dev` then open browser.
3. **Realtime edit** – open two tabs, ensure typing in one mirrors in the other and peer counts update.
4. **AI completion** – type code, click `AI Complete`, verify suggestion appears and inserts correctly.
5. **Error handling** – stop backend, click `AI Complete` to observe graceful error in console/UI.

---

### 🤝 Meet & Greet Walkthrough
1. Problem framing + requirements recap.
2. Demo collaborative editing + AI suggestion flow.
3. Describe architecture diagram (backend/ frontend/ Gemini interactions).
4. Highlight prompt strategy, JSON contract, and fallback behavior.
5. Discuss testing, assumptions, and scale-out roadmap.

---

### 📝 Assumptions & Next Steps
**Assumptions**
- Single shared file per room (no multi-file tree yet).
- No authentication/authorization; rooms are open.
- In-memory state acceptable for prototype; restart clears docs.

**Next Steps if time permits**
- Persist rooms & awareness (Redis/Yjs).
- Add presence avatars + cursor colors.
- Streaming tokens for autocomplete.
- Lint/tests (Vitest/Jest) and CI pipeline.
- Deploy to Render/Fly/Netlify for easy sharing.

---

### 📬 Submission Checklist
- [x] Backend + frontend source committed
- [x] README with setup/testing instructions
- [x] Gemini usage described
- [x] Manual verification performed
- [ ] Optional: Record short Loom walkthrough (if required)

Reach out if you need the repo pushed to GitHub or deployed to a demo environment. Happy to assist with the meet-and-greet run-through as well.

