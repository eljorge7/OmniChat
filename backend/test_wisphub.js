const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const prisma = new PrismaClient();

async function test() {
   const company = await prisma.company.findFirst({
       where: { wisphubApiKey: { not: null } }
   });
   if(!company) return console.log("No API key");
   
   try {
       const res = await axios.get('https://api.wisphub.net/api/clientes/?limit=1', {
           headers: { 'Authorization': `Api-Key ${company.wisphubApiKey}` }
       });
       console.log(JSON.stringify(res.data.results[0], null, 2));
   } catch(e) {
       console.log("Error:", e.message);
   }
}
test();
