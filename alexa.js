const request = require('request');

const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.2924.87 Safari/537.36';

exports.getLoginInfo = function ({cookies}) {
    return new Promise((resolve, reject) => {
        request.get({
            url: 'https://pitangui.amazon.com/api/household',
            qs: {_: Number(new Date())},
            headers: {
                'User-Agent': userAgent,
                'Cookie': cookies.map((i) => `${i.name}=${i.value}`).join('; ')
            }
        }, (error, response, body) => {
            if (error) return reject(error);
            resolve(JSON.parse(body));
        });
    });
};

exports.getShoppingList = function ({cookies}) {
    return new Promise((resolve, reject) => {
        request.get({
            url: 'https://pitangui.amazon.com/api/todos',
            qs: {
                startTime: '',
                endTime: '',
                completed: '',
                type: 'SHOPPING_ITEM',
                size: 100,
                offset: -1,
                _: Number(new Date())
            },
            headers: {
                'User-Agent': userAgent,
                'Cookie': cookies.map((i) => `${i.name}=${i.value}`).join('; ')
            }
        }, (error, response, body) => {
            if (error) return reject(error);
            try {
                resolve(JSON.parse(body).values);
            } catch (e) {
                reject(body);
            }
        });
    });
};

exports.deleteShoppingListItem = function({cookies, item}) {
    return new Promise((resolve, reject) => {
        request.put({
            url: `https://pitangui.amazon.com/api/todos/${encodeURIComponent(item.itemId)}`,
            headers: {
                'User-Agent': userAgent,
                'csrf': cookies.filter((i) => i.name == 'csrf')[0].value,
                'Cookie': cookies.map((i) => `${i.name}=${i.value}`).join('; ')
            },
            body: JSON.stringify({
                text: item.text,
                type: item.type,
                itemId: item.itemId,
                version: item.version,
                deleted: true,
                // lastLocalUpdatedDate: Number(new Date()),
                // complete: item.complete,
                // lastUpdateDate: item.lastUpdateDate,
                // createdDate: item.createdDate,
                // utteranceId: null,
                // nbestItems: item.nbestItems,
                // reminderTime: item.reminderTime,
                // customerId: item.customerId,
                // originalAudioId: item.originalAudioId,
            })
        }, (error, response, body) => {
            if (error) return reject(error);
            resolve(JSON.parse(body));
        });
    });
};