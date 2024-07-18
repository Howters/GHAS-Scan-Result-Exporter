"use strict";
const tl = require("azure-pipelines-task-lib/task");
const axios = require("axios");
const ExcelJS = require("exceljs");
const nodemailer = require("nodemailer");
const fs = require("fs");

// Configuration
const EMAIL_USER = "{{sender-email}}";
const EMAIL_PASS = "{{app-password}}";
const AUTH_CRED = "{{Username}}:{{PAT}}";
const BASE64_AUTH = Buffer.from(AUTH_CRED).toString("base64");
const EMAIL_SERVICE = "Outlook365";
const EMAIL_HOST = "smtp.office365.com";
const EMAIL_PORT = 587;

const projectRepo = tl.getInput("projectRepo", true);
const recipientEmail = tl.getInput("recipientEmail", false);
const projectOwner = tl.getInput("projectOwner", true)
const projectRequester = tl.getInput("projectRequester", true)
const isProd = tl.getInput("isProd", true);
        
// const recipientEmail = "";
// const projectRequester = "";
// const isProd = 'true';

const getHeaders = () => ({
    headers: {
        "Content-Type": "application/json",
        Authorization: "Basic " + BASE64_AUTH,
    },
});

const fetchAlerts = (repo) => {
    const url = `https://advsec.dev.azure.com/{{Org}}/{{Project}}/_apis/alert/repositories/${repo}/alerts?api-version=7.2-preview.1&top=1000`;
    return axios.get(url, getHeaders());
};

const countSeverities = (alerts) => {
    const severityCounts = { low: 0, medium: 0, high: 0, critical: 0 };
    alerts.forEach(alert => {
        if (severityCounts.hasOwnProperty(alert.severity.toLowerCase())) {
            severityCounts[alert.severity.toLowerCase()]++;
        }
    });
    return severityCounts;
};

const formatSeverityCounts = (counts) => 
    `Critical: ${counts.critical}, High: ${counts.high}, Medium: ${counts.medium}, Low: ${counts.low}`;

const setWorksheetHeadersAndWidths = (worksheet, headers) => {
    worksheet.addRow(headers);
    worksheet.getColumn('A').width = 5;
    worksheet.columns.slice(1).forEach(column => column.width = 15);
};

const populateWorksheet = (alerts, worksheet, headers) => {
    alerts.forEach((alert, index) => {
        const {
            alertId, severity, title, tools, repositoryUrl, firstSeenDate, lastSeenDate, 
            introducedDate, state, truncatedSecret, confidence, physicalLocations 
        } = alert;

        const tool = tools[0];
        const description = tool.rules[0].description;
        const helpMessage = tools[0].rules[0].helpMessage;
        const alertLink = `https://dev.azure.com/{{Org}}/{{Project}}/_git/${projectRepo}/alerts/${alertId}?branch=refs%2Fheads%2Fmaster`;

        let recommendationText = "";
        const recommendationIndex = description.indexOf("Recommendation:");
        if (recommendationIndex !== -1) {
            recommendationText = description.substring(recommendationIndex + "Recommendation:".length).trim();
        }

        let recommendationsText = "";
        const recommendationsIndex = helpMessage.indexOf("## Recommendation") + "## Recommendation".length;
        if (recommendationsIndex !== -1) {
            const exampleIndex = helpMessage.indexOf("## Example");
            const referencesIndex = helpMessage.indexOf("## References");
            if (exampleIndex !== -1) {
                recommendationsText = helpMessage.substring(recommendationsIndex, exampleIndex).trim();
            } else if (referencesIndex !== -1) {
                recommendationsText = helpMessage.substring(recommendationsIndex, referencesIndex).trim();
            } else {
                recommendationsText = helpMessage.substring(recommendationsIndex).trim();
            }
        }

        const rowData = headers.map(header => {
            switch (header) {
                case 'NO.': return index + 1;
                case 'Alert ID': return alertId;
                case 'Severity': return severity;
                case 'Title': return title;
                case 'Opaque ID': return tool.rules[0].opaqueId;
                case 'Friendly Name': return tool.rules[0].friendlyName;
                case 'Description': return description;
                case 'Recommendation': return recommendationText;
                case 'Recommendations': return recommendationsText;
                case 'Resources': return tool.rules[0].resources || '';
                case 'Help Message': return helpMessage || '';
                case 'CVE ID':
                    if (tool.name === 'Advanced Security Dependency Scanning' && tool.rules[0].additionalProperties) {
                        return tool.rules[0].additionalProperties.cveId || '';
                    } else {
                        return '';
                    }
                case 'Repository URL': return repositoryUrl;
                case 'First Seen Date': return firstSeenDate;
                case 'Last Seen Date': return lastSeenDate;
                case 'Introduced Date': return introducedDate;
                case 'State': return state;
                case 'Item URL': return physicalLocations[0]?.versionControl.itemUrl || '';
                case 'Truncated Secret': return truncatedSecret || '';
                case 'Confidence': return confidence || '';
                case 'Alert Link': return alertLink;
                default: return '';
            }
        });

        worksheet.addRow(rowData);
    });
};

