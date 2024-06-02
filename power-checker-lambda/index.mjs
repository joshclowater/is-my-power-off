import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const sesClient = new SESClient({ region: 'us-east-1' });

const emailFrom = process.env.EMAIL_FROM;
const baseUrl = 'https://www.nbpower.com/Open/SearchOutageResults.aspx?lang=en&il=1';

export const handler = async (_event, _context) => {
  try {
    const scanParams = {
      TableName: 'PowerAccounts'
    };
    const data = await docClient.send(new ScanCommand(scanParams));
    console.log('[DEBUG] Query succeeded.', { result: data.Items });
    for (const account of data.Items) {
      await checkPower(account);
    }
  } catch (e) {
    console.error('[ERROR] An uncaught error occurred', e);
  }
};

const checkPower = async ({ powerAccountId, email, accountNumber, accountPhoneNumber, powerOn: powerWasOn }) => {
  let url;
  if (accountNumber) {
    url = `${baseUrl}&acc=${accountNumber}`;
    console.log('[DEBUG] Checking power for account number:', url);
  } else if (accountPhoneNumber) {
    url = `${baseUrl}&phone=${accountPhoneNumber}`;
    console.log('[DEBUG] Checking power for account phone number:', url);
  } else {
    console.error('[ERROR] Neither accountNumber nor accountPhoneNumber supplied for:', email);
    return;
  }

  try {
    const response = await fetch(url);
    const html = await response.text();
    if (response.ok) {
      let powerIsOn = html.includes('There are no reported outages at this time');
      if (html.includes('The information provided does not match our records. Please try again.')) {
        console.error('[ERROR] Invalid account', email, accountNumber || accountPhoneNumber);
        return;
      }
      if (html.includes('unavailable due to system maintenance')) {
        console.warn('[WARN] Outage management system unavailable due to system maintenance.');
        return;
      }
      const statusMessage = powerIsOn ? 'Power is on.' : 'Power is off!';
      if ((powerIsOn && !powerWasOn) || (!powerIsOn && powerWasOn)) {
        console.log(`[INFO] Power status changed for ${email}: ${statusMessage} Setting updated status, then sending email notification.`);
        await updatePowerIsOn(powerAccountId, powerIsOn);
        await sendEmail(email, statusMessage, `${statusMessage}: ${url}`);
      } else {
        console.log(`[INFO] Power status is the same for ${email}: ${statusMessage}`);
      }
    } else {
      console.error('[ERROR] An error occurred fetching the URL:', response.status);
    }
  } catch (error) {
    console.error('[ERROR] An error occurred:', error);
  }
};

const updatePowerIsOn = async (powerAccountId, powerOn) => {
  const params = {
    TableName: 'PowerAccounts',
    Key: { powerAccountId },
    UpdateExpression: 'set powerOn = :p',
    ExpressionAttributeValues: {
      ':p': powerOn
    },
    ReturnValues: 'UPDATED_NEW'
  };
  try {
    const data = await docClient.send(new UpdateCommand(params));
    console.log('[DEBUG] Update succeeded:', data);
  } catch (error) {
    console.error('[ERROR] Unable to update item:', error);
  }
};

const sendEmail = async (emailTo, subject, message) => {
  const params = {
    Destination: {
      ToAddresses: [emailTo]
    },
    Message: {
      Body: {
        Text: {
          Charset: 'UTF-8',
          Data: message
        }
      },
      Subject: {
        Charset: 'UTF-8',
        Data: subject
      }
    },
    Source: emailFrom
  };

  try {
    const { MessageId } = await sesClient.send(new SendEmailCommand(params));
    console.log('[INFO] Email sent', emailTo, MessageId);
  } catch (error) {
    console.error('[ERROR] Error sending email', emailTo, error);
  }
};
