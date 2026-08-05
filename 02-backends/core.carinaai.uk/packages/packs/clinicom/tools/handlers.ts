const MEDICAL_TERMS = [
  'pain',
  'fever',
  'blood',
  'breathing',
  'medicine',
  'tablet',
  'cough',
  'wound',
  'headache',
  'nausea',
] as const;

const JARGON: Record<string, string> = {
  hypertension: 'high blood pressure',
  'myocardial infarction': 'heart attack',
  dyspnea: 'shortness of breath',
  pyrexia: 'fever',
  analgesic: 'pain relief medicine',
  antibiotic: 'medicine that fights infection',
};

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  pl: 'Polish',
  ur: 'Urdu',
  bn: 'Bengali',
  ar: 'Arabic',
};

const V2_TOOL_SOURCE = 'carina-clinicom-stub';
const GEMINI_MODEL = process.env.CLINICOM_GEMINI_MODEL ?? 'gemini-flash-latest';

export function extractMedicalTerms(text: string): string[] {
  const lowered = text.toLowerCase();
  return MEDICAL_TERMS.filter((term) => lowered.includes(term));
}

export function languageLabel(code: string): string {
  return LANGUAGE_LABELS[code.toLowerCase()] ?? code.toUpperCase();
}

export function simplifyText(text: string, targetReadingLevel = 8): string {
  let simplified = text.trim();
  for (const [jargon, plain] of Object.entries(JARGON)) {
    simplified = simplified.replace(new RegExp(jargon, 'gi'), plain);
  }
  const sentences = simplified.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (targetReadingLevel <= 8 && sentences.length > 3) {
    simplified = sentences.slice(0, 3).join(' ');
  }
  return simplified;
}

export function estimateReadingLevel(text: string): Record<string, number> {
  const words = text.match(/[A-Za-z']+/g) ?? [];
  const sentences = Math.max(1, (text.match(/[.!?]+/g) ?? []).length || 1);
  const syllables = words.reduce((sum, word) => sum + Math.max(1, (word.match(/[aeiouyAEIOUY]+/g) ?? []).length), 0);
  if (!words.length) {
    return { flesch_kincaid_grade: 8, word_count: 0 };
  }
  const grade = 0.39 * (words.length / sentences) + 11.8 * (syllables / words.length) - 15.59;
  return {
    flesch_kincaid_grade: Math.round(Math.min(12, Math.max(3, grade)) * 10) / 10,
    word_count: words.length,
  };
}

function contextSnippet(context: unknown, limit = 280): string {
  if (!context) return '';
  const text = typeof context === 'string'
    ? context
    : JSON.stringify(context);
  return text.replace(/\s+/g, ' ').trim().slice(0, limit);
}

function geminiApiKey(): string {
  return (
    process.env.GEMINI_API_KEY
    ?? process.env.KEPRIX_GEMINI_API_KEY
    ?? process.env.GOOGLE_API_KEY
    ?? process.env.CLINICOM_GEMINI_API_KEY
    ?? ''
  ).trim();
}

async function geminiGenerate(prompt: string): Promise<string | null> {
  const apiKey = geminiApiKey();
  if (!apiKey) return null;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
    }),
  });
  if (!response.ok) return null;
  const data = await response.json() as any;
  const candidate = data?.candidates?.[0];
  const parts = candidate?.content?.parts;
  if (!Array.isArray(parts)) return null;
  const text = parts.map((part: any) => String(part?.text ?? '').trim()).filter(Boolean).join('\n').trim();
  return text || null;
}

async function geminiGenerateJson(prompt: string): Promise<Record<string, unknown> | null> {
  const raw = await geminiGenerate(prompt);
  if (!raw) return null;
  try {
    const payload = JSON.parse(raw);
    return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as Record<string, unknown> : null;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      const payload = JSON.parse(match[0]);
      return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as Record<string, unknown> : null;
    } catch {
      return null;
    }
  }
}

function jsonResponse(payload: Record<string, unknown>): string {
  return JSON.stringify(payload);
}

function decodeBase64Utf8(value: string): string {
  try {
    return Buffer.from(value, 'base64').toString('utf8').trim();
  } catch {
    return '';
  }
}

export async function executeClinicomTranscribe(params: Record<string, unknown>) {
  const audio = String(params.audio ?? params.audio_b64 ?? '');
  const languageHint = String(params.language_hint ?? params.language ?? 'en');
  const sample = decodeBase64Utf8(audio);
  const text = sample || 'Demo transcription from the Carina Clinicom sidecar.';
  return {
    text,
    detected_language: languageHint,
    confidence: 0.93,
    duration_seconds: Math.max(1, text.split(/\s+/).length / 2),
    source: 'carina-clinicom-stub',
  };
}

