var config = require('./config.js');
var http = require('http');
var bot = require('./irc_bot.js');
var alerts = require('./irc_alerts.js');

var commands = {

	say: message => {
		alerts.setXHBTimeouts(); // update XHB alerts
		console.log('SAY FROM SITE :: ' + message);
		bot.say(config.irc.channels[0], message);
		return 'the bot speaks!';
	},

};

var post_handler = (request, response) => {
	return new Promise((resolve, reject) => {
		let post_data = '';
		request.on('data', data => {
			console.log(data);
			post_data += data;
			if (post_data.length > 1000000) {
				respond(response, 413, 'text/plain', 'TOO MUCH DATA!  D:');
				request.destroy();
				reject(new Error('request payload exceeded 1MB'));
				return;
			}
		});
		request.on('end', () => {
			resolve(post_data);
		});
		request.on('error', error => {
			reject(error);
		});
	});
};

var respond = (response, code, content, message) => {
	response.writeHead(code, {
		'Content-Type': content
	});
	response.end(message + '\n');
};


module.exports = {

	initialize: () => {
		// wait until bot joins IRC, hopefully it's done so in 30 seconds
		setTimeout(alerts.setXHBTimeouts, 30000);
		setInterval(alerts.setXHBTimeouts, 5 * 60 * 1000);

		http.createServer((request, response) => {
			console.log(`SERVER REQUEST ::  ${request.method} ${request.url}`);
			if (request.method == 'POST') {
				let p = post_handler(request, response);
				p.then(data => {
					let parsedData;
					try {
						parsedData = JSON.parse(data);
					}
					catch (error) {
						respond(response, 400, 'text/plain', 'invalid json payload');
						return;
					}
					let rtype = 200;
					let rtext = '';
					// check for valid key
					if (parsedData.key != config.http.key) {
						console.log('BAD KEY');
						rtype = 403;
						rtext = 'invalid access key';
					}
					else if (typeof commands[parsedData.command] === 'function') {
						console.log('run command: ' + parsedData.command);
						rtext = commands[parsedData.command](parsedData.message);
					}
					else {
						rtype = 400;
						rtext = 'unknown command';
					}
					respond(response, rtype, 'text/plain', rtext);
					return;
				}).catch(error => {
					if (!response.writableEnded) {
						respond(response, 500, 'text/plain', 'request handling error');
					}
					console.log(error);
				});
			} else {
				respond(response, 500, 'text/plain', 'must post data');
			}
		}).listen(config.http.port, config.http.ip, () => {
			console.log(`Server running at ${config.http.ip}:${config.http.port}`);
		});
	}

};
