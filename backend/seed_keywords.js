const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const pipes = await prisma.pipeline.findMany({ orderBy: { createdAt: 'asc' } });
  
  if (pipes.length >= 3) {
      await prisma.pipeline.update({
          where: { id: pipes[0].id },
          data: {
              keywords: 'fuga,agua,plomero,tubo,electricista,luz,foco,reparación,mantenimiento',
              autoReply: 'De acuerdo {name}, entiendo que tienes un problema de Plomería o Mantenimiento. Te redireccionaremos de inmediato con el área correspondiente, mientras tanto espera un momento en lo que un experto revisa tus mensajes.'
          }
      });

      await prisma.pipeline.update({
          where: { id: pipes[1].id },
          data: {
              keywords: 'renta,pagar,deposito,inquilino,departamento,contrato,recibo,rentcontrol',
              autoReply: 'Entendido {name}, veo que te comunicas por un tema de RentControl. Te canalizaremos de inmediato con tu Gestor PropTech. Espera un momento por favor.'
          }
      });

      await prisma.pipeline.update({
          where: { id: pipes[2].id },
          data: {
              keywords: 'internet,lento,router,antena,rojo,wifi,Radiotec',
              autoReply: 'Listo {name}. Hemos analizado tu reporte y serás transferido al equipo nivel 2 de Soporte Radiotec. Por favor aguarda en la línea.'
          }
      });
      console.log('Keywords set in Database.');
  }
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
