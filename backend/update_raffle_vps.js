const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec('docker exec omnichat-backend npx ts-node -e "const { PrismaClient } = require(\'@prisma/client\'); const prisma = new PrismaClient(); async function run() { await prisma.raffle.updateMany({ data: { opportunitiesMultiplier: 5 } }); console.log(\'Updated raffles successfully\'); } run();"', (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
      conn.end();
    }).on('data', (data) => {
      console.log('STDOUT: ' + data);
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data);
    });
  });
}).connect({
  host: '137.184.155.133',
  port: 22,
  username: 'root',
  password: 'ELj@rge79137h'
});
