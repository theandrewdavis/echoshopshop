#!/usr/bin/env bash

if [ -s error.log ]
then
    SUBJECT=`{ echo "Subject: "; date -I; echo "EchoShopShop Error"; } | tr "\n" " "`
    { echo $SUBJECT; cat error.log; } | ssmtp $1 && rm -f error.log
fi