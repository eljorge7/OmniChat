const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const prisma = new PrismaClient();

async function test() {
   const company = await prisma.company.findFirst({
       where: { wisphubApiKey: { not: null } }
   });
   if(!company) return console.log("No API key");
   
   try {
       const res = await axios.get('https://api.wisphub.net/api/facturas/?cliente=0068@radiotec', {
           headers: { 'Authorization': `Api-Key ${company.wisphubApiKey}` }
       });
       const facturas = res.data.results.map(f => ({
           id: f.id_factura, 
           estado: f.estado, 
           total: f.total
       }));
       console.log(JSON.stringify(facturas, null, 2));
   } catch(e) {
       console.log("Error:", e.message);
   }
}
test();
