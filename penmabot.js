const Discord = require('discord.js');
const fs = require('fs');
const fetch = require('node-fetch');
const client = new Discord.Client();
const { MessageAttachment } = require('discord.js');
const MongoClient = require('mongodb').MongoClient;
const cron = require('node-cron');

const uri = "mongodb+srv://penma:penmalane@cluster0.naf6i.mongodb.net/penmabot?retryWrites=true&w=majority";
const mongoClient = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

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
const scaledFetchTrigger = "!scaledbonk";
const slutTrigger = "!slut";
const rankingTrigger = '!ranking';
const slutRetryTrigger = "!reslut";
const questionTrigger = "!question";
const lowerTrigger = "!lower";
const chartTrigger = "!chart";
const scaledChartTrigger = "!scaledchart";

const slutMaxRetry = 3;
const noRetryMessage = "You have no retry remaining. Wait for the daily reset at midnight.";

const colors = {
	p1: '#28b4c8',
	lc: '#ff6358',
	p2: '#78d237',
	p3: '#2d73f5',
	p4: '#ffd246',
	p5: '#ecaf81',
	p6: '#abeaea',
	p7: '#ead1dc',
	kill: '#aa46be'
};

let guilds = {};

client.on('ready', async () => {
	console.log("Connected as " + client.user.tag);
	
	await mongoClient.connect();
	console.log("Connected to the database");

	const guildInfos = client.guilds.cache;
	
	guildInfos.forEach( (guild) => {
		const logChannel = guild.channels.cache.find( (channel) => channel.name.includes("logs"));
		guilds[guild.id] = logChannel;
	});
});

client.on('message', (message) => {
	if (message.author == client.user) {
		return;
	}

	// if(isFflogsLink(message) && isInLogsChannel(message)) {
	/*if(isFflogsLink(message.content) && !message.content.includes(chartTrigger)) {
		getFflogsData(message, message.content)
	} */

	if (message.content === fetchTrigger) {
		getGlobalChart(message);
	}

	if (message.content === scaledFetchTrigger) {
		getGlobalChart(message, true);
	}

	if (message.content.includes(slutTrigger)) {
		handleSlut(message);
	}

	if (message.content === rankingTrigger) {
		getRanking(message);
	}

	if (message.content === slutRetryTrigger) {
		retrySlut(message);
	}

	if (message.content.includes(questionTrigger)) {
		question(message);
	}

	if (message.content.includes(lowerTrigger)) {
		//lowerScore(message);
	}

	if (message.content.toLowerCase().includes("dn") && message.channel && message.channel.name && message.channel.name.includes('bot')) {
		message.channel.send("deez nuts lmao");
	}

	if(message.content.includes(chartTrigger)) {
		handleIndividualChart(message);
	}

	if(message.content.includes(scaledChartTrigger)) {
		handleIndividualChart(message, true);
	}
})

getFflogsData = (message, url, specificFight = null, scaled = false) => {
	const fightId = getFightId(url);
	const apiUrl = createUrl(fightId);

	fetch(apiUrl, settings)
		.then(res => res.json())
		.then((data) => {
		   handleData(data.fights, message, specificFight, scaled);
	})
}

handleIndividualChart = (message, scaled = false) => {
	const trigger = scaled ? scaledChartTrigger : chartTrigger;
	const content = message.content.split(`${trigger} `);
	try {
		if (content.length !== 2) {
			message.channel.send(`Correct usage: ${trigger} fflogs_link | name_of_the_fight`);
		} else {
			const arguments = content[1].split(' | ');
			if (arguments.length !== 2) {
				message.channel.send(`Correct usage: ${trigger} fflogs_link | name_of_the_fight`);
			} else {
				if (!isFflogsLink(arguments[0])) {
					message.channel.send("First argument is not a correct fflogs link");
				} else {
					getFflogsData(message, arguments[0], arguments[1], scaled);
				}
			}
		}
	} catch (error) {
		console.log(error);
	}
}

handleData = (fights, message, specificFight = null, scaled = false) => {
	if (fights) {
		if (!specificFight)  {
			//fights = fights.filter((fight) => fight.lastPhaseForPercentageDisplay);
			fights = fights.filter((fight) => fight.zoneName === "Dragonsong's Reprise (Ultimate)");
		}
		else fights = fights.filter((fight) => fight.zoneName === specificFight);

		if (fights.length !== 0) {	
			chartUrl = createChart(fights, scaled);
			const chartImage = new MessageAttachment(chartUrl);
			chartImage.setName('chart.png');
			message.channel.send(chartImage);
		} else {
			message.channel.send("No fight found");
		}
	} else {
		message.channel.send("No fight found");
	}
}

