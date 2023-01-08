const { Client, Events, GatewayIntentBits, REST, Routes, ActionRowBuilder, ButtonBuilder, ButtonStyle, UserSelectMenuBuilder, EmbedBuilder } = require('discord.js');
const { clientId, guildId, token } = require('./config.json');
const Sequelize = require('sequelize');
const commands = require('./commands.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, c => {
	Expenses.sync({ force : true }); // TODO: Remove force: true
	Guilds.sync({ force : true }); // TODO: Remove force: true
	console.log(`Ready! Logged in as ${c.user.tag}`);
});

const sequelize = new Sequelize('database', 'user', 'password', {
	host: 'localhost',
	dialect: 'sqlite',
	logging: false,
	storage: 'database.sqlite',
});

const Expenses = sequelize.define('expenses', {
	guildId: Sequelize.STRING,
	title: Sequelize.STRING,
	amount: Sequelize.FLOAT,
	type: Sequelize.STRING,
	primaryUser: Sequelize.STRING,
	secondaryUsers: Sequelize.STRING,
});

const Guilds = sequelize.define('guilds', {
	guildId: {
		type: Sequelize.STRING,
		unique: true,
	},
	balancesMessageId: Sequelize.STRING,
	balancesChannelId: Sequelize.STRING,
});

const newExpenses = {}

client.on(Events.InteractionCreate, async interaction => {
	try {
		if (!newExpenses[interaction.guildId]) {
			newExpenses[interaction.guildId] = {};
		}
		if (interaction.isChatInputCommand()) { // Handle slash commands
			const { commandName, guildId, id, user, options } = interaction;
			if (commandName === 'expense' || commandName === 'income') {
				newExpenses[guildId][id] = {
					type: commandName,
					title: options.getString('title'),
					amount: options.getNumber('amount')
				};
				await interaction.reply({
					ephemeral: true,
					components: [
						new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId(`main-user_${id}`).setPlaceholder(commandName === 'expense' ? 'Who paid the expense?' : 'Who received the income?')),
						new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId(`involved-users_${id}`).setPlaceholder(`Who is the ${commandName} for?`).setMaxValues(25)),
						new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`add-${commandName}_${id}`).setLabel(`Add ${commandName}`).setStyle(ButtonStyle.Primary).setDisabled(true)),
					]
				});
			} else if (commandName === 'transfer') {
				await Expenses.create({
					title: 'Money transfer',
					guildId: guildId,
					type: 'transfer',
					amount: options.getNumber('amount'),
					primaryUser: options.getUser('from').id,
					secondaryUsers: options.getUser('to').id,
				});
				await interaction.reply({
					content: `${user} added a money transfer:${"||​||".repeat(200)}${options.getUser('from')}${options.getUser('to')}`,
					"embeds": [
						{
							"type": "rich",
							"title": "Money transfer",
							"fields": [
								{
									"name": `Amount:`,
									"value": `€${options.getNumber('amount').toFixed(2)}`,
									"inline": true
								},
								{
									"name": `From:`,
									"value": `${options.getUser('from')}`,
									"inline": true
								},
								{
									"name": `To:`,
									"value": `${options.getUser('to')}`,
									"inline": true
								}
							]
						}
					]
				});
				const balanceMessage = await interaction.channel.send(await showBalances(guildId));
				await Guilds.upsert({ guildId: guildId, balancesMessageId: balanceMessage.id, balancesChannelId: interaction.channelId });
			} else if (commandName === 'balances') {
				await interaction.deferReply();
				const balanceMessage = await interaction.followUp(await showBalances(guildId));
				await Guilds.upsert({ guildId: guildId, balancesMessageId: balanceMessage.id, balancesChannelId: interaction.channelId });
			}
		} else if (interaction.isUserSelectMenu()) { // Handle select menus
			const { customId, guildId, values } = interaction;
			const [action, id] = customId.split('_');
			const type = newExpenses[guildId][id].type;
			if (action === 'main-user') {
				newExpenses[guildId][id].primaryUser = values[0];
			} else if (action === 'involved-users') {
				newExpenses[guildId][id].secondaryUsers = values;
			}
			interaction.update({
				components: [
					new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId(`main-user_${id}`).setPlaceholder(type === 'expense' ? 'Who paid the expense?' : 'Who received the income?')),
					new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId(`involved-users_${id}`).setPlaceholder(`Who is the ${type} for?`).setMaxValues(25)),
					new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`add-${type}_${id}`).setLabel(`Add ${type}`).setStyle(ButtonStyle.Primary).setDisabled(!newExpenses[guildId][id].primaryUser || !newExpenses[guildId][id].secondaryUsers?.length)),
				]
			});
		} else if (interaction.isButton()) { // Handle buttons
			const { customId, user } = interaction;
			const [action, id] = customId.split('_');
			if (action === 'add-expense' || action === 'add-income') {
				const { primaryUser, secondaryUsers, title, amount, type } = newExpenses[guildId][id];
				await Expenses.create({ ...newExpenses[guildId][id], guildId: guildId, secondaryUsers: secondaryUsers.join(',') });
				delete newExpenses[guildId][id];
				await interaction.update({ content: (type === 'expense' ? 'Expense added!' : 'Income added!'), components: [] });
				await interaction.channel.send({
					content: `${user} added an ${type}:${"||​||".repeat(200)}<@${primaryUser}>{${secondaryUsers.map(user => `<@${user}>`).join('')}`,
					"embeds": [
						{
							"type": "rich",
							"title": title,
							"fields": [
								{
									"name": `Amount:`,
									"value": `€${amount.toFixed(2)}`,
									"inline": true
								},
								{
									"name": type === 'expense' ? `Paid by:` : `Received by:`,
									"value": `<@${primaryUser}>`,
									"inline": true
								},
								{
									"name": `For${secondaryUsers.length > 1 ? ` ${secondaryUsers.length} people` : ""}:`,
									"value": `${secondaryUsers.map(user => `<@${user}>`).join(' ')}`,
									"inline": secondaryUsers.length == 1
								}
							]
						}
					]
				});
				const balanceMessage = await interaction.channel.send(await showBalances(guildId));
				await Guilds.upsert({ guildId: guildId, balancesMessageId: balanceMessage.id, balancesChannelId: interaction.channelId });
			}
		}
	} catch (error) {
		console.error(error);
	}
});

