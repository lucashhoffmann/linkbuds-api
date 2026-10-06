import {
  type FormField,
  appsScriptUrlPattern,
  formConfigSchema,
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
          answers: [
            { id: 'nome', label: 'Nome', value: 'Ana' },
            { id: 'aceite', label: 'Aceito', value: true },
          ],
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
      columns: ['Data', 'Nome', 'Aceito', 'IP', 'País', 'Dispositivo'],
      row: [
        '2026-10-06T12:00:00.000Z',
        'Ana',
        'Sim',
        '203.0.113.7',
        'BR',
        'mobile · Chrome',
      ],
    });
  });
});
