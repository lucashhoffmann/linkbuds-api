import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { IncomingHttpHeaders } from 'node:http';
import { DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';
import { Action } from 'src/modules/authorization/domain/enums/action.enum';
import { AuthorizationSubject } from 'src/modules/authorization/domain/enums/authorization-subject.enum';
import { AppAbilityFactory } from 'src/modules/authorization/application/app-ability.factory';
import { CompanyDomainEntity } from 'src/modules/company/domain/entities/company-domain.entity';
import { CompanyEntity } from 'src/modules/company/domain/entities/company.entity';
import { CompanyDomainStatus } from 'src/modules/company/domain/enums/company-domain-status.enum';
import { PlanEntity } from 'src/modules/plan/domain/entities/plan.entity';
import { PlanType } from 'src/modules/plan/domain/enums/plan-type.enum';
import { ERROR_CODES } from 'src/shared/constants/errors.constants';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ValidationException,
} from 'src/shared/exceptions/business.exception';
import type { AuthPayload } from 'src/shared/types/auth-payload.types';
import { LinkPageAnalyticsEventEntity } from '../domain/entities/link-page-analytics-event.entity';
import { LinkPageImageEntity } from '../domain/entities/link-page-image.entity';
import { LinkPageLinkEntity } from '../domain/entities/link-page-link.entity';
import { LinkPageSocialLinkEntity } from '../domain/entities/link-page-social-link.entity';
import { LinkPageEntity } from '../domain/entities/link-page.entity';
import { AnalyticsEventType } from '../domain/enums/analytics-event-type.enum';
import { AnalyticsTargetType } from '../domain/enums/analytics-target-type.enum';
import { LinkPageFooterMode } from '../domain/enums/link-page-footer-mode.enum';
import { LinkPageLinkKind } from '../domain/enums/link-page-link-kind.enum';
import { LinkPageLinkPlacement } from '../domain/enums/link-page-link-placement.enum';
import { LinkPageStatus } from '../domain/enums/link-page-status.enum';
import { LinkPageType } from '../domain/enums/link-page-type.enum';
import {
  AnalyticsEventDto,
  CreateLinkPageDto,
  LinkPageImageDto,
  LinkPageLinkDto,
  LinkPageSocialLinkDto,
  ReorderItemsDto,
  UpdateFooterDto,
  UpdateLinkPageDto,
  UpdateLinkPageImageDto,
  UpdateLinkPageLinkDto,
  UpdateLinkPageSocialLinkDto,
} from './dto/link-page.dto';
import { LinkPagePresenceService } from './link-page-presence.service';
import {
  toImageResponse,
  toLinkPageDetail,
  toLinkPageLinkResponse,
  toLinkPageSummary,
  toSocialLinkResponse,
} from './link-page.mapper';
import { PublicLinkPageCacheService } from './public-link-page-cache.service';

type AnalyticsRange = {
  from: Date;
  to: Date;
};

type AnalyticsTier = 'BASIC' | 'FULL';

type AnalyticsGroup = 'links' | 'sources' | 'devices' | 'countries';

type AnalyticsRequestContext = {
  headers?: IncomingHttpHeaders;
};

type PublicLinkPageResponse = {
  id: string;
  name: string;
  slug: string;
  status: LinkPageStatus;
  layout: LinkPageEntity['layout'];
  backgroundType: LinkPageEntity['backgroundType'];
  backgroundColor: string;
  backgroundImageUrl: string | null;
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
};

const basicAnalyticsRangeDays = 7;
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

