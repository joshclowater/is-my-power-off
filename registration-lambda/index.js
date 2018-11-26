const AWS = require('aws-sdk');
const request = require('request-promise');
AWS.config.update({ region: 'us-east-1' });
const ddb = new AWS.DynamoDB({ apiVersion: '2012-10-08' });

const emailFrom = process.env.EMAIL_FROM;
const baseUrl = 'https://www.nbpower.com/Open/SearchOutageResults.aspx?lang=en&il=1';
const emailRegex = /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/;

exports.handler = async (event, context, callback) => {
  const errors = [];
  console.log('[INFO] Request received. Body:', event.body);
  const { powerSupplier, accountPhoneNumber, accountNumber, email } = JSON.parse(event.body);
  if (powerSupplier === 'NB_POWER') {
    if (accountNumber || accountPhoneNumber) {
      const errorFromUrlCheck = await checkWithUrl(accountNumber, accountPhoneNumber);
      if (errorFromUrlCheck) {
        errors.push(errorFromUrlCheck);
      }
    } else {
      errors.push('accountNumber or accountPhoneNumber are required');
    }
  } else {
    errors.push(`Invalid power supplier: ${powerSupplier}`);
  }
  if (!emailRegex.test(email)) {
    errors.push(`Invalid email format: ${email}`);
  }
  if (errors.length === 0) {
    const params = {
      TableName: 'PowerAccounts',
      Item: {
        powerAccountId : { S: Math.random().toString() },
        email: { S: email },
        powerOn: { BOOL: true }
      }
    };
    if (accountPhoneNumber) {
      params.Item.accountPhoneNumber = { S: accountPhoneNumber };
    }
    if (accountNumber) {
      params.Item.accountNumber = { S: accountNumber };
    }
    try {
      await ddb.putItem(params).promise();
    } catch (e) {
      console.log('[ERROR] Could not save record to database', e);
      errors.push('An error occurred saving the record to the database');
    }
  }
  let response;
  if (errors.length === 0) {
    response = {
      statusCode: 200,
      body: JSON.stringify({status: 'success'})
    };
  } else {
    response = {
      statusCode: 400,
      body: JSON.stringify(errors)
    };
  }
  response.headers = {
    "Access-Control-Allow-Origin" : "*", // Required for CORS support to work
    "Access-Control-Allow-Credentials" : true // Required for cookies, authorization headers with HTTPS
  };
  console.log('[INFO] response', response);
  callback(null, response);
};

const checkWithUrl = async (accountNumber, accountPhoneNumber) => {
  let url;
  if (accountNumber) {
    url = `${baseUrl}&acc=${accountNumber}`;
  } else if (accountPhoneNumber) {
    url = `${baseUrl}&phone=${accountPhoneNumber}`;
  } else {
    console.error('[ERROR] Neither accountNumber nor accountPhoneNumber supplied');
  }
  return request({ uri: url, resolveWithFullResponse: true })
    .then(({ statusCode, body }) => {
      if (statusCode !== 200) {
        return `An error occured trying to reach nbpower.com. Received status code: ${statusCode}`;
      } else if (body.includes('The information provided does not match our records')) {
        return 'The phone number/account number do not match an NBPower record. Please verify they are correct.';
      }
    })
    .catch(() => {
      return 'An error occured trying to reach nbpower.com';
    });
};
