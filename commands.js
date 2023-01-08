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
				.setRequired(true),
		),
];