const googleSheet = require('google-spreadsheet');
const util = require('util');
const puppeteer = require('puppeteer');
const request = require('request');
const cred = require('PATH TO YOUR cred.json FILE FOR GOOGLE SHEETS INTEGRATIION');
//regular expressions for checking for various analytics pixels
let testLinkedIn = new RegExp('(https:\\/\\/px\\.ads\\.linkedin\\.com)');
let testBing = new RegExp('(https:\\/\\/bat\\.bing\\.com\\/bat\\.js)');
let testGoogleTag = new RegExp('(https:\\/\\/www\\.googletagmanager\\.com\\/gtm\\.js)');
let testGoogleAn = new RegExp('(https:\\/\\/www\\.google-analytics\\.com\\/analytics\\.js)');
let testSeg = new RegExp('(https:\\/\\/cdn\\.segment\\.com\\/analytics\\.js)');

let urlArray = [];

//Filters the rows of the google sheet to retrieve the appropriate information.
function filterRow(row){
    let data = [];
    data.push(row.url);
    data.push(row.linkedin);
    data.push(row.googleanalytics);
    data.push(row.googletagmanager);
    data.push(row.bing);
    data.push(row.segment);
    return data;
}

//Accesses the provided google sheet and places the pushes the relevant information into an array for use by the puppeteer test function
async function accessSheet(){
    const doc = new googleSheet('INSERT YOUR GOOGLE SHEET ID HERE')
    await util.promisify(doc.useServiceAccountAuth)(cred);
    const info = await util.promisify(doc.getInfo)();
    const sheet = info.worksheets[0];
    const rows = await util.promisify(sheet.getRows)({
        offset: 1
    });

    rows.forEach(row => {
        urlArray.push(filterRow(row));
    })
    return urlArray;
}

//Generates pieces of the overall report that is posted to slack
//Uses puppeteer to intercept requests made by the page and updates the json object to indicated whether said pixel is on the site
//also looks at a google sheet to determine if said tracking tag is supposed to be there.
async function puppeteerTest(row){
    let url = row[0];
    let reportPiece = {
        [url] : {
            'LinkedIn':{
                'Required': '',
                'Is there': 'no', 
            },
            'Bing': {
                'Required': '',
                'Is there': 'no',
            },
            'GoogleTag': {
                'Required': '',
                'Is there': 'no',
            },
            'GoogleAnalytics': {
                'Required': '',
                'Is there': 'no',
            },
            'Segment': {
                'Required': '',
                'Is there': 'no',
            }
        }
    };
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', request => {
        if(request.url().match(testLinkedIn) !== null){
            reportPiece[url]['LinkedIn']['Is there'] = "yes";
        }
        if(request.url().match(testSeg) !== null){
            reportPiece[url]['Segment']['Is there'] = "yes";
        }
        if(request.url().match(testGoogleAn) !== null){
            reportPiece[url]['GoogleAnalytics']['Is there'] = "yes";
        }
        if(request.url().match(testGoogleTag) !== null){
            reportPiece[url]['GoogleTag']['Is there'] = "yes";
        }
        if(request.url().match(testBing) !== null){
            reportPiece[url]['Bing']['Is there'] = "yes";
        }
        reportPiece[url]['LinkedIn']['Required'] = (row[1] == 1) ? "yes" : "no";
        reportPiece[url]['Segment']['Required'] = (row[2] == 1) ? "yes" : "no";
        reportPiece[url]['GoogleAnalytics']['Required'] = (row[4] == 1) ? "yes" : "no";
        reportPiece[url]['GoogleTag']['Required'] = (row[3] == 1) ? "yes" : "no";
        reportPiece[url]['Bing']['Required'] = (row[5] == 1) ? "yes" : "no";
        request.continue();
    })
    await page.goto(row[0], {waitUntil: 'networkidle2'});
    await browser.close();
    return reportPiece;
}

//Takes the individual pieces of the report for each provided website and combines them into a single json object for easy slack posting
async function genReport(data){
    let report = [];
    for(let x = 0; x < data.length; x++){
        let test = await puppeteerTest(data[x]);
        report.push(test);
    }
    report = (util.inspect(report, false, null, false ));
    return report;
}

//Takes the generated json report and posts it to a slack channel of your choosing
accessSheet().then(data =>{
    genReport(data).then(reportForSlack => {
        //console.log(reportForSlack);
        request.post({
            url: 'https://slack.com/api/files.upload',
            formData: {
                token: 'INSERT YOUR SLACK TOKEN HERE',
                title: "TITLE FOR SLACK REPORT",
                content: reportForSlack,
                channels: 'CHANNEL TO BE POSTED IN ON SLACK'
            },
        }, function(err, response){
            if(err){
                console.log(err)
            }
            else{
                console.log("SUCCESS")
            }
        });
    });
})
