import {
  isPublicAddress,
  LinkPreviewService,
  parseLinkPreview,
} from '../application/link-preview.service';

describe('LinkPreviewService', () => {
  it('reads OG tags, falling back to <title> and resolving relative images', () => {
    const html = `
      <head>
        <title>Fallback</title>
        <meta content="Pizza &amp; Cia" property="og:title">
        <meta name='description' content='Melhor   pizza'>
        <meta property="og:image" content="/img/og.png" />
      </head>`;

    expect(parseLinkPreview(html, new URL('https://loja.com/p/1'))).toEqual({
      title: 'Pizza & Cia',
      description: 'Melhor pizza',
      imageUrl: 'https://loja.com/img/og.png',
    });
    expect(
      parseLinkPreview(
        '<title>Só título</title><meta property="og:image" content="javascript:x">',
        new URL('https://loja.com'),
      ),
    ).toEqual({ title: 'Só título', description: null, imageUrl: null });
  });

  it('blocks private, loopback and link-local addresses', () => {
    for (const address of [
      '127.0.0.1',
      '10.1.2.3',
      '172.20.0.1',
      '192.168.0.10',
      '169.254.169.254',
      '::1',
      'fd00::1',
      '::ffff:127.0.0.1',
    ]) {
      expect(isPublicAddress(address)).toBe(false);
    }
    expect(isPublicAddress('8.8.8.8')).toBe(true);
    expect(isPublicAddress('2606:4700::1111')).toBe(true);
  });

  it('refuses to fetch internal hosts', async () => {
    const service = new LinkPreviewService();

    await expect(service.fetch('http://127.0.0.1:3000')).rejects.toMatchObject({
      errorCode: 'LINK_PAGE_PREVIEW_UNAVAILABLE',
    });
    await expect(service.fetch('http://localhost')).rejects.toMatchObject({
      errorCode: 'LINK_PAGE_PREVIEW_UNAVAILABLE',
    });
  });
});