createChart = (fights, scaled = false) => {
	let myColors= [];
	let durations = fights.map( (fight) => getFightDuration(fight))
	let maximumDuration = 18;

	try {
		if (scaled) {
			maximumDuration = durations.reduce(function(a, b) {
				return Math.ceil(Math.max(a, b));
			}, -Infinity);

		}

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
						   max: maximumDuration,
						   stepSize: 1
						}
					 }]
				},
				plugins: {
					legend: false
				}
			}
		}
		
		const encodedChart = encodeURIComponent(JSON.stringify(chart));
		const chartUrl = `https://quickchart.io/chart?c=${encodedChart}`;
	
		return chartUrl;
	} catch(e) {
		console.log('error: ', e);
	}
}

getGlobalChart = (message, scaled = false) => {
	guilds[message.guild.id].messages.fetch()
		.then( (messages) => {
			let fightUrls = [];

			messages.forEach( (message) => {
				if (message && message.content && isFflogsLink(message.content)) {
					const content = message.content.split(' ')[0];
					if (content.includes('http')) {
						const fightId = getFightId(content);
						let fightUrl = createUrl(fightId);
						if ( !fightUrls.includes(fightUrl) ) {
							fightUrls.push(fightUrl);
						}
					}
				}
			});

			const fetchPromises = fightUrls.map( (fightUrl) => fetch(fightUrl));

			Promise.all(fetchPromises)
				.then(function (responses) {
					return Promise.all(responses.map(function (response) {
						return response.json();
					}));
				}).then(function (data) {
					const sortedLogs = data.sort((a,b) => (a.end > b.end) ? 1 : ((b.end > a.end) ? -1 : 0));

					let fights = [];

					sortedLogs.forEach( (currentLog) => {
						let maxDuration = 0;
						let bestFight = {};
						currentLog.fights.forEach( (fight) => {
							if (fight.zoneName === "Dragonsong's Reprise (Ultimate)" && fight.end_time - fight.start_time > maxDuration) {
								maxDuration = fight.end_time - fight.start_time;
								bestFight = fight;
							}
						})

						fights.push(bestFight);
					});

					handleData(fights, message, null, scaled);
				}).catch(function (error) {
					console.log(error);
				});
			

			
		});

}

isInLogsChannel = (message) => {
	return guilds[message.guild.id] ? (guilds[message.guild.id].id === message.channel.id) : false;
};

isFflogsLink = (link) => {
	return (link ? link.includes('https://www.fflogs.com/reports/') : false);
}

getFightId = (url) => {
	return url.split('https://www.fflogs.com/reports/')[1];
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
		case 5:
			return colors.p5;
		case 6:
			return colors.p6;
		case 7:
			return colors.p7;
		default:
			return '#eee';
	}
}

getSlutPercentage = () => {
    return Math.floor((Math.random() * 100) + 1);
}

handleSlut = async (message) => {
	const mentioned = message.mentions.users;
	const serverId = message.guild.id;

		if (mentioned.size) {
			mentioned.forEach( async (mention) => {				
				const user = await getUser(serverId, mention.id);

				if (user) {
					message.channel.send(`<@${mention.id}> is ${user.percentage}% a slut.`);
				} else {
					message.channel.send(`<@${mention.id}> is not yet a slut. They can type !slut to know how much of a slut they are!`)
				}
			});
		} else {
			const userId = message.author.id;

			const user = await getUser(serverId, userId);
			let slutPercentage;
			let hasBeenInserted = false;

			if (!user) {
				slutPercentage = getSlutPercentage();
				insertUser(serverId, userId, slutPercentage);
			} else {
				slutPercentage = user.percentage;
				hasBeenInserted = true;
			}
			
			let sentMessage = `You are ${slutPercentage}% a slut\n\n`;
			user && user.slutRetry && !hasBeenInserted ? 
				sentMessage += `You have ${user.slutRetry} retries remaining for today.\nType ${slutRetryTrigger} to retry!` :
				sentMessage += noRetryMessage;
			message.channel.send(sentMessage);
		}
}

