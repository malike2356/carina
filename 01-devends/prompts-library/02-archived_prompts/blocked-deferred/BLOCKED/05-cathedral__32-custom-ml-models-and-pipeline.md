# Prompt 32: Custom ML Models and Pipeline (Phase 05)

**Phase:** 05 - The Cathedral
**Priority:** P1
**Depends on:** Prompt 30 (Microservices Extracted)
**Target time:** 8-12 weeks (ML Engineers)
**Platform:** Triton Inference Server, BioBERT, mBART-50, Kubeflow

## What This Builds

Replaces third-party LLMs with custom, fine-tuned healthcare domain models served via **Triton Inference Server** on GPU clusters.

---

## Model Catalogue

1.  `lang-ner-medical-v3` -- BioBERT (<100ms)
2.  `lang-simplify-v4` -- T5-base fine-tuned (<500ms)
3.  `lang-translate-medical-v2` -- mBART-50 (<800ms)
4.  `safety-detect-v3` -- RoBERTa clinical safety classifier (<60ms)

---

## Acceptance Criteria

- [ ] Triton Inference Server hosts local model pipeline with GPU acceleration.
- [ ] Latency reduces below 500ms per interpretation step.
- [ ] MLflow tracks model versions and clinical safety metrics.
