import { Module } from '@nestjs/common';
import { AppAbilityFactory } from './application/app-ability.factory';

@Module({
  providers: [AppAbilityFactory],
  exports: [AppAbilityFactory],
})
export class AuthorizationModule {}
