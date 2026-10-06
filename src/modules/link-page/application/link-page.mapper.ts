import { LinkPageImageEntity } from '../domain/entities/link-page-image.entity';
import { LinkPageLinkEntity } from '../domain/entities/link-page-link.entity';
import { LinkPageSocialLinkEntity } from '../domain/entities/link-page-social-link.entity';
import { LinkPageEntity } from '../domain/entities/link-page.entity';

export function toLinkPageSummary(page: LinkPageEntity) {
  return {
    id: page.id,
    companyId: page.companyId,
    name: page.name,
    slug: page.slug,
    /** Path after `/p/`: `bio` or `bio/post`. Needs `parentPage` loaded for posts. */
    publicPath: page.parentPage
      ? `${page.parentPage.slug}/${page.slug}`
      : page.slug,
    type: page.type,
    parentPageId: page.parentPageId,
    postNetwork: page.postNetwork,
    postUrl: page.postUrl,
    status: page.status,
    layout: page.layout,
    title: page.title,
    subtitle: page.subtitle,
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
  };
}

export function toLinkPageLinkResponse(link: LinkPageLinkEntity) {
  return {
    id: link.id,
    placement: link.placement,
    kind: link.kind,
    label: link.label,
    url: link.url,
    contactType: link.contactType,
    contactValue: link.contactValue,
    textColor: link.textColor,
    backgroundColor: link.backgroundColor,
    borderColor: link.borderColor,
    borderEnabled: link.borderEnabled,
    sortOrder: link.sortOrder,
    active: link.active,
  };
}

export function toSocialLinkResponse(socialLink: LinkPageSocialLinkEntity) {
  return {
    id: socialLink.id,
    platform: socialLink.platform,
    url: socialLink.url,
    sortOrder: socialLink.sortOrder,
    active: socialLink.active,
  };
}

export function toImageResponse(image: LinkPageImageEntity) {
  return {
    id: image.id,
    imageUrl: image.imageUrl,
    altText: image.altText,
    targetUrl: image.targetUrl,
    sortOrder: image.sortOrder,
    active: image.active,
  };
}

export function toLinkPageDetail(page: LinkPageEntity) {
  return {
    ...toLinkPageSummary(page),
    backgroundType: page.backgroundType,
    backgroundColor: page.backgroundColor,
    backgroundImageUrl: page.backgroundImageUrl,
    avatarUrl: page.avatarUrl,
    footerMode: page.footerMode,
    footerText: page.footerText,
    footerUrl: page.footerUrl,
    footerLogoUrl: page.footerLogoUrl,
    links: (page.links ?? []).map(toLinkPageLinkResponse),
    socialLinks: (page.socialLinks ?? []).map(toSocialLinkResponse),
    images: (page.images ?? []).map(toImageResponse),
  };
}
