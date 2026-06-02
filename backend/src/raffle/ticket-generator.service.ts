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
      
      const numbersCount = data.ticketNumbers.length;
      let numbersFontSize = '42px';
      let numbersLetterSpacing = '5px';
      
      if (numbersCount === 2) {
        numbersFontSize = '32px';
        numbersLetterSpacing = '3px';
      } else if (numbersCount >= 3 && numbersCount <= 5) {
        numbersFontSize = '24px';
        numbersLetterSpacing = '2px';
      } else if (numbersCount > 5) {
        numbersFontSize = '18px';
        numbersLetterSpacing = '1px';
      }

      const numbersTitle = numbersCount === 1 ? 'Tu Número de la Suerte' : 'Tus Números de la Suerte';

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
              font-size: \${numbersFontSize};
              font-weight: 900;
              color: #10B981;
              letter-spacing: \${numbersLetterSpacing};
              word-wrap: break-word;
              line-height: 1.5;
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
                <div class="ticket-numbers-title">${numbersTitle}</div>
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

  async generateAvailableNumbersFlyer(data: {
    companyName: string;
    raffleName: string;
    availableNumbers: string[];
    themeColor: string;
    logoUrl?: string;
  }): Promise<Buffer | null> {
    this.logger.log(`Iniciando generación de flyer de números disponibles para ${data.raffleName}`);
    try {
      const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true
      });
      
      const page = await browser.newPage();
      await page.setViewport({ width: 800, height: 1600 });

      // Max numbers to display so we don't break the image height limit
      const maxDisplay = 250;
      let numbersToShow = data.availableNumbers;
      let extraText = '';
      if (numbersToShow.length > maxDisplay) {
        extraText = `y ${numbersToShow.length - maxDisplay} números más...`;
        numbersToShow = numbersToShow.slice(0, maxDisplay);
      }

      const numbersHtml = numbersToShow.map(n => `<div class="number-badge">${n}</div>`).join('');

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
            .flyer-container {
              width: 750px;
              background: linear-gradient(to bottom right, #1E293B, #0F172A);
              border-radius: 30px;
              overflow: hidden;
              box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
              position: relative;
              border: 1px solid rgba(255, 255, 255, 0.1);
            }
            .flyer-header {
              background: linear-gradient(90deg, ${data.themeColor}, #10B981);
              padding: 40px;
              text-align: center;
              position: relative;
            }
            .flyer-header img {
              max-height: 120px;
              max-width: 400px;
              object-fit: contain;
              filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));
            }
            .company-name {
              font-size: 42px;
              font-weight: 900;
              text-transform: uppercase;
              letter-spacing: 2px;
              text-shadow: 0 2px 4px rgba(0,0,0,0.5);
            }
            .flyer-body {
              padding: 40px;
              text-align: center;
            }
            .raffle-title {
              font-size: 32px;
              font-weight: 900;
              color: #F8FAFC;
              margin-bottom: 10px;
              line-height: 1.3;
            }
            .raffle-subtitle {
              font-size: 20px;
              font-weight: 700;
              color: ${data.themeColor};
              margin-bottom: 40px;
              text-transform: uppercase;
              letter-spacing: 2px;
            }
            .numbers-grid {
              display: flex;
              flex-wrap: wrap;
              gap: 12px;
              justify-content: center;
              margin-bottom: 30px;
            }
            .number-badge {
              background: rgba(255,255,255,0.1);
              border: 1px solid rgba(255,255,255,0.2);
              padding: 10px 15px;
              border-radius: 10px;
              font-size: 20px;
              font-weight: 900;
              color: #FFFFFF;
              min-width: 45px;
              text-align: center;
            }
            .extra-text {
              font-size: 18px;
              color: #94A3B8;
              font-weight: 700;
              margin-top: 20px;
            }
            .footer-section {
              background: rgba(0,0,0,0.4);
              padding: 30px;
              text-align: center;
              border-top: 1px solid rgba(255,255,255,0.05);
            }
            .footer-text {
              font-size: 22px;
              font-weight: 900;
              color: #F8FAFC;
            }
            .footer-subtext {
              font-size: 16px;
              color: #94A3B8;
              margin-top: 10px;
            }
          </style>
        </head>
        <body>
          <div class="flyer-container">
            <div class="flyer-header">
              ${data.logoUrl 
                ? `<img src="${data.logoUrl}" alt="Logo">` 
                : `<div class="company-name">${data.companyName}</div>`}
            </div>
            
            <div class="flyer-body">
              <div class="raffle-title">${data.raffleName}</div>
              <div class="raffle-subtitle">¡Números Disponibles!</div>
              
              <div class="numbers-grid">
                ${numbersHtml}
              </div>
              
              ${extraText ? `<div class="extra-text">${extraText}</div>` : ''}
            </div>
            
            <div class="footer-section">
              <div class="footer-text">¡Pide los tuyos por WhatsApp antes de que se acaben!</div>
              <div class="footer-subtext">Generado automáticamente por OmniChat</div>
            </div>
          </div>
        </body>
        </html>
      `;

      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      
      const element = await page.$('.flyer-container');
      if (!element) throw new Error("No se pudo encontrar el contenedor del flyer");
      
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
      this.logger.log(`Flyer generado exitosamente: ${imageBuffer.length} bytes`);
      return Buffer.from(imageBuffer);
      
    } catch (e) {
      this.logger.error("Error generando flyer", e);
      return null;
    }
  }

  async generateWinnerFlyer(data: {
    companyName: string;
    raffleName: string;
    winningNumber: string;
    winnerName: string;
    evidenceUrl: string;
    themeColor: string;
    logoUrl?: string;
  }): Promise<Buffer | null> {
    this.logger.log(`Iniciando generación de flyer de GANADOR para ${data.raffleName}`);
    try {
      const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true
      });
      
      const page = await browser.newPage();
      await page.setViewport({ width: 800, height: 1600 });

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
            .flyer-container {
              width: 750px;
              background: linear-gradient(to bottom right, #1E293B, #0F172A);
              border-radius: 30px;
              overflow: hidden;
              box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
              position: relative;
              border: 1px solid rgba(255, 255, 255, 0.1);
            }
            .flyer-header {
              background: linear-gradient(90deg, #F59E0B, #EF4444); /* Gold/Red gradient for celebration */
              padding: 40px;
              text-align: center;
              position: relative;
            }
            .flyer-header img {
              max-height: 120px;
              max-width: 400px;
              object-fit: contain;
              filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));
            }
            .company-name {
              font-size: 42px;
              font-weight: 900;
              text-transform: uppercase;
              letter-spacing: 2px;
              text-shadow: 0 2px 4px rgba(0,0,0,0.5);
            }
            .flyer-body {
              padding: 40px;
              text-align: center;
            }
            .raffle-title {
              font-size: 26px;
              font-weight: 700;
              color: #94A3B8;
              margin-bottom: 15px;
            }
            .winner-title {
              font-size: 50px;
              font-weight: 900;
              color: #FBBF24;
              text-transform: uppercase;
              letter-spacing: 3px;
              margin-bottom: 10px;
              text-shadow: 0 0 20px rgba(251, 191, 36, 0.3);
            }
            .winner-name {
              font-size: 38px;
              font-weight: 900;
              color: #FFFFFF;
              margin-bottom: 30px;
            }
            .winning-number-box {
              background: rgba(251, 191, 36, 0.1);
              border: 2px dashed #FBBF24;
              border-radius: 20px;
              padding: 20px;
              margin-bottom: 40px;
              display: inline-block;
            }
            .winning-number-label {
              font-size: 16px;
              color: #FBBF24;
              text-transform: uppercase;
              font-weight: 900;
              letter-spacing: 2px;
              margin-bottom: 5px;
            }
            .winning-number {
              font-size: 48px;
              font-weight: 900;
              color: #FFFFFF;
              letter-spacing: 5px;
            }
            .evidence-container {
              background: #000;
              border-radius: 15px;
              padding: 10px;
              border: 1px solid rgba(255,255,255,0.1);
              margin-bottom: 20px;
            }
            .evidence-img {
              max-width: 100%;
              max-height: 400px;
              border-radius: 10px;
              object-fit: cover;
            }
            .footer-section {
              background: rgba(0,0,0,0.4);
              padding: 30px;
              text-align: center;
              border-top: 1px solid rgba(255,255,255,0.05);
            }
            .footer-text {
              font-size: 20px;
              font-weight: 700;
              color: #F8FAFC;
            }
            .footer-subtext {
              font-size: 14px;
              color: #94A3B8;
              margin-top: 10px;
            }
          </style>
        </head>
        <body>
          <div class="flyer-container">
            <div class="flyer-header">
              ${data.logoUrl 
                ? `<img src="${data.logoUrl}" alt="Logo">` 
                : `<div class="company-name">${data.companyName}</div>`}
            </div>
            
            <div class="flyer-body">
              <div class="raffle-title">${data.raffleName}</div>
              <div class="winner-title">¡TENEMOS GANADOR!</div>
              <div class="winner-name">${data.winnerName}</div>
              
              <div class="winning-number-box">
                <div class="winning-number-label">Boleto Ganador</div>
                <div class="winning-number">${data.winningNumber}</div>
              </div>
              
              <div class="evidence-container">
                <img class="evidence-img" src="${data.evidenceUrl}" alt="Evidencia del Sorteo">
              </div>
            </div>
            
            <div class="footer-section">
              <div class="footer-text">¡Gracias a todos por participar!</div>
              <div class="footer-subtext">Generado y auditado por OmniChat System</div>
            </div>
          </div>
        </body>
        </html>
      `;

      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      
      const element = await page.$('.flyer-container');
      if (!element) throw new Error("No se pudo encontrar el contenedor del flyer");
      
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
      this.logger.log(`Flyer de ganador generado exitosamente: ${imageBuffer.length} bytes`);
      return Buffer.from(imageBuffer);
      
    } catch (e) {
      this.logger.error("Error generando flyer de ganador", e);
      return null;
    }
  }
}
