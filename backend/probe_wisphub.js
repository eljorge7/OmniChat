const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const scriptToRunInsideDocker = `
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const prisma = new PrismaClient();

async function run() {
  const company = await prisma.company.findFirst({ where: { wisphubApiKey: { not: null } } });
  
  try {
    const res = await axios.get('https://api.wisphub.net/api/facturas/3953/', {
      headers: { 'Authorization': 'Api-Key ' + company.wisphubApiKey }
    });
    console.log(JSON.stringify(res.data, null, 2));
  } catch(e) {
    console.log("Error status:", e.response ? e.response.status : e.message);
  }
}
run().finally(() => process.exit(0));
`;
  
  conn.exec(`docker exec omnichat-backend node -e "${scriptToRunInsideDocker.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, (err, stream) => {
    stream.on('data', (data) => console.log(data.toString()));
    stream.stderr.on('data', (data) => console.error(data.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '137.184.155.133', username: 'root', password: 'ELj@rge79137h' });
