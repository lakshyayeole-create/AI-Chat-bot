"""
===================================================================
DAY 2 HANDS-ON WORKSHOP: LLM BASICS + PROMPT ENGINEERING
(ZERO API KEY / ZERO DEPENDENCY EDUCATIONAL EDITION)
===================================================================

Goal: Understand how Large Language Models (LLMs) process prompts,
      learn system vs user message structures, and master Prompt Engineering
      without needing any API keys, paid accounts, or GPU hardware.

Pipeline Overview:
User Input / Context  -->  Prompt  -->  LLM Engine  -->  Better Response
"""

import sys
import time
import re

# =================================================================
# EDUCATIONAL MOCK LLM ENGINE (ZERO API KEY REQUIRED)
# =================================================================
# In a real application, you would connect to an LLM provider via
# an API key or a local server (like Ollama).
#
# To ensure this workshop works 100% reliably on any laptop—even on
# weak classroom Wi-Fi without credit cards or API keys—we built an
# educational LLM Simulator below.
#
# It simulates token processing, system message rules, persona adoption,
# constraint enforcement, and format compliance!
# =================================================================


class ZeroKeyLLMEngine:
    """
    An educational LLM Simulator that parses System & User messages,
    detects prompt constraints, and generates realistic responses
    to demonstrate Prompt Engineering principles.
    """

    def __init__(self, model_name="educational-gpt-v1"):
        self.model_name = model_name

    def chat_completion(self, messages):
        """Simulates an LLM API completion call."""
        system_prompt = ""
        user_prompt = ""

        # Extract system and user message contents
        for msg in messages:
            if msg.get("role") == "system":
                system_prompt = msg.get("content", "")
            elif msg.get("role") == "user":
                user_prompt = msg.get("content", "")

        full_prompt = f"{system_prompt}\n{user_prompt}".lower()

        # Simulate small API network latency (0.3 seconds)
        time.sleep(0.3)

        # ---------------------------------------------------------
        # PROMPT PATTERN MATCHING & SIMULATED GENERATION LOGIC
        # ---------------------------------------------------------

        # 1. RAG Prompt Template (Step 11)
        if "context (" in full_prompt or "library is open" in full_prompt:
            if "when does the library open" in full_prompt or "wednesday" in full_prompt:
                return (
                    "Based on the provided context, the Central Campus Library is open on "
                    "Wednesday from 8:00 AM to 9:00 PM."
                )

        # 2. Format Enforcement Experiment (Step 10)
        if "definition:" in full_prompt and "analogy:" in full_prompt:
            return (
                "Definition : Text embeddings are numerical vectors that represent the semantic meaning of words or sentences.\n"
                "Analogy    : Think of embeddings as GPS coordinates for ideas, placing similar concepts close together in space.\n"
                "Example    : The sentence 'The library is open' gets converted into numbers like [0.12, -0.45, 0.88]."
            )

        # 3. Persona Experiment - Professor Persona (Step 9 Prompt B)
        if "professor" in full_prompt or "library indexing" in full_prompt:
            return (
                "Hello class! Think of a vector database like a modern university library indexing system. "
                "Instead of filing books alphabetically, we index them by their deep meaning using mathematical coordinates! "
                "This allows our AI memory to find relevant concepts instantly!"
            )

        # 4. Persona Experiment - Generic Role (Step 9 Prompt A)
        if "vector databases in under 80 words" in full_prompt:
            return (
                "A vector database is a specialized database designed to store, manage, and index high-dimensional vector embeddings. "
                "It enables fast similarity searches by comparing distances between mathematical vectors rather than matching exact text keywords."
            )

        # 5. Clear Prompt Experiment (Step 8 Prompt B - Open book analogy + under 80 words)
        if "engineering student" in full_prompt or "open-book exam" in full_prompt or "maximum 80 words" in full_prompt:
            return (
                "RAG is like taking an open-book exam! Instead of relying only on what the AI memorized during training, "
                "RAG allows the AI to search a library of your documents first, find the right page, and read the relevant answer directly from your notes."
            )

        # 6. Vague Prompt Experiment (Step 8 Prompt A - "Explain RAG.")
        if full_prompt.strip() == "explain rag." or full_prompt.strip() == "explain rag":
            return (
                "Retrieval-Augmented Generation (RAG) is a computational framework in artificial intelligence that combines information retrieval systems "
                "with sequence-to-sequence generative language models. It addresses context window limitations, hallucination vulnerabilities, "
                "and parametric memory staleness by indexing unstructured corpora into vector space representations..."
            )

        # 7. System vs User Message Tutor (Step 6)
        if "freshmen" in full_prompt or "vector embeddings in simple language" in full_prompt:
            return (
                "Welcome to AI! Imagine every sentence gets a unique secret code made of numbers (like GPS coordinates). "
                "Sentences with similar meanings get code numbers that sit right next to each other in vector space! "
                "That code is called a vector embedding."
            )

        # 8. First LLM Call (Step 5)
        if "one sentence" in full_prompt and "rag" in full_prompt:
            return (
                "Retrieval-Augmented Generation (RAG) is a technique that lets AI search your external documents to answer questions with accurate, up-to-date information."
            )

        # 9. Interactive Mini Chatbot Fallback
        if "embedding" in full_prompt:
            return "An embedding turns human text into a list of numbers (a vector) so computers can compare sentence meanings mathematically!"
        elif "vector" in full_prompt or "database" in full_prompt:
            return "A vector database stores text embeddings and lets AI quickly find the most similar document chunks to answer user questions."
        elif "prompt" in full_prompt:
            return "A prompt is the instruction and context you give an LLM. Better prompts lead to significantly more accurate answers!"
        else:
            return (
                f"That's a great question! As an AI tutor, I process your input ('{user_prompt}') "
                "by matching your prompt's intent and generating a helpful response."
            )


