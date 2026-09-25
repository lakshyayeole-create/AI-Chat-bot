"""
===================================================================
DAY 1 HANDS-ON WORKSHOP: BUILD A COMPLETE RAG INGESTION PIPELINE
===================================================================

Goal: Convert PDF and TXT documents into a searchable AI memory
      (Vector Database) using Python, LangChain, HuggingFace, and Chroma.

Pipeline Overview:
Documents -> Load -> Clean & Inspect -> Chunk -> Embed -> Store -> Verify
"""

import os
import sys
import warnings

# Force UTF-8 encoding for Windows standard output/error to prevent UnicodeEncodeError
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

# Suppress non-critical deprecation warnings
warnings.filterwarnings("ignore", category=DeprecationWarning)

# -----------------------------------------------------------------
# STEP 1: IMPORT LIBRARIES
# -----------------------------------------------------------------
# Why are we importing these?
#
# Each library is responsible for one specific part of our pipeline.
# We are basically assembling a small document-processing factory:
#
# Loader -> Splitter -> Embedding Model -> Vector Database
# -----------------------------------------------------------------

# Document Loaders: Read raw files (PDFs, TXT) and convert them into text
from langchain_community.document_loaders import TextLoader, PyPDFLoader

# Text Splitter: Breaks large documents into small, meaningful chunks
try:
    from langchain_text_splitters import RecursiveCharacterTextSplitter
except ImportError:
    from langchain.text_splitter import RecursiveCharacterTextSplitter

# Embedding Model: Converts text chunks into mathematical vectors (numbers)
try:
    from langchain_huggingface import HuggingFaceEmbeddings
except ImportError:
    from langchain_community.embeddings import HuggingFaceEmbeddings

# Vector Database: Stores vectors, original text, and metadata locally on disk
try:
    from langchain_chroma import Chroma
except ImportError:
    from langchain_community.vectorstores import Chroma


