const { randomFillSync } = require('crypto');

const getUID = () => {
    const currentTime = Date.now().toString();
    const randomValue = randomFillSync(new Uint32Array(1))[0].toString();
    
    return currentTime + '-' + randomValue;
};

module.exports = getUID;
