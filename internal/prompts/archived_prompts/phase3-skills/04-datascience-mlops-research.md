# Phase 3.4; Data Science + MLOps + Research Skills

## Task
Port data science, MLOps, and research skills. These cover Jupyter notebooks, ML model management (HuggingFace, vLLM, llama.cpp), model evaluation, image/audio models, and academic research tools.

## Data Science
- **jupyter-live-kernel**: Interactive Python via live Jupyter kernel

## MLOps
- **huggingface-hub**: HuggingFace hf CLI; search/download/upload models, datasets

## MLOps / Evaluation
- **evaluating-llms-harness**: lm-eval-harness; benchmark LLMs (MMLU, GSM8K, etc.)
- **weights-and-biases**: W&B; log ML experiments, sweeps, model registry, dashboards

## MLOps / Inference
- **llama-cpp**: llama.cpp local GGUF inference + HF Hub model discovery
- **obliteratus**: Abliterate LLM refusals (diff-in-means technique)
- **serving-llms-vllm**: vLLM; high-throughput LLM serving, OpenAI-compatible API, quantization

## MLOps / Models
- **audiocraft-audio-generation**: AudioCraft/MusicGen text-to-music, text-to-sound
- **segment-anything-model**: SAM; zero-shot image segmentation via points, boxes, masks

## MLOps / Research
- **dspy**: DSPy; declarative LM programs, auto-optimize prompts, RAG pipelines

## Research
- **archive-exploration**: Systematically explore large digital archives
- **arxiv**: Search arXiv papers by keyword, author, category, or ID
- **blogwatcher**: Monitor blogs and RSS/Atom feeds via blogwatcher-cli tool
- **comprehensive-investigation**: Systematic deep-dive methodology for exploring data sources
- **data-forensics**: Exhaustive exploration of external drives, remote servers
- **llm-wiki**: Karpathy's LLM Wiki; build/query interlinked markdown knowledge base
- **polymarket**: Query Polymarket; markets, prices, orderbooks, history

## Porting instructions
MLOps skills check for Python environment and required packages (torch, transformers, vllm, etc.).
Research skills handle rate limits and caching for external APIs (arXiv, Polymarket).
Each skill includes installation steps for missing dependencies.
