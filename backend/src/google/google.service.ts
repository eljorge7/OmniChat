import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GoogleService {
  private readonly logger = new Logger(GoogleService.name);
  private oauth2Client;

  constructor(private prisma: PrismaService) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    // We will use the frontend URL for redirect because the user starts auth from the frontend
    // The frontend will receive the code and send it to our backend, or the backend will redirect back to frontend
    // Let's use the backend callback URI as configured in the console:
    const redirectUri = process.env.NODE_ENV === 'production' 
      ? 'https://omnichat.radiotecpro.com/api/v1/google/callback'
      : 'http://localhost:3000/api/v1/google/callback';

    this.oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );
  }

  generateAuthUrl(userId: string) {
    const scopes = [
      'https://www.googleapis.com/auth/contacts',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/userinfo.email'
    ];

    const redirectUri = process.env.NODE_ENV === 'production' 
      ? 'https://omnichat.radiotecpro.com/api/v1/google/callback'
      : 'http://localhost:3000/api/v1/google/callback';

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent select_account',
      scope: scopes,
      state: userId,
      redirect_uri: redirectUri
    });
  }

  async handleCallback(code: string, userId: string) {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      
      this.oauth2Client.setCredentials(tokens);
      
      // Obtener el correo electrónico asociado a la cuenta
      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
      const userInfo = await oauth2.userinfo.get();
      const email = userInfo.data.email;

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          googleAccessToken: tokens.access_token,
          googleRefreshToken: tokens.refresh_token, // might be undefined if not first time
          googleEmail: email
        }
      });

      // If refresh token is missing but we already had one, we shouldn't overwrite it with null,
      // Prisma update will handle undefined correctly (it ignores it), but let's be explicit
      if (tokens.refresh_token) {
        await this.prisma.user.update({
           where: { id: userId },
           data: { googleRefreshToken: tokens.refresh_token }
        });
      }

      return { success: true, email };
    } catch (error) {
      this.logger.error('Error handling Google OAuth callback', error);
      throw error;
    }
  }

  /**
   * Helper to get an authenticated Google OAuth2 client for a specific user
   */
  async getAuthClient(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.googleAccessToken) {
      throw new Error('User has not connected their Google account');
    }

    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    client.setCredentials({
      access_token: user.googleAccessToken,
      refresh_token: user.googleRefreshToken,
    });

    // Auto-refresh token if expired (handled by googleapis when making requests)
    client.on('tokens', async (tokens) => {
      if (tokens.access_token) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { googleAccessToken: tokens.access_token }
        });
      }
      if (tokens.refresh_token) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { googleRefreshToken: tokens.refresh_token }
        });
      }
    });

    return client;
  }

  // --- SUPERPOWERS --- //

  async syncContactToGoogle(userId: string, name: string, phone: string) {
    try {
      const auth = await this.getAuthClient(userId);
      const people = google.people({ version: 'v1', auth });

      await people.people.createContact({
        requestBody: {
          names: [{ givenName: name || 'Nuevo Cliente WhatsApp' }],
          phoneNumbers: [{ value: phone, type: 'mobile' }]
        }
      });
      this.logger.log(`Contacto ${name} (${phone}) sincronizado a Google Contacts del usuario ${userId}`);
    } catch (e) {
      this.logger.error('Failed to sync contact to Google', e);
    }
  }
}
