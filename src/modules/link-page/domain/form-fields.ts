import { z } from 'zod';

/** Field kinds of a FORM page. The public page renders them as native inputs. */
export const FORM_FIELD_TYPES = [
  'TEXT',
  'TEXTAREA',
  'EMAIL',
  'PHONE',
  'NUMBER',
  'DATE',
  'SELECT',
  'CHECKBOX',
] as const;

export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

export const formFieldSchema = z
  .object({
    /** Stable key: answers are keyed by it, so renaming the label keeps them. */
    id: z.string().regex(/^[a-z0-9-]{1,40}$/),
    type: z.enum(FORM_FIELD_TYPES),
    label: z.string().trim().min(1).max(120),
    required: z.boolean(),
    placeholder: z.string().trim().max(120).nullable().optional(),
    options: z.array(z.string().trim().min(1).max(120)).max(30).optional(),
  })
  .refine(
    (field) => field.type !== 'SELECT' || (field.options?.length ?? 0) > 0,
    { message: 'Lista precisa de ao menos uma opção', path: ['options'] },
  );

export const formConfigSchema = z
  .object({
    fields: z.array(formFieldSchema).max(30),
    submitLabel: z.string().trim().min(1).max(40),
    successMessage: z.string().trim().min(1).max(300),
  })
  .refine(
    (form) =>
      new Set(form.fields.map((field) => field.id)).size === form.fields.length,
    { message: 'Campos com id repetido', path: ['fields'] },
  );

export type FormField = z.infer<typeof formFieldSchema>;
export type FormConfig = z.infer<typeof formConfigSchema>;

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
  value: string | boolean | null;
};

const valueSchemas: Record<FormFieldType, z.ZodType<string | boolean>> = {
  TEXT: z.string().trim().max(500),
  TEXTAREA: z.string().trim().max(5000),
  EMAIL: z.string().trim().max(254).pipe(z.email()),
  PHONE: z
    .string()
    .trim()
    .regex(/^[0-9+()\-\s]{6,30}$/),
  NUMBER: z
    .string()
    .trim()
    .max(30)
    .refine((value) => Number.isFinite(Number(value))),
  DATE: z.iso.date(),
  SELECT: z.string().trim(),
  CHECKBOX: z.boolean(),
};

function isEmpty(value: unknown) {
  return (
    value === undefined ||
    value === null ||
    value === false ||
    (typeof value === 'string' && value.trim() === '')
  );
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
    const valid =
      parsed.success &&
      (field.type !== 'SELECT' ||
        (field.options ?? []).includes(parsed.data as string));

    if (!valid) {
      invalid.push(field.id);
      continue;
    }

    answers.push({ id: field.id, label: field.label, value: parsed.data });
  }

  return invalid.length ? { ok: false, invalid } : { ok: true, answers };
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
    answers: FormAnswer[];
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
        : answer.value;

  return {
    form,
    submissionId: submission.id,
    columns: [
      'Data',
      ...submission.answers.map((answer) => answer.label),
      'IP',
      'País',
      'Dispositivo',
    ],
    row: [
      submission.createdAt.toISOString(),
      ...submission.answers.map(value),
      submission.ipAddress,
      submission.countryCode,
      [submission.deviceType, submission.browser, submission.operatingSystem]
        .filter(Boolean)
        .join(' · '),
    ],
  };
}