function normalizeHostname(hostname?: string) {
  return (hostname ?? '').split(':')[0]?.trim().toLowerCase() ?? '';
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

function analyticsTierForPlan(
  plan: PlanEntity | null | undefined,
): AnalyticsTier {
  if (plan?.type === PlanType.AGENCY || plan?.type === PlanType.CUSTOM) {
    return 'FULL';
  }

  return 'BASIC';
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
    private readonly abilityFactory: AppAbilityFactory,
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
    @InjectRepository(LinkPageAnalyticsEventEntity)
    private readonly analyticsRepository: Repository<LinkPageAnalyticsEventEntity>,
    @Optional()
    private readonly presenceService?: LinkPagePresenceService,
    @Optional()
    private readonly publicCache?: PublicLinkPageCacheService,
  ) {}

  private async invalidatePublicPageCache(slug: string) {
    await this.publicCache?.invalidateSlug(slug);
  }

  private async getCompany(
    auth: AuthPayload,
    manager?: EntityManager,
    lock = false,
  ) {
    const repository = manager
      ? manager.getRepository(CompanyEntity)
      : this.companyRepository;
    const company = await repository.findOne({
      where: { id: auth.companyId },
      ...(lock ? {} : { relations: { plan: true } }),
      ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });

    if (!company) {
      throw new NotFoundException(ERROR_CODES.COMPANY_NOT_FOUND);
    }

    if (lock) {
      const planRepository = (manager ?? this.dataSource.manager).getRepository(
        PlanEntity,
      );
      company.plan = company.planId
        ? await planRepository.findOne({ where: { id: company.planId } })
        : await planRepository.findOne({
            where: { code: PlanType.FREE, active: true },
          });

      if (!company.planId && company.plan) {
        company.planId = company.plan.id;
        await repository.save(company);
      }
    }

    return company;
  }

  private assertFeature(
    company: CompanyEntity,
    action: Action,
    authorizationSubject: AuthorizationSubject,
  ) {
    const ability = this.abilityFactory.createForCompany(company);
    this.abilityFactory.assertCan(ability, action, authorizationSubject, {
      companyId: company.id,
    });
  }

  private async getPageForCompany(companyId: string, id: string) {
    const page = await this.linkPageRepository.findOne({
      where: { id, companyId },
    });

    if (!page) {
      throw new NotFoundException(ERROR_CODES.LINK_PAGE_NOT_FOUND);
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

    return page;
  }

  private assertLinkConfiguration(link: {
    kind: LinkPageLinkKind;
    url?: string | null;
    contactType?: unknown;
    contactValue?: string | null;
  }) {
    if (
      link.kind === LinkPageLinkKind.LINK &&
      link.url &&
      !link.contactType &&
      !link.contactValue
    ) {
      return;
    }

    if (
      link.kind === LinkPageLinkKind.CONTACT &&
      !link.url &&
      link.contactType &&
      link.contactValue
    ) {
      return;
    }

    throw new ValidationException(
      ERROR_CODES.LINK_PAGE_INVALID_LINK_CONFIGURATION,
    );
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
      .select(columnByGroup[group], 'label')
      .addSelect('COUNT(*)', 'count')
      .groupBy(columnByGroup[group])
      .orderBy('COUNT(*)', 'DESC')
      .getRawMany<{ label: string; count: string }>();
  }

  async list(auth: AuthPayload) {
    const company = await this.getCompany(auth);
    const pages = await this.linkPageRepository.find({
      where: { companyId: auth.companyId },
      order: { type: 'ASC', createdAt: 'DESC' },
    });
    const usedClientPages = await this.linkPageRepository.count({
      where: { companyId: auth.companyId, type: LinkPageType.CLIENT },
    });
    const maxClientPages = company.plan?.maxClientPages ?? 0;

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

      if (!company.plan?.active) {
        throw new ForbiddenException(ERROR_CODES.LINK_PAGE_PLAN_REQUIRED);
      }

      const linkPageRepository = manager.getRepository(LinkPageEntity);
      const existingSlug = await linkPageRepository.findOne({
        where: { slug: dto.slug },
      });

      if (existingSlug) {
        throw new ConflictException(ERROR_CODES.LINK_PAGE_SLUG_ALREADY_EXISTS);
      }

      const usedClientPages = await linkPageRepository.count({
        where: { companyId: auth.companyId, type: LinkPageType.CLIENT },
      });

      if (usedClientPages >= company.plan.maxClientPages) {
        throw new ForbiddenException(ERROR_CODES.LINK_PAGE_PLAN_LIMIT_REACHED);
      }

      const page = linkPageRepository.create({
        companyId: auth.companyId,
        name: dto.name,
        slug: dto.slug,
        type: LinkPageType.CLIENT,
        status: LinkPageStatus.ACTIVE,
        layout: dto.layout,
        title: dto.title ?? dto.name,
      });

      try {
        return toLinkPageDetail(await linkPageRepository.save(page));
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ConflictException(
            ERROR_CODES.LINK_PAGE_SLUG_ALREADY_EXISTS,
          );
        }

        throw error;
      }
    });

    await this.invalidatePublicPageCache(detail.slug);

    return detail;
  }

  async update(auth: AuthPayload, id: string, dto: UpdateLinkPageDto) {
    const page = await this.getPageForCompany(auth.companyId, id);
    const previousSlug = page.slug;

    if (dto.slug && dto.slug !== page.slug) {
      const existing = await this.linkPageRepository.findOne({
        where: { slug: dto.slug },
      });

      if (existing && existing.id !== page.id) {
        throw new ConflictException(ERROR_CODES.LINK_PAGE_SLUG_ALREADY_EXISTS);
      }
    }

    Object.assign(page, dto);

    try {
      const detail = toLinkPageDetail(await this.linkPageRepository.save(page));

      await this.invalidatePublicPageCache(previousSlug);
      if (detail.slug !== previousSlug) {
        await this.invalidatePublicPageCache(detail.slug);
      }

      return detail;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(ERROR_CODES.LINK_PAGE_SLUG_ALREADY_EXISTS);
      }

      throw error;
    }
  }

  async delete(auth: AuthPayload, id: string) {
    const page = await this.getPageForCompany(auth.companyId, id);

    if (page.type === LinkPageType.AGENCY) {
      throw new ForbiddenException(ERROR_CODES.LINK_PAGE_AGENCY_PROTECTED);
    }

    await this.linkPageRepository.softDelete(id);
    await this.invalidatePublicPageCache(page.slug);

    return { message: 'LinkPage removida com sucesso' };
  }

  async updateFooter(auth: AuthPayload, id: string, dto: UpdateFooterDto) {
    const [company, page] = await Promise.all([
      this.getCompany(auth),
      this.getPageForCompany(auth.companyId, id),
    ]);

    if (dto.footerMode !== LinkPageFooterMode.LINKSBUDS) {
      this.assertFeature(
        company,
        Action.ManageWhiteLabel,
        AuthorizationSubject.LinkPageWhiteLabel,
      );
    }

    page.footerMode = dto.footerMode;
    page.footerText = dto.footerText ?? null;
    page.footerUrl = dto.footerUrl ?? null;
    page.footerLogoUrl = dto.footerLogoUrl ?? null;

    const detail = toLinkPageDetail(await this.linkPageRepository.save(page));

    await this.invalidatePublicPageCache(page.slug);

    return detail;
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
      }),
    );

    await this.invalidatePublicPageCache(page.slug);

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
      throw new NotFoundException(ERROR_CODES.LINK_PAGE_CHILD_NOT_FOUND);
    }

    Object.assign(link, dto);
    this.assertLinkConfiguration(link);

    const response = toLinkPageLinkResponse(
      await this.linkRepository.save(link),
    );

    await this.invalidatePublicPageCache(page.slug);

    return response;
  }

  async deleteLink(auth: AuthPayload, linkPageId: string, linkId: string) {
    const page = await this.getPageForCompany(auth.companyId, linkPageId);
    const result = await this.linkRepository.softDelete({
      id: linkId,
      linkPageId,
    });

    if (!result.affected) {
      throw new NotFoundException(ERROR_CODES.LINK_PAGE_CHILD_NOT_FOUND);
    }

    await this.invalidatePublicPageCache(page.slug);

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
      throw new NotFoundException(ERROR_CODES.LINK_PAGE_CHILD_NOT_FOUND);
    }

    const sortOrderById = new Map(dto.map((item) => [item.id, item.sortOrder]));
    await this.linkRepository.save(
      links.map((link) => {
        link.sortOrder = sortOrderById.get(link.id) ?? link.sortOrder;
        return link;
      }),
    );

    await this.invalidatePublicPageCache(page.slug);

    return { message: 'Links reordenados com sucesso' };
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

    await this.invalidatePublicPageCache(page.slug);

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
      throw new NotFoundException(ERROR_CODES.LINK_PAGE_CHILD_NOT_FOUND);
    }

    Object.assign(socialLink, dto);

    const response = toSocialLinkResponse(
      await this.socialLinkRepository.save(socialLink),
    );

    await this.invalidatePublicPageCache(page.slug);

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
      throw new NotFoundException(ERROR_CODES.LINK_PAGE_CHILD_NOT_FOUND);
    }

    await this.invalidatePublicPageCache(page.slug);

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
      throw new NotFoundException(ERROR_CODES.LINK_PAGE_CHILD_NOT_FOUND);
    }

    const sortOrderById = new Map(dto.map((item) => [item.id, item.sortOrder]));
    await this.socialLinkRepository.save(
      socialLinks.map((socialLink) => {
        socialLink.sortOrder =
          sortOrderById.get(socialLink.id) ?? socialLink.sortOrder;
        return socialLink;
      }),
    );

    await this.invalidatePublicPageCache(page.slug);

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

    await this.invalidatePublicPageCache(page.slug);

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
      throw new NotFoundException(ERROR_CODES.LINK_PAGE_CHILD_NOT_FOUND);
    }

    Object.assign(image, dto);

    const response = toImageResponse(await this.imageRepository.save(image));

    await this.invalidatePublicPageCache(page.slug);

    return response;
  }

  async deleteImage(auth: AuthPayload, linkPageId: string, imageId: string) {
    const page = await this.getPageForCompany(auth.companyId, linkPageId);
    const result = await this.imageRepository.softDelete({
      id: imageId,
      linkPageId,
    });

    if (!result.affected) {
      throw new NotFoundException(ERROR_CODES.LINK_PAGE_CHILD_NOT_FOUND);
    }

    await this.invalidatePublicPageCache(page.slug);

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
      throw new NotFoundException(ERROR_CODES.LINK_PAGE_CHILD_NOT_FOUND);
    }

    const sortOrderById = new Map(dto.map((item) => [item.id, item.sortOrder]));
    await this.imageRepository.save(
      images.map((image) => {
        image.sortOrder = sortOrderById.get(image.id) ?? image.sortOrder;
        return image;
      }),
    );

    await this.invalidatePublicPageCache(page.slug);

    return { message: 'Imagens reordenadas com sucesso' };
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
      throw new NotFoundException(ERROR_CODES.LINK_PAGE_NOT_FOUND);
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
      throw new NotFoundException(ERROR_CODES.LINK_PAGE_NOT_FOUND);
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

    this.assertFeature(
      company,
      Action.ViewAnalytics,
      AuthorizationSubject.LinkPageAnalytics,
    );

    return {
      company,
      tier: analyticsTierForPlan(company.plan),
    };
  }

  async analyticsSummary(
    auth: AuthPayload,
    linkPageId: string,
    from?: string,
    to?: string,
  ) {
    const { tier } = await this.assertAnalyticsAccess(auth, linkPageId);
    const range = this.parseAnalyticsRange(tier, from, to);

    return this.getAnalyticsSummaryData(linkPageId, range);
  }

  async analyticsTimeseries(
    auth: AuthPayload,
    linkPageId: string,
    from?: string,
    to?: string,
  ) {
    const { tier } = await this.assertAnalyticsAccess(auth, linkPageId);

    if (tier === 'BASIC') {
      return [];
    }

    const range = this.parseAnalyticsRange(tier, from, to);

    return this.getAnalyticsTimeseriesData(linkPageId, range);
  }

  async analyticsGroup(
    auth: AuthPayload,
    linkPageId: string,
    group: AnalyticsGroup,
    from?: string,
    to?: string,
  ) {
    const { tier } = await this.assertAnalyticsAccess(auth, linkPageId);
    const range = this.parseAnalyticsRange(tier, from, to);

    if (group === 'links') {
      return this.getTopTargets(
        linkPageId,
        range,
        tier === 'BASIC' ? 5 : undefined,
      );
    }

    if (tier === 'BASIC') {
      return [];
    }

    return this.getAnalyticsGroupData(linkPageId, group, range);
  }

  async analyticsInsights(
    auth: AuthPayload,
    linkPageId: string,
    from?: string,
    to?: string,
  ) {
    const { tier } = await this.assertAnalyticsAccess(auth, linkPageId);
    const range = this.parseAnalyticsRange(tier, from, to);
    const [summary, topTargets, timeseries, sources, devices, countries] =
      await Promise.all([
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
      limits: {
        maxRangeDays: tier === 'BASIC' ? basicAnalyticsRangeDays : null,
        advancedDimensionsEnabled: tier === 'FULL',
      },
    };
  }

  async analyticsLinkClicks(auth: AuthPayload, linkPageId: string) {
    await this.assertAnalyticsAccess(auth, linkPageId);

    const rows = await this.analyticsRepository
      .createQueryBuilder('event')
      .select('event.targetId', 'linkId')
      .addSelect('COUNT(*)', 'clicks')
      .where('event.linkPageId = :linkPageId', { linkPageId })
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
      select: {
        slug: true,
        updatedAt: true,
      },
      where: { deletedAt: IsNull(), status: LinkPageStatus.ACTIVE },
      order: { updatedAt: 'DESC' },
    });

    const urls = pages
      .map(
        (page) => `
  <url>
    <loc>${escapeXml(`${baseUrl}/p/${page.slug}`)}</loc>
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

  async resolvePublic(
    hostname: string | undefined,
    slug: string,
  ): Promise<PublicLinkPageResponse> {
    const normalizedHostname = normalizeHostname(hostname);
    const cached = await this.publicCache?.get<PublicLinkPageResponse>(
      normalizedHostname,
      slug,
    );

    if (cached) {
      return cached;
    }

    const customDomain = normalizedHostname
      ? await this.domainRepository.findOne({
          where: [
            {
              deletedAt: IsNull(),
              hostname: normalizedHostname,
              status: CompanyDomainStatus.ACTIVE,
            },
            {
              deletedAt: IsNull(),
              hostname: normalizedHostname,
              status: CompanyDomainStatus.VERIFIED,
            },
          ],
        })
      : null;

    const where = customDomain
      ? {
          companyId: customDomain.companyId,
          deletedAt: IsNull(),
          slug,
          status: LinkPageStatus.ACTIVE,
        }
      : { deletedAt: IsNull(), slug, status: LinkPageStatus.ACTIVE };
    const page = await this.linkPageRepository.findOne({ where });

    if (!page) {
      throw new NotFoundException(ERROR_CODES.LINK_PAGE_NOT_FOUND);
    }

    const [links, socialLinks, images] = await Promise.all([
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
    ]);

    page.links = links.filter((link) =>
      [
        LinkPageLinkPlacement.HORIZONTAL,
        LinkPageLinkPlacement.VERTICAL,
      ].includes(link.placement),
    );
    page.socialLinks = socialLinks;
    page.images = images;

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
      avatarUrl: detail.avatarUrl,
      title: detail.title,
      subtitle: detail.subtitle,
      footerMode: detail.footerMode,
      footerText: detail.footerText,
      footerUrl: detail.footerUrl,
      footerLogoUrl: detail.footerLogoUrl,
      links: detail.links,
      socialLinks: detail.socialLinks,
      images: detail.images,
    };

    await this.publicCache?.set(normalizedHostname, slug, response);

    return response;
  }
}
