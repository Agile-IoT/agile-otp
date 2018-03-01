# AGILE-OTP
This module acts as a proxy for requests to other AGILE modules, while checking for validity of one-time-passwords (OTP) for a specified entity on each request.

## Install and run
    npm install
    sudo sh start.sh

## Example query in AGILE-OTP:
    #Add new user
    curl -H "Authorization: bearer $TOKEN"  -H "Content-type: application/json" -X POST -d '{"user_name":"alice", "auth_type":"agile-local"}' 'http://agilegw.local:1400/agile-security/api/v1/user/'
$TOKEN must be set to a valid OTP on each request. AGILE-OTP will check if there is an entity that has the token in its token frame (e.g. next ten token) in its credentials attribute (credentials.otp). It is necessary to make sure that the entity has an identity key and a timestamp ('credentials.otp.ik' and 'credentials.otp.ts'), which are used to calculate the OTPs. If this is the case, the request will be proxied to the service specified after the host (e.g. agile-security).
Otherwise the request will be rejected with an error code (400, 401 or 404) and an error message.

## To integrate the AGILE-OTP in a stack, add the following to docker-compose.yml

    agile-otp:
      container_name: agile-otp
      image: agileiot/agile-otp-$AGILE_ARCH:v0.0.1
      hostname: agile-otp
      restart: always
      depends_on:
        - agile-security
        - agile-core
      environment:
        - NODE_ENV=production
      volumes:
        - $DATA/agile-otp/:/etc/agile-otp/
      ports:
        - 1400:1400/tcp

The container will include the configuration files in $DATA (e.g. ~/.agile/) or copy the default configuration to this folder, if there is non existing yet. After the first run, it is possible to edit the default configuration file, which will be loaded on each startup.