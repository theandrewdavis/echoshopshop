const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const crypto = require('crypto');
const request = require('request');
const bplist = require('bplist');
const minimist = require('minimist');

const dropbox = require('./dropbox');
const alexa = require('./alexa');

const args = minimist(process.argv.slice(2));
if (!args['session-secret'] || !args['dropbox-key'] || !args['dropbox-secret'] ||
        !args['dropbox-redirect-domain']) {
    console.log('Usage: node index.js --session-secret=abcd --dropbox-key=abcd ' +
        '--dropbox-secret=abcd --dropbox-redirect-domain=example.com');
    process.exit(1);
}

const app = express();
app.set('view engine', 'pug');
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(session({
    secret: args['session-secret'],
    secure: true,
    resave: false,
    saveUninitialized: false,
    cookie: {maxAge: 10 * 365 * 24 * 60 * 60 * 1000 /* 10 years */}
}));

const dropboxConfig = {
    clientId: args['dropbox-key'],
    clientSecret: args['dropbox-secret'],
    redirectUri: `https://${args['dropbox-redirect-domain']}/login/dropbox`,
};
const shoppingListPath = '/ShopShop/Shopping List.shopshop';

let intervals = {};

app.get('/', (req, res) => {
    let templateArgs = {};
    if (req.session.dropboxToken && req.session.dropboxEmail) {
        templateArgs.dropboxEmail = req.session.dropboxEmail;
    } else {
        req.session.dropboxState = crypto.randomBytes(100).toString('hex');
        templateArgs.dropboxLink = dropbox.createAuthLink({
            config: dropboxConfig,
            state: req.session.dropboxState
        });
    }
    if (req.session.alexaCookies && req.session.alexaEmail) {
        templateArgs.alexaEmail = req.session.alexaEmail;
    }
    templateArgs.syncing = Boolean(intervals[req.session.id]);
    templateArgs.flash = req.session.flash;
    req.session.flash = null;
    res.render('index', templateArgs);
});

app.get('/login/dropbox', (req, res) => {
    dropbox.getToken({
        config: dropboxConfig,
        expectedState: req.session.dropboxState,
        actualState: req.query.state,
        code: req.query.code,
    })
        .then(({token, id}) => {
            req.session.dropboxToken = token;
            return dropbox.getEmail({config: dropboxConfig, token, id});
        })
        .then ((email) => {
            req.session.dropboxEmail = email;
            return dropbox.getFile({token: req.session.dropboxToken, path: shoppingListPath});
        })
        .then((file) => {
            return res.redirect(301, '/');
        })
        .catch((e) => {
            req.session.dropboxToken = null;
            req.session.dropboxEmail = null;
            try {
                if (JSON.parse(e).error.path['.tag'] === 'not_found') {
                    req.session.flash = `Could not find file "${shoppingListPath}".`;
                    return res.redirect(301, '/');
                }
            } catch (ignore) {}
            req.session.flash = 'There was a problem logging into Dropbox';
            console.log(`${new Date()} Dropbox login failed: ${JSON.stringify(e)}`);
            return res.redirect(301, '/');
        });
    req.session.dropboxState = null;
});

app.post('/logout/dropbox', (req, res) => {
    req.session.dropboxToken = null;
    req.session.dropboxEmail = null;
    return res.redirect(301, '/');
});

app.post('/login/alexa', (req, res) => {
    const cookies = req.body;
    alexa.getLoginInfo({cookies})
        .then((info) => {
            req.session.alexaEmail = info.accounts[0].email;
            req.session.alexaCookies = cookies;
            return res.sendStatus(200);
        })
        .catch((e) => {
            req.session.alexaEmail = null;
            req.session.alexaCookies = null;
            console.log(`${new Date()} Alexa login failed: ${JSON.stringify(e)}`);
            return res.sendStatus(400);
        });
});

app.post('/sync/start', (req, res) => {
    if (!req.session.dropboxToken || !req.session.alexaCookies) {
        req.session.flash = 'Must be logged in to Dropbox and Alexa to sync.';
        return res.redirect(301, '/');
    }

    intervals[req.session.id] = setInterval(() => {
        sync({
            alexaCookies: req.session.alexaCookies,
            dropboxToken: req.session.dropboxToken,
            sessionId: req.session.id,
        });
    }, 10 * 1000);
    req.session.flash = 'Sync started.';
    return res.redirect(301, '/');
});

app.post('/sync/stop', (req, res) => {
    stopSync(req.session.id);
    req.session.flash = 'Sync stopped.';
    return res.redirect(301, '/');
});

function sync({alexaCookies, dropboxToken, sessionId}) {
    let newItems = [];
    alexa.getShoppingList({cookies: alexaCookies})
        .then((items) => {
            if (items.length == 0) {
                return;
            }
            newItems = items;
            return dropbox.getFile({token: dropboxToken, path: shoppingListPath})
                .then((file) => {
                    return new Promise((resolve, reject) => {
                        bplist.parseBuffer(file, (err, result) => {
                            if (err) throw new Error('bplist.parseBuffer failed');
                            resolve(result);
                        });
                    });
                })
                .then((list) => {
                    for (const newItem of newItems) {
                        list[0].shoppingList.push({
                            name: newItem.text,
                            count: '',
                            done: false,
                        });
                    }
                    return dropbox.putFile({
                        token: dropboxToken,
                        path: shoppingListPath,
                        file: bplist.create(list),
                    });
                })
                .then(() => {
                    return Promise.all(newItems.map((i) => {
                        return alexa.deleteShoppingListItem({cookies: alexaCookies, item: i});
                    }));
                });
        })
        .catch((e) => {
            stopSync(sessionId);
            console.log(`${new Date()} Sync failed: ${JSON.stringify(e)}`);
        });
}

function stopSync(sessionId) {
    if (intervals[sessionId]) {
        clearInterval(intervals[sessionId]);
        delete intervals[sessionId];
    }
}

const port = Number(args.port) || 8976;
app.listen(port, () => {
    console.log(`Listening on port ${port}`);
});