getUser = async (serverId, userId) => {
	const slutCollection = mongoClient.db("penmabot").collection("slut");
	const user = await slutCollection.findOne({serverId, userId});

	return user;
}

insertUser = async (serverId, userId, slutPercentage) => {
	const slutCollection = mongoClient.db("penmabot").collection("slut");
	await slutCollection.insertOne({serverId, userId, percentage: slutPercentage, slutRetry: slutMaxRetry});
}

getRanking = async (message) => {
	const users = await getOrderedUsers(message.guild.id);

	if (users) {
		let rankString = '';

		for (const[index, user] of users.entries()) {
			const fetchedUser = await client.users.fetch(user.userId);
			rankString += `${index + 1}: ${fetchedUser.username} (${user.percentage}%)\n`;
		}

		const rankingEmbed = new Discord.MessageEmbed()
			.setColor('#b983f7')
			.setTitle(`${message.guild.name} slut ranking`)
			.setDescription(rankString)

		message.channel.send(rankingEmbed);
	}
}

getOrderedUsers = async (serverId) => {	
	const slutCollection = mongoClient.db("penmabot").collection("slut");
	const users = await slutCollection.find({serverId}).sort({percentage: -1}).limit(10).toArray();

	return users;
}

retrySlut = async (message) => {
	const updatedUser = await updateUser(message.guild.id, message.author.id);

	if (updatedUser.lastErrorObject.n) {
		let sentMessage = `You are ${updatedUser.value.percentage}% a slut.\n`;
		const retryString = updatedUser.value.slutRetry === 1 ? "retry" : "retries";

		updatedUser.value.slutRetry ?
			sentMessage += `You have ${updatedUser.value.slutRetry} ${retryString} remaining for today.` :
			sentMessage += noRetryMessage;

		message.channel.send(sentMessage);
	} else {
		message.channel.send(noRetryMessage)
	}
}

updateUser = async (serverId, userId) => {
	const slutCollection = mongoClient.db("penmabot").collection("slut");
	const updatedUser = await slutCollection.findOneAndUpdate(
		{ serverId, userId, slutRetry: { $gt: 0 } },
		{ $inc : { slutRetry : -1 }, $set: { percentage: getSlutPercentage() } },
		{ returnOriginal: false }
	);

	return updatedUser;
}

question = (message) => {
	const answer = (Math.random() < 0.5);
	const answerMessage = answer ? 'yes i do think so' : 'no i don\'t think so';

	message.channel.send(answerMessage);
}

lowerScore = async (message) => {
	const userTargeted = message.content.split(' ')[1];

	if ( userTargeted ) {
		let userFound = false;

		const attacker = await getUser(message.guild.id, message.author.id);

		console.log(attacker);

		if (attacker.slutRetry <= 0) {
			message.channel.send('You have no reslut remaining. You cannot lower someone\'s score');
		} else {
			message.channel.members.forEach(member => {
				if (userTargeted === `${member.user.username}#${member.user.discriminator}`) {
					userFound = true;
					lowerTargetScore(message.guild.id, member.user.id);
					lowerAttackerResluts(message.guild.id, message.author.id);
					message.channel.send(`${member.user.username}'s percentage lowered by 1%!\nReslut(s) left: ${attacker.slutRetry - 1}`);
				}
			});
		
			if (!userFound) {
				message.channel.send('User not found. Correct command is `lower Username#XXXX`');
			}			
		}
	} else {
		message.channel.send('Correct command is `lower Username#XXXX`');
	}
}

lowerTargetScore = async (serverId, userId) => {
	const slutCollection = mongoClient.db("penmabot").collection("slut");

	await slutCollection.findOneAndUpdate(
		{ serverId, userId, percentage: { $gt: 0 } },
		{ $inc : { percentage : -1 } }
	);
}

lowerAttackerResluts = async (serverId, userId) => {
	const slutCollection = mongoClient.db("penmabot").collection("slut");

	await slutCollection.findOneAndUpdate(
		{ serverId, userId },
		{ $inc : { slutRetry : -1 } }
	);
}

cron.schedule('0 0 * * *', () => {	
	console.log('resetting retries...');

	const slutCollection = mongoClient.db("penmabot").collection("slut");
	slutCollection.updateMany({}, {$set: {slutRetry: slutMaxRetry}});	
	slutCollection.updateMany({percentage: {$gt: 0}}, {$inc: {percentage: -1}});
});