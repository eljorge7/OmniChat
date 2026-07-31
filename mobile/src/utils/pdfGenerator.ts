import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export const generateServiceTicket = async (event: any, technicianName: string, companyName: string = 'OmniChat Services') => {
  try {
    const dateFormatted = format(new Date(), "dd 'de' MMMM 'de' yyyy, HH:mm", { locale: es });
    const scheduleFormatted = `${format(new Date(event.startTime), "HH:mm")} - ${format(new Date(event.endTime), "HH:mm")}`;
    
    // Convertir imágenes a Base64 para que el PDF las pueda incrustar correctamente
    let photosHtml = '';
    if (event.photoUris && event.photoUris.length > 0) {
      const base64Photos = await Promise.all(
        event.photoUris.map(async (uri: string) => {
          let localUri = uri;
          if (uri.startsWith('http://') || uri.startsWith('https://')) {
            const fixedUri = uri.replace('3002/uploads/', '3002/api/uploads/');
            // Download remote image to bypass ATS and allow base64 encoding
            const filename = `${Math.random().toString(36).substring(7)}_${fixedUri.split('/').pop() || 'temp.jpg'}`;
            const dest = FileSystem.cacheDirectory + filename;
            const downloadResult = await FileSystem.downloadAsync(fixedUri, dest);
            localUri = downloadResult.uri;
          }
          try {
            const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: 'base64' });
            return `data:image/jpeg;base64,${base64}`;
          } catch (e) {
            console.error('Error reading image', e);
            return uri;
          }
        })
      );

      photosHtml = `
        <div class="photo-section">
          <div class="section-title">EVIDENCIA FOTOGRÁFICA</div>
          <div class="gallery">
            ${base64Photos.map((base64Uri: string) => `
              <div class="photo-container">
                <img src="${base64Uri}" class="photo" />
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reporte de Servicio</title>
          <style>
              body {
                  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                  color: #333;
                  line-height: 1.6;
                  margin: 0;
                  padding: 40px;
              }
              .header {
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  border-bottom: 2px solid #4f46e5;
                  padding-bottom: 20px;
                  margin-bottom: 30px;
              }
              .logo-container {
                  display: flex;
                  align-items: center;
              }
              .logo-text {
                  font-size: 28px;
                  font-weight: 900;
                  color: #4f46e5;
                  letter-spacing: -1px;
              }
              .ticket-info {
                  text-align: right;
              }
              .ticket-info h2 {
                  margin: 0;
                  font-size: 14px;
                  color: #64748b;
                  text-transform: uppercase;
                  letter-spacing: 1px;
              }
              .ticket-info p {
                  margin: 5px 0 0 0;
                  font-size: 12px;
                  color: #94a3b8;
              }
              .status-badge {
                  display: inline-block;
                  padding: 6px 12px;
                  background-color: #22c55e;
                  color: white;
                  font-weight: bold;
                  border-radius: 20px;
                  font-size: 12px;
                  text-transform: uppercase;
                  letter-spacing: 1px;
                  margin-bottom: 20px;
              }
              h1 {
                  margin: 0 0 10px 0;
                  font-size: 24px;
                  color: #1e293b;
              }
              .grid {
                  display: grid;
                  grid-template-columns: 1fr 1fr;
                  gap: 20px;
                  margin-bottom: 30px;
                  background-color: #f8fafc;
                  padding: 20px;
                  border-radius: 12px;
              }
              .info-block label {
                  display: block;
                  font-size: 11px;
                  color: #64748b;
                  text-transform: uppercase;
                  font-weight: bold;
                  margin-bottom: 4px;
              }
              .info-block p {
                  margin: 0;
                  font-size: 14px;
                  color: #334155;
                  font-weight: 500;
              }
              .section-title {
                  font-size: 14px;
                  font-weight: bold;
                  color: #4f46e5;
                  text-transform: uppercase;
                  border-bottom: 1px solid #e2e8f0;
                  padding-bottom: 8px;
                  margin-top: 30px;
                  margin-bottom: 15px;
              }
              .text-content {
                  background-color: #f1f5f9;
                  padding: 15px;
                  border-radius: 8px;
                  font-size: 14px;
                  color: #334155;
              }
              .photo-section {
                  page-break-inside: avoid;
                  break-inside: avoid;
                  margin-top: 20px;
              }
              .gallery {
                  display: grid;
                  grid-template-columns: repeat(2, 1fr);
                  gap: 15px;
              }
              .photo-container {
                  height: 180px;
                  background-color: #f1f5f9;
                  border-radius: 8px;
                  overflow: hidden;
                  border: 1px solid #e2e8f0;
              }
              .photo {
                  width: 100%;
                  height: 100%;
                  object-fit: cover;
              }
              .signature-section {
                  margin-top: 60px;
                  display: flex;
                  justify-content: flex-start;
              }
              .signature-box {
                  width: 250px;
                  text-align: center;
              }
              .signature-line {
                  border-bottom: 1px solid #334155;
                  height: 40px;
                  margin-bottom: 10px;
              }
              .signature-name {
                  font-size: 14px;
                  font-weight: bold;
                  color: #1e293b;
              }
              .signature-title {
                  font-size: 12px;
                  color: #64748b;
              }
              .footer {
                  margin-top: 30px;
                  text-align: center;
                  font-size: 12px;
                  color: #94a3b8;
                  border-top: 1px solid #e2e8f0;
                  padding-top: 20px;
              }
          </style>
      </head>
      <body>
          <div class="header">
              <div class="logo-container">
                  <div class="logo-text">${companyName}</div>
              </div>
              <div class="ticket-info">
                  <h2>Reporte de Servicio</h2>
                  <p>Generado el ${dateFormatted}</p>
                  <p>ID: #${event.id.padStart(6, '0')}</p>
              </div>
          </div>

          <div class="status-badge">COMPLETADO</div>
          
          <h1>${event.title}</h1>
          
          <div class="grid">
              <div class="info-block">
                  <label>Horario</label>
                  <p>${scheduleFormatted}</p>
              </div>
              <div class="info-block">
                  <label>Ubicación</label>
                  <p>${event.location}</p>
              </div>
          </div>

          <div class="section-title">DESCRIPCIÓN DEL PROBLEMA</div>
          <div class="text-content">
              ${event.description || 'Sin descripción previa.'}
          </div>

          <div class="section-title">SOLUCIÓN / NOTAS DEL TÉCNICO</div>
          <div class="text-content">
              ${event.comments || 'El técnico no agregó notas.'}
          </div>

          ${photosHtml}

          <div class="signature-section">
              <div class="signature-box">
                  <div class="signature-line"></div>
                  <div class="signature-name">${technicianName || 'Técnico Asignado'}</div>
                  <div class="signature-title">Técnico de Servicio</div>
              </div>
          </div>

          <div class="footer">
              Este es un documento oficial generado por la plataforma OmniChat.
          </div>
      </body>
      </html>
    `;

    const { uri } = await Print.printToFileAsync({
      html: htmlContent,
      base64: false
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Reporte_${event.title.replace(/\s+/g, '_')}.pdf`,
        UTI: 'com.adobe.pdf'
      });
    }
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Hubo un error al generar el PDF.');
  }
};
