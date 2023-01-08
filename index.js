const { Client, Events, GatewayIntentBits, REST, Routes, ActionRowBuilder, ButtonBuilder, ButtonStyle, UserSelectMenuBuilder } = require('discord.js');
const { clientId, guildId, token } = require('./config.json');
const Sequelize = require('sequelize');
const commands = require('./commands.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, c => {
	Expenses.sync({ force : true }); // TODO: Remove force: true
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
	mainUser: Sequelize.STRING,
	involvedUsers: Sequelize.STRING,
	from: Sequelize.STRING,
	to: Sequelize.STRING,
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
					guildId: guildId,
					type: 'transfer',
					amount: options.getNumber('amount'),
					from: options.getUser('from').id,
					to: options.getUser('to').id,
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
									"value": `€${options.getNumber('amount')}`,
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
			}
		} else if (interaction.isUserSelectMenu()) { // Handle select menus
			const { customId, guildId, values } = interaction;
			const [action, id] = customId.split('_');
			const type = newExpenses[guildId][id].type;
			if (action === 'main-user') {
				newExpenses[guildId][id].mainUser = values[0];
			} else if (action === 'involved-users') {
				newExpenses[guildId][id].involvedUsers = values;
			}
			interaction.update({
				components: [
					new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId(`main-user_${id}`).setPlaceholder(type === 'expense' ? 'Who paid the expense?' : 'Who received the income?')),
					new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId(`involved-users_${id}`).setPlaceholder(`Who is the ${type} for?`).setMaxValues(25)),
					new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`add-${type}_${id}`).setLabel(`Add ${type}`).setStyle(ButtonStyle.Primary).setDisabled(!newExpenses[guildId][id].mainUser || !newExpenses[guildId][id].involvedUsers?.length)),
				]
			});
		} else if (interaction.isButton()) { // Handle buttons
			const { customId, user } = interaction;
			const [action, id] = customId.split('_');
			if (action === 'add-expense' || action === 'add-income') {
				const { mainUser, involvedUsers, title, amount, type } = newExpenses[guildId][id];
				await Expenses.create({ ...newExpenses[guildId][id], guildId: guildId, involvedUsers: involvedUsers.join(',') });
				delete newExpenses[guildId][id];
				await interaction.update({ content: (type === 'expense' ? 'Expense added!' : 'Income added!'), components: [] });
				await interaction.channel.send({
					content: `${user} added an ${type}:${"||​||".repeat(200)}<@${mainUser}>{${involvedUsers.map(user => `<@${user}>`).join('')}`,
					"embeds": [
						{
							"type": "rich",
							"title": title,
							"fields": [
								{
									"name": `Amount:`,
									"value": `€${amount}`,
									"inline": true
								},
								{
									"name": type === 'expense' ? `Paid by:` : `Received by:`,
									"value": `<@${mainUser}>`,
									"inline": true
								},
								{
									"name": `For${involvedUsers.length > 1 ? ` ${involvedUsers.length} people` : ""}:`,
									"value": `${involvedUsers.map(user => `<@${user}>`).join(' ')}`,
									"inline": involvedUsers.length == 1
								}
							]
						}
					]
				});
			}
		}
	} catch (error) {
		console.error(error);
	}
});

const rest = new REST({ version: '10' }).setToken(token);
rest.put(
	Routes.applicationGuildCommands(clientId, guildId),
	{ body: commands.map(command => command.toJSON()) },
)
.then(data => console.log(`Successfully reloaded ${data.length} application (/) commands.`))
.catch(console.error);

client.login(token);