async function showBalances(guildId) {
	const expenses = await Expenses.findAll({ where: { guildId: guildId } });
	const users = [...new Set(expenses.map(expense => expense.primaryUser).concat(expenses.map(expense => expense.secondaryUsers?.split(',')).flat()))];
	const balances = {};
	users.forEach(user => balances[user] = 0);
	expenses.forEach(expense => {
		const { primaryUser, secondaryUsers, amount, type } = expense;
		if (type === 'expense' || type === 'transfer') {
			balances[primaryUser] += amount;
			secondaryUsers.split(',').forEach(user => balances[user] -= amount / secondaryUsers.split(',').length);
		} else if (type === 'income') {
			balances[primaryUser] -= amount;
			secondaryUsers.split(',').forEach(user => balances[user] += amount / secondaryUsers.split(',').length);
		}
	});

	const guild = await Guilds.findOne({ where: { guildId: guildId } });
	if (guild?.balancesMessageId) {
		try {
			const channel = await client.channels.fetch(guild.balancesChannelId);
			const message = await channel.messages.fetch(guild.balancesMessageId);
			message.delete()
		} catch (error) {}
	}

	return { embeds: [{
		title: 'Balances',
		description: users.length === 0 ? "There are no expenses yet" : users.map(user => `<@${user}>: ${balances[user] > 0 ? '+' : balances[user] < 0 ? '-' : ''}€${Math.abs(balances[user]).toFixed(2)}`).join('\n')
	}] };
}

const rest = new REST({ version: '10' }).setToken(token);
rest.put(
	Routes.applicationGuildCommands(clientId, guildId),
	{ body: commands.map(command => command.toJSON()) },
)
.then(data => console.log(`Successfully reloaded ${data.length} application (/) commands.`))
.catch(console.error);

client.login(token);