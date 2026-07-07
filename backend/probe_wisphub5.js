const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const scriptToRunInsideDocker = `
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const prisma = new PrismaClient();

async function run() {
  const company = await prisma.company.findFirst({ where: { wisphubApiKey: { not: null } } });
  
  const payload = {
    referencia: "BOT_TEST",
    fecha_pago: "2026-07-01 12:00",
    nombre_user: "Test User",
    forma_pago: 1,
    comprobante_pago: "Test IA"
  };

  try {
    const res = await axios.post('https://api.wisphub.net/api/facturas/3953/registrar-pago/', payload, {
      headers: { 'Authorization': 'Api-Key ' + company.wisphubApiKey }
    });
    console.log("Success:", res.status);
    console.log("Data:", res.data);
  } catch(e) {
    if (e.response) {
       console.log("Status:", e.response.status);
       console.log("Data:", e.response.data);
    } else {
       console.log("Error:", e.message);
    }
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
