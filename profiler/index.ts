export function measureEventLoop() {
    var time = process.hrtime();
    process.nextTick(function() {
        var diff = process.hrtime(time);
        console.log('event loop took %d nanoseconds', diff[0] * 1e9 + diff[1]);
    });
}