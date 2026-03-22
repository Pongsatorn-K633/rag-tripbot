from sentence_transformers import SentenceTransformer

embedder = SentenceTransformer("BAAI/bge-m3")

embedding = embedder.encode("สวัสดีครับ").tolist()
print(embedding)