const Discord = require('discord.js');
const fs = require('fs');
const fetch = require('node-fetch');
const client = new Discord.Client();
const { MessageAttachment } = require('discord.js');

let fflogsApiKey;

fs.readFile('./fflogs_api_key', 'utf8' , (err, apiKey) => {
	if (err) {
	  console.error(err);
	  return;
	}
	fflogsApiKey = apiKey;
});

fs.readFile('./bot_secret_token', 'utf8' , (err, token) => {
	if (err) {
	  console.error(err);
	  return;
	}
	client.login(token);
});

const settings = { method: "Get" };
const fetchTrigger = "!bonk";

const colors = {
	p1: '#28b4c8',
	lc: '#ff6358',
	p2: '#78d237',
	p3: '#2d73f5',
	p4: '#ffd246',
	kill: '#aa46be'
};

let guilds = {};

client.on('ready', () => {
	console.log("Connected as " + client.user.tag);

	const guildInfos = client.guilds.cache;
	
	guildInfos.forEach( (guild) => {
		const logChannel = guild.channels.cache.find( (channel) => channel.name === "logs");
		guilds[guild.id] = logChannel;
	});
});

client.on('message', (message) => {
	if (message.author == client.user) {
		return;
	}

	if(isFflogsLink(message) && isInLogsChannel(message)) {
		const fightId = getFightId(message.content);
		const apiUrl = createUrl(fightId);

		fetch(apiUrl, settings)
			.then(res => res.json())
			.then((data) => {
			   handleData(data.fights, message);
			})  
	} else {
		if (message.content === fetchTrigger) {
			getGlobalChart(message);
		}
	}
})

handleData = (fights, message) => {
	if (fights) {
		fights = fights.filter((fight) => fight.lastPhaseForPercentageDisplay);
		fights = fights.filter((fight) => fight.zoneName === "The Epic of Alexander (Ultimate)");
	
		chartUrl = createChart(fights);
		const chartImage = new MessageAttachment(chartUrl);
		chartImage.setName('chart.png');
		message.channel.send(chartImage);
	}
}

createChart = (fights) => {
	let myColors= [];
	let durations = fights.map( (fight) => getFightDuration(fight))

	fights.forEach(  (fight, index) => {
		myColors[index] = getBarColor(fight);
	});

	const chart = {
		type: 'bar',
		data: {
		  labels: fights.map( (fight, index) => `${index + 1}`),
		  datasets: [{
			label: 'Chart',
			data: durations,
			backgroundColor: myColors
		  }]
		},
		options: {
			scales: {
				yAxes: [{
					ticks: {
					   min: 0,
					   max: 18,
					   stepSize: 1
					}
				 }]
			}
		}
	}
	
	const encodedChart = encodeURIComponent(JSON.stringify(chart));
	const chartUrl = `https://quickchart.io/chart?c=${encodedChart}`;

	return chartUrl;
}

getGlobalChart = (message) => {
	guilds[message.guild.id].messages.fetch()
		.then( (messages) => {			
			let fightUrls = [];

			messages.forEach( (message) => {
				if (message && message.content && isFflogsLink(message)) {
					const fightId = getFightId(message.content);
					const fightUrl = createUrl(fightId);
					if ( !fightUrls.includes(fightUrl) ) {
						fightUrls.push(fightUrl);
					}
				}
			});

			const fetchPromises = fightUrls.map( (fightUrl) => fetch(fightUrl));

			Promise.all(fetchPromises
				).then(function (responses) {
				return Promise.all(responses.map(function (response) {
					return response.json();
				}));
			}).then(function (data) {
				const sortedLogs = data.sort((a,b) => (a.end > b.end) ? 1 : ((b.end > a.end) ? -1 : 0));

				let fights = [];
				sortedLogs.forEach( (currentLog) => {
					currentLog.fights.forEach( (fight) => {
						fights.push(fight);
					})
				});

				message.channel.send(`Number of pulls: ${fights.length}`);
				handleData(fights, message);
			}).catch(function (error) {
				console.log(error);
			});
			

			
		});

}

isInLogsChannel = (message) => {
	return (guilds[message.guild.id].id === message.channel.id);
};

isFflogsLink = (message) => {
	return (message.content.includes('https://www.fflogs.com/reports/'));
}

getFightId = (url) => {
	return url.split('https://www.fflogs.com/reports/')[1].split('/#')[0];
}

createUrl = (fightId) => {
	return `https://www.fflogs.com:443/v1/report/fights/${fightId}?api_key=${fflogsApiKey}`;
}

getFightDuration = (fight) => {
	return (fight.end_time - fight.start_time) / (60*1000);
}

getBarColor = (fight) => {
	if (fight.kill) {
		return colors.kill;
	}
	switch(fight.lastPhaseForPercentageDisplay) {
		case 1:
			return fight.lastPhaseIsIntermission ? colors.lc : colors.p1;
		case 2:
			return colors.p2;
		case 3:
			return fight.lastPhaseIsIntermission ? colors.p4 : colors.p3;
		case 4:
			return colors.p4;
	}
}