def main():
    print("=" * 60)
    print("        DAY 1 — RAG INGESTION PIPELINE WORKSHOP       ")
    print("=" * 60)
    print()

    # -------------------------------------------------------------
    # STEP 2: DEFINE DATA & DATABASE PATHS
    # -------------------------------------------------------------
    # The data/ folder is our knowledge source.
    # Students can place PDFs, text files, workshop notes, or manuals
    # inside this folder. This is the raw information we want our AI
    # chatbot to retrieve later!
    # -------------------------------------------------------------
    DATA_PATH = "./data"
    DB_PATH = "./chroma_db"

    # Error Check 1: Ensure the data folder exists
    if not os.path.exists(DATA_PATH):
        print("❌ Error: The 'data' folder was not found!")
        print("   Please create a folder named 'data' in this directory")
        print("   and place your PDF or TXT files inside it.")
        sys.exit(1)

    # -------------------------------------------------------------
    # STEP 3: LOAD THE DOCUMENTS
    # -------------------------------------------------------------
    # Think of this as opening the books we want our AI to learn from.
    #
    # A vector database cannot directly read a PDF or TXT file on disk.
    # First, we need to extract the actual text from the files.
    #
    # So the flow is:
    #   PDF / TXT File  -->  Extract Text  -->  Python Document Objects
    #
    # File ≠ Searchable Knowledge!
    # A PDF file like 'lecture.pdf' becomes Page 1 text, Page 2 text, etc.
    # -------------------------------------------------------------
    print("[1/6] Loading documents from source folder...")

    raw_documents = []
    supported_files_found = 0

    # Scan the data folder for supported files (.txt and .pdf)
    for filename in sorted(os.listdir(DATA_PATH)):
        file_path = os.path.join(DATA_PATH, filename)

        if filename.endswith(".txt"):
            supported_files_found += 1
            loader = TextLoader(file_path, encoding="utf-8")
            loaded_docs = loader.load()
            raw_documents.extend(loaded_docs)
            print(f"  • Loaded text file: {filename} ({len(loaded_docs)} document)")

        elif filename.endswith(".pdf"):
            supported_files_found += 1
            loader = PyPDFLoader(file_path)
            loaded_docs = loader.load()
            raw_documents.extend(loaded_docs)
            print(f"  • Loaded PDF file:  {filename} ({len(loaded_docs)} page(s))")

    # Error Check 2: Ensure we found supported files
    if supported_files_found == 0 or len(raw_documents) == 0:
        print("❌ Error: No PDF or TXT files found in the 'data/' folder.")
        print("   Please add at least one .pdf or .txt file and try again.")
        sys.exit(1)

    print(f"✓ Total raw document pages/files loaded: {len(raw_documents)}")
    print()

    # -------------------------------------------------------------
    # STEP 4: INSPECT THE LOADED DOCUMENT
    # -------------------------------------------------------------
    # Before we cut our documents into smaller pieces, let's look at
    # what the loader actually produced.
    # We are inspecting the raw material before processing it!
    # -------------------------------------------------------------
    print("[2/6] Inspecting loaded documents...")
    sample_doc = raw_documents[0]
    preview_text = sample_doc.page_content[:300].replace("\n", " ")

    print(f"  Example Document Source: {sample_doc.metadata.get('source', 'Unknown')}")
    print(f"  Total Characters in Document: {len(sample_doc.page_content)}")
    print(f"  Text Preview (First ~300 chars):")
    print(f"  \"{preview_text}...\"")
    print()

    # -------------------------------------------------------------
    # STEP 5: CHUNKING (SPLIT DOCUMENTS)
    # -------------------------------------------------------------
    # Why do we chunk?
    #
    # A 50-page document or a giant text file should NOT become one
    # massive embedding. If you embed a whole book, key details get lost!
    #
    # Instead, we break big text into small, meaningful pieces:
    #
    #   Large Document  -->  Small Meaningful Pieces  -->  Embeddings  -->  Vector DB
    #
    # Configurable Parameters:
    # - chunk_size: How much text should one chunk roughly contain? (in characters)
    # - chunk_overlap: How much information is repeated between neighboring chunks
    #                  so we don't lose context across boundaries?
    #
    # Visualizing Chunk Overlap:
    #   Chunk 1: [ A  B  C  D  E ]
    #   Chunk 2:       [ D  E  F  G  H ]
    #   (D and E are repeated overlap to preserve meaning across split points)
    # -------------------------------------------------------------
    print("[3/6] Chunking documents into smaller pieces...")

    chunk_size = 500
    chunk_overlap = 50

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", " ", ""]
    )

    chunks = text_splitter.split_documents(raw_documents)

    print(f"  Configuration : chunk_size={chunk_size}, chunk_overlap={chunk_overlap}")
    print(f"  Original Docs : {len(raw_documents)} pages/files")
    print(f"  Chunks Created: {len(chunks)} chunks")

    # Display a preview of the first chunk
    sample_chunk_text = chunks[0].page_content.replace("\n", " ")
    print(f"  Example Chunk Preview:")
    print(f"  \"{sample_chunk_text[:200]}...\"")
    print()

    # -------------------------------------------------------------
    # STEP 6: EXPLAIN CHUNKING BEFORE EMBEDDINGS
    # -------------------------------------------------------------
    # Key Concept Check:
    #
    # At this point, we have NOT used any AI yet!
    # We simply took a large amount of text and divided it into
    # smaller, searchable pieces.
    #
    # The next crucial question is:
    # "How does a computer understand the meaning of these text pieces?"
    #
    # That is where Embeddings come in!
    # -------------------------------------------------------------

    # -------------------------------------------------------------
    # STEP 7: CREATE EMBEDDINGS (TEXT -> NUMBERS)
    # -------------------------------------------------------------
    # An embedding model converts human text into a list of numbers (a vector).
    #
    # For example, the sentence:
    #   "Library opens at 8 AM"
    #
    # might become a vector like (illustrative values):
    #   [0.12, -0.43, 0.87, 0.05, ...]
    #
    # We don't write these numbers by hand—the AI model creates them!
    #
    # The Core Idea:
    #   Meaning  -->  Numbers (Vector Space)
    #
    # Words with similar meanings will get vectors that are close
    # to each other in vector space!
    # -------------------------------------------------------------
    print("[4/6] Loading local HuggingFace embedding model...")
    model_name = "sentence-transformers/all-MiniLM-L6-v2"

    try:
        embedding_model = HuggingFaceEmbeddings(model_name=model_name)
        print(f"✓ Model '{model_name}' loaded successfully!")
    except Exception as e:
        print(f"❌ Error loading HuggingFace embedding model: {e}")
        print("   Please verify that 'sentence-transformers' and 'langchain-huggingface' are installed.")
        sys.exit(1)

    # -------------------------------------------------------------
    # STEP 8: DEMONSTRATE ONE EMBEDDING
    # -------------------------------------------------------------
    # Let's convert our very first chunk into an embedding vector
    # so we can see what it actually looks like!
    # -------------------------------------------------------------
    print("  Generating sample embedding vector for Chunk #1...")
    sample_vector = embedding_model.embed_query(chunks[0].page_content)

    print(f"✓ Embedding generated successfully!")
    print(f"  Vector Dimensions : {len(sample_vector)} floating-point numbers")
    print(f"  First 5 Numbers   : {[round(num, 4) for num in sample_vector[:5]]}")
    print("  (We have converted human text into numerical AI representation!)")
    print()

    # -------------------------------------------------------------
    # STEP 9 & 10: CREATE VECTOR DB & STORE CHUNKS
    # -------------------------------------------------------------
    # The Vector Database is our searchable AI memory.
    #
    # For every chunk, Chroma stores 3 key pieces of information:
    #
    #   Vector Database Store
    #   ├── 1. Numerical Vector (Embedding)  --> Used for fast mathematical similarity search
    #   ├── 2. Original Text Chunk          --> Retrieved to feed into an LLM later
    #   └── 3. Metadata (source file, page) --> Used to cite sources
    #
    # The process:
    #   Chunk  -->  Embedding Model  -->  Chroma Storage
    # -------------------------------------------------------------
    print("[5/6] Creating local persistent Chroma vector database...")

    try:
        # Chroma.from_documents automatically runs our embedding model on each chunk
        # and stores the resulting vectors inside DB_PATH.
        vector_db = Chroma.from_documents(
            documents=chunks,
            embedding=embedding_model,
            persist_directory="./chroma_db"
        )
        print(f"✓ Stored {len(chunks)} chunks & embeddings into '{DB_PATH}'!")
    except Exception as e:
        print(f"❌ Error creating Chroma database: {e}")
        sys.exit(1)

    print()

    # -------------------------------------------------------------
    # STEP 11: PERSIST THE DATABASE
    # -------------------------------------------------------------
    # We use a persistent directory (./chroma_db) so our AI memory
    # is saved locally on your hard disk.
    #
    # We don't want our AI memory to disappear every time Python stops!
    #
    # Flow:
    #   Python Script  -->  Chroma Engine  -->  Disk Directory (./chroma_db)
    # -------------------------------------------------------------

    # -------------------------------------------------------------
    # STEP 12: VERIFY THE INGESTION PIPELINE
    # -------------------------------------------------------------
    # Let's test our freshly built database!
    # We will perform a simple SIMILARITY SEARCH query to prove that
    # Chroma can find relevant text based on mathematical closeness.
    # -------------------------------------------------------------
    print("[6/6] Verifying database with a test query...")
    test_query = "When is the campus library open?"
    print(f"  Test Query: \"{test_query}\"")

    # Perform similarity search to retrieve top 2 most relevant chunks
    retrieved_results = vector_db.similarity_search(test_query, k=2)

    print()
    print("  Top Retrieved Chunks from Vector Memory:")
    for idx, doc in enumerate(retrieved_results, start=1):
        source = doc.metadata.get("source", "Unknown")
        snippet = doc.page_content.replace("\n", " ")
        print(f"  [{idx}] Source: {source}")
        print(f"      Snippet: \"{snippet[:180]}...\"")
        print()

    # Final Ingestion Summary Banner
    print("=" * 60)
    print("              INGESTION COMPLETE!               ")
    print("=" * 60)
    print(f"  Documents Loaded    : {len(raw_documents)} file(s)/page(s)")
    print(f"  Total Chunks Created: {len(chunks)} text chunks")
    print(f"  Embedding Model     : {model_name}")
    print(f"  Vector Database     : Chroma ({os.path.abspath(DB_PATH)})")
    print("  Status              : Searchable AI Memory Ready! 🎉")
    print("=" * 60)


