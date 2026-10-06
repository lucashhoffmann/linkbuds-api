import { UserRole } from 'src/modules/user/domain/enums/user-role.enum';
import { CompanyEntity } from 'src/modules/company/domain/entities/company.entity';
import { ERROR_CODES } from 'src/shared/errors/error-catalog';
import { AnalyticsEventType } from '../domain/enums/analytics-event-type.enum';
import { AnalyticsTargetType } from '../domain/enums/analytics-target-type.enum';
import {
  LinkPageFooterMode,
  LinkPageFooterSize,
  LinkPageFooterStyle,
} from '../domain/enums/link-page-footer-mode.enum';
import { LinkPageMediaSize } from '../domain/enums/link-page-media-size.enum';
import { LinkPageLinkKind } from '../domain/enums/link-page-link-kind.enum';
import { LinkPageLinkPlacement } from '../domain/enums/link-page-link-placement.enum';
import { LinkPageLayout } from '../domain/enums/link-page-layout.enum';
import { LinkPageStatus } from '../domain/enums/link-page-status.enum';
import { LinkPageType } from '../domain/enums/link-page-type.enum';
import {
  LinkPageService,
  resolveClientIp,
} from '../application/link-page.service';

function createRepositoryMock() {
  return {
    count: jest.fn(),
    create: jest.fn((value) => value),
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn((value) => Promise.resolve({ id: 'saved-id', ...value })),
    softDelete: jest.fn(),
    update: jest.fn(),
  };
}

function createQueryBuilderMock(rawRows: unknown[] = []) {
  const queryBuilder = {
    addSelect: jest.fn(),
    andWhere: jest.fn(),
    getRawMany: jest.fn().mockResolvedValue(rawRows),
    groupBy: jest.fn(),
    limit: jest.fn(),
    orderBy: jest.fn(),
    select: jest.fn(),
    where: jest.fn(),
  };

  Object.values(queryBuilder).forEach((value) => {
    if (jest.isMockFunction(value) && value !== queryBuilder.getRawMany) {
      value.mockReturnValue(queryBuilder);
    }
  });

  return queryBuilder;
}

function createService(options?: {
  analyticsRepository?: ReturnType<typeof createRepositoryMock>;
  presenceService?: {
    countOnline?: jest.Mock;
    heartbeat?: jest.Mock;
    onlineSessions?: jest.Mock;
  };
  publicCache?: {
    get?: jest.Mock;
    invalidateSlug?: jest.Mock;
    set?: jest.Mock;
  };
}) {
  const companyRepository = createRepositoryMock();
  const domainRepository = createRepositoryMock();
  const linkRepository = createRepositoryMock();
  const linkPageRepository = createRepositoryMock();
  const socialLinkRepository = createRepositoryMock();
  const imageRepository = createRepositoryMock();
  const videoRepository = createRepositoryMock();
  const analyticsRepository =
    options?.analyticsRepository ?? createRepositoryMock();
  const publicCache = {
    get: jest.fn().mockResolvedValue(null),
    invalidateSlug: jest.fn().mockResolvedValue(undefined),
    invalidatePrefix: jest.fn().mockResolvedValue(undefined),
    set: jest.fn().mockResolvedValue(undefined),
    ...options?.publicCache,
  };
  const dataSource = {
    transaction: jest.fn((handler) =>
      handler({
        getRepository: jest.fn((entity) =>
          entity === CompanyEntity ? companyRepository : linkPageRepository,
        ),
      }),
    ),
  };

  const service = new LinkPageService(
    dataSource as never,
    companyRepository as never,
    domainRepository as never,
    linkPageRepository as never,
    linkRepository as never,
    socialLinkRepository as never,
    imageRepository as never,
    videoRepository as never,
    analyticsRepository as never,
    createRepositoryMock() as never,
    options?.presenceService as never,
    publicCache as never,
  );

  return {
    analyticsRepository,
    companyRepository,
    dataSource,
    domainRepository,
    imageRepository,
    videoRepository,
    linkRepository,
    linkPageRepository,
    publicCache,
    socialLinkRepository,
    service,
  };
}

const defaultFooterStyle = {
  footerStyle: LinkPageFooterStyle.TEXT,
  footerBackgroundColor: null,
  footerBorderColor: null,
  footerColor: null,
  footerBold: false,
  footerFontSize: LinkPageFooterSize.SMALL,
  footerLogoSize: LinkPageFooterSize.SMALL,
};

