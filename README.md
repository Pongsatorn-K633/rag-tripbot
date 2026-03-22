# RAG TripBot

A RAG-based trip planning chatbot that uses a local LLM with vector search for context-aware responses.

## Tech Stack

| Component | Technology |
|---|---|
| LLM | [scb10x/llama3.1-typhoon2-8b-instruct](https://ollama.com/scb10x/llama3.1-typhoon2-8b-instruct) via Ollama |
| Embedding Model | [BAAI/bge-m3](https://huggingface.co/BAAI/bge-m3) via sentence-transformers (1024-dim) |
| Vector Database | PostgreSQL + [pgvector](https://github.com/pgvector/pgvector) |
| Language | Python |

## Prerequisites

- [Ollama](https://ollama.com) installed and running
- [Docker](https://www.docker.com) (for PostgreSQL + pgvector)
- Python 3.10+

## Quick Start

### 1. Clone and install dependencies

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Pull the LLM model

```bash
ollama pull scb10x/llama3.1-typhoon2-8b-instruct
```

### 3. Start the vector database

```bash
docker run -d --name pgvector-db \
  -e POSTGRES_USER=<your_user> \
  -e POSTGRES_PASSWORD=<your_password> \
  -e POSTGRES_DB=<your_db> \
  -p 5432:5432 \
  pgvector/pgvector:pg18-trixie
```

### 4. Enable pgvector extension and create table

Connect to the database and run:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    content TEXT,
    embedding vector(1024)
);
```

## Project Structure

```
rag-tripbot/
├── prompt.ipynb          # Main notebook with LLM and embedding experiments
├── requirements.txt      # Python dependencies
├── developer_guideline.md # Implementation details
├── README.md
└── .gitignore
```

## Documentation

- [Developer Guideline](developer_guideline.md) - Detailed implementation guide covering embedding model usage, database schema, and RAG pipeline details.
