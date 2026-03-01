import { Body, Controller, Get, Logger, Post } from '@nestjs/common';
import { Public } from './common/decorators';
import { AppService } from './app.service';

@Public()
@Controller('')
export class AppController {
  private readonly log = new Logger(AppController.name);

  constructor(
    private readonly appService: AppService
  ) { }

  // @Public()
  // @Get()
  // getHello(): string {
  //   this.log.log('GET / called');
  //   return this.appService.getHello();
  // }

  @Public()
  @Post()
  postHello(@Body() body: any): string {
    this.log.log('POST / called');
    this.log.debug('Request body: ' + JSON.stringify(body));
    return this.appService.getHello();
  }
}