export async function executeClinicomTranslate(params: Record<string, unknown>) {
  const text = String(params.text ?? '');
  const sourceLanguage = String(params.source_language ?? params.src_lang ?? 'en');
  const targetLanguage = String(params.target_language ?? params.tgt_lang ?? 'en');
  const translated = sourceLanguage === targetLanguage
    ? text
    : `[${languageLabel(targetLanguage)}] ${text}`;
  return {
    translated_text: translated,
    source_language: sourceLanguage,
    target_language: targetLanguage,
    medical_terms_detected: extractMedicalTerms(text),
    confidence: 0.9,
    source: 'carina-clinicom-stub',
  };
}

export async function executeClinicomSimplify(params: Record<string, unknown>) {
  const text = String(params.text ?? '');
  const targetReadingLevel = Number(params.target_reading_level ?? 8);
  const context = String(params.context ?? 'general-practice');
  if (text.trim() && geminiApiKey()) {
    const gemini = await geminiGenerate(
      `Rewrite this clinical or product text in plain language. `
      + `Target reading level roughly UK year ${targetReadingLevel}. `
      + `Keep meaning. Do not invent facts, user counts, certifications, or medical advice. `
      + `Context label: ${context}. Return only the rewritten text.\n\n${text}`,
    );
    if (gemini) {
      return {
        simplified_text: gemini,
        readability_scores: estimateReadingLevel(gemini),
        medical_terms_preserved: extractMedicalTerms(text),
        confidence: 0.87,
        source: 'carina-gemini',
      };
    }
  }
  const simplified = simplifyText(text, targetReadingLevel);
  return {
    simplified_text: simplified,
    readability_scores: estimateReadingLevel(simplified),
    medical_terms_preserved: extractMedicalTerms(text),
    confidence: 0.88,
    source: 'carina-clinicom-stub',
  };
}

export async function executeClinicomProductHelp(params: Record<string, unknown>) {
  const question = String(params.question ?? '').trim();
  const grounding = String(params.grounding_corpus ?? '').trim().slice(0, 14000);
  const capabilities = String(params.capabilities_summary ?? '').trim().slice(0, 2400);
  if (!question) {
    return {
      answer: 'Ask a Clinicom product question.',
      grounded: false,
      confidence: 0,
      source: V2_TOOL_SOURCE,
      mode: 'refuse',
    };
  }
  if (geminiApiKey()) {
    const gemini = await geminiGenerateJson(
      [
        'Return JSON only with keys answer (string), grounded (boolean), confidence (number 0-1), mode (string).',
        'You are Ask Clinicom product help for Clinicom AI (Healthcare Communication Intelligence).',
        'Use ONLY the grounding corpus and capabilities summary. Additive help: explain Clinicom surfaces, interpreter vs dashboard, roles, sidecar tools, pricing location, trust posture, and how deep AI tools support clinicians.',
        'Rules:',
        '- Not medical advice. If the user wants diagnosis, treatment, or prescribing, refuse clearly.',
        '- Do not invent live user counts, revenue, certifications, phishing secrets, or URLs missing from grounding.',
        '- If grounding is insufficient, set grounded=false, mode="refuse", and answer exactly: INSUFFICIENT_GROUNDING',
        '- Prefer clear clinician- and practice-manager language. Mention relevant Clinicom paths (/app, /dashboard, /docs, /status) when they appear in grounding.',
        `Question: ${question}`,
        `Capabilities summary: ${capabilities || 'unavailable'}`,
        `Grounding corpus:\n${grounding || '(empty)'}`,
      ].join('\n'),
    );
    if (gemini) {
      const answer = String(gemini.answer ?? '').trim();
      const grounded = Boolean(gemini.grounded) && Boolean(answer) && !/^INSUFFICIENT_GROUNDING$/i.test(answer);
      return {
        answer: answer || 'INSUFFICIENT_GROUNDING',
        grounded,
        confidence: Number(gemini.confidence ?? (grounded ? 0.7 : 0)) || 0,
        mode: grounded ? String(gemini.mode || 'sidecar') : 'refuse',
        source: 'carina-gemini',
      };
    }
  }
  // Deterministic fallback when Gemini is offline: prefer a clean primary answer if present.
  if (grounding) {
    const primary = grounding.match(/Primary grounded answer:\s*([\s\S]*?)(?:\n\nFAQ|\n\nDOC|$)/i);
    if (primary?.[1]?.trim()) {
      return {
        answer: primary[1].trim().slice(0, 1200),
        grounded: true,
        confidence: 0.7,
        mode: 'docs',
        source: V2_TOOL_SOURCE,
      };
    }
    const excerpt = grounding.replace(/\s+/g, ' ').trim().slice(0, 420);
    return {
      answer: excerpt,
      grounded: true,
      confidence: 0.55,
      mode: 'docs',
      source: V2_TOOL_SOURCE,
    };
  }
  return {
    answer: 'INSUFFICIENT_GROUNDING',
    grounded: false,
    confidence: 0,
    mode: 'refuse',
    source: V2_TOOL_SOURCE,
  };
}

