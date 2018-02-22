# AGILE-OTP
This module acts as a proxy for requests to other AGILE modules, while checking for validity of one-time-passwords (OTP) for a specified entity on each request.

To query AGILE-OTP the following command can be used:
    curl -H "Content-type: application/json" -H "Authorization: bearer $TOKEN" -X POST -d '{"id":"agile!@!agile-local", "type":"user"}' 'http://agilegw.local:1400/agile-core'
$TOKEN must be set to a valid OTP on each request.