describe('LinkPageService', () => {
  const auth = { id: 'user-id', companyId: 'company-id', role: UserRole.OWNER };

  it('creates a client page after locking the company row', async () => {
    const { companyRepository, linkPageRepository, service } = createService();
    companyRepository.findOne.mockResolvedValue({
      id: auth.companyId,
      plan: { maxClientPages: 2 },
    });
    linkPageRepository.count.mockResolvedValue(1);
    linkPageRepository.save.mockImplementation((value) =>
      Promise.resolve({
        id: 'created-page-id',
        ...value,
        links: [],
        socialLinks: [],
        images: [],
      }),
    );

    const result = await service.create(auth, {
      name: 'Cliente',
      slug: 'cliente',
      layout: LinkPageLayout.LAYOUT_1,
    });

    expect(companyRepository.findOne).toHaveBeenNthCalledWith(1, {
      where: { id: auth.companyId },
      lock: { mode: 'pessimistic_write' },
    });
    expect(companyRepository.findOne).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ relations: expect.anything() }),
    );
    expect(linkPageRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: auth.companyId,
        slug: 'cliente',
        type: LinkPageType.CLIENT,
      }),
    );
    expect(result).toMatchObject({
      id: 'created-page-id',
      slug: 'cliente',
      type: LinkPageType.CLIENT,
    });
  });

  it('rejects client pages beyond the entitled quota', async () => {
    const { companyRepository, linkPageRepository, service } = createService();
    companyRepository.findOne.mockResolvedValue({
      id: auth.companyId,
      plan: { maxClientPages: 1 },
    });
    linkPageRepository.count.mockResolvedValue(1);

    await expect(
      service.create(auth, {
        name: 'Cliente',
        slug: 'cliente',
        layout: LinkPageLayout.LAYOUT_1,
      }),
    ).rejects.toMatchObject({
      errorCode: ERROR_CODES.LINK_PAGE_PLAN_LIMIT_REACHED,
    });

    expect(linkPageRepository.save).not.toHaveBeenCalled();
  });

  it('rejects forms beyond the entitled quota', async () => {
    const { companyRepository, linkPageRepository, service } = createService();
    companyRepository.findOne.mockResolvedValue({
      id: auth.companyId,
      plan: { maxForms: 1 },
    });
    linkPageRepository.count.mockResolvedValue(1);

    await expect(
      service.createForm(auth, 'bio-id', { name: 'Orçamento', slug: 'orcamento' }),
    ).rejects.toMatchObject({
      errorCode: ERROR_CODES.LINK_PAGE_FORM_LIMIT_REACHED,
    });

    expect(linkPageRepository.save).not.toHaveBeenCalled();
  });

  it('does not allow deleting the agency page through the regular CRUD', async () => {
    const { linkPageRepository, service } = createService();
    linkPageRepository.findOne.mockResolvedValue({
      id: 'agency-page-id',
      companyId: auth.companyId,
      type: LinkPageType.AGENCY,
    });

    await expect(service.delete(auth, 'agency-page-id')).rejects.toMatchObject({
      errorCode: ERROR_CODES.LINK_PAGE_AGENCY_PROTECTED,
    });
    expect(linkPageRepository.softDelete).not.toHaveBeenCalled();
  });

  it('requires white-label feature to hide the footer', async () => {
    const { companyRepository, linkPageRepository, service } = createService();
    companyRepository.findOne.mockResolvedValue({
      id: auth.companyId,
      plan: {
        whiteLabel: false,
      },
    });
    linkPageRepository.findOne.mockResolvedValue({
      id: 'page-id',
      companyId: auth.companyId,
      footerMode: LinkPageFooterMode.LINKBUDS,
    });

    await expect(
      service.updateFooter(auth, 'page-id', {
        footerMode: LinkPageFooterMode.HIDDEN,
        footerText: null,
        footerUrl: null,
        footerLogoUrl: null,
        ...defaultFooterStyle,
      }),
    ).rejects.toMatchObject({
      errorCode: ERROR_CODES.LINK_PAGE_FEATURE_FORBIDDEN,
    });
    expect(linkPageRepository.save).not.toHaveBeenCalled();
  });

  it('copies the company default footer into new pages', async () => {
    const { companyRepository, linkPageRepository, service } = createService();
    companyRepository.findOne.mockResolvedValue({
      id: auth.companyId,
      plan: { maxClientPages: 2, whiteLabel: true },
      footerMode: LinkPageFooterMode.CUSTOM,
      footerText: 'Agência X',
      footerUrl: 'https://agencia.x',
      footerLogoUrl: null,
    });
    linkPageRepository.count.mockResolvedValue(0);

    await service.create(auth, {
      name: 'Cliente',
      slug: 'cliente',
      layout: LinkPageLayout.LAYOUT_1,
    });

    expect(linkPageRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        footerMode: LinkPageFooterMode.CUSTOM,
        footerText: 'Agência X',
      }),
    );
  });

  it('ignores the default footer once white-label is lost', async () => {
    const { companyRepository, linkPageRepository, service } = createService();
    companyRepository.findOne.mockResolvedValue({
      id: auth.companyId,
      plan: { maxClientPages: 2, whiteLabel: false },
      footerMode: LinkPageFooterMode.HIDDEN,
    });
    linkPageRepository.count.mockResolvedValue(0);

    await service.create(auth, {
      name: 'Cliente',
      slug: 'cliente',
      layout: LinkPageLayout.LAYOUT_1,
    });

    expect(linkPageRepository.save).toHaveBeenCalledWith(
      expect.not.objectContaining({ footerMode: LinkPageFooterMode.HIDDEN }),
    );
  });

  it('applies the default footer to existing pages on request', async () => {
    const { companyRepository, linkPageRepository, publicCache, service } =
      createService();
    companyRepository.findOne.mockResolvedValue({
      id: auth.companyId,
      plan: { whiteLabel: true },
    });
    linkPageRepository.find.mockResolvedValue([
      { slug: 'bio', parentPageId: null },
    ]);
    const footer = {
      footerMode: LinkPageFooterMode.HIDDEN,
      footerText: null,
      footerUrl: null,
      footerLogoUrl: null,
      footerStyle: LinkPageFooterStyle.PILL,
      footerBackgroundColor: '#000000',
      footerBorderColor: null,
      footerColor: '#111111',
      footerBold: true,
      footerFontSize: LinkPageFooterSize.LARGE,
      footerLogoSize: LinkPageFooterSize.MEDIUM,
    };

    await service.updateFooterDefault(auth, {
      ...footer,
      applyToExisting: true,
    });

    expect(companyRepository.update).toHaveBeenCalledWith(
      auth.companyId,
      footer,
    );
    expect(linkPageRepository.update).toHaveBeenCalledWith(
      { companyId: auth.companyId },
      footer,
    );
    expect(publicCache.invalidateSlug).toHaveBeenCalledWith('bio');
    expect(publicCache.invalidatePrefix).toHaveBeenCalledWith('bio/');
  });

  it('requires white-label for a non-LinkBuds default footer', async () => {
    const { companyRepository, service } = createService();
    companyRepository.findOne.mockResolvedValue({
      id: auth.companyId,
      plan: { whiteLabel: false },
    });

    await expect(
      service.updateFooterDefault(auth, {
        footerMode: LinkPageFooterMode.HIDDEN,
        footerText: null,
        footerUrl: null,
        footerLogoUrl: null,
        ...defaultFooterStyle,
        applyToExisting: false,
      }),
    ).rejects.toMatchObject({
      errorCode: ERROR_CODES.LINK_PAGE_FEATURE_FORBIDDEN,
    });
    expect(companyRepository.update).not.toHaveBeenCalled();
  });

  it('records the visitor IP on public analytics events', async () => {
    const analyticsRepository = createRepositoryMock();
    const linkPageRepository = createRepositoryMock();
    linkPageRepository.findOne.mockResolvedValue({
      id: 'page-id',
      status: LinkPageStatus.ACTIVE,
    });
    const service = new LinkPageService(
      {} as never,
      createRepositoryMock() as never,
      createRepositoryMock() as never,
      linkPageRepository as never,
      createRepositoryMock() as never,
      createRepositoryMock() as never,
      createRepositoryMock() as never,
      createRepositoryMock() as never,
      analyticsRepository as never,
      createRepositoryMock() as never,
    );

    await service.recordPublicEvent(
      'page-id',
      {
        eventId: null,
        eventType: AnalyticsEventType.PAGE_VIEW,
        targetType: null,
        targetId: null,
        visitorId: 'visitor-id',
        sessionId: 'session-id',
        referrer: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        utmContent: null,
        utmTerm: null,
        countryCode: null,
        deviceType: null,
        browser: null,
        operatingSystem: null,
        durationMs: null,
        metadata: null,
      },
      {
        headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' },
        ip: '::ffff:10.0.0.1',
      },
    );

    expect(analyticsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ ipAddress: '203.0.113.7' }),
    );
    expect(analyticsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        linkPageId: 'page-id',
        visitorId: 'visitor-id',
      }),
    );
  });

  it('resolves the client IP from proxy headers, then the socket', () => {
    expect(
      resolveClientIp({ headers: { 'cf-connecting-ip': '198.51.100.1' } }),
    ).toBe('198.51.100.1');
    expect(
      resolveClientIp({
        headers: { 'x-forwarded-for': 'junk' },
        ip: '::ffff:192.0.2.5',
      }),
    ).toBe('192.0.2.5');
    expect(resolveClientIp({ ip: '2001:db8::1' })).toBe('2001:db8::1');
    expect(resolveClientIp({})).toBeNull();
  });

  it('returns basic insights for free plans with a fixed 7-day window', async () => {
    const { companyRepository, linkPageRepository, service } = createService();
    companyRepository.findOne.mockResolvedValue({
      id: auth.companyId,
      plan: {
        analyticsTier: 'BASIC',
      },
    });
    linkPageRepository.findOne.mockResolvedValue({
      id: 'page-id',
      companyId: auth.companyId,
    });
    jest.spyOn(service as never, 'getAnalyticsSummaryData').mockResolvedValue({
      onlineNow: 1,
      pageViews: 10,
      uniqueVisitors: 8,
      totalClicks: 4,
      clickThroughRate: 0.4,
      averageDurationMs: 1000,
    } as never);
    jest.spyOn(service as never, 'createAnalyticsBaseQuery').mockReturnValue(
      createQueryBuilderMock([
        {
          ip: '203.0.113.7',
          count: '3',
          lastSeenAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ]) as never,
    );
    const topTargets = jest
      .spyOn(service as never, 'getTopTargets')
      .mockResolvedValue([
        { targetId: 'link-id', targetType: 'VERTICAL_LINK', clicks: '4' },
      ] as never);

    const result = await service.analyticsInsights(
      auth,
      'page-id',
      '2020-01-01T00:00:00.000Z',
      '2020-01-31T00:00:00.000Z',
    );

    expect(result.tier).toBe('BASIC');
    expect(result.limits).toEqual({
      maxRangeDays: 7,
      advancedDimensionsEnabled: false,
    });
    expect(result.timeseries).toEqual([]);
    expect(result.sources).toEqual([]);
    expect(topTargets).toHaveBeenCalledWith('page-id', expect.any(Object), 5);
    expect(result.visitorIps).toEqual([
      { ip: '203.0.113.7', count: 3, lastSeenAt: '2026-01-01T00:00:00.000Z' },
    ]);
  });

  it('returns full insights for plans with the FULL analytics tier', async () => {
    const { companyRepository, linkPageRepository, service } = createService();
    companyRepository.findOne.mockResolvedValue({
      id: auth.companyId,
      plan: {
        analyticsTier: 'FULL',
      },
    });
    linkPageRepository.findOne.mockResolvedValue({
      id: 'page-id',
      companyId: auth.companyId,
    });
    jest.spyOn(service as never, 'getAnalyticsSummaryData').mockResolvedValue({
      onlineNow: 2,
      pageViews: 20,
      uniqueVisitors: 12,
      totalClicks: 10,
      clickThroughRate: 0.5,
      averageDurationMs: 3000,
    } as never);
    jest
      .spyOn(service as never, 'getTopTargets')
      .mockResolvedValue([] as never);
    jest
      .spyOn(service as never, 'getAnalyticsTimeseriesData')
      .mockResolvedValue([
        { date: '2026-01-01T00:00:00.000Z', count: '20' },
      ] as never);
    jest
      .spyOn(service as never, 'getAnalyticsGroupData')
      .mockResolvedValue([{ label: 'mobile', count: '10' }] as never);

    jest
      .spyOn(service as never, 'getVisitorIps')
      .mockResolvedValue([] as never);

    const result = await service.analyticsInsights(
      auth,
      'page-id',
      '2026-01-01T00:00:00.000Z',
      '2026-01-31T23:59:59.999Z',
    );

    expect(result.tier).toBe('FULL');
    expect(result.limits).toEqual({
      maxRangeDays: null,
      advancedDimensionsEnabled: true,
    });
    expect(result.timeseries).toHaveLength(1);
    expect(result.sources).toHaveLength(1);
    expect(result.devices).toHaveLength(1);
    expect(result.countries).toHaveLength(1);
  });

  it('blocks the globe on the free analytics tier', async () => {
    const { companyRepository, linkPageRepository, service } = createService();
    companyRepository.findOne.mockResolvedValue({
      id: auth.companyId,
      plan: { analyticsTier: 'BASIC' },
    });
    linkPageRepository.findOne.mockResolvedValue({
      id: 'page-id',
      companyId: auth.companyId,
    });

    await expect(service.analyticsGeo(auth, 'page-id')).rejects.toMatchObject({
      errorCode: ERROR_CODES.LINK_PAGE_FEATURE_FORBIDDEN,
    });
  });

  it('groups realtime globe visits by country, one per online session', async () => {
    const analyticsRepository = createRepositoryMock();
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          sessionId: 's1',
          countryCode: 'BR',
          ipAddress: '198.51.100.1',
          createdAt: new Date('2026-01-01T10:02:00Z'),
        },
        {
          sessionId: 's1',
          countryCode: 'BR',
          ipAddress: '198.51.100.1',
          createdAt: new Date('2026-01-01T10:01:00Z'),
        },
        {
          sessionId: 's2',
          countryCode: null,
          ipAddress: null,
          createdAt: new Date('2026-01-01T10:00:00Z'),
        },
      ]),
    };
    Object.assign(analyticsRepository, {
      createQueryBuilder: jest.fn(() => qb),
    });
    const { companyRepository, linkPageRepository, service } = createService({
      analyticsRepository,
      presenceService: {
        onlineSessions: jest.fn().mockResolvedValue(['s1', 's2']),
      },
    });
    companyRepository.findOne.mockResolvedValue({
      id: auth.companyId,
      plan: { analyticsTier: 'FULL' },
    });
    linkPageRepository.findOne.mockResolvedValue({
      id: 'page-id',
      companyId: auth.companyId,
    });

    const result = await service.analyticsGeo(auth, 'page-id', {
      realtime: true,
    });

    expect(qb.andWhere).toHaveBeenCalledWith(
      'event.sessionId IN (:...sessions)',
      { sessions: ['s1', 's2'] },
    );
    expect(result.total).toBe(2);
    expect(result.locations).toEqual([
      expect.objectContaining({ countryCode: 'BR', count: 1 }),
      expect.objectContaining({ countryCode: 'unknown', count: 1 }),
    ]);
  });

  it('deduplicates repeated public events by eventId', async () => {
    const analyticsRepository = createRepositoryMock();
    const linkPageRepository = createRepositoryMock();
    linkPageRepository.findOne.mockResolvedValue({
      id: 'page-id',
      status: LinkPageStatus.ACTIVE,
    });
    analyticsRepository.save.mockRejectedValueOnce({ code: '23505' });
    analyticsRepository.findOne.mockResolvedValue({ id: 'existing-event-id' });
    const service = new LinkPageService(
      {} as never,
      createRepositoryMock() as never,
      createRepositoryMock() as never,
      linkPageRepository as never,
      createRepositoryMock() as never,
      createRepositoryMock() as never,
      createRepositoryMock() as never,
      createRepositoryMock() as never,
      analyticsRepository as never,
      createRepositoryMock() as never,
    );

    await expect(
      service.recordPublicEvent('page-id', {
        eventId: 'event-id',
        eventType: AnalyticsEventType.PAGE_VIEW,
        targetType: null,
        targetId: null,
        visitorId: 'visitor-id',
        sessionId: 'session-id',
        referrer: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        utmContent: null,
        utmTerm: null,
        countryCode: null,
        deviceType: null,
        browser: null,
        operatingSystem: null,
        durationMs: null,
        metadata: null,
      }),
    ).resolves.toEqual({
      id: 'existing-event-id',
      ignored: false,
    });
    expect(analyticsRepository.findOne).toHaveBeenCalledWith({
      where: { eventId: 'event-id' },
    });
  });

  it('ignores public analytics events from bots', async () => {
    const analyticsRepository = createRepositoryMock();
    const linkPageRepository = createRepositoryMock();
    linkPageRepository.findOne.mockResolvedValue({
      id: 'page-id',
      status: LinkPageStatus.ACTIVE,
    });
    const service = new LinkPageService(
      {} as never,
      createRepositoryMock() as never,
      createRepositoryMock() as never,
      linkPageRepository as never,
      createRepositoryMock() as never,
      createRepositoryMock() as never,
      createRepositoryMock() as never,
      createRepositoryMock() as never,
      analyticsRepository as never,
      createRepositoryMock() as never,
    );

    await expect(
      service.recordPublicEvent(
        'page-id',
        {
          eventId: 'event-id',
          eventType: AnalyticsEventType.PAGE_VIEW,
          targetType: null,
          targetId: null,
          visitorId: 'visitor-id',
          sessionId: 'session-id',
          referrer: null,
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null,
          countryCode: null,
          deviceType: null,
          browser: null,
          operatingSystem: null,
          durationMs: null,
          metadata: null,
        },
        { headers: { 'user-agent': 'Googlebot/2.1' } },
      ),
    ).resolves.toEqual({
      id: null,
      ignored: true,
    });
    expect(analyticsRepository.save).not.toHaveBeenCalled();
  });

  it('records public presence through the presence service', async () => {
    const presenceService = {
      heartbeat: jest.fn().mockResolvedValue(3),
    };
    const { linkPageRepository, service } = createService({ presenceService });
    linkPageRepository.findOne.mockResolvedValue({
      id: 'page-id',
      status: LinkPageStatus.ACTIVE,
    });

    await expect(
      service.recordPresence('page-id', 'session-id'),
    ).resolves.toEqual({
      onlineNow: 3,
    });
    expect(presenceService.heartbeat).toHaveBeenCalledWith(
      'page-id',
      'session-id',
    );
  });

  it('returns lifetime click counts grouped by editable link id', async () => {
    const analyticsRepository = createRepositoryMock();
    const queryBuilder = createQueryBuilderMock([
      { linkId: 'link-a', clicks: '7' },
      { linkId: 'link-b', clicks: '2' },
    ]);
    const analyticsRepositoryWithQueryBuilder =
      analyticsRepository as typeof analyticsRepository & {
        createQueryBuilder: jest.Mock;
      };
    analyticsRepositoryWithQueryBuilder.createQueryBuilder = jest.fn(
      () => queryBuilder,
    );
    const { companyRepository, linkPageRepository, service } = createService({
      analyticsRepository,
    });
    companyRepository.findOne.mockResolvedValue({
      id: auth.companyId,
      plan: {
        analyticsTier: 'BASIC',
      },
    });
    linkPageRepository.findOne.mockResolvedValue({
      id: 'page-id',
      companyId: auth.companyId,
    });

    await expect(service.analyticsLinkClicks(auth, 'page-id')).resolves.toEqual(
      {
        items: [
          { linkId: 'link-a', clicks: 7 },
          { linkId: 'link-b', clicks: 2 },
        ],
      },
    );
    expect(
      analyticsRepositoryWithQueryBuilder.createQueryBuilder,
    ).toHaveBeenCalledWith('event');
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'event.eventType = :eventType',
      { eventType: AnalyticsEventType.LINK_CLICK },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'event.targetType IN (:...targetTypes)',
      {
        targetTypes: [
          AnalyticsTargetType.HORIZONTAL_LINK,
          AnalyticsTargetType.VERTICAL_LINK,
        ],
      },
    );
  });

  it('returns cached public LinkPages without querying the database', async () => {
    const cached = {
      id: 'page-id',
      name: 'Cliente Roma',
      slug: 'cliente-roma',
      status: LinkPageStatus.ACTIVE,
      layout: LinkPageLayout.LAYOUT_1,
      backgroundType: 'SOLID',
      backgroundColor: '#FFFFFF',
      backgroundImageUrl: null,
      avatarUrl: null,
      title: 'Cliente Roma',
      subtitle: null,
      footerMode: LinkPageFooterMode.LINKBUDS,
      footerText: null,
      footerUrl: null,
      footerLogoUrl: null,
      links: [],
      socialLinks: [],
      images: [],
    };
    const { domainRepository, linkPageRepository, publicCache, service } =
      createService({
        publicCache: {
          get: jest.fn().mockResolvedValue(cached),
        },
      });

    await expect(
      service.resolvePublic('example.com', 'cliente-roma'),
    ).resolves.toEqual(cached);
    expect(publicCache.get).toHaveBeenCalledWith('example.com', 'cliente-roma');
    expect(domainRepository.findOne).not.toHaveBeenCalled();
    expect(linkPageRepository.findOne).not.toHaveBeenCalled();
  });

  it('caches public LinkPages after a miss and loads children in parallel', async () => {
    const {
      domainRepository,
      imageRepository,
      linkPageRepository,
      linkRepository,
      publicCache,
      service,
      socialLinkRepository,
    } = createService();
    domainRepository.findOne.mockResolvedValue(null);
    linkPageRepository.findOne.mockResolvedValue({
      id: 'page-id',
      name: 'Cliente Roma',
      slug: 'cliente-roma',
      status: LinkPageStatus.ACTIVE,
      layout: LinkPageLayout.LAYOUT_1,
      backgroundType: 'SOLID',
      backgroundColor: '#FFFFFF',
      backgroundImageUrl: null,
      avatarUrl: null,
      title: 'Cliente Roma',
      subtitle: null,
      footerMode: LinkPageFooterMode.LINKBUDS,
      footerText: null,
      footerUrl: null,
      footerLogoUrl: null,
    });
    linkRepository.find.mockResolvedValue([
      {
        id: 'link-id',
        placement: 'VERTICAL',
        kind: 'LINK',
        label: 'Reservar',
        url: 'https://example.com',
        contactType: null,
        contactValue: null,
        textColor: '#111827',
        backgroundColor: '#FFFFFF',
        borderColor: '#E5E7EB',
        borderEnabled: true,
        sortOrder: 0,
        active: true,
      },
    ]);
    socialLinkRepository.find.mockResolvedValue([]);
    imageRepository.find.mockResolvedValue([]);

    const result = await service.resolvePublic('example.com', 'cliente-roma');

    expect(result.links).toHaveLength(1);
    expect(linkRepository.find).toHaveBeenCalledWith({
      where: {
        active: true,
        deletedAt: expect.any(Object),
        linkPageId: 'page-id',
      },
      order: { placement: 'ASC', sortOrder: 'ASC', createdAt: 'ASC' },
    });
    expect(publicCache.set).toHaveBeenCalledWith(
      'example.com',
      'cliente-roma',
      expect.objectContaining({
        id: 'page-id',
        slug: 'cliente-roma',
      }),
    );
  });

  it('invalidates public cache after footer and link mutations', async () => {
    const { companyRepository, linkPageRepository, publicCache, service } =
      createService();
    companyRepository.findOne.mockResolvedValue({
      id: auth.companyId,
      plan: {
        whiteLabel: true,
      },
    });
    linkPageRepository.findOne.mockResolvedValue({
      id: 'page-id',
      companyId: auth.companyId,
      slug: 'cliente-roma',
      footerMode: LinkPageFooterMode.LINKBUDS,
    });
    linkPageRepository.save.mockImplementation((value) =>
      Promise.resolve({
        ...value,
        links: [],
        socialLinks: [],
        images: [],
      }),
    );

    await service.updateFooter(auth, 'page-id', {
      footerMode: LinkPageFooterMode.LINKBUDS,
      footerText: null,
      footerUrl: null,
      footerLogoUrl: null,
      ...defaultFooterStyle,
    });
    await service.createLink(auth, 'page-id', {
      placement: LinkPageLinkPlacement.VERTICAL,
      kind: LinkPageLinkKind.LINK,
      label: 'Reservar',
      url: 'https://example.com',
      contactType: null,
      contactValue: null,
      previewDescription: null,
      displaySize: LinkPageMediaSize.MEDIUM,
      textColor: '#111827',
      backgroundColor: '#FFFFFF',
      borderColor: '#E5E7EB',
      borderEnabled: true,
      sortOrder: 0,
      active: true,
    });

    expect(publicCache.invalidateSlug).toHaveBeenCalledWith('cliente-roma');
    expect(publicCache.invalidateSlug).toHaveBeenCalledTimes(2);
    // Post paths under the bio go too.
    expect(publicCache.invalidatePrefix).toHaveBeenCalledWith('cliente-roma/');
  });

  it('generates a public sitemap with active non-deleted LinkPages', async () => {
    const { linkPageRepository, service } = createService();
    linkPageRepository.find.mockResolvedValue([
      {
        slug: 'cliente-roma',
        updatedAt: new Date('2026-01-02T03:04:05.000Z'),
      },
      {
        slug: 'clinica-x',
        updatedAt: new Date('2026-01-03T03:04:05.000Z'),
      },
      {
        slug: 'promo-1234',
        parentPageId: 'roma-id',
        parentPage: { slug: 'cliente-roma', status: LinkPageStatus.ACTIVE },
        updatedAt: new Date('2026-01-04T03:04:05.000Z'),
      },
      {
        slug: 'orfao',
        parentPageId: 'x-id',
        parentPage: { slug: 'inativa', status: LinkPageStatus.INACTIVE },
        updatedAt: new Date('2026-01-04T03:04:05.000Z'),
      },
    ]);

    const sitemap = await service.getPublicSitemap('https://linkbuds.com/');

    expect(linkPageRepository.find).toHaveBeenCalledWith({
      relations: { parentPage: true },
      where: {
        deletedAt: expect.any(Object),
        status: LinkPageStatus.ACTIVE,
      },
      order: { updatedAt: 'DESC' },
    });
    expect(sitemap).toContain('<loc>https://linkbuds.com/p/cliente-roma</loc>');
    expect(sitemap).toContain('<lastmod>2026-01-02T03:04:05.000Z</lastmod>');
    expect(sitemap).toContain('<loc>https://linkbuds.com/p/clinica-x</loc>');
    expect(sitemap).toContain(
      '<loc>https://linkbuds.com/p/cliente-roma/promo-1234</loc>',
    );
    expect(sitemap).not.toContain('orfao');
  });

  it('requires a height for CUSTOM video size and drops it otherwise', async () => {
    const { linkPageRepository, service, videoRepository } = createService();
    linkPageRepository.findOne.mockResolvedValue({
      id: 'page-id',
      slug: 'bio',
    });

    await expect(
      service.createVideo(auth, 'page-id', {
        url: 'https://youtu.be/dQw4w9WgXcQ',
        title: null,
        autoplay: true,
        controls: true,
        size: LinkPageMediaSize.CUSTOM,
        sortOrder: 0,
        active: true,
      }),
    ).rejects.toMatchObject({
      errorCode: ERROR_CODES.LINK_PAGE_INVALID_LINK_CONFIGURATION,
    });

    const video = await service.createVideo(auth, 'page-id', {
      url: 'https://youtu.be/dQw4w9WgXcQ',
      title: null,
      autoplay: false,
      controls: true,
      size: LinkPageMediaSize.LARGE,
      customHeight: 500,
      sortOrder: 0,
      active: true,
    });

    expect(video.customHeight).toBeNull();
    expect(videoRepository.save).toHaveBeenCalledTimes(1);
  });

  it('reorders links, images and videos in one shared order', async () => {
    const {
      imageRepository,
      linkPageRepository,
      linkRepository,
      service,
      videoRepository,
    } = createService();
    linkPageRepository.findOne.mockResolvedValue({
      id: 'page-id',
      slug: 'bio',
    });
    linkRepository.find.mockResolvedValue([{ id: 'link-a', sortOrder: 0 }]);
    imageRepository.find.mockResolvedValue([{ id: 'image-a', sortOrder: 1 }]);
    videoRepository.find.mockResolvedValue([{ id: 'video-a', sortOrder: 2 }]);

    await service.reorderContent(auth, 'page-id', [
      { type: 'VIDEO', id: 'video-a', sortOrder: 0 },
      { type: 'LINK', id: 'link-a', sortOrder: 1 },
      { type: 'IMAGE', id: 'image-a', sortOrder: 2 },
    ]);

    expect(videoRepository.save).toHaveBeenCalledWith([
      { id: 'video-a', sortOrder: 0 },
    ]);
    expect(linkRepository.save).toHaveBeenCalledWith([
      { id: 'link-a', sortOrder: 1 },
    ]);
    expect(imageRepository.save).toHaveBeenCalledWith([
      { id: 'image-a', sortOrder: 2 },
    ]);

    videoRepository.find.mockResolvedValue([]);
    await expect(
      service.reorderContent(auth, 'page-id', [
        { type: 'VIDEO', id: 'video-of-other-page', sortOrder: 0 },
      ]),
    ).rejects.toMatchObject({
      errorCode: ERROR_CODES.LINK_PAGE_CHILD_NOT_FOUND,
    });
  });
});
