import { z } from 'zod';

/** Field kinds of a FORM page. The public page renders them as native inputs. */
export const FORM_FIELD_TYPES = [
  'TEXT',
  'TEXTAREA',
  'EMAIL',
  'PHONE',
  'URL',
  'NUMBER',
  'DATE',
  'SELECT',
  'CHECKBOX',
  'CHOICE',
  'MULTI_CHOICE',
] as const;

export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

/** Types answered by picking from `options` (the ones that can score). */
const optionTypes: FormFieldType[] = ['SELECT', 'CHOICE', 'MULTI_CHOICE'];

export const formFieldSchema = z
  .object({
    /** Stable key: answers are keyed by it, so renaming the label keeps them. */
    id: z.string().regex(/^[a-z0-9-]{1,40}$/),
    type: z.enum(FORM_FIELD_TYPES),
    label: z.string().trim().min(1).max(120),
    required: z.boolean(),
    placeholder: z.string().trim().max(120).nullable().optional(),
    options: z.array(z.string().trim().min(1).max(120)).max(30).optional(),
    /** Score of each option, same order as `options`. Absent = 0. */
    points: z.array(z.number().int().min(-1000).max(1000)).max(30).optional(),
    /** CHOICE/MULTI_CHOICE: extra free-text answer ("Outro"). */
    allowOther: z.boolean().optional(),
    /** One answer per value within the cohort (e.g. one per email). */
    unique: z.boolean().optional(),
  })
  .refine(
    (field) =>
      !optionTypes.includes(field.type) || (field.options?.length ?? 0) > 0,
    { message: 'Lista precisa de ao menos uma opção', path: ['options'] },
  )
  .refine(
    (field) =>
      !(
        field.unique &&
        (field.type === 'CHECKBOX' || field.type === 'MULTI_CHOICE')
      ),
    {
      message: 'Este tipo de campo não pode ser de resposta única',
      path: ['unique'],
    },
  );

export const formConfigSchema = z
  .object({
    fields: z.array(formFieldSchema).max(30),
    /** LIST = every field on one screen; QUESTIONNAIRE = one per step. Absent = LIST. */
    mode: z.enum(['LIST', 'QUESTIONNAIRE']).optional(),
    /**
     * null/absent = only collect. POINTS = sum of the chosen options' points;
     * CORRECT = options with points > 0 are the right ones, score = questions
     * answered right. `show` = visitor sees the score after submitting.
     */
    scoring: z
      .object({ kind: z.enum(['POINTS', 'CORRECT']), show: z.boolean() })
      .nullable()
      .optional(),
    submitLabel: z.string().trim().min(1).max(40),
    successMessage: z.string().trim().min(1).max(300),
    /** Animated check with the success message. Absent = on. */
    successAnimation: z.boolean().optional(),
    /** Optional: after the success message, the visitor is sent here. */
    redirectUrl: z
      .string()
      .trim()
      .max(2000)
      .pipe(z.url({ protocol: /^https?$/ }))
      .nullable()
      .optional(),
    /** Answers per cohort; reaching it closes the form. null/absent = no limit. */
    maxResponses: z.number().int().min(1).max(1_000_000).nullable().optional(),
    /** Server-owned (set by close/reopen): PATCH keeps the stored values. */
    cohort: z.string().trim().min(1).max(60).optional(),
    closedAt: z.string().nullable().optional(),
  })
  .refine(
    (form) =>
      new Set(form.fields.map((field) => field.id)).size === form.fields.length,
    { message: 'Campos com id repetido', path: ['fields'] },
  );

export type FormField = z.infer<typeof formFieldSchema>;
export type FormConfig = z.infer<typeof formConfigSchema>;

/** Forms created before cohorts existed answer into cohort '1'. */
export function formCohort(form: Pick<FormConfig, 'cohort'>) {
  return form.cohort ?? '1';
}

/** Progress toward the response limit; null when the form has no limit. */
export function toFormLimit(
  form: FormConfig | null | undefined,
  current: number,
) {
  if (!form?.maxResponses) return null;

  return {
    max: form.maxResponses,
    current,
    cohort: formCohort(form),
    closed: Boolean(form.closedAt),
  };
}

export function defaultFormConfig(): FormConfig {
  return {
    fields: [
      { id: 'nome', type: 'TEXT', label: 'Nome', required: true },
      { id: 'email', type: 'EMAIL', label: 'Email', required: true },
    ],
    submitLabel: 'Enviar',
    successMessage: 'Obrigado! Recebemos sua resposta.',
  };
}

/** Snapshot stored per submission: label copied so later edits don't lose meaning. */
export type FormAnswer = {
  id: string;
  label: string;
  value: string | boolean | string[] | null;
};

const otherText = z.string().trim().min(1).max(500);

const valueSchemas: Record<
  FormFieldType,
  z.ZodType<string | boolean | string[]>
> = {
  TEXT: z.string().trim().max(500),
  TEXTAREA: z.string().trim().max(5000),
  EMAIL: z.string().trim().max(254).pipe(z.email()),
  // Brazilian number: DDD + landline (8 digits) or mobile (9 + 8). Stored
  // formatted, so "42988112334" and "(42) 98811-2334" match on `unique`.
  // ponytail: BR only, accept E.164 if forms go international.
  PHONE: z
    .string()
    .max(30)
    .transform((value) =>
      value.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, ''),
    )
    .pipe(z.string().regex(/^[1-9][1-9](9\d{8}|[2-8]\d{7})$/))
    .transform(
      (digits) =>
        `(${digits.slice(0, 2)}) ${digits.slice(2, -4)}-${digits.slice(-4)}`,
    ),
  URL: z
    .string()
    .trim()
    .max(2000)
    .pipe(z.url({ protocol: /^https?$/ })),
  NUMBER: z
    .string()
    .trim()
    .max(30)
    .refine((value) => Number.isFinite(Number(value))),
  DATE: z.iso.date(),
  SELECT: z.string().trim(),
  CHECKBOX: z.boolean(),
  CHOICE: z.string().trim().max(500),
  // ponytail: dedupes but keeps the visitor's order
  MULTI_CHOICE: z
    .array(otherText)
    .max(31)
    .transform((values) => [...new Set(values)]),
};

