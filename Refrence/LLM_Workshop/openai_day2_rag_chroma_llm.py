"""
DAY 2 - RAG: RETRIEVE CONTEXT FROM CHROMA VECTOR DB -> SEND IT TO AN LLM (GROK / GROQ)

Educational version with very detailed comments.

WHAT THIS SCRIPT DOES
---------------------
This script demonstrates the core RAG flow:

    User Question
          |
          v
    Create embedding for the question
          |
          v
    Search the existing ChromaDB vector database
          |
          v
    Retrieve the most relevant document chunks
          |
          v
    Put those chunks into a prompt as CONTEXT
          |
          v
    Send CONTEXT + QUESTION to the LLM (Grok / Groq)
          |
          v
    Get a grounded answer

IMPORTANT
---------
1. This script assumes that you already created a ChromaDB database during Day 1.
2. The ChromaDB collection name and path below MUST match your Day 1 setup.
3. The embedding model matches Day 1 ('sentence-transformers/all-MiniLM-L6-v2').
4. Add your API key in the .env file (grok_api_key=... or GROK_API_KEY=...).
5. Never commit your real API key to GitHub.

This version uses:
    - ChromaDB                  -> vector database / retrieval
    - Grok / Groq (OpenAI SDK)  -> LLM response generation

The important RAG concept is:

    RETRIEVAL:
        Vector DB finds relevant context.

    GENERATION:
        LLM reads that context and generates the answer.

The LLM itself is NOT searching ChromaDB.
Python retrieves the context first and then puts that context into
the LLM prompt.
"""

# ================================================================
# 1. IMPORTS
# ================================================================

# os is used to read environment variables and configuration.
import os
from pathlib import Path


