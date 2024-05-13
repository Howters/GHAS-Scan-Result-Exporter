"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const tl = require("azure-pipelines-task-lib/task");
const axios = require("axios")
const ExcelJS = require('exceljs');
const nodemailer = require('nodemailer');
const fs = require('fs');




async function run() {

        try {
            const projectRepo = tl.getInput("projectRepo", true);
            const recipientEmail = tl.getInput("recipientEmail", true);
            const emailsArray = recipientEmail.split(';').map(email => email.trim());
            //Add cyber's email to the recipient email array
            emailsArray.push("{{Cyber email}}")

            var execProcess = require("./exec_process.js");
            var cred = 
            "{{Username}}:{{PAT}}"
            var conversion = Buffer.from(cred).toString("base64");
            // var body = {
            //     name: inputString
            // };
            let header = {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Basic " + conversion
                }
            };
            axios.get(
                `https://advsec.dev.azure.com/{{Org}}/{{Project}}/_apis/alert/repositories/${projectRepo}/alerts?api-version=7.2-preview.1&top=1000`,
                header
            )
            .then(function (response) {
                if(response.data.count == 0){
                    //If there are no alerts
                    const transporter = nodemailer.createTransport({
                        service: "Outlook365",
                        host: "smtp.office365.com",
                        port: 587,
                        secure: true,
                        auth: {
                          user: "{{email}}",
                          pass: "{{app-password}}",
                        },
                      });
                    // Create email message
                    const mailOptions = {
                        from: '{{sender-email}}',
                        to: emailsArray,
                        subject: `GHAS-${projectRepo}`,
                        text: `These are no alerts found on the repository : ${projectRepo} `,
                    };
                    
                    // Send email
                    transporter.sendMail(mailOptions, function(error, info){
                        if (error) {
                        console.error('Error sending email:', error);
                        } else {
                        console.log('Email sent:', info.response);
                        }
                    });
                }
                else{
                    //If there are  alerts
                    const alerts = response.data.value;
              
                    // Filter alerts based on tool name
                    const codeQLAlerts = alerts.filter(alert => alert.tools.some(tool => tool.name === "CodeQL"));
                    const codeQLCounts = codeQLAlerts.length;
                    const dependencyScanningAlerts = alerts.filter(alert => alert.tools.some(tool => tool.name === "Advanced Security Dependency Scanning"));
                    const dependencyCounts = dependencyScanningAlerts.length;
                    const secretsScanningAlerts = alerts.filter(alert => alert.tools.some(tool => tool.name === "Advanced Security Secrets Scanning"));
                    const secretCounts = secretsScanningAlerts.length;

                  
                    // Prepare Excel workbook and worksheets
                    const workbook = new ExcelJS.Workbook();
                    const codeQLWorksheet = workbook.addWorksheet('CodeQL Scanning');
                    const dependencyScanningWorksheet = workbook.addWorksheet('Dependency Scanning');
                    const secretsScanningWorksheet = workbook.addWorksheet('Secrets Scanning');
                  
                    const dependencyScanningHeaders = ['NO.', 'Alert ID', 'Severity', 'Title', 'Opaque ID', 'Friendly Name', 'Description', 'Resources', 'Help Message', 'CVE ID', 'Repository URL', 'First Seen Date', 'Last Seen Date', 'Introduced Date', 'State', 'Item URL', 'Alert Link'];
    
                    const codeQLHeaders = ['NO.', 'Alert ID', 'Severity', 'Title', 'Opaque ID', 'Friendly Name', 'Description', 'Resources', 'Help Message', 'Repository URL', 'First Seen Date', 'Last Seen Date', 'Introduced Date', 'State', 'Item URL', 'Alert Link'];
                    
                    const secretHeaders = ['NO.', 'Alert ID', 'Severity', 'Title', 'Opaque ID', 'Friendly Name', 'Description', 'Help Message', 'Repository URL', 'First Seen Date', 'Last Seen Date', 'Introduced Date', 'State', 'Item URL', 'Truncated Secret', 'Confidence', 'Alert Link'];
                    
                    // Add headers to each worksheet
                    const setWorksheetHeadersAndWidths = (worksheet, headers) => {
                        // Add headers to the worksheet
                        worksheet.addRow(headers);
                    
                        // Set the width of column A
                        worksheet.getColumn('A').width = 5;
    
                        // Set the width of other columns (if needed)
                        worksheet.columns.slice(1).forEach((column, index) => {
                            column.width = 15; // Adjust the width as needed
                        });
                    };
                    // Set headers and widths for CodeQL worksheet
                    setWorksheetHeadersAndWidths(codeQLWorksheet, codeQLHeaders);
    
                    // Set headers and widths for Dependency Scanning worksheet
                    setWorksheetHeadersAndWidths(dependencyScanningWorksheet, dependencyScanningHeaders);
    
                    // Set headers and widths for Secrets Scanning worksheet
                    setWorksheetHeadersAndWidths(secretsScanningWorksheet, secretHeaders);
    
                    // Populate worksheets with data
                    function populateWorksheet(alerts, worksheet, headers) {
                        alerts.forEach((alert, index) => {
                            const { alertId, severity, title, tools, repositoryUrl, firstSeenDate, lastSeenDate, introducedDate, state, truncatedSecret, confidence, physicalLocations } = alert;
                            const tool = tools[0];
                            const description = tool.rules[0].description;
                            const alertLink = `https://dev.azure.com/{{Org}}/{{Project}}/_git/${projectRepo}/alerts/${alertId}?branch=refs%2Fheads%2Fmaster`
                            const filepath = physicalLocations.length > 0 ? physicalLocations[0].filePath : '';
                    
                            // Create a new row array to hold the data
                            const rowData = [];
                    
                            // Iterate through each header and populate the row data
                            headers.forEach(header => {
                                switch (header) {
                                    case 'NO.':
                                        // Add the index as the first column for numbering
                                        rowData.push(index + 1);
                                        break;
                                    case 'Alert ID':
                                        rowData.push(alertId);
                                        break;
                                    case 'Severity':
                                        rowData.push(severity);
                                        break;
                                    case 'Title':
                                        rowData.push(title);
                                        break;
                                    case 'Opaque ID':
                                        rowData.push(tool.rules[0].opaqueId);
                                        break;
                                    case 'Friendly Name':
                                        rowData.push(tool.rules[0].friendlyName);
                                        break;
                                    case 'Description':
                                        rowData.push(description);
                                        break;
                                    case 'Resources':
                                        rowData.push(tool.rules[0].resources || '');
                                        break;
                                    case 'Help Message':
                                        rowData.push(tool.rules[0].helpMessage || '');
                                        break;
                                    case 'CVE ID':
                                        if (tool.name === 'Advanced Security Dependency Scanning' && tool.rules[0].additionalProperties) {
                                            const { cveId } = tool.rules[0].additionalProperties;
                                            rowData.push(cveId || '');
                                        } else {
                                            rowData.push('');
                                        }
                                        break;
                                    case 'Repository URL':
                                        rowData.push(repositoryUrl);
                                        break;
                                    case 'First Seen Date':
                                        rowData.push(firstSeenDate);
                                        break;
                                    case 'Last Seen Date':
                                        rowData.push(lastSeenDate);
                                        break;
                                    case 'Introduced Date':
                                        rowData.push(introducedDate);
                                        break;
                                    case 'State':
                                        rowData.push(state);
                                        break;
                                    case 'Item URL':
                                        rowData.push(alert.physicalLocations[0].versionControl.itemUrl || '');
                                        break;
                                    case 'Truncated Secret':
                                        rowData.push(truncatedSecret || '');
                                        break;
                                    case 'Confidence':
                                        rowData.push(confidence || '');
                                        break;
                                    case 'Alert Link':
                                        rowData.push(alertLink);
                                        break;
                                    default:
                                        // Handle unknown headers
                                        rowData.push('');
                                }
                            });
                    
                            // Add the row data to the worksheet
                            worksheet.addRow(rowData);
                        });
                    }
                    
                  
                    populateWorksheet(codeQLAlerts, codeQLWorksheet, codeQLHeaders);
                    
                    populateWorksheet(dependencyScanningAlerts, dependencyScanningWorksheet, dependencyScanningHeaders);
                    populateWorksheet(secretsScanningAlerts, secretsScanningWorksheet, secretHeaders);
                    // Save workbook to a file
                    const currentDate = new Date();
                    // Function to add leading zeros to single-digit numbers
                    const addLeadingZero = num => (num < 10 ? "0" + num : num);

                    // Format date and time
                    const formattedDate = `${addLeadingZero(currentDate.getDate())}-${addLeadingZero(currentDate.getMonth() + 1)}-${currentDate.getFullYear()}`;
                    const formattedTime = `${addLeadingZero(currentDate.getHours())}${addLeadingZero(currentDate.getMinutes())}`;
                    const filePath = `vulnerabilities_${projectRepo}_${formattedDate}_${formattedTime}.xlsx`

                    workbook.xlsx.writeFile(filePath).then(function() {
    
                      console.log('Excel file generated successfully.');
                      const transporter = nodemailer.createTransport({
                        service: "Outlook365",
                        host: "smtp.office365.com",
                        port: 587,
                        secure: true,
                        auth: {
                          user: "{{email}}",
                          pass: "{{app-password}}",
                        },
                      });
                    // Create email message
                    const mailOptions = {
                        from: '{{sender-email}}',
                        to: emailsArray,
                        subject: `Scanning Result of GHAS Project ${projectRepo} at ${formattedDate}_${formattedTime}`,
                        text: `There are ${codeQLCounts} vulnerabilities found on Code Scanning, ${dependencyCounts} vulnerabilities found on Dependency Scanning, and ${secretCounts} vulnerabilities found on Secret Scanning`,
                        attachments: [
                        {
                            filename: filePath,
                            content: fs.createReadStream(filePath) // path to your Excel file
                        }
                        ]
                    };
                    
                    // Send email
                    transporter.sendMail(mailOptions, function(error, info){
                        if (error) {
                        console.error('Error sending email:', error);
                        } else {
                        console.log('Email sent:', info.response);
                        }
                    });
                    });
                }
               
              })
              .catch(function (error) {
                console.error('Error fetching data:', error);
              });
    
        }
        catch (err) {
            tl.setResult(tl.TaskResult.Failed, err.message);
        }
  
        
}
run();
