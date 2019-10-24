# How to use
This script reads a list of websites and the tracking pixels that are supposed to be loaded from a google sheet.
It then test each of those sites for required tracking pixels and generates a report of what is installed and what is missing as a json object. The json object is then posted to slack.

## Requirements
In order for this script to run your must have node, puppeteer and the google-spreadsheet npm package installed.

## Example
```
node trackingTest.js
``` 
