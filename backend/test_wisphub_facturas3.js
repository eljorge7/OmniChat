const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const prisma = new PrismaClient();

async function test() {
   const company = await prisma.company.findFirst({
       where: { wisphubApiKey: { not: null } }
   });
   if(!company) return console.log("No API key");
   
   try {
       const res = await axios.get('https://api.wisphub.net/api/facturas/3521/', {
           headers: { 'Authorization': `Api-Key ${company.wisphubApiKey}` }
       });
       console.log(JSON.stringify({id: res.data.id_factura, estado: res.data.estado, cliente: res.data.cliente.usuario}, null, 2));
   } catch(e) {
       console.log("Error:", e.message);
   }
}
test();
