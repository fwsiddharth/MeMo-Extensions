const arr = [1, 2];
for (const x of arr) {
    console.log(x);
    if (x === 2) arr.push(3);
}
