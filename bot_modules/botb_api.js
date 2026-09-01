var botb_api_root = 'https://battleofthebits.com/api/v1/';

function normalizeRequestPath(request_url) {
	return request_url.replace(/ /g, '+');
}

function parseJsonResponse(text, request_url) {
	try {
		return JSON.parse(text);
	}
	catch (error) {
		throw new Error(`Failed to parse API response for ${request_url}`);
	}
}

module.exports = {

	request: request_url => {
		request_url = normalizeRequestPath(request_url);
		const url = botb_api_root + request_url;
		console.log('API Request: ' + url);
		return fetch(url, {
			method: 'GET',
			headers: {
				'User-Agent': 'botb-irc-bot'
			}
		}).then(async response => {
			console.log('stat : ' + response.status);
			const body = await response.text();
			if (!response.ok) {
				throw new Error(`API request failed with status ${response.status}`);
			}
			return parseJsonResponse(body, request_url);
		});
	},

	post: (request_url, body) => {
		// XXX does not currently handle returns
		request_url = normalizeRequestPath(request_url);
		const url = botb_api_root + request_url;
		console.log('API POST: ' + url);
		return fetch(url, {
			method: 'POST',
			headers: {
				'User-Agent': 'botb-irc-bot',
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			body: body
		}).then(async response => {
			console.log('stat : ' + response.status);
			const responseBody = await response.text();
			if (!response.ok) {
				throw new Error(`API POST failed with status ${response.status}`);
			}
			return parseJsonResponse(responseBody, request_url);
		});
	},


};
