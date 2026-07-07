const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Iniciando migración de datos a Modo Kanban...');

    const companyId = 'bcd85cb5-e830-4d86-b24c-c6c7d43fbed4'; // Grupo Hurtado

    // 1. Crear Departamentos
    const depts = [
        { name: 'Radiotec', companyId },
        { name: 'RentControl', companyId },
        { name: 'HcSuperlavado', companyId },
        { name: 'Administración', companyId }
    ];

    const createdDepts = {};
    for (const d of depts) {
        let dept = await prisma.department.findFirst({ where: { name: d.name, companyId: d.companyId } });
        if (!dept) {
            dept = await prisma.department.create({ data: d });
            console.log(`Departamento creado: ${dept.name}`);
        }
        createdDepts[d.name] = dept;
    }

    // 2. Mapear Embudos (Pipelines) actuales a sus Departamentos y renombrarlos
    const pipelineMappings = {
        'Ventas-Radiotec': { dept: 'Radiotec', newName: 'Ventas' },
        'Soporte-Radiotec': { dept: 'Radiotec', newName: 'Soporte' },
        'Mantenimiento-RentControl': { dept: 'RentControl', newName: 'Mantenimiento' },
        'HcSuperlavado': { dept: 'HcSuperlavado', newName: 'Ventas y Servicios' },
        'Atención General': { dept: 'Administración', newName: 'Recepción' },
        'Pagos Por Validar': { dept: 'Administración', newName: 'Finanzas' }
    };

    const pipelines = await prisma.pipeline.findMany({ where: { companyId } });

    for (const pipe of pipelines) {
        const mapping = pipelineMappings[pipe.name];
        if (mapping) {
            const dept = createdDepts[mapping.dept];
            await prisma.pipeline.update({
                where: { id: pipe.id },
                data: {
                    departmentId: dept.id,
                    name: mapping.newName
                }
            });
            console.log(`Pipeline ${pipe.name} movido a ${dept.name} y renombrado a ${mapping.newName}`);
        } else {
            console.log(`No se encontró mapeo para ${pipe.name}, se queda igual.`);
            // Asignarlo a Administración por defecto
            await prisma.pipeline.update({
                where: { id: pipe.id },
                data: { departmentId: createdDepts['Administración'].id }
            });
        }
    }

    // 3. Crear Etapas (Stages) para cada Pipeline
    const updatedPipelines = await prisma.pipeline.findMany({ where: { companyId } });
    
    const stageTemplates = {
        'Ventas': ['Nuevo Lead', 'Contactado', 'Cotización Enviada', 'Instalación Pendiente', 'Cerrado Ganado'],
        'Soporte': ['Nuevo Reporte', 'Revisión Remota', 'Visita Agendada', 'Resuelto'],
        'Mantenimiento': ['Nuevo Reporte', 'Revisión Técnica', 'En Reparación', 'Completado'],
        'Ventas y Servicios': ['Nuevo Cliente', 'Cotizado', 'Agendado', 'Servicio Finalizado'],
        'Recepción': ['En Espera', 'Atendido', 'Cerrado'],
        'Finanzas': ['Pago Recibido', 'Validación Manual', 'Aprobado', 'Rechazado']
    };

    for (const pipe of updatedPipelines) {
        const stagesToCreate = stageTemplates[pipe.name] || ['Nuevo', 'En Proceso', 'Finalizado'];
        
        let order = 1;
        for (const stageName of stagesToCreate) {
            let existingStage = await prisma.pipelineStage.findFirst({
                where: { name: stageName, pipelineId: pipe.id }
            });

            if (!existingStage) {
                await prisma.pipelineStage.create({
                    data: {
                        name: stageName,
                        order: order,
                        pipelineId: pipe.id
                    }
                });
                console.log(`Creada etapa: ${stageName} en embudo ${pipe.name}`);
            }
            order++;
        }
    }

    // 4. Migrar Contactos
    console.log('Migrando contactos...');
    const contacts = await prisma.contact.findMany({ where: { companyId } });

    for (const contact of contacts) {
        if (contact.pipelineId) {
            const pipe = updatedPipelines.find(p => p.id === contact.pipelineId);
            if (pipe) {
                // Encontrar la primera etapa de ese embudo
                const firstStage = await prisma.pipelineStage.findFirst({
                    where: { pipelineId: pipe.id },
                    orderBy: { order: 'asc' }
                });

                await prisma.contact.update({
                    where: { id: contact.id },
                    data: {
                        departmentId: pipe.departmentId,
                        pipelineStageId: firstStage ? firstStage.id : null
                    }
                });
            }
        } else {
            // Si no tiene pipeline, meterlo al departamento de Recepción / Embudo Recepción
            const defaultPipe = updatedPipelines.find(p => p.name === 'Recepción');
            if (defaultPipe) {
                const firstStage = await prisma.pipelineStage.findFirst({
                    where: { pipelineId: defaultPipe.id },
                    orderBy: { order: 'asc' }
                });
                await prisma.contact.update({
                    where: { id: contact.id },
                    data: {
                        departmentId: defaultPipe.departmentId,
                        pipelineId: defaultPipe.id,
                        pipelineStageId: firstStage ? firstStage.id : null
                    }
                });
            }
        }
    }

    console.log('¡Migración completada exitosamente!');
}

main().catch(e => {
    console.error(e);
    process.exit(1);
}).finally(async () => {
    await prisma.$disconnect();
});
