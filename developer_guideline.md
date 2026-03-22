# Developer Guideline

Detailed implementation reference for the RAG TripBot project.

## Embedding Model

This project uses **BAAI/bge-m3** for generating text embeddings, loaded via the `sentence-transformers` library.

- **Model**: `BAAI/bge-m3`
- **Dimension**: 1024
- **Source**: [HuggingFace](https://huggingface.co/BAAI/bge-m3)

### Usage

```python
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("BAAI/bge-m3")
embeddings = model.encode(["your text here"])
# embeddings.shape => (1, 1024)
```

The model is downloaded automatically on first use and cached locally.

## Vector Database (PostgreSQL + pgvector)

### Connection

```python
import psycopg2

conn = psycopg2.connect(
    dbname="my_db",
    user="admin",
    password="1234",
    host="localhost",
    port="5432"
)
```

> **Note**: In production, use environment variables or a `.env` file for credentials. Never commit secrets to the repository.

### Schema

#### `documents` table

| Column | Type | Description |
|---|---|---|
| `id` | `SERIAL PRIMARY KEY` | Auto-incrementing ID |
| `content` | `TEXT` | Raw text content of the document |
| `embedding` | `vector(1024)` | BGE-M3 embedding vector |

### Setup SQL

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    content TEXT,
    embedding vector(1024)
);
```

### Inserting Documents

```python
embedding = model.encode(["some text"])[0]
cur.execute(
    "INSERT INTO documents (content, embedding) VALUES (%s, %s)",
    ("some text", embedding.tolist())
)
conn.commit()
```

### Similarity Search

Use cosine distance (`<=>`) for nearest-neighbor search:

```python
query_embedding = model.encode(["search query"])[0]
cur.execute("""
    SELECT content, embedding <=> %s::vector AS distance
    FROM documents
    ORDER BY distance
    LIMIT 5
""", (query_embedding.tolist(),))
results = cur.fetchall()
```

## LLM (Ollama)

### Model

- **Model**: `scb10x/llama3.1-typhoon2-8b-instruct`
- **Server**: Local Ollama instance

### Usage

```python
import ollama

response = ollama.chat(
    model="scb10x/llama3.1-typhoon2-8b-instruct",
    messages=[
        {"role": "system", "content": "Your system prompt here"},
        {"role": "user", "content": "User question here"}
    ]
)
answer = response["message"]["content"]
```

## RAG Pipeline Overview

1. **Ingest**: Split documents into chunks, generate embeddings with BGE-M3, store in pgvector
2. **Query**: Embed the user's question, perform similarity search against pgvector
3. **Generate**: Pass retrieved context + user question to Typhoon2 via Ollama
