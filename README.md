# LexisAi

AI writing, research, and document assistant for rewriting, summarizing, polishing, and turning rough notes into polished output.

LexisAi is a full-stack TypeScript application that combines a modern React interface with a Node/Express API and Gemini-powered AI workflows. It is designed for everyday writing tasks, deeper document analysis, research support, career workflows, and workspace-based knowledge work.

## Overview

LexisAi helps users:

- rewrite, improve, shorten, expand, or transform text
- summarize long-form content and extract key points
- analyze PDFs and documents
- conduct research with search grounding and fallback handling
- generate study aids such as flashcards and quizzes
- tailor CVs and cover letters for job applications
- synthesize rough notes into finished reports and formal documents
- keep work organized in user-specific workspace documents, notes, and chat history

It is built for speed, guided prompting, and practical AI productivity in a polished web app experience.

## Core Features

### Writing & Transformation

The main transform workflow provides quick content operations such as:

- rewrite
- summarize
- improve/proofread
- shorten
- expand
- bulletize
- generate from prompts
- tone adjustment

These are structured around writing context such as audience, purpose, tone, length, and custom instructions.

### Document Intelligence

Users can work with uploaded documents or pasted text to:

- summarize the document
- explain sections or concepts
- simplify content for broader audiences
- extract key points
- answer document-specific questions
- rewrite focused sections

This mode is grounded in the actual document content and avoids guessing when information is missing.

### Research Mode

Research mode is designed to produce structured briefs using grounded web-search support when available. If live search is unavailable, it intentionally falls back to a transparent analytical draft so it never presents model-generated facts as verified research.

### Study Assistant

Users can transform notes into study outputs such as:

- summaries
- key point cheat sheets
- flashcards
- quizzes
- practice questions
- simple explanations using accessible, teaching-focused prompts

### Job & Career Tools

The application includes an executive-career workflow for:

- CV / resume matching against job requirements
- skill gap analysis
- tailored cover letters
- interview question generation
- application answer drafting

These flows are designed to emphasize real candidate experience and avoid fabricating qualifications.

### Workflow / Finished Document Synthesis

A higher-level synthesis pipeline turns rough notes into more complete deliverables such as:

- business reports
- proposals
- formal letters
- cover letters
- assignment drafts
- presentation outlines

The system emphasizes factual integrity and anti-fabrication controls in executive-style document generation.

### Workspace Collaboration

Each user can create isolated workspaces containing:

- uploaded documents
- notes
- chat history
- AI-powered workspace actions grounded in selected material

The workspace layer is intended to organize long-form work, analyze selected documents, and answer grounded questions using only workspace content when possible.

### Multimodal & OCR Support

The app supports OCR and document extraction from images/PDFs using Gemini multimodal input, enabling text extraction from scanned or image-based content for downstream writing tasks.

### Subscription, Credits & Usage Control

LexisAi includes:

- free daily action limits
- Pro upgrade flow
- AI credits purchased via Paystack
- server-side authorization checks for plan and usage limits
- secure payment verification on the server

## Tech Stack

- Frontend: React 19, Vite, TypeScript
- Styling: Tailwind CSS
- UI motion: Motion
- Backend: Node.js, Express
- AI: Google Gemini via `@google/genai`
- Payments: Paystack integration
- Persistence: local disk JSON cache for workspace data

## Project Structure

