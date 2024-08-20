export function clock() {
    const creationDate = Date.now();

    function durFromCreation() {
        return Date.now() - creationDate;
    }
    return {
        durFromCreation
    };
}