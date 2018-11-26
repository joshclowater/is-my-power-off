const AWS = require('aws-sdk');
const request = require('request');
AWS.config.update({ region: 'us-east-1' });
const docClient = new AWS.DynamoDB.DocumentClient();

const emailFrom = process.env.EMAIL_FROM;
const baseUrl = 'https://www.nbpower.com/Open/SearchOutageResults.aspx?lang=en&il=1';

exports.handler = (event, context, callback) => {
  try {
    docClient.scan({ TableName : 'PowerAccounts' }, (error, data) => {
      if (error) {
        console.error('[ERROR] Unable to query. Error:', error);
      } else {
        console.log('[DEBUG] Query succeeded.');
        data.Items.forEach((account) => {
          checkPower(account);
        });
      }
    });
  } catch (e) {
    console.error('[ERROR] An uncaught error occurred', e);
  }
};

const checkPower = ({ powerAccountId, email, accountNumber, accountPhoneNumber, powerOn: powerWasOn }) => {
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
  request(url, (error, response, html) => {
    if (!error && response.statusCode === 200) {
      let powerIsOn;
      if (html.includes('There are no reported outages at this time')) {
        powerIsOn = true;
      } else if (html.includes('The information provided does not match our records. Please try again.')) {
        console.error('[ERROR] Invalid account', email, accountNumber || accountPhoneNumber);
        return;
      } else {
        powerIsOn = false;
      }
      if ((powerIsOn && !powerWasOn) || (!powerIsOn && powerWasOn)) {
        const statusMessage = powerIsOn ? 'Power is on.' : 'Power is off!';
        console.log(`[INFO] power status changed for ${email}: ${statusMessage} Setting updated status, then sending email notification.`);
        updatePowerIsOn(powerAccountId, powerIsOn, () => {
          sendEmail(email, statusMessage, `${statusMessage}: ${url}`);
        });
      } else {
        console.log(`[INFO] power status is the same for ${email}: ${statusMessage}`);
      }
    } else {
      console.error('[ERROR] An error occurred fetching the URL:', error, response.statusCode);
    }
  });
};

const updatePowerIsOn = (powerAccountId, powerOn, onSuccess) => {
  var params = {
    TableName: 'PowerAccounts',
    Key: {
      powerAccountId
    },
    UpdateExpression: 'set powerOn = :p',
    ExpressionAttributeValues:{
      ':p': powerOn,
    },
    ReturnValues:'UPDATED_NEW'
  };
  docClient.update(params, (error, data) => {
    if (error) {
      console.error('[ERROR] Unable to update item:', error);
    } else {
      console.log('[DEBUG] Update succeeded:', data);
      onSuccess && onSuccess();
    }
  });
};

const sendEmail = (emailTo, subject, message) => {
  console.log('[DEBUG] sendEmail()', emailTo, emailFrom, message);
  const params = {
    Destination: { /* required */
      // CcAddresses: [
      //   /* more items */
      // ],
      ToAddresses: [
        emailTo,
        /* more items */
      ]
    },
    Message: { /* required */
      Body: { /* required */
        // Html: {
        //  Charset: 'UTF-8',
        //  Data: 'HTML_FORMAT_BODY'
        // },
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
    Source: emailFrom, /* required */
    // ReplyToAddresses: [
    //     'EMAIL_ADDRESS',
    //   /* more items */
    // ],
  };

  new AWS.SES({ apiVersion: '2010-12-01' })
    .sendEmail(params)
    .promise()
    .then((data) => {
      console.log('[DEBUG] Email sent', emailTo, data.MessageId);
    })
    .catch((error) => {
      console.error('[ERROR] Error sending email', emailTo, error);
    });
};
