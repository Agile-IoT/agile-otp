#!/bin/bash
if [ $NODE_ENV == "TEST" ]
then
  npm run test
else
  npm start
fi
