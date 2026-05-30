import { Injectable, Logger } from '@nestjs/common';
import * as puppeteer from 'puppeteer';

@Injectable()
export class TicketGeneratorService {
  private readonly logger = new Logger(TicketGeneratorService.name);

  async generateTicket(data: {
    companyName: string;
    raffleName: string;
    contactName: string;
    ticketNumbers: string[];
    paymentRef: string;
    themeColor: string;
    logoUrl?: string;
  }): Promise<Buffer | null> {
    this.logger.log(`Iniciando generación de boleto digital para ${data.contactName} - Ref: ${data.paymentRef}`);
    try {
      const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true
      });
      
      const page = await browser.newPage();
      await page.setViewport({ width: 800, height: 1200 });
      
      // Construir el diseño HTML
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
            body {
              font-family: 'Inter', sans-serif;
              margin: 0;
              padding: 0;
              background-color: #0B1120;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              color: white;
            }
            .ticket-container {
              width: 700px;
              background: linear-gradient(to bottom right, #1E293B, #0F172A);
              border-radius: 30px;
              overflow: hidden;
              box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
              position: relative;
              border: 1px solid rgba(255, 255, 255, 0.1);
            }
            .ticket-header {
              background: linear-gradient(90deg, ${data.themeColor}, #10B981);
              padding: 40px;
              text-align: center;
              position: relative;
            }
            .ticket-header img {
              max-height: 80px;
              max-width: 300px;
              object-fit: contain;
              filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));
            }
            .company-name {
              font-size: 32px;
              font-weight: 900;
              text-transform: uppercase;
              letter-spacing: 2px;
              text-shadow: 0 2px 4px rgba(0,0,0,0.5);
            }
            .vip-badge {
              position: absolute;
              top: 20px;
              right: -35px;
              background: #FFD700;
              color: #000;
              font-weight: 900;
              padding: 5px 40px;
              transform: rotate(45deg);
              font-size: 14px;
              letter-spacing: 2px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            }
            .ticket-body {
              padding: 40px;
              text-align: center;
            }
            .raffle-title {
              font-size: 28px;
              font-weight: 900;
              color: #F8FAFC;
              margin-bottom: 30px;
              line-height: 1.3;
            }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
              text-align: left;
              margin-bottom: 40px;
            }
            .info-box {
              background: rgba(255,255,255,0.05);
              padding: 20px;
              border-radius: 15px;
              border: 1px solid rgba(255,255,255,0.05);
            }
            .info-label {
              font-size: 14px;
              color: #94A3B8;
              text-transform: uppercase;
              font-weight: 700;
              margin-bottom: 8px;
              letter-spacing: 1px;
            }
            .info-value {
              font-size: 20px;
              font-weight: 700;
              color: #FFFFFF;
            }
            .ticket-numbers-container {
              background: rgba(0,0,0,0.3);
              padding: 30px;
              border-radius: 20px;
              border: 2px dashed ${data.themeColor};
              margin-bottom: 40px;
            }
            .ticket-numbers-title {
              font-size: 16px;
              color: ${data.themeColor};
              text-transform: uppercase;
              font-weight: 900;
              margin-bottom: 15px;
              letter-spacing: 2px;
            }
            .ticket-numbers {
              font-size: 42px;
              font-weight: 900;
              color: #10B981;
              letter-spacing: 5px;
              word-wrap: break-word;
            }
            .footer-section {
              border-top: 1px solid rgba(255,255,255,0.1);
              padding: 30px 40px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              background: rgba(0,0,0,0.2);
            }
            .qr-placeholder {
              width: 120px;
              height: 120px;
              background: white;
              padding: 10px;
              border-radius: 10px;
            }
            .auth-text {
              text-align: right;
            }
            .auth-title {
              color: #94A3B8;
              font-size: 14px;
              text-transform: uppercase;
              font-weight: 700;
              margin-bottom: 5px;
            }
            .auth-ref {
              color: white;
              font-size: 24px;
              font-weight: 900;
              letter-spacing: 2px;
            }
            .watermark {
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%) rotate(-45deg);
              font-size: 120px;
              font-weight: 900;
              color: rgba(255,255,255,0.03);
              white-space: nowrap;
              pointer-events: none;
            }
          </style>
        </head>
        <body>
          <div class="ticket-container">
            <div class="watermark">PAGADO</div>
            <div class="vip-badge">VIP</div>
            
            <div class="ticket-header">
              ${data.logoUrl 
                ? `<img src="${data.logoUrl}" alt="Logo">` 
                : `<div class="company-name">${data.companyName}</div>`}
            </div>
            
            <div class="ticket-body">
              <div class="raffle-title">${data.raffleName}</div>
              
              <div class="info-grid">
                <div class="info-box">
                  <div class="info-label">Participante</div>
                  <div class="info-value">${data.contactName}</div>
                </div>
                <div class="info-box">
                  <div class="info-label">Estado</div>
                  <div class="info-value" style="color: #10B981;">100% Pagado</div>
                </div>
              </div>
              
              <div class="ticket-numbers-container">
                <div class="ticket-numbers-title">Tus Números de la Suerte</div>
                <div class="ticket-numbers">${data.ticketNumbers.join(', ')}</div>
              </div>
            </div>
            
            <div class="footer-section">
              <img class="qr-placeholder" src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent('REF:'+data.paymentRef)}" alt="QR Code">
              <div class="auth-text">
                <div class="auth-title">Referencia de Autenticidad</div>
                <div class="auth-ref">${data.paymentRef}</div>
                <div style="font-size: 12px; color: #64748B; margin-top: 10px;">Válido Oficialmente • OmniChat System</div>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      
      // Buscar el tamaño exacto del contenedor
      const element = await page.$('.ticket-container');
      if (!element) throw new Error("No se pudo encontrar el contenedor del boleto");
      
      const boundingBox = await element.boundingBox();
      if (!boundingBox) throw new Error("No se pudo calcular el bounding box");

      const imageBuffer = await page.screenshot({
        type: 'png',
        clip: {
          x: boundingBox.x,
          y: boundingBox.y,
          width: boundingBox.width,
          height: boundingBox.height
        }
      });

      await browser.close();
      this.logger.log(`Boleto generado exitosamente: ${imageBuffer.length} bytes`);
      return Buffer.from(imageBuffer);
      
    } catch (e) {
      this.logger.error("Error generando boleto digital", e);
      return null;
    }
  }
}
