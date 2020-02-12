var https = require('https');
var fs = require('fs');

// This line is from the Node.js HTTPS documentation.
var options = {
  key: fs.readFileSync('./key.pem'),
  cert: fs.readFileSync('./cert.pem')
};


// Create an HTTPS service identical to the HTTP service.
https.createServer(options, (r,s)=>{s.writeHead(200);s.end("lul")}).listen(443);