const sendEmail = (recipients, subject, text, attachments = []) => {
    const transporter = nodemailer.createTransport({
        service: EMAIL_SERVICE,
        host: EMAIL_HOST,
        port: EMAIL_PORT,
        secure: true,
        auth: {
            user: EMAIL_USER,
            pass: EMAIL_PASS,
        },
    });

    const mailOptions = {
        from: EMAIL_USER,
        to: recipients,
        subject,
        text,
        attachments,
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Error sending email:', error);
        } else {
            console.log('Email sent:', info.response);
        }
    });
};

const createExcelFile = async (alertsData, filePath) => {
    const workbook = new ExcelJS.Workbook();
    const codeQLWorksheet = workbook.addWorksheet('CodeQL Scanning');
    const dependencyScanningWorksheet = workbook.addWorksheet('Dependency Scanning');
    const secretsScanningWorksheet = workbook.addWorksheet('Secrets Scanning');

    const codeQLHeaders = ['NO.', 'Alert ID', 'Severity', 'Title', 'Opaque ID', 'Friendly Name', 'Description', 'Recommendations', 'Resources', 'Help Message', 'Repository URL', 'First Seen Date', 'Last Seen Date', 'Introduced Date', 'State', 'Item URL', 'Alert Link'];
    const dependencyScanningHeaders = ['NO.', 'Alert ID', 'Severity', 'Title', 'Opaque ID', 'Friendly Name', 'Description', 'Recommendation', 'Resources', 'Help Message', 'CVE ID', 'Repository URL', 'First Seen Date', 'Last Seen Date', 'Introduced Date', 'State', 'Item URL', 'Alert Link'];
    const secretHeaders = ['NO.', 'Alert ID', 'Severity', 'Title', 'Opaque ID', 'Friendly Name', 'Description', 'Help Message', 'Repository URL', 'First Seen Date', 'Last Seen Date', 'Introduced Date', 'State', 'Item URL', 'Truncated Secret', 'Confidence', 'Alert Link'];

    setWorksheetHeadersAndWidths(codeQLWorksheet, codeQLHeaders);
    setWorksheetHeadersAndWidths(dependencyScanningWorksheet, dependencyScanningHeaders);
    setWorksheetHeadersAndWidths(secretsScanningWorksheet, secretHeaders);

    const { codeQLAlerts, dependencyScanningAlerts, secretsScanningAlerts } = alertsData;

    populateWorksheet(codeQLAlerts, codeQLWorksheet, codeQLHeaders);
    populateWorksheet(dependencyScanningAlerts, dependencyScanningWorksheet, dependencyScanningHeaders);
    populateWorksheet(secretsScanningAlerts, secretsScanningWorksheet, secretHeaders);

    await workbook.xlsx.writeFile(filePath);
    console.log('Excel file generated successfully.');
};

