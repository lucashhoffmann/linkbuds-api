import { normalizeHostname } from 'src/shared/utils/hostname';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { IncomingHttpHeaders } from 'node:http';
import { isIP } from 'node:net';
import {
  Between,
  DataSource,
  EntityManager,
  In,
  IsNull,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { CompanyDomainEntity } from 'src/modules/company/domain/entities/company-domain.entity';
import { CompanyEntity } from 'src/modules/company/domain/entities/company.entity';
import { CompanyDomainStatus } from 'src/modules/company/domain/enums/company-domain-status.enum';
import {
  type AnalyticsTier,
  ENTITLEMENT_RELATIONS,
  assertEntitled,
  entitlementsFor,
} from 'src/modules/plan/domain/entitlements';
import { ERROR_CODES } from 'src/shared/errors/error-catalog';
import { AppException } from 'src/shared/errors/app.exception';
import type { AuthPayload } from 'src/shared/types/auth-payload.types';
import { LinkPageAnalyticsEventEntity } from '../domain/entities/link-page-analytics-event.entity';
import { LinkPageImageEntity } from '../domain/entities/link-page-image.entity';
import { LinkPageVideoEntity } from '../domain/entities/link-page-video.entity';
import { LinkPageTextEntity } from '../domain/entities/link-page-text.entity';
import { LinkPageFormSubmissionEntity } from '../domain/entities/link-page-form-submission.entity';
import {
  defaultFormConfig,
  formCohort,
  scoreFormAnswers,
  toFormLimit,
  toPublicForm,
  toSheetRow,
  validateFormAnswers,
} from '../domain/form-fields';
import { LinkPageMediaSize } from '../domain/enums/link-page-media-size.enum';
import { LinkPageLinkEntity } from '../domain/entities/link-page-link.entity';
import { LinkPageSocialLinkEntity } from '../domain/entities/link-page-social-link.entity';
import { LinkPageEntity } from '../domain/entities/link-page.entity';
import { AnalyticsEventType } from '../domain/enums/analytics-event-type.enum';
import { AnalyticsTargetType } from '../domain/enums/analytics-target-type.enum';
import {
  LinkPageFooterMode,
  LinkPageFooterSize,
  LinkPageFooterStyle,
} from '../domain/enums/link-page-footer-mode.enum';
import { LinkPageLinkKind } from '../domain/enums/link-page-link-kind.enum';
import { LinkPageLinkPlacement } from '../domain/enums/link-page-link-placement.enum';
import { LinkPageStatus } from '../domain/enums/link-page-status.enum';
import { LinkPageType } from '../domain/enums/link-page-type.enum';
import { isValidLinkConfiguration } from '../domain/link-configuration';
import {
  AnalyticsEventDto,
  CreateLinkPageDto,
  CreateFormPageDto,
  CreatePostPageDto,
  FormStateDto,
  LinkPageImageDto,
  LinkPageVideoDto,
  LinkPageTextDto,
  LinkPageLinkDto,
  LinkPageSocialLinkDto,
  ReorderContentDto,
  ReorderItemsDto,
  SubmitFormDto,
  UpdateFooterDefaultDto,
  UpdateFooterDto,
  UpdateLinkPageDto,
  UpdateLinkPageImageDto,
  UpdateLinkPageVideoDto,
  UpdateLinkPageTextDto,
  UpdateLinkPageLinkDto,
  UpdateLinkPageSocialLinkDto,
} from './dto/link-page.dto';
import { LinkPagePresenceService } from './link-page-presence.service';
import {
  toFormSubmissionResponse,
  toImageResponse,
  toVideoResponse,
  toTextResponse,
  toLinkPageDetail,
  toLinkPageLinkResponse,
  toLinkPageSummary,
  toSocialLinkResponse,
} from './link-page.mapper';
import { PublicLinkPageCacheService } from './public-link-page-cache.service';

function footerFromDto(dto: UpdateFooterDto) {
  return {
    ...dto,
    footerText: dto.footerText ?? null,
    footerUrl: dto.footerUrl ?? null,
    footerLogoUrl: dto.footerLogoUrl ?? null,
  };
}

function pickFooter(source: {
  footerMode: LinkPageFooterMode;
  footerText: string | null;
  footerUrl: string | null;
  footerLogoUrl: string | null;
  footerStyle: LinkPageFooterStyle;
  footerBackgroundColor: string | null;
  footerBorderColor: string | null;
  footerColor: string | null;
  footerBold: boolean;
  footerFontSize: LinkPageFooterSize;
  footerLogoSize: LinkPageFooterSize;
}) {
  const {
    footerMode,
    footerText,
    footerUrl,
    footerLogoUrl,
    footerStyle,
    footerBackgroundColor,
    footerBorderColor,
    footerColor,
    footerBold,
    footerFontSize,
    footerLogoSize,
  } = source;
  return {
    footerMode,
    footerText,
    footerUrl,
    footerLogoUrl,
    footerStyle,
    footerBackgroundColor,
    footerBorderColor,
    footerColor,
    footerBold,
    footerFontSize,
    footerLogoSize,
  };
}

type AnalyticsRange = {
  from: Date;
  to: Date;
};

type AnalyticsGroup = 'links' | 'sources' | 'devices' | 'countries';

type AnalyticsRequestContext = {
  headers?: IncomingHttpHeaders;
  /** Socket address; used when no proxy header carries the client IP. */
  ip?: string;
};

type PublicLinkPageResponse = {
  id: string;
  /** Bio slug when this is a post or form sub-page. */
  parentSlug: string | null;
  /** FORM pages only. */
  form: LinkPageEntity['form'];
  postNetwork: LinkPageEntity['postNetwork'];
  postUrl: string | null;
  /** Always the bio's: posts inherit tracking. */
  gtmContainerId: string | null;
  ga4MeasurementId: string | null;
  name: string;
  slug: string;
  status: LinkPageStatus;
  layout: LinkPageEntity['layout'];
  backgroundType: LinkPageEntity['backgroundType'];
  backgroundColor: string;
  backgroundImageUrl: string | null;
  titleColor: string | null;
  subtitleColor: string | null;
  footerColor: string | null;
  backgroundGradientColor: string;
  titleBold: boolean;
  subtitleBold: boolean;
  footerBold: boolean;
  footerStyle: LinkPageEntity['footerStyle'];
  footerBackgroundColor: string | null;
  footerBorderColor: string | null;
  footerFontSize: LinkPageFooterSize;
  footerLogoSize: LinkPageFooterSize;
  avatarUrl: string | null;
  title: string;
  subtitle: string | null;
  footerMode: LinkPageFooterMode;
  footerText: string | null;
  footerUrl: string | null;
  footerLogoUrl: string | null;
  links: ReturnType<typeof toLinkPageLinkResponse>[];
  socialLinks: ReturnType<typeof toSocialLinkResponse>[];
  images: ReturnType<typeof toImageResponse>[];
  videos: ReturnType<typeof toVideoResponse>[];
  texts: ReturnType<typeof toTextResponse>[];
};

const basicAnalyticsRangeDays = 7;
// ponytail: newest N only, no paging; add offset/cursor when a form outgrows it.
const formSubmissionsLimit = 500;
const webhookTimeoutMs = 10_000;
const visitorIpsLimit = 100;
// ponytail: grouped in memory from the latest N views; SQL window per country if pages get huge.
const geoVisitsScanLimit = 1000;
const geoVisitsPerCountry = 20;
const defaultFullAnalyticsRangeDays = 30;
const clickEventTypes = [
  AnalyticsEventType.LINK_CLICK,
  AnalyticsEventType.SOCIAL_CLICK,
  AnalyticsEventType.IMAGE_CLICK,
];

function isUniqueViolation(error: unknown) {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  );
}

function getHeaderValue(
  headers: IncomingHttpHeaders | undefined,
  name: string,
) {
  const value = headers?.[name.toLowerCase()];

  return Array.isArray(value) ? value[0] : value;
}

function normalizeCountryCode(value?: string) {
  const countryCode = value?.trim().toUpperCase();

  return countryCode?.length === 2 ? countryCode : null;
}

// ponytail: trusts proxy headers as sent; spoofable if the API is reachable without the proxy.
export function resolveClientIp(context: AnalyticsRequestContext) {
  const candidates = [
    getHeaderValue(context.headers, 'cf-connecting-ip'),
    getHeaderValue(context.headers, 'x-real-ip'),
    getHeaderValue(context.headers, 'x-forwarded-for')?.split(',')[0],
    context.ip,
  ];

  for (const candidate of candidates) {
    const ip = candidate?.trim().replace(/^::ffff:(?=\d+\.)/, '');

    if (ip && isIP(ip)) {
      return ip;
    }
  }

  return null;
}

function isBotUserAgent(userAgent = '') {
  return /bot|crawler|spider|preview|facebookexternalhit|whatsapp|twitterbot|slackbot|discordbot|telegrambot|linkedinbot|pinterest|curl|wget/i.test(
    userAgent,
  );
}

function detectDeviceType(userAgent = '') {
  if (/ipad|tablet|kindle|silk/i.test(userAgent)) {
    return 'tablet';
  }

  if (/mobile|iphone|ipod|android/i.test(userAgent)) {
    return 'mobile';
  }

  return userAgent ? 'desktop' : null;
}

