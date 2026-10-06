import { Module } from '@nestjs/common';
import { RedisClient } from 'src/shared/redis/redis.client';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyDomainEntity } from '../company/domain/entities/company-domain.entity';
import { CompanyEntity } from '../company/domain/entities/company.entity';
import { LinkPageService } from './application/link-page.service';
import { LinkPreviewService } from './application/link-preview.service';
import { LinkPagePresenceService } from './application/link-page-presence.service';
import { PublicLinkPageCacheService } from './application/public-link-page-cache.service';
import { LinkPageAnalyticsEventEntity } from './domain/entities/link-page-analytics-event.entity';
import { LinkPageFormSubmissionEntity } from './domain/entities/link-page-form-submission.entity';
import { LinkPageImageEntity } from './domain/entities/link-page-image.entity';
import { LinkPageVideoEntity } from './domain/entities/link-page-video.entity';
import { LinkPageEntity } from './domain/entities/link-page.entity';
import { LinkPageLinkEntity } from './domain/entities/link-page-link.entity';
import { LinkPageSocialLinkEntity } from './domain/entities/link-page-social-link.entity';
import { LinkPageController } from './presentation/link-page.controller';
import { PublicLinkPageController } from './presentation/public-link-page.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CompanyEntity,
      CompanyDomainEntity,
      LinkPageEntity,
      LinkPageLinkEntity,
      LinkPageSocialLinkEntity,
      LinkPageImageEntity,
      LinkPageVideoEntity,
      LinkPageAnalyticsEventEntity,
      LinkPageFormSubmissionEntity,
    ]),
  ],
  controllers: [LinkPageController, PublicLinkPageController],
  providers: [
    RedisClient,
    LinkPageService,
    LinkPagePresenceService,
    LinkPreviewService,
    PublicLinkPageCacheService,
  ],
  exports: [
    LinkPageService,
    LinkPagePresenceService,
    PublicLinkPageCacheService,
  ],
})
export class LinkPageModule {}
