const { Client } = require('ssh2'); 
const conn = new Client(); 
conn.on('ready', () => { 
  conn.exec('docker logs omnichat-backend 2>&1 | grep "Error aplicando pago final en WispHub" -A 15', (err, stream) => { 
    stream.on('data', (data) => console.log(data.toString())); 
    stream.on('close', () => conn.end()); 
  }); 
}).connect({ host: '137.184.155.133', username: 'root', password: 'ELj@rge79137h' });
