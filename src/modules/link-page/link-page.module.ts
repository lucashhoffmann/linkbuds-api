import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthorizationModule } from '../authorization/authorization.module';
import { CompanyDomainEntity } from '../company/domain/entities/company-domain.entity';
import { CompanyEntity } from '../company/domain/entities/company.entity';
import { LinkPageService } from './application/link-page.service';
import { LinkPagePresenceService } from './application/link-page-presence.service';
import { PublicLinkPageCacheService } from './application/public-link-page-cache.service';
import { LinkPageAnalyticsEventEntity } from './domain/entities/link-page-analytics-event.entity';
import { LinkPageImageEntity } from './domain/entities/link-page-image.entity';
import { LinkPageEntity } from './domain/entities/link-page.entity';
import { LinkPageLinkEntity } from './domain/entities/link-page-link.entity';
import { LinkPageSocialLinkEntity } from './domain/entities/link-page-social-link.entity';
import { LinkPageController } from './presentation/link-page.controller';
import { PublicLinkPageController } from './presentation/public-link-page.controller';

@Module({
  imports: [
    AuthorizationModule,
    TypeOrmModule.forFeature([
      CompanyEntity,
      CompanyDomainEntity,
      LinkPageEntity,
      LinkPageLinkEntity,
      LinkPageSocialLinkEntity,
      LinkPageImageEntity,
      LinkPageAnalyticsEventEntity,
    ]),
  ],
  controllers: [LinkPageController, PublicLinkPageController],
  providers: [
    LinkPageService,
    LinkPagePresenceService,
    PublicLinkPageCacheService,
  ],
  exports: [
    LinkPageService,
    LinkPagePresenceService,
    PublicLinkPageCacheService,
  ],
})
export class LinkPageModule {}
