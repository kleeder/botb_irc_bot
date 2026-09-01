var util = require('util');
if (typeof util.log !== 'function') {
	util.log = function() {
		const now = new Date().toISOString();
		console.log.apply(console, [now].concat(Array.from(arguments)));
	};
}

var irc = require('irc');
var config = require('./config.js');
var botb_api = require('./botb_api.js');

var bot;
var commands;
var default_retry_count = 9999;
var default_retry_delay = 10000;
var default_retry_delay_max = 300000;

var channel_blocks = {
	private_chat: {
		blocked: false,
		kudos_minus: false,
		kudos_plus: false,
		ultrachord: false,
	},
	main_chat: {
		blocked: false,
		// XXX merge these into identify
		botbrname: false,
		botbrpass: false,
		botbrsync: false,
		kudos_minus: false,
		kudos_plus: false,
		update_ip: false,
	}
};

var commands_aliases = {
	b: 'battle',
	batol: 'battle',
	chord: 'ultrachord',
	compo: 'battle',
	cxhb: 'cohb',
	dice: 'roll',
	g: 'google',
	gi: 'image',
	gif: 'giphy',
	h: 'help',
	i: 'imdb',
	images: 'image',
	img: 'imgur',
	imgr: 'imgur',
	l: 'lyceum',
	ohc: 'ohb',
	pic: 'pix',
	uc: 'ultrachord',
	up: 'uptime',
	w: 'wikipedia',
	wiki: 'wikipedia',
	xhb: 'ohb',
	y: 'youtube',
	yt: 'youtube',
};

var commands_alias_filters = {
	'kudos_minus': /^(.+)\-{2}$/i,
	'kudos_plus': /^(.+)\+{2}$/i,
};


var alias_check = command => {
	if (typeof commands_aliases[command] !== 'undefined')
		command = commands_aliases[command];
	return command;
};

var alias_filter_check = text => {
	for (let key in commands_alias_filters) {
		let filter = commands_alias_filters[key];
		if (filter.test(text)) return key;
	}
	return false;
};

var command_check = (channel_type, command) => {
	if (channel_blocks[channel_type][command] === false)
		return false;
	if (typeof commands[command] === 'undefined')
		return false;
	return true;
};

var command_parser = (from, to, text, info) => {
	let command = '';
	// break text into words
	let words = text.split(' ').filter(e => e !== '');
	if (words.length < 1) return false;
	// supplement info
	info.from = from;
	info.command_prefix = config.command_prefix;
	info.words = words;	
	// interpret solicitor
	let channel;
	if (to === config.bot_name) {
		console.log(`PM <${from}> ${text}`);
		channel = 'private_chat';
		info.channel = from;
		info.channel_type = channel;
	} 
	else if (config.irc.channels.indexOf(to) != -1) {
		console.log(`${to} <${from}> ${text}`);
		channel = 'main_chat';
		info.channel = info.args[0];
		info.channel_type = channel;
	}

	// check alias filters 
	// commands override
	if (words[0].substr(0, 1) !== config.command_prefix) {
		command = alias_filter_check(text);
		if (command !== false) commands[command](info, words);
		return;
	}

	// make sure there's a string to parse! :X
	if (typeof words[0] == 'undefined') return false;

	// check for command prefix
	if (words[0].substr(0, 1) !== config.command_prefix) {
		if (to === config.bot_name) {
			// XXX something is fukt here
			if (from === config.bot_name) {
				console.log('STOP MESSAGING YERSELF!!');
				return false;
			}
			info.channel = from;
			commands.unknown(info, words);
		}
		return false;
	}

	// remove command prefix
	command = words[0].substr(1);

	// abort if command is empty or non-alphabetic (likely an emoticon)
	if (command === '' || !command.match(/^[a-zA-Z]/))
		return false;

	// check if the command is an alias
	command = alias_check(command);

	// check channel's blocked commands
	if (command_check(channel, command) === false) {
		commands.blocked(info, words);
		console.log(`"${command}" in #${channel} blocked`);
		return false;
	}

	// check for command and call
	if (typeof commands[command] === "function") {
		try {
			let response = commands[command](info, words);
		} catch(err) {
			module.exports.say(info.channel, 'an error hath occured :X');
			console.log(err);
		}
	}
};


module.exports = {

	alias_check: command => {
		return alias_check(command);
	},

	alias_find: command => {
		let alias_list = [];
		for (alias in commands_aliases) {
			if (commands_aliases[alias] === command) {
				alias_list.push(alias);
			}
		}
		return alias_list;
	},

	command_check: (command, channel_type) => {
		return command_check(command, channel_type);
	},

	command_list: channel_type => {
		let command_list = [];
		for (command in commands) {
			if (command_check(channel_type, command)) {
				command_list.push(command);
			}
		}
		return command_list;
	},

	initialize: () => {
		bot = new irc.Client(config.irc.server, config.bot_name, {
			userName: config.bot_name.toLowerCase(),
			realName: config.bot_name + ' IRC bot',
			debug: config.irc.debug,
			autoRejoin: config.irc.autoRejoin,
			channels: config.irc.channels,
			retryCount: typeof config.irc.retryCount === 'number' ? config.irc.retryCount : default_retry_count,
			retryDelay: typeof config.irc.retryDelay === 'number' ? config.irc.retryDelay : default_retry_delay,
			retryDelayMax: typeof config.irc.retryDelayMax === 'number' ? config.irc.retryDelayMax : default_retry_delay_max
		});

		//commands.init(this)
		commands = require('./irc_commands.js');

		bot.addListener('error', message => {
			console.log(`IRC error:`);
			console.log(message);
		});
		bot.addListener('abort', function() {
			console.log('IRC connection aborted');
		});
		bot.addListener('netError', function(exception) {
			console.log('IRC network error:');
			console.log(exception);
		});
		bot.addListener('registered', message => {
			let nick = message && Array.isArray(message.args) ? message.args[0] : config.bot_name;
			console.log(`IRC connected as ${nick}`);
		});
		bot.addListener('join', (channel, who) => {
			console.log(`${who} has joined ${channel}`);
		});
		bot.addListener('part', (channel, who) => {
			console.log(`${who} has parted ${channel}`);
		});
		bot.addListener('quit', (channel, who) => {
			console.log(`${who} has quit ${channel}`);
		});
		bot.addListener('message', (from, to, text, info) => {
			// handle any attempted commands
			command_parser(from, to, text, info);
			// send message to potentional server loggings
			console.log(text);
			// XXX color codes are stuck in messages
//			var message = text.replace(/\u0003[0-9]+/g, '');
			var message = text;
			if (from !== 'botbd') message = '<' + from + '> ' + message;
			if (!config.irc.debug) {
				botb_api.post('battle/log_from_bot', 'message=' + encodeURIComponent(message)).catch(error => {
					console.log('failed to post message to API');
					console.log(error);
				});
			}
		});
	},

	say: (channel, text) => {
		function irc_push(channel, text) {
			text = `${config.irc.text_color} ${text}${config.irc.text_color} `;
			console.log(`${channel} <${config.bot_name}> ${text}`);
			bot.say(channel, text);
		}
		// is it an array?
		if (Array.isArray(text)) {
			text.forEach(line => {
				if (line.length > 0) irc_push(channel, line);
			});
			return;
		}
		// is it just text?
		irc_push(channel, text);
	}
};
