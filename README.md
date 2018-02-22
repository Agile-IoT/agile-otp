# AGILE-OTP
This module acts as a proxy for requests to other AGILE modules, while checking for validity of one-time-passwords (OTP) for a specified entity on each request.

## Install and run
    npm install
    sudo sh start.sh

## Example query in AGILE-OTP:
    #Add new user
    curl -H "entityname: agile" -H "authtype: agile-local" -H "entitytype: user" -H "Authorization: bearer $TOKEN"  -H "Content-type: application/json" -X POST -d '{"user_name":"alice", "auth_type":"agile-local"}' 'http://agilegw.local:1400/agile-security/api/v1/user/'
$TOKEN must be set to a valid OTP on each request. AGILE-OTP will check if the OTP is valid for an entity (determined by entityname + authtype + entitytype). 
If this is the case, the request will be proxied to the service specified after the host (e.g. agile-security).
Otherwise the request will be rejected with an error code (400, 401 or 404) and an error message.
