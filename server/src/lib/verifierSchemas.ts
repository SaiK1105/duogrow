// Structured-output JSON Schemas for the three Anthropic calls (verify / extract /
// insights). Per SPEC.md + build notes: additionalProperties:false, every key
// listed in `required`, and nullable fields expressed as type:["<type>","null"].

export const VERDICT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["task_type", "matched_module", "confidence", "band", "evidence", "extracted_metrics", "coach_message"],
  properties: {
    task_type: {
      type: "string",
      enum: ["wake", "study", "workout", "diet", "task", "potd", "unknown"],
    },
    matched_module: {
      type: ["string", "null"],
      enum: ["wake", "study", "workout", "diet", "tasks", "potd", null],
      description: "The daily_entries module (or 'potd') this proof best matches, or null if nothing matches.",
    },
    confidence: {
      type: "integer",
      description: "0-100 calibrated confidence the proof genuinely shows the claimed activity.",
    },
    band: {
      type: "string",
      enum: ["high", "medium", "low"],
    },
    evidence: {
      type: "array",
      items: { type: "string" },
      description: "3-6 short bullets grounded ONLY in what is literally visible in the image/document.",
    },
    extracted_metrics: {
      type: "object",
      additionalProperties: false,
      required: [
        "study_minutes",
        "calories",
        "wake_time",
        "workout_name",
        "problem_title",
        "potd_status",
        "detected_text",
        "timestamp_visible",
      ],
      properties: {
        study_minutes: { type: ["integer", "null"] },
        calories: { type: ["integer", "null"] },
        wake_time: { type: ["string", "null"], description: "verbatim time shown, e.g. '06:42'" },
        workout_name: { type: ["string", "null"] },
        problem_title: { type: ["string", "null"] },
        potd_status: { type: ["string", "null"], enum: ["solved", "attempted", null] },
        detected_text: { type: ["string", "null"], description: "single most decisive text read from the proof" },
        timestamp_visible: { type: ["string", "null"], description: "verbatim on-screen date/time, or null" },
      },
    },
    coach_message: {
      type: "string",
      description: "1-2 warm, specific sentences in a friendly coach voice.",
    },
  },
} as const;

export const EXTRACT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["source_title", "questions"],
  properties: {
    source_title: { type: ["string", "null"] },
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "body", "topic", "difficulty", "source", "answer"],
        properties: {
          title: { type: "string", description: "short problem title, e.g. 'Two Sum'" },
          body: {
            type: "string",
            description: "full problem statement, verbatim, cleaned of headers/footers/page numbers",
          },
          topic: {
            type: "string",
            description: "e.g. Arrays, Dynamic Programming, Graphs, SQL; 'General' if unclear",
          },
          difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
          source: { type: "string" },
          answer: { type: ["string", "null"] },
        },
      },
    },
  },
} as const;

export const INSIGHTS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["prediction", "suggestion", "strength", "weeklyVerdict"],
  properties: {
    prediction: {
      type: "object",
      additionalProperties: false,
      required: ["forUser", "behavior", "riskPercent", "reason"],
      properties: {
        forUser: { type: "string" },
        behavior: { type: "string", description: "e.g. 'skip tomorrow's workout'" },
        riskPercent: { type: "integer", description: "0-100" },
        reason: { type: "string", description: "grounded in the 7-day data provided" },
      },
    },
    suggestion: { type: "string" },
    strength: { type: "string", description: "a genuine win, naming the member and the number" },
    weeklyVerdict: { type: "string" },
  },
} as const;
