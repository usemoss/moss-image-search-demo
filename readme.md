<!-- markdownlint-disable-next-line MD033 -->
# <img src="https://github.com/user-attachments/assets/c4e39933-40c4-462d-a9a3-135458c6705f" alt="Moss logo" width="48" style="vertical-align: middle; margin-right: 8px;" /> Moss Samples

Moss is a high-performance runtime for real-time semantic search. It delivers sub-10 ms lookups, instant index updates, and zero infra overhead. Moss runs where your agent lives - cloud, in-browser, or on-device - so search feels native and users never wait. You connect your data once; Moss handles indexing, packaging, distribution and updates.

This repo bundles thin, working examples that show how to talk to Moss from Python and JavaScript. Each sample keeps the scaffolding light so you can copy the essentials straight into your own projects.

**Join our [discord server](https://discord.gg/Z9TGpJWF) to get onboarded!**

## Using Moss Portal and Getting API Keys

- Visit [portal.usemoss.dev](https://portal.usemoss.dev/auth/login) to create an account, confirm your email, and sign in.
- Inside the default project you will see two plans:
  - Free Tier ($0) offers 1 project, 3 indexes, and 1,000 items per index with community support;
  - Developer Workspace ($2000/month + usage) adds unlimited projects/indexes plus 100 GB storage, 100 GB ingestion, 1 TB egress, and priority support.
- Enter valid card details to start the free trial, then select **Create Index** to provision a new index.
- From the dashboard, open **View secrets** and save the values as `MOSS_PROJECT_ID` and `MOSS_PROJECT_KEY` in your `.env` for the samples.

> ![Moss Portal walkthrough](https://github.com/user-attachments/assets/c3db9d2d-0df5-4cec-99fd-7d49d0a30844)


## Quick Python Docs
