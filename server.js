'use strict'

const express = require('express')
const Slapp = require('slapp')
const ConvoStore = require('slapp-convo-beepboop')
const Context = require('slapp-context-beepboop')

// use `PORT` env var on Beep Boop - default to 3000 locally
var port = process.env.PORT || 3000

var slapp = Slapp({
  // Beep Boop sets the SLACK_VERIFY_TOKEN env var
  verify_token: process.env.SLACK_VERIFY_TOKEN,
  convo_store: ConvoStore(),
  context: Context()
})


var HELP_TEXT = `
I will respond to the following messages:
\`help\` - to see this message.
\`hi\` - to demonstrate a conversation that tracks state.
\`thanks\` - to demonstrate a simple response.
\`<type-any-other-text>\` - to demonstrate a random emoticon response, some of the time :wink:.
\`attachment\` - to see a Slack attachment message.
`

//*********************************************
// Setup different handlers for messages
//*********************************************

// response to the user typing "help"
slapp.message('help', ['mention', 'direct_message'], (msg) => {
  msg.say(HELP_TEXT)
})

// "Conversation" flow that tracks state - kicks off when user says hi, hello or hey
slapp
  .message('^(hi|hello|hey)$', ['direct_mention', 'direct_message'], (msg, text) => {
    msg
      .say(`${text}, how are you?`)
      // sends next event from user to this route, passing along state
      .route('how-are-you', { greeting: text })
  })
  .route('how-are-you', (msg, state) => {
    var text = (msg.body.event && msg.body.event.text) || ''

    // user may not have typed text as their next action, ask again and re-route
    if (!text) {
      return msg
        .say("Whoops, I'm still waiting to hear how you're doing.")
        .say('How are you?')
        .route('how-are-you', state)
    }

    // add their response to state
    state.status = text

    msg
      .say(`Ok then. What's your favorite color?`)
      .route('color', state)
  })
  .route('color', (msg, state) => {
    var text = (msg.body.event && msg.body.event.text) || ''

    // user may not have typed text as their next action, ask again and re-route
    if (!text) {
      return msg
        .say("I'm eagerly awaiting to hear your favorite color.")
        .route('color', state)
    }

    // add their response to state
    state.color = text

    msg
      .say('Thanks for sharing.')
      .say(`Here's what you've told me so far: \`\`\`${JSON.stringify(state)}\`\`\``)
    // At this point, since we don't route anywhere, the "conversation" is over
  })

// Can use a regex as well
slapp.message(/^(thanks|thank you)/i, ['mention', 'direct_message'], (msg) => {
  // You can provide a list of responses, and a random one will be chosen
  // You can also include slack emoji in your responses
  msg.say([
    "You're welcome :smile:",
    'You bet',
    ':+1: Of course',
    'Anytime :sun_with_face: :full_moon_with_face:'
  ])
})

// demonstrate returning an attachment...
slapp.message('attachment', ['mention', 'direct_message'], (msg) => {
  msg.say({
    text: 'Check out this amazing attachment! :confetti_ball: ',
    attachments: [{
      text: 'Slapp is a robust open source library that sits on top of the Slack APIs',
      title: 'Slapp Library - Open Source',
      image_url: 'https://storage.googleapis.com/beepboophq/_assets/bot-1.22f6fb.png',
      title_link: 'https://devoffuture.slack.com/files/sdmg15/F2HVBAZJR/Guide_of_new_user',
      color: '#7CD197'
    }]
  })
})

// listen for message and subtype channel_join
slapp.match((msg) => {
  if (!msg.isMessage() || msg.body.event.subtype !== 'channel_join') {
    return false
  }
  isChannel('general', msg, (err, yes) => {
    if (err) return console.log('Error looking for general channel', err)
    if (yes) {
      msg.say({
    text: `Welcome <@${msg.meta.user_id}> to the team ! Here is a guide to help you start \nhttps://devoffuture.slack.com/files/sdmg15/F2G00CFM3/Guide_du_nouveau or \nhttps://devoffuture.slack.com/files/sdmg15/F2HVBAZJR/Guide_of_new_user`,
    unfurl_links: true,
    unfurl_media: true
        
      })
    }
  })
  return true
})

// cache channel name <--> channel Id
// channelNameCache[name][teamID]
var channelNameCache = {}

// is the current message from the named channel
function isChannel(name, msg, callback) {
  let teamId = msg.meta.team_id
  let channelId = msg.meta.channel_id
  if (!channelNameCache[name]) channelNameCache[name] = {}

  // check for the mapping in cache and if this is the named channel
  if (channelId === channelNameCache[name][teamId]) {
    return callback(null, true)
  }

  // the value is not cached, so fetch the list of teams
  slapp.client.channels.list({ token: msg.meta.bot_token }, (err, result) => {
    if (err) return callback(err)
    result.channels.some((channel) => {
      if (channel.name === name) {
        channelNameCache[name][teamId] = channel.id
        // short circuit some loop by returning true
        return true
      }
    })

    if (msg.meta.channel_id === channelNameCache[name][teamId]) {
      return callback(null, true)
    }
    callback(null, false)
  })
}


// Catch-all for any other responses not handled above
slapp.message('.*', ['direct_mention', 'direct_message'], (msg) => {
  // respond only 40% of the time
  if (Math.random() < 0.4) {
    msg.say([':wave:', ':pray:', ':raised_hands:'])
  }
})

// attach Slapp to express server
var server = slapp.attachToExpress(express())

// start http server
server.listen(port, (err) => {
  if (err) {
    return console.error(err)
  }

  console.log(`Listening on port ${port}`)
})
