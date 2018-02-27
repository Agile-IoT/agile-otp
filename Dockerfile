FROM resin/raspberry-pi3-node:7.8.0-20170426

ARG NODE_ENV=prod

WORKDIR /usr/src/app

COPY package.json package.json

COPY ./src/otp/ ./
# This will copy all files in our root to the working  directory in the container
COPY . ./

RUN if [ -f "build" ]; then rm -rf build; fi
RUN if [ -f "node_modules" ]; then rm -rf node_modules; fi

# This install npm dependencies on the resin.io build server,
# making sure to clean up the artifacts it creates in order to reduce the image size.
RUN JOBS=MAX npm install

EXPOSE 1400

ENV INIT_SYSTEM on

CMD ["bash", "start.sh"]