```text
.
├── .data/                        # persisted workspace data
├── .env.example                 # example environment variables
├── assets/                      # static assets and internal tooling metadata
├── public/                      # PWA assets, manifest, service worker, icons
├── server/                      # backend services and task orchestration
│   ├── creditService.ts         # credit accounting
│   ├── paystackService.ts        # Paystack integration
│   ├── subscriptionService.ts    # plan and access logic
│   ├── taskHandlers.ts          # prompt-building and modal capability routing
│   └── workspaceService.ts      # workspace CRUD and persistence
├── src/                         # frontend React app
│   ├── App.tsx                  # main app shell and orchestration
│   ├── components/              # UI panels, modals, workspace screens
│   ├── data/                    # presets and defaults
│   ├── types.ts                 # shared TS types and pricing definitions
│   ├── utils/                   # usage manager, Paystack client, workspace client
│   └── main.tsx                 # app bootstrap
├── index.html                   # Vite app entry
├── metadata.json                # repo metadata / app metadata
├── package.json                 # scripts and dependency metadata
├── server.ts                    # Express + Vite server entry point
├── tsconfig.json                # TypeScript configuration
├── vite.config.ts               # Vite configuration
├── .gitignore                   # Git ignore rules
└── README.md                    # project documentation
```

## Requirements

Before running the app, make sure you have:

- Node.js 18+ recommended
- npm or pnpm
- a valid Gemini API key
- optional Paystack configuration for Pro and credit purchases

## Environment Variables

Copy `.env.example` to `.env` and fill in the values.

```env
GEMINI_API_KEY="MY_GEMINI_API_KEY"
APP_URL="MY_APP_URL"
VITE_PAYSTACK_PUBLIC_KEY=""
PAYSTACK_SECRET_KEY=""
PAYSTACK_CURRENCY="KES"
```

Notes:

- `GEMINI_API_KEY` is required for all AI generation flows.
- `APP_URL` is commonly injected automatically in hosted environments.
- Paystack keys are kept server-side (`PAYSTACK_SECRET_KEY`) to avoid exposing secret credentials to the browser.
- The app performs a small safeguard that moves accidental secret keys out of client-exposed Vite variables.

## Quick Start

Install dependencies:

```bash
npm install
```

Create your local environment file:

```bash
cp .env.example .env
```

Then start the app in development mode:

```bash
npm run dev
```

This starts the Express server and Vite development middleware.

## Production Build

```bash
npm run build
npm start
```

This generates the production bundle and serves the app from the built output.

## Available Scripts

```bash
npm run dev      # run the app in development mode
npm run build    # build frontend + backend bundle
npm run start    # run the compiled production server
npm run preview  # preview the Vite production build
npm run clean    # remove dist artifacts
npm run lint     # TypeScript validation with no emit
```

## Runtime Architecture

The application follows a simple layered structure:

1. Frontend React app handles modal flows, input panels, output display, and mode switching.
2. Express server exposes `/api/*` routes for health checks, AI generation, Paystack, subscription checks, and workspace actions.
3. `server/taskHandlers.ts` translates user intent into Gemini prompts, optional tools, and task-specific instructions.
4. Gemini generates the result, optionally with search grounding or multimodal input.
5. Usage, credits, and subscription checks are enforced on the server before actions complete.

## Security & Guardrails

The repository includes several important guardrails:

- server-side subscription and credit checks
- protection against accidentally exposing secret Paystack keys in frontend env vars
- strict anti-fabrication rules for research and document workflows
- workspace ownership checks for user-isolated data
- requirement to verify transaction status before granting Pro access or credits

## Usage Notes

LexisAi is best used as a guided AI writing workspace rather than a generic chatbot. Most features are specialized to actual writing and document workflows, including:

- structured generation
- grounded document work
- research brief production
- career and application support
- workspace-based document synthesis

## Current Status

This repository is a focused TypeScript app for AI-assisted writing and workspace productivity. It is structured for local development and deployment in a hosted environment with Gemini access.

## License

No license file is currently included in this repository. If you plan to distribute or publish it, add an explicit license before doing so.

## Contributing

Contributions are welcome if the repo is used in a collaborative environment. In general, the project is easiest to extend by:

- adding new prompt templates in `server/taskHandlers.ts`
- extending UI modes in `src/components/`
- adding types in `src/types.ts`
- implementing workflow logic in the backend route handlers in `server.ts`

---

Built for writing, research, and document productivity with Gemini-backed workflows.