function isEmpty(value: unknown) {
  return (
    value === undefined ||
    value === null ||
    value === false ||
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0)
  );
}

/** Option answers must be in the list; "Outro" allows one free-text value. */
function isAllowedChoice(field: FormField, value: string | boolean | string[]) {
  const options = field.options ?? [];
  if (field.type === 'SELECT') return options.includes(value as string);
  if (field.type === 'CHOICE') {
    return options.includes(value as string) || Boolean(field.allowOther);
  }
  if (field.type === 'MULTI_CHOICE') {
    const others = (value as string[]).filter((v) => !options.includes(v));
    return (
      others.length === 0 || (Boolean(field.allowOther) && others.length === 1)
    );
  }
  return true;
}

/**
 * Validates raw answers against the form's fields. Returns the snapshot to
 * store, or the ids of the invalid fields. Unknown keys are dropped.
 */
export function validateFormAnswers(
  fields: FormField[],
  raw: Record<string, unknown>,
): { ok: true; answers: FormAnswer[] } | { ok: false; invalid: string[] } {
  const answers: FormAnswer[] = [];
  const invalid: string[] = [];

  for (const field of fields) {
    const value = raw[field.id];

    if (isEmpty(value)) {
      if (field.required) {
        invalid.push(field.id);
      } else {
        answers.push({
          id: field.id,
          label: field.label,
          value: field.type === 'CHECKBOX' ? false : null,
        });
      }
      continue;
    }

    const parsed = valueSchemas[field.type].safeParse(value);
    const valid = parsed.success && isAllowedChoice(field, parsed.data);

    if (!valid) {
      invalid.push(field.id);
      continue;
    }

    answers.push({ id: field.id, label: field.label, value: parsed.data });
  }

  return invalid.length ? { ok: false, invalid } : { ok: true, answers };
}

export type FormScore = { score: number; max: number };

/**
 * Scores the stored answers; null when the form only collects. Fields without
 * any points don't count (e.g. Nome/Email in a quiz).
 */
export function scoreFormAnswers(
  form: Pick<FormConfig, 'fields' | 'scoring'>,
  answers: FormAnswer[],
): FormScore | null {
  if (!form.scoring) return null;

  let score = 0;
  let max = 0;

  for (const field of form.fields) {
    if (!optionTypes.includes(field.type)) continue;
    const options = field.options ?? [];
    const points = options.map((_, index) => field.points?.[index] ?? 0);
    if (!points.some(Boolean)) continue;

    const value = answers.find((answer) => answer.id === field.id)?.value;
    const chosen = new Set(
      Array.isArray(value) ? value : typeof value === 'string' ? [value] : [],
    );
    const picked = options.flatMap((option, index) =>
      chosen.has(option) ? [points[index]] : [],
    );
    const multiple = field.type === 'MULTI_CHOICE';

    if (form.scoring.kind === 'CORRECT') {
      // Right = picked exactly the options with points (all of them when multiple).
      const right = options.filter((_, index) => points[index] > 0);
      max += 1;
      if (
        multiple
          ? right.length === chosen.size && right.every((o) => chosen.has(o))
          : picked.length === 1 && picked[0] > 0
      ) {
        score += 1;
      }
      continue;
    }

    score += picked.reduce((sum, point) => sum + point, 0);
    max += multiple
      ? points.filter((point) => point > 0).reduce((sum, p) => sum + p, 0)
      : Math.max(0, ...points);
  }

  return { score, max };
}

/** Public copy of the form: points stay on the server (they'd give the quiz away). */
export function toPublicForm(form: FormConfig | null) {
  if (!form) return form;

  return {
    ...form,
    fields: form.fields.map((field) => ({ ...field, points: undefined })),
  };
}

/**
 * Google Sheets goes through an Apps Script web app the agency deploys. Only
 * that fixed Google host is accepted, so the server-side POST can't be aimed
 * at internal addresses (SSRF).
 */
export const appsScriptUrlPattern =
  /^https:\/\/script\.google\.com\/macros\/s\/[\w-]{10,200}\/exec$/;

/** Payload for the Apps Script: header labels + one row in the same order. */
export function toSheetRow(
  form: { id: string; name: string },
  submission: {
    id: string;
    cohort: string;
    answers: FormAnswer[];
    score: number | null;
    createdAt: Date;
    ipAddress: string | null;
    countryCode: string | null;
    deviceType: string | null;
    browser: string | null;
    operatingSystem: string | null;
  },
) {
  const value = (answer: FormAnswer) =>
    answer.value === true
      ? 'Sim'
      : answer.value === false
        ? 'Não'
        : Array.isArray(answer.value)
          ? answer.value.join(', ')
          : answer.value;
  const scored = submission.score !== null;

  return {
    form,
    submissionId: submission.id,
    columns: [
      'Data',
      'Corte',
      ...(scored ? ['Nota'] : []),
      ...submission.answers.map((answer) => answer.label),
      'IP',
      'País',
      'Dispositivo',
    ],
    row: [
      submission.createdAt.toISOString(),
      submission.cohort,
      ...(scored ? [submission.score] : []),
      ...submission.answers.map(value),
      submission.ipAddress,
      submission.countryCode,
      [submission.deviceType, submission.browser, submission.operatingSystem]
        .filter(Boolean)
        .join(' · '),
    ],
  };
}
