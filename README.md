# LexisAi ✨

> Professional AI writing, research, and document assistant. Transform rough ideas into polished output in seconds.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0-61dafb?style=flat-square&logo=react)](https://react.dev)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=flat-square&logo=node.js)](https://nodejs.org/)
[![Gemini AI](https://img.shields.io/badge/Powered%20by-Gemini%20AI-4285f4?style=flat-square)](https://ai.google.dev)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)]()

---

## 🎯 What is LexisAi?

LexisAi is a full-stack AI productivity suite for writers, researchers, and professionals. It combines a beautiful React interface with a Gemini-powered backend to help you:

- ✍️ **Write Better**: Rewrite, improve, shorten, expand, or completely rephrase content
- 📚 **Understand Documents**: Summarize PDFs, extract key points, simplify complex text
- 🔍 **Research Smarter**: Conduct grounded research with live search and fallback analytics
- 🎓 **Study Faster**: Generate flashcards, quizzes, and practice questions from notes
- 💼 **Land Jobs**: Tailor CVs, craft cover letters, practice interview questions
- 📄 **Synthesize Ideas**: Turn rough notes into polished reports and proposals
- 💬 **Workspace Collaboration**: Organize documents, notes, and chat history in isolated workspaces

**Built with speed, structure, and security in mind.** Server-side access controls, anti-fabrication guards, and user-isolated workspaces.

---

## ⚡ Quick Start

### Prerequisites
- Node.js 18+
- npm or pnpm
- Gemini API key ([get one free](https://ai.google.dev))
- Optional: Paystack for Pro subscriptions

### Installation

```bash
# Clone and install
git clone https://github.com/LexisAi-de/LexisAi.git
cd LexisAi
npm install

# Configure environment
cp .env.example .env
# Fill in: GEMINI_API_KEY, VITE_PAYSTACK_PUBLIC_KEY, etc.

# Start development server
npm run dev
```

Open http://localhost:3000 and start writing.

### Production Deploy

```bash
npm run build
npm start
```

---

## 🚀 Core Features

### **Transform Mode** ✍️
Rewrite, summarize, improve grammar, adjust tone, generate from scratch, or bulletize any text.

```typescript
// Example: Rewrite email to professional tone
Input:  "hey guys can we sync up tmrw about the project?"
Output: "I'd like to schedule a meeting tomorrow to discuss the project status."
```

### **Document Intelligence** 📖
Upload PDFs, images, or paste text. Summarize, explain, simplify, extract key points, or answer questions—grounded entirely in the document content.

```typescript
// Supported tasks:
- summarize       // Executive summary with key findings
- explain         // Step-by-step breakdown
- simplify        // Plain language for any audience
- extract_key_points  // Critical facts in bullets
- qa              // Answer specific questions
- rewrite_section // Polish focused content
```

### **Research Mode** 🔍
Structured research briefs with live Google Search grounding. If search fails, the system **intentionally falls back** to labeled analytical drafts—never presenting AI-generated facts as verified.

```typescript
// Example output structure:
- Executive Overview & Current Consensus
- Key Facts, Verified Developments & Evidence
- Different Perspectives / Industry Analysis
- Practical Implications & Outlook
```

### **Study Assistant** 🎓
Transform notes into study materials: summaries, key points, flashcards, quizzes, practice questions, or Feynman-style explanations.

```typescript
// Study outputs:
- flashcards           // 8-10 concept cards with memory aids
- quiz                 // 5 multiple-choice questions + answer key
- practice_questions   // Exam-style scenarios with rubrics
- simple_explanation   // Accessible, analogy-driven teaching
- key_points          // Quick-reference cheat sheets
```

### **Career Workflows** 💼
ATS-optimized CV matching, tailored cover letters, interview prep, and application answers—zero fabrication of credentials.

```typescript
// Career tools:
- match_analysis       // Gap analysis vs job description
- tailored_cover_letter // Personalized pitch
- improve_cv           // Quantified accomplishment statements
- interview_questions  // 5 high-probability questions with talking points
- application_answers  // STAR framework responses
```

### **Workflow / Document Synthesis** 📄
Turn rough notes into polished, executive-ready deliverables: reports, proposals, formal letters, or assignment drafts. Built-in anti-fabrication guards prevent inventing data, dates, or credentials.

### **Workspaces** 🗂️
Organize your work with user-isolated workspaces:

- Upload & organize documents
- Create persistent notes
- Chat history grounded in workspace materials
- Quick actions: summarize, rewrite, explain, extract key points, generate outlines

### **Multimodal & OCR** 📸
Extract text from images and PDFs using Gemini vision. Perfect for scanned documents or handwritten notes.

### **Subscription & Credits** 💳
- **Free**: 5 actions/day
- **Pro**: 500 actions/month (KSh 1,000/month)
- **Pay-as-you-go**: Buy credits via Paystack (30, 100, or 250 actions)

Server-side verification ensures secure, transparent billing.

---

## 🏗️ Architecture

### Frontend Stack
- **React 19** + Vite (instant dev experience)
- **Tailwind CSS** + Motion (smooth, accessible UI)
- **Lucide React** (clean, scalable icons)
- TypeScript for type safety

### Backend Stack
- **Express** on Node.js
- **Gemini API** for AI generation
- **Paystack** for payments
- **Local JSON persistence** for workspace data

### Request Flow

```
User Input (React)
    ↓
/api/transform POST
    ↓
server/taskHandlers.ts (prompt engineering)
    ↓
Gemini API (with optional tools/multimodal)
    ↓
server/creditService.ts (usage deduction)
    ↓
Response with streaming (SSE) or JSON
    ↓
UI Updates & History
```

---

## 📁 Project Structure

```text
LexisAi/
├── server/
│   ├── taskHandlers.ts         # Prompt building for all modes
│   ├── workspaceService.ts     # Document/note/chat persistence
│   ├── creditService.ts        # Usage & credit accounting
│   ├── paystackService.ts      # Payment verification
│   └── subscriptionService.ts  # Plan access control
├── src/
│   ├── App.tsx                 # Main orchestrator
│   ├── components/             # Modals, panels, workspaces
│   ├── utils/                  # API clients, usage manager
│   └── types.ts                # Shared types & pricing
├── server.ts                   # Express + Vite entry
├── index.html                  # App shell
└── .env.example                # Configuration template
```

---

## 🔒 Security & Guardrails

✅ **Server-Authoritative Access Control**: All usage, credits, and subscription checks run on the server—never trust the client.

✅ **Anti-Fabrication Safeguards**: Research mode intentionally labels unavailable search results. Job/workflow modes refuse to invent credentials.

✅ **User-Isolated Workspaces**: Each workspace is tied to a user ID with strict ownership validation.

✅ **Secure Payment Verification**: Paystack transactions verified server-side before Pro access or credits are granted.

✅ **Secret Key Protection**: Accidental exposure of Paystack secret keys to the frontend is automatically blocked.

---

## 🛠️ Development

### Available Commands

```bash
npm run dev        # Start dev server (http://localhost:3000)
npm run build      # Production build
npm run start      # Run production server
npm run preview    # Preview Vite production build
npm run clean      # Remove build artifacts
npm run lint       # TypeScript type check
```

### Environment Variables

Create `.env` from `.env.example`:

```env
# Required
GEMINI_API_KEY="your-gemini-api-key"
APP_URL="https://your-domain.com"

# Google Identity Services (set both to the same OAuth Web client ID)
# VITE_GOOGLE_CLIENT_ID must be present during the frontend build.
VITE_GOOGLE_CLIENT_ID="your-web-client-id.apps.googleusercontent.com"
# GOOGLE_CLIENT_ID must also be present in the server runtime environment.
GOOGLE_CLIENT_ID="your-web-client-id.apps.googleusercontent.com"

# Optional (for Pro subscriptions)
VITE_PAYSTACK_PUBLIC_KEY="pk_live_..."
PAYSTACK_SECRET_KEY="sk_live_..."
PAYSTACK_CURRENCY="KES"
```

For Google sign-in, create a Web OAuth client in Google Cloud Console and add each deployed website origin (for example, `http://localhost:3000` and your production HTTPS origin) to its **Authorized JavaScript origins**. Use the same client ID in both environment variables above. Never use a placeholder client ID in production.

### Adding New Features

1. **New Transform Action**: Add to `src/types.ts` → update `server/taskHandlers.ts`
2. **New Workspace Feature**: Extend `WorkspaceChatMessage` type → add routes in `server.ts`
3. **New UI Mode**: Create component in `src/components/` → add mode to `App.tsx`

---

## 📊 Use Cases

### For Writers & Content Creators
- Batch-rewrite social media captions in multiple tones
- Summarize lengthy articles for quick understanding
- Expand outlines into full sections
- Generate multiple variations of copy

### For Researchers
- Deep dives into topics with live search grounding
- Synthesize findings into structured reports
- Extract key facts and citations from documents

### For Students & Educators
- Turn lecture notes into flashcards and quizzes
- Simplify dense academic content
- Generate practice questions for exam prep

### For Job Seekers
- Match resumes against job descriptions
- Craft personalized cover letters
- Practice interviews with AI-generated questions

### For Professionals
- Synthesize rough notes into formal reports
- Write professional emails and letters
- Organize workspace knowledge for team reference

---

## 🎨 UI Highlights

- **Dark Theme**: Easy on the eyes for extended writing sessions
- **Real-Time Streaming**: See AI output appear live (when supported)
- **Responsive Design**: Works beautifully on desktop, tablet, and mobile
- **PWA Support**: Install on device for offline-ready experience
- **Keyboard Shortcuts**: `Cmd/Ctrl + Enter` to submit, `Esc` to close modals

---

## 📈 Performance

- **In-Memory Caching**: Identical queries return in ~8ms
- **Model Fallback**: Automatic retry across fast Gemini models (3.1-flash → 3.6-flash → fallback)
- **Streaming**: SSE streaming for transform mode provides real-time feedback
- **Lazy Loading**: Components only load when their mode is active

---

## 🚢 Deployment

LexisAi is production-ready and tested with:
- **Cloud Run** (automatic env injection)
- **Vercel** / **Netlify** (as static + serverless functions)
- **Traditional VPS** (Node.js + reverse proxy)

All require:
- Node.js 18+
- Gemini API key
- (Optional) Paystack keys for billing

---

## 📝 License

This project is released under the **MIT License**. See LICENSE file for details.

---

## 🤝 Contributing

We welcome contributions! The project is easiest to extend by:

- Adding prompt templates in `server/taskHandlers.ts`
- Building UI components in `src/components/`
- Extending types in `src/types.ts`
- Improving workspace workflows

---

## 📞 Support & Feedback

- 🐛 Found a bug? [Open an issue](https://github.com/LexisAi-de/LexisAi/issues)
- 💡 Have an idea? [Start a discussion](https://github.com/LexisAi-de/LexisAi/discussions)
- 📧 Questions? Reach out to the team

---

<div align="center">

**Transform your writing. Amplify your research. Organize your work.**

Built with ❤️ for writers, researchers, and professionals who demand better tools.

[Try LexisAi →](https://github.com/LexisAi-de/LexisAi)

</div>
