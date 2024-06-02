import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const nbPowerBaseUrl = 'https://www.nbpower.com/Open/SearchOutageResults.aspx?lang=en&il=1';
const emailRegex = /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/;

export async function handler(event, _context) {
  const errors = [];
  console.log('[INFO] Request received. Body:', event.body);
  const { powerSupplier, accountPhoneNumber, accountNumber, email } = JSON.parse(event.body);

  if (powerSupplier === 'NB_POWER') {
    if (accountNumber || accountPhoneNumber) {
      const errorFromUrlCheck = await validateAccount(accountNumber, accountPhoneNumber);
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
    const item = {
      powerAccountId: Math.random().toString(),
      email,
      powerOn: true,
      ...(accountPhoneNumber && { accountPhoneNumber }),
      ...(accountNumber && { accountNumber })
    };

    try {
      await docClient.send(new PutCommand({
        TableName: 'PowerAccounts',
        Item: item
      }));
    } catch (e) {
      console.log('[ERROR] Could not save record to database', e);
      errors.push('An error occurred saving the record to the database');
    }
  }

  let response;
  if (errors.length === 0) {
    response = {
      statusCode: 200,
      body: JSON.stringify({ status: 'success' })
    };
  } else {
    response = {
      statusCode: 400,
      body: JSON.stringify(errors)
    };
  }

  response.headers = {
    'Access-Control-Allow-Origin': '*', // Required for CORS support to work
    'Access-Control-Allow-Credentials': true // Required for cookies, authorization headers with HTTPS
  };

  console.log('[INFO] response', response);
  return response;
};

async function validateAccount(accountNumber, accountPhoneNumber) {
  let url;
  if (accountNumber) {
    url = `${nbPowerBaseUrl}&acc=${accountNumber}`;
  } else if (accountPhoneNumber) {
    url = `${nbPowerBaseUrl}&phone=${accountPhoneNumber}`;
  } else {
    console.error('[ERROR] Neither accountNumber nor accountPhoneNumber supplied');
    return;
  }

  try {
    const response = await fetch(url);
    const body = await response.text();
    if (response.status !== 200) {
      return `An error occurred trying to reach nbpower.com. Received status code: ${response.status}`;
    } else if (body.includes('The information provided does not match our records')) {
      return 'The phone number/account number do not match an NBPower record. Please verify they are correct.';
    }
  } catch (error) {
    return 'An error occurred trying to reach nbpower.com';
  }
};
