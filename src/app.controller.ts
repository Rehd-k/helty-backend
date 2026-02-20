import { Body, Controller, Get, Post } from '@nestjs/common';
import { Public } from './common/decorators';
import { AppService } from './app.service';

@Public()
@Controller('')
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }


  @Public()
  @Post()
  postHello(@Body() body: any): string {
    return this.appService.getHello();
  }
}