export async function executeClinicomSpeak(params: Record<string, unknown>) {
  const text = String(params.text ?? '');
  const language = String(params.language ?? 'en');
  const audioBase64 = Buffer.from(text, 'utf8').toString('base64');
  return {
    audio_base64: audioBase64,
    format: 'mp3',
    duration_seconds: Math.max(1, text.split(/\s+/).length / 2),
    language,
    source: 'carina-clinicom-stub',
  };
}

export async function executeClinicomCulturalAdapt(params: Record<string, unknown>) {
  const text = String(params.text ?? '');
  const sourceLanguage = String(params.source_language ?? 'en');
  const targetLanguage = String(params.target_language ?? 'en');
  const context = contextSnippet(params.context ?? params.session_context);
  if (geminiApiKey()) {
    const gemini = await geminiGenerateJson(
      `Return JSON only with keys cultural_notes, candidate_phrases, rationale, confidence. You are assisting a clinical interpreter. Preserve meaning and do not add advice. Source language: ${languageLabel(sourceLanguage)}. Target language: ${languageLabel(targetLanguage)}. Context: ${context || 'general-practice'}. Text: ${text}`,
    );
    if (gemini) {
      return { ...gemini, source: 'carina-gemini' };
    }
  }
  const notes = extractMedicalTerms(text);
  return {
    cultural_notes: notes.length ? notes.slice(0, 4) : ["Check the phrasing against the patient's stated preferences."],
    candidate_phrases: text ? [text.slice(0, 120)] : [],
    rationale: 'Deterministic continuity response from the Carina pack.',
    confidence: 0.74,
    source: V2_TOOL_SOURCE,
  };
}

export async function executeClinicomTeachbackScore(params: Record<string, unknown>) {
  const response = String(params.patient_response ?? '');
  const keyPoints = Array.isArray(params.key_points) ? params.key_points.map((item) => String(item)) : [];
  const context = contextSnippet(params.context ?? params.session_context);
  if (geminiApiKey()) {
    const gemini = await geminiGenerateJson(
      `Return JSON only with keys score, strengths, gaps, follow_up_question, coaching_tips, confidence. Score how well the patient response matches the plan. Keep the clinician as author. Context: ${context || 'general-practice'}. Key points: ${JSON.stringify(keyPoints)}. Response: ${response}`,
    );
    if (gemini) {
      return { ...gemini, source: 'carina-gemini' };
    }
  }
  const gaps = keyPoints.filter((point) => point && !response.toLowerCase().includes(point.toLowerCase()));
  let score = response.trim() ? 80 : 0;
  if (gaps.length) {
    score = Math.max(40, score - Math.min(30, gaps.length * 6));
  }
  return {
    score,
    strengths: keyPoints.slice(0, 2),
    gaps: gaps.slice(0, 4),
    follow_up_question: 'Can you tell me the plan back in your own words?',
    coaching_tips: ['Ask for the medicine name', 'Confirm when to seek help', 'Repeat the red flags'],
    confidence: 0.8,
    source: V2_TOOL_SOURCE,
  };
}

export async function executeClinicomSafetyTriageAssist(params: Record<string, unknown>) {
  const text = String(params.text ?? '');
  const safetyTerms = Array.isArray(params.safety_terms) ? params.safety_terms.map((item) => String(item)) : [];
  const context = contextSnippet(params.context ?? params.session_context);
  if (geminiApiKey()) {
    const gemini = await geminiGenerateJson(
      `Return JSON only with keys urgency, reasons, checklist, confidence. You are assisting clinical safety triage; never auto-acknowledge or replace a clinician. Context: ${context || 'general-practice'}. Safety terms: ${JSON.stringify(safetyTerms)}. Text: ${text}`,
    );
    if (gemini) {
      return { ...gemini, source: 'carina-gemini' };
    }
  }
  return {
    urgency: safetyTerms.length ? 'high' : 'normal',
    reasons: safetyTerms.length ? safetyTerms : ['No explicit red-flag terms supplied'],
    checklist: [
      'Review the safety message',
      'Confirm clinician acknowledgment',
      'Do not auto-file or auto-discharge',
    ],
    confidence: 0.82,
    source: V2_TOOL_SOURCE,
  };
}

