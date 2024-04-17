const axios = require('axios');

const searchGoogleImages = async (apiKey, cseId, query, numImages = 1) => {
    const searchUrl = 'https://www.googleapis.com/customsearch/v1';
    const params = {
        q: query,
        cx: cseId,
        num: numImages,
        searchType: 'image',
        key: apiKey
    };

    try {
        const response = await axios.get(searchUrl, { params });
        if (response.data.items) {
            const imageUrls = response.data.items.map(item => item.link);
            return imageUrls;
        } else {
            console.error('No images found or items is undefined');
            return [];
        }
    } catch (error) {
        console.error('Error during image search:', error);
        return [];
    }
};

module.exports = searchGoogleImages;
