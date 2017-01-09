'use strict';

var util = require('util');
var path = require('path');
var fs = require('fs');
var SQLite = require('sqlite3').verbose();
var Bot = require('slackbots');

var ParsleyBot = function Constructor(settings) {
  this.settings = settings;
  this.settings.name = this.settings.name || 'parsleybot';
  this.dbPath = settings.dbPath || path.resolve(process.cwd(), 'data', 'parsleybot.db');

  this.user = null;
  this.db = null;
};

util.inherits(ParsleyBot, Bot);

ParsleyBot.prototype.run = function () {
  ParsleyBot.super_.call(this, this.settings);

  this.on('start', this._onStart);
  this.on('message', this._onMessage);
};

ParsleyBot.prototype._onStart = function () {
  this._loadBotUser();
  this._connectDb();
  this._firstRunCheck();
};

ParsleyBot.prototype._onMessage = function (message) {
  if (this._isChatMessage(message) &&
    this._isChannelConversation(message) &&
    !this._isFromNorrisBot(message) &&
    this._isMentioningChuckNorris(message)
  ) {
    this._replyWithRandomJoke(message);
  }
};

ParsleyBot.prototype._replyWithRandomJoke = function (originalMessage) {
  var self = this;
  self.db.get('SELECT id, joke FROM jokes ORDER BY used ASC, RANDOM() LIMIT 1', function (err, record) {
    if (err) {
      return console.error('DATABASE ERROR:', err);
    }

    var channel = self._getChannelById(originalMessage.channel);
    self.postMessageToChannel(channel.name, record.joke, {asUser: true});
    self.db.run('UPDATE jokes SET used = used + 1 WHERE id = ?', record.id);
  });
};

ParsleyBot.prototype._loadBotUser = function () {
  var self = this;
  this.user = this.users.filter(function (user) {
    return user.name === self.name;
  })[0];
};

ParsleyBot.prototype._connectDb = function () {
  if (!fs.existsSync(this.dbPath)) {
    console.error('Database path ' + '"' + this.dbPath + '" does not exists or it\'s not readable.');
    process.exit(1);
  }

  this.db = new SQLite.Database(this.dbPath);
};

ParsleyBot.prototype._firstRunCheck = function () {
  var self = this;
  self.db.get('SELECT val FROM info WHERE name = "lastrun" LIMIT 1', function (err, record) {
    if (err) {
      return console.error('DATABASE ERROR:', err);
    }

    var currentTime = (new Date()).toJSON();

    // this is a first run
    if (!record) {
      self._welcomeMessage();
      return self.db.run('INSERT INTO info(name, val) VALUES("lastrun", ?)', currentTime);
    }

    // updates with new last running time
    self.db.run('UPDATE info SET val = ? WHERE name = "lastrun"', currentTime);
  });
};

ParsleyBot.prototype._welcomeMessage = function () {
  this.postMessageToChannel(this.channels[0].name, 'Hello World!' +
    '\n I\'m here to make obscure references and chew bubblegum... and I\'m all out of bubblegum. Just say `parsleyism` or `' + this.name + '` to invoke me!',
    {asUser: true});
};

ParsleyBot.prototype._isChatMessage = function (message) {
  return message.type === 'message' && Boolean(message.text);
};

ParsleyBot.prototype._isChannelConversation = function (message) {
  return typeof message.channel === 'string' &&
    message.channel[0] === 'C';
};

ParsleyBot.prototype._isMentioningParsleybot = function (message) {
  return message.text.toLowerCase().indexOf('parsleybot') > -1 ||
    message.text.toLowerCase().indexOf(this.name) > -1;
};

ParsleyBot.prototype._isFromParsleyBot = function (message) {
  return message.user === this.user.id;
};

ParsleyBot.prototype._getChannelById = function (channelId) {
  return this.channels.filter(function (item) {
    return item.id === channelId;
  })[0];
};

module.exports = ParsleyBot;