const processDataAndSendEmail = (alerts) => {
    const codeQLAlerts = alerts.filter(alert => alert.tools.some(tool => tool.name === "CodeQL"));
    const dependencyScanningAlerts = alerts.filter(alert => alert.tools.some(tool => tool.name === "Advanced Security Dependency Scanning"));
    const secretsScanningAlerts = alerts.filter(alert => alert.tools.some(tool => tool.name === "Advanced Security Secrets Scanning"));

    const codeQLCounts = codeQLAlerts.length;
    const dependencyCounts = dependencyScanningAlerts.length;
    const secretCounts = secretsScanningAlerts.length;

    const codeQLSeverityCounts = countSeverities(codeQLAlerts);
    const dependencySeverityCounts = countSeverities(dependencyScanningAlerts);
    const secretSeverityCounts = countSeverities(secretsScanningAlerts);

    const totalSeverityCounts = {
        critical: codeQLSeverityCounts.critical + dependencySeverityCounts.critical + secretSeverityCounts.critical,
        high: codeQLSeverityCounts.high + dependencySeverityCounts.high + secretSeverityCounts.high,
        medium: codeQLSeverityCounts.medium + dependencySeverityCounts.medium + secretSeverityCounts.medium,
        low: codeQLSeverityCounts.low + dependencySeverityCounts.low + secretSeverityCounts.low,
    };

    const formattedCodeQLSeverityCounts = formatSeverityCounts(codeQLSeverityCounts);
    const formattedDependencySeverityCounts = formatSeverityCounts(dependencySeverityCounts);
    const formattedSecretSeverityCounts = formatSeverityCounts(secretSeverityCounts);
    const formattedTotalSeverityCounts = formatSeverityCounts(totalSeverityCounts);

    const totalCounts = codeQLCounts + dependencyCounts + secretCounts;

    const currentDate = new Date();
    currentDate.setHours(currentDate.getHours() + 7);
    const addLeadingZero = num => (num < 10 ? "0" + num : num);
    const formattedDate = `${addLeadingZero(currentDate.getDate())}-${addLeadingZero(currentDate.getMonth() + 1)}-${currentDate.getFullYear()}`;
    const subjectTime = `${addLeadingZero(currentDate.getHours())}:${addLeadingZero(currentDate.getMinutes())}`;
    const fileTime = `${addLeadingZero(currentDate.getHours())}${addLeadingZero(currentDate.getMinutes())}`;
    const filePath = `vulnerabilities_${projectRepo}_${formattedDate}_${fileTime}.xlsx`;

    createExcelFile({ codeQLAlerts, dependencyScanningAlerts, secretsScanningAlerts }, filePath).then(() => {
        const emailRecipients = recipientEmail.split(';').map(email => email.trim());
        emailRecipients.push(projectRequester);
        if (isProd === 'true') {
            emailRecipients.push("{{Cyber email}}");
        }
        const uniqueEmailsArray = [...new Set(emailRecipients)];

        const emailText = `Division by: ${projectOwner}
Project Requester: ${projectRequester}
Location Project: ${projectRepo}

Link to view the alert: https://dev.azure.com/{{Org}}/{{Project}}/_git/${projectRepo}/alerts

In total, there are ${totalCounts} vulnerabilities:
${formattedTotalSeverityCounts}

Description:
--------------------------------------------------------------------
There are ${codeQLCounts} vulnerabilities found on Code Scanning:
${formattedCodeQLSeverityCounts}

${dependencyCounts} vulnerabilities found on Dependency Scanning:
${formattedDependencySeverityCounts}

${secretCounts} vulnerabilities found on Secret Scanning:
${formattedSecretSeverityCounts}`;

        sendEmail(uniqueEmailsArray, `Scanning Result of GHAS Project ${projectRepo} at ${formattedDate} on ${subjectTime}`, emailText, [{ filename: filePath, content: fs.createReadStream(filePath) }]);
    });
};

const run = () => {
    if (isProd === 'false') {
        console.log('This Repository is NOT for Production');
        return
    }

    fetchAlerts(projectRepo).then(response => {
        if (response.data.count === 0) {
            sendEmail(
                recipientEmail.split(';').map(email => email.trim()),
                `GHAS-${projectRepo}`,
                `There are no alerts found on the repository: ${projectRepo}`
            );
        } else {
            processDataAndSendEmail(response.data.value);
        }
    }).catch(error => {
        console.error('Error fetching data:', error);
        tl.setResult(tl.TaskResult.Failed, error.message);
    });
};

run();
