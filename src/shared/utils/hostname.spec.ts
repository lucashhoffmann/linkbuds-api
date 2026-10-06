import { normalizeHostname } from './hostname';

describe('normalizeHostname', () => {
  it('reduces headers, URLs and user input to the bare hostname', () => {
    expect(normalizeHostname('Example.com:8080')).toBe('example.com');
    expect(normalizeHostname(' https://Www.Agencia.com.br/p/x ')).toBe(
      'www.agencia.com.br',
    );
    expect(normalizeHostname('links.agencia.com.')).toBe('links.agencia.com');
    expect(normalizeHostname(undefined)).toBe('');
  });
});