def _load_env_file():
    """
    Zero-dependency .env loader: reads key-value pairs from .env into os.environ
    so you do not need 'python-dotenv' installed for this to work.
    """
    search_dirs = [Path.cwd()]
    if "__file__" in globals():
        current_file = Path(__file__).resolve()
        search_dirs.extend([
            current_file.parent,
            current_file.parent.parent,
            current_file.parent.parent.parent,
        ])
    for directory in search_dirs:
        env_path = directory / ".env"
        if env_path.is_file():
            try:
                with open(env_path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if not line or line.startswith("#") or "=" not in line:
                            continue
                        key, val = line.split("=", 1)
                        key = key.strip()
                        val = val.strip().strip("'\"")
                        if key and key not in os.environ:
                            os.environ[key] = val
            except Exception:
                pass


_load_env_file()

# ChromaDB is our vector database.
import chromadb

# OpenAI is used for:
#   1. Creating an embedding for the user's question.
#   2. Sending the retrieved context + question to the LLM.
from openai import OpenAI


# ================================================================
# 2. CONFIGURATION
# ================================================================

# ------------------------------------------------
# API KEY & GROK / GROQ CONFIGURATION
# ------------------------------------------------
# Read API key from environment variable or .env file.
# Supports: grok_api_key, GROK_API_KEY, GROQ_API_KEY, groq_api_key, XAI_API_KEY, OPENAI_API_KEY
# ------------------------------------------------

API_KEY = (
    os.getenv("grok_api_key")
    or os.getenv("GROK_API_KEY")
    or os.getenv("groq_api_key")
    or os.getenv("GROQ_API_KEY")
    or os.getenv("XAI_API_KEY")
    or os.getenv("OPENAI_API_KEY")
    or ""
)

# Detect provider and set appropriate OpenAI-compatible endpoint and default model:
# - Groq keys start with 'gsk_' (fast LPU inference: llama-3.3-70b-versatile, llama3-8b-8192, etc.)
# - xAI Grok keys start with 'xai-' (grok-beta, grok-2-latest)
# - Standard OpenAI keys start with 'sk-'
if API_KEY.startswith("gsk_"):
    PROVIDER_NAME = "Groq"
    DEFAULT_BASE_URL = "https://api.groq.com/openai/v1"
    DEFAULT_MODEL = "llama-3.3-70b-versatile"
elif API_KEY.startswith("xai-"):
    PROVIDER_NAME = "xAI Grok"
    DEFAULT_BASE_URL = "https://api.x.ai/v1"
    DEFAULT_MODEL = "grok-beta"
else:
    PROVIDER_NAME = "Groq / Grok (OpenAI-compatible)"
    DEFAULT_BASE_URL = "https://api.groq.com/openai/v1"
    DEFAULT_MODEL = "llama-3.3-70b-versatile"

BASE_URL = os.getenv("GROK_BASE_URL", os.getenv("GROQ_BASE_URL", DEFAULT_BASE_URL))


# ------------------------------------------------
# CHROMA DATABASE PATH
# ------------------------------------------------
# This MUST point to the same persistent ChromaDB directory
# that you created during Day 1.
#
# Example:
#     "./chroma_db"
#
# If your Day 1 code used:
#     chromadb.PersistentClient(path="./chroma_db")
#
# then keep this as "./chroma_db".
# ------------------------------------------------

CHROMA_DB_PATH = "./chroma_db"


# ------------------------------------------------
# CHROMA COLLECTION NAME
# ------------------------------------------------
# This MUST be the SAME collection name used during Day 1.
#
# For example, if Day 1 had:
#
#     client.get_or_create_collection("documents")
#
# then use:
#
#     COLLECTION_NAME = "documents"
#
# Change this if your Day 1 collection has another name.
# ------------------------------------------------

COLLECTION_NAME = "langchain"


# ------------------------------------------------
# EMBEDDING MODEL
# ------------------------------------------------
# Day 1 ingestion.py used sentence-transformers/all-MiniLM-L6-v2.
# Matching this ensures 100% compatibility with your ChromaDB.
# ------------------------------------------------

EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"


# ------------------------------------------------
# LLM MODEL
# ------------------------------------------------
# This is the model that will generate the final answer.
# ------------------------------------------------

LLM_MODEL = os.getenv("LLM_MODEL", DEFAULT_MODEL)


# ------------------------------------------------
# TOP_K
# ------------------------------------------------
# TOP_K tells the vector database how many relevant chunks
# we want to retrieve.
#
# Example:
#
#     TOP_K = 3
#
# means:
#
#     "Give me the 3 most similar chunks."
#
# This is an important RAG concept called Top-K retrieval.
# ------------------------------------------------

TOP_K = 3


# ================================================================
# 3. CREATE THE OPENAI-COMPATIBLE CLIENT (GROK / GROQ)
# ================================================================

# Grok and Groq both provide OpenAI-compatible APIs, allowing us to
# use the official OpenAI Python SDK simply by providing the base_url.

if not API_KEY or API_KEY in ["YOUR_OPENAI_API_KEY_HERE", "PASTE_YOUR_KEY_HERE", "YOUR_GROK_API_KEY_HERE"]:
    raise ValueError(
        "\nPlease add your Grok/Groq API key to your .env file "
        "(grok_api_key=gsk_... or GROK_API_KEY=...) before running the program."
    )

openai_client = OpenAI(
    api_key=API_KEY,
    base_url=BASE_URL,
)


# ================================================================
# 4. CONNECT TO THE EXISTING CHROMADB
# ================================================================

# PersistentClient connects to an existing ChromaDB stored on disk.
#
# IMPORTANT:
# We are NOT creating a new vector database here.
#
# We are opening the vector database that we created on Day 1.
#
# Think of it like:
#
#     Day 1:
#         Documents -> Embeddings -> ChromaDB
#
#     Day 2:
#         Question -> Embedding -> Search ChromaDB
#
# Therefore, both days use the same database.
# ------------------------------------------------

chroma_client = chromadb.PersistentClient(path=CHROMA_DB_PATH)


# ================================================================
# 5. OPEN THE EXISTING COLLECTION
# ================================================================

# A Chroma collection is similar to a table/index where our
# document chunks and their embeddings are stored.
#
# get_collection() means:
#
#     "Open the collection that already exists."
#
# If the collection does not exist, Chroma will raise an error.
# That is useful because it tells us that our Day 1 database
# configuration is incorrect.

try:
    collection = chroma_client.get_collection(name=COLLECTION_NAME)

except Exception as error:
    raise RuntimeError(
        f"""
Could not open the ChromaDB collection.

Database path:
    {CHROMA_DB_PATH}

Collection name:
    {COLLECTION_NAME}

Make sure these values are exactly the same as your Day 1 code.

Original error:
    {error}
"""
    )


# ================================================================
# 6. FUNCTION: CREATE QUERY EMBEDDING
# ================================================================

def create_query_embedding(question):
    """
    Convert the user's question into a vector embedding.

    Day 1 ingestion used:
        'sentence-transformers/all-MiniLM-L6-v2' (384 dimensions)

    We first try the exact same embedding model to guarantee
    dimension and semantic match with the ChromaDB collection.
    If an embedding API is available from the provider, it will fall back to that.
    """

    # 1. Match Day 1 embedding model using sentence-transformers
    try:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer("all-MiniLM-L6-v2")
        return _model.encode(question).tolist()
    except Exception:
        pass

    # 2. Match Day 1 embedding model using langchain-huggingface
    try:
        from langchain_huggingface import HuggingFaceEmbeddings
        _embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
        return _embeddings.embed_query(question)
    except Exception:
        pass

    # 3. Fallback to API embedding if supported by the provider
    try:
        response = openai_client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=question
        )
        return response.data[0].embedding
    except Exception as error:
        raise RuntimeError(
            f"\nCould not generate an embedding vector for the question.\n"
            f"Because Day 1 ChromaDB was created using 'all-MiniLM-L6-v2', please install sentence-transformers:\n"
            f"    pip install sentence-transformers\n"
            f"Original error: {error}"
        )


