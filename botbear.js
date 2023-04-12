const tmi = require('tmi.js');
const axios = require('axios');
const _ = require('underscore');
const mysql = require('mysql2');
const got = require('got');

// Define configuration options
const opts = {
  identity: {
    username: "botbear1110",
    password: "[REDACTED]"
  },
  channels: [
    "nymn", "hotbear1110", "atoxiv", "nymn2", "smuuuuuuuuurf", "nani"
  ]
};

// Create a client with our options
const client = new tmi.client(opts);
let nymnlive = 0;
let nymnlive2 = 0;


// Register our event handlers (defined below)
client.on('message', onMessageHandler);
client.on('connected', onConnectedHandler);

// Connect to Twitch:
client.connect();


//require('./notify.js')
const connection = mysql.createConnection({
  host: '[REDACTED]',
  user: '[REDACTED]',
  password: '[REDACTED]',
  database: '[REDACTED]'
});

const query = (query, data = []) =>
  new Promise((resolve, reject) => {
    connection.execute(mysql.format(query, data), async (err, results) => {
      if (err) {
        console.log(query, "\n//\n", err);
        reject(err);
      } else {
        resolve(results);
      }
    });
  });


const banphrasePass = (message, channel) => new Promise(async (resolve, reject) => {
  this.channel = channel.replace("#", '')
  this.data = await query(`
    SELECT banphraseapi
    FROM Streamers
    WHERE username=?`,
    [this.channel]);
  console.log(this.data[0].banphraseapi)
  if (this.data[0].banphraseapi === null) {
    resolve(0);
    return;
  }
  this.checkBanphrase = await got(this.data[0].banphraseapi, {
    method: "POST",
    body: "message=" + message,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
  }).json();
  resolve(this.checkBanphrase);

});


const hasCooldown = new Set();

class Cooldown {
  constructor(context, command) {
    this.userId = context['user-id'];
    this.command = command;
    this.key = `${this.userId}_${this.command}`;
  }

  async cooldownReduction() {
    const cooldown = 5000;

    return cooldown;
  }

  // command cooldown
  async setCooldown() {
    if (this.userId === "135186096") { return [] }; // Your user ID

    if (hasCooldown.has(this.key)) { return [this.key]; }

    hasCooldown.add(this.key);

    setTimeout(() => {
      hasCooldown.delete(this.key);
    }, await this.cooldownReduction());
    return [];
  }
}



setInterval(function () {

  connection.query('SELECT * FROM Streamers',
    function (err, results, fields) {
      const streamList = results;

      _.each(streamList, async function (stream) {
        await axios.get(`https://api.twitch.tv/helix/streams?user_login=${stream.username}`, {
          headers: {
            'client-id': '[REDACTED]',
            'Authorization': 'Bearer [REDACTED]'
          }
        })
          .then(function (response) {
            // handle success
            const twitchdata = response.data;
            let users = JSON.parse(stream.ping_users)
            if (twitchdata['data'].length !== 0 && stream.islive == 0) {
              client.action(`#${stream.username}`, `${stream.liveemote} ${stream.username} IS NOW LIVE ${stream.liveemote} ${users.toString().replaceAll(',', ' ')}`);
              console.log(stream.username + " IS NOW LIVE");
              connection.query(`UPDATE Streamers SET islive = 1 WHERE username = "${stream.username}"`)
            };
            if (twitchdata['data'].length === 0 && stream.islive == 1) {
              client.action(`#${stream.username}`, `${stream.offlineemote} ${stream.username} IS NOW OFFLINE ${stream.offlineemote} ${users.toString().replaceAll(',', ' ')}`);
              console.log(stream.username + " IS NOW OFFLINE");
              connection.query(`UPDATE Streamers SET islive = 0 WHERE username ="${stream.username}"`)
            };
          })
          .catch(function (error) {
            // handle error
            console.log(error);
          })
          .then(function () {
            // always executed
          });
      })
    })

}, 10000)

// Called every time a message comes in
async function onMessageHandler(target, context, msg, self) {
  if (self) { return; } // Ignore messages from the bot

  // Remove whitespace from chat message
  const commandName = msg.trim();
  let input = msg.split(" ");

  if (commandName === "!ping") {
    const userCD = new Cooldown(context, "!ping");

    if ((await userCD.setCooldown()).length) { return; }

    client.say(target, `${context.username} FeelsDankMan pong`)
  }

  if (commandName === "!notify live") {
    const testPhrase = await banphrasePass(context.username, target);

    if (testPhrase.banned) {
      client.say(target, `${context.username}, [Banphrased Username] cmonBruh `);
      return;
    }

    const userCD = new Cooldown(context, "!notify live");

    if ((await userCD.setCooldown()).length) { return; }
    connection.query(`SELECT * FROM Streamers WHERE username="${target.substring(1)}"`,
      function (err, results, fields) {
        let users = JSON.parse(results[0].ping_users)

        if (users.includes(context.username)) {
          client.say(target, `${context.username}, You already have a subscription for the event "live". If you want to unsubscribe, type "!removeme live". `)
        }
        else {
          users.push(context.username)
          users = JSON.stringify(users)

          connection.query(`UPDATE Streamers SET ping_users=? WHERE username=?`, [users, target.substring(1)])

          client.say(target, `${context.username}, You are now subscribed to the event "live"`)
        }

      }
    )
  };

  if (commandName === "!remove live") {
    const userCD = new Cooldown(context, "!remove live");

    if ((await userCD.setCooldown()).length) { return; }
    connection.query(`SELECT * FROM Streamers WHERE username="${target.substring(1)}"`,
      function (err, results, fields) {
        let users = JSON.parse(results[0].ping_users)

        if (users.includes(context.username)) {
          users.splice(users.indexOf(context.username), 1);
          users = JSON.stringify(users)

          connection.query(`UPDATE Streamers SET ping_users=? WHERE username=?`, [users, target.substring(1)])

          client.say(target, `${context.username}, You are now unsubscribed from the event "live"`)
        }
        else {
          client.say(target, `${context.username}, You do not have a subscription for the event "live". If you want to subscribe, type "!notifyme live". `)
        }

      }
    )
  };

  if (context.username === "hotbear1110" && commandName.startsWith("``say ")) {
    client.say(target, commandName.replace(/^([^ ]+ ){1}/, ''));
  }

  if (context.username === "hotbear1110" && commandName.startsWith("``channel ")) {
    client.say(input[1], commandName.replace(/^([^ ]+ ){2}/, ''));
  }

  if (commandName === "!notify") {
    const userCD = new Cooldown(context, "!notify");

    if ((await userCD.setCooldown()).length) { return; }


    client.say(target, `${context.username}, Please specify an event to subscribe to. The following events are available: live (might add more stuff later) `)

  }
  if (commandName.startsWith("``")) {
    const userCD = new Cooldown(context, "``");

    if ((await userCD.setCooldown()).length) { return; }

    let fullcommand = commandName;
    let inputCommand = fullcommand.substring(2);

    connection.query(`SELECT * FROM Commands`,
      function (err, results, fields) {
        const commandList = results;
        let inlist = 0;

        _.each(commandList, async function (commando) {
          if (inputCommand === commando.Name) {
            inlist = 1;
          }
          if (inlist === 1) {
            client.say(target, commando.Command);
            inlist = 0;
          }
        })


      })

  }
}





// Called every time the bot connects to Twitch chat
function onConnectedHandler(addr, port) {
  console.log(`* Connected to ${addr}:${port}`);
}