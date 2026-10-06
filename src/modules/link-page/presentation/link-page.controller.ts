import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { GetAuth } from 'src/shared/decorators/get-auth.decorator';
import { AuthGuard } from 'src/shared/guards/auth.guard';
import { TransformResponseInterceptor } from 'src/shared/interceptors';
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe';
import type { AuthPayload } from 'src/shared/types/auth-payload.types';
import {
  createLinkPageDto,
  createPostPageDto,
  linkPageImageDto,
  linkPageLinkDto,
  linkPageSocialLinkDto,
  linkPreviewQueryDto,
  reorderItemsDto,
  updateFooterDefaultDto,
  updateFooterDto,
  updateLinkPageDto,
  updateLinkPageImageDto,
  updateLinkPageLinkDto,
  updateLinkPageSocialLinkDto,
  type CreateLinkPageDto,
  type CreatePostPageDto,
  type LinkPageImageDto,
  type LinkPageLinkDto,
  type LinkPageSocialLinkDto,
  type LinkPreviewQueryDto,
  type ReorderItemsDto,
  type UpdateFooterDefaultDto,
  type UpdateFooterDto,
  type UpdateLinkPageDto,
  type UpdateLinkPageImageDto,
  type UpdateLinkPageLinkDto,
  type UpdateLinkPageSocialLinkDto,
} from '../application/dto/link-page.dto';
import { LinkPageService } from '../application/link-page.service';
import { LinkPreviewService } from '../application/link-preview.service';

@Controller('link-pages')
@UseInterceptors(TransformResponseInterceptor)
@UseGuards(AuthGuard)
export class LinkPageController {
  constructor(
    private readonly linkPageService: LinkPageService,
    private readonly linkPreviewService: LinkPreviewService,
  ) {}

  @Get()
  list(@GetAuth() auth: AuthPayload) {
    return this.linkPageService.list(auth);
  }

  /** Agency dashboard: traffic per page in the plan's analytics window. */
  @Get('overview')
  overview(
    @GetAuth() auth: AuthPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.linkPageService.overview(auth, from, to);
  }

  /** Company default footer (Configurações). Declared before `:id`. */
  @Get('footer-default')
  getFooterDefault(@GetAuth() auth: AuthPayload) {
    return this.linkPageService.getFooterDefault(auth);
  }

  @Put('footer-default')
  updateFooterDefault(
    @GetAuth() auth: AuthPayload,
    @Body(new ZodValidationPipe(updateFooterDefaultDto))
    dto: UpdateFooterDefaultDto,
  ) {
    return this.linkPageService.updateFooterDefault(auth, dto);
  }

  /** OG data for a "Link com prévia" card. Declared before `:id`. */
  @Get('link-preview')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  linkPreview(
    @Query(new ZodValidationPipe(linkPreviewQueryDto))
    query: LinkPreviewQueryDto,
  ) {
    return this.linkPreviewService.fetch(query.url);
  }

  @Get(':id')
  get(
    @GetAuth() auth: AuthPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.linkPageService.get(auth, id);
  }

  @Post()
  create(
    @GetAuth() auth: AuthPayload,
    @Body(new ZodValidationPipe(createLinkPageDto)) dto: CreateLinkPageDto,
  ) {
    return this.linkPageService.create(auth, dto);
  }