if __name__ == "__main__":
    main()

# """
# ===================================================================
#                   WHAT DID WE JUST BUILD?
# ===================================================================

# We started with:
#    PDF / TXT document files on disk

#         ↓ (Step 3: Load)

#    Extracted raw text into Python objects

#         ↓ (Step 5: Chunk)

#    Split raw text into smaller, meaningful chunks

#         ↓ (Step 7 & 8: Embed)

#    Converted each text chunk into a numerical vector (embedding)

#         ↓ (Step 9 & 10: Store)

#    Stored embeddings + text + metadata inside ChromaDB on disk

#         ↓ (Step 12: Verify)

#    Performed mathematical similarity search to retrieve knowledge!

# ===================================================================
#                CONCEPTUAL PIPELINE DISTINCTION
# ===================================================================

# 1. INGESTION (What we built today!):
#    Documents --> Load --> Chunk --> Embed --> Store in Vector DB

# 2. RETRIEVAL (Phase 2):
#    User Question --> Embed Question --> Search Vector DB --> Relevant Chunks

# 3. GENERATION (Phase 3):
#    Relevant Chunks + User Question --> LLM --> Accurate AI Answer

# ===================================================================
# Summary:
# We have built the KNOWLEDGE LAYER of RAG.
# Your documents are now machine-readable, indexed, and ready to answer
# student questions!
# ===================================================================
# """