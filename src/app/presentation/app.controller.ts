import { Body, Controller, Get, Post } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getHello(): string {
    return 'Hello World';
  }

  @Post('/message')
  postMessage(@Body('message') message: string) {
    return { message };
  }
}
