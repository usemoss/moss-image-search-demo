<!-- markdownlint-disable-next-line MD033 -->
# <img src="https://github.com/user-attachments/assets/c4e39933-40c4-462d-a9a3-135458c6705f" alt="Moss logo" width="48" style="vertical-align: middle; margin-right: 8px;" /> Moss Samples

Moss is a high-performance runtime for real-time semantic search. It delivers sub-10 ms lookups, instant index updates, and zero infra overhead. Moss runs where your agent lives - cloud, in-browser, or on-device - so search feels native and users never wait. You connect your data once; Moss handles indexing, packaging, distribution and updates.

This repo bundles thin, working examples that show how to talk to Moss from Python and JavaScript. Each sample keeps the scaffolding light so you can copy the essentials straight into your own projects.

**Join our [discord server](https://discord.gg/Z9TGpJWF) to get onboarded!**

## 1. Go to Moss Portal and Get API Keys

- Visit [portal.usemoss.dev](https://portal.usemoss.dev/auth/login) to create an account, confirm your email, and sign in.
- From the dashboard, open **View secrets** and save the values as `MOSS_PROJECT_ID` and `MOSS_PROJECT_KEY` in your `.env` for the samples either in the setup-js or the setup-py folders.

> ![Moss Portal walkthrough](https://github.com/user-attachments/assets/c3db9d2d-0df5-4cec-99fd-7d49d0a30844)

## 2. Setup - Upload data and create index

Go into either the `setup-js` or `setup-py` folder and follow the instructions.

### Setup JS

1. Navigate to the `setup-js` folder.
2. Install Node.js and npm.
3. Run `npm install` to install dependencies. `npm install -g npx` to install npx globally if not already installed.
4. Create a `.env` file in the `setup-js` folder and add your `MOSS_PROJECT_ID` and `MOSS_PROJECT_KEY` values.
5. "npx tsx createIndex.ts" to create the index.
6. "npx tsx query.ts" to load the index and run the sample query.

### Setup Python

1. Navigate to the `setup-py` folder.
2. Install Python 3.9+ and uv.
3. (Optional) Create and activate a virtual environment.
4. Install uv if not already installed: `pip install uv`.
5. Create a virtual environment using uv: `uv venv`.(optional)
6. Activate the virtual environment(optional):
   - On Windows: `.\venv\Scripts\activate`
   - On macOS/Linux: `source venv/bin/activate`
7. Run `uv sync` to install dependencies.
8. Create a `.env` file in the `setup-py` folder and add your `MOSS_PROJECT_ID`,`MOSS_PROJECT_KEY` and `MOSS_INDEX_NAME` values.
9. Run `python create_index.py` to create the index.
10. Run `python query.py` to load the index and run the sample query.

## 3. React App powered by Moss

A sample React app is included in the `react-app` folder that demonstrates how to integrate Moss for semantic search in the image search application.

1. Navigate to the `react-app` folder.
2. Install Node.js and npm.
3. Run `npm install` to install dependencies.
4. Create a `.env` file in the `react-app` folder and add your `MOSS_PROJECT_ID` and `MOSS_PROJECT_KEY` values.
   - Prefix environment variables with `VITE_`.
5. Run `npm run dev` to start the development server.