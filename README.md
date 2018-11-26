# IsMyPowerOff

www.ismypoweroff.com

Services to register for an application that sends email notifications when the power goes out.

## power-checker-lambda

A lambda function that checks the power status of all accounts stored in the DynamoDB table and sends an email notification with SES if the power status has changed.

## registration-lambda

A lambda that registers accounts to the DynamoDB table used by power-checker-lambda. Built to be triggered by an API Gateway.

## registration-ui

Web application to provide UI for registration.
