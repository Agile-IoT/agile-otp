FROM resin/raspberry-pi3-node:7.8.0-20170426

ARG NODE_ENV=prod

WORKDIR /usr/src/app

COPY package.json package.json
COPY ./src/otp/ ./
# This install npm dependencies on the resin.io build server,
# making sure to clean up the artifacts it creates in order to reduce the image size.

RUN JOBS=MAX npm install

# This will copy all files in our root to the working  directory in the container
COPY . ./

EXPOSE 1400

ENV INIT_SYSTEM on

CMD ["bash", "start.sh"]
