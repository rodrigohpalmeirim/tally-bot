function minimumTransactions(tally) {
    if (Object.values(tally).reduce((a, b) => a + b, 0) >= 0.01) {
        throw new Error('Tally must sum to 0');
    }
    
    const groups = [], grouped = [], transactions = [];
    
    function subgroups(tally, group, sum, maxSize) {
        if (group.some(b => grouped.includes(b))) return;
        for (const b in tally) {
            if (tally[b] && !grouped.includes(b) && (sum == 0 || sum > 0 && tally[b] < 0 || sum < 0 && tally[b] > 0)) {
                if (Math.abs(sum + tally[b]) < 0.01) {
                    groups.push([...group, b]);
                    grouped.push(...group, b);
                    return;
                }
                if (group.length < maxSize) {
                    const newTally = {...tally};
                    newTally[b] = 0;
                    subgroups(newTally, [...group, b], sum + tally[b], maxSize);
                }
            }
        }
    }

    for (let i = 2; grouped.length < Object.values(tally).filter(i => i != 0).length; i++) {
        subgroups(tally, [], 0, i);
    }

    for (let group of groups) {
        const newTally = {...tally};
        while (group.some(b => newTally[b] >= 0.01)) {
            group = group.sort((a, b) => newTally[a] - newTally[b]);
            const min = group[0];
            const max = group[group.length - 1];
            transactions.push({
                from: min,
                to: max,
                amount: Math.min(Math.abs(newTally[min]), Math.abs(newTally[max]))
            });
            if (Math.abs(newTally[min]) > Math.abs(newTally[max])) {
                newTally[min] += newTally[max];
                newTally[max] = 0;
            } else {
                newTally[max] += newTally[min];
                newTally[min] = 0;
            }
        }
    }

    return transactions;
}

module.exports = { minimumTransactions };