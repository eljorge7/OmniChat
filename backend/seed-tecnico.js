const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('12345678', 10);

  // Crear empresa si no existe
  let company = await prisma.company.findFirst({
    where: { name: 'Empresa Demo' }
  });

  if (!company) {
    company = await prisma.company.create({
      data: {
        name: 'Empresa Demo',
      }
    });
  }

  // Crear o buscar Pipeline
  let pipeline = await prisma.pipeline.findFirst({
    where: { companyId: company.id }
  });

  if (!pipeline) {
    pipeline = await prisma.pipeline.create({
      data: {
        name: 'Ventas Generales',
        companyId: company.id,
      }
    });
  }

  // Crear técnico
  let tecnico = await prisma.user.findUnique({
    where: { email: 'tecnico@empresa.com' }
  });

  if (!tecnico) {
    tecnico = await prisma.user.create({
      data: {
        email: 'tecnico@empresa.com',
        name: 'Juan Técnico',
        password: passwordHash,
        role: 'TECHNICIAN',
        companyId: company.id,
      }
    });
    console.log('Técnico creado: tecnico@empresa.com / 12345678');
  } else {
    // Asegurar que la contraseña sea 12345678
    tecnico = await prisma.user.update({
      where: { id: tecnico.id },
      data: { password: passwordHash }
    });
    console.log('Técnico ya existía. Contraseña restablecida a: 12345678');
  }

  // Crear un evento de prueba (Cita en el calendario) para el día de hoy
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Limpiar eventos anteriores del tecnico
  await prisma.calendarEvent.deleteMany({
    where: { assignedToId: tecnico.id }
  });

  const evt1 = await prisma.calendarEvent.create({
    data: {
      title: 'Instalación de Router Fibra Óptica',
      description: 'El cliente reporta que requiere instalación nueva en el 3er piso.',
      startTime: new Date(today.setHours(10, 0, 0, 0)),
      endTime: new Date(today.setHours(12, 0, 0, 0)),
      assignedToId: tecnico.id,
      pipelineId: pipeline.id,
      status: 'PROGRAMADO',
      location: 'Av. Universidad 400, CDMX',
      companyId: company.id
    }
  });

  const evt2 = await prisma.calendarEvent.create({
    data: {
      title: 'Mantenimiento Preventivo',
      description: 'Revisión de cableado y limpieza de equipos.',
      startTime: new Date(today.setHours(15, 0, 0, 0)),
      endTime: new Date(today.setHours(16, 30, 0, 0)),
      assignedToId: tecnico.id,
      pipelineId: pipeline.id,
      status: 'PROGRAMADO',
      location: 'Paseo de la Reforma 222, CDMX',
      companyId: company.id
    }
  });

  console.log(`Eventos creados para ${tecnico.name}:`, evt1.title, ',', evt2.title);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
