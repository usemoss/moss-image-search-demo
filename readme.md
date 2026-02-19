<!-- markdownlint-disable-next-line MD033 -->
# <img src="https://github.com/user-attachments/assets/c4e39933-40c4-462d-a9a3-135458c6705f" alt="Moss logo" width="48" style="vertical-align: middle; margin-right: 8px;" /> Moss Demo Project - Image Search

Moss is a high-performance runtime for real-time semantic search. It delivers sub-10 ms lookups, instant index updates, and zero infra overhead. Moss runs where your agent lives - cloud, in-browser, or on-device - so search feels native and users never wait. You connect your data once; Moss handles indexing, packaging, distribution and updates.

This repo bundles thin, working examples that show how to talk to Moss from Python and JavaScript. Each sample keeps the scaffolding light so you can copy the essentials straight into your own projects.

> **Try out the live deployment of this sample project at https://moss-image-search-demo.vercel.app/**
> <img width="2234" height="1626" alt="Image" src="https://github.com/user-attachments/assets/9dd4290d-aa9d-456d-a5b6-59eb378d27d6" />

## Quick Start

**1. Create a single `.env` at the repo root** — copy `.env.example` and fill in your Moss credentials:
```bash
cp .env.example .env
```
All sub-projects read from this one file.

**2. Create the Moss index** (`coco-data-1k.json` and `coco-data-10k.json` are included — no download needed):
```bash
cd setup-js && npm install && npx tsx createIndex.ts && cd ..
```
> To use 50k or 100k tiers, run `npx tsx downloadCoco.ts` first to generate those files.

**3. Start the backend** (in one terminal):
```bash
cd backend
uv venv && source .venv/bin/activate  # Windows: .venv\Scripts\activate
uv sync
uvicorn main:app --reload
```

**4. Start the React app** (in another terminal):
```bash
cd react-app && npm install && npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and start searching.

> The app defaults to Python mode (queries via the backend). You can switch to JS mode (direct browser → Moss) using the SDK toggle in Settings.

---

## 1. Go to Moss Portal and Get API Keys

- Visit [usemoss.dev](https://usemoss.dev/) to sign up, create an account, confirm your email, and sign in.
- From the dashboard, open **View secrets** and save the values as `MOSS_PROJECT_ID` and `MOSS_PROJECT_KEY` in the root `.env` file (copy `.env.example` → `.env`).

> ![Moss Portal walkthrough](https://github.com/user-attachments/assets/c3db9d2d-0df5-4cec-99fd-7d49d0a30844)

## 2. Download Dataset

The demo uses COCO Captions images split into tiers (1k, 10k, 50k, 100k).

`coco-data-1k.json` and `coco-data-10k.json` are included in the repo — no download needed for those. To use the larger tiers (50k, 100k), run the download script to generate them:

**JavaScript:**
```bash
cd setup-js
npm install
npx tsx downloadCoco.ts
```

**Python:**
```bash
cd setup-py
uv venv && source .venv/bin/activate
uv sync
python download_coco.py
```

This generates `coco-data-50k.json` and `coco-data-100k.json` in the project root.

## 3. Setup - Upload data and create index

Go into either the `setup-js` or `setup-py` folder and follow the instructions.

### Setup JS

1. Navigate to the `setup-js` folder.
2. Install Node.js and npm.
3. Run `npm install` to install dependencies. `npm install -g npx` to install npx globally if not already installed.
4. Create a `.env` file in the `setup-js` folder (see `.env.example`) and add your `MOSS_PROJECT_ID`, `MOSS_PROJECT_KEY`, `MOSS_INDEX_NAME`, and `MOSS_INDEX_TIER` values.
5. `npx tsx createIndex.ts` to create the index for the configured tier.
6. `npx tsx createAllIndexes.ts` to create indexes for all tiers.
7. `npx tsx query.ts` to load the index and run sample queries.

### Setup Python

1. Navigate to the `setup-py` folder.
2. Install Python 3.9+ and uv.
3. (Optional) Create and activate a virtual environment:
   - `uv venv`
   - On Windows: `.\venv\Scripts\activate`
   - On macOS/Linux: `source .venv/bin/activate`
4. Run `uv sync` to install dependencies.
5. Create a `.env` file in the `setup-py` folder (see `.env.example`) and add your `MOSS_PROJECT_ID`, `MOSS_PROJECT_KEY`, `MOSS_INDEX_NAME`, and `MOSS_INDEX_TIER` values.
6. Run `python create_index.py` to create the index for the configured tier.
7. Run `python create_all_indexes.py` to create indexes for all tiers.
8. Run `python query.py` to load the index and run sample queries.

## 4. Backend (optional)

A FastAPI backend is included in the `backend` folder. It provides a `/search` endpoint that proxies queries to Moss, keeping your API keys off the client.

1. Navigate to the `backend` folder.
2. Install Python 3.9+ and uv.
3. `uv venv && source .venv/bin/activate`
4. `uv sync` to install dependencies.
5. Create a `.env` file (see `.env.example`) and add your `MOSS_PROJECT_ID`, `MOSS_PROJECT_KEY`, and `MOSS_INDEX_NAME` values.
6. Run `uvicorn main:app --reload` to start the server.

## 5. React App powered by Moss

A sample React app is included in the `react-app` folder that demonstrates how to integrate Moss for semantic search in the image search application.

1. Navigate to the `react-app` folder.
2. Install Node.js and npm.
3. Run `npm install` to install dependencies.
4. Create a `.env` file in the `react-app` folder and add your `MOSS_PROJECT_ID` and `MOSS_PROJECT_KEY` values.
   - Prefix environment variables with `VITE_`.
5. Run `npm run dev` to start the development server.
