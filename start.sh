#!/bin/bash
if [ $NODE_ENV == "TEST" ]
then
  npm run test
else
  cd src/otp
  sudo node-gyp configure
  sudo node-gyp build
  npm start
fi
