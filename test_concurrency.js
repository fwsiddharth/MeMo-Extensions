async function run() {
    const tasks = Array.from({length: 12}, (_, i) => async () => {
        console.log("Start", i);
        await new Promise(r => setTimeout(r, 1000));
        console.log("End", i);
        return i;
    });

    const limit = 3;
    const results = [];
    for (let i = 0; i < tasks.length; i += limit) {
        const chunk = tasks.slice(i, i + limit);
        const chunkResults = await Promise.all(chunk.map(t => t()));
        results.push(...chunkResults);
    }
    console.log(results);
}
run();
