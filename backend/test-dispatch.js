fetch('http://127.0.0.1:3002/api/v1/messages/send', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sk_24af03088b47aac20bae7b1df07f8399',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ phone: '526421280007', text: 'Prueba de API interna (sin el 1)' })
}).then(res => res.json().then(data => console.log('HTTP', res.status, data))).catch(console.error);
