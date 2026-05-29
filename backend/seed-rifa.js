const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Conectando a la Base de Datos...");
  const company = await prisma.company.findFirst();
  
  if (!company) { 
      console.log("Error: No se encontró la empresa matriz en la base de datos."); 
      process.exit(1); 
  }
  
  // Revisar si ya existe
  const existing = await prisma.raffle.findFirst({ where: { name: "Gran Sorteo: Panel Solar 3.3kWh + Instalación" }});
  if (existing) {
      console.log("\n==================================================");
      console.log("¡La Rifa ya estaba creada!");
      console.log(`Entra a verla en: https://omnichat.radiotecpro.com/rifas/${company.id}`);
      console.log("==================================================\n");
      process.exit(0);
  }

  console.log("Creando el Gran Sorteo de Paneles Solares...");
  const r = await prisma.raffle.create({
    data: {
      name: "Gran Sorteo: Panel Solar 3.3kWh + Instalación",
      description: "¡Despídete de los altos recibos de CFE! Participa para ganar un sistema de paneles solares completo con inversor, accesorios, instalación profesional y trámites ante CFE incluidos.",
      ticketPrice: 400.0,
      totalTickets: 200,
      imageUrl: "https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&q=80&w=1000",
      companyId: company.id
    }
  });
  
  console.log("\n==================================================");
  console.log("🎉 ¡Rifa Inaugurada con Éxito!");
  console.log(`Link Público Oficial para tus clientes:`);
  console.log(`https://omnichat.radiotecpro.com/rifas/${company.id}`);
  console.log("==================================================\n");
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
