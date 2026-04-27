require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const http = require('http');

const port = Number(process.env.PORT) || 3000;
const name = (process.argv[2] || 'test_user').replace(/[^\w.-]/g, '').slice(0, 64) || 'test_user';
const path = `/api/test-follow/${encodeURIComponent(name)}`;

const req = http.request(
  { hostname: '127.0.0.1', port, path, method: 'GET' },
  (res) => {
    let body = '';
    res.on('data', (c) => {
      body += c;
    });
    res.on('end', () => {
      console.log('HTTP', res.statusCode, body.trim());
      if (res.statusCode === 404) {
        console.error(
          '\n404: en el puerto', port, 'no está este proyecto (o hace falta reiniciar npm start).',
          '\nComprueba: Get-NetTCPConnection -LocalPort', port
        );
      }
    });
  }
);
req.on('error', (e) => {
  console.error('Error:', e.message);
  console.error('¿Está `npm start` en marcha?');
});
req.end();
