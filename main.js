const { Client } = require('discord.js');
const { TOCKEN, PREFLEX, GOOGLE_API_KEY } = require('./config');
const ytdl = require('ytdl-core');
const YouTube = require('simple-youtube-api');
const queue = new Map();


const client = new Client({ disableEverone: true });

const youtube = new YouTube(GOOGLE_API_KEY);

client.on('warn', console.warn);

client.on('error', console.error);

client.on('ready', () => console.log('Bot is ready'));

client.on('disconnect', () => console.log('I just discounect, make sure you know, I will reconect now...'));

client.on('message', async(message) => {
            if (message.author.bot) return undefined;
            if (!message.content.startsWith(PREFLEX)) return undefined;
            const args = message.content.replace(PREFLEX, '').split(' ');
            const command = args.shift().toLowerCase()
            const url = args.join(' ').replace(/<(.+)>/g, '$1');
            const serverQueue = queue.get(message.guild.id);
            console.log(url)
            if (message.channel.name !== 'music-bot-request')
                return message.guild.channels.create('music-bot-request', { type: 'text' })
            if (message.channel.name !== 'music-bot-request') return false;

            if (command === 'play') {
                const voiceChannel = message.member.voice.channel;
                if (!voiceChannel) return message.channel.send(`I'm sorry but you need to be in voice channel to play music`);
                const primssions = voiceChannel.permissionsFor(message.client.user);
                if (!primssions.has('CONNECT')) return message.channel.send(`I can't to your channel, make sure I have the Connect promissions `);
                if (!primssions.has('SPEAK')) return message.channel.send(`I can't speak in this voice channel channel, make sure I have the Speak promissions `);
                if (url.match(/^https?:\/\/(www.youtube.com|youtube.com)\/playlist(.*)$/)) {
                    try {
                        const playlist = await youtube.getPlaylist(url);
                        const videos = await playlist.getVideos();
                        for (const video of Object.values(videos)) {
                            const video2 = await youtube.getVideoByID(video.id);
                            await handleVideo(video2, message, voiceChannel, true)
                        }
                        return message.channel.send(`Playlist: **${playlist.title}** add to the queue`)
                    } catch (error) {
                        console.error(error)
                    }
                } else {
                    try {
                        var video = await youtube.getVideo(url)
                    } catch (error) {
                        try {
                            var videos = await youtube.searchVideos(url, 10);
                            let index = 0;
                            message.channel.send(`
__**Song selection**__
${videos.map(video => `**${++index} -** ${video.title}`).join('\n')}

Please provide a value to select one of the search results ranging from 1-10.
                
                            `);
                         
              
                    try {
                        var response = await message.channel.awaitMessages(msg => msg.content > 0 && msg.content < 11, {
                            max: 1,
                            time: 10000,
                            errors: ['time']
                        });
                    } catch (error) {
                        return message.channel.send('No or invalid entrerd, cancelling video selection.')
                    }
                    const videoIndex = parseInt(response.first().content)
                    var video = await youtube.getVideoByID(videos[videoIndex - 1].id);
                    console.log(video)
                } catch (error) {
                    console.error(error)
                    return message.channel.send('I could not obtain any search results.')
                }
            }
            return handleVideo(video, message, voiceChannel)
        }

    } else if (command === 'skip') {
        if (!message.member.voice.channel) return message.channel.send('You are not in a voice channel');
        if (!serverQueue) return message.channel.send('There is nothing playing to that I clould skip for you');
        serverQueue.connection.dispatcher.end();
        return undefined
    } else if (command === 'stop') {
        if (!message.member.voice.channel) return message.channel.send('You are not in a voice channel');
        if (!serverQueue) return message.channel.send('There is nothing playing to that I clould stop for you');
        message.delete({ timeout: 100, reason: 'It had to be done.' });
        serverQueue.songs = [];
        serverQueue.connection.dispatcher.end()
        return undefined
    } else if (command === 'vol') {
        if (!serverQueue) return message.channel.send('There is nothing playing');
        if (!args) return message.channel.send(`The current volume is: ${serverQueue.volume}`);
        serverQueue.volume = args
        serverQueue.connection.dispatcher.setVolumeLogarithmic(args / 5);
        return undefined;
    } else if (command === 'np') {
        if (!serverQueue) return message.channel.send('There is nothing playing');
        return message.channel.send(`Now playing: **${serverQueue.songs[0].title}**`)
    } else if (command === 'queue') {
        if (!serverQueue) return message.channel.send('There is nothing playing');
        return message.channel.send(`
__**Song queue**__
${serverQueue.songs.map(song => `**-** ${song.title}`).join('\n')}

**Now playing** ${serverQueue.songs[0].title}
        `)

    } else if (command === 'pause') {
        if (serverQueue && serverQueue.playing) {
            serverQueue.playing = false;
            serverQueue.connection.dispatcher.pause();
            return message.channel.send('Paused the music for you!')
        }
        return message.channel.send('There is nothing playing.')
    } else if (command === 'resume') {
        if (serverQueue && !serverQueue.playing) {
            serverQueue.playing = true;
            serverQueue.connection.dispatcher.resume();
            return message.channel.send('Resume the music for you!')
        }
        return message.channel.send('There is nothing playing.')
    }


})

const handleVideo = async (video, message, voiceChannel, playlist = false) => {
    const serverQueue = queue.get(message.guild.id);
    const song = {
        id: video.id,
        title: video.title,
        url: `https://www.youtube.com/watch?v=${video.id}`
    }

    if (!serverQueue) {
        const queueConstruct = {
            textChannel: message.channel,
            voiceChannel: voiceChannel,
            connection: null,
            songs: [],
            volume: 5,
            playing: true
        }
        queue.set(message.guild.id, queueConstruct);

        queueConstruct.songs.push(song)
        try {
            // await message.delete({ timeout: 100, reason: 'It had to be done.' });
            var connection = await voiceChannel.join()
            queueConstruct.connection = connection;
            await playSong(message.guild, queueConstruct.songs[0]);
            message.react('😄')
        } catch (error) {
            console.error(`I could not join to voice channel :${error}`);
            queue.delete(message.guild.id);
            return message.channel.send(`I could not join to voice channel :${error}`);
        }
    } else {
        await serverQueue.songs.push(song);
        if (playlist) return undefined
        message.channel.send(`**${song.title}** has been added to the queue!`);
    }
}

const playSong = (guild, song) => {
    const serverQueue = queue.get(guild.id);

    if (!song) {
        serverQueue.voiceChannel.leave();
        queue.delete(guild.id);
        return
    }

    const dispatcher = serverQueue.connection.play(ytdl(song.url))
        .on('finish', () => {
            console.log('song ended')
            serverQueue.songs.shift()
            playSong(guild, serverQueue.songs[0])
        })
        .on('error', (error) => console.error(error));
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 5)

    serverQueue.textChannel.send(`Now playing: **${song.title}**`)

    
    
    
}


client.login(TOCKEN)