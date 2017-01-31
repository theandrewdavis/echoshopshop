A web app that allows you to use Amazon Echo voice commands to add items to your [ShopShop](https://nschum.de/apps/ShopShop/) iOS app. It does this by polling the Alexa website for new items in the shopping list, deleting them, and adding them to ShopShop via the Dropbox API. Amazon does not provide a public API, so I partially reverse engineered the private API and include a Chrome extension to capture the authentication information required to communicate with it.

I've hosted this web app at [echoshopshop.narwhal.in](https://echoshopshop.narwhal.in), which you're free to use. However, the app requires access to both your Dropbox and Amazon accounts, so for security I recommend you host your own server.

To set up a version of echoshopshop you'll need to [register a new Dropbox app](https://www.dropbox.com/developers/apps/create) with "Full Dropbox" permissions, record the app secret, and add an OAuth 2 redirect URI of `https://<your-domain>/login/dropbox`.

To set up the server on Ubuntu 16.04:
```
# Install node
sudo apt-get update
curl -sL https://deb.nodesource.com/setup_7.x | sudo bash
sudo apt-get install -y nodejs

# Download and install app
git clone https://github.com/theandrewdavis/echoshopshop.git
cd echoshopshop
npm install

# Configure app, then open a temporary shell with the configured environment
cd deploy
cp config.sh config.sh.example
vi config.sh # Fill out configuration info
bash
set -a
source config.sh

# Run the app
nodejs -e "console.log(require('crypto').randomBytes(50).toString('hex'))" > session.secret
nohup nodejs `pwd`/../index.js --port=$ESS_PORT --dropbox-key=$ESS_DROPBOX_KEY --dropbox-secret=$ESS_DROPBOX_SECRET --dropbox-redirect-domain=$ESS_DOMAIN --session-secret=`cat session.secret` >> error.log &

# Set up nginx to enable letsencrypt webroot verification
sudo apt-get install -y nginx
sudo rm -f /etc/ngnix/sites-enabled/default
envsubst < nginx-http.conf.template > nginx-http.conf '$ESS_DOMAIN,$PWD'
sudo cp nginx-http.conf /etc/nginx/sites-enabled/echoshopshop-http
sudo service nginx restart

# Set up letsencrypt
sudo apt-get install -y letsencrypt
mkdir -p letsencrypt/html letsencrypt/config letsencrypt/logs letsencrypt/work
letsencrypt certonly --webroot --non-interactive --email $ESS_LETSENCRYPT_EMAIL --agree-tos -d $ESS_DOMAIN -w letsencrypt/html --config-dir letsencrypt/config --logs-dir letsencrypt/logs --work-dir letsencrypt/work
{ crontab -l; echo "0 0 * * * cd `pwd` && ./letsencrypt-renew.sh 2>>error.log"; } | crontab -

# Set up nginx to serve app
envsubst < nginx-https.conf.template > nginx-https.conf '$ESS_DOMAIN,$ESS_PORT,$PWD'
sudo cp nginx-https.conf /etc/nginx/sites-enabled/echoshopshop-https
sudo service nginx restart

# Set up ssmtp to email errors from a gmail account (optional)
sudo apt-get install -y ssmtp
sudo cp /etc/ssmtp/ssmtp.conf{,.original}
envsubst < ssmtp.conf.template > ssmtp.conf
sudo cp ssmtp.conf /etc/ssmtp/ssmtp.conf
{ crontab -l; echo "0 1 * * * cd `pwd` && ./email-errors.sh $ESS_ERR_EMAIL_RECEIVER"; } | crontab -

# Exit configuration environment
exit
```

Next, visit `https://<your-domain>` and follow the link to authenticate with Dropbox. The app will make sure that a ShopShop shopping list is set up on your account. If not, make sure to set up Dropbox Sync in ShopShop. Next, install the echoshopshop Chrome extension. Download [this repository](https://github.com/theandrewdavis/echoshopshop/archive/master.zip) as a zip file and unzip it. If you're using your own server, edit `extension/manifest.json` and `extension/background.js` to change 'echoshopshop.narwhal.in' to your domain. Open `chrome://extensions` in Chrome, check the "Developer mode" box, then use "Load unpacked extension..." to navigate to and select the `extension` folder. Now make sure you're logged in to [alexa.amazon.com](https://alexa.amazon.com) and reload `https://<your-domain>`. You should see that you're authenticated with both Alexa and Dropbox and ready to sync. At this point you're free to disable or delete the Chrome extension.