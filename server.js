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
  app.use(compression());
  // All gateway traffic proxied with signature <host>/<service-name>
  app.use(express.static(path.join(__dirname, 'build')));

  app.use(bearerToken());
  app.use('/agile-security', authMiddleware, proxyFactory('agile-security', 'agile-security', 3000));
  app.use('/agile-core', authMiddleware, proxyFactory('agile-core', 'agile-core', 8080, true));
  app.use('/agile-data', authMiddleware, proxyFactory('agile-data', 'agile-data', 1338));
  app.use('/agile-recommender', authMiddleware, proxyFactory('agile-recommender', 'agile-recommender', 1338));

  app.listen(conf.port, () => console.log('AGILE-OTP proxy listening on', conf.port));
}).then(() => {
  //Calculate token frames for all entities on boot
  getEntities(conf.types).then(entities => {
    if (entities) {
      entities.forEach(entity => {
        if (entity.credentials && entity.credentials.otp && entity.credentials.otp.ik && entity.credentials.otp.ts && !entity.credentials.otp.frame) {
          let frame = getFrame(entity.credentials.otp.ik, parseInt(entity.credentials.otp.ts));
          entity.credentials.otp.frame = frame;
          updateEntity(entity).catch(err => {
            console.log(err);
          }).then(entity => {
            console.log("Created token for", entity.id);
          })
        }
      })
    }
  }).catch(err => {
    console.log(err.response.status, err.response.statusText)
  })
}).catch(err => {
  console.log(err.response.status, err.response.statusText)
});

function getEntities(types) {
  return Promise.all(types.map(type => {
    return agile.idm.entity.getByType(type)
  })).then(entities => {
    if (entities) {
      let result = [];
      entities.forEach(e => {
        if (e.length > 0) {
          result.push(e[0])
        }
      });
      return result;
    }
  }).catch(err => {
    console.log(err)
  });
}

const getFrame = function (ik, ts) {
  let frame = {};
  for (let i = 0; i < conf.frame_size; ++i) {
    frame[i] = otp.generateEID(ik, 0, ts + i).eid;
  }
  return frame;
}

const updateEntity = function (entity) {
  return agile.idm.entity.setAttribute({
    entityType: entity.type.replace("/", ""),
    entityId: entity.id,
    attributeType: 'credentials.otp',
    attributeValue: entity.credentials.otp
  }).catch(err => {
    console.log("Could not set new frame for entity");
    console.log(err.statusCode, err.message);
  })
}

const authMiddleware = function (req, res, next) {
  const token = tokenParser(req);
  if (!token) {
    return res.status(401).send('Authentication failed: Please provide a token');

  }

  getEntities(conf.types).then(entities => {
    return entities.filter(entity => {
      if (entity.credentials && entity.credentials.otp && entity.credentials.otp.ik && entity.credentials.otp.ts) {
        let frame = getFrame(entity.credentials.otp.ik, parseInt(entity.credentials.otp.ts));
        entity.credentials.otp.frame = frame;
        let keys = Object.keys(frame);
        let foundKey = keys.filter(key => {
          return entity.credentials.otp.frame[key] === token
        })[0];
        if (foundKey) {
          entity.credentials.otp.ts = parseInt(entity.credentials.otp.ts) + parseInt(foundKey[0]) + 1;
          entity.credentials.otp.frame = getFrame(entity.credentials.otp.ik, parseInt(entity.credentials.otp.ts));
          return updateEntity(entity)
        } else {
          updateEntity(entity)
        }
      }
    })[0];
  }).then(entity => {
    if (entity) {
      //If everything is OK, add the clients' token to be able to proxy the request
      req.headers = {'authorization': 'Bearer ' + agile.tokenGet(), 'Content-Type': 'application/json'};
      next();
    } else {
      throw {status: 401, message: 'Invalid token'}
    }
  }).catch(err => {
    // forward the failed result to client
    if (err) {
      res.status(err.status).send(err.message)
    } else {
      next(err)
    }
  });
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
