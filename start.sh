#!/bin/bash
CONF=/etc/agile-otp

echo "checking if configuration is in folder $CONF"
if [ ! -f "$CONF/agile-otp.js" ]; then
  echo "folder not there for conf"
  cp -r conf/* $CONF
fi

echo "here comes the current config"
#cat "$CONF/agile-otp.js"
echo "end of the current config"

if [ $NODE_ENV == "TEST" ]
then
  npm run test
else
  npm start
fi
