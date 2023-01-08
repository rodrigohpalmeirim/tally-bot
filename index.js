const { Client, Events, GatewayIntentBits, REST, Routes, ActionRowBuilder, ButtonBuilder, ButtonStyle, UserSelectMenuBuilder } = require('discord.js');
const { clientId, guildId, token } = require('./config.json');
const commands = require('./commands.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, c => {
	console.log(`Ready! Logged in as ${c.user.tag}`);
});

const newExpenses = {}

client.on(Events.InteractionCreate, async interaction => {
	try {
		if (interaction.isChatInputCommand()) { // Handle slash commands
			if (interaction.commandName === 'expense') {
				newExpenses[interaction.id] = {
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
				newExpenses[interaction.id] = {
					type: 'transfer',
					amount: interaction.options.getNumber('amount'),
					from: interaction.options.getUser('from'),
					to: interaction.options.getUser('to')
				};
				await interaction.reply({
					content: `${interaction.user} added a money transfer:`,
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
				newExpenses[id].mainUser = interaction.values[0];
			} else if (action === 'involved-users') {
				newExpenses[id].involvedUsers = interaction.values;
			}
			interaction.update({
				components: [
					new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId(`main-user_${id}`).setPlaceholder('Who paid the expense?').setMinValues(0)),
					new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId(`involved-users_${id}`).setPlaceholder('Who is the expense for?').setMinValues(0).setMaxValues(25)),
					new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`add-expense_${id}`).setLabel('Add expense').setStyle(ButtonStyle.Primary).setDisabled(!newExpenses[id].mainUser || !newExpenses[id].involvedUsers?.length)),
				]
			});
		} else if (interaction.isButton()) { // Handle buttons
			const { customId } = interaction;
			const [action, id] = customId.split('_');
			if (action === 'add-expense') {
				const { mainUser, involvedUsers, title, amount } = newExpenses[id];
				await interaction.update({ content: 'Expense added!', components: [] });
				await interaction.channel.send({
					content: `${interaction.user} added an expense:`,
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