import { z } from 'zod';
import { AnalyticsEventType } from '../../domain/enums/analytics-event-type.enum';
import { AnalyticsTargetType } from '../../domain/enums/analytics-target-type.enum';
import { LinkPageBackgroundType } from '../../domain/enums/link-page-background-type.enum';
import { LinkPageContactType } from '../../domain/enums/link-page-contact-type.enum';
import {
  LinkPageFooterMode,
  LinkPageFooterSize,
  LinkPageFooterStyle,
} from '../../domain/enums/link-page-footer-mode.enum';
import { LinkPageLayout } from '../../domain/enums/link-page-layout.enum';
import { LinkPageLinkKind } from '../../domain/enums/link-page-link-kind.enum';
import { LinkPageLinkPlacement } from '../../domain/enums/link-page-link-placement.enum';
import { LinkPageMediaSize } from '../../domain/enums/link-page-media-size.enum';
import { LinkPageStatus } from '../../domain/enums/link-page-status.enum';
import { SocialPlatform } from '../../domain/enums/social-platform.enum';
import { isValidLinkConfiguration } from '../../domain/link-configuration';
import { isSupportedVideoUrl } from '../../domain/video-url';
import {
  appsScriptUrlPattern,
  formConfigSchema,
} from '../../domain/form-fields';

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

// Injected into <script> on the public page: strict format is the XSS guard.
const trackingIdSchema = (pattern: RegExp) =>
  z
    .string()
    .trim()
    .toUpperCase()
    .transform((value) => (value === '' ? null : value))
    .refine((value) => value === null || pattern.test(value))
    .nullable()
    .optional();

export const gtmContainerIdPattern = /^GTM-[A-Z0-9]{4,12}$/;
export const ga4MeasurementIdPattern = /^G-[A-Z0-9]{4,16}$/;

export const createLinkPageDto = z.object({
  name: z.string().trim().min(1).max(120),
  slug: slugSchema,
  layout: z.enum(LinkPageLayout).default(LinkPageLayout.LAYOUT_1),
  title: z.string().trim().min(1).max(140).optional(),
});

/** Sub-page of a bio page for one social post. */
export const createPostPageDto = z.object({
  name: z.string().trim().min(1).max(120),
  slug: slugSchema,
  title: z.string().trim().min(1).max(140).optional(),
  postNetwork: z.enum(SocialPlatform).nullable().optional(),
  postUrl: httpUrlSchema.nullable().optional(),
});

export type CreatePostPageDto = z.infer<typeof createPostPageDto>;

/** Sub-page of a bio page with a form. Starts with the default fields. */
export const createFormPageDto = z.object({
  name: z.string().trim().min(1).max(120),
  slug: slugSchema,
  title: z.string().trim().min(1).max(140).optional(),
});

export type CreateFormPageDto = z.infer<typeof createFormPageDto>;

/** Public submission. `website` is a honeypot: humans never see it. */
export const submitFormDto = z.object({
  answers: z.record(
    z.string().max(40),
    z.union([z.string().max(5000), z.boolean()]),
  ),
  visitorId: optionalText(120),
  website: z.string().max(200).optional(),
  /** Time from opening the form to submitting; capped at 24h. */
  durationMs: z.number().int().min(0).max(86_400_000).nullable().optional(),
});

export type SubmitFormDto = z.infer<typeof submitFormDto>;

export const updateLinkPageDto = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    slug: slugSchema.optional(),
    status: z.enum(LinkPageStatus).optional(),
    layout: z.enum(LinkPageLayout).optional(),
    backgroundType: z.enum(LinkPageBackgroundType).optional(),
    backgroundColor: colorSchema.optional(),
    backgroundImageUrl: nullableUrlSchema,
    titleColor: colorSchema.nullable().optional(),
    subtitleColor: colorSchema.nullable().optional(),
    backgroundGradientColor: colorSchema.optional(),
    titleBold: z.boolean().optional(),
    subtitleBold: z.boolean().optional(),
    avatarUrl: nullableUrlSchema,
    title: z.string().trim().min(1).max(140).optional(),
    subtitle: optionalText(500),
    /** POST pages only. */
    postNetwork: z.enum(SocialPlatform).nullable().optional(),
    postUrl: httpUrlSchema.nullable().optional(),
    /** FORM pages only. */
    form: formConfigSchema.optional(),
    /** FORM pages only. Apps Script web app (`script.google.com/macros/s/…/exec`); empty = off. */
    formWebhookUrl: z
      .string()
      .trim()
      .transform((value) => (value === '' ? null : value))
      .refine((value) => value === null || appsScriptUrlPattern.test(value), {
        message: 'Use a URL do app da Web do Apps Script (termina em /exec)',
      })
      .nullable()
      .optional(),
    /** Bio pages only; posts use their bio's. */
    gtmContainerId: trackingIdSchema(gtmContainerIdPattern),
    ga4MeasurementId: trackingIdSchema(ga4MeasurementIdPattern),
  })
  .refine((data) => Object.keys(data).length > 0);

