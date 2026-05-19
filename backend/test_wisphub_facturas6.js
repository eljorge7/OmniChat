const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const prisma = new PrismaClient();

async function test() {
   const company = await prisma.company.findFirst({
       where: { wisphubApiKey: { not: null } }
   });
   if(!company) return console.log("No API key");
   
   try {
       const today = new Date();
       const threeMonthsAgo = new Date();
       threeMonthsAgo.setMonth(today.getMonth() - 3);
       
       const end = today.toISOString().split('T')[0];
       const start = threeMonthsAgo.toISOString().split('T')[0];
       
       const res = await axios.get(`https://api.wisphub.net/api/facturas/?cliente=0068@radiotec&estado=1&fecha_emision__range_0=${start}&fecha_emision__range_1=${end}`, {
           headers: { 'Authorization': `Api-Key ${company.wisphubApiKey}` }
       });
       const facturas = res.data.results.map(f => ({
           id: f.id_factura, 
           estado: f.estado, 
           total: f.total,
           fecha: f.fecha_emision
       }));
       console.log(JSON.stringify(facturas, null, 2));
   } catch(e) {
       console.log("Error:", e.response ? e.response.data : e.message);
   }
}
test();
