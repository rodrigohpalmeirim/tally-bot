const symbols = require('./symbols.json');
let rates, currencies;

async function update() {
    try {
        const response = await fetch('https://api.exchangerate.host/symbols');
        const data = await response.json();
        if (data.success) {
            delete data.symbols.BTC;
            currencies = data.symbols;
        } else {
            console.error('Error fetching currency list');
        }

        const response2 = await fetch(`https://api.exchangerate.host/latest`);
        const data2 = await response2.json();
        if (data2.success) {
            rates = data2.rates;
            console.log('Exchange rates updated');
        } else {
            console.error('Error fetching exchange rates');
        }
    } catch (error) {
        console.error(error);
    }
}

update();
setInterval(update, 1000 * 60 * 60);

function conversionRate(from, to) {
    return rates[to] / rates[from];
}

function getCurrencies() {
    return currencies;
}

function formatCurrency(value, currency, showPositiveSign = false, showSymbol = true, precision = 2) {
    const sign = showPositiveSign && value > 0 ? "+" : value < 0 ? "-" : "";
    value = Math.abs(value).toFixed(precision);
    return showSymbol && symbols[currency] ? `${sign}${symbols[currency]}${value}` : `${sign}${value} ${currency}`;
}

module.exports = { getCurrencies, conversionRate, formatCurrency };