  @Patch(':id')
  update(
    @GetAuth() auth: AuthPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateLinkPageDto)) dto: UpdateLinkPageDto,
  ) {
    return this.linkPageService.update(auth, id, dto);
  }

  @Post(':id/posts')
  createPost(
    @GetAuth() auth: AuthPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(createPostPageDto)) dto: CreatePostPageDto,
  ) {
    return this.linkPageService.createPost(auth, id, dto);
  }

  @Delete(':id')
  delete(
    @GetAuth() auth: AuthPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.linkPageService.delete(auth, id);
  }

  @Patch(':id/footer')
  updateFooter(
    @GetAuth() auth: AuthPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateFooterDto)) dto: UpdateFooterDto,
  ) {
    return this.linkPageService.updateFooter(auth, id, dto);
  }

  @Post(':id/links')
  createLink(
    @GetAuth() auth: AuthPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(linkPageLinkDto)) dto: LinkPageLinkDto,
  ) {
    return this.linkPageService.createLink(auth, id, dto);
  }

  @Patch(':id/links/reorder')
  reorderLinks(
    @GetAuth() auth: AuthPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(reorderItemsDto)) dto: ReorderItemsDto,
  ) {
    return this.linkPageService.reorderLinks(auth, id, dto);
  }

  @Patch(':id/links/:linkId')
  updateLink(
    @GetAuth() auth: AuthPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('linkId', new ParseUUIDPipe()) linkId: string,
    @Body(new ZodValidationPipe(updateLinkPageLinkDto))
    dto: UpdateLinkPageLinkDto,
  ) {
    return this.linkPageService.updateLink(auth, id, linkId, dto);
  }

  @Delete(':id/links/:linkId')
  deleteLink(
    @GetAuth() auth: AuthPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('linkId', new ParseUUIDPipe()) linkId: string,
  ) {
    return this.linkPageService.deleteLink(auth, id, linkId);
  }

  @Post(':id/social-links')
  createSocialLink(
    @GetAuth() auth: AuthPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(linkPageSocialLinkDto))
    dto: LinkPageSocialLinkDto,
  ) {
    return this.linkPageService.createSocialLink(auth, id, dto);
  }

  @Patch(':id/social-links/reorder')
  reorderSocialLinks(
    @GetAuth() auth: AuthPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(reorderItemsDto)) dto: ReorderItemsDto,
  ) {
    return this.linkPageService.reorderSocialLinks(auth, id, dto);
  }

  @Patch(':id/social-links/:socialLinkId')
  updateSocialLink(
    @GetAuth() auth: AuthPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('socialLinkId', new ParseUUIDPipe()) socialLinkId: string,
    @Body(new ZodValidationPipe(updateLinkPageSocialLinkDto))
    dto: UpdateLinkPageSocialLinkDto,
  ) {
    return this.linkPageService.updateSocialLink(auth, id, socialLinkId, dto);
  }

  @Delete(':id/social-links/:socialLinkId')
  deleteSocialLink(
    @GetAuth() auth: AuthPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('socialLinkId', new ParseUUIDPipe()) socialLinkId: string,
  ) {
    return this.linkPageService.deleteSocialLink(auth, id, socialLinkId);
  }

  @Post(':id/images')
  createImage(
    @GetAuth() auth: AuthPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(linkPageImageDto)) dto: LinkPageImageDto,
  ) {
    return this.linkPageService.createImage(auth, id, dto);
  }

  @Patch(':id/images/reorder')
  reorderImages(
    @GetAuth() auth: AuthPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(reorderItemsDto)) dto: ReorderItemsDto,
  ) {
    return this.linkPageService.reorderImages(auth, id, dto);
  }

  @Patch(':id/images/:imageId')
  updateImage(
    @GetAuth() auth: AuthPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('imageId', new ParseUUIDPipe()) imageId: string,
    @Body(new ZodValidationPipe(updateLinkPageImageDto))
    dto: UpdateLinkPageImageDto,
  ) {
    return this.linkPageService.updateImage(auth, id, imageId, dto);
  }

  @Delete(':id/images/:imageId')
  deleteImage(
    @GetAuth() auth: AuthPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('imageId', new ParseUUIDPipe()) imageId: string,
  ) {
    return this.linkPageService.deleteImage(auth, id, imageId);
  }

  @Get(':id/analytics/insights')
  analyticsInsights(
    @GetAuth() auth: AuthPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.linkPageService.analyticsInsights(auth, id, from, to);
  }

  @Get(':id/analytics/geo')
  analyticsGeo(
    @GetAuth() auth: AuthPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('realtime') realtime?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.linkPageService.analyticsGeo(auth, id, {
      realtime: realtime === 'true',
      from,
      to,
    });
  }

  @Get(':id/analytics/link-clicks')
  analyticsLinkClicks(
    @GetAuth() auth: AuthPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.linkPageService.analyticsLinkClicks(auth, id, from, to);
  }
}
