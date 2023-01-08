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
			if (interaction.commandName === 'expense') {
				newExpenses[interaction.guildId][interaction.id] = {
					type: 'expense',
					title: interaction.options.getString('title'),
					amount: interaction.options.getNumber('amount')
				};
				await interaction.reply({
					ephemeral: true,
					components: [
						new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId(`main-user_${interaction.id}`).setPlaceholder('Who paid the expense?')),
						new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId(`involved-users_${interaction.id}`).setPlaceholder('Who is the expense for?').setMaxValues(25)),
						new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`add-expense_${interaction.id}`).setLabel('Add expense').setStyle(ButtonStyle.Primary).setDisabled(true)),
					]
				});
			} else if (interaction.commandName === 'transfer') {
				await Expenses.create({
					guildId: interaction.guildId,
					type: 'transfer',
					amount: interaction.options.getNumber('amount'),
					from: interaction.options.getUser('from').id,
					to: interaction.options.getUser('to').id,
				});
				await interaction.reply({
					content: `${interaction.user} added a money transfer:${"||​||".repeat(200)}${interaction.options.getUser('from')}${interaction.options.getUser('to')}`,
					"embeds": [
						{
							"type": "rich",
							"title": "Money transfer",
							"fields": [
								{
									"name": `Amount:`,
									"value": `€${interaction.options.getNumber('amount')}`,
									"inline": true
								},
								{
									"name": `From:`,
									"value": `${interaction.options.getUser('from')}`,
									"inline": true
								},
								{
									"name": `To:`,
									"value": `${interaction.options.getUser('to')}`,
									"inline": true
								}
							]
						}
					]
				});
			}
		} else if (interaction.isUserSelectMenu()) { // Handle select menus
			const { customId } = interaction;
			const [action, id] = customId.split('_');
			if (action === 'main-user') {
				newExpenses[interaction.guildId][id].mainUser = interaction.values[0];
			} else if (action === 'involved-users') {
				newExpenses[interaction.guildId][id].involvedUsers = interaction.values;
			}
			interaction.update({
				components: [
					new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId(`main-user_${id}`).setPlaceholder('Who paid the expense?').setMinValues(0)),
					new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId(`involved-users_${id}`).setPlaceholder('Who is the expense for?').setMinValues(0).setMaxValues(25)),
					new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`add-expense_${id}`).setLabel('Add expense').setStyle(ButtonStyle.Primary).setDisabled(!newExpenses[interaction.guildId][id].mainUser || !newExpenses[interaction.guildId][id].involvedUsers?.length)),
				]
			});
		} else if (interaction.isButton()) { // Handle buttons
			const { customId } = interaction;
			const [action, id] = customId.split('_');
			if (action === 'add-expense') {
				await Expenses.create({ ...newExpenses[interaction.guildId][id], guildId: interaction.guildId, involvedUsers: newExpenses[interaction.guildId][id].involvedUsers.join(',') });
				const { mainUser, involvedUsers, title, amount } = newExpenses[interaction.guildId][id];
				delete newExpenses[interaction.guildId][id];
				await interaction.update({ content: 'Expense added!', components: [] });
				await interaction.channel.send({
					content: `${interaction.user} added an expense:${"||​||".repeat(200)}<@${mainUser}>{${involvedUsers.map(user => `<@${user}>`).join('')}`,
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
									"name": `Paid by:`,
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