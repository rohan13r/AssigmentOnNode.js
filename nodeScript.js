const { google } = require('googleapis');
const fs = require('fs');
const readline = require('readline');

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const SCOPES = ['https://www.googleapis.com/auth/gmail.modify'];

// Wrap the code in a try-catch block to handle exceptions
(async () => {
  try {
    // Load client secrets from a local file.
    const content = await fs.promises.readFile('credentials.json');
    await authorize(JSON.parse(content), startGmailAPI);
  } catch (error) {
    console.log('Error loading client secret file:', error);
  }
})();

async function authorize(credentials, callback) {
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  try {
    // Check if we have previously stored a token.
    const token = await fs.promises.readFile('token.json');
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  } catch (error) {
    await getAccessToken(oAuth2Client, callback);
  }
}

async function getAccessToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question('Enter the code from that page here: ', async (code) => {
    rl.close();
    try {
      const { tokens } = await oAuth2Client.getToken(code);
      oAuth2Client.setCredentials(tokens);
      // Store the token to disk for later program executions
      await fs.promises.writeFile('token.json', JSON.stringify(tokens));
      callback(oAuth2Client);
    } catch (error) {
      console.error('Error retrieving access token', error);
    }
  });
}

async function startGmailAPI(auth) {
  const gmail = google.gmail({ version: 'v1', auth });

  setInterval(async () => {
    checkEmails(gmail);
  }, getRandomInt(45000, 120000));
}

async function checkEmails(gmail) {
  try {
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:inbox -category:promotions -category:social -category:updates -category:forums'
    });

    const messages = response.data.messages;
    if (messages) {
      for (const message of messages) {
        const messageData = await gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'full'
        });

        const headers = messageData.data.payload.headers;
        const threadId = messageData.data.threadId;
        const isInReplyToHeader = headers.find((header) => header.name.toLowerCase() === 'in-reply-to');
        
        if (!isInReplyToHeader) {
          await sendReply(gmail, threadId);
        }
      }
    }
  } catch (error) {
    console.error('Error checking emails:', error);
  }
}

async function sendReply(gmail, threadId) {
  try {
    await gmail.users.threads.modify({
      userId: 'me',
      id: threadId,
      requestBody: {
        addLabelIds: ['REPLIED'],
        removeLabelIds: ['INBOX']
      }
    });

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        threadId: threadId,
        raw: 'From: rohande284@gmail.com\r\nTo: rohande20032003@example.com\r\nSubject: Re: Vacation Auto-Reply\r\n\r\nThank you for your email. I am currently out of the office on vacation and will reply to your message as soon as possible. Best regards, Rohan De'
      }
    });

    console.log('Auto-reply sent and labels applied.');
  } catch (error) {
    console.error('Error sending reply:', error);
  }
}
