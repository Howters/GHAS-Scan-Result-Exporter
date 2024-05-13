# GHAS Scan Result Exporter

GHAS Scan Result Exporter is an Azure DevOps extension designed to streamline the retrieval and organization of GitHub Advanced Security (GHAS) scan results. Using Azure DevOps API, this extension fetches scan data and compiles it into an Excel file with three dedicated sheets: 'Code QL', 'Dependency Scanning', and 'Secret Scanning'. With seamless integration of ExcelJS, it empowers users to effortlessly generate detailed reports. Moreover, leveraging Nodemailer, it offers the functionality to send these reports as email attachments, facilitating efficient communication and collaboration within development teams. Simplify your security analysis workflow and enhance team productivity with GHAS Scan Result Exporter.

## Features

- **Retrieve GHAS Scan Results**: Utilize the Azure DevOps API to fetch detailed scan results from GitHub Advanced Security.
- **Excel File Generation**: Automatically generate an Excel file with three sheets ('Code QL', 'Dependency Scanning', 'Secret Scanning') containing comprehensive scan result data.
- **Email Attachment**: Seamlessly send the generated Excel file as an email attachment using Nodemailer, with the recipient address provided by the user.

## How it Works

1. **Retrieve Scan Results**: Access GHAS scan results through the Azure DevOps API.
2. **Generate Excel File**: Utilize ExcelJS to create an Excel file with detailed scan result information categorized into three sheets.
3. **Send Email**: Use Nodemailer to send the generated Excel file as an email attachment, with the recipient address specified by the user.

## Getting Started

1. Install the Azure DevOps extension.
2. Configure the extension with necessary permissions and settings.
3. Retrieve GHAS scan results and generate the Excel file with the provided script.
4. Provide the recipient email address to send the Excel file via email.

## Contributors

- Howters (https://github.com/howters)

## License

This extension is made for Bina Nusantara IT Division.
