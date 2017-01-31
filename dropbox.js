const request = require('request');

exports.createAuthLink = function ({config, state}) {
    return 'https://www.dropbox.com/oauth2/authorize?' +
        'response_type=code&' +
        `client_id=${config.clientId}&` +
        `redirect_uri=${encodeURIComponent(config.redirectUri)}&` +
        `state=${state}&force_reapprove=true`;
}

exports.getToken = function ({config, expectedState, actualState, code}) {
    return new Promise((resolve, reject) => {
        if (!actualState || !code) return reject();
        if (expectedState !== actualState) return reject();

        request({
            url: 'https://api.dropboxapi.com/oauth2/token',
            method: 'POST',
            form: {
                code: code,
                grant_type: 'authorization_code',
                client_id: config.clientId,
                client_secret: config.clientSecret,
                redirect_uri: config.redirectUri,
            }
        }, (err, res, body) => {
            if (err) return reject(err);
            if (res.statusCode !== 200) return reject(body);
            const json = JSON.parse(body);
            resolve({token: json.access_token, id: json.account_id});
        });
    });
}

exports.getEmail = function ({config, token, id}) {
    return new Promise((resolve, reject) => {
        request({
            url: 'https://api.dropboxapi.com/2/users/get_account',
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({account_id: id})
        }, (err, res, body) => {
            if (err) return reject(err);
            if (res.statusCode != 200) return reject();
            resolve(JSON.parse(body)['email']);
        });    
    });
};

exports.getFile = function ({token, path}) {
    return new Promise((resolve, reject) => {
        request({
            url: 'https://content.dropboxapi.com/2/files/download',
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Dropbox-API-Arg': JSON.stringify({path: path})
            },
            encoding: null
        }, (err, res, body) => {
            if (err) return reject(err);
            if (res.statusCode !== 200) return reject(body.toString());
            resolve(body);
        });
    });
};

exports.putFile = function ({token, path, file}) {
    return new Promise((resolve, reject) => {
        request({
            url: 'https://content.dropboxapi.com/2/files/upload',
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/octet-stream',
                'Dropbox-API-Arg': JSON.stringify({
                    path: path,
                    mode: {'.tag': 'overwrite'}
                })
            },
            body: file
        }, (err, res, body) => {
            if (err) return reject(err);
            resolve();
        });
    });
};
