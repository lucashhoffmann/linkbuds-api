import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { GetAuth } from 'src/shared/decorators/get-auth.decorator';
import { AuthGuard } from 'src/shared/guards/auth.guard';
import { TransformResponseInterceptor } from 'src/shared/interceptors';
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe';
import type { AuthPayload } from 'src/shared/types/auth-payload.types';
import {
  createLinkPageDto,
  linkPageImageDto,
  linkPageLinkDto,
  linkPageSocialLinkDto,
  reorderItemsDto,
  updateFooterDto,
  updateLinkPageDto,
  updateLinkPageImageDto,
  updateLinkPageLinkDto,
  updateLinkPageSocialLinkDto,
  type CreateLinkPageDto,
  type LinkPageImageDto,
  type LinkPageLinkDto,
  type LinkPageSocialLinkDto,
  type ReorderItemsDto,
  type UpdateFooterDto,
  type UpdateLinkPageDto,
  type UpdateLinkPageImageDto,
  type UpdateLinkPageLinkDto,
  type UpdateLinkPageSocialLinkDto,
} from '../application/dto/link-page.dto';
import { LinkPageService } from '../application/link-page.service';

@Controller('link-pages')
@UseInterceptors(TransformResponseInterceptor)
@UseGuards(AuthGuard)
export class LinkPageController {
  constructor(private readonly linkPageService: LinkPageService) {}

  @Get()
  list(@GetAuth() auth: AuthPayload) {
    return this.linkPageService.list(auth);
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

  @Get(':id/analytics/summary')
  analyticsSummary(
    @GetAuth() auth: AuthPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.linkPageService.analyticsSummary(auth, id, from, to);
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

  @Get(':id/analytics/link-clicks')
  analyticsLinkClicks(
    @GetAuth() auth: AuthPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.linkPageService.analyticsLinkClicks(auth, id);
  }

  @Get(':id/analytics/timeseries')
  analyticsTimeseries(
    @GetAuth() auth: AuthPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.linkPageService.analyticsTimeseries(auth, id, from, to);
  }

  @Get(':id/analytics/links')
  analyticsLinks(
    @GetAuth() auth: AuthPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.linkPageService.analyticsGroup(auth, id, 'links', from, to);
  }

  @Get(':id/analytics/sources')
  analyticsSources(
    @GetAuth() auth: AuthPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.linkPageService.analyticsGroup(auth, id, 'sources', from, to);
  }

  @Get(':id/analytics/devices')
  analyticsDevices(
    @GetAuth() auth: AuthPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.linkPageService.analyticsGroup(auth, id, 'devices', from, to);
  }

  @Get(':id/analytics/countries')
  analyticsCountries(
    @GetAuth() auth: AuthPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.linkPageService.analyticsGroup(auth, id, 'countries', from, to);
  }
}