# ================================================================
# 7. FUNCTION: RETRIEVE RELEVANT CONTEXT
# ================================================================

def retrieve_context(question, top_k=TOP_K):
    """
    Search ChromaDB and return the most relevant document chunks.

    This is the RETRIEVAL step of RAG.

    Flow:

        User Question
              |
              v
        Query Embedding
              |
              v
        ChromaDB Similarity Search
              |
              v
        Top-K Relevant Chunks
    """

    print("\n" + "=" * 70)
    print("STEP 1: CREATING QUERY EMBEDDING")
    print("=" * 70)

    query_embedding = create_query_embedding(question)

    print(f"Embedding created successfully.")
    print(f"Embedding dimensions: {len(query_embedding)}")


    # ------------------------------------------------------------
    # SEARCH THE VECTOR DATABASE
    # ------------------------------------------------------------
    #
    # query_embeddings:
    #     The vector representation of our question.
    #
    # n_results:
    #     Number of chunks we want back.
    #
    # ChromaDB compares the query vector with stored vectors
    # and returns the most relevant results.
    # ------------------------------------------------------------

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k
    )


    # ------------------------------------------------------------
    # Extract the documents from the ChromaDB response.
    #
    # ChromaDB normally returns nested lists because a query can
    # contain multiple questions.
    #
    # We only sent one question, so:
    #
    #     results["documents"][0]
    #
    # contains the documents retrieved for that question.
    # ------------------------------------------------------------

    retrieved_documents = results.get("documents", [[]])[0]

    # ChromaDB can also return distances.
    #
    # Depending on the ChromaDB configuration/metric, the numerical
    # interpretation of the distance depends on the metric being used.
    #
    # We print the values for educational purposes, but do not
    # incorrectly label every distance as "similarity score".
    retrieved_distances = results.get("distances", [[]])[0]


    # ------------------------------------------------------------
    # Print what we retrieved.
    #
    # This is VERY useful during the workshop because students can
    # literally see:
    #
    #     Question
    #        ↓
    #     Vector DB
    #        ↓
    #     Relevant chunks
    #
    # before the LLM sees anything.
    # ------------------------------------------------------------

    print("\n" + "=" * 70)
    print("STEP 2: RETRIEVED CONTEXT FROM CHROMADB")
    print("=" * 70)

    if not retrieved_documents:
        print("No documents were retrieved.")
        return []

    for index, document in enumerate(retrieved_documents):

        print(f"\n--- Retrieved Chunk {index + 1} ---")

        if index < len(retrieved_distances):
            print(f"Distance: {retrieved_distances[index]}")

        print("Content:")
        print(document)


    return retrieved_documents


