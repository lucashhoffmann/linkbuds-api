import {
  linkPageImageDto,
  linkPageLinkDto,
  linkPageSocialLinkDto,
  linkPageTextDto,
  linkPageVideoDto,
  updateLinkPageDto,
  updateLinkPageImageDto,
  updateLinkPageLinkDto,
  updateLinkPageSocialLinkDto,
} from '../application/dto/link-page.dto';

describe('LinkPage DTOs', () => {
  it('returns validation errors instead of throwing TypeError for invalid URLs', () => {
    let linkResult: ReturnType<typeof linkPageLinkDto.safeParse> | undefined;
    let socialResult:
      ReturnType<typeof linkPageSocialLinkDto.safeParse> | undefined;
    let imageResult: ReturnType<typeof linkPageImageDto.safeParse> | undefined;

    expect(() => {
      linkResult = linkPageLinkDto.safeParse({
        placement: 'VERTICAL',
        kind: 'LINK',
        label: 'Site',
        url: 'not-a-url',
      });
    }).not.toThrow();
    expect(() => {
      socialResult = linkPageSocialLinkDto.safeParse({
        platform: 'INSTAGRAM',
        url: 'instagram.com/linkbuds',
      });
    }).not.toThrow();
    expect(() => {
      imageResult = linkPageImageDto.safeParse({
        imageUrl: 'not-a-url',
      });
    }).not.toThrow();

    expect(linkResult?.success).toBe(false);
    expect(socialResult?.success).toBe(false);
    expect(imageResult?.success).toBe(false);
  });

  it('accepts PREVIEW only as a vertical link with an URL', () => {
    const preview = {
      placement: 'VERTICAL',
      kind: 'PREVIEW',
      label: 'Loja',
      url: 'https://example.com',
      previewImageUrl: 'https://example.com/og.png',
      previewDescription: 'Promoção',
    };

    expect(linkPageLinkDto.safeParse(preview).success).toBe(true);
    expect(
      linkPageLinkDto.safeParse({ ...preview, placement: 'HORIZONTAL' })
        .success,
    ).toBe(false);
    expect(linkPageLinkDto.safeParse({ ...preview, url: null }).success).toBe(
      false,
    );
    expect(
      linkPageLinkDto.safeParse({
        ...preview,
        previewImageUrl: 'javascript:alert(1)',
      }).success,
    ).toBe(false);
  });

  it('keeps PATCH payloads partial without re-applying create defaults', () => {
    expect(updateLinkPageLinkDto.parse({ label: 'Novo' })).toEqual({
      label: 'Novo',
    });
    expect(updateLinkPageSocialLinkDto.parse({ sortOrder: 2 })).toEqual({
      sortOrder: 2,
    });
    expect(updateLinkPageImageDto.parse({ active: false })).toEqual({
      active: false,
    });
  });

  it('accepts only GTM/GA4 ID formats (they end up inside a script tag)', () => {
    expect(
      updateLinkPageDto.parse({
        gtmContainerId: ' gtm-abc123 ',
        ga4MeasurementId: 'g-XYZ7890',
      }),
    ).toEqual({ gtmContainerId: 'GTM-ABC123', ga4MeasurementId: 'G-XYZ7890' });
    expect(updateLinkPageDto.parse({ gtmContainerId: '' })).toEqual({
      gtmContainerId: null,
    });
    expect(
      updateLinkPageDto.safeParse({ gtmContainerId: "GTM-1');alert(1)//" })
        .success,
    ).toBe(false);
    expect(
      updateLinkPageDto.safeParse({ ga4MeasurementId: 'UA-12345-1' }).success,
    ).toBe(false);
  });

  it('accepts only YouTube, Vimeo or direct video file URLs', () => {
    const accepted = [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://youtube.com/shorts/dQw4w9WgXcQ',
      'https://vimeo.com/76979871',
      'https://cdn.example.com/promo.mp4',
    ];
    const rejected = [
      'https://example.com/pagina',
      'https://www.youtube.com/@canal',
      'javascript:alert(1)',
    ];

    for (const url of accepted) {
      expect(linkPageVideoDto.safeParse({ url }).success).toBe(true);
    }
    for (const url of rejected) {
      expect(linkPageVideoDto.safeParse({ url }).success).toBe(false);
    }
  });

  it('accepts formatted text runs and rejects HTML-ish or invalid styles', () => {
    const parsed = linkPageTextDto.parse({
      content: [
        { text: 'Promo ', bold: true, color: '#ff0000', size: 'LG' },
        { text: 'até sexta\n<b>ok</b>', italic: true },
      ],
    });
    expect(parsed.content[0].color).toBe('#FF0000');
    expect(parsed.content[1].text).toContain('<b>');

    expect(linkPageTextDto.safeParse({ content: [] }).success).toBe(false);
    expect(
      linkPageTextDto.safeParse({ content: [{ text: 'x', color: 'red' }] })
        .success,
    ).toBe(false);
    expect(
      linkPageTextDto.safeParse({ content: [{ text: 'x', size: 'HUGE' }] })
        .success,
    ).toBe(false);
    expect(
      linkPageTextDto.safeParse({ content: [{ text: 'x'.repeat(5001) }] })
        .success,
    ).toBe(false);
  });
});
