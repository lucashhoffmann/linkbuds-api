import { z } from 'zod';
import { AnalyticsEventType } from '../../domain/enums/analytics-event-type.enum';
import { AnalyticsTargetType } from '../../domain/enums/analytics-target-type.enum';
import { LinkPageBackgroundType } from '../../domain/enums/link-page-background-type.enum';
import { LinkPageContactType } from '../../domain/enums/link-page-contact-type.enum';
import { LinkPageFooterMode } from '../../domain/enums/link-page-footer-mode.enum';
import { LinkPageLayout } from '../../domain/enums/link-page-layout.enum';
import { LinkPageLinkKind } from '../../domain/enums/link-page-link-kind.enum';
import { LinkPageLinkPlacement } from '../../domain/enums/link-page-link-placement.enum';
import { LinkPageStatus } from '../../domain/enums/link-page-status.enum';
import { SocialPlatform } from '../../domain/enums/social-platform.enum';

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9-]+$/)
  .transform((value) => value.toLowerCase());

const colorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/)
  .transform((value) => value.toUpperCase());

function hasAllowedUrlProtocol(value: string, protocols: string[]) {
  try {
    return protocols.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

const nullableUrlSchema = z
  .string()
  .trim()
  .url()
  .refine((value) =>
    hasAllowedUrlProtocol(value, ['http:', 'https:', 'mailto:', 'tel:']),
  )
  .nullable()
  .optional();

const httpUrlSchema = z
  .string()
  .trim()
  .url()
  .refine((value) => hasAllowedUrlProtocol(value, ['http:', 'https:']));

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => (value === '' ? null : value));

export const createLinkPageDto = z.object({
  name: z.string().trim().min(1).max(120),
  slug: slugSchema,
  layout: z.enum(LinkPageLayout).default(LinkPageLayout.LAYOUT_1),
  title: z.string().trim().min(1).max(140).optional(),
});

export const updateLinkPageDto = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    slug: slugSchema.optional(),
    status: z.enum(LinkPageStatus).optional(),
    layout: z.enum(LinkPageLayout).optional(),
    backgroundType: z.enum(LinkPageBackgroundType).optional(),
    backgroundColor: colorSchema.optional(),
    backgroundImageUrl: nullableUrlSchema,
    avatarUrl: nullableUrlSchema,
    title: z.string().trim().min(1).max(140).optional(),
    subtitle: optionalText(500),
  })
  .refine((data) => Object.keys(data).length > 0);

export const updateFooterDto = z.object({
  footerMode: z.enum(LinkPageFooterMode),
  footerText: optionalText(160),
  footerUrl: nullableUrlSchema,
  footerLogoUrl: nullableUrlSchema,
});

const linkPageLinkBaseDto = z.object({
  placement: z.enum(LinkPageLinkPlacement),
  kind: z.enum(LinkPageLinkKind),
  label: z.string().trim().min(1).max(120),
  url: nullableUrlSchema,
  contactType: z.enum(LinkPageContactType).nullable().optional(),
  contactValue: optionalText(180),
  textColor: colorSchema.default('#111827'),
  backgroundColor: colorSchema.default('#FFFFFF'),
  borderColor: colorSchema.default('#E5E7EB'),
  borderEnabled: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
  active: z.boolean().default(true),
});

export const linkPageLinkDto = linkPageLinkBaseDto.refine(
  (data) =>
    (data.kind === LinkPageLinkKind.LINK &&
      Boolean(data.url) &&
      !data.contactType &&
      !data.contactValue) ||
    (data.kind === LinkPageLinkKind.CONTACT &&
      !data.url &&
      Boolean(data.contactType) &&
      Boolean(data.contactValue)),
);

export const updateLinkPageLinkDto = linkPageLinkBaseDto
  .partial()
  .refine((data) => Object.keys(data).length > 0);

export const linkPageSocialLinkDto = z.object({
  platform: z.enum(SocialPlatform),
  url: httpUrlSchema,
  sortOrder: z.number().int().min(0).default(0),
  active: z.boolean().default(true),
});

export const updateLinkPageSocialLinkDto = linkPageSocialLinkDto
  .partial()
  .refine((data) => Object.keys(data).length > 0);

export const linkPageImageDto = z.object({
  imageUrl: httpUrlSchema,
  altText: optionalText(180),
  targetUrl: nullableUrlSchema,
  sortOrder: z.number().int().min(0).default(0),
  active: z.boolean().default(true),
});

export const updateLinkPageImageDto = linkPageImageDto
  .partial()
  .refine((data) => Object.keys(data).length > 0);

export const reorderItemsDto = z.array(
  z.object({
    id: z.string().uuid(),
    sortOrder: z.number().int().min(0),
  }),
);

export const analyticsEventDto = z.object({
  eventId: optionalText(120),
  eventType: z.enum(AnalyticsEventType),
  targetType: z.enum(AnalyticsTargetType).nullable().optional(),
  targetId: z.string().uuid().nullable().optional(),
  visitorId: optionalText(120),
  sessionId: optionalText(120),
  referrer: optionalText(1000),
  utmSource: optionalText(120),
  utmMedium: optionalText(120),
  utmCampaign: optionalText(120),
  utmContent: optionalText(120),
  utmTerm: optionalText(120),
  countryCode: z.string().trim().length(2).nullable().optional(),
  deviceType: optionalText(40),
  browser: optionalText(80),
  operatingSystem: optionalText(80),
  durationMs: z.number().int().min(0).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const analyticsPresenceDto = z.object({
  sessionId: z.string().trim().min(1).max(120),
});

export type CreateLinkPageDto = z.infer<typeof createLinkPageDto>;
export type UpdateLinkPageDto = z.infer<typeof updateLinkPageDto>;
export type UpdateFooterDto = z.infer<typeof updateFooterDto>;
export type LinkPageLinkDto = z.infer<typeof linkPageLinkDto>;
export type UpdateLinkPageLinkDto = z.infer<typeof updateLinkPageLinkDto>;
export type LinkPageSocialLinkDto = z.infer<typeof linkPageSocialLinkDto>;
export type UpdateLinkPageSocialLinkDto = z.infer<
  typeof updateLinkPageSocialLinkDto
>;
export type LinkPageImageDto = z.infer<typeof linkPageImageDto>;
export type UpdateLinkPageImageDto = z.infer<typeof updateLinkPageImageDto>;
export type ReorderItemsDto = z.infer<typeof reorderItemsDto>;
export type AnalyticsEventDto = z.infer<typeof analyticsEventDto>;
export type AnalyticsPresenceDto = z.infer<typeof analyticsPresenceDto>;