export const updateFooterDto = z.object({
  footerMode: z.enum(LinkPageFooterMode),
  footerText: optionalText(160),
  footerUrl: nullableUrlSchema,
  footerLogoUrl: nullableUrlSchema,
  /** Look of the CUSTOM footer; background/border apply to PILL and BOX. */
  footerStyle: z.enum(LinkPageFooterStyle).default(LinkPageFooterStyle.TEXT),
  footerBackgroundColor: colorSchema.nullable().default(null),
  footerBorderColor: colorSchema.nullable().default(null),
  footerColor: colorSchema.nullable().default(null),
  footerBold: z.boolean().default(false),
  footerFontSize: z.enum(LinkPageFooterSize).default(LinkPageFooterSize.SMALL),
  footerLogoSize: z.enum(LinkPageFooterSize).default(LinkPageFooterSize.SMALL),
});

/** Company default footer; `applyToExisting` also overwrites every page. */
export const updateFooterDefaultDto = updateFooterDto.extend({
  applyToExisting: z.boolean().default(false),
});

type StripDefaults<S extends z.ZodRawShape> = {
  [K in keyof S]: S[K] extends z.ZodDefault<infer Inner> ? Inner : S[K];
};

// PATCH must only touch the fields sent: zod 4 still applies .default() under .partial().
function partialUpdateDto<S extends z.ZodRawShape>(schema: z.ZodObject<S>) {
  const shape = Object.fromEntries(
    Object.entries(schema.shape).map(([key, field]) => [
      key,
      field instanceof z.ZodDefault ? field.unwrap() : field,
    ]),
  ) as StripDefaults<S>;

  return z
    .object(shape)
    .partial()
    .refine((data) => Object.keys(data).length > 0);
}

const customHeightSchema = z
  .number()
  .int()
  .min(80)
  .max(800)
  .nullable()
  .optional();

const linkPageLinkBaseDto = z.object({
  placement: z.enum(LinkPageLinkPlacement),
  kind: z.enum(LinkPageLinkKind),
  label: z.string().trim().min(1).max(120),
  url: nullableUrlSchema,
  contactType: z.enum(LinkPageContactType).nullable().optional(),
  contactValue: optionalText(180),
  previewImageUrl: httpUrlSchema.nullable().optional(),
  previewDescription: optionalText(300),
  displaySize: z.enum(LinkPageMediaSize).default(LinkPageMediaSize.MEDIUM),
  customHeight: customHeightSchema,
  textColor: colorSchema.default('#111827'),
  backgroundColor: colorSchema.default('#FFFFFF'),
  borderColor: colorSchema.default('#E5E7EB'),
  borderEnabled: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
  active: z.boolean().default(true),
});

export const linkPageLinkDto = linkPageLinkBaseDto.refine(
  isValidLinkConfiguration,
);

export const updateLinkPageLinkDto = partialUpdateDto(linkPageLinkBaseDto);

export const linkPageSocialLinkDto = z.object({
  platform: z.enum(SocialPlatform),
  url: httpUrlSchema,
  sortOrder: z.number().int().min(0).default(0),
  active: z.boolean().default(true),
});

export const updateLinkPageSocialLinkDto = partialUpdateDto(
  linkPageSocialLinkDto,
);

export const linkPageImageDto = z.object({
  imageUrl: httpUrlSchema,
  altText: optionalText(180),
  targetUrl: nullableUrlSchema,
  sortOrder: z.number().int().min(0).default(0),
  active: z.boolean().default(true),
});

export const updateLinkPageImageDto = partialUpdateDto(linkPageImageDto);

export const linkPageVideoDto = z.object({
  url: httpUrlSchema.refine(isSupportedVideoUrl),
  title: optionalText(120),
  autoplay: z.boolean().default(false),
  controls: z.boolean().default(true),
  size: z.enum(LinkPageMediaSize).default(LinkPageMediaSize.MEDIUM),
  customHeight: customHeightSchema,
  sortOrder: z.number().int().min(0).default(0),
  active: z.boolean().default(true),
});

export const updateLinkPageVideoDto = partialUpdateDto(linkPageVideoDto);

export const reorderItemsDto = z.array(
  z.object({
    id: z.string().uuid(),
    sortOrder: z.number().int().min(0),
  }),
);

/** One shared order for links, images and videos (the page renders them interleaved). */
export const reorderContentDto = z.array(
  z.object({
    type: z.enum(['LINK', 'IMAGE', 'VIDEO']),
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
export type UpdateFooterDefaultDto = z.infer<typeof updateFooterDefaultDto>;
export type LinkPageLinkDto = z.infer<typeof linkPageLinkDto>;
export type UpdateLinkPageLinkDto = z.infer<typeof updateLinkPageLinkDto>;
export type LinkPageSocialLinkDto = z.infer<typeof linkPageSocialLinkDto>;
export type UpdateLinkPageSocialLinkDto = z.infer<
  typeof updateLinkPageSocialLinkDto
>;
export type LinkPageImageDto = z.infer<typeof linkPageImageDto>;
export type UpdateLinkPageImageDto = z.infer<typeof updateLinkPageImageDto>;
export type LinkPageVideoDto = z.infer<typeof linkPageVideoDto>;
export type UpdateLinkPageVideoDto = z.infer<typeof updateLinkPageVideoDto>;
export type ReorderItemsDto = z.infer<typeof reorderItemsDto>;
export type ReorderContentDto = z.infer<typeof reorderContentDto>;
export type AnalyticsEventDto = z.infer<typeof analyticsEventDto>;
export type AnalyticsPresenceDto = z.infer<typeof analyticsPresenceDto>;

export const linkPreviewQueryDto = z.object({ url: httpUrlSchema });

export type LinkPreviewQueryDto = z.infer<typeof linkPreviewQueryDto>;
