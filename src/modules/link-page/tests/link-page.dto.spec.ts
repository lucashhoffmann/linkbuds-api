import {
  linkPageImageDto,
  linkPageLinkDto,
  linkPageSocialLinkDto,
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
});
