import { normalizeHostname } from 'src/shared/utils/hostname';
import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { IncomingHttpHeaders } from 'node:http';
import { isIP } from 'node:net';
import { DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';
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
  CreatePostPageDto,
  LinkPageImageDto,
  LinkPageVideoDto,
  LinkPageLinkDto,
  LinkPageSocialLinkDto,
  ReorderContentDto,
  ReorderItemsDto,
  UpdateFooterDefaultDto,
  UpdateFooterDto,
  UpdateLinkPageDto,
  UpdateLinkPageImageDto,
  UpdateLinkPageVideoDto,
  UpdateLinkPageLinkDto,
  UpdateLinkPageSocialLinkDto,
} from './dto/link-page.dto';
import { LinkPagePresenceService } from './link-page-presence.service';
import {
  toImageResponse,
  toVideoResponse,
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
  /** Bio slug when this is a post sub-page. */
  parentSlug: string | null;
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
};

const basicAnalyticsRangeDays = 7;
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
    @InjectRepository(LinkPageAnalyticsEventEntity)
    private readonly analyticsRepository: Repository<LinkPageAnalyticsEventEntity>,
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

  private async getPageForCompany(companyId: string, id: string) {
    const page = await this.linkPageRepository.findOne({
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
    const [pageViews, uniqueVisitors, totalClicks, averageDuration, onlineNow] =
      await Promise.all([
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
      ]);

    return {
      onlineNow,
      pageViews,
      uniqueVisitors: Number(uniqueVisitors?.count ?? 0),
      totalClicks,
      clickThroughRate: pageViews ? totalClicks / pageViews : 0,
      averageDurationMs: Math.round(Number(averageDuration?.average ?? 0)),
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
    const { maxClientPages } = entitlementsFor(company);

    return {
      items: pages.map(toLinkPageSummary),
      usage: {
        usedClientPages,
        maxClientPages,
        remainingClientPages: Math.max(0, maxClientPages - usedClientPages),
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
      gtmContainerId,
      ga4MeasurementId,
      ...pageFields
    } = dto;
    Object.assign(
      page,
      pageFields,
      page.type === LinkPageType.POST
        ? { postNetwork, postUrl }
        : { gtmContainerId, ga4MeasurementId },
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
    const parent = await this.getPageForCompany(auth.companyId, parentId);

    if (parent.type === LinkPageType.POST) {
      throw new AppException(ERROR_CODES.LINK_PAGE_INVALID_PARENT);
    }

    const existing = await this.linkPageRepository.findOne({
      where: { parentPageId: parent.id, slug: dto.slug },
    });

    if (existing) {
      throw new AppException(ERROR_CODES.LINK_PAGE_SLUG_ALREADY_EXISTS);
    }

    const post = this.linkPageRepository.create({
      companyId: auth.companyId,
      parentPageId: parent.id,
      parentPage: parent,
      type: LinkPageType.POST,
      status: LinkPageStatus.ACTIVE,
      name: dto.name,
      slug: dto.slug,
      title: dto.title ?? parent.title,
      subtitle: null,
      postNetwork: dto.postNetwork ?? null,
      postUrl: dto.postUrl ?? null,
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
      const detail = toLinkPageDetail(await this.linkPageRepository.save(post));
      await this.invalidatePublicPageCache(detail);

      return detail;
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
    const [links, images, videos] = await Promise.all([
      this.linkRepository.find({
        where: { id: In(idsOf('LINK')), linkPageId },
      }),
      this.imageRepository.find({
        where: { id: In(idsOf('IMAGE')), linkPageId },
      }),
      this.videoRepository.find({
        where: { id: In(idsOf('VIDEO')), linkPageId },
      }),
    ]);

    if (links.length + images.length + videos.length !== dto.length) {
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

    // ponytail: three saves without a transaction, like the other reorders; the next drag rewrites every position anyway.
    await Promise.all([
      this.linkRepository.save(withOrder('LINK', links)),
      this.imageRepository.save(withOrder('IMAGE', images)),
      this.videoRepository.save(withOrder('VIDEO', videos)),
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
    const [company] = await Promise.all([
      this.getCompany(auth),
      this.getPageForCompany(auth.companyId, linkPageId),
    ]);

    return {
      company,
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
    const base = () =>
      this.analyticsRepository
        .createQueryBuilder('event')
        .where('event.linkPageId IN (:...pageIds)', { pageIds })
        .andWhere('event.createdAt BETWEEN :from AND :to', range)
        .setParameters({ pageView: AnalyticsEventType.PAGE_VIEW, clickTypes });

    const [rows, totals] = pageIds.length
      ? await Promise.all([
          base()
            .select('event.linkPageId', 'linkPageId')
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
            )
            .groupBy('event.linkPageId')
            .getRawMany<{
              linkPageId: string;
              pageViews: string;
              visitors: string;
              clicks: string;
            }>(),
          base()
            .select(
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
            )
            .getRawOne<{
              pageViews: string;
              visitors: string;
              clicks: string;
            }>(),
        ])
      : [[], undefined];
    const byPage = new Map(rows.map((row) => [row.linkPageId, row]));

    return {
      tier,
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
      totals: {
        pageViews: Number(totals?.pageViews ?? 0),
        visitors: Number(totals?.visitors ?? 0),
        clicks: Number(totals?.clicks ?? 0),
      },
      pages: pages
        .map((page) => {
          const row = byPage.get(page.id);

          return {
            ...toLinkPageSummary(page),
            pageViews: Number(row?.pageViews ?? 0),
            visitors: Number(row?.visitors ?? 0),
            clicks: Number(row?.clicks ?? 0),
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
    const { tier } = await this.assertAnalyticsAccess(auth, linkPageId);
    const range = this.parseAnalyticsRange(tier, from, to);
    const [
      summary,
      topTargets,
      timeseries,
      sources,
      devices,
      countries,
      visitorIps,
    ] = await Promise.all([
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

  /** `/p/:slug` (bio) or `/p/:slug/:postSlug` (post sub-page). */
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

    const [links, socialLinks, images, videos] = await Promise.all([
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
      postNetwork: detail.postNetwork,
      postUrl: detail.postUrl,
      gtmContainerId: bio!.gtmContainerId,
      ga4MeasurementId: bio!.ga4MeasurementId,
      links: detail.links,
      socialLinks: detail.socialLinks,
      images: detail.images,
      videos: detail.videos,
    };

    await this.publicCache?.set(normalizedHostname, cachePath, response);

    return response;
  }
}
