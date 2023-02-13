const { Client, Events, GatewayIntentBits, REST, Routes, ActionRowBuilder, ButtonBuilder, ButtonStyle, UserSelectMenuBuilder, EmbedBuilder, AttachmentBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ModalBuilder } = require('discord.js');
const { createCanvas } = require('@napi-rs/canvas');
const { clientId, guildId, token } = require('./config.json');
const Sequelize = require('sequelize');
const commands = require('./commands.js');
const { getCurrencies, convertionRate, formatCurrency } = require('./currencies.js');
const { minimumTransactions } = require('./transactions.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, c => {
	Expenses.sync({ force: true }); // TODO: Remove force: true
	Guilds.sync({ force: true }); // TODO: Remove force: true
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
	currency: Sequelize.STRING,
	conversionRate: Sequelize.FLOAT,
});

const Guilds = sequelize.define('guilds', {
	guildId: {
		type: Sequelize.STRING,
		unique: true,
	},
	currency: Sequelize.STRING,
	tallyMessageId: Sequelize.STRING,
	tallyChannelId: Sequelize.STRING,
});

const newExpenses = {};

client.on(Events.InteractionCreate, async interaction => {
	try {
		if (interaction.isChatInputCommand()) { // Handle slash commands
			const { commandName, guildId, id, user, options } = interaction;

			if (options.getString('currency') && !getCurrencies()[options.getString('currency')]) {
				return interaction.reply({ ephemeral: true, content: `Invalid currency` });
			}

			if (commandName === 'setup') {
				if (await Guilds.findOne({ where: { guildId: guildId } })) {
					await interaction.reply({
						ephemeral: true,
						content: 'This server already has a tally! Are you sure you want to reset it?',
						components: [
							new ActionRowBuilder().addComponents(
								new ButtonBuilder().setCustomId(`reset-tally_${id}_${options.getString('currency')}`).setLabel('Reset tally').setStyle(ButtonStyle.Danger),
								new ButtonBuilder().setCustomId(`cancel-reset-tally_${id}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary),
							),
						]
					});
				} else {
					await Guilds.create({ guildId, currency: options.getString('currency') });
					await interaction.reply({
						ephemeral: true,
						content: `Tally created! You can now use the </expense:${commandData.expense.id}>, </income:${commandData.income.id}> and </transfer:${commandData.transfer.id}> commands to add new entries and use the </tally:${commandData.tally.id}> command to view the tally.`,
					});
				}
			} else if (!await Guilds.findOne({ where: { guildId: guildId } })) {
				return interaction.reply({
					ephemeral: true,
					content: `This server is not set up yet. Please use the </setup:${commandData.setup.id}> command to create a new tally.`,
				});
			} else if (commandName === 'expense' || commandName === 'income') {
				if (!newExpenses[guildId]) {
					newExpenses[guildId] = {};
				}
				newExpenses[guildId][id] = {
					type: commandName,
					title: options.getString('title'),
					amount: options.getNumber('amount'),
					currency: options.getString('currency'),
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
				const tallyCurrency = (await Guilds.findOne({ where: { guildId: guildId } })).currency;
				const currency = options.getString('currency') || tallyCurrency;
				await Expenses.create({
					title: 'Money transfer',
					guildId: guildId,
					type: 'transfer',
					amount: options.getNumber('amount'),
					primaryUser: options.getUser('from').id,
					secondaryUsers: options.getUser('to').id,
					currency: currency,
					conversionRate: convertionRate(currency, tallyCurrency),
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
									"value": `${formatCurrency(options.getNumber('amount') * convertionRate(currency, tallyCurrency), tallyCurrency)} ${currency !== tallyCurrency ? `(${formatCurrency(options.getNumber('amount'), currency)})` : ''}`,
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
							],
							"footer": {
								"text": currency !== tallyCurrency ? `Rate: ${formatCurrency(1, currency, false, false, 0)} = ${formatCurrency(convertionRate(currency, tallyCurrency), tallyCurrency, false, false, 6)}` : ""
							}
						}
					]
				});
				const balanceMessage = await interaction.channel.send(await tally(guildId));
				await Guilds.upsert({ guildId: guildId, tallyMessageId: balanceMessage.id, tallyChannelId: interaction.channelId });
			} else if (commandName === 'tally') {
				await interaction.deferReply();
				const balanceMessage = await interaction.followUp(await tally(guildId));
				await Guilds.upsert({ guildId: guildId, tallyMessageId: balanceMessage.id, tallyChannelId: interaction.channelId });
			}
		} else if (interaction.isAutocomplete()) { // Handle autocomplete
			const focusedValue = interaction.options.getFocused();
			const filtered = Object.values(getCurrencies()).filter(s => `[${s.code}] ${s.description}`.toLowerCase().includes(focusedValue.toLowerCase())).slice(0, 25);
			await interaction.respond(filtered.map(s => ({ name: `[${s.code}] ${s.description}`, value: s.code })));
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
			const [action, id, ...options] = customId.split('_');
			if (action === 'add-expense' || action === 'add-income') {
				const { primaryUser, secondaryUsers, title, amount, type } = newExpenses[guildId][id];
				const tallyCurrency = (await Guilds.findOne({ where: { guildId: guildId } })).currency;
				const currency = newExpenses[guildId][id].currency || tallyCurrency;
				await Expenses.create({ ...newExpenses[guildId][id], guildId: guildId, secondaryUsers: secondaryUsers.join(','), currency: currency });
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
									"value": `${formatCurrency(amount * convertionRate(currency, tallyCurrency), tallyCurrency)} ${currency !== tallyCurrency ? `(${formatCurrency(amount, currency)})` : ''}`,
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
							],
							"footer": {
								"text": currency !== tallyCurrency ? `Rate: ${formatCurrency(1, currency, false, false, 0)} = ${formatCurrency(convertionRate(currency, tallyCurrency), tallyCurrency, false, false, 6)}` : ""
							}
						}
					]
				});
				const balanceMessage = await interaction.channel.send(await tally(guildId));
				await Guilds.upsert({ guildId: guildId, tallyMessageId: balanceMessage.id, tallyChannelId: interaction.channelId });
			} else if (action === 'cancel-reset-tally') {
				await interaction.update({ content: 'Reset cancelled', components: [] });
			} else if (action === 'reset-tally') {
				await Expenses.destroy({ where: { guildId: guildId } });
				await Guilds.upsert({ guildId: guildId, tallyMessageId: null, tallyChannelId: null, currency: options[0] });
				await interaction.update({ content: 'Tally reset', components: [] });
			}
		}
	} catch (error) {
		console.error(error);
	}
});

async function tally(guildId) {
	const expenses = await Expenses.findAll({ where: { guildId: guildId } });

	if (!expenses.length) return { embeds: [{ title: "Tally", description: "No expenses have been added yet." }] };

	const users = [...new Set(expenses.map(expense => expense.primaryUser).concat(expenses.map(expense => expense.secondaryUsers?.split(',')).flat()))];
	const tallyCurrency = (await Guilds.findOne({ where: { guildId: guildId } })).currency;
	const tally = {};
	users.forEach(user => tally[user] = 0);
	expenses.forEach(expense => {
		const { primaryUser, secondaryUsers, amount, type } = expense;
		const convertedAmount = amount * convertionRate(expense.currency, tallyCurrency);
		if (type === 'expense' || type === 'transfer') {
			tally[primaryUser] += convertedAmount;
			secondaryUsers.split(',').forEach(user => tally[user] -= convertedAmount / secondaryUsers.split(',').length);
		} else if (type === 'income') {
			tally[primaryUser] -= convertedAmount;
			secondaryUsers.split(',').forEach(user => tally[user] += convertedAmount / secondaryUsers.split(',').length);
		}
	});

	const guild = await Guilds.findOne({ where: { guildId: guildId } });
	try {
		const channel = await client.channels.fetch(guild.tallyChannelId);
		const message = await channel.messages.fetch(guild.tallyMessageId);
		message.delete()
	} catch (error) { }

	if (Object.values(tally).every(balance => balance < 0.01)) {
		return { embeds: [{ title: "Tally", description: "All settled up!" }] };
	}

	const max = Math.max(...Object.values(tally).map(Math.abs));
	const w = 600, r = 8, barHeight = 52, barSpacing = 8;
	const h = (barHeight + barSpacing) * users.length + 8;
	const canvas = createCanvas(w, h);
	const ctx = canvas.getContext('2d');
	ctx.font = "28px sans-serif";
	ctx.textBaseline = 'middle';
	users.forEach((user, i) => {
		const username = client.users.cache.get(user).username;
		const balanceStr = formatCurrency(tally[user], tallyCurrency, true);
		const barWidth = Math.abs(tally[user]) / max * w / 2;
		ctx.beginPath();
		if (tally[user] >= 0) {
			if (tally[user] > 0) {
				ctx.fillStyle = '#57F28780';
				ctx.roundRect(w / 2, 8 + (barHeight + barSpacing) * i, barWidth, barHeight, [0, r, r, 0]);
				ctx.fill();
			}
			ctx.textAlign = 'right';
			ctx.fillStyle = '#FFFFFF';
			ctx.fillText(username, w / 2 - 16, 8 + barHeight / 2 + (barHeight + barSpacing) * i);
			if (tally[user] > 0) ctx.fillStyle = '#FFFFFF';
			ctx.textAlign = 'left';
			ctx.fillText(balanceStr, w / 2 + 16, 8 + barHeight / 2 + (barHeight + barSpacing) * i);
		} else {
			ctx.fillStyle = '#ED424580';
			ctx.roundRect(w / 2 - barWidth, 8 + (barHeight + barSpacing) * i, barWidth, barHeight, [r, 0, 0, r]);
			ctx.fill();
			ctx.textAlign = 'left';
			ctx.fillStyle = '#FFFFFF';
			ctx.fillText(username, w / 2 + 16, 8 + barHeight / 2 + (barHeight + barSpacing) * i);
			ctx.textAlign = 'right';
			ctx.fillText(balanceStr, w / 2 - 16, 8 + barHeight / 2 + (barHeight + barSpacing) * i);
		}
	});

	return { embeds: [{
		title: "Tally",
		image: { url: "attachment://tally.png" },
		fields: [{ name: "Best way to settle up:", value: minimumTransactions(tally).map(transaction => `<@${transaction.from}> ➜ <@${transaction.to}>: ${formatCurrency(transaction.amount, tallyCurrency)}`).join('\n') }],
	}], files: [new AttachmentBuilder(await canvas.encode('png'), { name: 'tally.png' })] };
}

const commandData = {};

const rest = new REST({ version: '10' }).setToken(token);
rest.put(
	Routes.applicationGuildCommands(clientId, guildId),
	{ body: commands.map(command => command.toJSON()) },
)
	.then(data => {
		console.log(`Successfully reloaded ${data.length} application (/) commands.`);
		data.forEach(command => commandData[command.name] = command);
	})
	.catch(console.error);

client.login(token);