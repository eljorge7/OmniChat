import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { GoogleService } from './google.service';
import type { Request, Response } from 'express';

@Controller('api/v1/google')
export class GoogleController {
  constructor(private readonly googleService: GoogleService) {}

  @Get('auth')
  async auth(@Query('userId') userId: string, @Res() res: Response) {
    if (!userId) {
      return res.status(400).send('Missing userId');
    }
    const url = this.googleService.generateAuthUrl(userId);
    return res.redirect(url);
  }

  @Get('callback')
  async callback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    if (!code || !state) {
      return res.status(400).send('Missing code or state');
    }
    
    // state contains the userId
    try {
      await this.googleService.handleCallback(code, state);
      // Redirect back to frontend settings page with success
      const frontendUrl = process.env.NODE_ENV === 'production' 
        ? 'https://omnichat.radiotecpro.com/settings?google=success'
        : 'http://localhost:3000/settings?google=success';
      
      return res.redirect(frontendUrl);
    } catch (e) {
      const frontendUrlError = process.env.NODE_ENV === 'production' 
        ? 'https://omnichat.radiotecpro.com/settings?google=error'
        : 'http://localhost:3000/settings?google=error';
      return res.redirect(frontendUrlError);
    }
  }
}
