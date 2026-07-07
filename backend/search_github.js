const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const scriptToRunInsideDocker = `
const axios = require('axios');
async function run() {
  try {
    const res = await axios.get('https://api.github.com/search/code?q=wisphub+pago+OR+pagos+in:file', {
       headers: { 'User-Agent': 'node.js' }
    });
    const items = res.data.items || [];
    for (const item of items.slice(0, 5)) {
      console.log(item.html_url);
    }
  } catch(e) {
    console.log(e.message);
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
