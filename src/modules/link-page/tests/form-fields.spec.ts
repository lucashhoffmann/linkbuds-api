import {
  type FormField,
  appsScriptUrlPattern,
  formConfigSchema,
  scoreFormAnswers,
  toFormLimit,
  toPublicForm,
  toSheetRow,
  validateFormAnswers,
} from '../domain/form-fields';

const fields: FormField[] = [
  { id: 'nome', type: 'TEXT', label: 'Nome', required: true },
  { id: 'email', type: 'EMAIL', label: 'Email', required: true },
  {
    id: 'plano',
    type: 'SELECT',
    label: 'Plano',
    required: false,
    options: ['Básico', 'Pro'],
  },
  { id: 'aceite', type: 'CHECKBOX', label: 'Aceito', required: true },
  { id: 'nasc', type: 'DATE', label: 'Nascimento', required: false },
];

describe('validateFormAnswers', () => {
  it('returns a label snapshot and drops unknown keys', () => {
    const result = validateFormAnswers(fields, {
      nome: ' Ana ',
      email: 'ana@exemplo.com',
      plano: 'Pro',
      aceite: true,
      intruso: 'x',
    });

    expect(result).toEqual({
      ok: true,
      answers: [
        { id: 'nome', label: 'Nome', value: 'Ana' },
        { id: 'email', label: 'Email', value: 'ana@exemplo.com' },
        { id: 'plano', label: 'Plano', value: 'Pro' },
        { id: 'aceite', label: 'Aceito', value: true },
        { id: 'nasc', label: 'Nascimento', value: null },
      ],
    });
  });

  it('flags missing required, bad email, option outside the list, unchecked consent', () => {
    expect(
      validateFormAnswers(fields, {
        nome: '  ',
        email: 'não-é-email',
        plano: 'Enterprise',
        aceite: false,
        nasc: '31/12/2000',
      }),
    ).toEqual({
      ok: false,
      invalid: ['nome', 'email', 'plano', 'aceite', 'nasc'],
    });
  });

  it('accepts only Brazilian phones and stores them formatted', () => {
    const tel: FormField[] = [
      { id: 'tel', type: 'PHONE', label: 'Telefone', required: true },
    ];

    for (const [raw, stored] of [
      ['42988112334', '(42) 98811-2334'],
      ['(42) 98811-2334', '(42) 98811-2334'],
      ['+55 42 98811-2334', '(42) 98811-2334'],
      ['4232221234', '(42) 3222-1234'],
    ]) {
      expect(validateFormAnswers(tel, { tel: raw })).toMatchObject({
        ok: true,
        answers: [{ value: stored }],
      });
    }
    for (const bad of [
      '123456',
      '------',
      '4298811233',
      '429881123345',
      '0298811234',
      '4212221234',
    ]) {
      expect(validateFormAnswers(tel, { tel: bad })).toEqual({
        ok: false,
        invalid: ['tel'],
      });
    }
  });

  it('accepts only http(s) links', () => {
    const site: FormField[] = [
      { id: 'site', type: 'URL', label: 'Site', required: true },
    ];

    expect(
      validateFormAnswers(site, { site: 'https://exemplo.com/a?b=1' }),
    ).toMatchObject({ ok: true });
    for (const bad of ['exemplo.com', 'javascript:alert(1)', 'ftp://x.com']) {
      expect(validateFormAnswers(site, { site: bad })).toEqual({
        ok: false,
        invalid: ['site'],
      });
    }
  });
});

describe('formConfigSchema', () => {
  const base = { submitLabel: 'Enviar', successMessage: 'Valeu!' };

  it('rejects duplicate ids and a SELECT without options', () => {
    expect(
      formConfigSchema.safeParse({
        ...base,
        fields: [fields[0], fields[0]],
      }).success,
    ).toBe(false);
    expect(
      formConfigSchema.safeParse({
        ...base,
        fields: [{ id: 'x', type: 'SELECT', label: 'X', required: false }],
      }).success,
    ).toBe(false);
    expect(formConfigSchema.safeParse({ ...base, fields }).success).toBe(true);
  });

  it('accepts only an http(s) redirect, or none', () => {
    const parse = (redirectUrl: unknown) =>
      formConfigSchema.safeParse({ ...base, fields, redirectUrl }).success;

    expect(parse('https://exemplo.com/obrigado')).toBe(true);
    expect(parse(null)).toBe(true);
    expect(parse(undefined)).toBe(true);
    expect(parse('javascript:alert(1)')).toBe(false);
    expect(parse('exemplo.com')).toBe(false);
  });
});

