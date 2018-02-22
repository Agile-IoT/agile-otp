const path = require('path');
const express = require('express');
const bearerToken = require('express-bearer-token');
const tokenParser = require('parse-bearer-token');
const proxy = require('http-proxy-middleware');
const compression = require('compression');
const bodyParser = require('body-parser');
const conf = require('./conf/agile-otp');
const app = express();
const agile = require('agile-sdk')(conf.sdk);
const otp = require('./src/otp/index');

const FRAME_SIZE = 10;

app.use(bodyParser.urlencoded({extended: true}));

agile.idm.authentication.authenticateClient(conf.client.id, conf.client.clientSecret).then((auth) => {
  agile.tokenSet(auth.access_token);
})

const authMiddleware = function (req, res, next) {
  const token = tokenParser(req);
  const name = req.headers.entityname;
  const auth = req.headers.authtype;
  const id = name + "!@!" + auth;
  const type = req.headers.entitytype;
  if (!token) {
    return res.status(401).send('Authentication failed: Please provide a token');

  }
  if (!id && !type) {
    return res.status(400).send('Required missing argument: Please provide an entity id and entity type');

  }
  agile.idm.entity.get(id, type).then(entity => {
    if (!entity.credentials.otp) {
      return res.status(404).send('The requested entity does not have OTP information');
    }

    let ik = entity.credentials.otp.ik;
    let ts = parseInt(entity.credentials.otp.ts);

    if (req.body.scaler) {
      return {id: otp.generateEID(ik, req.body.scaler, ts).eid, ik: ik, ts: ts, otp: entity.credentials.otp};
    } else {
      return {id: otp.generateEID(ik, 0, ts).eid, ik: ik, ts: ts, otp: entity.credentials.otp};
    }
  }).then(res => {
    let newts = res.ts;
    let validToken = res.id === token;

    if(validToken) {
     newts++;
    } else if(res.otp.frame) {
      let i = 1;
      while(!validToken && i <= FRAME_SIZE) {
        if(res.otp.frame[i] === token) {
          validToken = true;
        }
        if (validToken) {
          newts = newts + i;
        }
        i++;
      }
    }

    if (validToken) {
      res.otp.ts = '' + newts;
      let frame = {};
      for (let i = 1; i <= FRAME_SIZE; ++i) {
        frame[i] = otp.generateEID(res.ik, 0, newts + i - 1).eid;
      }

      res.otp.frame = frame;
      agile.idm.entity.setAttribute({
        entityType: type,
        entityId: id,
        attributeType: 'credentials.otp',
        attributeValue: res.otp
      })
      .then(() => {
        //If everything is OK, add the clients' token to be able to proxy the request
        req.headers = {'authorization': 'Bearer ' + agile.tokenGet(), 'Content-Type': 'application/json'};
        next();
      });
    } else {
      throw {response: {status: 401}, message: 'Invalid token'};
    }
  }).catch(err => {
    // forward the failed result to client
    if (err) {
      res.status(err.response.status).send(err.message);
    } else {
      next(err);
    }
  })
}

const proxyFactory = (name, service, port, ws = false) => {
  return proxy({
    target: `http://${name}:${port}`,
    // changeOrigin: true,
    pathRewrite: {
      [`^/${service}`]: ''
    },
    ws
  });
}

app.use(compression());
// All gateway traffic proxied with signature <host>/<service-name>
app.use(express.static(path.join(__dirname, 'build')));

app.use(bearerToken());
app.use('/agile-security', authMiddleware, proxyFactory('agile-security', 'agile-security', 3000));
app.use('/agile-core', authMiddleware, proxyFactory('agile-core', 'agile-core', 8080, true));
app.use('/agile-data', authMiddleware, proxyFactory('agile-data', 'agile-data', 1338));
app.use('/agile-recommender', authMiddleware, proxyFactory('agile-recommender', 'agile-recommender', 1338));

app.listen(1400, () => console.log('AGILE-OTP proxy listening!'));
