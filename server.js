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
const otp = require('./index');

app.use(bodyParser.urlencoded({extended: true}));

//Authenticate on boot
agile.idm.authentication.authenticateClient(conf.client.id, conf.client.clientSecret).then((auth) => {
  agile.tokenSet(auth.access_token);
}).then(() => {
  //Calculate token frames for all entities on boot
  getEntities(conf.types).then(entities => {
    entities.forEach(entity => {
      if (entity.credentials && entity.credentials.otp && !entity.credentials.otp.frame) {
        let frame = {};
        for (let i = 1; i <= conf.frame_size; ++i) {
          frame[i] = otp.generateEID(entity.credentials.otp.ik, 0, parseInt(entity.credentials.otp.ts) + i - 1).eid
        }
        entity.credentials.otp.frame = frame;
        agile.idm.entity.setAttribute({
          entityType: entity.type.replace("/", ""),
          entityId: entity.id,
          attributeType: 'credentials.otp',
          attributeValue: entity.credentials.otp
        });
      }
    })
  }).catch(err => {
    console.log(err);
  });
});

function getEntities(types) {
  return Promise.all(types.map(type => {
    return agile.idm.entity.getByType(type)
  })).then(entities => {
    let result = [];
    entities.forEach(e => {
      if (e.length > 0) {
        result.push(e[0])
      }
    });
    return result;
  });
}

const authMiddleware = function (req, res, next) {
  const token = tokenParser(req);
  if (!token) {
    return res.status(401).send('Authentication failed: Please provide a token');

  }

  //conf.types.forEach(type => {
  getEntities(conf.types).then(entities => {
    return entities.filter(entity => {
      if (entity.credentials && entity.credentials.otp && entity.credentials.otp.frame) {
        let keys = Object.keys(entity.credentials.otp.frame);
        let foundKey = keys.filter(key => {
          return entity.credentials.otp.frame[key] === token
        })[0];
        if (foundKey) {
          entity.credentials.otp.ts = parseInt(entity.credentials.otp.ts) + parseInt(foundKey[0]);
          return entity
        }
      }
    })[0];
  }).then(entity => {
    if (entity) {
      let frame = {};
      for (let i = 1; i <= conf.frame_size; ++i) {
        frame[i] = otp.generateEID(entity.credentials.otp.ik, 0, entity.credentials.otp.ts + i - 1).eid
      }
      entity.credentials.otp.frame = frame;
      agile.idm.entity.setAttribute({
        entityType: entity.type.replace("/", ""),
        entityId: entity.id,
        attributeType: 'credentials.otp',
        attributeValue: entity.credentials.otp
      }).then(() => {
        //If everything is OK, add the clients' token to be able to proxy the request
        req.headers = {'authorization': 'Bearer ' + agile.tokenGet(), 'Content-Type': 'application/json'};
        next();
      });
    } else {
      throw {response: {status: 401}, message: 'Invalid token'}
    }
  }).catch(err => {
    // forward the failed result to client
    if (err) {
      res.status(err.response.status).send(err.message)
    } else {
      next(err)
    }
  });
  //});
}

const proxyFactory = (name, service, port, ws = false) => {
  return proxy({
    target: `http://${name}:${port}`,
    // changeOrigin: true,
    pathRewrite: {
      [`^/${service}`]: ''
    },
    ws
  })
}

app.use(compression());
// All gateway traffic proxied with signature <host>/<service-name>
app.use(express.static(path.join(__dirname, 'build')));

app.use(bearerToken());
app.use('/agile-security', authMiddleware, proxyFactory('agile-security', 'agile-security', 3000));
app.use('/agile-core', authMiddleware, proxyFactory('agile-core', 'agile-core', 8080, true));
app.use('/agile-data', authMiddleware, proxyFactory('agile-data', 'agile-data', 1338));
app.use('/agile-recommender', authMiddleware, proxyFactory('agile-recommender', 'agile-recommender', 1338));

app.listen(conf.port, () => console.log('AGILE-OTP proxy listening!'));