# ================================================================
# 8. FUNCTION: BUILD THE RAG PROMPT
# ================================================================

def build_rag_prompt(question, retrieved_documents):
    """
    Build the prompt that will be sent to the LLM.

    This is where RETRIEVAL and GENERATION are connected.

    The vector database has already found the relevant information.

    Now we place that information inside the prompt.

    Conceptually:

        Role
          +
        Context
          +
        Task
          +
        Question
          +
        Constraints
          +
        Output instructions

    This is the same RAG bridge that your Day 2 workshop teaches.
    """

    # ------------------------------------------------------------
    # Combine all retrieved chunks into one CONTEXT block.
    #
    # Example:
    #
    #     [Context 1]
    #     Library opens at 8 AM...
    #
    #     [Context 2]
    #     Library closes at 9 PM...
    #
    #     [Context 3]
    #     Library is open Monday-Friday...
    # ------------------------------------------------------------

    context = "\n\n".join(
        [
            f"[Context {index + 1}]\n{document}"
            for index, document in enumerate(retrieved_documents)
        ]
    )


    # ------------------------------------------------------------
    # Construct the final prompt.
    #
    # IMPORTANT:
    # The instruction "use ONLY the provided context" is a simple
    # grounding rule.
    #
    # It tells the model:
    #
    #     Do not invent information.
    #     Do not rely on unrelated knowledge.
    #     Base the answer on the retrieved chunks.
    #
    # This is one of the most important ideas in RAG.
    # ------------------------------------------------------------

    prompt = f"""
You are a helpful and knowledgeable assistant.

Your job is to answer the user's question using ONLY the
information provided in the retrieved context below.

RETRIEVED CONTEXT:
------------------
{context}
------------------

STUDENT QUESTION:
{question}

INSTRUCTIONS:
1. Answer the student's question using the retrieved context.
2. Do not invent facts that are not present in the context.
3. If the answer cannot be found in the context, clearly say that
   the information is not available in the provided documents.
4. Keep the answer concise and easy to understand.
"""

    return prompt


# ================================================================
# 9. FUNCTION: SEND CONTEXT + QUESTION TO THE LLM
# ================================================================

def ask_llm(question, retrieved_documents):
    """
    Send the retrieved context and the user's question to the LLM.

    This is the GENERATION step of RAG.

    Remember:

        ChromaDB -> RETRIEVES information

        LLM      -> GENERATES the answer
    """

    # First create the final RAG prompt.
    rag_prompt = build_rag_prompt(
        question=question,
        retrieved_documents=retrieved_documents
    )


    # ------------------------------------------------------------
    # Display the prompt for educational purposes.
    #
    # In a production application, you might not print the entire
    # prompt. Here we WANT to show students exactly what is being
    # sent to the LLM.
    # ------------------------------------------------------------

    print("\n" + "=" * 70)
    print("STEP 3: FINAL RAG PROMPT SENT TO LLM")
    print("=" * 70)

    print(rag_prompt)


    # ------------------------------------------------------------
    # CALL THE LLM
    # ------------------------------------------------------------
    #
    # The system message defines the model's general behavior.
    #
    # The user message contains:
    #     - retrieved context
    #     - actual student question
    #     - instructions
    #
    # This demonstrates the System vs User message concept from
    # Day 2.
    # ------------------------------------------------------------

    response = openai_client.chat.completions.create(
        model=LLM_MODEL,

        messages=[
            {
                "role": "system",
                "content": (
                    "You are a helpful and accurate university "
                    "information assistant."
                )
            },
            {
                "role": "user",
                "content": rag_prompt
            }
        ],

        # A lower temperature makes answers more consistent.
        # We want a grounded factual answer rather than creative text.
        temperature=0.2
    )


    # Extract the generated text from the response.
    answer = response.choices[0].message.content

    return answer


# ================================================================
# 10. MAIN RAG PIPELINE
# ================================================================