function detectBrowser(userAgent = '') {
  if (/edg\//i.test(userAgent)) return 'Edge';
  if (/opr\//i.test(userAgent)) return 'Opera';
  if (/firefox\//i.test(userAgent)) return 'Firefox';
  if (/chrome\//i.test(userAgent) || /crios\//i.test(userAgent))
    return 'Chrome';
  if (/safari\//i.test(userAgent)) return 'Safari';

  return userAgent ? 'Other' : null;
}

function detectOperatingSystem(userAgent = '') {
  if (/windows/i.test(userAgent)) return 'Windows';
  if (/iphone|ipad|ipod/i.test(userAgent)) return 'iOS';
  if (/android/i.test(userAgent)) return 'Android';
  if (/mac os|macintosh/i.test(userAgent)) return 'macOS';
  if (/linux/i.test(userAgent)) return 'Linux';

  return userAgent ? 'Other' : null;
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

@Injectable()
export class LinkPageService {
  private readonly logger = new Logger(LinkPageService.name);
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(CompanyEntity)
    private readonly companyRepository: Repository<CompanyEntity>,
    @InjectRepository(CompanyDomainEntity)
    private readonly domainRepository: Repository<CompanyDomainEntity>,
    @InjectRepository(LinkPageEntity)
    private readonly linkPageRepository: Repository<LinkPageEntity>,
    @InjectRepository(LinkPageLinkEntity)
    private readonly linkRepository: Repository<LinkPageLinkEntity>,
    @InjectRepository(LinkPageSocialLinkEntity)
    private readonly socialLinkRepository: Repository<LinkPageSocialLinkEntity>,
    @InjectRepository(LinkPageImageEntity)
    private readonly imageRepository: Repository<LinkPageImageEntity>,
    @InjectRepository(LinkPageVideoEntity)
    private readonly videoRepository: Repository<LinkPageVideoEntity>,
    @InjectRepository(LinkPageTextEntity)
    private readonly textRepository: Repository<LinkPageTextEntity>,
    @InjectRepository(LinkPageAnalyticsEventEntity)
    private readonly analyticsRepository: Repository<LinkPageAnalyticsEventEntity>,
    @InjectRepository(LinkPageFormSubmissionEntity)
    private readonly submissionRepository: Repository<LinkPageFormSubmissionEntity>,
    @Optional()
    private readonly presenceService?: LinkPagePresenceService,
    @Optional()
    private readonly publicCache?: PublicLinkPageCacheService,
  ) {}

  /**
   * Cache is keyed by public path: `cliente` or `cliente/post`.
   * A bio change also drops its posts' paths (slug renames change them).
   */
  private async invalidatePublicPageCache(page: {
    slug: string;
    parentPageId: string | null;
  }) {
    if (!this.publicCache) {
      return;
    }

    if (!page.parentPageId) {
      await this.publicCache.invalidateSlug(page.slug);
      await this.publicCache.invalidatePrefix(`${page.slug}/`);
      return;
    }

    const parent = await this.linkPageRepository.findOne({
      where: { id: page.parentPageId },
      withDeleted: true,
    });

    if (parent) {
      await this.publicCache.invalidateSlug(`${parent.slug}/${page.slug}`);
    }
  }

  private async getCompany(
    auth: AuthPayload,
    manager?: EntityManager,
    lock = false,
  ) {
    const repository = manager
      ? manager.getRepository(CompanyEntity)
      : this.companyRepository;

    // Postgres can't FOR UPDATE across outer joins: lock the row first.
    if (lock) {
      await repository.findOne({
        where: { id: auth.companyId },
        lock: { mode: 'pessimistic_write' },
      });
    }

    const company = await repository.findOne({
      where: { id: auth.companyId },
      relations: ENTITLEMENT_RELATIONS,
    });

    if (!company) {
      throw new AppException(ERROR_CODES.COMPANY_NOT_FOUND);
    }

    return company;
  }

  private async getPageForCompany(
    companyId: string,
    id: string,
    linkPageRepository = this.linkPageRepository,
  ) {
    const page = await linkPageRepository.findOne({
      where: { id, companyId },
      relations: { parentPage: true },
    });

    if (!page) {
      throw new AppException(ERROR_CODES.LINK_PAGE_NOT_FOUND);
    }

    return page;
  }

  private async getPageDetailForCompany(companyId: string, id: string) {
    const page = await this.getPageForCompany(companyId, id);
    page.links = await this.linkRepository.find({
      where: { linkPageId: id },
      order: { placement: 'ASC', sortOrder: 'ASC', createdAt: 'ASC' },
    });
    page.socialLinks = await this.socialLinkRepository.find({
      where: { linkPageId: id },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    page.images = await this.imageRepository.find({
      where: { linkPageId: id },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    page.videos = await this.videoRepository.find({
      where: { linkPageId: id },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    page.texts = await this.textRepository.find({
      where: { linkPageId: id },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });

    return page;
  }

  private assertLinkConfiguration(link: {
    kind: LinkPageLinkKind;
    placement?: LinkPageLinkPlacement;
    url?: string | null;
    contactType?: unknown;
    contactValue?: string | null;
    previewImageUrl?: string | null;
    previewDescription?: string | null;
    displaySize?: LinkPageMediaSize;
    customHeight?: number | null;
  }) {
    if (!isValidLinkConfiguration(link)) {
      throw new AppException(ERROR_CODES.LINK_PAGE_INVALID_LINK_CONFIGURATION);
    }

    this.assertMediaSize(link.displaySize, link);

    // Preview fields only mean something on PREVIEW (kind switches leave them behind).
    if (link.kind !== LinkPageLinkKind.PREVIEW) {
      link.previewImageUrl = null;
      link.previewDescription = null;
    }
  }

  /** CUSTOM needs a height; other sizes drop it (same rule as the DB CHECK). */
  private assertMediaSize(
    size: LinkPageMediaSize | undefined,
    target: { customHeight?: number | null },
  ) {
    if (size !== LinkPageMediaSize.CUSTOM) {
      target.customHeight = null;
      return;
    }

    if (!target.customHeight) {
      throw new AppException(ERROR_CODES.LINK_PAGE_INVALID_LINK_CONFIGURATION);
    }
  }

  private parseRange(
    from?: string,
    to?: string,
    defaultRangeDays = defaultFullAnalyticsRangeDays,
  ): AnalyticsRange {
    const now = new Date();
    const defaultFrom = new Date(now);
    defaultFrom.setDate(defaultFrom.getDate() - defaultRangeDays);
    const parsedFrom = from ? new Date(from) : defaultFrom;
    const parsedTo = to ? new Date(to) : now;

    return {
      from: Number.isNaN(parsedFrom.getTime()) ? defaultFrom : parsedFrom,
      to: Number.isNaN(parsedTo.getTime()) ? now : parsedTo,
    };
  }

  private parseAnalyticsRange(tier: AnalyticsTier, from?: string, to?: string) {
    if (tier === 'BASIC') {
      return this.parseRange(undefined, undefined, basicAnalyticsRangeDays);
    }

    return this.parseRange(from, to, defaultFullAnalyticsRangeDays);
  }

  private createAnalyticsBaseQuery(linkPageId: string, range: AnalyticsRange) {
    return this.analyticsRepository
      .createQueryBuilder('event')
      .where('event.linkPageId = :linkPageId', { linkPageId })
      .andWhere('event.createdAt BETWEEN :from AND :to', range);
  }

  private async getAnalyticsSummaryData(
    linkPageId: string,
    range: AnalyticsRange,
  ) {
    const base = this.createAnalyticsBaseQuery(linkPageId, range);
    const [
      pageViews,
      uniqueVisitors,
      totalClicks,
      averageDuration,
      onlineNow,
      formSubmissions,
      formDuration,
      formScore,
      qrCodeViews,
    ] = await Promise.all([
      base
        .clone()
        .andWhere('event.eventType = :eventType', {
          eventType: AnalyticsEventType.PAGE_VIEW,
        })
        .getCount(),
      base
        .clone()
        .select('COUNT(DISTINCT event.visitorId)', 'count')
        .andWhere('event.visitorId IS NOT NULL')
        .getRawOne<{ count: string }>(),
      base
        .clone()
        .andWhere('event.eventType IN (:...eventTypes)', {
          eventTypes: clickEventTypes,
        })
        .getCount(),
      base
        .clone()
        .select('AVG(event.durationMs)', 'average')
        .andWhere('event.eventType = :eventType', {
          eventType: AnalyticsEventType.PAGE_EXIT,
        })
        .andWhere('event.durationMs IS NOT NULL')
        .getRawOne<{ average: string | null }>(),
      this.presenceService?.countOnline(linkPageId) ?? Promise.resolve(0),
      // Always 0 for non-form pages; indexed on (link_page_id, created_at).
      this.submissionRepository.count({
        where: { linkPageId, createdAt: Between(range.from, range.to) },
      }),
      this.submissionRepository
        .createQueryBuilder('submission')
        .select('AVG(submission.durationMs)', 'average')
        .where('submission.linkPageId = :linkPageId', { linkPageId })
        .andWhere('submission.createdAt BETWEEN :from AND :to', range)
        .andWhere('submission.durationMs IS NOT NULL')
        .getRawOne<{ average: string | null }>(),
      this.submissionRepository
        .createQueryBuilder('submission')
        .select('AVG(submission.score)', 'average')
        .addSelect('AVG(submission.scoreMax)', 'max')
        .where('submission.linkPageId = :linkPageId', { linkPageId })
        .andWhere('submission.createdAt BETWEEN :from AND :to', range)
        .andWhere('submission.score IS NOT NULL')
        .getRawOne<{ average: string | null; max: string | null }>(),
      // The share tab's QR code links with ?utm_source=qrcode.
      base
        .clone()
        .andWhere('event.eventType = :eventType', {
          eventType: AnalyticsEventType.PAGE_VIEW,
        })
        .andWhere("event.utmSource = 'qrcode'")
        .getCount(),
    ]);

    return {
      onlineNow,
      pageViews,
      qrCodeViews,
      uniqueVisitors: Number(uniqueVisitors?.count ?? 0),
      totalClicks,
      clickThroughRate: pageViews ? totalClicks / pageViews : 0,
      averageDurationMs: Math.round(Number(averageDuration?.average ?? 0)),
      formSubmissions,
      averageFormDurationMs: Math.round(Number(formDuration?.average ?? 0)),
      /** Questionnaire score in the period; null = no scored answers. */
      averageFormScore:
        formScore?.average == null
          ? null
          : {
              score: Math.round(Number(formScore.average) * 10) / 10,
              max: Math.round(Number(formScore.max) * 10) / 10,
            },
    };
  }

  private async getAnalyticsTimeseriesData(
    linkPageId: string,
    range: AnalyticsRange,
  ) {
    return this.analyticsRepository
      .createQueryBuilder('event')
      .select("date_trunc('day', event.createdAt)", 'date')
      .addSelect('COUNT(*)', 'count')
      .where('event.linkPageId = :linkPageId', { linkPageId })
      .andWhere('event.eventType = :eventType', {
        eventType: AnalyticsEventType.PAGE_VIEW,
      })
      .andWhere('event.createdAt BETWEEN :from AND :to', range)
      .groupBy("date_trunc('day', event.createdAt)")
      .orderBy("date_trunc('day', event.createdAt)", 'ASC')
      .getRawMany();
  }

  private async getTopTargets(
    linkPageId: string,
    range: AnalyticsRange,
    limit?: number,
  ) {
    const qb = this.analyticsRepository
      .createQueryBuilder('event')
      .select('event.targetId', 'targetId')
      .addSelect('event.targetType', 'targetType')
      .addSelect('COUNT(*)', 'clicks')
      .where('event.linkPageId = :linkPageId', { linkPageId })
      .andWhere('event.createdAt BETWEEN :from AND :to', range)
      .andWhere('event.eventType IN (:...eventTypes)', {
        eventTypes: clickEventTypes,
      })
      .andWhere('event.targetId IS NOT NULL')
      .groupBy('event.targetId')
      .addGroupBy('event.targetType')
      .orderBy('COUNT(*)', 'DESC');

    if (limit) {
      qb.limit(limit);
    }

    return qb.getRawMany<{
      targetId: string;
      targetType: string;
      clicks: string;
    }>();
  }

  private async getAnalyticsGroupData(
    linkPageId: string,
    group: Exclude<AnalyticsGroup, 'links'>,
    range: AnalyticsRange,
  ) {
    const columnByGroup = {
      sources: "COALESCE(event.utmSource, event.referrer, 'Direct')",
      devices: "COALESCE(event.deviceType, 'unknown')",
      countries: "COALESCE(event.countryCode, 'unknown')",
    } as const;

    return this.createAnalyticsBaseQuery(linkPageId, range)
      .andWhere('event.eventType = :eventType', {
        eventType: AnalyticsEventType.PAGE_VIEW,
      })
      .select(columnByGroup[group], 'label')
      .addSelect('COUNT(*)', 'count')
      .groupBy(columnByGroup[group])
      .orderBy('COUNT(*)', 'DESC')
      .getRawMany<{ label: string; count: string }>();
  }

  /** Distinct visitor IPs (page views), most recent first. Every tier. */
  private async getVisitorIps(linkPageId: string, range: AnalyticsRange) {
    const rows = await this.createAnalyticsBaseQuery(linkPageId, range)
      .andWhere('event.eventType = :eventType', {
        eventType: AnalyticsEventType.PAGE_VIEW,
      })
      .andWhere('event.ipAddress IS NOT NULL')
      .select('event.ipAddress', 'ip')
      .addSelect('COUNT(*)', 'count')
      .addSelect('MAX(event.createdAt)', 'lastSeenAt')
      .groupBy('event.ipAddress')
      .orderBy('MAX(event.createdAt)', 'DESC')
      .limit(visitorIpsLimit)
      .getRawMany<{ ip: string; count: string; lastSeenAt: Date }>();

    return rows.map((row) => ({
      ip: row.ip,
      count: Number(row.count),
      lastSeenAt: new Date(row.lastSeenAt).toISOString(),
    }));
  }

  async list(auth: AuthPayload) {
    const company = await this.getCompany(auth);
    const pages = await this.linkPageRepository.find({
      where: { companyId: auth.companyId },
      relations: { parentPage: true },
      order: { type: 'ASC', createdAt: 'DESC' },
    });
    const usedClientPages = await this.linkPageRepository.count({
      where: { companyId: auth.companyId, type: LinkPageType.CLIENT },
    });
    const usedForms = pages.filter(
      (page) => page.type === LinkPageType.FORM,
    ).length;
    const { maxClientPages, maxForms } = entitlementsFor(company);

    return {
      items: pages.map(toLinkPageSummary),
      usage: {
        usedClientPages,
        maxClientPages,
        remainingClientPages: Math.max(0, maxClientPages - usedClientPages),
        usedForms,
        maxForms,
      },
    };
  }

  async get(auth: AuthPayload, id: string) {
    return toLinkPageDetail(
      await this.getPageDetailForCompany(auth.companyId, id),
    );
  }

  async create(auth: AuthPayload, dto: CreateLinkPageDto) {
    const detail = await this.dataSource.transaction(async (manager) => {
      const company = await this.getCompany(auth, manager, true);

      const linkPageRepository = manager.getRepository(LinkPageEntity);
      const existingSlug = await linkPageRepository.findOne({
        where: { slug: dto.slug, parentPageId: IsNull() },
      });

      if (existingSlug) {
        throw new AppException(ERROR_CODES.LINK_PAGE_SLUG_ALREADY_EXISTS);
      }

      const usedClientPages = await linkPageRepository.count({
        where: { companyId: auth.companyId, type: LinkPageType.CLIENT },
      });

      if (usedClientPages >= entitlementsFor(company).maxClientPages) {
        throw new AppException(ERROR_CODES.LINK_PAGE_PLAN_LIMIT_REACHED);
      }

      const page = linkPageRepository.create({
        companyId: auth.companyId,
        name: dto.name,
        slug: dto.slug,
        type: LinkPageType.CLIENT,
        status: LinkPageStatus.ACTIVE,
        layout: dto.layout,
        title: dto.title ?? dto.name,
        // Lost white-label: fall back to the entity default (LINKBUDS).
        ...(entitlementsFor(company).whiteLabel ? pickFooter(company) : {}),
      });

      try {
        return toLinkPageDetail(await linkPageRepository.save(page));
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new AppException(ERROR_CODES.LINK_PAGE_SLUG_ALREADY_EXISTS);
        }

        throw error;
      }
    });

    await this.invalidatePublicPageCache(detail);

    return detail;
  }

  async update(auth: AuthPayload, id: string, dto: UpdateLinkPageDto) {
    const page = await this.getPageForCompany(auth.companyId, id);
    const previous = { slug: page.slug, parentPageId: page.parentPageId };

    if (dto.slug && dto.slug !== page.slug) {
      // Bio slugs are global; post slugs are unique within their bio.
      const existing = await this.linkPageRepository.findOne({
        where: {
          slug: dto.slug,
          parentPageId: page.parentPageId ?? IsNull(),
        },
      });

      if (existing && existing.id !== page.id) {
        throw new AppException(ERROR_CODES.LINK_PAGE_SLUG_ALREADY_EXISTS);
      }
    }

    const {
      postNetwork,
      postUrl,
      form,
      formWebhookUrl,
      gtmContainerId,
      ga4MeasurementId,
      ...pageFields
    } = dto;
    Object.assign(
      page,
      pageFields,
      page.type === LinkPageType.POST && { postNetwork, postUrl },
      // cohort/closedAt only change through setFormState (autosave can't reopen).
      page.type === LinkPageType.FORM &&
        form && {
          form: {
            ...form,
            cohort: page.form?.cohort,
            closedAt: page.form?.closedAt ?? null,
          },
        },
      page.type === LinkPageType.FORM &&
        formWebhookUrl !== undefined && { formWebhookUrl },
      !page.parentPageId && { gtmContainerId, ga4MeasurementId },
    );

    try {
      const detail = toLinkPageDetail(await this.linkPageRepository.save(page));

      await this.invalidatePublicPageCache(previous);
      if (detail.slug !== previous.slug) {
        await this.invalidatePublicPageCache(detail);
      }

      return detail;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppException(ERROR_CODES.LINK_PAGE_SLUG_ALREADY_EXISTS);
      }

      throw error;
    }
  }

  async delete(auth: AuthPayload, id: string) {
    const page = await this.getPageForCompany(auth.companyId, id);

    if (page.type === LinkPageType.AGENCY) {
      throw new AppException(ERROR_CODES.LINK_PAGE_AGENCY_PROTECTED);
    }

    // A bio takes its post sub-pages with it.
    await this.linkPageRepository.softDelete({ parentPageId: id });
    await this.linkPageRepository.softDelete({ id });
    await this.invalidatePublicPageCache(page);

    return { message: 'LinkPage removida com sucesso' };
  }

  /** Post sub-page (/p/:bio/:post), styled like its bio at creation time. */
  async createPost(
    auth: AuthPayload,
    parentId: string,
    dto: CreatePostPageDto,
  ) {
    const detail = await this.createSubPage(auth, parentId, {
      type: LinkPageType.POST,
      name: dto.name,
      slug: dto.slug,
      title: dto.title,
      postNetwork: dto.postNetwork ?? null,
      postUrl: dto.postUrl ?? null,
    });
    await this.invalidatePublicPageCache(detail);

    return detail;
  }

  /** Form sub-page (/p/:bio/:form): same as a post, plus the default fields. */
  async createForm(
    auth: AuthPayload,
    parentId: string,
    dto: CreateFormPageDto,
  ) {
    // Company row lock serializes parallel creates: count + insert can't overshoot the quota.
    const detail = await this.dataSource.transaction(async (manager) => {
      const company = await this.getCompany(auth, manager, true);
      const usedForms = await manager.getRepository(LinkPageEntity).count({
        where: { companyId: auth.companyId, type: LinkPageType.FORM },
      });

      if (usedForms >= entitlementsFor(company).maxForms) {
        throw new AppException(ERROR_CODES.LINK_PAGE_FORM_LIMIT_REACHED);
      }

      return this.createSubPage(
        auth,
        parentId,
        {
          type: LinkPageType.FORM,
          name: dto.name,
          slug: dto.slug,
          title: dto.title,
          form: defaultFormConfig(),
        },
        manager,
      );
    });
    await this.invalidatePublicPageCache(detail);

    return detail;
  }

  private async createSubPage(
    auth: AuthPayload,
    parentId: string,
    dto: Pick<LinkPageEntity, 'name' | 'slug'> &
      Partial<Pick<LinkPageEntity, 'postNetwork' | 'postUrl' | 'form'>> & {
        type: LinkPageType.POST | LinkPageType.FORM;
        title?: string;
      },
    manager = this.dataSource.manager,
  ) {
    const linkPageRepository = manager.getRepository(LinkPageEntity);
    // Same manager as the caller's transaction: a second pool connection here deadlocks under load.
    const parent = await this.getPageForCompany(
      auth.companyId,
      parentId,
      linkPageRepository,
    );

    if (parent.parentPageId) {
      throw new AppException(ERROR_CODES.LINK_PAGE_INVALID_PARENT);
    }

    const existing = await linkPageRepository.findOne({
      where: { parentPageId: parent.id, slug: dto.slug },
    });

    if (existing) {
      throw new AppException(ERROR_CODES.LINK_PAGE_SLUG_ALREADY_EXISTS);
    }

    const post = linkPageRepository.create({
      companyId: auth.companyId,
      parentPageId: parent.id,
      parentPage: parent,
      type: dto.type,
      status: LinkPageStatus.ACTIVE,
      name: dto.name,
      slug: dto.slug,
      title: dto.title ?? parent.title,
      subtitle: null,
      postNetwork: dto.postNetwork ?? null,
      postUrl: dto.postUrl ?? null,
      form: dto.form ?? null,
      layout: parent.layout,
      backgroundType: parent.backgroundType,
      backgroundColor: parent.backgroundColor,
      backgroundImageUrl: parent.backgroundImageUrl,
      titleColor: parent.titleColor,
      subtitleColor: parent.subtitleColor,
      footerColor: parent.footerColor,
      backgroundGradientColor: parent.backgroundGradientColor,
      titleBold: parent.titleBold,
      subtitleBold: parent.subtitleBold,
      footerBold: parent.footerBold,
      footerStyle: parent.footerStyle,
      footerBackgroundColor: parent.footerBackgroundColor,
      footerBorderColor: parent.footerBorderColor,
      footerFontSize: parent.footerFontSize,
      footerLogoSize: parent.footerLogoSize,
      avatarUrl: parent.avatarUrl,
      footerMode: parent.footerMode,
      footerText: parent.footerText,
      footerUrl: parent.footerUrl,
      footerLogoUrl: parent.footerLogoUrl,
    });

    try {
      return toLinkPageDetail(await linkPageRepository.save(post));
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppException(ERROR_CODES.LINK_PAGE_SLUG_ALREADY_EXISTS);
      }

      throw error;
    }
  }

  async updateFooter(auth: AuthPayload, id: string, dto: UpdateFooterDto) {
    const [company, page] = await Promise.all([
      this.getCompany(auth),
      this.getPageForCompany(auth.companyId, id),
    ]);

    if (dto.footerMode !== LinkPageFooterMode.LINKBUDS) {
      assertEntitled(company, 'whiteLabel');
    }

    Object.assign(page, footerFromDto(dto));

    const detail = toLinkPageDetail(await this.linkPageRepository.save(page));

    await this.invalidatePublicPageCache(page);

    return detail;
  }

  async getFooterDefault(auth: AuthPayload) {
    return pickFooter(await this.getCompany(auth));
  }

  async updateFooterDefault(auth: AuthPayload, dto: UpdateFooterDefaultDto) {
    const company = await this.getCompany(auth);

    if (dto.footerMode !== LinkPageFooterMode.LINKBUDS) {
      assertEntitled(company, 'whiteLabel');
    }

    const { applyToExisting, ...fields } = dto;
    const footer = footerFromDto(fields);

    await this.companyRepository.update(company.id, footer);

    if (applyToExisting) {
      await this.linkPageRepository.update({ companyId: company.id }, footer);
      // Bio invalidation also clears its posts (prefix).
      const bios = await this.linkPageRepository.find({
        select: { slug: true, parentPageId: true },
        where: { companyId: company.id, parentPageId: IsNull() },
      });
      await Promise.all(bios.map((bio) => this.invalidatePublicPageCache(bio)));
    }

    return footer;
  }

  async createLink(
    auth: AuthPayload,
    linkPageId: string,
    dto: LinkPageLinkDto,
  ) {
    const page = await this.getPageForCompany(auth.companyId, linkPageId);
    this.assertLinkConfiguration(dto);
    const link = await this.linkRepository.save(
      this.linkRepository.create({
        ...dto,
        linkPageId,
        url: dto.url ?? null,
        contactType: dto.contactType ?? null,
        contactValue: dto.contactValue ?? null,
        previewImageUrl: dto.previewImageUrl ?? null,
        previewDescription: dto.previewDescription ?? null,
        customHeight: dto.customHeight ?? null,
      }),
    );

    await this.invalidatePublicPageCache(page);

    return toLinkPageLinkResponse(link);
  }

  async updateLink(
    auth: AuthPayload,
    linkPageId: string,
    linkId: string,
    dto: UpdateLinkPageLinkDto,
  ) {
    const page = await this.getPageForCompany(auth.companyId, linkPageId);
    const link = await this.linkRepository.findOne({
      where: { id: linkId, linkPageId },
    });

    if (!link) {
      throw new AppException(ERROR_CODES.LINK_PAGE_CHILD_NOT_FOUND);
    }

    Object.assign(link, dto);
    this.assertLinkConfiguration(link);

    const response = toLinkPageLinkResponse(
      await this.linkRepository.save(link),
    );

    await this.invalidatePublicPageCache(page);

    return response;
  }

  async deleteLink(auth: AuthPayload, linkPageId: string, linkId: string) {
    const page = await this.getPageForCompany(auth.companyId, linkPageId);
    const result = await this.linkRepository.softDelete({
      id: linkId,
      linkPageId,
    });

    if (!result.affected) {
      throw new AppException(ERROR_CODES.LINK_PAGE_CHILD_NOT_FOUND);
    }

    await this.invalidatePublicPageCache(page);

    return { message: 'Link removido com sucesso' };
  }

  async reorderLinks(
    auth: AuthPayload,
    linkPageId: string,
    dto: ReorderItemsDto,
  ) {
    const page = await this.getPageForCompany(auth.companyId, linkPageId);
    const ids = dto.map((item) => item.id);
    const links = await this.linkRepository.find({
      where: { id: In(ids), linkPageId },
    });

    if (links.length !== ids.length) {
      throw new AppException(ERROR_CODES.LINK_PAGE_CHILD_NOT_FOUND);
    }

    const sortOrderById = new Map(dto.map((item) => [item.id, item.sortOrder]));
    await this.linkRepository.save(
      links.map((link) => {
        link.sortOrder = sortOrderById.get(link.id) ?? link.sortOrder;
        return link;
      }),
    );

    await this.invalidatePublicPageCache(page);

    return { message: 'Links reordenados com sucesso' };
  }

  async reorderContent(
    auth: AuthPayload,
    linkPageId: string,
    dto: ReorderContentDto,
  ) {
    const page = await this.getPageForCompany(auth.companyId, linkPageId);
    const idsOf = (type: ReorderContentDto[number]['type']) =>
      dto.filter((item) => item.type === type).map((item) => item.id);
    const [links, images, videos, texts] = await Promise.all([
      this.linkRepository.find({
        where: { id: In(idsOf('LINK')), linkPageId },
      }),
      this.imageRepository.find({
        where: { id: In(idsOf('IMAGE')), linkPageId },
      }),
      this.videoRepository.find({
        where: { id: In(idsOf('VIDEO')), linkPageId },
      }),
      this.textRepository.find({
        where: { id: In(idsOf('TEXT')), linkPageId },
      }),
    ]);

    if (
      links.length + images.length + videos.length + texts.length !==
      dto.length
    ) {
      throw new AppException(ERROR_CODES.LINK_PAGE_CHILD_NOT_FOUND);
    }

    const sortOrderByKey = new Map(
      dto.map((item) => [`${item.type}:${item.id}`, item.sortOrder]),
    );
    const withOrder = <T extends { id: string; sortOrder: number }>(
      type: string,
      items: T[],
    ) =>
      items.map((item) => {
        item.sortOrder =
          sortOrderByKey.get(`${type}:${item.id}`) ?? item.sortOrder;
        return item;
      });

    // ponytail: four saves without a transaction, like the other reorders; the next drag rewrites every position anyway.
    await Promise.all([
      this.linkRepository.save(withOrder('LINK', links)),
      this.imageRepository.save(withOrder('IMAGE', images)),
      this.videoRepository.save(withOrder('VIDEO', videos)),
      this.textRepository.save(withOrder('TEXT', texts)),
    ]);

    await this.invalidatePublicPageCache(page);

    return { message: 'Conteúdo reordenado com sucesso' };
  }

  async createSocialLink(
    auth: AuthPayload,
    linkPageId: string,
    dto: LinkPageSocialLinkDto,
  ) {
    const page = await this.getPageForCompany(auth.companyId, linkPageId);
    const socialLink = await this.socialLinkRepository.save(
      this.socialLinkRepository.create({ ...dto, linkPageId }),
    );

    await this.invalidatePublicPageCache(page);

    return toSocialLinkResponse(socialLink);
  }

  async updateSocialLink(
    auth: AuthPayload,
    linkPageId: string,
    socialLinkId: string,
    dto: UpdateLinkPageSocialLinkDto,
  ) {
    const page = await this.getPageForCompany(auth.companyId, linkPageId);
    const socialLink = await this.socialLinkRepository.findOne({
      where: { id: socialLinkId, linkPageId },
    });

    if (!socialLink) {
      throw new AppException(ERROR_CODES.LINK_PAGE_CHILD_NOT_FOUND);
    }

    Object.assign(socialLink, dto);

    const response = toSocialLinkResponse(
      await this.socialLinkRepository.save(socialLink),
    );

    await this.invalidatePublicPageCache(page);

    return response;
  }

  async deleteSocialLink(
    auth: AuthPayload,
    linkPageId: string,
    socialLinkId: string,
  ) {
    const page = await this.getPageForCompany(auth.companyId, linkPageId);
    const result = await this.socialLinkRepository.softDelete({
      id: socialLinkId,
      linkPageId,
    });

    if (!result.affected) {
      throw new AppException(ERROR_CODES.LINK_PAGE_CHILD_NOT_FOUND);
    }

    await this.invalidatePublicPageCache(page);

    return { message: 'Rede social removida com sucesso' };
  }

  async reorderSocialLinks(
    auth: AuthPayload,
    linkPageId: string,
    dto: ReorderItemsDto,
  ) {
    const page = await this.getPageForCompany(auth.companyId, linkPageId);
    const ids = dto.map((item) => item.id);
    const socialLinks = await this.socialLinkRepository.find({
      where: { id: In(ids), linkPageId },
    });

    if (socialLinks.length !== ids.length) {
      throw new AppException(ERROR_CODES.LINK_PAGE_CHILD_NOT_FOUND);
    }

    const sortOrderById = new Map(dto.map((item) => [item.id, item.sortOrder]));
    await this.socialLinkRepository.save(
      socialLinks.map((socialLink) => {
        socialLink.sortOrder =
          sortOrderById.get(socialLink.id) ?? socialLink.sortOrder;
        return socialLink;
      }),
    );

    await this.invalidatePublicPageCache(page);

    return { message: 'Redes sociais reordenadas com sucesso' };
  }

  async createImage(
    auth: AuthPayload,
    linkPageId: string,
    dto: LinkPageImageDto,
  ) {
    const page = await this.getPageForCompany(auth.companyId, linkPageId);
    const image = await this.imageRepository.save(
      this.imageRepository.create({
        ...dto,
        linkPageId,
        altText: dto.altText ?? null,
        targetUrl: dto.targetUrl ?? null,
      }),
    );

    await this.invalidatePublicPageCache(page);

    return toImageResponse(image);
  }

  async updateImage(
    auth: AuthPayload,
    linkPageId: string,
    imageId: string,
    dto: UpdateLinkPageImageDto,
  ) {
    const page = await this.getPageForCompany(auth.companyId, linkPageId);
    const image = await this.imageRepository.findOne({
      where: { id: imageId, linkPageId },
    });

    if (!image) {
      throw new AppException(ERROR_CODES.LINK_PAGE_CHILD_NOT_FOUND);
    }

    Object.assign(image, dto);

    const response = toImageResponse(await this.imageRepository.save(image));

    await this.invalidatePublicPageCache(page);

    return response;
  }

  async deleteImage(auth: AuthPayload, linkPageId: string, imageId: string) {
    const page = await this.getPageForCompany(auth.companyId, linkPageId);
    const result = await this.imageRepository.softDelete({
      id: imageId,
      linkPageId,
    });

    if (!result.affected) {
      throw new AppException(ERROR_CODES.LINK_PAGE_CHILD_NOT_FOUND);
    }

    await this.invalidatePublicPageCache(page);

    return { message: 'Imagem removida com sucesso' };
  }

  async reorderImages(
    auth: AuthPayload,
    linkPageId: string,
    dto: ReorderItemsDto,
  ) {
    const page = await this.getPageForCompany(auth.companyId, linkPageId);
    const ids = dto.map((item) => item.id);
    const images = await this.imageRepository.find({
      where: { id: In(ids), linkPageId },
    });

    if (images.length !== ids.length) {
      throw new AppException(ERROR_CODES.LINK_PAGE_CHILD_NOT_FOUND);
    }

    const sortOrderById = new Map(dto.map((item) => [item.id, item.sortOrder]));
    await this.imageRepository.save(
      images.map((image) => {
        image.sortOrder = sortOrderById.get(image.id) ?? image.sortOrder;
        return image;
      }),
    );

    await this.invalidatePublicPageCache(page);

    return { message: 'Imagens reordenadas com sucesso' };
  }

  async createVideo(
    auth: AuthPayload,
    linkPageId: string,
    dto: LinkPageVideoDto,
  ) {
    const page = await this.getPageForCompany(auth.companyId, linkPageId);
    const video = this.videoRepository.create({
      ...dto,
      linkPageId,
      title: dto.title ?? null,
      customHeight: dto.customHeight ?? null,
    });
    this.assertMediaSize(video.size, video);

    const response = toVideoResponse(await this.videoRepository.save(video));

    await this.invalidatePublicPageCache(page);

    return response;
  }

  async updateVideo(
    auth: AuthPayload,
    linkPageId: string,
    videoId: string,
    dto: UpdateLinkPageVideoDto,
  ) {
    const page = await this.getPageForCompany(auth.companyId, linkPageId);
    const video = await this.videoRepository.findOne({
      where: { id: videoId, linkPageId },
    });

    if (!video) {
      throw new AppException(ERROR_CODES.LINK_PAGE_CHILD_NOT_FOUND);
    }

    Object.assign(video, dto);
    this.assertMediaSize(video.size, video);

    const response = toVideoResponse(await this.videoRepository.save(video));

    await this.invalidatePublicPageCache(page);

    return response;
  }

  async deleteVideo(auth: AuthPayload, linkPageId: string, videoId: string) {
    const page = await this.getPageForCompany(auth.companyId, linkPageId);
    const result = await this.videoRepository.softDelete({
      id: videoId,
      linkPageId,
    });

    if (!result.affected) {
      throw new AppException(ERROR_CODES.LINK_PAGE_CHILD_NOT_FOUND);
    }

    await this.invalidatePublicPageCache(page);

    return { message: 'Vídeo removido com sucesso' };
  }

  async createText(
    auth: AuthPayload,
    linkPageId: string,
    dto: LinkPageTextDto,
  ) {
    const page = await this.getPageForCompany(auth.companyId, linkPageId);
    const text = this.textRepository.create({ ...dto, linkPageId });
    const response = toTextResponse(await this.textRepository.save(text));

    await this.invalidatePublicPageCache(page);

    return response;
  }

  async updateText(
    auth: AuthPayload,
    linkPageId: string,
    textId: string,
    dto: UpdateLinkPageTextDto,
  ) {
    const page = await this.getPageForCompany(auth.companyId, linkPageId);
    const text = await this.textRepository.findOne({
      where: { id: textId, linkPageId },
    });

    if (!text) {
      throw new AppException(ERROR_CODES.LINK_PAGE_CHILD_NOT_FOUND);
    }

    Object.assign(text, dto);

    const response = toTextResponse(await this.textRepository.save(text));

    await this.invalidatePublicPageCache(page);

    return response;
  }

  async deleteText(auth: AuthPayload, linkPageId: string, textId: string) {
    const page = await this.getPageForCompany(auth.companyId, linkPageId);
    const result = await this.textRepository.softDelete({
      id: textId,
      linkPageId,
    });

    if (!result.affected) {
      throw new AppException(ERROR_CODES.LINK_PAGE_CHILD_NOT_FOUND);
    }

    await this.invalidatePublicPageCache(page);

    return { message: 'Texto removido com sucesso' };
  }

  async recordPublicEvent(
    linkPageId: string,
    dto: AnalyticsEventDto,
    context: AnalyticsRequestContext = {},
  ) {
    const page = await this.linkPageRepository.findOne({
      where: { id: linkPageId, status: LinkPageStatus.ACTIVE },
    });

    if (!page) {
      throw new AppException(ERROR_CODES.LINK_PAGE_NOT_FOUND);
    }

    const userAgent = getHeaderValue(context.headers, 'user-agent') ?? '';

    if (isBotUserAgent(userAgent)) {
      return { id: null, ignored: true };
    }

    const countryCode =
      normalizeCountryCode(getHeaderValue(context.headers, 'cf-ipcountry')) ??
      normalizeCountryCode(
        getHeaderValue(context.headers, 'x-vercel-ip-country'),
      ) ??
      normalizeCountryCode(
        getHeaderValue(context.headers, 'cloudfront-viewer-country'),
      ) ??
      normalizeCountryCode(getHeaderValue(context.headers, 'x-country-code')) ??
      dto.countryCode ??
      null;

    try {
      const event = await this.analyticsRepository.save(
        this.analyticsRepository.create({
          ...dto,
          eventId: dto.eventId ?? null,
          linkPageId,
          targetType: dto.targetType ?? null,
          targetId: dto.targetId ?? null,
          visitorId: dto.visitorId ?? null,
          sessionId: dto.sessionId ?? null,
          referrer: dto.referrer ?? null,
          utmSource: dto.utmSource ?? null,
          utmMedium: dto.utmMedium ?? null,
          utmCampaign: dto.utmCampaign ?? null,
          utmContent: dto.utmContent ?? null,
          utmTerm: dto.utmTerm ?? null,
          countryCode,
          ipAddress: resolveClientIp(context),
          deviceType: detectDeviceType(userAgent) ?? dto.deviceType ?? null,
          browser: detectBrowser(userAgent) ?? dto.browser ?? null,
          operatingSystem:
            detectOperatingSystem(userAgent) ?? dto.operatingSystem ?? null,
          durationMs: dto.durationMs ?? null,
          metadata: dto.metadata ?? null,
        }),
      );

      return { id: event.id, ignored: false };
    } catch (error) {
      if (dto.eventId && isUniqueViolation(error)) {
        const event = await this.analyticsRepository.findOne({
          where: { eventId: dto.eventId },
        });

        return { id: event?.id ?? null, ignored: false };
      }

      throw error;
    }
  }

  /** Public form submission; the visitor data mirrors an analytics event's. */
  async submitForm(
    linkPageId: string,
    dto: SubmitFormDto,
    context: AnalyticsRequestContext = {},
  ) {
    const page = await this.linkPageRepository.findOne({
      where: {
        id: linkPageId,
        type: LinkPageType.FORM,
        status: LinkPageStatus.ACTIVE,
      },
      relations: { parentPage: true },
    });

    if (
      !page?.form ||
      !page.parentPage ||
      page.parentPage.deletedAt ||
      page.parentPage.status !== LinkPageStatus.ACTIVE
    ) {
      throw new AppException(ERROR_CODES.LINK_PAGE_NOT_FOUND);
    }

    const userAgent = getHeaderValue(context.headers, 'user-agent') ?? '';

    // Honeypot filled or a crawler: pretend it worked, store nothing.
    if (dto.website || isBotUserAgent(userAgent)) {
      return { id: null };
    }

    const result = validateFormAnswers(page.form.fields, dto.answers);

    if (!result.ok) {
      throw new AppException(ERROR_CODES.LINK_PAGE_FORM_INVALID_ANSWERS, {
        details: result.invalid.map((path) => ({
          path,
          message: 'Valor inválido',
        })),
      });
    }

    const { submission, closed } = await this.dataSource.transaction(
      async (manager) => {
        // Row lock serializes this form's submissions: limit and unique checks can't race.
        const locked = await manager.findOneOrFail(LinkPageEntity, {
          where: { id: linkPageId },
          lock: { mode: 'pessimistic_write' },
        });
        const form = locked.form!;
        const cohort = formCohort(form);
        const submissions = manager.getRepository(LinkPageFormSubmissionEntity);

        if (form.closedAt) {
          throw new AppException(ERROR_CODES.LINK_PAGE_FORM_CLOSED);
        }

        for (const field of form.fields.filter((field) => field.unique)) {
          const value = result.answers.find(
            (answer) => answer.id === field.id,
          )?.value;
          if (typeof value !== 'string') continue;

          const taken = await submissions
            .createQueryBuilder('submission')
            .where('submission.linkPageId = :linkPageId', { linkPageId })
            .andWhere('submission.cohort = :cohort', { cohort })
            .andWhere(
              `EXISTS (SELECT 1 FROM jsonb_array_elements(submission.answers) answer
                WHERE answer->>'id' = :fieldId AND lower(answer->>'value') = lower(:value))`,
              { fieldId: field.id, value },
            )
            .getExists();

          if (taken) {
            throw new AppException(
              ERROR_CODES.LINK_PAGE_FORM_ALREADY_ANSWERED,
              {
                message: `Já existe uma resposta registrada com este "${field.label}". Não é possível enviar o formulário novamente com o mesmo valor.`,
                details: [{ path: field.id, message: 'Já respondido' }],
              },
            );
          }
        }

        const count = form.maxResponses
          ? await submissions.count({ where: { linkPageId, cohort } })
          : 0;
        const closeForm = async () => {
          locked.form = { ...form, closedAt: new Date().toISOString() };
          await manager.save(locked);
        };

        // Limit lowered in the editor below what this cohort already has.
        if (form.maxResponses && count >= form.maxResponses) {
          await closeForm();
          return { submission: null, closed: true };
        }

        const scored = scoreFormAnswers(form, result.answers);
        const saved = await submissions.save(
          submissions.create({
            linkPageId,
            cohort,
            answers: result.answers,
            score: scored?.score ?? null,
            scoreMax: scored?.max ?? null,
            visitorId: dto.visitorId ?? null,
            durationMs: dto.durationMs ?? null,
            ipAddress: resolveClientIp(context),
            countryCode:
              normalizeCountryCode(
                getHeaderValue(context.headers, 'cf-ipcountry'),
              ) ??
              normalizeCountryCode(
                getHeaderValue(context.headers, 'x-vercel-ip-country'),
              ),
            deviceType: detectDeviceType(userAgent),
            browser: detectBrowser(userAgent),
            operatingSystem: detectOperatingSystem(userAgent),
            userAgent: userAgent.slice(0, 1000) || null,
          }),
        );

        // This answer filled the cohort: close right away.
        const full = Boolean(
          form.maxResponses && count + 1 >= form.maxResponses,
        );
        if (full) await closeForm();

        return { submission: saved, closed: full };
      },
    );

    if (closed) await this.invalidatePublicPageCache(page);

    if (!submission) {
      throw new AppException(ERROR_CODES.LINK_PAGE_FORM_CLOSED);
    }

    // Answer is already stored; the sheet is best effort (resend covers failures).
    void this.deliverToSheet(page, submission);

    return {
      id: submission.id,
      score:
        page.form.scoring?.show && submission.score !== null
          ? { score: submission.score, max: submission.scoreMax }
          : null,
    };
  }

  /** POSTs one answer to the form's Apps Script; marks it delivered on `{ok:true}`. */
  private async deliverToSheet(
    page: Pick<LinkPageEntity, 'id' | 'name' | 'formWebhookUrl'>,
    submission: LinkPageFormSubmissionEntity,
  ) {
    if (!page.formWebhookUrl) return false;

    try {
      // Apps Script answers 302 → script.googleusercontent.com; fetch follows it.
      const response = await fetch(page.formWebhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          toSheetRow({ id: page.id, name: page.name }, submission),
        ),
        signal: AbortSignal.timeout(webhookTimeoutMs),
      });
      // A broken script still answers 200 with an HTML error page.
      const body = (await response.json().catch(() => null)) as {
        ok?: boolean;
      } | null;

      if (!response.ok || body?.ok !== true) {
        throw new Error(`status ${response.status}`);
      }

      await this.submissionRepository.update(submission.id, {
        webhookDeliveredAt: new Date(),
      });
      return true;
    } catch (error) {
      this.logger.warn(
        `Google Sheets webhook failed for form ${page.id}: ${String(error)}`,
      );
      return false;
    }
  }

  /** Sends answers not yet in the sheet (failures + answers before it was set). */
  async resendSubmissions(auth: AuthPayload, linkPageId: string) {
    const page = await this.getPageForCompany(auth.companyId, linkPageId);

    if (page.type !== LinkPageType.FORM || !page.formWebhookUrl) {
      throw new AppException(ERROR_CODES.LINK_PAGE_FORM_WEBHOOK_MISSING);
    }

    // Oldest first so the sheet keeps chronological order.
    const pending = await this.submissionRepository.find({
      where: { linkPageId, webhookDeliveredAt: IsNull() },
      order: { createdAt: 'ASC' },
      take: formSubmissionsLimit,
    });
    let sent = 0;

    // ponytail: sequential, one request per answer; batch payload if forms get big.
    for (const submission of pending) {
      if (!(await this.deliverToSheet(page, submission))) break;
      sent += 1;
    }

    return { sent, failed: pending.length - sent };
  }

  async listSubmissions(auth: AuthPayload, linkPageId: string) {
    const page = await this.getPageForCompany(auth.companyId, linkPageId);

    if (page.type !== LinkPageType.FORM || !page.form) {
      throw new AppException(ERROR_CODES.LINK_PAGE_NOT_FOUND);
    }

    const [[items, total], cohortTotal] = await Promise.all([
      this.submissionRepository.findAndCount({
        where: { linkPageId },
        order: { createdAt: 'DESC' },
        take: formSubmissionsLimit,
      }),
      this.submissionRepository.count({
        where: { linkPageId, cohort: formCohort(page.form) },
      }),
    ]);

    return { items: items.map(toFormSubmissionResponse), total, cohortTotal };
  }

  /**
   * Close now, or reopen. Reopening may start a new cohort (unique fields and
   * the limit count per cohort) and set a new limit.
   */
  async setFormState(auth: AuthPayload, linkPageId: string, dto: FormStateDto) {
    const page = await this.getPageForCompany(auth.companyId, linkPageId);

    if (page.type !== LinkPageType.FORM || !page.form) {
      throw new AppException(ERROR_CODES.LINK_PAGE_NOT_FOUND);
    }

    if (dto.closed) {
      page.form = {
        ...page.form,
        closedAt: page.form.closedAt ?? new Date().toISOString(),
      };
    } else {
      const cohort = dto.cohort ?? formCohort(page.form);
      const maxResponses =
        dto.maxResponses === undefined
          ? page.form.maxResponses
          : dto.maxResponses;

      if (
        maxResponses &&
        (await this.submissionRepository.count({
          where: { linkPageId, cohort },
        })) >= maxResponses
      ) {
        throw new AppException(ERROR_CODES.LINK_PAGE_FORM_LIMIT_TOO_LOW);
      }

      page.form = { ...page.form, cohort, maxResponses, closedAt: null };
    }

    await this.linkPageRepository.save(page);
    await this.invalidatePublicPageCache(page);

    return this.get(auth, linkPageId);
  }

  async deleteSubmission(
    auth: AuthPayload,
    linkPageId: string,
    submissionId: string,
  ) {
    await this.getPageForCompany(auth.companyId, linkPageId);
    const { affected } = await this.submissionRepository.delete({
      id: submissionId,
      linkPageId,
    });

    if (!affected) {
      throw new AppException(ERROR_CODES.LINK_PAGE_CHILD_NOT_FOUND);
    }

    return { message: 'Resposta removida' };
  }

  async recordPresence(linkPageId: string, sessionId: string) {
    const page = await this.linkPageRepository.findOne({
      where: { id: linkPageId, status: LinkPageStatus.ACTIVE },
    });

    if (!page) {
      throw new AppException(ERROR_CODES.LINK_PAGE_NOT_FOUND);
    }

    const onlineNow =
      (await this.presenceService?.heartbeat(linkPageId, sessionId)) ?? 0;

    return { onlineNow };
  }

  private async assertAnalyticsAccess(auth: AuthPayload, linkPageId: string) {
    const [company, page] = await Promise.all([
      this.getCompany(auth),
      this.getPageForCompany(auth.companyId, linkPageId),
    ]);

    return {
      company,
      page,
      tier: entitlementsFor(company).analyticsTier,
    };
  }

  async overview(auth: AuthPayload, from?: string, to?: string) {
    const company = await this.getCompany(auth);
    const tier = entitlementsFor(company).analyticsTier;
    const range = this.parseAnalyticsRange(tier, from, to);
    const pages = await this.linkPageRepository.find({
      where: { companyId: auth.companyId },
      relations: { parentPage: true },
    });
    const pageIds = pages.map((page) => page.id);
    const clickTypes = [
      AnalyticsEventType.LINK_CLICK,
      AnalyticsEventType.SOCIAL_CLICK,
      AnalyticsEventType.IMAGE_CLICK,
    ];
    const base = (window: AnalyticsRange = range) =>
      this.analyticsRepository
        .createQueryBuilder('event')
        .where('event.linkPageId IN (:...pageIds)', { pageIds })
        .andWhere('event.createdAt BETWEEN :from AND :to', window)
        .setParameters({ pageView: AnalyticsEventType.PAGE_VIEW, clickTypes });
    const metrics = (qb: SelectQueryBuilder<LinkPageAnalyticsEventEntity>) =>
      qb
        .addSelect(
          'COUNT(*) FILTER (WHERE event.eventType = :pageView)',
          'pageViews',
        )
        .addSelect(
          'COUNT(DISTINCT event.visitorId) FILTER (WHERE event.eventType = :pageView)',
          'visitors',
        )
        .addSelect(
          'COUNT(*) FILTER (WHERE event.eventType IN (:...clickTypes))',
          'clicks',
        );
    type MetricRow = { pageViews: string; visitors: string; clicks: string };
    // Home cards: one bar per day of the window, % vs the window right before.
    const day = 86_400_000;
    const span = range.to.getTime() - range.from.getTime();
    const days = Math.max(1, Math.ceil(span / day));
    const previousRange = {
      from: new Date(range.from.getTime() - span),
      to: range.from,
    };
    const dayIndex =
      'FLOOR(EXTRACT(EPOCH FROM (event.createdAt - :from)) / 86400)';

    const [rows, totals] = pageIds.length
      ? await Promise.all([
          metrics(base().select('event.linkPageId', 'linkPageId'))
            .groupBy('event.linkPageId')
            .getRawMany<MetricRow & { linkPageId: string }>(),
          metrics(base().select([])).getRawOne<MetricRow>(),
        ])
      : [[], undefined];
    const byPage = new Map(rows.map((row) => [row.linkPageId, row]));
    // Visitors count only on their first day in the window, so bars sum to the total.
    const firstVisits = base()
      .select('event.visitorId', 'visitorId')
      .addSelect(`MIN(${dayIndex})`, 'day')
      .andWhere('event.eventType = :pageView')
      .andWhere('event.visitorId IS NOT NULL')
      .groupBy('event.visitorId');
    const [dailyRows, newVisitorRows, previous] = pageIds.length
      ? await Promise.all([
          metrics(base().select(dayIndex, 'day'))
            .groupBy(dayIndex)
            .getRawMany<MetricRow & { day: string }>(),
          this.analyticsRepository.manager
            .createQueryBuilder()
            .select('first.day', 'day')
            .addSelect('COUNT(*)', 'visitors')
            .from(`(${firstVisits.getQuery()})`, 'first')
            .setParameters(firstVisits.getParameters())
            .groupBy('first.day')
            .getRawMany<{ day: string; visitors: string }>(),
          metrics(base(previousRange).select([])).getRawOne<MetricRow>(),
        ])
      : [[], [], undefined];
    const daily = {
      pageViews: Array.from({ length: days }, () => 0),
      visitors: Array.from({ length: days }, () => 0),
      clicks: Array.from({ length: days }, () => 0),
    };
    for (const row of dailyRows) {
      const index = Number(row.day);
      if (index < 0 || index >= days) continue;
      daily.pageViews[index] = Number(row.pageViews);
      daily.clicks[index] = Number(row.clicks);
    }
    for (const row of newVisitorRows) {
      const index = Number(row.day);
      if (index >= 0 && index < days)
        daily.visitors[index] = Number(row.visitors);
    }
    const formIds = pages
      .filter((page) => page.type === LinkPageType.FORM)
      .map((page) => page.id);
    const submissionRows = formIds.length
      ? await this.submissionRepository
          .createQueryBuilder('submission')
          .select('submission.linkPageId', 'linkPageId')
          .addSelect('submission.cohort', 'cohort')
          .addSelect('COUNT(*)', 'count')
          .where('submission.linkPageId IN (:...formIds)', { formIds })
          .groupBy('submission.linkPageId')
          .addGroupBy('submission.cohort')
          .getRawMany<{ linkPageId: string; cohort: string; count: string }>()
      : [];
    const submissionsByPage = new Map<string, number>();
    const cohortCounts = new Map<string, number>();
    for (const row of submissionRows) {
      submissionsByPage.set(
        row.linkPageId,
        (submissionsByPage.get(row.linkPageId) ?? 0) + Number(row.count),
      );
      cohortCounts.set(`${row.linkPageId}:${row.cohort}`, Number(row.count));
    }

    return {
      tier,
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
      totals: {
        pageViews: Number(totals?.pageViews ?? 0),
        visitors: Number(totals?.visitors ?? 0),
        clicks: Number(totals?.clicks ?? 0),
      },
      previousTotals: {
        pageViews: Number(previous?.pageViews ?? 0),
        visitors: Number(previous?.visitors ?? 0),
        clicks: Number(previous?.clicks ?? 0),
      },
      daily,
      pages: pages
        .map((page) => {
          const row = byPage.get(page.id);

          return {
            ...toLinkPageSummary(page),
            pageViews: Number(row?.pageViews ?? 0),
            visitors: Number(row?.visitors ?? 0),
            clicks: Number(row?.clicks ?? 0),
            /** All-time total (not limited to the analytics window). */
            submissions: submissionsByPage.get(page.id) ?? 0,
            formLimit: page.form
              ? toFormLimit(
                  page.form,
                  cohortCounts.get(`${page.id}:${formCohort(page.form)}`) ?? 0,
                )
              : null,
          };
        })
        .sort((a, b) => b.pageViews - a.pageViews || b.clicks - a.clicks),
    };
  }

  async analyticsInsights(
    auth: AuthPayload,
    linkPageId: string,
    from?: string,
    to?: string,
  ) {
    const { tier, page } = await this.assertAnalyticsAccess(auth, linkPageId);
    const range = this.parseAnalyticsRange(tier, from, to);
    const [
      formLimit,
      summary,
      topTargets,
      timeseries,
      sources,
      devices,
      countries,
      visitorIps,
    ] = await Promise.all([
      // Cohort-wide (not the period): what the limit counts.
      page.form?.maxResponses
        ? this.submissionRepository
            .count({ where: { linkPageId, cohort: formCohort(page.form) } })
            .then((current) => toFormLimit(page.form, current))
        : null,
      this.getAnalyticsSummaryData(linkPageId, range),
      this.getTopTargets(linkPageId, range, tier === 'BASIC' ? 5 : undefined),
      tier === 'FULL'
        ? this.getAnalyticsTimeseriesData(linkPageId, range)
        : Promise.resolve([]),
      tier === 'FULL'
        ? this.getAnalyticsGroupData(linkPageId, 'sources', range)
        : Promise.resolve([]),
      tier === 'FULL'
        ? this.getAnalyticsGroupData(linkPageId, 'devices', range)
        : Promise.resolve([]),
      tier === 'FULL'
        ? this.getAnalyticsGroupData(linkPageId, 'countries', range)
        : Promise.resolve([]),
      this.getVisitorIps(linkPageId, range),
    ]);

    return {
      tier,
      range: {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      },
      summary,
      formLimit,
      topTargets,
      timeseries,
      sources,
      devices,
      countries,
      visitorIps,
      limits: {
        maxRangeDays: tier === 'BASIC' ? basicAnalyticsRangeDays : null,
        advancedDimensionsEnabled: tier === 'FULL',
      },
    };
  }

  /**
   * Page views per country with the latest visits, for the globe (FULL tier).
   * Realtime = latest view of each session still online.
   */
  async analyticsGeo(
    auth: AuthPayload,
    linkPageId: string,
    options: { realtime?: boolean; from?: string; to?: string } = {},
  ) {
    const { tier } = await this.assertAnalyticsAccess(auth, linkPageId);

    if (tier !== 'FULL') {
      throw new AppException(ERROR_CODES.LINK_PAGE_FEATURE_FORBIDDEN);
    }

    const qb = this.analyticsRepository
      .createQueryBuilder('event')
      .where('event.linkPageId = :linkPageId', { linkPageId })
      .andWhere('event.eventType = :eventType', {
        eventType: AnalyticsEventType.PAGE_VIEW,
      })
      .orderBy('event.createdAt', 'DESC')
      .take(geoVisitsScanLimit);

    if (options.realtime) {
      const sessions =
        (await this.presenceService?.onlineSessions(linkPageId)) ?? [];

      if (!sessions.length) {
        return { realtime: true, total: 0, locations: [] };
      }

      qb.andWhere('event.sessionId IN (:...sessions)', { sessions });
    } else {
      const range = this.parseAnalyticsRange(tier, options.from, options.to);
      qb.andWhere('event.createdAt BETWEEN :from AND :to', range);
    }

    const events = await qb.getMany();
    const seenSessions = new Set<string>();
    const byCountry = new Map<
      string,
      { countryCode: string; count: number; visits: unknown[] }
    >();

    for (const event of events) {
      if (options.realtime && event.sessionId) {
        if (seenSessions.has(event.sessionId)) continue;
        seenSessions.add(event.sessionId);
      }

      const countryCode = event.countryCode ?? 'unknown';
      const location = byCountry.get(countryCode) ?? {
        countryCode,
        count: 0,
        visits: [],
      };
      location.count += 1;

      if (location.visits.length < geoVisitsPerCountry) {
        location.visits.push({
          createdAt: event.createdAt.toISOString(),
          ipAddress: event.ipAddress,
          deviceType: event.deviceType,
          browser: event.browser,
          operatingSystem: event.operatingSystem,
          source: event.utmSource ?? event.referrer,
        });
      }

      byCountry.set(countryCode, location);
    }

    const locations = [...byCountry.values()].sort((a, b) => b.count - a.count);

    return {
      realtime: Boolean(options.realtime),
      total: locations.reduce((sum, location) => sum + location.count, 0),
      locations,
    };
  }

  /** Clicks per editable link, in the same tier window as the insights. */
  async analyticsLinkClicks(
    auth: AuthPayload,
    linkPageId: string,
    from?: string,
    to?: string,
  ) {
    const { tier } = await this.assertAnalyticsAccess(auth, linkPageId);
    const range = this.parseAnalyticsRange(tier, from, to);

    const rows = await this.createAnalyticsBaseQuery(linkPageId, range)
      .select('event.targetId', 'linkId')
      .addSelect('COUNT(*)', 'clicks')
      .andWhere('event.eventType = :eventType', {
        eventType: AnalyticsEventType.LINK_CLICK,
      })
      .andWhere('event.targetType IN (:...targetTypes)', {
        targetTypes: [
          AnalyticsTargetType.HORIZONTAL_LINK,
          AnalyticsTargetType.VERTICAL_LINK,
        ],
      })
      .andWhere('event.targetId IS NOT NULL')
      .groupBy('event.targetId')
      .orderBy('COUNT(*)', 'DESC')
      .getRawMany<{ linkId: string; clicks: string }>();

    return {
      items: rows.map((row) => ({
        linkId: row.linkId,
        clicks: Number(row.clicks),
      })),
    };
  }

  async getPublicSitemap(publicWebUrl: string) {
    const baseUrl = publicWebUrl.replace(/\/$/, '');
    const pages = await this.linkPageRepository.find({
      where: { deletedAt: IsNull(), status: LinkPageStatus.ACTIVE },
      relations: { parentPage: true },
      order: { updatedAt: 'DESC' },
    });
    const paths = pages.flatMap((page) => {
      if (!page.parentPageId) return [{ path: page.slug, page }];
      const parent = page.parentPage;
      const parentVisible =
        parent && !parent.deletedAt && parent.status === LinkPageStatus.ACTIVE;

      return parentVisible
        ? [{ path: `${parent.slug}/${page.slug}`, page }]
        : [];
    });

    const urls = paths
      .map(
        ({ path, page }) => `
  <url>
    <loc>${escapeXml(`${baseUrl}/p/${path}`)}</loc>
    <lastmod>${page.updatedAt.toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`,
      )
      .join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}
</urlset>`;
  }

  /** Only ACTIVE domains serve pages: ownership (TXT) and routing proven. */
  private findActiveDomain(hostname: string | undefined) {
    return hostname
      ? this.domainRepository.findOne({
          where: {
            deletedAt: IsNull(),
            hostname,
            status: CompanyDomainStatus.ACTIVE,
          },
        })
      : Promise.resolve(null);
  }

  /** Root of a custom domain (`dominio.com/`) shows the agency's own page. */
  async resolveDomainHome(
    hostname: string | undefined,
  ): Promise<PublicLinkPageResponse> {
    const normalizedHostname = normalizeHostname(hostname);
    const domain = await this.findActiveDomain(normalizedHostname);
    const page = domain
      ? await this.linkPageRepository.findOne({
          where: {
            companyId: domain.companyId,
            type: LinkPageType.AGENCY,
            status: LinkPageStatus.ACTIVE,
            deletedAt: IsNull(),
          },
        })
      : null;

    if (!page) {
      throw new AppException(ERROR_CODES.LINK_PAGE_NOT_FOUND);
    }

    return this.resolvePublic(normalizedHostname, page.slug);
  }

  /** `/p/:slug` (bio) or `/p/:slug/:postSlug` (post or form sub-page). */
  async resolvePublic(
    hostname: string | undefined,
    slug: string,
    postSlug?: string,
  ): Promise<PublicLinkPageResponse> {
    const normalizedHostname = normalizeHostname(hostname);
    const cachePath = postSlug ? `${slug}/${postSlug}` : slug;
    const cached = await this.publicCache?.get<PublicLinkPageResponse>(
      normalizedHostname,
      cachePath,
    );

    if (cached) {
      return cached;
    }

    const customDomain = await this.findActiveDomain(normalizedHostname);

    const bio = await this.linkPageRepository.findOne({
      where: {
        ...(customDomain ? { companyId: customDomain.companyId } : {}),
        parentPageId: IsNull(),
        deletedAt: IsNull(),
        slug,
        status: LinkPageStatus.ACTIVE,
      },
    });
    const page =
      bio && postSlug
        ? await this.linkPageRepository.findOne({
            where: {
              parentPageId: bio.id,
              deletedAt: IsNull(),
              slug: postSlug,
              status: LinkPageStatus.ACTIVE,
            },
          })
        : bio;

    if (!page) {
      throw new AppException(ERROR_CODES.LINK_PAGE_NOT_FOUND);
    }

    const [links, socialLinks, images, videos, texts] = await Promise.all([
      this.linkRepository.find({
        where: { active: true, deletedAt: IsNull(), linkPageId: page.id },
        order: { placement: 'ASC', sortOrder: 'ASC', createdAt: 'ASC' },
      }),
      this.socialLinkRepository.find({
        where: { active: true, deletedAt: IsNull(), linkPageId: page.id },
        order: { sortOrder: 'ASC', createdAt: 'ASC' },
      }),
      this.imageRepository.find({
        where: { active: true, deletedAt: IsNull(), linkPageId: page.id },
        order: { sortOrder: 'ASC', createdAt: 'ASC' },
      }),
      this.videoRepository.find({
        where: { active: true, deletedAt: IsNull(), linkPageId: page.id },
        order: { sortOrder: 'ASC', createdAt: 'ASC' },
      }),
      this.textRepository.find({
        where: { active: true, deletedAt: IsNull(), linkPageId: page.id },
        order: { sortOrder: 'ASC', createdAt: 'ASC' },
      }),
    ]);

    page.links = links.filter((link) =>
      [
        LinkPageLinkPlacement.HORIZONTAL,
        LinkPageLinkPlacement.VERTICAL,
      ].includes(link.placement),
    );
    page.socialLinks = socialLinks;
    page.images = images;
    page.videos = videos;
    page.texts = texts;

    const detail = toLinkPageDetail(page);
    const response: PublicLinkPageResponse = {
      id: detail.id,
      name: detail.name,
      slug: detail.slug,
      status: detail.status,
      layout: detail.layout,
      backgroundType: detail.backgroundType,
      backgroundColor: detail.backgroundColor,
      backgroundImageUrl: detail.backgroundImageUrl,
      titleColor: detail.titleColor,
      subtitleColor: detail.subtitleColor,
      footerColor: detail.footerColor,
      backgroundGradientColor: detail.backgroundGradientColor,
      titleBold: detail.titleBold,
      subtitleBold: detail.subtitleBold,
      footerBold: detail.footerBold,
      footerStyle: detail.footerStyle,
      footerBackgroundColor: detail.footerBackgroundColor,
      footerBorderColor: detail.footerBorderColor,
      footerFontSize: detail.footerFontSize,
      footerLogoSize: detail.footerLogoSize,
      avatarUrl: detail.avatarUrl,
      title: detail.title,
      subtitle: detail.subtitle,
      footerMode: detail.footerMode,
      footerText: detail.footerText,
      footerUrl: detail.footerUrl,
      footerLogoUrl: detail.footerLogoUrl,
      parentSlug: postSlug ? slug : null,
      form: toPublicForm(detail.form),
      postNetwork: detail.postNetwork,
      postUrl: detail.postUrl,
      gtmContainerId: bio!.gtmContainerId,
      ga4MeasurementId: bio!.ga4MeasurementId,
      links: detail.links,
      socialLinks: detail.socialLinks,
      images: detail.images,
      videos: detail.videos,
      texts: detail.texts,
    };

    await this.publicCache?.set(normalizedHostname, cachePath, response);

    return response;
  }
}
