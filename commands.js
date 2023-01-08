const { SlashCommandBuilder } = require('discord.js');

module.exports = [
	new SlashCommandBuilder()
		.setName('expense')
		.setDescription('Add a shared expense')
		.addStringOption(option =>
			option.setName('title')
				.setDescription('The title of the expense')
				.setRequired(true),
		)
		.addNumberOption(option =>
			option.setName('amount')
				.setDescription('The amount of the expense')
				.setMinValue(0)
				.setRequired(true),
		),
	new SlashCommandBuilder()
		.setName('income')
		.setDescription('Add a shared income')
		.addStringOption(option =>
			option.setName('title')
				.setDescription('The title of the income')
				.setRequired(true),
		)
		.addNumberOption(option =>
			option.setName('amount')
				.setDescription('The amount of the income')
				.setMinValue(0)
				.setRequired(true),
		),
	new SlashCommandBuilder()
		.setName('transfer')
		.setDescription('Add a money transfer between two users')
		.addNumberOption(option =>
			option.setName('amount')
				.setDescription('The amount of the transfer')
				.setMinValue(0)
				.setRequired(true),
		)
		.addUserOption(option =>
			option.setName('from')
				.setDescription('The user who transferred the amount')
				.setRequired(true),
		)
		.addUserOption(option =>
			option.setName('to')
				.setDescription('The user who received the amount')
				.setRequired(true),
		),
	new SlashCommandBuilder()
		.setName('balances')
		.setDescription('Show the balances of all users'),
];