def run_rag(question):
    """
    Run the complete RAG pipeline.

    This function connects everything together:

        Question
           ↓
        Embedding
           ↓
        ChromaDB Retrieval
           ↓
        Retrieved Context
           ↓
        Prompt Construction
           ↓
        LLM
           ↓
        Final Answer
    """

    print("\n")
    print("#" * 70)
    print("                 DAY 2 - RAG DEMO")
    print("#" * 70)

    print(f"\nStudent Question:")
    print(f"> {question}")


    # ------------------------------------------------------------
    # STEP A:
    # Retrieve the most relevant chunks from the vector database.
    # ------------------------------------------------------------

    retrieved_documents = retrieve_context(
        question=question,
        top_k=TOP_K
    )


    # ------------------------------------------------------------
    # If nothing was retrieved, don't call the LLM.
    #
    # This is important because sending an empty context to the LLM
    # can encourage it to answer from its general knowledge.
    # ------------------------------------------------------------

    if not retrieved_documents:
        print("\nNo relevant context was found in the vector database.")
        print("The LLM will NOT be called.")
        return


    # ------------------------------------------------------------
    # STEP B:
    # Send retrieved context + question to the LLM.
    # ------------------------------------------------------------

    answer = ask_llm(
        question=question,
        retrieved_documents=retrieved_documents
    )


    # ------------------------------------------------------------
    # STEP C:
    # Display the final answer.
    # ------------------------------------------------------------

    print("\n" + "=" * 70)
    print("STEP 4: FINAL LLM ANSWER")
    print("=" * 70)

    print(answer)

    print("\n" + "#" * 70)
    print("                    RAG COMPLETE")
    print("#" * 70)


# ================================================================
# 11. INTERACTIVE CHAT LOOP
# ================================================================

def main():
    """
    Start an interactive RAG chatbot.

    Students can ask multiple questions without restarting Python.

    Example:

        You > When does the library open?

        You > What documents are required for admission?

        You > What are the hostel timings?

    Type 'exit' to stop.
    """

    print("\n" + "=" * 70)
    print("          DAY 2 - VECTOR DB + LLM RAG CHATBOT")
    print("=" * 70)

    print("\nConnected ChromaDB:")
    print(f"  Path       : {CHROMA_DB_PATH}")
    print(f"  Collection : {COLLECTION_NAME}")

    print("\nLLM Provider:")
    print(f"  Provider   : {PROVIDER_NAME}")
    print(f"  Model      : {LLM_MODEL}")
    print(f"  Base URL   : {BASE_URL}")

    print("\nEmbedding:")
    print(f"  Model      : {EMBEDDING_MODEL}")

    print("\nType your question.")
    print("Type 'exit' or 'quit' to stop.")


    while True:

        try:
            question = input("\nYou > ").strip()

            # Ignore empty input.
            if not question:
                continue

            # Stop the program.
            if question.lower() in ["exit", "quit", "q"]:
                print("\nGoodbye!")
                break

            # Run the complete RAG pipeline.
            run_rag(question)

        except KeyboardInterrupt:
            print("\n\nProgram interrupted. Goodbye!")
            break

        except Exception as error:
            # Print the error instead of silently crashing so that
            # students can understand what went wrong.
            print("\nERROR:")
            print(error)


# ================================================================
# 12. PROGRAM ENTRY POINT
# ================================================================

# Python executes main() only when this file is run directly.
#
# Example:
#
#     python day2_rag.py
#
# If this file is imported into another Python file, main() will
# not automatically run.

if __name__ == "__main__":
    main()


"""
==================================================================
                    COMPLETE RAG PIPELINE
==================================================================

                  USER QUESTION
                        |
                        v
              +-------------------+
              | Create Embedding  |
              +-------------------+
                        |
                        v
              +-------------------+
              |    ChromaDB       |
              | Vector Search      |
              +-------------------+
                        |
                        v
                Top-K Chunks
                        |
                        v
              +-------------------+
              |  Build RAG Prompt |
              |                   |
              | Context + Question|
              +-------------------+
                        |
                        v
              +-------------------+
              |       LLM         |
              |     Generate      |
              +-------------------+
                        |
                        v
                  FINAL ANSWER


IMPORTANT CONCEPT:

    Vector Database = RETRIEVAL

    LLM = GENERATION

    RAG = RETRIEVAL + AUGMENTED CONTEXT + GENERATION

==================================================================
"""