def main():
    print("=" * 65)
    print("     DAY 2 — LLM BASICS & PROMPT ENGINEERING WORKSHOP     ")
    print("     (ZERO API KEY / 100% LOCAL EDUCATIONAL EDITION)      ")
    print("=" * 65)
    print()

    # -------------------------------------------------------------
    # STEP 2: CONFIGURATION
    # -------------------------------------------------------------
    # MODEL_NAME specifies which model we are asking to generate text.
    # Notice: We are USING a pretrained model, NOT training one!
    # -------------------------------------------------------------
    MODEL_NAME = "educational-gpt-v1"
    print(f"[1] Target Model Configuration: '{MODEL_NAME}'")

    # -------------------------------------------------------------
    # STEP 3: API KEY & CLIENT INITIALIZATION
    # -------------------------------------------------------------
    # NO API KEY NEEDED TODAY!
    # We initialize our local ZeroKeyLLMEngine client.
    # -------------------------------------------------------------
    client = ZeroKeyLLMEngine(model_name=MODEL_NAME)
    print("✓ Zero-Key Educational LLM Client initialized successfully!\n")

    # -------------------------------------------------------------
    # STEP 4: WHAT IS AN LLM? (MENTAL MODEL)
    # -------------------------------------------------------------
    # Before making our first call, let's understand what happens:
    #
    # An LLM (Large Language Model) is a neural network trained on
    # vast amounts of text. It processes text as small units called
    # 'tokens' and predicts the next most likely token.
    #
    # Mental Model:
    #   Text Input  -->  Tokens  -->  LLM Pattern Matching  -->  Next-Token Output
    #
    # What matters for application developers is:
    # WHAT goes into the model and WHAT comes out!
    # -------------------------------------------------------------

    # -------------------------------------------------------------
    # STEP 5: OUR FIRST LLM CALL
    # -------------------------------------------------------------
    # We send a simple question to see the basic interaction loop:
    #   Python  -->  API Request  -->  LLM  -->  API Response  -->  Python
    # -------------------------------------------------------------
    print("=" * 65)
    print("STEP 5: FIRST LLM API CALL")
    print("=" * 65)

    prompt_simple = "Explain what RAG (Retrieval-Augmented Generation) is in one sentence."

    print(f"\nUser Prompt:\n\"{prompt_simple}\"")
    print("\nSending request to LLM...")

    messages_step5 = [{"role": "user", "content": prompt_simple}]
    response_step5 = client.chat_completion(messages_step5)

    print(f"\nLLM Response:\n{response_step5}\n")

    # Explanation:
    # We gave the model an instruction + text, and it generated a response.
    # That is the basic LLM application loop!

    # -------------------------------------------------------------
    # STEP 6: UNDERSTANDING MESSAGES (SYSTEM VS USER)
    # -------------------------------------------------------------
    # The API doesn't just take a raw string. It takes a conversation structure!
    #
    # 1. SYSTEM Message : Defines the persona, role, behavior, or rules.
    # 2. USER Message   : Contains the student's actual request.
    # 3. ASSISTANT      : The response generated by the LLM.
    #
    # Structure:
    #   SYSTEM    : "You are a helpful AI tutor for college freshmen."
    #   USER      : "Explain vector embeddings in simple language."
    #      ↓
    #     LLM
    #      ↓
    #   ASSISTANT : "Welcome to AI! Sentences get secret number codes..."
    # -------------------------------------------------------------
    print("=" * 65)
    print("STEP 6: UNDERSTANDING SYSTEM VS USER MESSAGES")
    print("=" * 65)

    messages_step6 = [
        {"role": "system", "content": "You are a helpful, friendly AI tutor for college freshmen."},
        {"role": "user", "content": "Explain vector embeddings in simple language."}
    ]

    print("\nMessages Sent to API:")
    print(f"  [System] : \"{messages_step6[0]['content']}\"")
    print(f"  [User]   : \"{messages_step6[1]['content']}\"")

    response_step6 = client.chat_completion(messages_step6)
    print(f"\nLLM Response:\n{response_step6}\n")

    # -------------------------------------------------------------
    # STEP 7: INTRODUCTION TO PROMPT ENGINEERING
    # -------------------------------------------------------------
    # What is Prompt Engineering?
    # It is NOT finding a "magic trick" sentence.
    # It IS clearly communicating what you want the model to do!
    #
    # The 5 Core Components of a Great Prompt:
    # 1. ROLE        : Who should the model act like? (e.g., AI Professor)
    # 2. CONTEXT     : What background info does the model need?
    # 3. TASK        : What exact action should the model perform?
    # 4. CONSTRAINTS : What boundaries or rules must the model follow?
    # 5. OUTPUT      : What format should the answer be in?
    # -------------------------------------------------------------

    # -------------------------------------------------------------
    # STEP 8: EXPERIMENT #1 — VAGUE VS CLEAR PROMPT
    # -------------------------------------------------------------
    # Compare how much better the output is when we provide constraints!
    # -------------------------------------------------------------
    print("=" * 65)
    print("EXPERIMENT 1: VAGUE PROMPT vs CLEAR PROMPT")
    print("=" * 65)

    prompt_vague = "Explain RAG."

    prompt_clear = """
You are teaching RAG (Retrieval-Augmented Generation) to a first-year engineering student.

Explain RAG using:
- Simple language suitable for beginners
- Exactly one real-world analogy (e.g., taking an open-book exam)
- Maximum 80 words

Do not use complex mathematical or machine learning jargon.
"""

    print(f"\n--- PROMPT A (Vague) ---\n\"{prompt_vague}\"")
    resp_vague = client.chat_completion([{"role": "user", "content": prompt_vague}])
    print(f"\nResponse A (Generic & Overly Complex):\n{resp_vague}\n")

    print(f"--- PROMPT B (Clear & Structured) ---\n\"{prompt_clear.strip()}\"")
    resp_clear = client.chat_completion([{"role": "user", "content": prompt_clear}])
    print(f"\nResponse B (Targeted & Beginner-Friendly):\n{resp_clear}\n")

    print("💡 WHAT DID WE LEARN?")
    print("   The model didn't get smarter! We simply gave it clearer instructions.")
    print("   A clear prompt reduces the number of things the model has to guess.\n")

    # -------------------------------------------------------------
    # STEP 9: EXPERIMENT #2 — ROLE / PERSONA IMPACT
    # -------------------------------------------------------------
    # Demonstrates how assigning a persona changes tone and style.
    # -------------------------------------------------------------
    print("=" * 65)
    print("EXPERIMENT 2: PERSONA / ROLE EXPERIMENT")
    print("=" * 65)

    prompt_role_a = "Explain vector databases in under 80 words."

    prompt_role_b = """
You are a college professor teaching first-year CS students.

Explain vector databases using a university library indexing system analogy.
Keep your explanation enthusiastic and under 80 words.
"""

    print(f"\n--- PROMPT A (No Persona) ---\n\"{prompt_role_a}\"")
    resp_role_a = client.chat_completion([{"role": "user", "content": prompt_role_a}])
    print(f"\nResponse A:\n{resp_role_a}\n")

    print(f"--- PROMPT B (Professor Persona + Library Analogy) ---\n\"{prompt_role_b.strip()}\"")
    resp_role_b = client.chat_completion([{"role": "user", "content": prompt_role_b}])
    print(f"\nResponse B:\n{resp_role_b}\n")

    print("💡 WHAT DID WE LEARN?")
    print("   Assigning a ROLE guides the tone, vocabulary, and perspective of the LLM.\n")

    # -------------------------------------------------------------
    # STEP 10: EXPERIMENT #3 — EXPLICIT OUTPUT FORMATTING
    # -------------------------------------------------------------
    # Demonstrates how specifying output structure creates predictable outputs.
    # -------------------------------------------------------------
    print("=" * 65)
    print("EXPERIMENT 3: ENFORCING OUTPUT FORMAT")
    print("=" * 65)

    prompt_format = """
Explain text embeddings for college students.

Return the response strictly in this format:

Definition : <1 sentence definition>
Analogy    : <1 sentence real-world analogy>
Example    : <1 practical example sentence>

Keep each section strictly under 2 sentences.
"""

    print(f"\nPrompt with Explicit Format Request:\n\"{prompt_format.strip()}\"")
    resp_format = client.chat_completion([{"role": "user", "content": prompt_format}])
    print(f"\nFormatted Response:\n{resp_format}\n")

    print("💡 WHAT DID WE LEARN?")
    print("   If you don't specify format, the LLM picks one randomly.")
    print("   If you specify format, your application gets clean, predictable data!\n")

    # -------------------------------------------------------------
    # STEP 11: REUSABLE PROMPT TEMPLATE & RAG CONNECTION
    # -------------------------------------------------------------
    # How does Prompt Engineering connect to RAG?
    #
    # In Day 1, we ingested documents into ChromaDB.
    # In Day 2, we learned how to structure prompts for LLMs.
    # In Day 3, we will insert retrieved Chroma chunks directly INTO
    # the Context block of our Prompt Template!
    #
    # Let's see the Master Prompt Template in action:
    # -------------------------------------------------------------
    print("=" * 65)
    print("STEP 11: REUSABLE PROMPT TEMPLATE (THE RAG BRIDGE)")
    print("=" * 65)

    sample_retrieved_context = "The Central Campus Library is open Monday through Friday from 8:00 AM to 9:00 PM."
    student_question = "When does the library open on Wednesday?"

    rag_prompt_template = f"""
Role:
You are a helpful University Campus Information Assistant.

Context (Information retrieved from document memory):
\"\"\"{sample_retrieved_context}\"\"\"

Task:
Answer the student's question accurately using ONLY the provided context.

Constraint:
If the answer cannot be found in the context, reply with:
"I am sorry, but I do not have that information in my database."
Do not make up facts outside the context.

Student Question:
\"{student_question}\"

Output Format:
Give a direct, friendly answer in 1-2 sentences.
"""

    print(f"\nAssembled RAG Prompt Template:\n{rag_prompt_template.strip()}")
    resp_rag = client.chat_completion([{"role": "user", "content": rag_prompt_template}])
    print(f"\nGrounded LLM Answer:\n{resp_rag}\n")

    # -------------------------------------------------------------
    # STEP 12: INTERACTIVE MINI CHATBOT
    # -------------------------------------------------------------
    # Now students can test their own questions interactively!
    # -------------------------------------------------------------
    print("=" * 65)
    print("STEP 12: INTERACTIVE MINI LLM CHATBOT")
    print("=" * 65)
    print("Type your question below to chat with the LLM.")
    print("Type 'exit' or 'quit' to end the session.\n")

    system_instruction = "You are a patient, encouraging AI tutor helping college students learn AI."

    while True:
        try:
            user_input = input("You > ").strip()
            if not user_input:
                continue
            if user_input.lower() in ["exit", "quit", "q"]:
                print("\nEnding chat session. Great job today! 👋\n")
                break

            chat_messages = [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": user_input}
            ]

            print("LLM > ", end="", flush=True)
            bot_response = client.chat_completion(chat_messages)
            print(f"{bot_response}\n")

        except (KeyboardInterrupt, EOFError):
            print("\nExiting chat session. Goodbye!")
            break

    # Final Summary Banner
    print("=" * 65)
    print("              DAY 2 WORKSHOP COMPLETE!               ")
    print("=" * 65)


if __name__ == "__main__":
    main()

"""
===================================================================
                  WHAT DID WE LEARN TODAY?
===================================================================

1. AN LLM IS A PATTERN MATCHER:
   It takes tokens as input and predicts output tokens based on patterns.

2. API INTERACTION LOOP:
   Python Code  -->  HTTP API Request  -->  LLM  -->  Response

3. MESSAGE ROLES:
   - System Message : Establishes persona, behavior, constraints.
   - User Message   : Contains the actual user input/question.
   - Assistant      : The LLM's response.

4. PROMPT ENGINEERING 5 CORE COMPONENTS:
   Role + Context + Task + Constraints + Output Format

5. CLEAR vs VAGUE PROMPTS:
   Adding clear constraints makes the LLM predictable without needing
   to retrain or fine-tune any model weights.

6. THE BRIDGE TO FULL RAG:
   Day 1 : Built the Vector Database (Document Memory)
   Day 2 : Mastered LLM calls & Prompt Construction
   Day 3 : Combine Vector DB Retrieval + LLM Generation = Full RAG!

===================================================================
"""