export async function executeClinicomSessionDigest(params: Record<string, unknown>) {
  const context = (params.context ?? params.session_context) as Record<string, unknown> | undefined;
  const recentMessages = Array.isArray(context?.recent_messages) ? context?.recent_messages as Array<Record<string, unknown>> : [];
  const summary = recentMessages
    .map((item) => String(item.summary ?? item.text ?? '').trim())
    .filter(Boolean)
    .join(' ');
  if (geminiApiKey()) {
    const gemini = await geminiGenerateJson(
      `Return JSON only with keys digest, summary_points, languages, safety_flags, confidence. Write a short encounter memory digest for the next clinician turn. Context: ${JSON.stringify(context ?? {}).slice(0, 2400)}`,
    );
    if (gemini) {
      return { ...gemini, source: 'carina-gemini' };
    }
  }
  return {
    digest: (summary || 'No prior encounter summary available.').slice(0, 280),
    summary_points: recentMessages.slice(0, 4).map((item) => String(item.summary ?? item.text ?? '')),
    languages: Array.isArray(context?.languages) ? context?.languages : [],
    safety_flags: Array.isArray(context?.safety_flags) ? context?.safety_flags : [],
    confidence: 0.76,
    source: V2_TOOL_SOURCE,
  };
}

export async function executeClinicomSpecialtySimplify(params: Record<string, unknown>) {
  const text = String(params.text ?? '');
  const specialtyPackId = String(params.specialty_pack_id ?? 'general');
  const targetReadingLevel = Number(params.target_reading_level ?? 8);
  const context = contextSnippet(params.context ?? params.session_context);
  if (geminiApiKey()) {
    const gemini = await geminiGenerateJson(
      `Return JSON only with keys simplified_text, specialty_pack_id, rationale, readability_scores, medical_terms_preserved, confidence. Rewrite the clinical text for the named specialty without changing meaning. Specialty pack: ${specialtyPackId}. Target reading level: ${targetReadingLevel}. Context: ${context || 'general-practice'}. Text: ${text}`,
    );
    if (gemini) {
      return { ...gemini, source: 'carina-gemini' };
    }
  }
  const simplified = simplifyText(text, targetReadingLevel);
  return {
    simplified_text: simplified,
    specialty_pack_id: specialtyPackId,
    rationale: 'Deterministic plain-language continuity output.',
    readability_scores: estimateReadingLevel(simplified),
    medical_terms_preserved: extractMedicalTerms(text),
    confidence: 0.82,
    source: V2_TOOL_SOURCE,
  };
}

export async function executeClinicomConfidenceExplain(params: Record<string, unknown>) {
  const score = Number(params.score ?? 0);
  const providerSources = params.provider_sources ?? {};
  const pipelineTiming = params.pipeline_timing ?? {};
  const stepStatus = params.step_status ?? [];
  const context = contextSnippet(params.context);
  if (geminiApiKey()) {
    const gemini = await geminiGenerateJson(
      `Return JSON only with keys score, explanation, factors, confidence. Explain pipeline confidence honestly from the provider sources and step timing. Context: ${context || 'general-practice'}. Score: ${score}. Provider sources: ${JSON.stringify(providerSources)}. Step status: ${JSON.stringify(stepStatus)}`,
    );
    if (gemini) {
      return { ...gemini, source: 'carina-gemini' };
    }
  }
  return {
    score,
    explanation: 'Confidence is estimated from the current pipeline sources and step timing.',
    factors: [
      'Provider source availability',
      'Latency profile',
      'Degradation status',
    ],
    confidence: 0.7,
    source: V2_TOOL_SOURCE,
  };
}

export type ClinicomToolRoute = 'transcribe' | 'translate' | 'simplify' | 'speak' | 'cultural_adapt' | 'teachback_score' | 'safety_triage_assist' | 'session_digest' | 'specialty_simplify' | 'confidence_explain' | 'product_help';

export async function dispatchClinicomTool(route: ClinicomToolRoute, params: Record<string, unknown>) {
  switch (route) {
    case 'transcribe':
      return executeClinicomTranscribe(params);
    case 'translate':
      return executeClinicomTranslate(params);
    case 'simplify':
      return executeClinicomSimplify(params);
    case 'speak':
      return executeClinicomSpeak(params);
    case 'cultural_adapt':
      return executeClinicomCulturalAdapt(params);
    case 'teachback_score':
      return executeClinicomTeachbackScore(params);
    case 'safety_triage_assist':
      return executeClinicomSafetyTriageAssist(params);
    case 'session_digest':
      return executeClinicomSessionDigest(params);
    case 'specialty_simplify':
      return executeClinicomSpecialtySimplify(params);
    case 'confidence_explain':
      return executeClinicomConfidenceExplain(params);
    case 'product_help':
      return executeClinicomProductHelp(params);
    default:
      return { error: `Unknown clinicom tool route: ${route}`, status: 'error' };
  }
}
