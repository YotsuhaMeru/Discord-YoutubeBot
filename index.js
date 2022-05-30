const Discord = require("discord.js")
const client = new Discord.Client({intents: [Object.keys(Discord.Intents.FLAGS)], partials: ['MESSAGE', 'CHANNEL', 'REACTION']});
const { joinVoiceChannel, getVoiceConnection, createAudioPlayer, NoSubscriberBehavior, AudioPlayerStatus, createAudioResource } = require('@discordjs/voice');
const fs = require('fs')
const ytsr = require('ytsr');
const config = JSON.parse(fs.readFileSync('config.json'))
const YTDlpWrap = require('yt-dlp-wrap').default;
const ytDlpWrap = new YTDlpWrap('./yt-dlp.exe');
let playing = false;
let PlayQueue = {
	"nowplaying" : "",
	"url": []
}

let connection;

async function ytSearchExec(searchstr, message) {
	const filters1 = await ytsr.getFilters(searchstr);
	const options = {
		limit: 5,
	}
	const result = await ytsr(searchstr, options)
	console.log(result.items)
}

async function ytPlayExec(url, message) {
	if(PlayQueue.nowplaying == "" && PlayQueue.url[0] && playing) return ytRecoveryPlay(url, message) 
	if(playing) return ytAddQueue(url, message);
	let embed = new Discord.MessageEmbed()
	if(!message.member.voice.channel) {
		embed.setTitle(':warning: Please Join VC before add music.')
		return msg.edit({embeds: [embed]})
	}
	embed = new Discord.MessageEmbed()
		.setTitle('ytPlayer')
		.setDescription('Downloading...')
	let msg = await message.channel.send({embeds: [embed]})
	playing = true;
	
	connection = await joinVoiceChannel({
		channelId: message.member.voice.channelId,
		guildId: message.channel.guild.id,
		adapterCreator: message.channel.guild.voiceAdapterCreator,
	});
	
	return ytPlayMusic(url, msg);
}

async function ytAddQueue(url, message) {
	let metadata = await ytDlpWrap.getVideoInfo(url);
	let embed = new Discord.MessageEmbed()
		.setTitle(':arrows_counterclockwise: Adding to queue...')
	let msg = await message.channel.send({embeds: [embed]})
	PlayQueue.url.push(url)
	embed.setTitle(':ballot_box_with_check:  Added to Queue')
	await embed.setDescription(metadata.title)
	await msg.edit({embeds: [embed]})
	return;
}

async function ytRecoveryPlay(url, message) {
	let embed = new Discord.MessageEmbed()
		.setTitle(':arrows_counterclockwise: Adding to Queue and recovering PlayState from MusicQueue...')
	let msg = await message.channel.send({embeds: [embed]})

	PlayQueue.url.push(url)
	let url2 = PlayQueue.url[0]
	PlayQueue.url.shift();
	return ytPlayMusic(url2, msg)
	
}

async function ytPlayMusic(url, msg) {
	let metadata = await ytDlpWrap.getVideoInfo(url);
	let embed = new Discord.MessageEmbed()
	await embed.setTitle(':arrow_down: Downloading '+ metadata.title)
	await msg.edit({embeds: [embed]})
	PlayQueue.nowplaying = url
	let ytDlpEventEmitter = await ytDlpWrap.exec([url, '-f', 'bestaudio', '-o', `./audio/${metadata.id}`])
		.on('close', async () => {
			await PlayQueue.url.shift();
			let embed = new Discord.MessageEmbed()
			await embed.setTitle(':notes: Playing '+ metadata.title)
			msg.edit({embeds: [embed]})
			const player = createAudioPlayer({
				behaviors: {
					noSubscriber: NoSubscriberBehavior.Pause,
				},
			});
			const resource = createAudioResource(`./audio/${metadata.id}`)
			player.play(resource)
			connection.subscribe(player)
			player.on(AudioPlayerStatus.Idle, async () => {
				await player.stop();
				PlayQueue.nowplaying = "";
				embed.setTitle(':musical_note: Played '+ metadata.title)
				await msg.edit({embeds: [embed]})
				await fs.unlinkSync(`./audio/${metadata.id}`)
				if(!PlayQueue.url[0]) {
					embed.setTitle(':stop_button: Leaving VC...')
					msg = await msg.channel.send({embeds: [embed]})
					await connection.destroy();
					playing = false;
					
					embed.setTitle(':ballot_box_with_check: Disconnected')
					await msg.edit({embeds: [embed]})
					return;
				}
				embed = new Discord.MessageEmbed()
					.setTitle(':track_next: Shifting Queue...')
				msg = await msg.channel.send({embeds: [embed]})
				return ytPlayMusic(PlayQueue.url[0], msg)
			});
		})

}

client.on('ready', () => {
	console.log('Started')
})

client.on('messageCreate', async message => {
	if(message.content.startsWith('>ytplay')) {
		const args = message.content.split(' ')
		if(args[1].toString().startsWith('youtu.be') || args[1].toString().startsWith('https://youtu.be') || args[1].toString().startsWith('https://www.youtube.com/watch?v=') ||  args[1].toString().startsWith('youtube.com/watch?v=')) return ytPlayExec(args[1], message)
		//  Todo: Add Playlist // if(args[1].toString().startsWith('https://www.youtube.com/playlist?list=')) return ytPlayListExec(args[1], message)
		return ytSearchExec(args[1], message);
	}
	if(message.content.startsWith('>ytqueue')) {
		
	}
})

client.login(config.token)