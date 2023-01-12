const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = [
	new SlashCommandBuilder()
		.setName('setup')
		.setDescription('Create a new tally for your server')
		.addStringOption(option =>
			option.setName('currency')
				.setDescription('The currency to use for the tally. This value cannot be changed later without resetting the tally.')
				.setRequired(true)
				.setAutocomplete(true),
		)
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
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
		)
		.addStringOption(option =>
			option.setName('currency')
				.setDescription('The currency of the expense.')
				.setAutocomplete(true),
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
		)
		.addStringOption(option =>
			option.setName('currency')
				.setDescription('The currency of the income.')
				.setAutocomplete(true),
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
		)
		.addStringOption(option =>
			option.setName('currency')
				.setDescription('The currency of the money transfer.')
				.setAutocomplete(true),
		),
	new SlashCommandBuilder()
		.setName('tally')
		.setDescription('Show the balances of all users'),
];