describe('Google Sheets webhook', () => {
  it('accepts only an Apps Script web app URL', () => {
    const ok = 'https://script.google.com/macros/s/AKfycbx_abc-123XYZ/exec';

    expect(appsScriptUrlPattern.test(ok)).toBe(true);
    for (const url of [
      'http://script.google.com/macros/s/AKfycbx_abc-123XYZ/exec',
      'https://script.google.com.evil.com/macros/s/AKfycbx_abc-123XYZ/exec',
      'https://script.google.com/macros/s/AKfycbx_abc-123XYZ/dev',
      'https://169.254.169.254/latest/meta-data',
    ]) {
      expect(appsScriptUrlPattern.test(url)).toBe(false);
    }
  });

  it('builds header + row in the same order', () => {
    expect(
      toSheetRow(
        { id: 'f1', name: 'Orçamento' },
        {
          id: 's1',
          cohort: 'Verão 2026',
          answers: [
            { id: 'nome', label: 'Nome', value: 'Ana' },
            { id: 'aceite', label: 'Aceito', value: true },
          ],
          score: null,
          createdAt: new Date('2026-10-06T12:00:00.000Z'),
          ipAddress: '203.0.113.7',
          countryCode: 'BR',
          deviceType: 'mobile',
          browser: 'Chrome',
          operatingSystem: null,
        },
      ),
    ).toEqual({
      form: { id: 'f1', name: 'Orçamento' },
      submissionId: 's1',
      columns: ['Data', 'Corte', 'Nome', 'Aceito', 'IP', 'País', 'Dispositivo'],
      row: [
        '2026-10-06T12:00:00.000Z',
        'Verão 2026',
        'Ana',
        'Sim',
        '203.0.113.7',
        'BR',
        'mobile · Chrome',
      ],
    });
  });
});

describe('toFormLimit', () => {
  const form = {
    fields: [],
    submitLabel: 'Enviar',
    successMessage: 'Ok',
  };

  it('is null without a limit', () => {
    expect(toFormLimit(form, 3)).toBeNull();
    expect(toFormLimit(null, 3)).toBeNull();
  });

  it('reports the current cohort progress', () => {
    expect(
      toFormLimit(
        { ...form, maxResponses: 10, cohort: 'Verão', closedAt: null },
        4,
      ),
    ).toEqual({ max: 10, current: 4, cohort: 'Verão', closed: false });
    expect(
      toFormLimit({ ...form, maxResponses: 2, closedAt: '2026-10-06' }, 2),
    ).toEqual({ max: 2, current: 2, cohort: '1', closed: true });
  });
});

describe('questionnaire choices', () => {
  const quiz: FormField[] = [
    { id: 'nome', type: 'TEXT', label: 'Nome', required: true },
    {
      id: 'capital',
      type: 'CHOICE',
      label: 'Capital do Brasil?',
      required: true,
      options: ['Rio', 'Brasília', 'Curitiba'],
      points: [0, 1, 0],
    },
    {
      id: 'primos',
      type: 'MULTI_CHOICE',
      label: 'Quais são primos?',
      required: false,
      options: ['2', '3', '4'],
      points: [1, 1, 0],
      allowOther: true,
    },
  ];
  const answers = (raw: Record<string, unknown>) => {
    const result = validateFormAnswers(quiz, raw);
    if (!result.ok) throw new Error(result.invalid.join());
    return result.answers;
  };

  it('accepts options, one "Outro" text, and rejects unknown options', () => {
    expect(
      answers({ nome: 'Ana', capital: 'Brasília', primos: ['2', '7', '2'] }),
    ).toContainEqual({
      id: 'primos',
      label: 'Quais são primos?',
      value: ['2', '7'],
    });
    expect(validateFormAnswers(quiz, { nome: 'A', capital: 'Lima' })).toEqual({
      ok: false,
      invalid: ['capital'],
    });
    expect(
      validateFormAnswers(quiz, {
        nome: 'A',
        capital: 'Rio',
        primos: ['7', '9'],
      }),
    ).toEqual({ ok: false, invalid: ['primos'] });
  });

  it('scores CORRECT as questions right and POINTS as the sum', () => {
    const right = answers({
      nome: 'Ana',
      capital: 'Brasília',
      primos: ['2', '3'],
    });
    const partial = answers({
      nome: 'Ana',
      capital: 'Brasília',
      primos: ['2'],
    });

    expect(scoreFormAnswers({ fields: quiz, scoring: null }, right)).toBeNull();
    expect(
      scoreFormAnswers(
        { fields: quiz, scoring: { kind: 'CORRECT', show: true } },
        right,
      ),
    ).toEqual({ score: 2, max: 2 });
    expect(
      scoreFormAnswers(
        { fields: quiz, scoring: { kind: 'CORRECT', show: true } },
        partial,
      ),
    ).toEqual({ score: 1, max: 2 });
    expect(
      scoreFormAnswers(
        { fields: quiz, scoring: { kind: 'POINTS', show: false } },
        partial,
      ),
    ).toEqual({ score: 2, max: 3 });
  });

  it('keeps points off the public page', () => {
    const form = toPublicForm({
      fields: quiz,
      submitLabel: 'Enviar',
      successMessage: 'Ok',
    });
    expect(JSON.stringify(form)).not.toContain('points');
  });

  it('writes multiple answers and the score to the sheet', () => {
    const sheet = toSheetRow(
      { id: 'f', name: 'Quiz' },
      {
        id: 's',
        cohort: '1',
        answers: [{ id: 'primos', label: 'Primos', value: ['2', '3'] }],
        score: 2,
        createdAt: new Date('2026-10-06T12:00:00.000Z'),
        ipAddress: null,
        countryCode: null,
        deviceType: null,
        browser: null,
        operatingSystem: null,
      },
    );
    expect(sheet.columns.slice(0, 4)).toEqual([
      'Data',
      'Corte',
      'Nota',
      'Primos',
    ]);
    expect(sheet.row.slice(2, 4)).toEqual([2, '2, 3']);
  });
});
