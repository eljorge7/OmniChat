const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const prisma = new PrismaClient();

async function test() {
   const company = await prisma.company.findFirst({
       where: { wisphubApiKey: { not: null } }
   });
   if(!company) return console.log("No API key");
   
   try {
       const res = await axios.get('https://api.wisphub.net/api/facturas/?cliente=0068@radiotec&estado=1&fecha_emision__range_0=2020-01-01&fecha_emision__range_1=2030-01-01', {
           headers: { 'Authorization': `Api-Key ${company.wisphubApiKey}` }
       });
       console.log(JSON.stringify(res.data, null, 2));
   } catch(e) {
       console.log("Error:", e.response ? e.response.data : e.message);
   }
}
test();
